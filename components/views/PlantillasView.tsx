// Yani Coach Dashboard — PlantillasView
// Sección "Plantillas": rendimiento de los templates del día a día (masivos excluidos).
// Props vienen del controller; ZERO números hardcodeados.
import React from 'react';
import type { PlantillaStatRow } from '../../services/types';

export interface PlantillasViewProps {
  plantillas: PlantillaStatRow[];
  rangeLabel: string;
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('es-AR');
}

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return `${Math.round(v * 100)}%`;
}

function toTitleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function nombreHumano(p: PlantillaStatRow): string {
  if (p.shortcode) return p.shortcode.replace(/_/g, ' ');
  if (p.descripcion) return p.descripcion;
  return toTitleCase(p.template_name);
}

const StatPill: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 92 }}>
    <span style={{ fontSize: 12.5, color: 'var(--yc-text-mute)' }}>{label}</span>
    <span className="yc-num" style={{ fontSize: 19, fontWeight: 600 }}>{value}</span>
    {sub && <span style={{ fontSize: 11.5, color: 'var(--yc-text-mute)' }}>{sub}</span>}
  </div>
);

const PlantillaCard: React.FC<{ p: PlantillaStatRow }> = ({ p }) => {
  const entregados = p.enviados - p.fallidos;
  return (
    <article className="yc-glass" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize' }}>{nombreHumano(p)}</span>
        {p.descripcion && (
          <span style={{ fontSize: 12, color: 'var(--yc-text-mute)', lineHeight: 1.4 }}>{p.descripcion}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        <StatPill label="Enviados" value={fmtNum(p.enviados)} sub={`${fmtNum(entregados)} entregados`} />
        <StatPill label="Sin entregar" value={fmtPct(p.tasa_fallo)} sub={p.fallidos > 0 ? `${fmtNum(p.fallidos)} no llegaron` : 'ninguno'} />
        <StatPill label="Lo leyeron" value={fmtPct(p.tasa_apertura)} sub={`${fmtNum(p.leidos)} de ${fmtNum(entregados)} entregados`} />
        <StatPill label="Respuesta" value={fmtPct(p.tasa_respuesta)} sub={`${fmtNum(p.respondidos)} de ${fmtNum(entregados)} entregados`} />
      </div>
    </article>
  );
};

const InfoIcon: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
       style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export const PlantillasView: React.FC<PlantillasViewProps> = ({ plantillas, rangeLabel }) => {
  const totalEnviados = plantillas.reduce((a, p) => a + p.enviados, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Plantillas del día a día</h1>
        <span style={{ fontSize: 13, color: 'var(--yc-text-mute)' }}>
          {rangeLabel} · {fmtNum(totalEnviados)} envíos · No incluye campañas masivas
        </span>
      </div>

      {plantillas.length === 0 ? (
        <div className="yc-glass" style={{ padding: 28, textAlign: 'center', color: 'var(--yc-text-mute)' }}>
          No hay envíos de plantillas en este período.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {plantillas.map((p) => <PlantillaCard key={p.template_name} p={p} />)}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', color: 'var(--yc-text-mute)', fontSize: 12.5, lineHeight: 1.5 }}>
        <InfoIcon />
        <span>
          <strong>Sin entregar</strong> = WhatsApp/Meta rechazó el envío (típicamente fuera de la ventana de 24h
          o por tope de marketing). <strong>Lo leyeron</strong> y <strong>Respuesta</strong> se calculan
          sobre los entregados (enviados − sin entregar). La lectura usa el read receipt de WhatsApp; algunos contactos lo tienen
          desactivado, así que el valor real puede ser mayor.
        </span>
      </div>
    </div>
  );
};

export default PlantillasView;
