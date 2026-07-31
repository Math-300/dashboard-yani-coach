-- Migración 30 (2026-07-31): revocar TODO acceso de lectura de `anon` y
-- `authenticated` a las tres tablas con filas de personas — `contactos`,
-- `interacciones`, `intentos_compra`. Cierre del "espejo anon".
--
-- ⚠️ NO APLICAR hasta que el contenedor web nuevo esté DESPLEGADO Y VERIFICADO en
--    producción (ver plans/RUNBOOK_DEPLOY_Y_REVOKE_cierre_anon_2026-07-29.md,
--    Fase A). El front ya no lee estas tablas por la anon key: ahora pide las
--    filas a /api/metrics/* (Express, service_role, detrás de la cookie de
--    sesión yd_auth). Pero ese endpoint SOLO existe en la imagen web nueva. Si se
--    revoca antes de desplegarla, el tablero en prod (que aún lee por anon) se
--    queda sin datos. Regla: front desplegado primero, revoke después.
--
-- Por qué: la anon key va horneada en el bundle público del dashboard; cualquiera
-- que la extraiga podía hacer `from('contactos').select('*')` y leer las ~33k
-- filas de contactos (nombre, país, etc.), ~34k interacciones y los intentos de
-- compra, sin loguearse. Medido en vivo hoy (2026-07-31) simulando los roles:
--   has_table_privilege('anon',          'contactos',       'SELECT') = true
--   has_table_privilege('anon',          'interacciones',   'SELECT') = true
--   has_table_privilege('anon',          'intentos_compra', 'SELECT') = true
--   (idéntico para 'authenticated'; grant table-wide en las tres)
-- `service_role` conserva SELECT (svc_sel = true) — es el rol que usa el endpoint
-- /api/metrics/* y NO se toca acá; por eso el tablero sigue mostrando lo mismo.
--
-- Los números del tablero NO cambian: los agregados salen de funciones
-- SECURITY DEFINER que corren como owner y sobreviven a este revoke
-- (get_funnel_respondio migr 28, get_kpi_counts migr 29), y las filas crudas
-- salen del endpoint con service_role. Las matviews que anon sí sigue leyendo
-- (mv_funnel_counts, mv_vendedora_performance) son agregados sin filas-persona y
-- quedan intactas. `ventas` queda fuera de alcance (ya sin SELECT table-wide para
-- anon/authenticated desde la migr 25; sin PII).
--
-- Se revoca de anon Y authenticated (mismo criterio que la migr 26): el dashboard
-- no usa Supabase Auth, así que en la práctica el rol del navegador siempre es
-- anon, pero authenticated tenía el mismo grant table-wide colgando y es una
-- exposición latente si alguna vez se emite un JWT authenticated. service_role
-- queda afuera del revoke a propósito.

revoke select, references
  on public.contactos, public.interacciones, public.intentos_compra
  from anon, authenticated;

-- Defensa en profundidad contra la trampa de granularidad. Este proyecto ya fue
-- mordido por ella (migr 25/26 y la nota mv_expone_columnas_que_la_tabla_revoca):
-- en Postgres un `REVOKE SELECT ON tabla` quita el grant a nivel tabla pero NO
-- los grants a nivel columna que se hubieran otorgado por separado. Hoy las tres
-- tablas tienen grant table-wide (no hay grants por columna sueltos: medido), así
-- que el revoke de arriba ya cierra todo — pero se revoca columna por columna
-- igual, por si en el futuro alguien otorga una columna suelta. Revocar una
-- columna no otorgada es un NOTICE, no un error.
do $$
declare
  tbl text;
  col text;
begin
  foreach tbl in array array['contactos', 'interacciones', 'intentos_compra'] loop
    for col in
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = tbl
    loop
      execute format('revoke select (%I) on public.%I from anon, authenticated', col, tbl);
    end loop;
  end loop;
end $$;

-- Verificación de cierre (correr DESPUÉS de aplicar, ver runbook Fase B paso 2).
-- NO usar get_advisors: nunca listó estas 3 tablas porque están abiertas por RLS
-- `USING (true)`, no por RLS faltante. La prueba real es doble:
--   1) select has_table_privilege('anon','contactos','SELECT');        -- espera: false
--      (idem interacciones, intentos_compra; idem 'authenticated')
--   2) smoke con la anon key real contra las 3 tablas -> 42501 permission denied.
--      Tras esta migración, las 3 líneas contactos/interacciones/intentos_compra
--      de scripts/smoke_datasource.ts DEBEN pasar a rojo 42501: eso es la señal
--      de cierre, no un bug.
-- Y re-verificar el tablero en prod con sesión: idéntico al baseline
-- (plans/baseline_cierre_anon_2026-07-29.md), porque las filas ahora sólo llegan
-- por /api/metrics/* (service_role), inmune a este revoke.

-- Rollback (sólo emergencia, vuelve a exponer los datos):
--   grant select on public.contactos, public.interacciones, public.intentos_compra
--     to anon, authenticated;
