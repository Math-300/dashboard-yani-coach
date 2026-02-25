import {
  Seller, Contact, Interaction, Sale, PurchaseAttempt,
  LeadStatus, InteractionType, LostReason, PurchaseAttemptStatus
} from '../types';
import {
  getRealSellers,
  getRealSales,
  getRealContacts,
  getRealInteractions,
  getRealAttempts
} from './noco';
import { isApiConfigured, NOCODB_CONFIG } from '../config';

// --- UTILIDADES PARA CARGA OPTIMIZADA ---

/**
 * Delay en milisegundos
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ejecuta una función con reintentos y backoff exponencial
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const isRetryable = error?.message?.includes('429') ||
        error?.message?.includes('Too Many Requests') ||
        error?.message?.includes('500') ||
        error?.message?.includes('502') ||
        error?.message?.includes('503');

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const waitTime = baseDelay * Math.pow(2, attempt);
      if (NOCODB_CONFIG.DEBUG) {
        console.log(`[Retry] Intento ${attempt + 1}/${maxRetries} falló. Esperando ${waitTime}ms...`);
      }

      await delay(waitTime);
    }
  }

  throw lastError;
}

/**
 * Carga datos de forma secuencial con delays entre peticiones
 */
async function loadDataSequentially(): Promise<{
  sellers: Seller[];
  contacts: Contact[];
  interactions: Interaction[];
  sales: Sale[];
  attempts: PurchaseAttempt[];
}> {
  const DELAY_BETWEEN_REQUESTS = 200;

  if (NOCODB_CONFIG.DEBUG) {
    console.log('[DataLoader] Iniciando carga secuencial de datos...');
  }

  const sellers = await withRetry(() => getRealSellers());
  if (NOCODB_CONFIG.DEBUG) console.log(`[DataLoader] ✓ Sellers: ${sellers.length}`);
  await delay(DELAY_BETWEEN_REQUESTS);

  const sales = await withRetry(() => getRealSales());
  if (NOCODB_CONFIG.DEBUG) console.log(`[DataLoader] ✓ Ventas: ${sales.length}`);
  await delay(DELAY_BETWEEN_REQUESTS);

  const contacts = await withRetry(() => getRealContacts());
  if (NOCODB_CONFIG.DEBUG) console.log(`[DataLoader] ✓ Contactos: ${contacts.length}`);
  await delay(DELAY_BETWEEN_REQUESTS);

  const interactions = await withRetry(() => getRealInteractions());
  if (NOCODB_CONFIG.DEBUG) console.log(`[DataLoader] ✓ Interacciones: ${interactions.length}`);
  await delay(DELAY_BETWEEN_REQUESTS);

  const attempts = await withRetry(() => getRealAttempts());
  if (NOCODB_CONFIG.DEBUG) console.log(`[DataLoader] ✓ Intentos: ${attempts.length}`);

  if (NOCODB_CONFIG.DEBUG) {
    console.log('[DataLoader] ✅ Carga secuencial completada');
  }

  return { sellers, contacts, interactions, sales, attempts };
}

