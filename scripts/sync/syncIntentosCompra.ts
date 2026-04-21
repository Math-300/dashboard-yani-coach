import { env } from './env.js';
import { fetchAllRows, NocoRow } from './nocodbClient.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { chunk, cleanRaw, toIsoDate, toNumber, toText } from './helpers.js';

const BATCH_SIZE = 200;

interface IntentoRecord {
  tenant_id: string;
  nocodb_id: number;
  contacto_nocodb_id: number | null;
  contacto_id: string | null;
  vendedora_nocodb_id: number | null;
  vendedora_id: string | null;
  status: string | null;
  fecha: string | null;
  recovery_seller_nocodb_id: number | null;
  raw: Record<string, unknown>;
  synced_at: string;
}

async function loadLookups(tenantId: string) {
  const [v, c] = await Promise.all([
    supabaseAdmin.from('vendedoras').select('id, nocodb_id').eq('tenant_id', tenantId),
    supabaseAdmin.from('contactos').select('id, nocodb_id').eq('tenant_id', tenantId),
  ]);
  if (v.error) throw v.error;
  if (c.error) throw c.error;
  const vendedoras = new Map<number, string>();
  for (const r of v.data ?? []) vendedoras.set(r.nocodb_id, r.id);
  const contactos = new Map<number, string>();
  for (const r of c.data ?? []) contactos.set(r.nocodb_id, r.id);
  return { vendedoras, contactos };
}

function normalize(
  row: NocoRow,
  tenantId: string,
  lookups: { vendedoras: Map<number, string>; contactos: Map<number, string> },
): IntentoRecord | null {
  const nocoId = toNumber(row['Id']);
  if (nocoId === null) return null;

  const vendedoraNocoId = toNumber(row['Vendedoras_id']);
  const contactoNocoId = toNumber(row['Contactos_id']);
  const recovery = row['Vendedora de Recuperación'];
  const recoveryId = recovery && typeof recovery === 'object'
    ? toNumber((recovery as Record<string, unknown>)['Id'])
    : null;

  return {
    tenant_id: tenantId,
    nocodb_id: nocoId,
    contacto_nocodb_id: contactoNocoId,
    contacto_id: contactoNocoId !== null ? lookups.contactos.get(contactoNocoId) ?? null : null,
    vendedora_nocodb_id: vendedoraNocoId,
    vendedora_id: vendedoraNocoId !== null ? lookups.vendedoras.get(vendedoraNocoId) ?? null : null,
    status: toText(row['Estado']),
    fecha: toIsoDate(row['Fecha de Alerta']) ?? toIsoDate(row['CreatedAt']),
    recovery_seller_nocodb_id: recoveryId,
    raw: cleanRaw(row, ['Usuario Vendedora']),
    synced_at: new Date().toISOString(),
  };
}

export async function syncIntentosCompra(tenantId: string, runId: string) {
  console.log('\n=== Sync Intentos de Compra ===');
  const started = Date.now();

  const lookups = await loadLookups(tenantId);
  const rows = await fetchAllRows(env.TABLE_ATTEMPTS, 'intentos_compra');
  const records = rows.map((r) => normalize(r, tenantId, lookups)).filter((r): r is IntentoRecord => r !== null);

  let upserted = 0;
  for (const batch of chunk(records, BATCH_SIZE)) {
    const { error, count } = await supabaseAdmin
      .from('intentos_compra')
      .upsert(batch, { onConflict: 'tenant_id,nocodb_id', count: 'exact' });
    if (error) {
      await supabaseAdmin
        .from('sync_runs')
        .update({ status: 'error', finished_at: new Date().toISOString(), rows_failed: batch.length, error: { message: error.message, details: error.details } })
        .eq('id', runId);
      throw error;
    }
    upserted += count ?? batch.length;
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ✓ ${upserted} intentos upserted en ${elapsed}s`);
  return { rows: upserted };
}
