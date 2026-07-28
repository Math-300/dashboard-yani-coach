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
import { syncChatwoot } from './syncChatwoot.js';
import { syncPlantillas } from './syncPlantillas.js';

type SyncFn = (tenantId: string, runId: string) => Promise<{ rows: number }>;

// Orden = prioridad + tamaño. Las tablas CRÍTICAS y CHICAS van primero
// (vendedoras→ventas→intentos→plantillas: segundos c/u) y las GRANDES/lentas
// al final (interacciones ~30k, contactos ~32k, chatwoot ~2200 convs).
// Motivo (2026-07-09): con el orden viejo, `contactos` (full-scan lento + 429)
// se colgaba y —al ser el pipeline secuencial— bloqueaba a `ventas` río abajo,
// congelando el dashboard. Con ventas primero + aislamiento de fallos (ver main),
// una tabla lenta que muera ya NO impide sincronizar las ventas.
// El orden NO afecta los FK: `resolve_foreign_keys` corre al final por nocodb_id.
const TABLES: Record<string, SyncFn> = {
  vendedoras: syncVendedoras,
  ventas: syncVentas,
  intentos_compra: syncIntentosCompra,
  plantillas: syncPlantillas,
  interacciones: syncInteracciones,
  contactos: syncContactos,
  chatwoot: syncChatwoot,
};

async function openRun(tenantId: string, tableName: string): Promise<string> {
  const source = tableName === 'chatwoot' ? 'chatwoot' : 'nocodb';
  const { data, error } = await supabaseAdmin
    .from('sync_runs')
    .insert({
      tenant_id: tenantId,
      source,
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

async function closeRunError(runId: string, err: unknown) {
  // Fallo VISIBLE (regla cero-tolerancia): el run queda como 'error' en sync_runs,
  // consultable desde el dashboard/Supabase, en vez de tragarse en silencio.
  console.error(`  ⚠ marcando sync_run ${runId} como error`);
  await supabaseAdmin
    .from('sync_runs')
    .update({ status: 'error', finished_at: new Date().toISOString() })
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
  const { error: cwErr } = await supabaseAdmin.rpc('resolve_chatwoot_fks', { p_tenant_id: tenantId });
  if (cwErr) {
    console.error('  ✗ resolve_chatwoot_fks falló:', cwErr.message);
    throw cwErr;
  }
  console.log('  ✓ FKs de Chatwoot resueltos');
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
  // AISLAMIENTO DE FALLOS (2026-07-09): una tabla que falla/cuelga NO detiene el
  // resto. Antes un `process.exit(1)` en la 1ª tabla que fallaba mataba todo el
  // pipeline → si `contactos` moría, `ventas` nunca sincronizaba. Ahora cada
  // tabla se aísla, se acumula el fallo y se sigue; FK+MV corren igual al final;
  // el proceso sale con código 1 sólo si hubo algún fallo (visibilidad en sync_runs).
  const failed: string[] = [];
  for (const name of selected) {
    const runId = await openRun(tenantId, name);
    try {
      const { rows } = await TABLES[name](tenantId, runId);
      await closeRun(runId, rows);
    } catch (e) {
      console.error(`\n✗ Sync ${name} falló (se continúa con las demás):`, e);
      await closeRunError(runId, e);
      failed.push(name);
    }
  }

  // FK + refresh SIEMPRE, aunque alguna tabla haya fallado: así las tablas que sí
  // sincronizaron (p.ej. ventas) quedan visibles en el dashboard igual.
  try {
    await resolveForeignKeys(tenantId);
  } catch (e) {
    console.error('\n✗ resolveForeignKeys falló:', e);
    failed.push('resolve_fks');
  }
  try {
    await refreshViews();
  } catch (e) {
    console.error('\n✗ refreshViews falló:', e);
    failed.push('refresh_views');
  }

  console.log(`\nTotal: ${((Date.now() - totalStart) / 1000).toFixed(1)}s`);
  if (failed.length > 0) {
    console.error(`\n⚠ Pasos con fallo: ${failed.join(', ')}. El resto sincronizó OK.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
