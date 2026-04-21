-- ============================================================================
-- Yani Coach Dashboard — Schema Fundacional (Fase 2)
-- 2026-04-18
-- Diseñado multi-tenant desde el inicio (visión SaaS).
-- Tablas espejo de NocoDB + tracking de syncs. Views materializadas en migración posterior.
-- ============================================================================

-- 1) Extensions ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- para gen_random_uuid()

-- 2) Tenants (multi-tenant SaaS ready) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  nocodb_base_id text,
  timezone    text NOT NULL DEFAULT 'America/Bogota',
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.tenants (slug, name, timezone)
VALUES ('yani-coach', 'Yani Coach', 'America/Bogota')
ON CONFLICT (slug) DO NOTHING;

-- 3) Vendedoras ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendedoras (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nocodb_id           integer NOT NULL,
  nombre              text,
  email               text,
  estado              text,
  chatwoot_agent_id   integer,
  raw                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  nocodb_created_at   timestamptz,
  nocodb_updated_at   timestamptz,
  synced_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nocodb_id)
);

-- 4) Contactos (leads) --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contactos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nocodb_id            integer NOT NULL,
  nombre               text,
  apellido             text,
  email                text,
  telefono             text,
  pais                 text,
  estado_actual        text,       -- valor crudo de NocoDB (15 opciones)
  estado_simplificado  text,       -- 5-way mapping: Nuevo|Contactado|Interesado|VentaCerrada|VentaPerdida
  motivo_venta_perdida text,
  vendedora_nocodb_id  integer,
  vendedora_id         uuid REFERENCES public.vendedoras(id) ON DELETE SET NULL,
  estimated_value      numeric(14,2),
  lead_age_days        integer,
  proximo_contacto     timestamptz,
  registrar_actividad  text,
  etiquetas            text[] NOT NULL DEFAULT '{}',
  last_interaction_at  timestamptz,
  nocodb_created_at    timestamptz,
  nocodb_updated_at    timestamptz,
  raw                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nocodb_id)
);

-- 5) Interacciones ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interacciones (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nocodb_id            integer NOT NULL,
  contacto_nocodb_id   integer,
  contacto_id          uuid REFERENCES public.contactos(id) ON DELETE SET NULL,
  vendedora_nocodb_id  integer,
  vendedora_id         uuid REFERENCES public.vendedoras(id) ON DELETE SET NULL,
  tipo                 text,       -- WhatsApp|Llamada|Email|System.io|Formulario Web|ManyChat|Otro
  fecha                timestamptz,
  resumen              text,
  duracion_segundos    integer,
  raw                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nocodb_id)
);

-- 6) Ventas -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ventas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nocodb_id            integer NOT NULL,
  contacto_nocodb_id   integer,
  contacto_id          uuid REFERENCES public.contactos(id) ON DELETE SET NULL,
  vendedora_nocodb_id  integer,
  vendedora_id         uuid REFERENCES public.vendedoras(id) ON DELETE SET NULL,
  amount               numeric(14,2),
  producto             text,
  fecha                timestamptz,
  payment_status       text,
  sales_cycle_days     integer,
  raw                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nocodb_id)
);

-- 7) Intentos de Compra -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intentos_compra (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nocodb_id            integer NOT NULL,
  contacto_nocodb_id   integer,
  contacto_id          uuid REFERENCES public.contactos(id) ON DELETE SET NULL,
  vendedora_nocodb_id  integer,
  vendedora_id         uuid REFERENCES public.vendedoras(id) ON DELETE SET NULL,
  status               text,       -- Exitoso|Fallido|Abandonado
  fecha                timestamptz,
  recovery_seller_nocodb_id integer,
  raw                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nocodb_id)
);

-- 8) Sync Runs (tracking de jobs) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source         text NOT NULL,       -- nocodb|chatwoot|kapso
  table_name     text NOT NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  status         text NOT NULL DEFAULT 'running',  -- running|success|error
  rows_inserted  integer NOT NULL DEFAULT 0,
  rows_updated   integer NOT NULL DEFAULT 0,
  rows_failed    integer NOT NULL DEFAULT 0,
  error          jsonb,
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 9) Función de mapping Estado Actual → Estado Simplificado -------------------
CREATE OR REPLACE FUNCTION public.map_estado_simplificado(raw_estado text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw_estado IS NULL THEN NULL
    WHEN raw_estado = 'Nuevo' THEN 'Nuevo'
    WHEN raw_estado IN ('Mensaje Inicial Enviado', 'Contactado')
      OR raw_estado LIKE 'En Seguimiento%' THEN 'Contactado'
    WHEN raw_estado = 'Interesado' THEN 'Interesado'
    WHEN raw_estado = 'Venta Cerrada' THEN 'Venta Cerrada'
    WHEN raw_estado = 'Venta Perdida' THEN 'Venta Perdida'
    ELSE 'Otro'
  END;
$$;
