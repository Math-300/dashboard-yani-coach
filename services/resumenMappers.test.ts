import { ventasCard, respuestaCard, leadsCard, buildEmbudo, miniSeries } from './resumenMappers';
const v = ventasCard([{ amount: 100 } as any, { amount: 200 } as any, { amount: 300 } as any]);
console.assert(v.total === 600 && v.count === 3 && v.ticketPromedio === 200, 'ventasCard');
const l = leadsCard({ leads_nuevos: 310, respondieron: 124, venta_cerrada: 12 } as any);
console.assert(l.tasaRespuesta === 40 && l.llegaronVenta === 12 && l.respondieron === 124, 'leadsCard');
const e = buildEmbudo({ leads_nuevos: 310, primer_mensaje: 310, respondieron: 124, interesados: 58, venta_cerrada: 12, venta_perdida: 22, tiempo_resp_mediana_min: 18 } as any);
console.assert(e[2].star === true && e[2].count === 124, 'embudo star');
console.assert(e[4].soon === true && e[4].count === null, 'embudo soon');
const r = respuestaCard({ tiempo_resp_mediana_min: 18.4 } as any, [], 3);
console.assert(r.medianaMin === 18 && r.sinAtender === 3, 'respuestaCard');

// miniSeries: 4 items across 2 days → buckets, sum of values, length=buckets
const ms = miniSeries(
  [
    { d: '2026-05-01', v: 10 },
    { d: '2026-05-01', v: 5 },
    { d: '2026-05-04', v: 20 },
    { d: '2026-05-07', v: 1 },
  ],
  (x) => x.d,
  (x) => x.v,
  7,
);
console.assert(ms.length === 7, 'miniSeries length');
console.assert(ms.reduce((a, b) => a + b, 0) === 36, 'miniSeries sum');
console.assert(ms[0] === 15, 'miniSeries first bucket');
console.assert(miniSeries([{ d: '2026-05-01', v: 1 }], (x) => x.d, (x) => x.v).length === 0, 'miniSeries <2 pts → []');

console.log('OK resumenMappers');
