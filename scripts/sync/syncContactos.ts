import { env } from './env.js';
import { fetchAllRows, NocoRow } from './nocodbClient.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import {
  chunk,
  cleanRaw,
  mapEstadoSimplificado,
  maxIsoDate,
  toIsoDate,
  toNumber,
  toText,
} from './helpers.js';

const BATCH_SIZE = 500;

export interface ContactoRecord {
  tenant_id: string;
  nocodb_id: number;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  pais: string | null;
  estado_actual: string | null;
  estado_simplificado: string | null;
  motivo_venta_perdida: string | null;
  vendedora_nocodb_id: number | null;
  vendedora_id: string | null;
  estimated_value: number | null;
  lead_age_days: number | null;
  proximo_contacto: string | null;
  registrar_actividad: string | null;
  etiquetas: string[];
  last_interaction_at: string | null;
  nocodb_created_at: string | null;
  nocodb_updated_at: string | null;
  raw: Record<string, unknown>;
  synced_at: string;
}

async function loadVendedoraMap(tenantId: string): Promise<Map<number, string>> {
  const { data, error } = await supabaseAdmin
    .from('vendedoras')
    .select('id, nocodb_id')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  const m = new Map<number, string>();
  for (const v of data ?? []) m.set(v.nocodb_id, v.id);
  return m;
}

function normalize(
  row: NocoRow,
  tenantId: string,
  vendedoraMap: Map<number, string>,
): ContactoRecord | null {
  const nocoId = toNumber(row['Id']);
  if (nocoId === null) return null;

  const estadoActual = toText(row['Estado Actual']);
  const vendedoraNocoId = toNumber(row['Vendedoras_id']);
  const vendedoraId = vendedoraNocoId !== null ? vendedoraMap.get(vendedoraNocoId) ?? null : null;

  const etiquetasRaw = row['Nombre de la Etiqueta (from Etiquetas)'];
  const etiquetas = Array.isArray(etiquetasRaw)
    ? etiquetasRaw.map((x) => String(x).trim()).filter(Boolean)
    : [];

  return {
    tenant_id: tenantId,
    nocodb_id: nocoId,
    nombre: toText(row['Nombre']),
    apellido: toText(row['Apellido']),
    email: toText(row['Email']),
    telefono: toText(row['Teléfono']),
    pais: toText(row['País']),
    estado_actual: estadoActual,
    estado_simplificado: mapEstadoSimplificado(estadoActual),
    motivo_venta_perdida: toText(row['Motivo Venta Perdida']),
    vendedora_nocodb_id: vendedoraNocoId,
    vendedora_id: vendedoraId,
    estimated_value: toNumber(row['EstimatedValue']),
    lead_age_days: toNumber(row['Lead_Age_Days']),
    proximo_contacto: toIsoDate(row['Próximo Contacto']),
    registrar_actividad: toText(row['Registrar Actividad']),
    etiquetas,
    last_interaction_at: maxIsoDate(row['Last_Interaction']),
    nocodb_created_at: toIsoDate(row['CreatedAt']),
    nocodb_updated_at: toIsoDate(row['UpdatedAt']),
    raw: cleanRaw(row, ['Resumen de la Interacción (from Interacciones)']),
    synced_at: new Date().toISOString(),
  };
}

export async function syncContactos(tenantId: string, runId: string) {
  console.log('\n=== Sync Contactos ===');
  const started = Date.now();

  const vendedoraMap = await loadVendedoraMap(tenantId);
  console.log(`  ${vendedoraMap.size} vendedoras cargadas para FK lookup`);

  const rows = await fetchAllRows(env.TABLE_CONTACTS, 'contactos');
  const records = rows
    .map((r) => normalize(r, tenantId, vendedoraMap))
    .filter((r): r is ContactoRecord => r !== null);

  let upserted = 0;
  let batchNum = 0;
  const totalBatches = Math.ceil(records.length / BATCH_SIZE);
  for (const batch of chunk(records, BATCH_SIZE)) {
    batchNum++;
    const { error, count } = await supabaseAdmin
      .from('contactos')
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
          error: { message: error.message, details: error.details, hint: error.hint },
        })
        .eq('id', runId);
      throw error;
    }
    upserted += count ?? batch.length;
    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      console.log(`  upserted batch ${batchNum}/${totalBatches} (${upserted} rows)`);
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ✓ ${upserted} contactos upserted en ${elapsed}s`);
  return { rows: upserted };
}
