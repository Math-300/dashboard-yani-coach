-- ============================================================================
-- Migración 07: normalización de estado de intentos de compra
-- ----------------------------------------------------------------------------
-- NocoDB guarda estados con prefijos emoji y variantes numeradas
--   ("🏆 Pago recuperado", "1 pago fallido", "❌ CURSO CANCELADO", etc).
-- Esta función los colapsa a 4 buckets para el Dashboard.
-- La MV mv_vendedora_performance se reconstruye para usar la función.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.map_intento_status(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN lower(raw) LIKE '%recuperado%' THEN 'Exitoso'
    WHEN lower(raw) LIKE '%fallido%' THEN 'Fallido'
    WHEN lower(raw) LIKE '%cancelad%' THEN 'Abandonado'
    WHEN lower(raw) LIKE '%abandonad%' THEN 'Abandonado'
    WHEN lower(raw) LIKE '%exitoso%' THEN 'Exitoso'
    ELSE 'Otro'
  END;
$$;

-- Reconstruir mv_vendedora_performance con el status mapeado
DROP MATERIALIZED VIEW IF EXISTS public.mv_vendedora_performance CASCADE;

CREATE MATERIALIZED VIEW public.mv_vendedora_performance AS
WITH contactos_agg AS (
  SELECT
    tenant_id, vendedora_id,
    COUNT(*) FILTER (WHERE vendedora_id IS NOT NULL) AS leads_total,
    COUNT(*) FILTER (WHERE estado_simplificado = 'Nuevo') AS leads_nuevos,
    COUNT(*) FILTER (WHERE estado_simplificado = 'Contactado') AS leads_contactados,
    COUNT(*) FILTER (WHERE estado_simplificado = 'Interesado') AS leads_interesados,
    COUNT(*) FILTER (WHERE estado_simplificado = 'Venta Cerrada') AS leads_cerrados,
    COUNT(*) FILTER (WHERE estado_simplificado = 'Venta Perdida') AS leads_perdidos
  FROM public.contactos
  GROUP BY tenant_id, vendedora_id
),
ventas_agg AS (
  SELECT
    tenant_id, vendedora_id,
    COUNT(*) AS sales_count,
    COALESCE(SUM(amount), 0)::numeric(14,2) AS total_amount,
    AVG(sales_cycle_days) FILTER (WHERE sales_cycle_days IS NOT NULL)::numeric(10,2) AS avg_cycle_days
  FROM public.ventas
  GROUP BY tenant_id, vendedora_id
),
interac_agg AS (
  SELECT
    tenant_id, vendedora_id,
    COUNT(*) AS interactions_count,
    MAX(fecha) AS last_interaction_at
  FROM public.interacciones
  GROUP BY tenant_id, vendedora_id
),
intentos_agg AS (
  SELECT
    tenant_id, vendedora_id,
    COUNT(*) AS attempts_total,
    COUNT(*) FILTER (WHERE public.map_intento_status(status) = 'Exitoso') AS attempts_successful,
    COUNT(*) FILTER (WHERE public.map_intento_status(status) = 'Fallido') AS attempts_failed,
    COUNT(*) FILTER (WHERE public.map_intento_status(status) = 'Abandonado') AS attempts_abandoned
  FROM public.intentos_compra
  GROUP BY tenant_id, vendedora_id
)
SELECT
  v.tenant_id,
  v.id AS vendedora_id,
  v.nocodb_id AS vendedora_nocodb_id,
  v.nombre,
  v.email,
  v.estado,
  COALESCE(c.leads_total, 0) AS leads_total,
  COALESCE(c.leads_nuevos, 0) AS leads_nuevos,
  COALESCE(c.leads_contactados, 0) AS leads_contactados,
  COALESCE(c.leads_interesados, 0) AS leads_interesados,
  COALESCE(c.leads_cerrados, 0) AS leads_cerrados,
  COALESCE(c.leads_perdidos, 0) AS leads_perdidos,
  COALESCE(s.sales_count, 0) AS sales_count,
  COALESCE(s.total_amount, 0) AS total_amount,
  s.avg_cycle_days,
  COALESCE(i.interactions_count, 0) AS interactions_count,
  i.last_interaction_at,
  COALESCE(a.attempts_total, 0) AS attempts_total,
  COALESCE(a.attempts_successful, 0) AS attempts_successful,
  COALESCE(a.attempts_failed, 0) AS attempts_failed,
  COALESCE(a.attempts_abandoned, 0) AS attempts_abandoned,
  CASE
    WHEN COALESCE(c.leads_total, 0) = 0 THEN NULL
    ELSE ROUND(COALESCE(c.leads_cerrados, 0)::numeric * 100 / c.leads_total, 2)
  END AS conversion_rate_pct,
  now() AS computed_at
FROM public.vendedoras v
LEFT JOIN contactos_agg c  ON c.tenant_id = v.tenant_id AND c.vendedora_id = v.id
LEFT JOIN ventas_agg    s  ON s.tenant_id = v.tenant_id AND s.vendedora_id = v.id
LEFT JOIN interac_agg   i  ON i.tenant_id = v.tenant_id AND i.vendedora_id = v.id
LEFT JOIN intentos_agg  a  ON a.tenant_id = v.tenant_id AND a.vendedora_id = v.id
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vendedora_perf_unique
  ON public.mv_vendedora_performance (tenant_id, vendedora_id);
