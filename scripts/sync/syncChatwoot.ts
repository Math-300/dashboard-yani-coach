import { listConversations, listMessages } from './chatwootClient.js';
import { deriveRespondio } from './respondio.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { chunk } from './helpers.js';

const BATCH_SIZE = 500;
// Concurrencia al traer mensajes por conversación. Chatwoot expone ~2230 convs y
// el fetch es 1 request/conv: secuencial tardaba ~22min (revienta el watchdog).
// Con un pool paralelo baja a ~3min. getJson() ya maneja 429 con backoff.
const FETCH_CONCURRENCY = 8;

interface ConvRecord {
  tenant_id: string;
  chatwoot_conversation_id: number;
  chatwoot_contact_id: string | null;
  contacto_nocodb_id: number | null;
  agent_chatwoot_id: number | null;
  status: string | null;
  respondio: boolean;
  primer_outbound_at: string | null;
  primer_inbound_at: string | null;
  tiempo_primera_respuesta_seg: number | null;
  last_activity_at: string | null;
  raw: Record<string, unknown>;
  synced_at: string;
}

const isoFromEpoch = (s: number | null): string | null =>
  s ? new Date(s * 1000).toISOString() : null;

export async function syncChatwoot(tenantId: string, runId: string) {
  console.log('\n=== Sync Chatwoot ===');
  const started = Date.now();

  const convs = await listConversations();
  console.log(`  ${convs.length} conversaciones listadas`);

  // Pool de workers paralelos: cada uno toma conversaciones por índice estriado
  // (k, k+N, k+2N…). El fetch de mensajes (1 request/conv) domina el tiempo;
  // paralelizar baja ~22min → ~3min y entra holgado en el watchdog.
  const records: ConvRecord[] = new Array(convs.length);
  let processed = 0;
  async function worker(start: number) {
    for (let idx = start; idx < convs.length; idx += FETCH_CONCURRENCY) {
      const c = convs[idx];
      const messages = await listMessages(c.id);
      const r = deriveRespondio(messages);
      records[idx] = {
        tenant_id: tenantId,
        chatwoot_conversation_id: c.id,
        chatwoot_contact_id: c.contact_id !== null ? String(c.contact_id) : null,
        contacto_nocodb_id: c.contact_nocodb_id,
        agent_chatwoot_id: c.agent_id,
        status: c.status,
        respondio: r.respondio,
        primer_outbound_at: isoFromEpoch(r.primer_outbound_at),
        primer_inbound_at: isoFromEpoch(r.primer_inbound_at),
        tiempo_primera_respuesta_seg: r.tiempo_primera_respuesta_seg,
        last_activity_at: isoFromEpoch(c.last_activity_at),
        raw: { phone: c.contact_phone, email: c.contact_email },
        synced_at: new Date().toISOString(),
      };
      processed++;
      if (processed % 200 === 0) console.log(`  procesadas ${processed}/${convs.length}`);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, convs.length) }, (_, k) => worker(k)),
  );

  let upserted = 0;
  for (const batch of chunk(records, BATCH_SIZE)) {
    const { error, count } = await supabaseAdmin
      .from('chatwoot_conversaciones')
      .upsert(batch, {
        onConflict: 'tenant_id,chatwoot_conversation_id',
        ignoreDuplicates: false,
        count: 'exact',
      });
    if (error) {
      await supabaseAdmin.from('sync_runs').update({
        status: 'error',
        finished_at: new Date().toISOString(),
        rows_failed: batch.length,
        error: { message: error.message, details: error.details, hint: error.hint },
      }).eq('id', runId);
      throw error;
    }
    upserted += count ?? batch.length;
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ✓ ${upserted} conversaciones upserted en ${elapsed}s`);
  return { rows: upserted };
}
