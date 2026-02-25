import { NOCODB_CONFIG, TABLE_IDS } from '../config';
import { Seller, Sale, Contact, Interaction, LeadStatus, InteractionType, PurchaseAttempt, PurchaseAttemptStatus, LostReason } from '../types';

// Tipo para el rango de fechas usado en el filtrado del servidor
export interface DateRange {
  start: Date;
  end: Date;
}

// Tipos internos para la respuesta del proxy
interface ProxyResponse<T> {
  list: T[];
  pageInfo?: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

// --- HELPERS ROBUSTOS ---

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

// Helper para extraer URL de imagen
const extractImage = (field: any): string | undefined => {
  if (Array.isArray(field) && field.length > 0) {
    return field[0].signedUrl || field[0].url;
  }
  return typeof field === 'string' && field.startsWith('http') ? field : undefined;
};

// Helper para extraer nombre de un registro vinculado
// NocoDB devuelve los registros vinculados con estructura: { id, fields: { "Nombre del Producto": "..." } }
const extractLinkedName = (field: any, fieldName: string = 'title'): string => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (Array.isArray(field) && field.length > 0) {
    return extractLinkedName(field[0], fieldName);
  }
  if (typeof field === 'object') {
    // Caso 1: Tiene campo fields (estructura normal de NocoDB)
    if (field.fields) {
      // Buscar campos comunes de nombre en orden de prioridad
      const nameFields = ['Nombre del Producto', 'Nombre de la Vendedora', 'Nombre', 'Title', 'title', 'Name', 'name'];
      for (const nameField of nameFields) {
        if (field.fields[nameField]) {
          return String(field.fields[nameField]);
        }
      }
      // Fallback: primer campo que no sea 'id' o 'Id'
      const keys = Object.keys(field.fields).filter(k => k.toLowerCase() !== 'id');
      if (keys.length > 0) {
        return field.fields[keys[0]] || '';
      }
    }
    // Caso 2: El objeto tiene propiedades directas (sin fields)
    const directKeys = Object.keys(field).filter(k => k.toLowerCase() !== 'id');
    if (directKeys.length > 0) {
      return String(field[directKeys[0]] || '');
    }
  }
  return '';
};

const normalizeDate = (date: any): string => {
  if (!date) return new Date(0).toISOString();

  const originalDate = date;
  let parsed: Date;

  // 🔧 FIX: NocoDB puede devolver fechas en diferentes formatos:
  // 1. ISO con timezone: "2026-02-19T15:30:00Z" (UTC)
  // 2. ISO sin timezone: "2026-02-19T15:30:00" (interpretado como hora local por JS)
  // 3. Solo fecha: "2026-02-19" (medianoche hora local)

  if (typeof date === 'string') {
    // Si la fecha no termina en 'Z' y no tiene offset de timezone (+/-HH:MM)
    // asumimos que NocoDB la envió en UTC y necesitamos agregar la 'Z'
    if (!date.endsWith('Z') && !date.includes('+') && !date.includes('T')) {
      // Formato "2026-02-19" - agregar tiempo y Z
      parsed = new Date(date + 'T00:00:00Z');
    } else if (!date.endsWith('Z') && !date.includes('+') && date.includes('T')) {
      // Formato "2026-02-19T15:30:00" sin Z - asumir UTC
      parsed = new Date(date + 'Z');
    } else {
      parsed = new Date(date);
    }
  } else {
    parsed = new Date(date);
  }

  if (isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }

  return parsed.toISOString();
};

/**
 * Helper para comparar fechas considerando zona horaria local.
 * NocoDB almacena fechas en UTC, pero queremos comparar en hora local (America/Bogota).
 * 
 * @param dateToCheck - Fecha a verificar (ISO string de NocoDB, en UTC)
 * @param localStart - Fecha de inicio en hora local
 * @param localEnd - Fecha de fin en hora local
 * @returns true si la fecha está dentro del rango (comparando en hora local)
 */
