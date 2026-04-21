-- ============================================================================
-- Migración 02: Indexes + Row-Level Security
-- ============================================================================

-- Indexes ---------------------------------------------------------------------

-- Vendedoras
CREATE INDEX IF NOT EXISTS idx_vendedoras_tenant ON public.vendedoras (tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendedoras_chatwoot ON public.vendedoras (tenant_id, chatwoot_agent_id) WHERE chatwoot_agent_id IS NOT NULL;

-- Contactos
CREATE INDEX IF NOT EXISTS idx_contactos_tenant ON public.contactos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_contactos_vendedora ON public.contactos (tenant_id, vendedora_id);
CREATE INDEX IF NOT EXISTS idx_contactos_estado_simpl ON public.contactos (tenant_id, estado_simplificado);
CREATE INDEX IF NOT EXISTS idx_contactos_estado_actual ON public.contactos (tenant_id, estado_actual);
CREATE INDEX IF NOT EXISTS idx_contactos_created ON public.contactos (tenant_id, nocodb_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contactos_updated ON public.contactos (tenant_id, nocodb_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contactos_proximo ON public.contactos (tenant_id, proximo_contacto) WHERE proximo_contacto IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contactos_etiquetas ON public.contactos USING GIN (etiquetas);

-- Interacciones
CREATE INDEX IF NOT EXISTS idx_interacciones_tenant ON public.interacciones (tenant_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_contacto ON public.interacciones (tenant_id, contacto_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_vendedora ON public.interacciones (tenant_id, vendedora_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_fecha ON public.interacciones (tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_interacciones_tipo ON public.interacciones (tenant_id, tipo);

-- Ventas
CREATE INDEX IF NOT EXISTS idx_ventas_tenant ON public.ventas (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ventas_vendedora ON public.ventas (tenant_id, vendedora_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON public.ventas (tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_producto ON public.ventas (tenant_id, producto);

-- Intentos
CREATE INDEX IF NOT EXISTS idx_intentos_tenant ON public.intentos_compra (tenant_id);
CREATE INDEX IF NOT EXISTS idx_intentos_vendedora ON public.intentos_compra (tenant_id, vendedora_id);
CREATE INDEX IF NOT EXISTS idx_intentos_fecha ON public.intentos_compra (tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_intentos_status ON public.intentos_compra (tenant_id, status);

-- Sync runs
CREATE INDEX IF NOT EXISTS idx_sync_runs_tenant ON public.sync_runs (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_source_table ON public.sync_runs (tenant_id, source, table_name, started_at DESC);

-- Row-Level Security ----------------------------------------------------------
-- Estrategia: cada tabla filtra por tenant_id usando un GUC (app.current_tenant).
-- El service_role bypassa RLS (ver sync jobs). El anon key (cliente) debe SET app.current_tenant
-- al conectarse, o bien autenticarse con Supabase Auth y el policy leerá el JWT claim.
-- Como arrancamos sin Supabase Auth, el patrón es:
--   SELECT set_config('app.current_tenant', '<tenant_uuid>', true); luego queries.

ALTER TABLE public.tenants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedoras        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contactos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interacciones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentos_compra   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs         ENABLE ROW LEVEL SECURITY;

-- Helper: obtener tenant actual (null si no seteado) --------------------------
CREATE OR REPLACE FUNCTION public.current_tenant() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '')::uuid;
$$;

-- Policies de lectura (SELECT) -----------------------------------------------
-- tenants: cada quien ve su propio tenant
DROP POLICY IF EXISTS tenants_select_own ON public.tenants;
CREATE POLICY tenants_select_own ON public.tenants
  FOR SELECT
  USING (id = public.current_tenant());

-- Resto: filtrar por tenant_id
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vendedoras','contactos','interacciones','ventas','intentos_compra','sync_runs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_own ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select_own ON public.%I FOR SELECT USING (tenant_id = public.current_tenant());',
      t, t
    );
  END LOOP;
END
$$;

-- Nota: INSERT/UPDATE/DELETE no tienen policy de usuario final.
-- Solo el service_role (sync jobs) puede escribir, y bypassa RLS automáticamente.
