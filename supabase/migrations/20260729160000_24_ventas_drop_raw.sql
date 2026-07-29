-- Migración 24 (2026-07-29): dropear `ventas.raw`.
--
-- Requisitos cumplidos antes de esta migración:
--   - Migración 23: `es_duplicado` se calcula desde la columna `origen`, no desde `raw`.
--   - syncVentas.ts desplegado en el VPS sin escribir `raw` (verificado con una corrida real).
--   - pg_depend: cero objetos dependen de ventas.raw.
--
-- Qué se va con la columna: los 444 nombres de comprador y los 30 `stripe_customer`
-- que `anon` podía leer con la key que viaja en el bundle del navegador.
-- El JSON crudo sigue existiendo en NocoDB, que es su lugar. El espejo es una caché
-- de lectura para el dashboard, y el dashboard nunca leyó `raw` (grep en src/ = 0).

alter table public.ventas drop column raw;
