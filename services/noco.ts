import { NOCODB_CONFIG } from '../config';
import { Seller, Sale, Contact, Interaction, LeadStatus, InteractionType, PurchaseAttempt, PurchaseAttemptStatus, LostReason } from '../types';

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
const extractLinkedName = (field: any, fieldName: string = 'title'): string => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (Array.isArray(field) && field.length > 0) {
    return extractLinkedName(field[0], fieldName);
  }
  if (typeof field === 'object' && field.fields) {
    const keys = Object.keys(field.fields).filter(k => k.toLowerCase() !== 'id');
    if (keys.length > 0) {
      return field.fields[keys[0]] || '';
    }
  }
  return '';
};

const normalizeDate = (date: any): string => {
  if (!date) return new Date(0).toISOString();
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }
  return parsed.toISOString();
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

// --- CLIENTE HTTP DEL API DE VERCEL ---
// ✅ SEGURO: El token está en las variables de entorno de Vercel

const fetchFromProxy = async <T>(endpoint: string, label: string): Promise<T[]> => {
  // En Vercel, el API está en el mismo dominio
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const apiUrl = baseUrl ? `${baseUrl}/api/nocodb/${endpoint}` : `/api/nocodb/${endpoint}`;

  let allRecords: T[] = [];
  let page = 1;
  let isLastPage = false;
  const limit = 1000;

  try {
    while (!isLastPage) {
      const url = `${apiUrl}?limit=${limit}&offset=${(page - 1) * limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`[API] Error ${response.status} obteniendo ${label}`);
        break;
      }

      const json: ProxyResponse<T> = await response.json();

      if (page === 1 && json.list?.length > 0) {
        console.log(`[API Debug] ${label}: ${json.list.length} registros`);
      }

      if (json.list && Array.isArray(json.list)) {
        allRecords = [...allRecords, ...json.list];
      } else {
        break;
      }

      if (json.pageInfo?.isLastPage || !json.list || json.list.length < limit) {
        isLastPage = true;
      } else {
        page++;
      }

      if (page > 10) break;
    }

    return allRecords;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`[API] Fallo crítico obteniendo ${label}: ${msg}`);
    return [];
  }
};

// --- MAPPERS ---

export const getRealSellers = async (): Promise<Seller[]> => {
  const rawData = await fetchFromProxy<any>('sellers', 'Vendedoras');
  if (rawData.length === 0) return [];

  return rawData.map(item => ({
    id: String(item.Id || item.id),
    name: item['Nombre de la Vendedora'] || item.Name || item.Nombre || 'Sin Nombre',
    avatarUrl: extractImage(item.Foto || item.Avatar || item.Imagen)
  }));
};

export const getRealContacts = async (): Promise<Contact[]> => {
  const rawData = await fetchFromProxy<any>('contacts', 'Contactos');
  if (rawData.length === 0) return [];

  return rawData.map(item => {
    const rawStatus = item['Estado Actual'] || item.Status || item.Estado || '';
    let status = LeadStatus.NEW;

    const s = rawStatus.toLowerCase();
    if (s.includes('nuevo') && !s.includes('seguimiento')) status = LeadStatus.NEW;
    else if (s.includes('ganada')) status = LeadStatus.CLOSED_WON;
    else if (s.includes('perdida') || s.includes('leads perdidos') || s.includes('no contactar')) status = LeadStatus.CLOSED_LOST;
    else if (s.includes('agendada') || s.includes('potencial venta')) status = LeadStatus.INTERESTED;
    else if (s.includes('seguimiento') || s.includes('contactar') || s.includes('nutrición') || s.includes('no se presentó')) status = LeadStatus.CONTACTED;
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
      assignedSellerId: extractId(item['Vendedora Asignada'] || item.AssignedSeller || item.Seller)
    };
  });
};

export const getRealInteractions = async (): Promise<Interaction[]> => {
  const rawData = await fetchFromProxy<any>('interactions', 'Interacciones');
  if (rawData.length === 0) return [];

  return rawData.map(item => {
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
    const durationSeconds = typeof durationValue === 'number' ? durationValue : parseInt(durationValue) || 0;

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
};

export const getRealSales = async (): Promise<Sale[]> => {
  const rawData = await fetchFromProxy<any>('sales', 'Ventas');
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

export const getRealAttempts = async (): Promise<PurchaseAttempt[]> => {
  const rawData = await fetchFromProxy<any>('attempts', 'Intentos Compra');
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
