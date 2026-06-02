/**
 * Tests de deriveRespondio. Uso: npx tsx scripts/sync/respondio.test.ts
 */
import assert from 'node:assert/strict';
import { deriveRespondio, type ChatwootMessage } from './respondio.js';

// helper extendido (reemplaza el msg() existente)
function msg(
  type: 0 | 1 | 2,
  ts: number,
  priv = false,
  extra: Partial<ChatwootMessage> = {},
): ChatwootMessage {
  return { message_type: type, created_at: ts, private: priv, ...extra };
}

// 1) Lead respondió al template
{
  const r = deriveRespondio([msg(1, 100), msg(0, 160)]);
  assert.equal(r.respondio, true);
  assert.equal(r.primer_outbound_at, 100);
  assert.equal(r.primer_inbound_at, 160);
  assert.equal(r.tiempo_primera_respuesta_seg, null);
}

// 2) Lead respondió y la asesora le contestó (mide tiempo del equipo)
{
  const r = deriveRespondio([msg(1, 100), msg(0, 160), msg(1, 220)]);
  assert.equal(r.respondio, true);
  assert.equal(r.tiempo_primera_respuesta_seg, 60);
}

// 3) Solo se envió el template, el lead nunca contestó
{
  const r = deriveRespondio([msg(1, 100)]);
  assert.equal(r.respondio, false);
  assert.equal(r.primer_inbound_at, null);
  assert.equal(r.tiempo_primera_respuesta_seg, null);
}

// 4) Lead escribió primero (inbound directo, sin template previo)
{
  const r = deriveRespondio([msg(0, 50), msg(1, 90)]);
  assert.equal(r.respondio, true);
  assert.equal(r.primer_inbound_at, 50);
  assert.equal(r.tiempo_primera_respuesta_seg, 40);
}

// 5) Mensajes desordenados → la función ordena por created_at
{
  const r = deriveRespondio([msg(0, 160), msg(1, 100)]);
  assert.equal(r.respondio, true);
  assert.equal(r.primer_outbound_at, 100);
}

// 6) Ignora notas privadas y activities
{
  const r = deriveRespondio([msg(1, 100), msg(2, 120), msg(0, 130, true), msg(0, 200)]);
  assert.equal(r.respondio, true);
  assert.equal(r.primer_inbound_at, 200);
}

// 7) Conversación vacía
{
  const r = deriveRespondio([]);
  assert.equal(r.respondio, false);
  assert.equal(r.primer_outbound_at, null);
  assert.equal(r.primer_inbound_at, null);
  assert.equal(r.tiempo_primera_respuesta_seg, null);
}

// 8) El primer outbound es un template → NO cuenta como respuesta humana
{
  const r = deriveRespondio([
    msg(0, 100),
    msg(1, 110, false, { is_template_replay: true, template_name: 'bienvenida_plataforma_v2' }),
    msg(1, 400, false, { sender_name: 'María del Carmen Vera' }),
  ]);
  assert.equal(r.respondio, true);
  assert.equal(r.tiempo_primera_respuesta_seg, 300); // 400-100, ignora el template a los 110
}

// 9) El outbound rápido es de la cuenta automática → NO cuenta
{
  const r = deriveRespondio([
    msg(0, 100),
    msg(1, 102, false, { sender_name: 'Yanina Zapino' }),
    msg(1, 700, false, { sender_name: 'María Beatriz Juzviachik' }),
  ]);
  assert.equal(r.tiempo_primera_respuesta_seg, 600); // 700-100, ignora el auto a los 102
}

// 10) Solo hay respuesta automática → tiempo humano null
{
  const r = deriveRespondio([
    msg(0, 100),
    msg(1, 105, false, { is_template_replay: true, template_name: 'revision_perfil_ig' }),
  ]);
  assert.equal(r.respondio, false); // el lead no escribió después
  assert.equal(r.tiempo_primera_respuesta_seg, null);
}

// 11) automationSenders configurable
{
  const r = deriveRespondio(
    [msg(0, 100), msg(1, 150, false, { sender_name: 'Bot X' })],
    { automationSenders: new Set(['Bot X']) },
  );
  assert.equal(r.tiempo_primera_respuesta_seg, null);
}

console.log('✓ deriveRespondio: 11/11 casos pasaron');
