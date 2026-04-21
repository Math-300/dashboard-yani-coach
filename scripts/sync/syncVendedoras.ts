import { env } from './env.js';
import { fetchAllRows, NocoRow } from './nocodbClient.js';
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

function normalize(row: NocoRow, tenantId: string): VendedoraRecord | null {
  const nocoId = toNumber(row['Id']);
  if (nocoId === null) return null;
  return {
    tenant_id: tenantId,
    nocodb_id: nocoId,
    nombre: toText(row['Nombre de la Vendedora']) ?? toText(row['Nombre']),
    email: toText(row['Email']),
    estado: toText(row['Estado']),
    chatwoot_agent_id: toNumber(row['Chatwoot Agent ID']),
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
  const records = rows
    .map((r) => normalize(r, tenantId))
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
