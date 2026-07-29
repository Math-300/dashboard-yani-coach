-- Migración 27 (2026-07-29): filtrar `es_duplicado` en el CTE `ventas_periodo` de
-- `get_funnel_respondio`.
--
-- Medido en vivo hoy (2026-07-29) contra producción: el embudo devuelve
-- `venta_cerrada = 1963` / `venta_cerrada_monto = 127361`. La realidad neta —la misma
-- que ya muestra `mv_sales_trend_monthly`, que sí filtra `es_duplicado`— es
-- `venta_cerrada = 1539` / `venta_cerrada_monto = 110014`. La diferencia son 424 filas
-- del backfill CSV de Systeme que se solapan con el webhook entre 2026-02-16 y
-- 2026-06-09 (ver `.brain`: la regla del proyecto es explícita, no sumar la tabla
-- cruda). Dos partes del mismo dashboard mostrando números distintos para el mismo
-- período — el embudo inflaba los ingresos cerrados en 17.347.
--
-- Causa raíz: `get_funnel_respondio` es `SECURITY DEFINER` (necesario para leer
-- `contactos`/`chatwoot_conversaciones` bajo RLS con una sola llamada). Eso significa
-- que corre con los privilegios de quien definió la función, no con los del rol que la
-- invoca — y la policy `ventas_select_anon` (`USING (es_duplicado = false)`) es RLS de
-- fila para el rol `anon`, no una regla que el definer herede. El CTE `ventas_periodo`
-- hacía `SELECT ... FROM public.ventas WHERE tenant_id = ... AND fecha BETWEEN ...` sin
-- tocar `es_duplicado`, así que el definer veía —y contaba— las filas duplicadas que la
-- policy existe justamente para ocultarle a `anon`. La lección general, ya que se repite
-- cada vez que se toca `ventas`: **toda función `SECURITY DEFINER` que lea `ventas`
-- tiene que filtrar `es_duplicado` a mano en su propia query**, porque la policy no la
-- protege — solo protege lecturas directas hechas por el rol al que la policy aplica.
--
-- El fix es una sola línea: agregar `AND es_duplicado = false` al WHERE de
-- `ventas_periodo`. El resto de la función es copia textual de la migración 22
-- (20260622120000_22_funnel_agendo_esperando_reserva.sql), que es la versión vigente en
-- producción — misma firma, mismos CTEs `leads`/`conv`/`base`/`perdidas_periodo`, mismo
-- SELECT final, mismos grants. CREATE OR REPLACE, no rompe la firma existente.

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
      count(*) FILTER (WHERE l.estado_actual IN ('Llamada Agendada', 'Esperando Reserva')) AS agendo,
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
      AND es_duplicado = false
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
