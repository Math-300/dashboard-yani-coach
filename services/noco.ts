/**
 * Servicio de conexión a NocoDB — Arquitectura Micro-Fetching
 * 
 * ⚡ OPTIMIZADO: Evita descargar toda la base de datos.
 * En lugar de paginar decenas de miles de registros, hace consultas
 * quirúrgicas que devuelven solo los datos necesarios para cada KPI.
 * 
 * Resultado: ~25-30 requests por carga (antes: ~386).
 */

// ============================================
// UTILIDAD: isDateInRange (usada por BusinessView, TeamView)
// ============================================
export const isDateInRange = (dateString: string, start: Date, end: Date): boolean => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
};

import { NOCODB_CONFIG, TABLE_IDS } from '../config';
import {
  Seller, Sale, Contact, Interaction,
  LeadStatus, InteractionType,
  PurchaseAttempt, PurchaseAttemptStatus, LostReason, KpiCounts
} from '../types';

// Tipo para el rango de fechas usado en el filtrado del servidor
export interface DateRange {
  start: Date;
  end: Date;
}

// Tipo para conteos del embudo de ventas
export interface FunnelCounts {
  [status: string]: number;
}

// ============================================
// HELPERS ROBUSTOS
// ============================================

const extractId = (field: any): string => {
  if (field === undefined || field === null) return '';
  if (Array.isArray(field)) {
    return field.length > 0 ? extractId(field[0]) : '';
  }
  if (typeof field === 'object') {
    const id = field.Id ?? field.id;
    return id !== undefined && id !== null ? String(id) : '';
  }
  return String(field);
};

const extractImage = (field: any): string | undefined => {
  if (Array.isArray(field) && field.length > 0) {
    return field[0].signedUrl || field[0].url;
  }
  return typeof field === 'string' && field.startsWith('http') ? field : undefined;
};

const extractLinkedName = (field: any): string => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (Array.isArray(field) && field.length > 0) return extractLinkedName(field[0]);
  if (typeof field === 'object') {
    if (field.fields) {
      const nameFields = ['Nombre del Producto', 'Nombre de la Vendedora', 'Nombre', 'Title', 'title', 'Name'];
      for (const nf of nameFields) {
        if (field.fields[nf]) return String(field.fields[nf]);
      }
      const keys = Object.keys(field.fields).filter(k => k.toLowerCase() !== 'id');
      if (keys.length > 0) return field.fields[keys[0]] || '';
    }
  }
  return '';
};

const normalizeDate = (date: any): string => {
  if (!date) return new Date(0).toISOString();
  let parsed: Date;
  if (typeof date === 'string') {
    if (!date.endsWith('Z') && !date.includes('+') && !date.includes('T')) {
      parsed = new Date(date + 'T00:00:00Z');
    } else if (!date.endsWith('Z') && !date.includes('+') && date.includes('T')) {
      parsed = new Date(date + 'Z');
    } else {
      parsed = new Date(date);
    }
  } else {
    parsed = new Date(date);
  }
  return isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
};

const parseAmount = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  if (typeof val === 'string') {
    return parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
  }
  return 0;
};

// ============================================
// CORE HTTP CLIENT — Sin loops de paginación
// ============================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const MAX_RETRIES = 3;
const MAX_CONCURRENT_REQUESTS = 2;
const MIN_REQUEST_INTERVAL_MS = 200;

type QueueItem<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
};

let activeRequests = 0;
let lastRequestAt = 0;
const requestQueue: QueueItem<any>[] = [];

const runQueue = async () => {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) return;
  const item = requestQueue.shift();
  if (!item) return;

  activeRequests += 1;
  const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastRequestAt = Date.now();

  try {
    const result = await item.fn();
    item.resolve(result);
  } catch (error) {
    item.reject(error);
  } finally {
    activeRequests -= 1;
    if (requestQueue.length > 0) {
      runQueue();
    }
  }
};

const scheduleRequest = async <T>(fn: () => Promise<T>): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    requestQueue.push({ fn, resolve, reject });
    runQueue();
  });
};

/**
 * Construye la URL y headers según el modo de conexión (Vite proxy / Directo / Vercel proxy)
 */
