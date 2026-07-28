import { env } from './env.js';
import { fetchAllRows, NocoRow } from './nocodbClient.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { chunk, cleanRaw, toIsoDate, toNumber, toText } from './helpers.js';

const BATCH_SIZE = 200;

interface VentaRecord {
  tenant_id: string;
  nocodb_id: number;
  contacto_nocodb_id: number | null;
  contacto_id: string | null;
  vendedora_nocodb_id: number | null;
  vendedora_id: string | null;
  amount: number | null;
  producto: string | null;
  fecha: string | null;
  payment_status: string | null;
  sales_cycle_days: number | null;
  tipo_oferta: string | null;
  // `ventas` es la única tabla que conserva `raw`, y no por comodidad: la columna GENERADA
  // `es_duplicado` se calcula con `raw->>'origen'`, y de ella dependen la política RLS de la
  // tabla y dos vistas materializadas. Sacar `raw` acá reclasificaría las ventas viejas del
  // backfill CSV y cambiaría la facturación histórica de feb-may.
  // Se le quita `email` (982 filas lo traían desde el import CSV): no lo lee nadie.
  // Pendiente: promover `origen` a columna propia, redefinir `es_duplicado`, y recién ahí
  // sacar `raw` — es una operación aparte, con verificación de totales antes y después.
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

function pickProducto(row: NocoRow): string | null {
  const prod = row['Producto Vendido'];
  if (prod && typeof prod === 'object') {
    const name = (prod as Record<string, unknown>)['Nombre del Producto'];
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return toText(row['Tipo de Oferta']);
}

function normalize(
  row: NocoRow,
  tenantId: string,
  lookups: { vendedoras: Map<number, string>; contactos: Map<number, string> },
): VentaRecord | null {
  const nocoId = toNumber(row['Id']);
  if (nocoId === null) return null;

  const vendedoraNocoId = toNumber(row['Vendedoras_id']);
  const contactoNocoId = toNumber(row['Contactos_id']);

  return {
    tenant_id: tenantId,
    nocodb_id: nocoId,
    contacto_nocodb_id: contactoNocoId,
    contacto_id: contactoNocoId !== null ? lookups.contactos.get(contactoNocoId) ?? null : null,
    vendedora_nocodb_id: vendedoraNocoId,
    vendedora_id: vendedoraNocoId !== null ? lookups.vendedoras.get(vendedoraNocoId) ?? null : null,
    amount: toNumber(row['Monto Final']),
    producto: pickProducto(row),
    fecha: toIsoDate(row['Fecha']) ?? toIsoDate(row['CreatedAt']),
    payment_status: toText(row['Estado del Pago']),
    sales_cycle_days: toNumber(row['Sales_Cycle_Days']),
    // El dashboard lo usaba leyéndolo de `raw`; ahora es columna propia.
    tipo_oferta: toText(row['Tipo de Oferta']),
    raw: cleanRaw(row, ['Usuario Vendedora', 'email']),
    synced_at: new Date().toISOString(),
  };
}

export async function syncVentas(tenantId: string, runId: string) {
  console.log('\n=== Sync Ventas ===');
  const started = Date.now();

  const lookups = await loadLookups(tenantId);
  const rows = await fetchAllRows(env.TABLE_SALES, 'ventas');
  const records = rows.map((r) => normalize(r, tenantId, lookups)).filter((r): r is VentaRecord => r !== null);

  let upserted = 0;
  for (const batch of chunk(records, BATCH_SIZE)) {
    const { error, count } = await supabaseAdmin
      .from('ventas')
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
  console.log(`  ✓ ${upserted} ventas upserted en ${elapsed}s`);
  return { rows: upserted };
}
