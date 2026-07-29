-- Migración 23 (2026-07-29): promover `origen` a columna real en `ventas`.
--
-- Por qué: `ventas` es la única tabla del espejo que todavía guarda `raw`, y no por
-- comodidad — la columna GENERADA `es_duplicado` se calcula desde `raw->>'origen'`.
-- De `es_duplicado` cuelgan la policy `ventas_select_anon` y dos matviews
-- (mv_sales_trend_monthly, mv_vendedora_performance). Mientras la expresión mire a
-- `raw`, `raw` no se puede dropear.
--
-- Medido antes de escribir esto (2026-07-29): `raw` es legible por `anon` y deja a la
-- vista 444 nombres de comprador y 30 `stripe_customer` en las 1.515 filas no duplicadas.
--
-- PG 17 permite `ALTER COLUMN ... SET EXPRESSION`, así que NO hace falta dropear la
-- policy ni las matviews: dependen de la COLUMNA, no de su expresión. La sentencia
-- reescribe la tabla (1.939 filas, instantáneo).

-- 1) La columna. Nullable a propósito: las 884 filas que vienen del sync NocoDB no
--    tienen origen, y `COALESCE(origen,'')` en la expresión conserva esa semántica.
alter table public.ventas add column if not exists origen text;

-- 2) Backfill desde `raw`. Solo las 1.055 filas que traen la clave.
update public.ventas set origen = raw->>'origen' where raw ? 'origen';

-- 3) Reapuntar la expresión. Misma lógica, mismos cortes, misma semántica de NULL.
alter table public.ventas
  alter column es_duplicado set expression as (
    case
      when coalesce(origen, '') <> 'systeme_csv_backfill'
           and fecha < '2026-06-01 05:00:00+00'::timestamptz then true
      when origen = 'systeme_csv_backfill'
           and fecha >= '2026-06-09 05:00:00+00'::timestamptz then true
      else false
    end
  );

create index if not exists ventas_origen_idx on public.ventas (origen);

comment on column public.ventas.origen is
  'Procedencia de la fila: NULL = sync NocoDB; systeme_csv_backfill / stripe_recovery_* = cargas puntuales. Alimenta la columna generada es_duplicado. Antes vivía en raw->>''origen''.';

-- Límites conocidos de esta migración (documentado en revisión, 2026-07-29):
--
-- 1) NO es reproducible desde cero. Las columnas `es_duplicado` (GENERATED) y
--    `tipo_oferta` de `public.ventas` no están definidas en NINGUNA migración de este
--    repo — se crearon a mano directamente en producción, antes de que existiera este
--    historial de migraciones. Si alguien corre `supabase db reset` o levanta un
--    preview branch desde cero, esta migración (23) va a fallar en el paso 3
--    (`alter column es_duplicado set expression as (...)`) con el error:
--      ERROR:  column "es_duplicado" of relation "ventas" does not exist
--    porque en una base fresca `ventas` nunca llega a tener esa columna. Para
--    reproducir el esquema completo desde cero hoy hace falta, además de este
--    historial de migraciones, un dump manual del esquema real de producción
--    (`es_duplicado`, `tipo_oferta` y cualquier otra columna creada fuera de este
--    directorio). Ese dump no existe todavía — queda como deuda a resolver antes de
--    confiar en `db reset` / branches nuevos para este proyecto.
--
-- 2) DEJA de ser re-ejecutable (replay) una vez que una migración posterior
--    (la 24, que dropea `raw`) se aplique. Hoy este archivo es idempotente porque
--    usa `add column if not exists` y `create index if not exists`, pero el paso 2
--    (`update public.ventas set origen = raw->>'origen' where raw ? 'origen';`) asume
--    que la columna `raw` todavía existe. Después de que `raw` se dropee, replayear
--    esta migración 23 en esa misma base (por ejemplo al reconstruir el historial
--    completo de migraciones desde cero en una base que ya pasó por la 24, o en
--    cualquier escenario que aplique las migraciones en un orden no lineal) falla en
--    ese `update` con:
--      ERROR:  column "raw" does not exist
--    Quien reconstruya el esquema completo desde el archivo de migraciones en orden
--    (23 antes de 24) no lo sufre; el riesgo es específico a reproducir SOLO esta
--    migración de forma aislada, o a un replay parcial que se salte la 24.
