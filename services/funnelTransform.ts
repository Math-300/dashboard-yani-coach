import type { FunnelRespondioRow, EmbudoStage } from './types.js';

const pct = (n: number, base: number): number =>
  base > 0 ? Math.round((n / base) * 100) : 0;

/** Convierte la fila del RPC en las etapas del embudo para la UI. */
export function buildEmbudoStages(row: FunnelRespondioRow): EmbudoStage[] {
  const leads = row.leads_nuevos;
  const defs: Array<{ id: EmbudoStage['id']; label: string; count: number | null; star?: boolean; soon?: boolean }> = [
    { id: 'leads',          label: 'Leads nuevos',              count: row.leads_nuevos },
    { id: 'primer_mensaje', label: 'Primer mensaje enviado',    count: row.primer_mensaje },
    { id: 'respondieron',   label: 'Respondieron',              count: row.respondieron, star: true },
    { id: 'interesados',    label: 'Interesados',               count: row.interesados },
    { id: 'agendo',         label: 'Agendó / entró en llamada', count: row.agendo },
    // Nota: la venta NO es una etapa del embudo (que es el cohorte de leads del período).
    // Las ventas/pérdidas se muestran en "Resultado final" contadas por fecha del evento.
  ];

  let prevCount: number | null = null;
  return defs.map((d) => {
    const dropFromPrev =
      d.count !== null && prevCount !== null && prevCount > 0
        ? Math.round(((prevCount - d.count) / prevCount) * 100)
        : null;
    if (d.count !== null) prevCount = d.count;
    return {
      ...d,
      pctOfLeads: d.count !== null ? pct(d.count, leads) : 0,
      dropFromPrev,
    };
  });
}
