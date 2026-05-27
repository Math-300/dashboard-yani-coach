-- ============================================================================
-- Fase 1 — Señal "respondió" desde Chatwoot
-- Tabla de conversaciones + columnas de enlace en contactos.
-- Enlace primario por nocodb_id (~97% cobertura); fallback por chatwoot_contact_id.
-- ============================================================================

-- 1) Columna de enlace fallback en contactos (viene de NocoDB.chatwoot_contact_id)
ALTER TABLE public.contactos
  ADD COLUMN IF NOT EXISTS chatwoot_contact_id text;

CREATE INDEX IF NOT EXISTS idx_contactos_chatwoot_contact
  ON public.contactos (tenant_id, chatwoot_contact_id)
  WHERE chatwoot_contact_id IS NOT NULL;

-- 2) Tabla de conversaciones de Chatwoot (1 fila por conversación)
CREATE TABLE IF NOT EXISTS public.chatwoot_conversaciones (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chatwoot_conversation_id      bigint NOT NULL,
  chatwoot_contact_id           text,
  contacto_nocodb_id            integer,
  contacto_id                   uuid REFERENCES public.contactos(id) ON DELETE SET NULL,
  agent_chatwoot_id             integer,
  vendedora_id                  uuid REFERENCES public.vendedoras(id) ON DELETE SET NULL,
  status                        text,
  respondio                     boolean NOT NULL DEFAULT false,
  primer_outbound_at            timestamptz,
  primer_inbound_at             timestamptz,
  tiempo_primera_respuesta_seg  integer,
  last_activity_at              timestamptz,
  raw                           jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at                     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, chatwoot_conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_cw_conv_contacto
  ON public.chatwoot_conversaciones (tenant_id, contacto_id);
CREATE INDEX IF NOT EXISTS idx_cw_conv_nocodb
  ON public.chatwoot_conversaciones (tenant_id, contacto_nocodb_id);
CREATE INDEX IF NOT EXISTS idx_cw_conv_respondio
  ON public.chatwoot_conversaciones (tenant_id, respondio);

-- 3) RLS + SELECT anónimo (mismo patrón que migración 09)
ALTER TABLE public.chatwoot_conversaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_select_cw_conv ON public.chatwoot_conversaciones;
CREATE POLICY anon_select_cw_conv ON public.chatwoot_conversaciones
  FOR SELECT TO anon USING (true);

-- 4) FK resolver: primario por nocodb_id, fallback por chatwoot_contact_id, + vendedora por agent
CREATE OR REPLACE FUNCTION public.resolve_chatwoot_fks(p_tenant_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.chatwoot_conversaciones cc
  SET contacto_id = c.id
  FROM public.contactos c
  WHERE cc.tenant_id = p_tenant_id
    AND c.tenant_id = p_tenant_id
    AND cc.contacto_id IS NULL
    AND cc.contacto_nocodb_id IS NOT NULL
    AND c.nocodb_id = cc.contacto_nocodb_id;

  UPDATE public.chatwoot_conversaciones cc
  SET contacto_id = c.id
  FROM public.contactos c
  WHERE cc.tenant_id = p_tenant_id
    AND c.tenant_id = p_tenant_id
    AND cc.contacto_id IS NULL
    AND cc.chatwoot_contact_id IS NOT NULL
    AND c.chatwoot_contact_id = cc.chatwoot_contact_id;

  UPDATE public.chatwoot_conversaciones cc
  SET vendedora_id = v.id
  FROM public.vendedoras v
  WHERE cc.tenant_id = p_tenant_id
    AND v.tenant_id = p_tenant_id
    AND cc.vendedora_id IS NULL
    AND cc.agent_chatwoot_id IS NOT NULL
    AND v.chatwoot_agent_id = cc.agent_chatwoot_id;
$$;
