-- ============================================================================
-- Fase 2 fix — get_funnel_respondio: hacer el filtro de fecha SARGABLE.
-- El patrón `(p_start IS NULL OR col >= p_start)` con p_start como PARÁMETRO
-- impide al planner usar idx_contactos_created → seq scan de 31k filas anchas
-- (cada una con un jsonb `raw`) → "canceling statement due to statement timeout"
-- al llamarse como anon (que sí tiene statement_timeout, a diferencia de postgres).
-- Solución: coalesce(p_start,'-infinity') / coalesce(p_end,'infinity') → rango
-- btree indexable incluso con parámetros. (Nota: excluye filas con
-- nocodb_created_at NULL, que de todos modos no pueden ubicarse en un período.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_funnel_respondio(
  p_tenant_id uuid,
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  leads_nuevos            bigint,
  primer_mensaje          bigint,
  respondieron            bigint,
  interesados             bigint,
  venta_cerrada           bigint,
  venta_perdida           bigint,
  tiempo_resp_mediana_min numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH leads AS (
    SELECT c.id, c.estado_simplificado
    FROM public.contactos c
    WHERE c.tenant_id = p_tenant_id
      AND c.nocodb_created_at >= coalesce(p_start, '-infinity'::timestamptz)
      AND c.nocodb_created_at <= coalesce(p_end,   'infinity'::timestamptz)
  ),
  conv AS (
    SELECT contacto_id,
           bool_or(respondio)                      AS respondio,
           bool_or(primer_outbound_at IS NOT NULL) AS tiene_outbound,
           min(tiempo_primera_respuesta_seg)       AS t
    FROM public.chatwoot_conversaciones
    WHERE tenant_id = p_tenant_id AND contacto_id IS NOT NULL
    GROUP BY contacto_id
  ),
  con_venta AS (
    SELECT DISTINCT contacto_id
    FROM public.ventas
    WHERE tenant_id = p_tenant_id AND contacto_id IS NOT NULL
  )
  SELECT
    count(*)                                                        AS leads_nuevos,
    count(*) FILTER (WHERE cv.tiene_outbound)                       AS primer_mensaje,
    count(*) FILTER (WHERE cv.respondio)                            AS respondieron,
    count(*) FILTER (WHERE l.estado_simplificado = 'Interesado')    AS interesados,
    count(*) FILTER (WHERE v.contacto_id IS NOT NULL)               AS venta_cerrada,
    count(*) FILTER (WHERE l.estado_simplificado = 'Venta Perdida') AS venta_perdida,
    round(
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY cv.t)
        FILTER (WHERE cv.t IS NOT NULL) / 60.0)::numeric, 1)        AS tiempo_resp_mediana_min
  FROM leads l
  LEFT JOIN conv cv      ON cv.contacto_id = l.id
  LEFT JOIN con_venta v  ON v.contacto_id  = l.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_funnel_respondio(uuid, timestamptz, timestamptz) TO anon;