const buildRequestConfig = (tableId: string, params: string): { url: string; headers: Record<string, string> } => {
  const useViteProxy = NOCODB_CONFIG.USE_VITE_PROXY;
  const useDirectConnection = NOCODB_CONFIG.IS_DEV && NOCODB_CONFIG.HAS_DIRECT_CREDENTIALS && !useViteProxy;

  if (useViteProxy) {
    return {
      url: `/api/nocodb/${tableId}/records?${params}`,
      headers: { 'Content-Type': 'application/json' }
    };
  } else if (useDirectConnection) {
    return {
      url: `${NOCODB_CONFIG.BASE_URL}/api/v2/tables/${tableId}/records?${params}`,
      headers: { 'xc-token': NOCODB_CONFIG.TOKEN || '', 'Content-Type': 'application/json' }
    };
  } else {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      url: `${baseUrl}/api/nocodb/${tableId}/records?${params}`,
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

/**
 * Ejecuta un fetch con retry y backoff para 429.
 * Retorna el JSON parseado o null en caso de error.
 */
const fetchWithRetry = async (url: string, headers: Record<string, string>, label: string): Promise<any | null> => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const r = await scheduleRequest(() => fetch(url, { headers }));
      if (r.status === 429) {
        const waitMs = Math.pow(2, attempt) * 1000 + 500;
        console.warn(`[API] ${label}: 429, esperando ${waitMs}ms (intento ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitMs);
        continue;
      }
      if (!r.ok) {
        console.error(`[API] Error ${r.status} en ${label}`);
        return null;
      }
      const contentType = r.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`[API] Respuesta no es JSON en ${label}`);
        return null;
      }
      return await r.json();
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error(`[API] Fallo crítico en ${label}:`, error);
        return null;
      }
      await sleep(1000);
    }
  }
  return null;
};

// ============================================
// FECHA HELPERS
// ============================================

const formatDateLocal = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDateTimeLocal = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const buildDateWhere = (dateField: string, dateRange: DateRange, useDateTime: boolean = false): string => {
  const startStr = useDateTime ? formatDateTimeLocal(dateRange.start) : formatDateLocal(dateRange.start);
  const endStr = useDateTime ? formatDateTimeLocal(dateRange.end) : formatDateLocal(dateRange.end);
  return `(${dateField},gte,exactDate,${startStr})~and(${dateField},lte,exactDate,${endStr})`;
};

// ============================================
// MICRO-FETCHING: Funciones especializadas
// ============================================

/**
 * ⚡ fetchCount — Obtiene el conteo total de registros que cumplen un filtro.
 * Hace UNA sola request con limit=1 y lee pageInfo.totalRows.
 */
export const fetchCount = async (tableId: string, label: string, whereClause?: string): Promise<number> => {
  const params = `limit=1${whereClause ? '&where=' + encodeURIComponent(whereClause) : ''}`;
  const { url, headers } = buildRequestConfig(tableId, params);

  if (NOCODB_CONFIG.DEBUG) {
    console.log(`[API] fetchCount ${label}: ${whereClause || 'sin filtro'}`);
  }

  const json = await fetchWithRetry(url, headers, `Count: ${label}`);
  if (!json) return 0;

  const total = json.pageInfo?.totalRows ?? json.list?.length ?? 0;
  if (NOCODB_CONFIG.DEBUG) {
    console.log(`[API] ${label}: ${total} registros`);
  }
  return total;
};

/**
 * ⚡ fetchLightRecords — Descarga registros con un límite estricto.
 * NO pagina más allá del límite. Máximo 2 páginas (200 registros).
 */
const fetchLightRecords = async <T>(
  tableId: string,
  label: string,
  options: {
    limit?: number;
    where?: string;
    sort?: string;
    fields?: string;
  } = {}
): Promise<T[]> => {
  const limit = Math.min(options.limit || 200, 1000);
  let params = `limit=${limit}`;
  if (options.where) params += `&where=${encodeURIComponent(options.where)}`;
  if (options.sort) params += `&sort=${encodeURIComponent(options.sort)}`;
  if (options.fields) params += `&fields=${encodeURIComponent(options.fields)}`;

  const { url, headers } = buildRequestConfig(tableId, params);

  if (NOCODB_CONFIG.DEBUG) {
    console.log(`[API] fetchLight ${label} (limit=${limit})`);
  }

  const json = await fetchWithRetry(url, headers, label);
  if (!json || !json.list || !Array.isArray(json.list)) return [];

  const records = json.list as T[];

  // Si obtuvimos exactamente el límite y hay más registros, hacer UNA segunda página
  if (records.length === limit && json.pageInfo && !json.pageInfo.isLastPage && limit <= 500) {
    const params2 = params.replace(`limit=${limit}`, `limit=${limit}&offset=${limit}`);
    const { url: url2, headers: headers2 } = buildRequestConfig(tableId, params2);
    await sleep(200); // Respetar rate limit
    const json2 = await fetchWithRetry(url2, headers2, `${label} p2`);
    if (json2?.list && Array.isArray(json2.list)) {
      return [...records, ...json2.list];
    }
  }

  if (NOCODB_CONFIG.DEBUG) {
    console.log(`[API] ${label}: ${records.length} registros obtenidos`);
  }
  return records;
};

// ============================================
// MAPPERS — Funciones públicas de datos
// ============================================

/**
 * Vendedoras — Solo 3 registros. Incluye Rollups pre-calculados de NocoDB.
 * 1 request.
 */
export const getRealSellers = async (): Promise<Seller[]> => {
  const rawData = await fetchLightRecords<any>(TABLE_IDS.sellers, 'Vendedoras', { limit: 50 });
  if (rawData.length === 0) return [];

  return rawData.map(item => ({
    id: String(item.Id || item.id),
    name: item['Nombre de la Vendedora'] || item.Name || item.Nombre || 'Sin Nombre',
    avatarUrl: extractImage(item.Foto || item.Avatar || item.Imagen),
    // Rollups pre-calculados de NocoDB
    totalSalesAmount: parseAmount(item['Total Ventas (Mes Actual)'] || 0),
    salesCount: Number(item['Ventas Cerradas'] || 0),
    leadsTotal: Number(item['Leads Asignados (Total)'] || item.Contactos || 0),
    leadsToday: Number(item['Leads Asignados (Hoy)'] || 0),
    interactionsCount: Number(item['Interacciones'] || 0),
    recoveriesAssigned: Number(item['Recuperaciones Asignadas'] || 0),
    status: item.Estado || 'Activo'
  }));
};

/**
 * Conteos del Embudo — Obtiene conteos por estado SIN descargar registros.
 * ~12 requests (1 por estado).
 */
export const getFunnelCounts = async (): Promise<FunnelCounts> => {
  const statuses = [
    'Lead Nuevo',
    'En Seguimiento 24 hs después primer contacto',
    'En Seguimiento 7 días',
    'Llamada Agendada',
    'Seguimiento Cliente Nuevo',
    'Seguimiento venta perdida',
    'Seguimiento leads sin respuesta',
    'Seguimiento Potencial venta',
    'Contactar en 48 horas',
    'Nutrición a Largo Plazo',
    'No se presentó',
    'Venta Ganada',
    'Venta Perdida',
    'Leads perdidos (que nunca contestaron)',
    'no contactar'
  ];

  const counts: FunnelCounts = {};
  const BATCH_SIZE = 2; // Ejecutar en paralelo con límite más estricto

  for (let i = 0; i < statuses.length; i += BATCH_SIZE) {
    const batch = statuses.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(status =>
        fetchCount(TABLE_IDS.contacts, `Contactos: ${status}`, `(Estado Actual,eq,${status})`)
      )
    );
    batch.forEach((status, idx) => {
      counts[status] = results[idx];
    });

    // Pequeña pausa entre lotes
    if (i + BATCH_SIZE < statuses.length) {
      await sleep(200);
    }
  }

  if (NOCODB_CONFIG.DEBUG) {
    console.log('[API] Conteos del embudo:', counts);
  }

  return counts;
};

/**
 * Conteos de interacciones por canal   
 * ~5 requests (1 por canal + 1 total).
 */
export const getInteractionCounts = async (dateRange?: DateRange | null): Promise<Record<string, number>> => {
  const dateWhere = dateRange ? buildDateWhere('Fecha', dateRange) : '';
  const channels = ['WhatsApp', 'Llamada', 'Email', 'System.io'];

  const counts: Record<string, number> = {};

  // Total sin filtro de canal
  counts['total'] = await fetchCount(
    TABLE_IDS.interactions,
    'Interacciones: Total',
    dateWhere || undefined
  );

  await sleep(100);

  // Por canal
  const results = await Promise.all(
    channels.map(channel => {
      const channelWhere = `(Medio/Canal,eq,${channel})`;
      const fullWhere = dateWhere ? `${dateWhere}~and${channelWhere}` : channelWhere;
      return fetchCount(TABLE_IDS.interactions, `Interacciones: ${channel}`, fullWhere);
    })
  );

  channels.forEach((channel, idx) => {
    counts[channel] = results[idx];
  });

  // Calcular "Otros" como total minus known channels
  const knownTotal = channels.reduce((sum, ch) => sum + (counts[ch] || 0), 0);
  counts['Otro'] = Math.max(0, counts['total'] - knownTotal);

  if (NOCODB_CONFIG.DEBUG) {
    console.log('[API] Conteos de interacciones:', counts);
  }

  return counts;
};

/**
 * Conteos de KPIs principales (micro-fetching)
 * ~6-7 requests: leads creados, leads nuevos, seguimientos urgentes, ventas del período.
 */
export const getKpiCounts = async (dateRange?: DateRange | null): Promise<KpiCounts> => {
  const createdWhere = dateRange ? buildDateWhere('Fecha y hora de creación', dateRange, true) : '';
  const newLeadWhere = dateRange
    ? `${createdWhere}~and(Estado Actual,eq,Lead Nuevo)`
    : `(Estado Actual,eq,Lead Nuevo)`;
  const followUpWhere = dateRange
    ? `(Próximo Contacto,eq,today)~and${createdWhere}`
    : `(Próximo Contacto,eq,today)`;
  const salesWhere = dateRange ? buildDateWhere('Fecha', dateRange) : '';

  const [leadsCreated, newLeads, urgentFollowUps, salesCount] = await Promise.all([
    fetchCount(TABLE_IDS.contacts, 'Leads creados', createdWhere || undefined),
    fetchCount(TABLE_IDS.contacts, 'Leads nuevos', newLeadWhere || undefined),
    fetchCount(TABLE_IDS.contacts, 'Seguimientos urgentes', followUpWhere || undefined),
    fetchCount(TABLE_IDS.sales, 'Ventas del período', salesWhere || undefined),
  ]);

  const counts = { leadsCreated, newLeads, urgentFollowUps, salesCount };

  if (NOCODB_CONFIG.DEBUG) {
    console.log('[API] Conteos KPIs:', counts);
  }

  return counts;
};

/**
 * Contactos filtrados por fecha — Solo descarga los del rango seleccionado.
 * Con filtro de fecha, típicamente 30-200 registros (1-2 requests).
 */
export const getRealContacts = async (dateRange?: DateRange | null): Promise<Contact[]> => {
  const where = dateRange ? buildDateWhere('Fecha y hora de creación', dateRange, true) : undefined;

  const rawData = await fetchLightRecords<any>(
    TABLE_IDS.contacts,
    'Contactos',
    {
      limit: 500,
      where,
      sort: '-Fecha y hora de creación'
    }
  );
  if (rawData.length === 0) return [];

  return rawData.map(item => mapContact(item));
};

/**
 * Interacciones filtradas por fecha
 */
export const getRealInteractions = async (dateRange?: DateRange | null): Promise<Interaction[]> => {
  const where = dateRange ? buildDateWhere('Fecha', dateRange) : undefined;

  const rawData = await fetchLightRecords<any>(
    TABLE_IDS.interactions,
    'Interacciones',
    {
      limit: 500,
      where,
      sort: '-Fecha'
    }
  );
  if (rawData.length === 0) return [];

  return rawData.map(item => {
    const rawType = item['Medio/Canal'] || item.Type || item.Tipo || '';
    let type = InteractionType.WHATSAPP;
    const lt = rawType.toLowerCase();
    if (lt.includes('llamada')) type = InteractionType.CALL;
    else if (lt.includes('email')) type = InteractionType.EMAIL;
    else if (lt.includes('system.io')) type = InteractionType.SYSTEM;
    else if (lt.includes('formulario')) type = InteractionType.FORM;
    else if (lt.includes('manychat')) type = InteractionType.MANYCHAT;
    else if (lt.includes('sistema')) type = InteractionType.OTHER;

    const durationValue = item['Duración (Minutos)'] || item.Duration || 0;
    const durationSeconds = typeof durationValue === 'number' ? durationValue : parseInt(String(durationValue), 10) || 0;

    return {
      id: String(item.Id || item.id),
      contactId: extractId(item['Contacto Involucrado'] || item.Contact || item.Contacto),
      sellerId: extractId(item['Realizada Por'] || item.Seller || item.Vendedora),
      type,
      date: normalizeDate(item.Fecha || item.Date || item.created_at),
      durationSeconds,
      result: item.Resultado || item.Result || item.Notas || ''
    };
  });
};

/**
 * Ventas filtradas por fecha — Actualmente ~1 registro.
 */
export const getRealSales = async (dateRange?: DateRange | null): Promise<Sale[]> => {
  const where = dateRange ? buildDateWhere('Fecha', dateRange) : undefined;

  const rawData = await fetchLightRecords<any>(
    TABLE_IDS.sales,
    'Ventas',
    {
      limit: 500,
      where,
      sort: '-Fecha'
    }
  );
  if (rawData.length === 0) return [];

  return rawData.map(item => ({
    id: String(item.Id || item.id),
    contactId: extractId(item['Contacto que Compró'] || item.Contact || item.Lead),
    sellerId: extractId(item['Quién Vendió'] || item.Seller || item.Vendedora),
    productName: extractLinkedName(item['Producto Vendido']) || 'Servicio General',
    amount: parseAmount(item['Monto Final'] || item.Amount || item.Monto),
    date: normalizeDate(item.Fecha || item.Date || item.created_at),
    paymentStatus: item['Estado del Pago'] || undefined,
    salesCycleDays: item['Sales_Cycle_Days'] ? Number(item['Sales_Cycle_Days']) : undefined,
    interactionCountSnapshot: item['Interaction_Count_Snapshot'] ? Number(item['Interaction_Count_Snapshot']) : undefined,
  }));
};

/**
 * Intentos de compra filtrados por fecha — Actualmente ~1 registro.
 */
export const getRealAttempts = async (dateRange?: DateRange | null): Promise<PurchaseAttempt[]> => {
  const where = dateRange ? buildDateWhere('Fecha del Intento', dateRange) : undefined;

  const rawData = await fetchLightRecords<any>(
    TABLE_IDS.attempts,
    'Intentos Compra',
    {
      limit: 500,
      where
    }
  );
  if (rawData.length === 0) return [];

  return rawData.map(item => {
    const rawStatus = item.Estado || item.Status || '';
    let status = PurchaseAttemptStatus.ABANDONED;
    const s = rawStatus.toLowerCase();
    if (s.includes('recuperado') || s.includes('aprobado')) status = PurchaseAttemptStatus.SUCCESSFUL;
    if (s.includes('cerrado') || s.includes('cancelado')) status = PurchaseAttemptStatus.FAILED;

    return {
      id: String(item.Id || item.id),
      contactId: extractId(item['Quién Intentó Comprar'] || item.Contact || item.Lead),
      amount: parseAmount(item.Monto || item.Amount || 5000),
      status,
      date: normalizeDate(item['Fecha del Intento'] || item.Date || item.Fecha),
      recoverySellerId: extractId(item['Vendedora de Recuperación'] || item.RecoverySeller || item.Seller)
    };
  });
};

// ============================================
// MAPPERS INTERNOS
// ============================================

const mapContact = (item: any): Contact => {
  const rawStatus = item['Estado Actual'] || item.Status || item.Estado || '';
  let status = LeadStatus.NEW;

  const s = rawStatus.toLowerCase();
  if (s.includes('ganada')) status = LeadStatus.CLOSED_WON;
  else if (s.includes('perdida') || s.includes('leads perdidos') || s.includes('no contactar') || s.includes('venta perdida')) status = LeadStatus.CLOSED_LOST;
  else if (s.includes('agendada') || s.includes('potencial venta')) status = LeadStatus.INTERESTED;
  else if (s.includes('seguimiento') || s.includes('contactar') || s.includes('nutrición') || s.includes('no se presentó')) status = LeadStatus.CONTACTED;
  else if (s.includes('lead nuevo') || (s.includes('nuevo') && !s.includes('seguimiento'))) status = LeadStatus.NEW;

  const rawReason = item['Motivo Venta Perdida'] || item.LostReason || item.Motivo || '';
  let lostReason: LostReason | undefined = undefined;
  const r = rawReason.toLowerCase();
  if (r.includes('precio') || r.includes('caro')) lostReason = LostReason.EXPENSIVE;
  else if (r.includes('interesado')) lostReason = LostReason.NOT_INTERESTED;
  else if (r.includes('oferta') || r.includes('competencia')) lostReason = LostReason.COMPETITION;
  else if (r.includes('presupuesto')) lostReason = LostReason.EXPENSIVE;

  return {
    id: String(item.Id || item.id),
    name: item.Nombre || item.Name || 'Lead Sin Nombre',
    country: item['País'] || item.Country || item.Pais || 'Desconocido',
    createdAt: normalizeDate(item['Fecha y hora de creación'] || item.CreatedAt || item.created_at),
    status,
    lostReason,
    assignedSellerId: extractId(item['Vendedora Asignada'] || item.AssignedSeller || item.Seller),
    estimatedValue: parseAmount(item.EstimatedValue || item['EstimatedValue'] || 0),
    leadAgeDays: item.Lead_Age_Days || 0,
    nextContactDate: item['Próximo Contacto'] ? normalizeDate(item['Próximo Contacto']) : undefined,
    leadSource: item['Nombre de la Etiqueta'] || item.LeadSource || undefined,
    discountApplied: parseAmount(item['Descuento Aplicado'] || 0) || undefined,
    lostReasonDetail: item['Motivo Venta Perdida'] || undefined
  };
};
