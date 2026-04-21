-- ============================================================================
-- Migración 08: RPC resolve_foreign_keys — resolución FK server-side
-- ----------------------------------------------------------------------------
-- supabase-js limita SELECT a 1000 filas, lo que hacía imposible resolver el
-- FK contacto_id en memoria (contactos tiene 30k). Este RPC hace el UPDATE
-- FROM directamente en Postgres — O(tabla) sin pasar por el cliente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_foreign_keys(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- contactos.vendedora_id ← vendedoras.id (por si vendedoras crece >1000)
  UPDATE public.contactos c
  SET vendedora_id = v.id
  FROM public.vendedoras v
  WHERE c.tenant_id = p_tenant_id
    AND v.tenant_id = p_tenant_id
    AND c.vendedora_nocodb_id = v.nocodb_id
    AND (c.vendedora_id IS DISTINCT FROM v.id);

  -- interacciones.contacto_id + vendedora_id
  UPDATE public.interacciones i
  SET contacto_id = c.id
  FROM public.contactos c
  WHERE i.tenant_id = p_tenant_id AND c.tenant_id = p_tenant_id
    AND i.contacto_nocodb_id = c.nocodb_id
    AND i.contacto_id IS DISTINCT FROM c.id;

  UPDATE public.interacciones i
  SET vendedora_id = v.id
  FROM public.vendedoras v
  WHERE i.tenant_id = p_tenant_id AND v.tenant_id = p_tenant_id
    AND i.vendedora_nocodb_id = v.nocodb_id
    AND i.vendedora_id IS DISTINCT FROM v.id;

  -- ventas.contacto_id + vendedora_id
  UPDATE public.ventas x
  SET contacto_id = c.id
  FROM public.contactos c
  WHERE x.tenant_id = p_tenant_id AND c.tenant_id = p_tenant_id
    AND x.contacto_nocodb_id = c.nocodb_id
    AND x.contacto_id IS DISTINCT FROM c.id;

  UPDATE public.ventas x
  SET vendedora_id = v.id
  FROM public.vendedoras v
  WHERE x.tenant_id = p_tenant_id AND v.tenant_id = p_tenant_id
    AND x.vendedora_nocodb_id = v.nocodb_id
    AND x.vendedora_id IS DISTINCT FROM v.id;

  -- intentos_compra.contacto_id + vendedora_id
  UPDATE public.intentos_compra x
  SET contacto_id = c.id
  FROM public.contactos c
  WHERE x.tenant_id = p_tenant_id AND c.tenant_id = p_tenant_id
    AND x.contacto_nocodb_id = c.nocodb_id
    AND x.contacto_id IS DISTINCT FROM c.id;

  UPDATE public.intentos_compra x
  SET vendedora_id = v.id
  FROM public.vendedoras v
  WHERE x.tenant_id = p_tenant_id AND v.tenant_id = p_tenant_id
    AND x.vendedora_nocodb_id = v.nocodb_id
    AND x.vendedora_id IS DISTINCT FROM v.id;
END;
$$;
