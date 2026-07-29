-- Migración 25 (2026-07-29): rescatar identificadores de negocio del backfill antes
-- de borrar el snapshot `_refactor_ventas_baseline`.
--
-- Contexto: las migraciones 23 y 24 dropearon `ventas.raw` para sacar del espejo 444
-- nombres de comprador y 30 `stripe_customer` legibles con la anon key. La revisión
-- final (comentario de la migración 24) encontró que ese mismo `raw`, además de datos
-- personales, era el ÚNICO lugar donde vivían identificadores de negocio de las 1.055
-- filas de backfill (systeme_csv_backfill / stripe_recovery_*) que nunca existieron en
-- NocoDB. Hoy esos identificadores solo sobreviven en `_refactor_ventas_baseline`, una
-- tabla-snapshot temporal que está por borrarse. Esta migración los copia a una columna
-- nueva antes de que eso pase.
--
-- Medido en vivo (2026-07-29), llave por grupo de origen (única fila por fila en los
-- tres casos):
--   - 982 filas origen='systeme_csv_backfill'                 → raw->>'invoice'
--   - 43  filas origen='stripe_recovery_junio'                → raw->>'Stripe Charge ID'
--   - 30  filas origen='stripe_recovery_julio_2026-07-13'     → raw->>'charge_id'
-- Las 884 filas restantes (sync NocoDB) no tienen ninguna de las tres claves: quedan
-- NULL a propósito, porque ya tienen su `ID de Transacción` en NocoDB.

-- 1) La columna. Nullable a propósito (ver arriba): solo las 1.055 filas de backfill
--    la necesitan.
alter table public.ventas add column if not exists referencia_externa text;

-- 2) Backfill desde el snapshot. El orden del COALESCE no importa para la cobertura
--    (las tres claves son mutuamente excluyentes por origen), pero respeta la
--    prioridad con la que se verificó la unicidad fila por fila.
update public.ventas v
set referencia_externa = coalesce(
      b.raw->>'Stripe Charge ID',
      b.raw->>'charge_id',
      b.raw->>'invoice')
from public._refactor_ventas_baseline b
where b.id = v.id
  and coalesce(b.raw->>'Stripe Charge ID', b.raw->>'charge_id', b.raw->>'invoice') is not null;

-- 3) Re-otorgar SELECT explícito por columna, SIN `referencia_externa`. Un Stripe
--    Charge ID legible por cualquiera con la anon key del navegador sería dar un paso
--    atrás justo en el refactor (migraciones 23/24) que vino a minimizar lo que el
--    espejo expone. El revoke + grant explícito (en vez de solo agregar una policy o
--    dejar el grant de tabla completa que ya existía) es la única forma de sacar una
--    columna del SELECT sin tocar las demás: Postgres no tiene "revoke solo esta
--    columna", así que hay que revocar el SELECT de tabla completa y volver a
--    otorgarlo columna por columna. La lista de abajo son las 16 columnas que hoy
--    componen el esquema completo de `ventas` (después de la 24, que dropeó `raw`;
--    sin contar la `referencia_externa` que esta misma migración agrega) — se
--    re-otorgan tal cual estaban, ninguna de más ni de menos.
revoke select on public.ventas from anon, authenticated;

grant select (id, tenant_id, nocodb_id, contacto_nocodb_id, contacto_id, vendedora_nocodb_id,
              vendedora_id, amount, producto, fecha, payment_status, sales_cycle_days,
              synced_at, es_duplicado, tipo_oferta, origen)
  on public.ventas to anon, authenticated;

comment on column public.ventas.referencia_externa is
  'Identificador de negocio de las filas de backfill (982 nº de factura Systeme, 43+30 Stripe Charge ID), rescatado de _refactor_ventas_baseline.raw antes de borrar ese snapshot. NULL en las 884 filas del sync NocoDB, que ya tienen su ID de Transacción ahí. NO tiene grant de SELECT a anon/authenticated: es un identificador de trazabilidad interno, no un dato que el dashboard necesite exponer al navegador.';

-- Límites conocidos de esta migración (documentado en revisión, 2026-07-29):
--
-- 1) NO es replayable. Depende de `public._refactor_ventas_baseline`, una tabla
--    temporal creada solo para este refactor y que se borra inmediatamente después de
--    aplicar esta migración. Un replay futuro de este archivo (`supabase db reset`,
--    reconstrucción del esquema desde cero, o cualquier escenario que reaplique las
--    migraciones en orden después de que el snapshot ya no exista) falla en el paso 2
--    con:
--      ERROR:  relation "public._refactor_ventas_baseline" does not exist
--    Y aunque el error no ocurriera (por ejemplo si alguien recreara una tabla vacía
--    con ese nombre para que el `update` no falle), tampoco habría de dónde sacar los
--    identificadores: el snapshot es la única copia que quedó de los `raw` de las
--    1.055 filas de backfill, y una vez borrado, esos valores no están en ningún otro
--    lugar del sistema — ni en NocoDB (nunca existieron ahí), ni en producción
--    (`ventas.raw` ya no existe desde la migración 24). Esta migración es un rescate
--    de una sola vez: corre bien la primera y única vez que se aplica, sobre la base
--    de producción real, mientras el snapshot todavía existe.
