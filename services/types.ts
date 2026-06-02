/**
 * Tipos compartidos entre servicios, hooks y componentes.
 * Independientes de la fuente de datos (NocoDB / Supabase).
 */

export interface DateRange {
  start: Date;
  end: Date;
}

export interface FunnelCounts {
  [status: string]: number;
}

export interface FunnelRespondioRow {
  leads_nuevos: number;
  primer_mensaje: number;
  respondieron: number;
  interesados: number;
  venta_cerrada: number;
  venta_perdida: number;
  tiempo_resp_mediana_min: number | null;
}

export interface ResponsividadVendedoraRow {
  vendedora_id: string;
  vendedora_nombre: string | null;
  chats_respondidos: number;
  chats_sin_respuesta: number;
  resp_mediana_min: number | null;
}

export interface ResponsividadGeneralRow {
  vendedora_id: string | null;   // null = total del equipo
  vendedora_nombre: string | null;
  chats_con_tiempo: number;
  resp_mediana_min: number | null;
  b_menos_15: number;
  b_15_60: number;
  b_1_4h: number;
  b_mas_4h: number;
}

export interface PlantillaStatRow {
  template_name: string;
  shortcode: string | null;
  descripcion: string | null;
  enviados: number;
  fallidos: number;
  leidos: number;
  respondidos: number;
  // Tasas sobre base = enviados - fallidos (el status 'delivered' de Chatwoot es
  // poco confiable, así que NO reportamos "entrega"; ver migración 20).
  tasa_fallo: number | null;     // 0..1 — fallidos/enviados
  tasa_apertura: number | null;  // 0..1 — leidos/base (piso; read receipts off)
  tasa_respuesta: number | null; // 0..1 — respondidos/base
}

export interface EmbudoStage {
  id: 'leads' | 'primer_mensaje' | 'respondieron' | 'interesados' | 'venta_cerrada' | 'agendo';
  label: string;
  count: number | null;        // null = etapa "soon" (sin dato aún)
  pctOfLeads: number;          // count / leads_nuevos * 100, redondeado
  dropFromPrev: number | null; // % perdido vs etapa previa con dato; null en la primera
  star?: boolean;              // métrica clave (Respondieron)
  soon?: boolean;              // etapa futura (Calendly = Fase 3)
}
