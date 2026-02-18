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