export const isDateInRange = (
  dateToCheck: string,
  localStart: Date,
  localEnd: Date
): boolean => {
  const date = new Date(dateToCheck);

  if (isNaN(date.getTime())) {
    return false;
  }

  // Comparar timestamps
  const dateTime = date.getTime();
  const startTime = localStart.getTime();
  const endTime = localEnd.getTime();

  return dateTime >= startTime && dateTime <= endTime;
};

const parseAmount = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  if (typeof val === 'string') {
    const clean = val.replace(/[^0-9.-]+/g, '');
    return parseFloat(clean) || 0;
  }
  return 0;
};

// --- FILTRADO EN EL SERVIDOR ---

/**
 * Mapeo de campos de fecha por endpoint/tabla.
 * Cada tabla puede tener un campo de fecha diferente.
 */
const DATE_FIELD_MAP: Record<string, string> = {
  contacts: 'Fecha y hora de creación',  // Contactos: fecha de creación
  interactions: 'Fecha',                  // Interacciones: fecha de la interacción
  sales: 'Fecha',                         // Ventas: fecha de la venta
  attempts: 'Fecha del Intento',          // Intentos de compra: fecha del intento
  sellers: ''                             // Vendedoras: no tienen filtro de fecha
};

/**
 * Construye una cláusula WHERE para filtrar por rango de fechas.
 * 
 * @param dateRange - Rango de fechas { start, end }
 * @param endpoint - Nombre del endpoint para determinar el campo de fecha
 * @returns String con la cláusula WHERE codificada o null si no hay filtro
 * 
 * @example
 * buildWhereClause({ start: new Date('2024-01-01'), end: new Date('2024-01-31') }, 'sales')
 * // Returns: "(Fecha,gte,exactDate,2024-01-01)~and(Fecha,lte,exactDate,2024-01-31)"
 */
const buildWhereClause = (dateRange: DateRange | null, endpoint: string): string | null => {
  if (!dateRange) return null;

  const dateField = DATE_FIELD_MAP[endpoint];
  if (!dateField) return null; // No filtrar si no hay campo de fecha definido

  // Formatear fechas como YYYY-MM-DD usando la fecha local (no UTC)
  // Esto evita problemas de timezone donde toISOString() puede cambiar el día
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startStr = formatDateLocal(dateRange.start);
  const endStr = formatDateLocal(dateRange.end);

  // Construir cláusula WHERE con sub-operador exactDate para NocoDB
  // Formato: (campo,gte,exactDate,fecha_inicio)~and(campo,lte,exactDate,fecha_fin)
  return `(${dateField},gte,exactDate,${startStr})~and(${dateField},lte,exactDate,${endStr})`;
};

// --- CLIENTE HTTP DEL API DE VERCEL ---
// ✅ SEGURO: El token está en las variables de entorno de Vercel
// ✅ LOCAL: En desarrollo, puede conectarse directamente a NocoDB

// Mapeo de endpoints a IDs de tabla
const ENDPOINT_TO_TABLE: Record<string, string> = {
  sellers: TABLE_IDS.sellers,
  contacts: TABLE_IDS.contacts,
  interactions: TABLE_IDS.interactions,
  sales: TABLE_IDS.sales,
  attempts: TABLE_IDS.attempts
};

