/**
 * Endpoints de filas para el dashboard, servidos con `service_role` (Task 3)
 * detrás de `requireSession` (montado en server.ts). Mirror server-side de las
 * cuatro funciones de lectura de `services/dataSource.ts` — mismas columnas,
 * mismo `.eq('tenant_id', TENANT_ID)`, mismo orden/limit y mismo rango de
 * fecha `.gte/.lte`. Después de Task 5 el front deja de leer
 * `contactos`/`interacciones`/`intentos_compra` con la `anon` key y consume
 * estas rutas en su lugar.
 *
 * CONTRATO PARA TASK 5 — campos crudos, no normalizados:
 * Para no duplicar `toLeadStatus`/`toInteractionType`/`toAttemptStatus` (que
 * viven en dataSource.ts) acá dentro del server, estos handlers devuelven el
 * campo/los campos crudos de la DB en vez del enum ya mapeado:
 *   - GET /contacts       → `status` es `estado_simplificado` crudo (string).
 *                            Task 5 debe aplicarle `toLeadStatus(...)`.
 *   - GET /interactions   → NO hay `type`; se emiten `medio_canal` y `tipo`
 *                            crudos. Task 5 debe llamar
 *                            `toInteractionType(medio_canal, tipo)`.
 *   - GET /attempts       → `status` es el `status` crudo de `intentos_compra`.
 *                            Task 5 debe aplicarle `toAttemptStatus(...)`.
 *   - GET /product-buyers → sin enum que normalizar (nombres ya resueltos);
 *                            este endpoint SÍ devuelve el objeto `ProductBuyer`
 *                            final, igual que `getProductBuyers` hoy.
 *
 * Nunca usar `select('*')` ni interpolar nombres de tabla/columna desde el
 * request — todas las columnas están explícitas y `producto` (el único valor
 * de request que entra en un `.eq`) va como bind param del query builder, no
 * concatenado a SQL.
 */
import { Router } from 'express';
import { supabaseService, TENANT_ID } from './supabaseService.js';

export const metricsRouter = Router();

function parseRange(req: any): { start?: string; end?: string } {
  const { start, end } = (req.query ?? {}) as Record<string, string | undefined>;
  return typeof start === 'string' && typeof end === 'string' ? { start, end } : {};
}

