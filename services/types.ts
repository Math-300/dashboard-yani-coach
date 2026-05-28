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
  resp_mediana_min: number | null;
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
