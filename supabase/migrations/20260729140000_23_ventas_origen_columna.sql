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
