-- ============================================================================
-- Migración 05: fix GROUP BY en mv_funnel_counts
-- ----------------------------------------------------------------------------
-- Bug: el SELECT usaba COALESCE(estado_simplificado, 'Otro') pero el GROUP BY
-- agrupaba por la columna cruda, causando filas duplicadas en la key del unique
-- index cuando había tanto NULLs (→ 'Otro' por COALESCE) como 'Otro' reales.
-- Fix: GROUP BY usa la misma expresión COALESCE.
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.mv_funnel_counts CASCADE;

CREATE MATERIALIZED VIEW public.mv_funnel_counts AS
SELECT
  tenant_id,
  COALESCE(estado_simplificado, 'Otro') AS estado_simplificado,
  COUNT(*)::bigint AS total,
  COALESCE(SUM(estimated_value), 0)::numeric(14,2) AS valor_estimado_total,
  MAX(synced_at) AS last_synced_at
FROM public.contactos
GROUP BY tenant_id, COALESCE(estado_simplificado, 'Otro');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_funnel_counts_unique
  ON public.mv_funnel_counts (tenant_id, estado_simplificado);
