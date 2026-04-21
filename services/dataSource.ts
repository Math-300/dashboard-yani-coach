/**
 * dataSource — capa de lectura del Dashboard desde Supabase (Fase 2).
 *
 * Reemplaza services/noco.ts en consumo directo. Devuelve las mismas shapes
 * (Seller, Contact, Interaction, Sale, PurchaseAttempt) para no romper views.
 *
 * REGLAS:
 * - Multi-tenant: toda query filtra por TENANT_ID explícito.
 * - No fallbacks ni mocks: si Supabase falla, el error sube y rompe la UI.
 *   Es el comportamiento deseado — las fallas silenciosas están prohibidas.
 *
 * Comparado con noco.ts:
 * - Métricas pesadas vienen pre-agregadas (mv_funnel_counts, mv_vendedora_performance).
 * - Los rollups de vendedoras ya no dependen de fórmulas NocoDB.
 * - Una sola query por entidad en vez de micro-fetching + paginación manual.
 */

import {
  Contact,
  Interaction,
  Sale,
  PurchaseAttempt,
  Seller,
  LeadStatus,
  InteractionType,
  PurchaseAttemptStatus,
  KpiCounts,
} from '../types';
import type { DateRange, FunnelCounts } from './types';
import { supabase, TENANT_ID } from './supabaseClient';

// ============================================================================
// Mappings Supabase → Dashboard enums
// ============================================================================

function toLeadStatus(estadoSimplificado: string | null | undefined): LeadStatus {
  switch (estadoSimplificado) {
    case 'Nuevo': return LeadStatus.NEW;
    case 'Contactado': return LeadStatus.CONTACTED;
    case 'Interesado': return LeadStatus.INTERESTED;
    case 'Venta Cerrada': return LeadStatus.CLOSED_WON;
    case 'Venta Perdida': return LeadStatus.CLOSED_LOST;
    default: return LeadStatus.NEW; // 'Otro' o null → NEW (menos destructivo que LOST)
  }
}

function toInteractionType(medio: string | null, tipo: string | null): InteractionType {
  const s = (medio || tipo || '').toLowerCase();
  if (s.includes('whatsapp')) return InteractionType.WHATSAPP;
  if (s.includes('llamada')) return InteractionType.CALL;
  if (s.includes('email')) return InteractionType.EMAIL;
  if (s.includes('system.io') || s.includes('systemio')) return InteractionType.SYSTEM;
  if (s.includes('formulario')) return InteractionType.FORM;
  if (s.includes('manychat')) return InteractionType.MANYCHAT;
  return InteractionType.OTHER;
}

function toAttemptStatus(status: string | null): PurchaseAttemptStatus {
  if (!status) return PurchaseAttemptStatus.FAILED;
  const s = status.toLowerCase();
  if (s.includes('recuperado') || s.includes('exitoso')) return PurchaseAttemptStatus.SUCCESSFUL;
  if (s.includes('cancelad') || s.includes('abandonad')) return PurchaseAttemptStatus.ABANDONED;
  return PurchaseAttemptStatus.FAILED;
}

function requireTenant() {
  if (!TENANT_ID) {
    throw new Error('Supabase dataSource: VITE_SUPABASE_TENANT_ID no está configurado.');
  }
}

// ============================================================================
// Sellers
// ============================================================================

export async function getSellers(): Promise<Seller[]> {
  requireTenant();
  const [perf, base] = await Promise.all([
    supabase
      .from('mv_vendedora_performance')
      .select('vendedora_nocodb_id, nombre, estado, sales_count, total_amount, leads_total, interactions_count')
      .eq('tenant_id', TENANT_ID),
    supabase
      .from('vendedoras')
      .select('nocodb_id, raw')
      .eq('tenant_id', TENANT_ID),
  ]);
  if (perf.error) throw perf.error;
  if (base.error) throw base.error;

  const rawById = new Map<number, Record<string, any>>();
  for (const v of base.data ?? []) rawById.set(v.nocodb_id, (v.raw as Record<string, any>) || {});

  return (perf.data ?? []).map((v) => {
    const raw = rawById.get(v.vendedora_nocodb_id) || {};
    // Avatar: primer attachment de `Foto` de NocoDB (signedUrl) — best effort
    const foto = Array.isArray(raw.Foto) && raw.Foto.length > 0 ? raw.Foto[0] : null;
    const avatarUrl = foto?.signedUrl || foto?.url || undefined;
    return {
      id: String(v.vendedora_nocodb_id),
      name: v.nombre || 'Sin Nombre',
      avatarUrl,
      totalSalesAmount: Number(v.total_amount || 0),
      salesCount: Number(v.sales_count || 0),
      leadsTotal: Number(v.leads_total || 0),
      leadsToday: 0, // requiere query adicional; ver getKpiCounts
      interactionsCount: Number(v.interactions_count || 0),
      recoveriesAssigned: 0,
      status: v.estado || 'Activo',
    };
  });
}

