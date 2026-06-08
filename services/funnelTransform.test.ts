import assert from 'node:assert/strict';
import { buildEmbudoStages } from './funnelTransform.js';
import type { FunnelRespondioRow } from './types.js';

const row: FunnelRespondioRow = {
  leads_nuevos: 310,
  primer_mensaje: 310,
  respondieron: 124,
  interesados: 58,
  agendo: 30,
  venta_cerrada: 20,
  venta_cerrada_monto: 4200,
  venta_perdida: 90,
  tiempo_resp_mediana_min: 36.7,
};

const stages = buildEmbudoStages(row);

// 5 etapas: leads, primer_mensaje, respondieron(star), interesados, agendo
// La venta NO es etapa del embudo — se muestra en "Resultado final" (por fecha del evento).
assert.equal(stages.length, 5);
assert.ok(!stages.some((s) => s.id === 'venta_cerrada'));
assert.equal(stages[0].id, 'leads');
assert.equal(stages[0].count, 310);
assert.equal(stages[0].pctOfLeads, 100);
assert.equal(stages[0].dropFromPrev, null); // primera etapa no tiene caída

// Respondieron: 124/310 = 40% de leads; caída desde primer_mensaje (310): 60%
const reply = stages.find((s) => s.id === 'respondieron')!;
assert.equal(reply.star, true);
assert.equal(reply.pctOfLeads, 40);
assert.equal(reply.dropFromPrev, 60);

// Etapa "agendó" ahora con dato real: count = row.agendo (subconjunto de interesados)
const call = stages.find((s) => s.id === 'agendo')!;
assert.equal(call.count, 30);
assert.equal(call.pctOfLeads, Math.round((30 / 310) * 100)); // 10
assert.equal(call.dropFromPrev, Math.round(((58 - 30) / 58) * 100)); // caída desde interesados (58): 48

// leads_nuevos=0 no debe dividir por cero
const zero = buildEmbudoStages({ ...row, leads_nuevos: 0, primer_mensaje: 0, respondieron: 0, interesados: 0, venta_cerrada: 0 });
assert.equal(zero[0].pctOfLeads, 0);
assert.ok(zero.every((s) => Number.isFinite(s.pctOfLeads)));

console.log('✓ buildEmbudoStages OK');
