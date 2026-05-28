import assert from 'node:assert/strict';
import { config as loadDotenv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Cargar .env.local (misma convención que scripts/sync/env.ts).
loadDotenv({ path: '.env.local', override: false });

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
// Usar la anon key para validar también el GRANT ... TO anon (camino real del dashboard).
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!;
const TENANT = process.env.VITE_SUPABASE_TENANT_ID ?? '7558d73a-e97b-4422-ab5c-db87f6626592';

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

async function main() {
  // Sin filtro de fecha: el embudo histórico completo.
  const { data, error } = await supabase.rpc('get_funnel_respondio', {
    p_tenant_id: TENANT,
    p_start: null,
    p_end: null,
  });
  assert.equal(error, null, `RPC error: ${error?.message}`);
  assert.ok(Array.isArray(data) && data.length === 1, 'RPC debe devolver 1 fila');
  const r = data[0];

  // venta_cerrada sale de la tabla ventas, NO del estado: debe ser >> 14.
  assert.ok(r.venta_cerrada > 100, `venta_cerrada=${r.venta_cerrada} debe ser >100 (sale de ventas)`);
  assert.ok(r.respondieron > 0, 'respondieron debe ser >0');
  assert.ok(r.leads_nuevos >= r.respondieron, 'leads_nuevos >= respondieron');
  // mediana << media (la media está inflada por outliers).
  assert.ok(
    r.tiempo_resp_mediana_min !== null && Number(r.tiempo_resp_mediana_min) < 120,
    `mediana=${r.tiempo_resp_mediana_min} debe ser <120min`,
  );

  // Con filtro de fecha (últimos 30 días) leads_nuevos debe ser menor que el histórico.
  const start = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: d2, error: e2 } = await supabase.rpc('get_funnel_respondio', {
    p_tenant_id: TENANT, p_start: start, p_end: new Date().toISOString(),
  });
  assert.equal(e2, null, `RPC fecha error: ${e2?.message}`);
  assert.ok(d2[0].leads_nuevos < r.leads_nuevos, 'filtro de fecha debe reducir leads_nuevos');

  console.log('✓ get_funnel_respondio OK', JSON.stringify(r));
}
main().catch((e) => { console.error(e); process.exit(1); });
