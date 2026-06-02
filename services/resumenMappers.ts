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
): { medianaMin: number; sinAtender: number; porVendedora: ResponsividadVendedoraRow[] } {
  return {
    medianaMin: Math.round(funnel.tiempo_resp_mediana_min ?? 0),
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

export function buildEmbudo(funnel: FunnelRespondioRow): EmbudoStage[] {
  const L = funnel.leads_nuevos || 0;
  const pct = (n: number) => (L ? Math.round((n / L) * 100) : 0);
  return [
    { id: 'leads', label: 'Leads nuevos', count: funnel.leads_nuevos, pctOfLeads: 100, dropFromPrev: null },
    { id: 'primer_mensaje', label: 'Primer mensaje enviado', count: funnel.primer_mensaje, pctOfLeads: pct(funnel.primer_mensaje), dropFromPrev: 0 },
    { id: 'respondieron', label: 'Respondieron', count: funnel.respondieron, pctOfLeads: pct(funnel.respondieron), dropFromPrev: funnel.primer_mensaje ? Math.round(100 - (funnel.respondieron / funnel.primer_mensaje) * 100) : null, star: true },
    { id: 'interesados', label: 'Interesados', count: funnel.interesados, pctOfLeads: pct(funnel.interesados), dropFromPrev: funnel.respondieron ? Math.round(100 - (funnel.interesados / funnel.respondieron) * 100) : null },
    { id: 'agendo', label: 'Agendó / entró en llamada', count: null, pctOfLeads: 0, dropFromPrev: null, soon: true },
  ];
}
