/**
 * Smoke test del datasource.
 * Simula lo que hace el Dashboard client-side con la anon key.
 * Uso: npm run smoke
 */
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
for (const f of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), f);
  if (existsSync(p)) loadDotenv({ path: p, override: false });
}

import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const TENANT_ID = process.env.VITE_SUPABASE_TENANT_ID!;

if (!URL || !ANON || !TENANT_ID) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_TENANT_ID');
  process.exit(1);
}

const sb = createClient(URL, ANON, { auth: { persistSession: false } });

async function main() {
  const fmt = (ms: number) => `${ms}ms`;
  const t = (label: string, fn: () => Promise<any>) => async () => {
    const start = Date.now();
    try {
      const r = await fn();
      console.log(`✓ ${label.padEnd(30)} ${fmt(Date.now() - start).padStart(6)}  ${JSON.stringify(r).slice(0, 120)}`);
    } catch (e: any) {
      console.log(`✗ ${label.padEnd(30)} ${fmt(Date.now() - start).padStart(6)}  ${e.message || e}`);
    }
  };

  await t('mv_funnel_counts', async () => {
    const { data, error } = await sb.from('mv_funnel_counts').select('estado_simplificado, total').eq('tenant_id', TENANT_ID).order('total', { ascending: false });
    if (error) throw error;
    return data;
  })();

  await t('mv_vendedora_performance', async () => {
    const { data, error } = await sb.from('mv_vendedora_performance').select('nombre, sales_count, total_amount, leads_total').eq('tenant_id', TENANT_ID).order('total_amount', { ascending: false });
    if (error) throw error;
    return data;
  })();

  await t('mv_sales_trend_monthly', async () => {
    const { data, error } = await sb.from('mv_sales_trend_monthly').select('mes, ventas_cantidad, ventas_monto').eq('tenant_id', TENANT_ID).order('mes', { ascending: false }).limit(3);
    if (error) throw error;
    return data;
  })();

  await t('contactos (últimos 5)', async () => {
    const { data, error } = await sb.from('contactos').select('nocodb_id, nombre, estado_simplificado, nocodb_created_at').eq('tenant_id', TENANT_ID).order('nocodb_created_at', { ascending: false }).limit(5);
    if (error) throw error;
    return data?.map((r: any) => `${r.nombre}(${r.estado_simplificado})`);
  })();

  await t('contactos COUNT exact', async () => {
    const { count, error } = await sb.from('contactos').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID);
    if (error) throw error;
    return { count };
  })();

  await t('interacciones por medio_canal (RPC)', async () => {
    const { data, error } = await sb.rpc('get_interaction_counts', { p_tenant_id: TENANT_ID });
    if (error) throw error;
    return data;
  })();

  await t('ventas en rango últimos 30 días', async () => {
    const start = new Date(Date.now() - 30 * 86400000).toISOString();
    const end = new Date().toISOString();
    const { data, error } = await sb.from('ventas').select('nocodb_id, amount, fecha').eq('tenant_id', TENANT_ID).gte('fecha', start).lte('fecha', end).order('fecha', { ascending: false });
    if (error) throw error;
    return { count: data?.length, total: (data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0) };
  })();

  await t('intentos_compra COUNT', async () => {
    const { count, error } = await sb.from('intentos_compra').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID);
    if (error) throw error;
    return { count };
  })();

  await t('vendedoras', async () => {
    const { data, error } = await sb.from('vendedoras').select('nocodb_id, nombre, estado').eq('tenant_id', TENANT_ID);
    if (error) throw error;
    return data?.map((v: any) => `${v.nocodb_id}:${v.nombre}(${v.estado})`);
  })();

  await t('tenants', async () => {
    const { data, error } = await sb.from('tenants').select('id, slug, name');
    if (error) throw error;
    return data;
  })();
}

main().catch((e) => { console.error(e); process.exit(1); });
