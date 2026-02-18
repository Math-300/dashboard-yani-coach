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
import { isApiConfigured } from '../config';

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
    const [realSellers, realContacts, realInteractions, realSales, realAttempts] = await Promise.all([
      getRealSellers(),
      getRealContacts(),
      getRealInteractions(),
      getRealSales(),
      getRealAttempts()
    ]);

    return {
      sellers: realSellers,
      contacts: realContacts,
      interactions: realInteractions.filter(i => isWithinRange(i.date)),
      sales: realSales.filter(s => isWithinRange(s.date)),
      attempts: realAttempts.filter(a => isWithinRange(a.date)),
      isDemo: false
    };

  } catch (error) {
    console.error("🔥 Error conectando a NocoDB:", error);
    return { sellers: [], sales: [], contacts: [], interactions: [], attempts: [], isDemo: false };
  }
};