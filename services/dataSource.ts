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
import type { DateRange, FunnelCounts, FunnelRespondioRow, ResponsividadVendedoraRow, PlantillaStatRow, ResponsividadGeneralRow } from './types';
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
// Fetch helper — filas de personas vía /api/metrics/* (Task 5)
//
// contactos/interacciones/intentos_compra dejaron de leerse con la `anon` key
// (RLS `USING (true)` exponía teléfono/nombre a cualquiera con el bundle
// público). Ahora se leen detrás de `requireSession` — la cookie yd_auth
// viaja sola con `credentials: 'same-origin'`. `getSales`/`getKpiCounts`/
// `getSellers` siguen en el cliente `supabase` (anon) — fuera de alcance.
// ============================================================================

async function fetchMetrics<T>(path: string, dateRange?: DateRange | null): Promise<T> {
  const params = new URLSearchParams();
  if (dateRange) {
    params.set('start', dateRange.start.toISOString());
    params.set('end', dateRange.end.toISOString());
  }
  const qs = params.toString();
  const sep = path.includes('?') ? (qs ? '&' : '') : (qs ? '?' : '');
  const res = await fetch(`/api/metrics/${path}${sep}${qs}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`/api/metrics/${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ============================================================================
// Sellers
// ============================================================================

export async function getSellers(): Promise<Seller[]> {
  requireTenant();
  // Se eliminó la consulta a `vendedoras` que traía `raw`. Lo único que se le pedía era
  // `raw.Foto` para el avatar, pero `cleanRaw` descarta `Foto` en el sync: nunca se
  // resolvió. Lo que sí entregaba a cada navegador que abría el tablero era la
  // `Contraseña Nocodb` de cada asesora, porque la política RLS del espejo es `USING (true)`.
  const perf = await supabase
    .from('mv_vendedora_performance')
    .select('vendedora_nocodb_id, nombre, estado, sales_count, total_amount, leads_total, interactions_count')
    .eq('tenant_id', TENANT_ID);
  if (perf.error) throw perf.error;

  return (perf.data ?? []).map((v) => {
    const avatarUrl = undefined;
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

/** Shape cruda de GET /api/metrics/contacts — `status` sin normalizar. */
type RawContact = Omit<Contact, 'status'> & { status: string | null };

export async function getContacts(dateRange?: DateRange | null): Promise<Contact[]> {
  requireTenant();
  const raw = await fetchMetrics<RawContact[]>('contacts', dateRange);
  return raw.map((c) => ({
    ...c,
    status: toLeadStatus(c.status),
  }));
}

// ============================================================================
// Interacciones
// ============================================================================

/** Shape cruda de GET /api/metrics/interactions — sin `type`, trae medio_canal+tipo. */
type RawInteraction = Omit<Interaction, 'type'> & {
  medio_canal: string | null;
  tipo: string | null;
};

export async function getInteractions(dateRange?: DateRange | null): Promise<Interaction[]> {
  requireTenant();
  const raw = await fetchMetrics<RawInteraction[]>('interactions', dateRange);
  return raw.map((i) => ({
    id: i.id,
    contactId: i.contactId,
    sellerId: i.sellerId,
    type: toInteractionType(i.medio_canal, i.tipo),
    date: i.date,
    durationSeconds: i.durationSeconds,
    result: i.result,
  }));
}

// ============================================================================
// Ventas
// ============================================================================

const SALES_LIMIT = 5000;

export async function getSales(dateRange?: DateRange | null): Promise<Sale[]> {
  requireTenant();
  let q = supabase
    .from('ventas')
    .select('nocodb_id, contacto_nocodb_id, vendedora_nocodb_id, producto, amount, fecha, payment_status, sales_cycle_days, tipo_oferta')
    .eq('tenant_id', TENANT_ID)
    .not('es_duplicado', 'is', true) // dedup: excluye las marcadas duplicado (mantiene false y null)
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
    category: s.tipo_oferta || undefined,
  }));
}

// ============================================================================
// Compradores por producto (drill-down del ranking)
// ============================================================================

export interface ProductBuyer {
  contactName: string;
  sellerName: string | null;
  amount: number;
  date: string;
  paymentStatus: string | null;
}

/**
 * Lista de clientas que compraron un producto dado (para el panel de detalle).
 * El endpoint ya resuelve dedup (`es_duplicado`) y nombres de clienta/vendedora
 * server-side con `service_role` — acá solo se arma la querystring y se
 * devuelve tal cual, sin normalizador (no hay enum que mapear).
 */
export async function getProductBuyers(
  producto: string,
  dateRange?: DateRange | null,
): Promise<ProductBuyer[]> {
  requireTenant();
  return fetchMetrics<ProductBuyer[]>(`product-buyers?producto=${encodeURIComponent(producto)}`, dateRange);
}

// ============================================================================
// Intentos de Compra
// ============================================================================

/** Shape cruda de GET /api/metrics/attempts — `status` sin normalizar. */
type RawAttempt = Omit<PurchaseAttempt, 'status'> & { status: string | null };

export async function getAttempts(dateRange?: DateRange | null): Promise<PurchaseAttempt[]> {
  requireTenant();
  const raw = await fetchMetrics<RawAttempt[]>('attempts', dateRange);
  return raw.map((a) => ({
    ...a,
    status: toAttemptStatus(a.status),
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

  // El diseño nuevo NO usa funnelCounts (embudo por estado_actual, global) ni
  // interactionCounts: el embudo sale de get_funnel_respondio (fechado) y las
  // interacciones por canal se derivan en EquipoView desde el array `interactions`.
  // Solo se necesita kpiCounts. Omitir los otros dos evita 2 queries por refresco
  // y el 500 transitorio de get_interaction_counts tras recargas del schema cache.
  const kpis = await getKpiCounts(dateRange);

  return {
    funnelCounts: {},
    interactionCounts: {},
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
  // RPC SECURITY DEFINER (migración 29) — un solo agregado server-side, sin
  // select('*') sobre contactos (sobrevive al revoke de columnas a anon).
  const { data, error } = await supabase.rpc('get_kpi_counts', {
    p_tenant_id: TENANT_ID,
    p_start: dateRange?.start.toISOString() ?? null,
    p_end: dateRange?.end.toISOString() ?? null,
  });
  if (error) throw error;
  const r = (data as any[])?.[0] ?? {};
  return {
    leadsCreated: Number(r.leads_created ?? 0),
    newLeads: Number(r.new_leads ?? 0),
    urgentFollowUps: Number(r.urgent_follow_ups ?? 0),
    salesCount: Number(r.sales_count ?? 0),
  };
}

// ============================================================================
// Embudo extendido (Fase 2) — respuesta + ventas reales
// ============================================================================

/** Embudo Leads→Respondieron→Interesados→Venta (ventas reales + mediana). */
export async function getFunnelRespondio(
  dateRange?: DateRange | null,
): Promise<FunnelRespondioRow> {
  const { data, error } = await supabase.rpc('get_funnel_respondio', {
    p_tenant_id: TENANT_ID,
    p_start: dateRange?.start.toISOString() ?? null,
    p_end: dateRange?.end.toISOString() ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    leads_nuevos: Number(row?.leads_nuevos ?? 0),
    primer_mensaje: Number(row?.primer_mensaje ?? 0),
    respondieron: Number(row?.respondieron ?? 0),
    interesados: Number(row?.interesados ?? 0),
    agendo: Number(row?.agendo ?? 0),
    venta_cerrada: Number(row?.venta_cerrada ?? 0),
    venta_cerrada_monto: Number(row?.venta_cerrada_monto ?? 0),
    venta_perdida: Number(row?.venta_perdida ?? 0),
    tiempo_resp_mediana_min:
      row?.tiempo_resp_mediana_min === null || row?.tiempo_resp_mediana_min === undefined
        ? null
        : Number(row.tiempo_resp_mediana_min),
  };
}

export async function getPlantillasStats(
  dateRange?: DateRange | null,
): Promise<PlantillaStatRow[]> {
  const { data, error } = await supabase.rpc('get_plantillas_stats', {
    p_tenant_id: TENANT_ID,
    p_start: dateRange?.start.toISOString() ?? null,
    p_end: dateRange?.end.toISOString() ?? null,
  });
  if (error) throw error;
  return ((data as any[]) ?? []).map((d) => ({
    template_name: String(d.template_name),
    shortcode: d.shortcode ?? null,
    descripcion: d.descripcion ?? null,
    enviados: Number(d.enviados ?? 0),
    fallidos: Number(d.fallidos ?? 0),
    leidos: Number(d.leidos ?? 0),
    respondidos: Number(d.respondidos ?? 0),
    tasa_fallo: d.tasa_fallo == null ? null : Number(d.tasa_fallo),
    tasa_apertura: d.tasa_apertura == null ? null : Number(d.tasa_apertura),
    tasa_respuesta: d.tasa_respuesta == null ? null : Number(d.tasa_respuesta),
  }));
}

/** Responsividad GENERAL estable (últimos 30 días, NO atada al filtro del dashboard). */
export async function getResponsividadGeneral(): Promise<ResponsividadGeneralRow[]> {
  const { data, error } = await supabase.rpc('get_responsividad_general', {
    p_tenant_id: TENANT_ID,
    p_days: 30,
  });
  if (error) throw error;
  return ((data as any[]) ?? []).map((d) => ({
    vendedora_id: d.vendedora_id === null ? null : String(d.vendedora_id),
    vendedora_nombre: d.vendedora_nombre ?? null,
    chats_con_tiempo: Number(d.chats_con_tiempo ?? 0),
    resp_mediana_min: d.resp_mediana_min === null ? null : Number(d.resp_mediana_min),
    b_menos_15: Number(d.b_menos_15 ?? 0),
    b_15_60: Number(d.b_15_60 ?? 0),
    b_1_4h: Number(d.b_1_4h ?? 0),
    b_mas_4h: Number(d.b_mas_4h ?? 0),
  }));
}

/** Responsividad (mediana de respuesta) por vendedora. */
export async function getResponsividad(
  dateRange?: DateRange | null,
): Promise<ResponsividadVendedoraRow[]> {
  // RPC fechado por cohorte de leads (coherente con get_funnel_respondio).
  // Sin rango → global. Reemplaza la vista global v_responsividad_vendedora
  // para que el bloque "El equipo responde bien" respete el filtro de fecha.
  const { data, error } = await supabase.rpc('get_responsividad', {
    p_tenant_id: TENANT_ID,
    p_start: dateRange?.start.toISOString() ?? null,
    p_end: dateRange?.end.toISOString() ?? null,
  });
  if (error) throw error;
  return ((data as any[]) ?? []).map((d) => ({
    vendedora_id: String(d.vendedora_id),
    vendedora_nombre: d.vendedora_nombre ?? null,
    chats_respondidos: Number(d.chats_respondidos ?? 0),
    chats_sin_respuesta: Number(d.chats_sin_respuesta ?? 0),
    resp_mediana_min: d.resp_mediana_min === null ? null : Number(d.resp_mediana_min),
  }));
}
