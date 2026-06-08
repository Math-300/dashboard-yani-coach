-- Agrega la etapa "Agendó / entró en llamada" al embudo (get_funnel_respondio).
-- agendo = contactos del cohorte cuyo estado_actual (vivo) = 'Llamada Agendada'.
-- Es un subconjunto natural de "Interesados" (que ya incluye Llamada Agendada +
-- Seguimiento Potencial venta), por lo que el embudo se mantiene monótono.
-- Cuenta por CONTACTO usando contactos.estado_actual (NO el Estado Gestión de la
-- oportunidad, que puede quedar rezagado — p.ej. caso Betsy 2026-06-08).
-- Señal optimista: refleja "se marcó como agendada", no una reserva confirmada por
-- calendario externo (la integración de calendario es trabajo futuro).
--
-- Cambia el RETURNS TABLE => requiere DROP + CREATE (CREATE OR REPLACE no puede
-- cambiar el tipo de retorno). Se re-otorgan los GRANT que tenía la función.

DROP FUNCTION IF EXISTS public.get_funnel_respondio(uuid, timestamptz, timestamptz);

CREATE FUNCTION public.get_funnel_respondio(
  p_tenant_id uuid,
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  leads_nuevos            bigint,
  primer_mensaje          bigint,
  respondieron            bigint,
  interesados             bigint,
  agendo                  bigint,
  venta_cerrada           bigint,
  venta_cerrada_monto     numeric,
  venta_perdida           bigint,
  tiempo_resp_mediana_min numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH leads AS (
    SELECT c.id, c.estado_simplificado, c.estado_actual
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
  base AS (
    SELECT
      count(*)                                                          AS leads_nuevos,
      count(*) FILTER (WHERE cv.tiene_outbound)                         AS primer_mensaje,
      count(*) FILTER (WHERE cv.respondio)                              AS respondieron,
      count(*) FILTER (WHERE l.estado_simplificado = 'Interesado')      AS interesados,
      count(*) FILTER (WHERE l.estado_actual = 'Llamada Agendada')      AS agendo,
      round(
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY cv.t)
          FILTER (WHERE cv.t IS NOT NULL) / 60.0)::numeric, 1)          AS tiempo_resp_mediana_min
    FROM leads l
    LEFT JOIN conv cv ON cv.contacto_id = l.id
  ),
  ventas_periodo AS (
    SELECT count(*) AS n, coalesce(round(sum(amount)), 0)::numeric AS monto
    FROM public.ventas
    WHERE tenant_id = p_tenant_id
      AND fecha >= coalesce(p_start, '-infinity'::timestamptz)
      AND fecha <= coalesce(p_end,   'infinity'::timestamptz)
  ),
  perdidas_periodo AS (
    SELECT count(*) AS n
    FROM public.contactos
    WHERE tenant_id = p_tenant_id
      AND estado_simplificado = 'Venta Perdida'
      AND nocodb_updated_at >= coalesce(p_start, '-infinity'::timestamptz)
      AND nocodb_updated_at <= coalesce(p_end,   'infinity'::timestamptz)
  )
  SELECT
    b.leads_nuevos,
    b.primer_mensaje,
    b.respondieron,
    b.interesados,
    b.agendo,
    vp.n            AS venta_cerrada,
    vp.monto        AS venta_cerrada_monto,
    pp.n            AS venta_perdida,
    b.tiempo_resp_mediana_min
  FROM base b, ventas_periodo vp, perdidas_periodo pp;
$$;

GRANT EXECUTE ON FUNCTION public.get_funnel_respondio(uuid, timestamptz, timestamptz)
  TO anon, authenticated, service_role;