const fetchFromProxy = async <T>(endpoint: string, label: string, dateRange?: DateRange | null): Promise<T[]> => {
  let allRecords: T[] = [];
  let page = 1;
  let isLastPage = false;
  const limit = 100;  // NocoDB máximo real por página

  // Determinar el modo de conexión:
  // 1. Proxy de Vite (desarrollo local cuando el navegador no puede resolver DNS)
  // 2. Conexión directa a NocoDB (desarrollo local con credenciales)
  // 3. Proxy de Vercel (producción)
  const useViteProxy = NOCODB_CONFIG.USE_VITE_PROXY;
  const useDirectConnection = NOCODB_CONFIG.IS_DEV && NOCODB_CONFIG.HAS_DIRECT_CREDENTIALS && !useViteProxy;

  // ✅ CORREGIDO: Ordenar por fecha descendente para que los registros más recientes
  // aparezcan primero. Esto es crítico para que los leads del día de hoy se muestren
  // en la primera página sin necesidad de paginación completa.
  // NocoDB API v2 usa el parámetro 'sort' con prefijo '-' para descendente
  const getSortParam = (endpoint: string): string => {
    switch (endpoint) {
      case 'contacts':
        return '&sort=-Fecha%20y%20hora%20de%20creación'; // Contactos: más recientes primero
      case 'interactions':
        return '&sort=-Fecha'; // Interacciones: más recientes primero
      case 'sales':
        return '&sort=-Fecha'; // Ventas: más recientes primero
      default:
        return ''; // Otras tablas no necesitan ordenamiento especial
    }
  };

  // 🚀 NUEVO: Construir cláusula WHERE para filtrado en el servidor
  const whereClause = buildWhereClause(dateRange || null, endpoint);
  const whereParam = whereClause ? `&where=${encodeURIComponent(whereClause)}` : '';

  // Log informativo sobre el filtrado
  if (dateRange && NOCODB_CONFIG.DEBUG) {
    const startStr = dateRange.start.toISOString().split('T')[0];
    const endStr = dateRange.end.toISOString().split('T')[0];
    console.log(`[API] Filtrando ${label} en servidor: ${startStr} a ${endStr}`);
  }

  try {
    while (!isLastPage) {
      let url: string;
      let headers: Record<string, string> = {};

      if (useViteProxy) {
        // Proxy de Vite (desarrollo local)
        // El proxy inyecta el token xc-token desde el servidor
        const tableId = ENDPOINT_TO_TABLE[endpoint];
        if (!tableId) {
          console.error(`[API] No se encontró ID de tabla para endpoint: ${endpoint}`);
          return [];
        }
        // El proxy reescribe /api/nocodb/{tableId} -> https://app.nocodb.com/api/v2/tables/{tableId}
        url = `/api/nocodb/${tableId}/records?limit=${limit}&offset=${(page - 1) * limit}${getSortParam(endpoint)}${whereParam}`;
        // NO enviar token desde el cliente - el proxy lo inyecta
        headers = {
          'Content-Type': 'application/json'
        };
        if (NOCODB_CONFIG.DEBUG) {
          console.log(`[API] Usando PROXY de Vite para ${label}`);
        }
      } else if (useDirectConnection) {
        // Conexión directa a NocoDB (solo en desarrollo local)
        const tableId = ENDPOINT_TO_TABLE[endpoint];
        if (!tableId) {
          console.error(`[API] No se encontró ID de tabla para endpoint: ${endpoint}`);
          return [];
        }
        url = `${NOCODB_CONFIG.BASE_URL}/api/v2/tables/${tableId}/records?limit=${limit}&offset=${(page - 1) * limit}${getSortParam(endpoint)}${whereParam}`;
        headers = {
          'xc-token': NOCODB_CONFIG.TOKEN || '',
          'Content-Type': 'application/json'
        };
        if (NOCODB_CONFIG.DEBUG) {
          console.log(`[API] Conexión DIRECTA a NocoDB para ${label}`);
        }
      } else {
        // Proxy de Vercel (producción)
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        url = baseUrl ? `${baseUrl}/api/nocodb/${endpoint}?limit=${limit}&offset=${(page - 1) * limit}${getSortParam(endpoint)}${whereParam}` : `/api/nocodb/${endpoint}?limit=${limit}&offset=${(page - 1) * limit}${getSortParam(endpoint)}${whereParam}`;
        if (NOCODB_CONFIG.DEBUG) {
          console.log(`[API] Usando PROXY de Vercel para ${label}`);
        }
      }

      if (NOCODB_CONFIG.DEBUG) {
        console.log(`[API] Fetching ${label} from: ${url.replace(/xc-token=[^&]+/, 'xc-token=***')}`);
        console.log(`[API] Modo conexión ${label}:`, {
          useViteProxy,
          useDirectConnection,
          hasToken: Boolean(NOCODB_CONFIG.TOKEN),
          baseUrl: NOCODB_CONFIG.BASE_URL
        });
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API] Error ${response.status} obteniendo ${label}: ${errorText.substring(0, 200)}`);

        // Intentar parsear como JSON para obtener más detalles
        try {
          const errorJson = JSON.parse(errorText);
          console.error(`[API] Detalles del error:`, errorJson);
        } catch {
          console.error(`[API] Respuesta no es JSON válido. Posible error de routing.`);
        }
        break;
      }

      // Verificar que la respuesta sea JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error(`[API] Respuesta no es JSON. Content-Type: ${contentType}`);
        console.error(`[API] Primeros 200 caracteres: ${textResponse.substring(0, 200)}`);
        break;
      }

      const json: ProxyResponse<T> = await response.json();

      if (page === 1 && NOCODB_CONFIG.DEBUG) {
        console.log(`[API] ${label}: ${json.list?.length || 0} registros recibidos (página 1)`);
      }

      if (json.list && Array.isArray(json.list)) {
        allRecords = [...allRecords, ...json.list];
      } else {
        console.warn(`[API] ${label}: Respuesta sin lista válida`);
        break;
      }

      // ✅ CORREGIDO: Usar solo pageInfo.isLastPage para detectar última página
      // NocoDB tiene un límite interno de 100 registros, ignorando nuestro limit=1000
      if (json.pageInfo?.isLastPage === true) {
        isLastPage = true;
      } else if (!json.list || json.list.length === 0) {
        isLastPage = true;
      } else {
        page++;
      }

      if (page > 500) {
        console.warn(`[API] ${label}: Límite de 500 páginas alcanzado`);
        break;
      }
    }

    if (NOCODB_CONFIG.DEBUG) {
      console.log(`[API] ${label}: Total ${allRecords.length} registros obtenidos`);
    }
    return allRecords;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`[API] Fallo crítico obteniendo ${label}: ${msg}`);
    console.error(`[API] Stack:`, error instanceof Error ? error.stack : 'N/A');
    return [];
  }
};

// --- MAPPERS ---

export const getRealSellers = async (): Promise<Seller[]> => {
  // Las vendedoras no se filtran por fecha
  const rawData = await fetchFromProxy<any>('sellers', 'Vendedoras');
  if (rawData.length === 0) return [];

  return rawData.map(item => ({
    id: String(item.Id || item.id),
    name: item['Nombre de la Vendedora'] || item.Name || item.Nombre || 'Sin Nombre',
    avatarUrl: extractImage(item.Foto || item.Avatar || item.Imagen)
  }));
};

/**
 * Obtiene contactos con estados específicos para el embudo de ventas.
 * No filtra por fecha, solo por estado.
 * 
 * @param statuses - Lista de estados a filtrar (ej: ['Venta Ganada', 'Venta Perdida'])
 */
export const getRealContactsByStatus = async (statuses: string[]): Promise<Contact[]> => {
  // Construir cláusula WHERE para filtrar por estados
  // Formato NocoDB: (Estado Actual,in,status1,status2,status3)
  // Los valores con espacios deben ir sin comillas en NocoDB
  const whereClause = `(Estado Actual,in,${statuses.join(',')})`;
  const whereParam = `&where=${encodeURIComponent(whereClause)}`;

  if (NOCODB_CONFIG.DEBUG) {
    console.log('[API] Buscando contactos con estados:', statuses.join(', '));
    console.log('[API] WHERE clause:', whereClause);
  }

  const rawData = await fetchFromProxyWithWhere<any>('contacts', 'Contactos por Estado', whereParam);
  if (rawData.length === 0) return [];

  // Usar el mismo mapper que getRealContacts
  return rawData.map(item => {
    const rawStatus = item['Estado Actual'] || item.Status || item.Estado || '';
    let status = LeadStatus.NEW;

    const s = rawStatus.toLowerCase();
    if (s.includes('ganada')) status = LeadStatus.CLOSED_WON;
    else if (s.includes('perdida') || s.includes('leads perdidos') || s.includes('no contactar') || s.includes('venta perdida')) status = LeadStatus.CLOSED_LOST;
    else if (s.includes('agendada') || s.includes('potencial venta')) status = LeadStatus.INTERESTED;
    else if (s.includes('seguimiento') || s.includes('contactar') || s.includes('nutrición') || s.includes('no se presentó')) status = LeadStatus.CONTACTED;
    else if (s.includes('nuevo') && !s.includes('seguimiento')) status = LeadStatus.NEW;
    else status = LeadStatus.NEW;

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
      status: status,
      lostReason: lostReason,
      assignedSellerId: extractId(item['Vendedora Asignada'] || item.AssignedSeller || item.Seller),
      estimatedValue: parseAmount(item.EstimatedValue || item['EstimatedValue'] || 0),
      leadAgeDays: item.Lead_Age_Days || 0,
      nextContactDate: item['Próximo Contacto'] ? normalizeDate(item['Próximo Contacto']) : undefined,
      leadSource: item['Nombre de la Etiqueta'] || item.LeadSource || undefined,
      discountApplied: parseAmount(item['Descuento Aplicado'] || 0) || undefined,
      lostReasonDetail: item['Motivo Venta Perdida'] || undefined
    };
  });
};

/**
 * Helper para fetch con cláusula WHERE personalizada
 */
const fetchFromProxyWithWhere = async <T>(endpoint: string, label: string, whereParam: string): Promise<T[]> => {
  let allRecords: T[] = [];
  let page = 1;
  let isLastPage = false;
  const limit = 100;

  const useViteProxy = NOCODB_CONFIG.USE_VITE_PROXY;
  const useDirectConnection = NOCODB_CONFIG.IS_DEV && NOCODB_CONFIG.HAS_DIRECT_CREDENTIALS && !useViteProxy;

  const getSortParam = (endpoint: string): string => {
    switch (endpoint) {
      case 'contacts':
        return '&sort=-Fecha%20y%20hora%20de%20creación';
      default:
        return '';
    }
  };

  try {
    while (!isLastPage) {
      let url: string;
      let headers: Record<string, string> = {};

      if (useViteProxy) {
        const tableId = ENDPOINT_TO_TABLE[endpoint];
        if (!tableId) return [];
        url = `/api/nocodb/${tableId}/records?limit=${limit}&offset=${(page - 1) * limit}${getSortParam(endpoint)}${whereParam}`;
        headers = { 'Content-Type': 'application/json' };
      } else if (useDirectConnection) {
        const tableId = ENDPOINT_TO_TABLE[endpoint];
        if (!tableId) return [];
        url = `${NOCODB_CONFIG.BASE_URL}/api/v2/tables/${tableId}/records?limit=${limit}&offset=${(page - 1) * limit}${getSortParam(endpoint)}${whereParam}`;
        headers = { 'xc-token': NOCODB_CONFIG.TOKEN || '', 'Content-Type': 'application/json' };
      } else {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        url = baseUrl ? `${baseUrl}/api/nocodb/${endpoint}?limit=${limit}&offset=${(page - 1) * limit}${getSortParam(endpoint)}${whereParam}` : `/api/nocodb/${endpoint}?limit=${limit}&offset=${(page - 1) * limit}${getSortParam(endpoint)}${whereParam}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error(`[API] Error ${response.status} obteniendo ${label}`);
        break;
      }

      const json: ProxyResponse<T> = await response.json();

      if (json.list && Array.isArray(json.list)) {
        allRecords = [...allRecords, ...json.list];
      } else {
        break;
      }

      if (json.pageInfo?.isLastPage === true || !json.list || json.list.length === 0) {
        isLastPage = true;
      } else {
        page++;
      }

      if (page > 500) break;
    }

    if (NOCODB_CONFIG.DEBUG) {
      console.log(`[API] ${label}: Total ${allRecords.length} registros obtenidos`);
    }
    return allRecords;
  } catch (error) {
    console.error(`[API] Fallo obteniendo ${label}:`, error);
    return [];
  }
};

