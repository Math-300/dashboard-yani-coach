-- ============================================================================
-- Migración 04: refresh_materialized_views() detecta MVs no populadas
-- ----------------------------------------------------------------------------
-- Fix: REFRESH CONCURRENTLY requiere que la MV haya sido populada al menos una
-- vez. La versión original fallaba en el primer sync. Esta versión detecta el
-- flag ispopulated y usa el modo correcto.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT matviewname, ispopulated FROM pg_matviews WHERE schemaname = 'public' LOOP
    IF v.ispopulated THEN
      EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', v.matviewname);
    ELSE
      EXECUTE format('REFRESH MATERIALIZED VIEW public.%I', v.matviewname);
    END IF;
  END LOOP;
END;
$$;
