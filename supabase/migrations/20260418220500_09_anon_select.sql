-- ============================================================================
-- Migración 09: SELECT público para anon role (PoC Fase 2, single-tenant)
-- ----------------------------------------------------------------------------
-- Las policies originales (migración 02) exigían setear el GUC
-- app.current_tenant antes de cada query. PostgREST reusa conexiones del pool,
-- por lo que un GUC seteado en una request no persiste para la siguiente.
--
-- Para este PoC single-tenant, relajamos SELECT a USING (true). El cliente
-- siempre pasa .eq('tenant_id', VITE_SUPABASE_TENANT_ID) explícito.
--
-- MIGRACIÓN FUTURA (cuando haya Supabase Auth + multi-tenancy SaaS):
--   Reemplazar USING (true) por USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid)
-- ============================================================================

-- 1) Drop policies existentes que requieren GUC
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vendedoras','contactos','interacciones','ventas','intentos_compra','sync_runs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_own ON public.%I', t, t);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS tenants_select_own ON public.tenants;

-- 2) Nuevas policies: SELECT abierto a anon/authenticated
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','vendedoras','contactos','interacciones','ventas','intentos_compra','sync_runs'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I_select_anon ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      t, t
    );
  END LOOP;
END
$$;

-- 3) Grants para las materialized views (no tienen RLS, solo grants)
GRANT SELECT ON public.mv_funnel_counts          TO anon, authenticated;
GRANT SELECT ON public.mv_vendedora_performance  TO anon, authenticated;
GRANT SELECT ON public.mv_sales_trend_monthly    TO anon, authenticated;
