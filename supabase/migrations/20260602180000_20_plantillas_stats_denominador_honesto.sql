-- Fix de denominadores: el `status` de Chatwoot para salientes WhatsApp es poco
-- confiable (muchos quedan en 'sent' aunque se entregaron y el lead respondió),
-- así que `entregados` (basado en status) subcontaba y daba tasa_respuesta > 100%.
-- Redefinimos sobre lo CONFIABLE:
--   base = enviados - fallidos   (lo que realmente salió; 'failed' sí es confiable)
--   tasa_fallo     = fallidos / enviados
--   tasa_apertura  = leidos / base            (piso; read receipts pueden estar off)
--   tasa_respuesta = (respondido y no fallido) / base   (siempre <= 100%)
-- Se elimina la columna `entregados`/`tasa_entrega` (engañosa).
drop function if exists public.get_plantillas_stats(uuid, timestamptz, timestamptz);

create function public.get_plantillas_stats(
  p_tenant_id uuid,
  p_start timestamptz default null,
  p_end   timestamptz default null
)
returns table(
  template_name  text,
  shortcode      text,
  descripcion    text,
  enviados       bigint,
  fallidos       bigint,
  leidos         bigint,
  respondidos    bigint,
  tasa_fallo     numeric,
  tasa_apertura  numeric,
  tasa_respuesta numeric
)
language sql
stable
security definer
set statement_timeout to '120s'
set search_path to 'public', 'pg_temp'
as $function$
  select
    e.template_name,
    c.shortcode,
    c.descripcion,
    count(*)                                              as enviados,
    count(*) filter (where e.fallido)                    as fallidos,
    count(*) filter (where e.leido)                      as leidos,
    count(*) filter (where e.respondido and not e.fallido) as respondidos,
    round(count(*) filter (where e.fallido)::numeric / nullif(count(*), 0), 3)                                        as tasa_fallo,
    round(count(*) filter (where e.leido)::numeric      / nullif(count(*) filter (where not e.fallido), 0), 3)        as tasa_apertura,
    round(count(*) filter (where e.respondido and not e.fallido)::numeric / nullif(count(*) filter (where not e.fallido), 0), 3) as tasa_respuesta
  from public.plantillas_envios e
  left join public.plantillas_catalogo c
    on c.tenant_id = e.tenant_id and c.template_name = e.template_name
  where e.tenant_id = p_tenant_id
    and e.es_masivo = false
    and e.enviado_at >= coalesce(p_start, '-infinity'::timestamptz)
    and e.enviado_at <= coalesce(p_end,   'infinity'::timestamptz)
  group by e.template_name, c.shortcode, c.descripcion
  order by count(*) desc;
$function$;

revoke execute on function public.get_plantillas_stats(uuid, timestamptz, timestamptz) from public;
grant  execute on function public.get_plantillas_stats(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