// Ruta de humo (Task 3) — se mueve acá para no montarla dos veces en server.ts.
metricsRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ============================================================================
// GET /api/metrics/contacts
// ============================================================================
metricsRouter.get('/contacts', async (req, res) => {
  try {
    let q = supabaseService
      .from('contactos')
      .select('nocodb_id, nombre, pais, nocodb_created_at, estado_simplificado, motivo_venta_perdida, vendedora_nocodb_id, estimated_value, lead_age_days, proximo_contacto, etiquetas')
      .eq('tenant_id', TENANT_ID)
      .order('nocodb_created_at', { ascending: false })
      .limit(1000);

    const { start, end } = parseRange(req);
    if (start && end) q = q.gte('nocodb_created_at', start).lte('nocodb_created_at', end);

    const { data, error } = await q;
    if (error) throw error;

    res.json((data ?? []).map((c: any) => ({
      id: String(c.nocodb_id),
      name: c.nombre || 'Lead Sin Nombre',
      country: c.pais || 'Desconocido',
      createdAt: c.nocodb_created_at || new Date().toISOString(),
      status: c.estado_simplificado, // crudo — el front normaliza con toLeadStatus (Task 5)
      lostReasonDetail: c.motivo_venta_perdida || undefined,
      assignedSellerId: c.vendedora_nocodb_id != null ? String(c.vendedora_nocodb_id) : '',
      estimatedValue: c.estimated_value != null ? Number(c.estimated_value) : undefined,
      leadAgeDays: c.lead_age_days != null ? Number(c.lead_age_days) : undefined,
      nextContactDate: c.proximo_contacto || undefined,
      leadSource: Array.isArray(c.etiquetas) && c.etiquetas.length > 0 ? c.etiquetas[0] : undefined,
    })));
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

// ============================================================================
// GET /api/metrics/interactions
// ============================================================================
metricsRouter.get('/interactions', async (req, res) => {
  try {
    let q = supabaseService
      .from('interacciones')
      .select('nocodb_id, contacto_nocodb_id, vendedora_nocodb_id, tipo, medio_canal, fecha, duracion_segundos, resultado')
      .eq('tenant_id', TENANT_ID)
      .order('fecha', { ascending: false })
      .limit(1000);

    const { start, end } = parseRange(req);
    if (start && end) q = q.gte('fecha', start).lte('fecha', end);

    const { data, error } = await q;
    if (error) throw error;

    res.json((data ?? []).map((i: any) => ({
      id: String(i.nocodb_id),
      contactId: i.contacto_nocodb_id != null ? String(i.contacto_nocodb_id) : '',
      sellerId: i.vendedora_nocodb_id != null ? String(i.vendedora_nocodb_id) : '',
      // crudo — el front normaliza con toInteractionType(medio_canal, tipo) (Task 5)
      medio_canal: i.medio_canal ?? null,
      tipo: i.tipo ?? null,
      date: i.fecha || new Date().toISOString(),
      durationSeconds: i.duracion_segundos || 0,
      result: i.resultado || '',
    })));
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

// ============================================================================
// GET /api/metrics/attempts
// ============================================================================
metricsRouter.get('/attempts', async (req, res) => {
  try {
    let q = supabaseService
      .from('intentos_compra')
      .select('nocodb_id, contacto_nocodb_id, status, fecha, recovery_seller_nocodb_id, monto_a_recuperar')
      .eq('tenant_id', TENANT_ID)
      .order('fecha', { ascending: false })
      .limit(1000);

    const { start, end } = parseRange(req);
    if (start && end) q = q.gte('fecha', start).lte('fecha', end);

    const { data, error } = await q;
    if (error) throw error;

    res.json((data ?? []).map((a: any) => ({
      id: String(a.nocodb_id),
      contactId: a.contacto_nocodb_id != null ? String(a.contacto_nocodb_id) : '',
      amount: Number(a.monto_a_recuperar || 0),
      status: a.status, // crudo — el front normaliza con toAttemptStatus (Task 5)
      date: a.fecha || new Date().toISOString(),
      recoverySellerId: a.recovery_seller_nocodb_id != null ? String(a.recovery_seller_nocodb_id) : undefined,
    })));
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

// ============================================================================
// GET /api/metrics/product-buyers?producto=...
//
// Único endpoint que expone NOMBRES de clientas — el guard requireSession
// montado en server.ts es su ÚNICA defensa. No agregar ninguna ruta que
// resuelva nombres sin pasar por ese middleware.
// ============================================================================
metricsRouter.get('/product-buyers', async (req, res) => {
  try {
    const producto = typeof req.query.producto === 'string' ? req.query.producto : '';
    if (!producto) {
      return res.status(400).json({ error: "falta 'producto'" });
    }

    let q = supabaseService
      .from('ventas')
      .select('contacto_nocodb_id, vendedora_nocodb_id, amount, fecha, payment_status')
      .eq('tenant_id', TENANT_ID)
      .eq('producto', producto)
      .not('es_duplicado', 'is', true) // dedup: mantiene false y null, excluye true
      .order('fecha', { ascending: false })
      .limit(500);

    const { start, end } = parseRange(req);
    if (start && end) q = q.gte('fecha', start).lte('fecha', end);

    const { data, error } = await q;
    if (error) throw error;
    const rows = data ?? [];

    // Nombres de clienta (una query por el set de ids).
    const contactIds = [...new Set(
      rows.map((r: any) => r.contacto_nocodb_id).filter((x: any): x is number => x != null),
    )];
    const contactName = new Map<number, string>();
    if (contactIds.length > 0) {
      const { data: cs, error: cErr } = await supabaseService
        .from('contactos')
        .select('nocodb_id, nombre')
        .eq('tenant_id', TENANT_ID)
        .in('nocodb_id', contactIds);
      if (cErr) throw cErr;
      for (const c of cs ?? []) contactName.set(c.nocodb_id, c.nombre || 'Sin nombre');
    }

    // Nombres de vendedora — mismo rollup que getSellers() en dataSource.ts,
    // pero leído con service_role (NO se puede importar getSellers: usa el
    // cliente anon del browser).
    const { data: perf, error: perfErr } = await supabaseService
      .from('mv_vendedora_performance')
      .select('vendedora_nocodb_id, nombre')
      .eq('tenant_id', TENANT_ID);
    if (perfErr) throw perfErr;
    const sellerName = new Map<string, string>(
      (perf ?? []).map((v: any) => [String(v.vendedora_nocodb_id), v.nombre || 'Sin Nombre']),
    );

    res.json(rows.map((r: any) => ({
      contactName: r.contacto_nocodb_id != null ? contactName.get(r.contacto_nocodb_id) ?? 'Sin nombre' : 'Sin nombre',
      sellerName: r.vendedora_nocodb_id != null ? sellerName.get(String(r.vendedora_nocodb_id)) ?? null : null,
      amount: Number(r.amount || 0),
      date: r.fecha,
      paymentStatus: r.payment_status ?? null,
    })));
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});
