-- ============================================================================
-- Migración 10: columna medio_canal en interacciones
-- ----------------------------------------------------------------------------
-- El Dashboard usa Medio/Canal (System.io, WhatsApp, etc.) para agrupar
-- interacciones por canal. Hasta ahora estaba sólo en el raw jsonb. Extraerlo
-- como columna real facilita queries e indexado.
-- Sync posterior (syncInteracciones.ts) también la escribe.
-- ============================================================================

ALTER TABLE public.interacciones ADD COLUMN IF NOT EXISTS medio_canal text;

UPDATE public.interacciones
SET medio_canal = raw->>'Medio/Canal'
WHERE medio_canal IS NULL;

CREATE INDEX IF NOT EXISTS idx_interacciones_medio
  ON public.interacciones (tenant_id, medio_canal);
