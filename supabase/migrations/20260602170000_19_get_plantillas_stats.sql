-- Agregador fechado de templates del día a día (es_masivo = false).
-- SECURITY DEFINER: el dashboard (anon) NO lee plantillas_envios directo;
-- solo recibe estos agregados (sin contacto_nocodb_id).
create or replace function public.get_plantillas_stats(
  p_tenant_id uuid,
  p_start timestamptz default null,
  p_end   timestamptz default null
)
returns table(
  template_name  text,
  shortcode      text,
  descripcion    text,
  enviados       bigint,
  entregados     bigint,
  leidos         bigint,
  fallidos       bigint,
  respondidos    bigint,
  tasa_entrega   numeric,
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
    count(*)                                  as enviados,
    count(*) filter (where e.entregado)       as entregados,
    count(*) filter (where e.leido)           as leidos,
    count(*) filter (where e.fallido)         as fallidos,
    count(*) filter (where e.respondido)      as respondidos,
    round(count(*) filter (where e.entregado)::numeric  / nullif(count(*), 0), 3)                          as tasa_entrega,
    round(count(*) filter (where e.leido)::numeric      / nullif(count(*) filter (where e.entregado), 0), 3) as tasa_apertura,
    round(count(*) filter (where e.respondido)::numeric / nullif(count(*) filter (where e.entregado), 0), 3) as tasa_respuesta
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
