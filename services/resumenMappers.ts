import type { Sale } from '../types';
import type { FunnelRespondioRow, ResponsividadVendedoraRow, EmbudoStage } from './types';

export function ventasCard(sales: Sale[]): { total: number; count: number; ticketPromedio: number } {
  const total = sales.reduce((s, v) => s + (v.amount || 0), 0);
  const count = sales.length;
  return { total, count, ticketPromedio: count ? Math.round(total / count) : 0 };
}

export function respuestaCard(
  funnel: FunnelRespondioRow,
  resp: ResponsividadVendedoraRow[],
  urgentFollowUps: number,
): { medianaMin: number | null; sinAtender: number; porVendedora: ResponsividadVendedoraRow[] } {
  return {
    medianaMin: funnel.tiempo_resp_mediana_min == null ? null : Math.round(funnel.tiempo_resp_mediana_min),
    sinAtender: urgentFollowUps,
    porVendedora: resp,
  };
}

export function leadsCard(funnel: FunnelRespondioRow): {
  respondieron: number; leadsNuevos: number; tasaRespuesta: number; llegaronVenta: number;
} {
  const tasa = funnel.leads_nuevos ? Math.round((funnel.respondieron / funnel.leads_nuevos) * 100) : 0;
  return { respondieron: funnel.respondieron, leadsNuevos: funnel.leads_nuevos, tasaRespuesta: tasa, llegaronVenta: funnel.venta_cerrada };
}

/**
 * Serie para sparkline: reparte `items` en `buckets` tramos iguales por fecha
 * (de la fecha más vieja a la más nueva presente en los datos) y suma `getValue`
 * en cada tramo. Devuelve [] si no hay al menos 2 puntos con fecha válida.
 * Datos REALES (no inventa tendencia); es un indicador de forma, no exacto.
 */
export function miniSeries<T>(
  items: T[],
  getDate: (x: T) => string | null | undefined,
  getValue: (x: T) => number,
  buckets = 7,
): number[] {
  const pts = items
    .map((x) => ({ t: new Date(getDate(x) ?? '').getTime(), v: getValue(x) }))
    .filter((p) => !Number.isNaN(p.t));
  if (pts.length < 2) return [];
  const min = Math.min(...pts.map((p) => p.t));
  const max = Math.max(...pts.map((p) => p.t));
  if (max === min) return [];
  const span = max - min;
  const out = new Array(buckets).fill(0);
  for (const p of pts) {
    let idx = Math.floor(((p.t - min) / span) * buckets);
    if (idx >= buckets) idx = buckets - 1;
    if (idx < 0) idx = 0;
    out[idx] += p.v;
  }
  return out;
}

export function buildEmbudo(funnel: FunnelRespondioRow): EmbudoStage[] {
  const L = funnel.leads_nuevos || 0;
  const pct = (n: number) => (L ? Math.round((n / L) * 100) : 0);
  return [
    { id: 'leads', label: 'Personas nuevas', count: funnel.leads_nuevos, pctOfLeads: 100, dropFromPrev: null },
    { id: 'primer_mensaje', label: 'El equipo las contactó', count: funnel.primer_mensaje, pctOfLeads: pct(funnel.primer_mensaje), dropFromPrev: funnel.leads_nuevos > 0 ? Math.round(100 - (funnel.primer_mensaje / funnel.leads_nuevos) * 100) : 0 },
    { id: 'respondieron', label: 'Respondieron', count: funnel.respondieron, pctOfLeads: pct(funnel.respondieron), dropFromPrev: funnel.primer_mensaje ? Math.round(100 - (funnel.respondieron / funnel.primer_mensaje) * 100) : null, star: true },
    { id: 'interesados', label: 'Interesados', count: funnel.interesados, pctOfLeads: pct(funnel.interesados), dropFromPrev: funnel.respondieron ? Math.round(100 - (funnel.interesados / funnel.respondieron) * 100) : null },
    { id: 'agendo', label: 'Agendó / entró en llamada', count: funnel.agendo, pctOfLeads: pct(funnel.agendo), dropFromPrev: funnel.interesados ? Math.round(100 - (funnel.agendo / funnel.interesados) * 100) : null },
  ];
}
