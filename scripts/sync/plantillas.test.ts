/**
 * Tests de deriveTemplateSends. Uso: npx tsx scripts/sync/plantillas.test.ts
 */
import assert from 'node:assert/strict';
import { deriveTemplateSends, type ChatwootMessage } from './respondio.js';

function m(extra: Partial<ChatwootMessage> & { message_type: 0 | 1 | 2; created_at: number }): ChatwootMessage {
  return { private: false, ...extra };
}

// 1) Un template leído, con respuesta posterior del lead
{
  const sends = deriveTemplateSends([
    m({ message_type: 1, created_at: 100, id: 11, status: 'read', is_template_replay: true, template_name: 'bienvenida_plataforma_v2' }),
    m({ message_type: 0, created_at: 200, id: 12 }),
  ]);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].chatwoot_message_id, 11);
  assert.equal(sends[0].template_name, 'bienvenida_plataforma_v2');
  assert.equal(sends[0].enviado_at, 100);
  assert.equal(sends[0].leido, true);
  assert.equal(sends[0].entregado, true);
  assert.equal(sends[0].fallido, false);
  assert.equal(sends[0].respondido, true);
}

// 2) Template entregado (no leído), sin respuesta
{
  const sends = deriveTemplateSends([
    m({ message_type: 1, created_at: 100, id: 21, status: 'delivered', is_template_replay: true, template_name: 'revision_perfil_ig' }),
  ]);
  assert.equal(sends[0].entregado, true);
  assert.equal(sends[0].leido, false);
  assert.equal(sends[0].respondido, false);
}

// 3) Template fallido
{
  const sends = deriveTemplateSends([
    m({ message_type: 1, created_at: 100, id: 31, status: 'failed', is_template_replay: true, template_name: 'primer_contacto_yanicoach' }),
  ]);
  assert.equal(sends[0].fallido, true);
  assert.equal(sends[0].entregado, false);
}

// 4) Mensajes que NO son template (texto normal, inbound, sin id) → se ignoran
{
  const sends = deriveTemplateSends([
    m({ message_type: 1, created_at: 100, id: 41, status: 'read' }), // texto normal de asesora
    m({ message_type: 0, created_at: 110, id: 42 }),                 // inbound
    m({ message_type: 1, created_at: 120, status: 'read', is_template_replay: true, template_name: 'x' }), // sin id → se ignora
  ]);
  assert.equal(sends.length, 0);
}

// 5) Respuesta ANTERIOR al template no cuenta como respondido
{
  const sends = deriveTemplateSends([
    m({ message_type: 0, created_at: 50, id: 51 }),
    m({ message_type: 1, created_at: 100, id: 52, status: 'read', is_template_replay: true, template_name: 'y' }),
  ]);
  assert.equal(sends[0].respondido, false); // el inbound a los 50 es previo al envío
}

console.log('✓ deriveTemplateSends: 5/5 casos pasaron');