export const getRealContacts = async (dateRange?: DateRange | null): Promise<Contact[]> => {
  const rawData = await fetchFromProxy<any>('contacts', 'Contactos', dateRange);
  if (rawData.length === 0) return [];

  const statusCounts: Record<string, number> = {};
  const lostReasonCounts: Record<string, number> = {};

  const mapped = rawData.map(item => {
    const rawStatus = item['Estado Actual'] || item.Status || item.Estado || '';
    let status = LeadStatus.NEW;

    const s = rawStatus.toLowerCase();
    if (s.includes('ganada')) status = LeadStatus.CLOSED_WON;
    else if (s.includes('perdida') || s.includes('leads perdidos') || s.includes('no contactar') || s.includes('venta perdida')) status = LeadStatus.CLOSED_LOST;
    else if (s.includes('agendada') || s.includes('potencial venta')) status = LeadStatus.INTERESTED;
    else if (s.includes('seguimiento') || s.includes('contactar') || s.includes('nutrición') || s.includes('no se presentó')) status = LeadStatus.CONTACTED;
    else if (s.includes('nuevo') && !s.includes('seguimiento')) status = LeadStatus.NEW;
    else status = LeadStatus.NEW;

    const rawReason = item['Motivo Venta Perdida'] || item.LostReason || item.Motivo || '';
    let lostReason: LostReason | undefined = undefined;
    const r = rawReason.toLowerCase();
    if (r.includes('precio') || r.includes('caro')) lostReason = LostReason.EXPENSIVE;
    else if (r.includes('interesado')) lostReason = LostReason.NOT_INTERESTED;
    else if (r.includes('oferta') || r.includes('competencia')) lostReason = LostReason.COMPETITION;
    else if (r.includes('presupuesto')) lostReason = LostReason.EXPENSIVE;

    const statusKey = status;
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    if (lostReason) {
      lostReasonCounts[lostReason] = (lostReasonCounts[lostReason] || 0) + 1;
    }

    return {
      id: String(item.Id || item.id),
      name: item.Nombre || item.Name || 'Lead Sin Nombre',
      country: item['País'] || item.Country || item.Pais || 'Desconocido',
      createdAt: normalizeDate(item['Fecha y hora de creación'] || item.CreatedAt || item.created_at),
      status: status,
      lostReason: lostReason,
      assignedSellerId: extractId(item['Vendedora Asignada'] || item.AssignedSeller || item.Seller),
      estimatedValue: parseAmount(item.EstimatedValue || item['EstimatedValue'] || 0),
      leadAgeDays: item.Lead_Age_Days || 0,
      // Campos adicionales para el Resumen Ejecutivo
      nextContactDate: item['Próximo Contacto'] ? normalizeDate(item['Próximo Contacto']) : undefined,
      leadSource: item['Nombre de la Etiqueta'] || item.LeadSource || undefined,
      discountApplied: parseAmount(item['Descuento Aplicado'] || 0) || undefined,
      lostReasonDetail: item['Motivo Venta Perdida'] || undefined
    };
  });

  if (NOCODB_CONFIG.DEBUG) {
    console.log('[MAP] Contactos por estado:', statusCounts);
    console.log('[MAP] Contactos por motivo de pérdida:', lostReasonCounts);
  }

  return mapped;
};

