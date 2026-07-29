-- Migración 26 (2026-07-29): sacar `email` del SELECT de anon/authenticated en
-- `mv_vendedora_performance`, y limpiar los grants de escritura latentes de las
-- dos matviews que consume el dashboard.
--
-- Por qué: `vendedoras` se revocó a `anon` el 28-jul justamente porque exponía
-- contraseña y email de cada asesora. Pero `mv_vendedora_performance` hace
-- `select v.email` en su propia definición (migración 07) y materializa ese
-- valor en un objeto aparte, con sus propios grants — revocar la tabla de origen
-- no toca a quien ya leyó de ella. Medido en vivo hoy simulando el rol anon:
-- `select count(email) from mv_vendedora_performance` sigue devolviendo 3. La
-- lección general: revocar una tabla no cubre las matviews que la leen; son
-- objetos independientes una vez creados, no una vista sobre la tabla.
--
-- Y por eso mismo la migración 17 (`revoke insert, update, delete, truncate on
-- all tables in schema public from anon, authenticated`) nunca tocó estas dos
-- matviews: en Postgres `ALL TABLES IN SCHEMA` no incluye vistas materializadas
-- (son `relkind = 'm'`, no `'r'`). `relacl` real hoy:
--   mv_vendedora_performance  ->  anon=arwdDxtm/postgres, authenticated=arwdDxtm/postgres
--   mv_funnel_counts          ->  anon=rxtm/postgres,     authenticated=rxtm/postgres
-- `arwdDxtm` trae INSERT/UPDATE/DELETE/TRUNCATE colgando desde que se crearon
-- (migración 03) sin que la 17 pudiera limpiarlos. Postgres no deja escribir de
-- todos modos sobre una matview (`ERROR: cannot change materialized view`), así
-- que no eran explotables — pero son exactamente el tipo de grant latente que
-- esa migración vino a barrer, y quedó afuera por la trampa del scope. Se
-- corrige acá mismo, ya que se está tocando el objeto.
--
-- Sin RLS de por medio (las matviews no la soportan) la única forma de sacar
-- una columna del SELECT es la misma que la migración 25 usó en `ventas`:
-- revocar el SELECT de tabla completa y volver a otorgarlo columna por columna,
-- porque Postgres no tiene "revoke solo esta columna".
--
-- `mv_vendedora_performance` tiene 23 columnas (migración 07). La lista de abajo
-- son 22: todas menos `email`. El front (services/dataSource.ts:84) solo le pide
-- a esta matview `vendedora_nocodb_id, nombre, estado, sales_count, total_amount,
-- leads_total, interactions_count` (+ `tenant_id` para el `.eq()`) — ninguna es
-- `email`, así que este fix no rompe nada del repo. Se otorgan las 22 igual, no
-- solo las 8 que el front usa hoy, para no romper otros consumidores de esta
-- misma matview que no vivan en este repo; si más adelante se quiere acotar más
-- fino, se ajusta ahí.

revoke all on public.mv_vendedora_performance from anon, authenticated;

grant select (tenant_id, vendedora_id, vendedora_nocodb_id, nombre, estado,
              leads_total, leads_nuevos, leads_contactados, leads_interesados,
              leads_cerrados, leads_perdidos, sales_count, total_amount,
              avg_cycle_days, interactions_count, last_interaction_at,
              attempts_total, attempts_successful, attempts_failed,
              attempts_abandoned, conversion_rate_pct, computed_at)
  on public.mv_vendedora_performance to anon, authenticated;

-- `mv_funnel_counts` no tiene ninguna columna sensible (tenant_id,
-- estado_simplificado, total, valor_estimado_total, last_synced_at): no hace
-- falta el revoke+grant por columna, solo sacarle los mismos grants de
-- escritura latentes que a la de arriba.
revoke all on public.mv_funnel_counts from anon, authenticated;

grant select on public.mv_funnel_counts to anon, authenticated;

-- `mv_sales_trend_monthly` NO se toca acá: su `relacl` ya solo trae postgres y
-- service_role (sin anon/authenticated), y el front no la consume.

-- Límites conocidos de esta migración (documentado en revisión, 2026-07-29):
--
-- 1) Efecto permanente en cualquier `select('*')`. A partir de esta migración,
--    cualquier consumidor —de este repo o de otro— que haga
--    `supabase.from('mv_vendedora_performance').select('*')` va a recibir 403
--    (column privilege), no la fila con `email` en null: Postgres corta el
--    SELECT entero si pide una columna sin grant. Ya pasó una vez con `ventas`
--    en la migración 25 y es la misma mecánica acá: el grant por columna no es
--    un filtro transparente, rompe cualquier `select('*')` existente o futuro.
--
-- 2) Toda columna nueva de la matview nace invisible para anon/authenticated.
--    Si una migración futura le agrega una columna a
--    `mv_vendedora_performance` (o la reconstruye con `CREATE MATERIALIZED
--    VIEW` en vez de `ALTER`), esa columna no hereda el grant por columna de
--    acá — hay que agregarla a mano a la lista del `grant select (...)`, igual
--    que con `ventas` desde la 25. No hay grant "columna por defecto" en
--    Postgres.
