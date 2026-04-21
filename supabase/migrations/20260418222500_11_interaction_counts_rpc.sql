-- ============================================================================
-- Migración 11: RPC get_interaction_counts (aggregation server-side)
-- ----------------------------------------------------------------------------
-- PostgREST tiene un row limit (1000 default) que no permite al cliente anon
-- agregar 16k+ interacciones en JS. Hacemos la agregación por medio_canal
-- server-side y devolvemos un jsonb chico.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_interaction_counts(
  p_tenant_id uuid,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(canal, cnt), '{}'::jsonb)
  FROM (
    SELECT COALESCE(medio_canal, 'Otro') AS canal, COUNT(*) AS cnt
    FROM public.interacciones
    WHERE tenant_id = p_tenant_id
      AND (p_start IS NULL OR fecha >= p_start)
      AND (p_end IS NULL OR fecha <= p_end)
    GROUP BY COALESCE(medio_canal, 'Otro')
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.get_interaction_counts(uuid, timestamptz, timestamptz)
  TO anon, authenticated;