export const getRealInteractions = async (dateRange?: DateRange | null): Promise<Interaction[]> => {
  const rawData = await fetchFromProxy<any>('interactions', 'Interacciones', dateRange);
  if (rawData.length === 0) return [];

  const typeCounts: Record<string, number> = {};
  const durationNaN: { count: number } = { count: 0 };

  const mapped = rawData.map(item => {
    const rawType = item['Medio/Canal'] || item.Type || item.Tipo || '';
    let type = InteractionType.WHATSAPP;
    const lowerType = rawType.toLowerCase();

    if (lowerType.includes('llamada')) type = InteractionType.CALL;
    else if (lowerType.includes('email')) type = InteractionType.EMAIL;
    else if (lowerType.includes('system.io')) type = InteractionType.SYSTEM;
    else if (lowerType.includes('formulario')) type = InteractionType.FORM;
    else if (lowerType.includes('manychat')) type = InteractionType.MANYCHAT;
    else if (lowerType.includes('sistema')) type = InteractionType.OTHER;

    const durationValue = item['Duración (Minutos)'] || item.Duration || 0;
    const durationSeconds = typeof durationValue === 'number'
      ? durationValue
      : parseInt(String(durationValue), 10) || 0;
    if (!Number.isFinite(durationSeconds)) {
      durationNaN.count += 1;
    }

    typeCounts[type] = (typeCounts[type] || 0) + 1;

    return {
      id: String(item.Id || item.id),
      contactId: extractId(item['Contacto Involucrado'] || item.Contact || item.Contacto),
      sellerId: extractId(item['Realizada Por'] || item.Seller || item.Vendedora),
      type: type,
      date: normalizeDate(item.Fecha || item.Date || item.created_at),
      durationSeconds: durationSeconds,
      result: item.Resultado || item.Result || item.Notas || ''
    };
  });

  if (NOCODB_CONFIG.DEBUG) {
    console.log('[MAP] Interacciones por tipo:', typeCounts);
  }

  return mapped;
};

