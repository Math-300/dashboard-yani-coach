import { env } from './env.js';
import type { ChatwootMessage } from './respondio.js';

const BASE = `${env.CHATWOOT_URL}/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}`;
const HEADERS = { api_access_token: env.CHATWOOT_TOKEN };

export interface ChatwootConversation {
  id: number;
  status: string;
  last_activity_at: number;
  contact_id: number | null;          // sender.id de Chatwoot
  contact_nocodb_id: number | null;   // sender.custom_attributes.nocodb_id (enlace primario, ~97% cobertura)
  contact_phone: string | null;
  contact_email: string | null;
  agent_id: number | null;
}

async function getJson<T>(url: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Chatwoot ${res.status} en ${url}: ${await res.text()}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

/** Lista todas las conversaciones, paginando hasta agotar. */
export async function listConversations(): Promise<ChatwootConversation[]> {
  const out: ChatwootConversation[] = [];
  for (let page = 1; ; page++) {
    const json = await getJson<{ data: { payload: any[] } }>(
      `${BASE}/conversations?status=all&page=${page}`,
    );
    const payload = json.data?.payload ?? [];
    if (payload.length === 0) break;
    for (const c of payload) {
      const sender = c.meta?.sender ?? {};
      const nocoRaw = sender.custom_attributes?.nocodb_id;
      const nocoNum = nocoRaw != null && nocoRaw !== '' ? Number(nocoRaw) : NaN;
      out.push({
        id: c.id,
        status: c.status,
        last_activity_at: c.last_activity_at ?? c.timestamp ?? 0,
        contact_id: sender.id ?? null,
        contact_nocodb_id: Number.isFinite(nocoNum) ? nocoNum : null,
        contact_phone: sender.phone_number ?? null,
        contact_email: sender.email ?? null,
        agent_id: c.meta?.assignee?.id ?? null,
      });
    }
    if (payload.length < 25) break;
  }
  return out;
}

export interface ChatwootAgent {
  id: number;
  email: string | null;
  name: string | null;
}

/** Lista los agentes (asesoras) de la cuenta. */
export async function listAgents(): Promise<ChatwootAgent[]> {
  const json = await getJson<any[]>(`${BASE}/agents`);
  return (json ?? []).map((a) => ({ id: a.id, email: a.email ?? null, name: a.name ?? null }));
}

/** Trae los mensajes de una conversación. */
export async function listMessages(conversationId: number): Promise<ChatwootMessage[]> {
  const json = await getJson<{ payload: any[] }>(
    `${BASE}/conversations/${conversationId}/messages`,
  );
  const payload = json.payload ?? [];
  return payload.map((m) => ({
    message_type: m.message_type,
    created_at: m.created_at,
    private: m.private ?? false,
  }));
}
