CREATE OR REPLACE FUNCTION public.get_kpi_counts(
  p_tenant_id uuid,
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
) RETURNS TABLE(leads_created bigint, new_leads bigint, urgent_follow_ups bigint, sales_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT
    (SELECT count(*) FROM public.contactos
       WHERE tenant_id = p_tenant_id
         AND (p_start IS NULL OR nocodb_created_at >= p_start)
         AND (p_end   IS NULL OR nocodb_created_at <= p_end)),
    (SELECT count(*) FROM public.contactos
       WHERE tenant_id = p_tenant_id AND estado_simplificado = 'Nuevo'
         AND (p_start IS NULL OR nocodb_created_at >= p_start)
         AND (p_end   IS NULL OR nocodb_created_at <= p_end)),
    (SELECT count(*) FROM public.contactos
       WHERE tenant_id = p_tenant_id
         AND estado_simplificado NOT IN ('Venta Cerrada','Venta Perdida')
         AND proximo_contacto < now()
         AND proximo_contacto IS NOT NULL),
    (SELECT count(*) FROM public.ventas
       WHERE tenant_id = p_tenant_id
         AND (p_start IS NULL OR fecha >= p_start)
         AND (p_end   IS NULL OR fecha <= p_end));
$function$;

grant execute on function public.get_kpi_counts(uuid, timestamptz, timestamptz) to anon, authenticated;
-- NOTA: sales_count NO deduplica (espejo del código actual). Si se quiere `es_duplicado=false`,
-- es un cambio de número deliberado — decidir aparte, no aquí.