export const getRealSales = async (dateRange?: DateRange | null): Promise<Sale[]> => {
  const rawData = await fetchFromProxy<any>('sales', 'Ventas', dateRange);
  if (rawData.length === 0) return [];

  return rawData.map(item => {
    const productName = extractLinkedName(item['Producto Vendido']) || 'Servicio General';
    const contactId = extractId(item['Contacto que Compró'] || item.Contact || item.Lead);

    return {
      id: String(item.Id || item.id),
      contactId: contactId,
      sellerId: extractId(item['Quién Vendió'] || item.Seller || item.Vendedora),
      productName: productName,
      amount: parseAmount(item['Monto Final'] || item.Amount || item.Monto),
      date: normalizeDate(item.Fecha || item.Date || item.created_at),
      paymentStatus: item['Estado del Pago'] || undefined,
      salesCycleDays: item['Sales_Cycle_Days'] ? Number(item['Sales_Cycle_Days']) : undefined,
      interactionCountSnapshot: item['Interaction_Count_Snapshot'] ? Number(item['Interaction_Count_Snapshot']) : undefined,
    };
  });
};

export const getRealAttempts = async (dateRange?: DateRange | null): Promise<PurchaseAttempt[]> => {
  const rawData = await fetchFromProxy<any>('attempts', 'Intentos Compra', dateRange);
  if (rawData.length === 0) return [];

  return rawData.map(item => {
    const rawStatus = item.Estado || item.Status || '';
    let status = PurchaseAttemptStatus.ABANDONED;
    if (rawStatus.toLowerCase().includes('recuperado') || rawStatus.toLowerCase().includes('aprobado')) status = PurchaseAttemptStatus.SUCCESSFUL;
    if (rawStatus.toLowerCase().includes('cerrado') || rawStatus.toLowerCase().includes('cancelado')) status = PurchaseAttemptStatus.FAILED;

    return {
      id: String(item.Id || item.id),
      contactId: extractId(item['Quién Intentó Comprar'] || item.Contact || item.Lead),
      amount: parseAmount(item.Monto || item.Amount || 5000),
      status: status,
      date: normalizeDate(item['Fecha del Intento'] || item.Date || item.Fecha),
      recoverySellerId: extractId(item['Vendedora de Recuperación'] || item.RecoverySeller || item.Seller)
    };
  });
};
