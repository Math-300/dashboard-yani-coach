-- get_responsividad: responsividad por vendedora, FECHADA por cohorte de leads
-- (mismo criterio que get_funnel_respondio: contactos.nocodb_created_at en [p_start,p_end]).
-- Antes el dashboard usaba la vista global v_responsividad_vendedora, que NO respetaba el
-- filtro de fecha → el bloque "El equipo responde bien" quedaba congelado al cambiar el rango.
-- Sin fechas (null,null) → global. statement_timeout propio por recompute sobre miles de convs.
create or replace function public.get_responsividad(
  p_tenant_id uuid,
  p_start timestamptz default null,
  p_end   timestamptz default null
)
returns table (
  vendedora_id text,
  vendedora_nombre text,
  chats_respondidos bigint,
  resp_mediana_min numeric
)
language sql
stable
set statement_timeout = '120s'
as $$
  SELECT
    cc.vendedora_id::text AS vendedora_id,
    v.nombre              AS vendedora_nombre,
    count(*) FILTER (WHERE cc.respondio) AS chats_respondidos,
    round(
      (percentile_cont(0.5::double precision) WITHIN GROUP (
         ORDER BY (cc.tiempo_primera_respuesta_seg::double precision)
       ) FILTER (WHERE cc.tiempo_primera_respuesta_seg IS NOT NULL) / 60.0::double precision
      )::numeric, 1) AS resp_mediana_min
  FROM public.chatwoot_conversaciones cc
  LEFT JOIN public.vendedoras v ON v.id = cc.vendedora_id
  WHERE cc.tenant_id = p_tenant_id
    AND cc.vendedora_id IS NOT NULL
    AND cc.contacto_id IN (
      SELECT c.id FROM public.contactos c
      WHERE c.tenant_id = p_tenant_id
        AND c.nocodb_created_at >= coalesce(p_start, '-infinity'::timestamptz)
        AND c.nocodb_created_at <= coalesce(p_end,   'infinity'::timestamptz)
    )
  GROUP BY cc.vendedora_id, v.nombre
  ORDER BY count(*) FILTER (WHERE cc.respondio) DESC;
$$;
