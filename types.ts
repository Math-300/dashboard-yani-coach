// Enum Definitions based on PRD
export enum InteractionType {
  CALL = 'Llamada',
  WHATSAPP = 'WhatsApp',
  EMAIL = 'Email',
  SYSTEM = 'System.io',
  FORM = 'Formulario Web',
  MANYCHAT = 'ManyChat',
  OTHER = 'Otro'
}

export enum LeadStatus {
  NEW = 'Nuevo',
  CONTACTED = 'Contactado',
  INTERESTED = 'Interesado',
  CLOSED_WON = 'Venta Cerrada',
  CLOSED_LOST = 'Venta Perdida'
}

export enum LostReason {
  EXPENSIVE = 'Muy caro',
  NOT_INTERESTED = 'No interesado',
  NO_ANSWER = 'No contesta',
  COMPETITION = 'Competencia',
  TIMING = 'Mal momento',
  OTHER = 'Otro'
}

export enum PurchaseAttemptStatus {
  SUCCESSFUL = 'Exitoso',
  FAILED = 'Fallido',
  ABANDONED = 'Abandonado'
}

// Entity Interfaces
export interface Seller {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface Contact {
  id: string;
  name: string;
  country: string;
  createdAt: string; // ISO Date
  status: LeadStatus;
  lostReason?: LostReason;
  assignedSellerId: string;
  estimatedValue?: number; // Valor estimado del lead (de NocoDB)
  leadAgeDays?: number;    // Días de antigüedad del lead (de NocoDB)
  // Campos adicionales para el Resumen Ejecutivo
  nextContactDate?: string;  // Próximo contacto programado (ISO Date)
  leadSource?: string;       // Nombre de la Etiqueta / origen del lead
  discountApplied?: number;  // Descuento aplicado en la venta
  lostReasonDetail?: string; // Motivo Venta Perdida (texto original de NocoDB)
}

export interface Interaction {
  id: string;
  contactId: string;
  sellerId: string;
  type: InteractionType;
  date: string; // ISO Date
  durationSeconds?: number;
  result?: string;
}

export interface Sale {
  id: string;
  contactId: string;
  sellerId: string;
  productName: string;
  amount: number;
  date: string; // ISO Date
  paymentStatus?: string;      // Estado del Pago (Pagado, Pendiente, etc.)
  salesCycleDays?: number;     // Días del ciclo de venta
  interactionCountSnapshot?: number; // Snapshot de interacciones antes de comprar
}

export interface PurchaseAttempt {
  id: string;
  contactId: string;
  amount: number;
  status: PurchaseAttemptStatus;
  date: string;
  recoverySellerId?: string;
}

// Dashboard State Interface
export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

// ============================================
// TIPOS PARA DESEMPEÑO DE VENDEDORAS
// ============================================

/**
 * Métricas de desempeño de una vendedora
 */
export interface VendorPerformance {
  vendorId: string;
  vendorName: string;
  salesCount: number;         // Cantidad de ventas
  salesAmount: number;        // Monto total de ventas en COP
  conversionRate: number;     // Tasa de conversión (%)
  avgClosingDays: number;     // Días promedio de cierre
  activeLeads: number;        // Leads activos en pipeline
  interactions: number;       // Total de interacciones
  pendingFollowUps: number;   // Seguimientos pendientes
  rank?: number;              // Posición en el ranking
}

/**
 * Interacciones por vendedora y tipo
 */
export interface VendorInteractions {
  vendorId: string;
  vendorName: string;
  total: number;
  byType: {
    whatsapp: number;
    email: number;
    call: number;
    meeting: number;
    other: number;
  };
}

/**
 * Tasa de conversión por vendedora
 */
export interface VendorConversion {
  vendorId: string;
  vendorName: string;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
}

/**
 * Tiempo promedio de cierre por vendedora
 */
export interface VendorClosingTime {
  vendorId: string;
  vendorName: string;
  avgDays: number;
  salesCount: number;
}

/**
 * Leads activos por vendedora
 */
export interface VendorLeads {
  vendorId: string;
  vendorName: string;
  activeLeads: number;
  newLeads: number;
  contactedLeads: number;
  interestedLeads: number;
}

/**
 * Seguimientos pendientes por vendedora
 */
export interface VendorFollowUps {
  vendorId: string;
  vendorName: string;
  today: number;        // Pendientes para hoy
  overdue: number;      // Vencidos (fecha < hoy)
  upcoming: number;     // Próximos (fecha > hoy)
  total: number;        // Total pendientes
}

// ============================================
// TIPOS PARA PIPELINE & ACTIVIDAD
// ============================================

/**
 * Distribución de leads por estado
 */
export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

/**
 * Análisis de motivos de venta perdida
 */
export interface LostReasonAnalysis {
  reason: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Distribución de leads por origen/fuente
 */
export interface SourceDistribution {
  source: string;
  count: number;
  percentage: number;
}

/**
 * Distribución de leads por país
 */
export interface CountryDistribution {
  country: string;
  count: number;
  percentage: number;
}

/**
 * Distribución de interacciones por canal
 */
export interface ChannelDistribution {
  channel: string;
  count: number;
  percentage: number;
}

/**
 * Distribución de resultados de interacciones
 */
export interface ResultDistribution {
  result: string;
  count: number;
  percentage: number;
}

// ============================================
// TIPOS PARA CALIDAD & RECUPERACIÓN
// ============================================

/**
 * Distribución de intentos de compra por estado
 */
export interface AttemptStatusDistribution {
  status: string;
  count: number;
  percentage: number;
  totalValue: number;
}

/**
 * Métricas de recuperación de intentos fallidos/abandonados
 */
export interface RecoveryMetrics {
  totalRecoverable: number;      // Total intentos recuperables
  recovered: number;             // Intentos recuperados
  recoveryRate: number;          // Tasa de recuperación %
  potentialValue: number;        // Valor potencial a recuperar
  recoveredValue: number;        // Valor efectivamente recuperado
}

/**
 * Recuperación por vendedora
 */
export interface VendorRecovery {
  vendorId: string;
  vendorName: string;
  assignedAttempts: number;      // Intentos asignados
  recoveredAttempts: number;    // Intentos recuperados
  recoveryRate: number;         // Tasa de recuperación %
  recoveredValue: number;       // Valor recuperado
}

/**
 * Datos de tendencia de intentos de compra
 */
export interface AttemptTrendData {
  period: string;
  date: string;
  successful: number;
  failed: number;
  abandoned: number;
}