// ============================================================================
// Contactos (con filtro de fecha opcional)
// ============================================================================

const CONTACT_LIMIT = 1000; // espejo del comportamiento actual de noco.ts

export async function getContacts(dateRange?: DateRange | null): Promise<Contact[]> {
  requireTenant();
  let q = supabase
    .from('contactos')
    .select('nocodb_id, nombre, pais, nocodb_created_at, estado_simplificado, motivo_venta_perdida, vendedora_nocodb_id, estimated_value, lead_age_days, proximo_contacto, etiquetas')
    .eq('tenant_id', TENANT_ID)
    .order('nocodb_created_at', { ascending: false })
    .limit(CONTACT_LIMIT);

  if (dateRange) {
    q = q
      .gte('nocodb_created_at', dateRange.start.toISOString())
      .lte('nocodb_created_at', dateRange.end.toISOString());
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((c) => ({
    id: String(c.nocodb_id),
    name: c.nombre || 'Lead Sin Nombre',
    country: c.pais || 'Desconocido',
    createdAt: c.nocodb_created_at || new Date().toISOString(),
    status: toLeadStatus(c.estado_simplificado),
    lostReasonDetail: c.motivo_venta_perdida || undefined,
    assignedSellerId: c.vendedora_nocodb_id != null ? String(c.vendedora_nocodb_id) : '',
    estimatedValue: c.estimated_value != null ? Number(c.estimated_value) : undefined,
    leadAgeDays: c.lead_age_days != null ? Number(c.lead_age_days) : undefined,
    nextContactDate: c.proximo_contacto || undefined,
    leadSource: Array.isArray(c.etiquetas) && c.etiquetas.length > 0 ? c.etiquetas[0] : undefined,
  }));
}

// ============================================================================
// Interacciones
// ============================================================================

const INTERACTION_LIMIT = 1000;

export async function getInteractions(dateRange?: DateRange | null): Promise<Interaction[]> {
  requireTenant();
  let q = supabase
    .from('interacciones')
    .select('nocodb_id, contacto_nocodb_id, vendedora_nocodb_id, tipo, medio_canal, fecha, duracion_segundos, raw')
    .eq('tenant_id', TENANT_ID)
    .order('fecha', { ascending: false })
    .limit(INTERACTION_LIMIT);

  if (dateRange) {
    q = q.gte('fecha', dateRange.start.toISOString()).lte('fecha', dateRange.end.toISOString());
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((i) => ({
    id: String(i.nocodb_id),
    contactId: i.contacto_nocodb_id != null ? String(i.contacto_nocodb_id) : '',
    sellerId: i.vendedora_nocodb_id != null ? String(i.vendedora_nocodb_id) : '',
    type: toInteractionType(i.medio_canal, i.tipo),
    date: i.fecha || new Date().toISOString(),
    durationSeconds: i.duracion_segundos || 0,
    result: (i.raw as any)?.Resultado || '',
  }));
}

// ============================================================================
// Ventas
// ============================================================================

const SALES_LIMIT = 1000;

export async function getSales(dateRange?: DateRange | null): Promise<Sale[]> {
  requireTenant();
  let q = supabase
    .from('ventas')
    .select('nocodb_id, contacto_nocodb_id, vendedora_nocodb_id, producto, amount, fecha, payment_status, sales_cycle_days')
    .eq('tenant_id', TENANT_ID)
    .order('fecha', { ascending: false })
    .limit(SALES_LIMIT);

  if (dateRange) {
    q = q.gte('fecha', dateRange.start.toISOString()).lte('fecha', dateRange.end.toISOString());
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((s) => ({
    id: String(s.nocodb_id),
    contactId: s.contacto_nocodb_id != null ? String(s.contacto_nocodb_id) : '',
    sellerId: s.vendedora_nocodb_id != null ? String(s.vendedora_nocodb_id) : '',
    productName: s.producto || 'Producto',
    amount: Number(s.amount || 0),
    date: s.fecha || new Date().toISOString(),
    paymentStatus: s.payment_status || undefined,
    salesCycleDays: s.sales_cycle_days || undefined,
  }));
}

// ============================================================================
// Intentos de Compra
// ============================================================================

const ATTEMPTS_LIMIT = 1000;

export async function getAttempts(dateRange?: DateRange | null): Promise<PurchaseAttempt[]> {
  requireTenant();
  let q = supabase
    .from('intentos_compra')
    .select('nocodb_id, contacto_nocodb_id, status, fecha, recovery_seller_nocodb_id, raw')
    .eq('tenant_id', TENANT_ID)
    .order('fecha', { ascending: false })
    .limit(ATTEMPTS_LIMIT);

  if (dateRange) {
    q = q.gte('fecha', dateRange.start.toISOString()).lte('fecha', dateRange.end.toISOString());
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((a) => ({
    id: String(a.nocodb_id),
    contactId: a.contacto_nocodb_id != null ? String(a.contacto_nocodb_id) : '',
    amount: Number((a.raw as any)?.['Monto a Recuperar'] || 0),
    status: toAttemptStatus(a.status),
    date: a.fecha || new Date().toISOString(),
    recoverySellerId:
      a.recovery_seller_nocodb_id != null ? String(a.recovery_seller_nocodb_id) : undefined,
  }));
}

// ============================================================================
// Summary metrics (pre-agregados en Supabase)
// ============================================================================

export interface SummaryMetrics {
  funnelCounts: FunnelCounts;
  interactionCounts: Record<string, number>;
  kpiCounts: KpiCounts;
}

export async function getSummaryMetrics(dateRange?: DateRange | null): Promise<SummaryMetrics> {
  requireTenant();

  const [funnel, interactionsByType, kpis] = await Promise.all([
    getFunnelCounts(),
    getInteractionCounts(dateRange),
    getKpiCounts(dateRange),
  ]);

  return {
    funnelCounts: funnel,
    interactionCounts: interactionsByType,
    kpiCounts: kpis,
  };
}

async function getFunnelCounts(): Promise<FunnelCounts> {
  const { data, error } = await supabase
    .from('mv_funnel_counts')
    .select('estado_simplificado, total')
    .eq('tenant_id', TENANT_ID);
  if (error) throw error;
  const out: FunnelCounts = {};
  for (const r of data ?? []) out[r.estado_simplificado] = Number(r.total);
  return out;
}

async function getInteractionCounts(dateRange?: DateRange | null): Promise<Record<string, number>> {
  // PostgREST limita filas (1000 default), así que agregamos server-side via RPC.
  const { data, error } = await supabase.rpc('get_interaction_counts', {
    p_tenant_id: TENANT_ID,
    p_start: dateRange?.start.toISOString() ?? null,
    p_end: dateRange?.end.toISOString() ?? null,
  });
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const [canal, cnt] of Object.entries((data as Record<string, number>) || {})) {
    out[canal] = Number(cnt);
  }
  return out;
}

async function getKpiCounts(dateRange?: DateRange | null): Promise<KpiCounts> {
  // Conteos simples con HEAD requests (count: exact)
  const range = dateRange
    ? { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() }
    : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartISO = todayStart.toISOString();

  const [leadsCreated, newLeads, urgentFollowUps, salesCount] = await Promise.all([
    // leads creados en el rango
    (async () => {
      let q = supabase
        .from('contactos')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID);
      if (range) q = q.gte('nocodb_created_at', range.start).lte('nocodb_created_at', range.end);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    })(),
    // leads nuevos (estado Nuevo) en el rango
    (async () => {
      let q = supabase
        .from('contactos')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID)
        .eq('estado_simplificado', 'Nuevo');
      if (range) q = q.gte('nocodb_created_at', range.start).lte('nocodb_created_at', range.end);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    })(),
    // seguimientos urgentes: próximo contacto < hoy y estado no cerrado
    (async () => {
      const nowISO = new Date().toISOString();
      const { count, error } = await supabase
        .from('contactos')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID)
        .not('estado_simplificado', 'in', '(Venta Cerrada,Venta Perdida)')
        .lt('proximo_contacto', nowISO)
        .not('proximo_contacto', 'is', null);
      if (error) throw error;
      return count ?? 0;
    })(),
    // ventas en el rango
    (async () => {
      let q = supabase
        .from('ventas')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID);
      if (range) q = q.gte('fecha', range.start).lte('fecha', range.end);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    })(),
  ]);

  return { leadsCreated, newLeads, urgentFollowUps, salesCount };
}
