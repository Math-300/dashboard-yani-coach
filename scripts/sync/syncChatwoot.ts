import { listConversations, listMessages } from './chatwootClient.js';
import { deriveRespondio, deriveTemplateSends } from './respondio.js';
import { getChatwootCursorEpoch } from './incremental.js';
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
  synced_at: string;
}

interface PlantillaEnvioRecord {
  tenant_id: string;
  chatwoot_conversation_id: number;
  chatwoot_message_id: number;
  template_name: string;
  es_masivo: boolean;
  enviado_at: string | null;
  status: string | null;
  entregado: boolean;
  leido: boolean;
  fallido: boolean;
  contacto_nocodb_id: number | null;
  respondido: boolean;
  synced_at: string;
}

const isoFromEpoch = (s: number | null): string | null =>
  s ? new Date(s * 1000).toISOString() : null;

export async function syncChatwoot(tenantId: string, runId: string) {
  console.log('\n=== Sync Chatwoot ===');
  const started = Date.now();

  // Set de templates masivos (a excluir del panel de día a día). Lo llena syncPlantillas,
  // que corre antes en el orquestador.
  const { data: catalogMasivos } = await supabaseAdmin
    .from('plantillas_catalogo')
    .select('template_name')
    .eq('tenant_id', tenantId)
    .eq('es_masivo', true);
  const masivoSet = new Set((catalogMasivos ?? []).map((r) => r.template_name as string));
  console.log(`  ${masivoSet.size} templates masivos a excluir`);

  const envios: PlantillaEnvioRecord[] = [];

  const allConvs = await listConversations();
  console.log(`  ${allConvs.length} conversaciones listadas`);

  // Incremental: sólo procesar convs con actividad desde el último sync exitoso
  // (menos 2h de solape). En modo full/reconcile (cursor null) se procesan todas.
  // Traer los mensajes de cada conv es 1 request/conv y domina el tiempo (~8min full),
  // así que filtrar acá es lo que baja la carga sobre Chatwoot.
  const cursorEpoch = await getChatwootCursorEpoch(tenantId);
  const convs =
    cursorEpoch === null
      ? allConvs
      : allConvs.filter((c) => (c.last_activity_at ?? 0) >= cursorEpoch);
  console.log(
    cursorEpoch === null
      ? `  modo FULL: ${convs.length} conversaciones a procesar`
      : `  modo INCREMENTAL: ${convs.length}/${allConvs.length} activas desde el último sync`,
  );

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
      for (const ts of deriveTemplateSends(messages)) {
        envios.push({
          tenant_id: tenantId,
          chatwoot_conversation_id: c.id,
          chatwoot_message_id: ts.chatwoot_message_id,
          template_name: ts.template_name,
          es_masivo: masivoSet.has(ts.template_name),
          enviado_at: isoFromEpoch(ts.enviado_at),
          status: ts.status,
          entregado: ts.entregado,
          leido: ts.leido,
          fallido: ts.fallido,
          contacto_nocodb_id: c.contact_nocodb_id,
          respondido: ts.respondido,
          synced_at: new Date().toISOString(),
        });
      }
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
        synced_at: new Date().toISOString(),
      };
      processed++;
      if (processed % 200 === 0) console.log(`  procesadas ${processed}/${convs.length}`);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, convs.length) }, (_, k) => worker(k)),
  );

  // Dedup defensivo por chatwoot_conversation_id (último gana): listConversations
  // pagina sobre datos vivos y puede devolver la misma conv en 2 páginas → sin esto
  // el upsert tira Postgres 21000 "ON CONFLICT DO UPDATE cannot affect row a second time".
  const convsByIdMap = new Map<number, ConvRecord>();
  for (const rec of records) {
    if (rec) convsByIdMap.set(rec.chatwoot_conversation_id, rec);
  }
  const recordsUnicos = [...convsByIdMap.values()];

  let upserted = 0;
  for (const batch of chunk(recordsUnicos, BATCH_SIZE)) {
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

  // Dedup defensivo por chatwoot_message_id (último gana) y upsert.
  const enviosByMsg = new Map<number, PlantillaEnvioRecord>();
  for (const e of envios) enviosByMsg.set(e.chatwoot_message_id, e);
  const enviosUnicos = [...enviosByMsg.values()];
  let enviosUpserted = 0;
  for (const batch of chunk(enviosUnicos, BATCH_SIZE)) {
    const { error, count } = await supabaseAdmin
      .from('plantillas_envios')
      .upsert(batch, {
        onConflict: 'tenant_id,chatwoot_message_id',
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
    enviosUpserted += count ?? batch.length;
  }
  console.log(`  ✓ ${enviosUpserted} envíos de template upserted`);

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ✓ ${upserted} conversaciones upserted en ${elapsed}s`);
  return { rows: upserted };
}
