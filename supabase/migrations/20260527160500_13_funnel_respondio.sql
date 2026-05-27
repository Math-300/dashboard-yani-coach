-- ============================================================================
-- Fase 1 — Vista de embudo con la etapa "Respondieron" + responsividad del equipo
-- Nota: interesados/venta_* dependen de estado_simplificado (mapping a corregir en Plan 2).
-- "respondieron" sale de Chatwoot y es correcto.
-- ============================================================================

CREATE OR REPLACE VIEW public.v_funnel_respondio AS
WITH conv_por_contacto AS (
  SELECT
    tenant_id,
    contacto_id,
    bool_or(respondio) AS respondio,
    min(tiempo_primera_respuesta_seg) AS tiempo_resp_seg
  FROM public.chatwoot_conversaciones
  WHERE contacto_id IS NOT NULL
  GROUP BY tenant_id, contacto_id
)
SELECT
  c.tenant_id,
  count(*) AS leads_nuevos,
  count(*) FILTER (WHERE cpc.respondio) AS respondieron,
  count(*) FILTER (WHERE c.estado_simplificado = 'Interesado') AS interesados,
  count(*) FILTER (WHERE c.estado_simplificado = 'Venta Cerrada') AS venta_cerrada,
  count(*) FILTER (WHERE c.estado_simplificado = 'Venta Perdida') AS venta_perdida,
  round(avg(cpc.tiempo_resp_seg) FILTER (WHERE cpc.tiempo_resp_seg IS NOT NULL) / 60.0, 1)
    AS tiempo_resp_prom_min
FROM public.contactos c
LEFT JOIN conv_por_contacto cpc
  ON cpc.tenant_id = c.tenant_id AND cpc.contacto_id = c.id
GROUP BY c.tenant_id;

GRANT SELECT ON public.v_funnel_respondio TO anon;

CREATE OR REPLACE VIEW public.v_responsividad_vendedora AS
SELECT
  cc.tenant_id,
  cc.vendedora_id,
  v.nombre AS vendedora_nombre,
  count(*) FILTER (WHERE cc.respondio) AS chats_respondidos,
  round(avg(cc.tiempo_primera_respuesta_seg)
    FILTER (WHERE cc.tiempo_primera_respuesta_seg IS NOT NULL) / 60.0, 1) AS resp_prom_min
FROM public.chatwoot_conversaciones cc
LEFT JOIN public.vendedoras v ON v.id = cc.vendedora_id
WHERE cc.vendedora_id IS NOT NULL
GROUP BY cc.tenant_id, cc.vendedora_id, v.nombre;

GRANT SELECT ON public.v_responsividad_vendedora TO anon;
