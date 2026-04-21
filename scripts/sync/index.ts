/**
 * Sync orchestrator NocoDB → Supabase.
 * PoC Fase 2: vendedoras + contactos. Refresca materialized views al final.
 *
 * Uso:
 *   npm run sync                  (todo)
 *   npm run sync -- contactos     (solo una tabla)
 */
import { getTenantId, supabaseAdmin } from './supabaseAdmin.js';
import { syncVendedoras } from './syncVendedoras.js';
import { syncContactos } from './syncContactos.js';
import { syncInteracciones } from './syncInteracciones.js';
import { syncVentas } from './syncVentas.js';
import { syncIntentosCompra } from './syncIntentosCompra.js';

type SyncFn = (tenantId: string, runId: string) => Promise<{ rows: number }>;

// Orden importa: contactos depende de vendedoras (FK),
// interacciones/ventas/intentos dependen de contactos + vendedoras.
const TABLES: Record<string, SyncFn> = {
  vendedoras: syncVendedoras,
  contactos: syncContactos,
  interacciones: syncInteracciones,
  ventas: syncVentas,
  intentos_compra: syncIntentosCompra,
};

async function openRun(tenantId: string, tableName: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('sync_runs')
    .insert({
      tenant_id: tenantId,
      source: 'nocodb',
      table_name: tableName,
      status: 'running',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`No pude abrir sync_run: ${error?.message}`);
  return data.id;
}

async function closeRun(runId: string, rows: number) {
  await supabaseAdmin
    .from('sync_runs')
    .update({
      status: 'success',
      finished_at: new Date().toISOString(),
      rows_updated: rows,
    })
    .eq('id', runId);
}

async function resolveForeignKeys(tenantId: string) {
  // supabase-js limita SELECT a 1000 rows por default, por lo que no podemos
  // resolver FKs en memoria cuando hay tablas grandes (contactos 30k). Hacemos
  // un UPDATE ... FROM server-side — O(tabla) en Postgres, no en el cliente.
  console.log('\n=== Resolver FKs server-side ===');
  const started = Date.now();
  const { error } = await supabaseAdmin.rpc('resolve_foreign_keys', { p_tenant_id: tenantId });
  if (error) {
    console.error('  ✗ resolve_foreign_keys falló:', error.message);
    throw error;
  }
  console.log(`  ✓ FKs resueltos en ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

async function refreshViews() {
  console.log('\n=== Refresh materialized views ===');
  const started = Date.now();
  const { error } = await supabaseAdmin.rpc('refresh_materialized_views');
  if (error) {
    console.error('  ✗ Refresh falló:', error.message);
    throw error;
  }
  console.log(`  ✓ 3 MVs refrescadas en ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const selected = args.length > 0 ? args : Object.keys(TABLES);

  for (const t of selected) {
    if (!TABLES[t]) {
      console.error(`Tabla desconocida: ${t}. Disponibles: ${Object.keys(TABLES).join(', ')}`);
      process.exit(1);
    }
  }

  const tenantId = await getTenantId();
  console.log(`Tenant: ${tenantId}`);
  console.log(`Tablas a sincronizar: ${selected.join(', ')}`);

  const totalStart = Date.now();
  for (const name of selected) {
    const runId = await openRun(tenantId, name);
    try {
      const { rows } = await TABLES[name](tenantId, runId);
      await closeRun(runId, rows);
    } catch (e) {
      console.error(`\n✗ Sync ${name} falló:`, e);
      process.exit(1);
    }
  }

  await resolveForeignKeys(tenantId);
  await refreshViews();
  console.log(`\nTotal: ${((Date.now() - totalStart) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
