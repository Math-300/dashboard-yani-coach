import { env } from './env.js';
import { fetchAllRows, NocoRow } from './nocodbClient.js';
import { listAgents } from './chatwootClient.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { chunk, cleanRaw, toIsoDate, toNumber, toText } from './helpers.js';

const BATCH_SIZE = 200;

export interface VendedoraRecord {
  tenant_id: string;
  nocodb_id: number;
  nombre: string | null;
  email: string | null;
  estado: string | null;
  chatwoot_agent_id: number | null;
  raw: Record<string, unknown>;
  nocodb_created_at: string | null;
  nocodb_updated_at: string | null;
  synced_at: string;
}

function normalize(
  row: NocoRow,
  tenantId: string,
  agentByEmail: Map<string, number>,
): VendedoraRecord | null {
  const nocoId = toNumber(row['Id']);
  if (nocoId === null) return null;
  const email = toText(row['Email']);
  // chatwoot_agent_id: NocoDB no tiene el campo; lo resolvemos por email contra los agentes de Chatwoot.
  const chatwootAgentId =
    toNumber(row['Chatwoot Agent ID']) ??
    (email ? agentByEmail.get(email.trim().toLowerCase()) ?? null : null);
  return {
    tenant_id: tenantId,
    nocodb_id: nocoId,
    nombre: toText(row['Nombre de la Vendedora']) ?? toText(row['Nombre']),
    email,
    estado: toText(row['Estado']),
    chatwoot_agent_id: chatwootAgentId,
    raw: cleanRaw(row),
    nocodb_created_at: toIsoDate(row['CreatedAt']),
    nocodb_updated_at: toIsoDate(row['UpdatedAt']),
    synced_at: new Date().toISOString(),
  };
}

export async function syncVendedoras(tenantId: string, runId: string) {
  console.log('\n=== Sync Vendedoras ===');
  const started = Date.now();

  const rows = await fetchAllRows(env.TABLE_SELLERS, 'vendedoras');

  // Mapa email→agent_id de Chatwoot para resolver chatwoot_agent_id (NocoDB no lo guarda).
  const agentByEmail = new Map<string, number>();
  try {
    for (const a of await listAgents()) {
      if (a.email) agentByEmail.set(a.email.trim().toLowerCase(), a.id);
    }
    console.log(`  ${agentByEmail.size} agentes Chatwoot para resolver por email`);
  } catch (e) {
    console.warn('  ⚠ no pude listar agentes Chatwoot, chatwoot_agent_id quedará null:', (e as Error).message);
  }

  const records = rows
    .map((r) => normalize(r, tenantId, agentByEmail))
    .filter((r): r is VendedoraRecord => r !== null);

  let inserted = 0;
  for (const batch of chunk(records, BATCH_SIZE)) {
    const { error, count } = await supabaseAdmin
      .from('vendedoras')
      .upsert(batch, {
        onConflict: 'tenant_id,nocodb_id',
        ignoreDuplicates: false,
        count: 'exact',
      });
    if (error) {
      await supabaseAdmin
        .from('sync_runs')
        .update({
          status: 'error',
          finished_at: new Date().toISOString(),
          rows_failed: batch.length,
          error: { message: error.message, details: error.details },
        })
        .eq('id', runId);
      throw error;
    }
    inserted += count ?? batch.length;
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ✓ ${inserted} vendedoras upserted en ${elapsed}s`);
  return { rows: inserted };
}
