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
