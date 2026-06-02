import { env } from './env.js';
import { fetchAllRows, NocoRow } from './nocodbClient.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { chunk, toText } from './helpers.js';

const BATCH_SIZE = 200;

export interface PlantillaCatalogoRecord {
  tenant_id: string;
  template_name: string;
  shortcode: string | null;
  descripcion: string | null;
  activo: boolean | null;
  es_masivo: boolean;
  synced_at: string;
}

function normalize(row: NocoRow, tenantId: string): PlantillaCatalogoRecord | null {
  const templateName = toText(row['template_name']);
  if (!templateName) return null;
  // es_masivo: el template está linkeado a >=1 campaña en Campanias_Mensajeria.
  const campanias = row['Campanias_Mensajeria'];
  const esMasivo = Array.isArray(campanias) && campanias.length > 0;
  return {
    tenant_id: tenantId,
    template_name: templateName,
    shortcode: toText(row['shortcode']),
    descripcion: toText(row['descripcion']),
    activo: row['activo'] == null ? null : Boolean(row['activo']),
    es_masivo: esMasivo,
    synced_at: new Date().toISOString(),
  };
}

export async function syncPlantillas(tenantId: string, runId: string) {
  console.log('\n=== Sync Plantillas (catálogo) ===');
  const started = Date.now();

  const rows = await fetchAllRows(env.TABLE_TEMPLATES, 'plantillas_catalogo');
  const records = rows
    .map((r) => normalize(r, tenantId))
    .filter((r): r is PlantillaCatalogoRecord => r !== null);

  let upserted = 0;
  for (const batch of chunk(records, BATCH_SIZE)) {
    const { error, count } = await supabaseAdmin
      .from('plantillas_catalogo')
      .upsert(batch, {
        onConflict: 'tenant_id,template_name',
        ignoreDuplicates: false,
        count: 'exact',
      });
    if (error) {
      await supabaseAdmin.from('sync_runs').update({
        status: 'error',
        finished_at: new Date().toISOString(),
        rows_failed: batch.length,
        error: { message: error.message, details: error.details },
      }).eq('id', runId);
      throw error;
    }
    upserted += count ?? batch.length;
  }

  const masivos = records.filter((r) => r.es_masivo).map((r) => r.template_name);
  console.log(`  ✓ ${upserted} templates en catálogo (${masivos.length} masivos: ${masivos.join(', ') || '—'}) en ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return { rows: upserted };
}
