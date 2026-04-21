-- ============================================================================
-- Migración 06: mapping real de estado_actual (17 valores observados en prod)
-- ----------------------------------------------------------------------------
-- El mapping inicial (migración 01) asumía los 15 valores documentados en
-- .brain/nocodb_esquema.md. La realidad de NocoDB tiene variantes: "Lead Nuevo"
-- en vez de "Nuevo", "Venta Ganada" vs "Venta Cerrada", "Contactar en 48 horas",
-- "Nutrición a Largo Plazo", "Llamada Agendada", etc.
--
-- Esta migración:
--   1) Actualiza la función map_estado_simplificado con el mapping real.
--   2) Backfill: aplica el nuevo mapping a los 30k contactos ya sincronizados.
--
-- El espejo TS vive en scripts/sync/helpers.ts → mantener sincronizados.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.map_estado_simplificado(raw_estado text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw_estado IS NULL THEN NULL
    WHEN raw_estado IN ('Nuevo', 'Lead Nuevo') THEN 'Nuevo'
    WHEN raw_estado IN ('Venta Cerrada', 'Venta Ganada') THEN 'Venta Cerrada'
    WHEN raw_estado = 'Interesado' THEN 'Interesado'
    WHEN raw_estado IN ('Llamada Agendada', 'Seguimiento Potencial venta') THEN 'Interesado'
    WHEN raw_estado IN ('Venta Perdida', 'no contactar', 'No se presentó', 'Seguimiento venta perdida')
      OR raw_estado LIKE 'Leads perdidos%' THEN 'Venta Perdida'
    WHEN raw_estado IN ('Contactado', 'Mensaje Inicial Enviado', 'Contactar en 48 horas', 'Nutrición a Largo Plazo', 'Seguimiento Cliente Nuevo')
      OR raw_estado LIKE 'En Seguimiento%'
      OR raw_estado LIKE 'Seguimiento leads%' THEN 'Contactado'
    ELSE 'Otro'
  END;
$$;

UPDATE public.contactos
SET estado_simplificado = public.map_estado_simplificado(estado_actual)
WHERE estado_simplificado IS DISTINCT FROM public.map_estado_simplificado(estado_actual);