// --- MOCK DATA GENERATOR ---
// Se usa si NO hay configuración de API detectada.
const MOCK_SELLERS: Seller[] = [
  { id: '1', name: 'Ana Garcia', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
  { id: '2', name: 'Sofia Martinez', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
  { id: '3', name: 'Carlos Ruiz', avatarUrl: undefined },
];

const generateMockData = () => {
  const contacts: Contact[] = [];
  const interactions: Interaction[] = [];
  const sales: Sale[] = [];
  const attempts: PurchaseAttempt[] = [];

  const dateDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  for (let i = 0; i < 70; i++) {
    const isWin = Math.random() > 0.7;
    const isLost = !isWin && Math.random() > 0.5;
    const seller = MOCK_SELLERS[Math.floor(Math.random() * MOCK_SELLERS.length)];
    const daysAgoCreated = Math.floor(Math.random() * 60);

    const contactId = `c-${i}`;

    contacts.push({
      id: contactId,
      name: `Lead Demo ${i + 1}`,
      country: Math.random() > 0.5 ? 'México' : (Math.random() > 0.5 ? 'Colombia' : 'España'),
      createdAt: dateDaysAgo(daysAgoCreated),
      status: isWin ? LeadStatus.CLOSED_WON : (isLost ? LeadStatus.CLOSED_LOST : LeadStatus.CONTACTED),
      lostReason: isLost ? LostReason.EXPENSIVE : undefined,
      assignedSellerId: seller.id
    });

    const numInteractions = Math.floor(Math.random() * 5) + 1;
    for (let j = 0; j < numInteractions; j++) {
      interactions.push({
        id: `i-${i}-${j}`,
        contactId: contactId,
        sellerId: seller.id,
        type: Math.random() > 0.6 ? InteractionType.WHATSAPP : (Math.random() > 0.5 ? InteractionType.CALL : InteractionType.EMAIL),
        date: dateDaysAgo(Math.max(0, daysAgoCreated - j)),
        durationSeconds: 120,
        result: 'Seguimiento'
      });
    }

    if (isWin) {
      sales.push({
        id: `s-${i}`,
        contactId: contactId,
        sellerId: seller.id,
        productName: Math.random() > 0.5 ? 'Coaching Premium' : 'Curso Básico',
        amount: Math.random() > 0.5 ? 2000 : 5000,
        date: dateDaysAgo(Math.max(0, daysAgoCreated - 5))
      });
    }

    if (Math.random() > 0.8) {
      attempts.push({
        id: `a-${i}`,
        contactId: contactId,
        amount: 5000,
        status: PurchaseAttemptStatus.FAILED,
        date: dateDaysAgo(Math.max(0, daysAgoCreated - 2)),
        recoverySellerId: seller.id
      });
    }
  }

  return { sellers: MOCK_SELLERS, contacts, interactions, sales, attempts };
};

// --- MAIN SERVICE ---

export const getDashboardData = async (startDate: Date, endDate: Date) => {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  const isWithinRange = (dateString: string) => {
    const time = new Date(dateString).getTime();
    return time >= startMs && time <= endMs;
  };

  // ESTRATEGIA: Si la API no está configurada (estamos en preview sin keys), usamos Mocks.
  // Si está configurada, intentamos llamar a NocoDB.
  const useMocks = !isApiConfigured();

  if (useMocks) {
    console.log("⚠️ API no configurada: Usando DATOS DEMO para previsualización.");
    const mockData = generateMockData();
    return {
      sellers: mockData.sellers,
      contacts: mockData.contacts,
      interactions: mockData.interactions.filter(i => isWithinRange(i.date)),
      sales: mockData.sales.filter(s => isWithinRange(s.date)),
      attempts: mockData.attempts.filter(a => isWithinRange(a.date)),
      isDemo: true
    };
  }

  try {
    // ✅ OPTIMIZADO: Carga secuencial con delays para evitar rate limiting (429)
    // Antes: Promise.all() con 5 peticiones simultáneas → Error 429
    // Ahora: Carga secuencial con 200ms entre peticiones → Sin errores
    const startTime = performance.now();

    const { sellers, contacts, interactions, sales, attempts } = await loadDataSequentially();

    const loadTime = Math.round(performance.now() - startTime);
    if (NOCODB_CONFIG.DEBUG) {
      console.log(`[DataLoader] Tiempo total de carga: ${loadTime}ms`);
    }

    return {
      sellers,
      contacts,
      interactions: interactions.filter(i => isWithinRange(i.date)),
      sales: sales.filter(s => isWithinRange(s.date)),
      attempts: attempts.filter(a => isWithinRange(a.date)),
      isDemo: false
    };

  } catch (error) {
    console.error("🔥 Error conectando a NocoDB:", error);
    return { sellers: [], sales: [], contacts: [], interactions: [], attempts: [], isDemo: false };
  }
};