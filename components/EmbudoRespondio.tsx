import type { FunnelRespondioRow } from '../services/types';
import { buildEmbudoStages } from '../services/funnelTransform';

interface EmbudoRespondioProps {
  funnel: FunnelRespondioRow;
  isLoading?: boolean;
}

export default function EmbudoRespondio({ funnel, isLoading }: EmbudoRespondioProps) {
  const stages = buildEmbudoStages(funnel);
  const maxCount = Math.max(1, ...stages.map((s) => s.count ?? 0));

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-white/10">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Embudo del negocio</h3>
          <p className="text-sm text-gray-400">De lead nuevo a venta cerrada</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-500">Respuesta (mediana)</p>
          <p className="text-xl font-bold text-gold-400">
            {funnel.tiempo_resp_mediana_min !== null ? `${funnel.tiempo_resp_mediana_min} min` : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {stages.map((s, i) => {
          const widthPct = s.count !== null ? Math.max(6, (s.count / maxCount) * 100) : 100;
          return (
            <div key={s.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300 flex items-center gap-1.5">
                  {s.star && <span className="text-gold-400" aria-hidden>★</span>}
                  {s.label}
                  {s.soon && <span className="text-[10px] uppercase text-gray-500 border border-gray-600 rounded px-1.5 py-0.5">pronto</span>}
                </span>
                <span className="text-sm font-semibold text-gray-100">
                  {s.count !== null ? `${s.count.toLocaleString('es-AR')} · ${s.pctOfLeads}%` : '—'}
                </span>
              </div>
              <div className="relative h-8 rounded-md bg-gray-700/40 overflow-hidden">
                <div
                  className={`h-full rounded-md transition-[width] duration-700 ease-out ${
                    s.soon ? 'bg-gray-600/40' : s.star ? 'bg-gold-400' : 'bg-gold-600'
                  }`}
                  style={{ width: isLoading ? '0%' : `${widthPct}%` }}
                />
                {s.dropFromPrev !== null && s.dropFromPrev > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400">
                    −{s.dropFromPrev}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-white/10 flex gap-6 text-sm">
        <span className="text-gray-400">Venta perdida:
          <span className="ml-1 font-semibold text-red-400">{funnel.venta_perdida.toLocaleString('es-AR')}</span>
        </span>
      </div>
    </div>
  );
}
