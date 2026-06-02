-- Endurecimiento de permisos (2026-06-02). Auditoría con get_advisors reveló:
--  - resolve_foreign_keys (SECURITY DEFINER) era ejecutable por anon → un anónimo
--    podía disparar escrituras vía /rest/v1/rpc. CRÍTICO.
--  - anon tenía grants de INSERT/UPDATE/DELETE/TRUNCATE en las tablas (RLS lo bloqueaba,
--    pero era un grant latente).
--  - vistas v_responsividad_vendedora / v_funnel_respondio eran SECURITY DEFINER (bypass RLS).
-- El dashboard solo necesita SELECT (anon) + EXECUTE de las funciones de LECTURA fechadas
-- (get_funnel_respondio, get_responsividad). El SYNC corre con service_role.

-- 1) Quitar privilegios de ESCRITURA de las tablas a anon/authenticated (SELECT se conserva).
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

-- 2) Funciones de SYNC/mantenimiento + interaction_counts (sin uso en el front): solo service_role.
revoke execute on function public.resolve_foreign_keys(uuid)        from public, anon, authenticated;
revoke execute on function public.resolve_chatwoot_fks(uuid)        from public, anon, authenticated;
revoke execute on function public.refresh_materialized_views()      from public, anon, authenticated;
revoke execute on function public.get_interaction_counts(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant  execute on function public.resolve_foreign_keys(uuid)        to service_role;
grant  execute on function public.resolve_chatwoot_fks(uuid)        to service_role;
grant  execute on function public.refresh_materialized_views()      to service_role;
grant  execute on function public.get_interaction_counts(uuid, timestamptz, timestamptz) to service_role;

-- 3) Vistas SECURITY DEFINER que el dashboard ya no usa: que respeten el RLS del que consulta.
alter view public.v_responsividad_vendedora set (security_invoker = on);
alter view public.v_funnel_respondio        set (security_invoker = on);

-- 4) search_path fijo (evita hijack en SECURITY DEFINER; buena práctica en todas).
alter function public.resolve_foreign_keys(uuid)        set search_path = public, pg_temp;
alter function public.resolve_chatwoot_fks(uuid)        set search_path = public, pg_temp;
alter function public.refresh_materialized_views()      set search_path = public, pg_temp;
alter function public.get_interaction_counts(uuid, timestamptz, timestamptz) set search_path = public, pg_temp;
alter function public.get_responsividad(uuid, timestamptz, timestamptz)       set search_path = public, pg_temp;
alter function public.get_funnel_respondio(uuid, timestamptz, timestamptz)    set search_path = public, pg_temp;
