-- ============================================================================
-- Fase 2 — Embudo correcto: ventas desde la tabla `ventas` (no estado), mediana.
-- Reemplaza la lógica fallida de v_funnel_respondio (que contaba venta por
-- estado_simplificado='Venta Cerrada' = 14, cuando ventas reales son ~250).
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
      AND (p_start IS NULL OR c.nocodb_created_at >= p_start)
      AND (p_end   IS NULL OR c.nocodb_created_at <= p_end)
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

-- Responsividad por vendedora: cambiar media -> mediana (los outliers la inflaban).
-- DROP necesario: la vista vieja tenía la columna resp_prom_min; CREATE OR REPLACE no renombra columnas.
DROP VIEW IF EXISTS public.v_responsividad_vendedora;
CREATE VIEW public.v_responsividad_vendedora AS
SELECT
  cc.tenant_id,
  cc.vendedora_id,
  v.nombre AS vendedora_nombre,
  count(*) FILTER (WHERE cc.respondio) AS chats_respondidos,
  round(
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY cc.tiempo_primera_respuesta_seg)
      FILTER (WHERE cc.tiempo_primera_respuesta_seg IS NOT NULL) / 60.0)::numeric, 1
  ) AS resp_mediana_min
FROM public.chatwoot_conversaciones cc
LEFT JOIN public.vendedoras v ON v.id = cc.vendedora_id
WHERE cc.vendedora_id IS NOT NULL
GROUP BY cc.tenant_id, cc.vendedora_id, v.nombre;

GRANT SELECT ON public.v_responsividad_vendedora TO anon;
