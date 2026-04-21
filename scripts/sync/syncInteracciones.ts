import { env } from './env.js';
import { fetchAllRows, NocoRow } from './nocodbClient.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { chunk, cleanRaw, toIsoDate, toNumber, toText } from './helpers.js';

const BATCH_SIZE = 500;

interface InteraccionRecord {
  tenant_id: string;
  nocodb_id: number;
  contacto_nocodb_id: number | null;
  contacto_id: string | null;
  vendedora_nocodb_id: number | null;
  vendedora_id: string | null;
  tipo: string | null;
  medio_canal: string | null;
  fecha: string | null;
  resumen: string | null;
  duracion_segundos: number | null;
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
): InteraccionRecord | null {
  const nocoId = toNumber(row['Id']);
  if (nocoId === null) return null;

  const vendedoraNocoId = toNumber(row['Vendedoras_id']);
  const contactoNocoId = toNumber(row['Contactos_id']);
  const durMin = toNumber(row['Duración (Minutos)']);
  const durSec = durMin !== null ? Math.round(durMin * 60) : null;

  return {
    tenant_id: tenantId,
    nocodb_id: nocoId,
    contacto_nocodb_id: contactoNocoId,
    contacto_id: contactoNocoId !== null ? lookups.contactos.get(contactoNocoId) ?? null : null,
    vendedora_nocodb_id: vendedoraNocoId,
    vendedora_id: vendedoraNocoId !== null ? lookups.vendedoras.get(vendedoraNocoId) ?? null : null,
    tipo: toText(row['Tipo']),
    medio_canal: toText(row['Medio/Canal']),
    fecha: toIsoDate(row['Fecha']) ?? toIsoDate(row['CreatedAt']),
    resumen: toText(row['Resumen de la Interacción']),
    duracion_segundos: durSec,
    raw: cleanRaw(row, ['Usuario Vendedora']),
    synced_at: new Date().toISOString(),
  };
}

export async function syncInteracciones(tenantId: string, runId: string) {
  console.log('\n=== Sync Interacciones ===');
  const started = Date.now();

  const lookups = await loadLookups(tenantId);
  console.log(`  FK maps: ${lookups.vendedoras.size} vendedoras, ${lookups.contactos.size} contactos`);

  const rows = await fetchAllRows(env.TABLE_INTERACTIONS, 'interacciones');
  const records = rows.map((r) => normalize(r, tenantId, lookups)).filter((r): r is InteraccionRecord => r !== null);

  let upserted = 0;
  let batchNum = 0;
  const totalBatches = Math.ceil(records.length / BATCH_SIZE);
  for (const batch of chunk(records, BATCH_SIZE)) {
    batchNum++;
    const { error, count } = await supabaseAdmin
      .from('interacciones')
      .upsert(batch, { onConflict: 'tenant_id,nocodb_id', count: 'exact' });
    if (error) {
      await supabaseAdmin
        .from('sync_runs')
        .update({ status: 'error', finished_at: new Date().toISOString(), rows_failed: batch.length, error: { message: error.message, details: error.details } })
        .eq('id', runId);
      throw error;
    }
    upserted += count ?? batch.length;
    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      console.log(`  upserted batch ${batchNum}/${totalBatches} (${upserted} rows)`);
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ✓ ${upserted} interacciones upserted en ${elapsed}s`);
  return { rows: upserted };
}
