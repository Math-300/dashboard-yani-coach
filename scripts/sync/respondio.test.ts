/**
 * Tests de deriveRespondio. Uso: npx tsx scripts/sync/respondio.test.ts
 */
import assert from 'node:assert/strict';
import { deriveRespondio, type ChatwootMessage } from './respondio.js';

function msg(type: 0 | 1 | 2, ts: number, priv = false): ChatwootMessage {
  return { message_type: type, created_at: ts, private: priv };
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

console.log('✓ deriveRespondio: 7/7 casos pasaron');
