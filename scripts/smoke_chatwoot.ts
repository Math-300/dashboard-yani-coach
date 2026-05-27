/**
 * Smoke test: confirma acceso a la API de Chatwoot.
 * Uso: npx tsx scripts/smoke_chatwoot.ts
 */
import { env } from './sync/env.js';

async function main() {
  const base = `${env.CHATWOOT_URL}/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}`;
  const res = await fetch(`${base}/conversations?status=all&page=1`, {
    headers: { api_access_token: env.CHATWOOT_TOKEN },
  });
  if (!res.ok) {
    throw new Error(`Chatwoot ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data: { meta: unknown; payload: unknown[] } };
  console.log('✓ Acceso OK. Conversaciones en página 1:', json.data.payload.length);
  console.log('  meta:', JSON.stringify(json.data.meta));
  const first = json.data.payload[0] as Record<string, unknown> | undefined;
  if (first) {
    console.log('  ejemplo conv:', JSON.stringify({
      id: first.id, status: first.status,
      last_activity_at: first.last_activity_at,
      sender: (first.meta as Record<string, unknown> | undefined)?.sender,
    }));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
