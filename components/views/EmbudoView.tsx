// Yani Coach Dashboard — EmbudoView
// Detail view: date-aware "Respondió" funnel.
// Renders the <Funnel> component plus a breakdown card per stage.
// Props come from the controller; ZERO hardcoded business numbers.
import React from 'react';
import { Funnel } from '../yc/Funnel';
import { Icons } from '../yc/icons';
import { buildEmbudo } from '../../services/resumenMappers';
import type { FunnelRespondioRow, EmbudoStage } from '../../services/types';

// ── Props ─────────────────────────────────────────────────

export interface EmbudoViewProps {
  funnelRespondio: FunnelRespondioRow;
  rangeLabel: string;
}

// ── Helpers ───────────────────────────────────────────────

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('es-AR');
}

function fmtTime(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── BreakdownRow ──────────────────────────────────────────

interface BreakdownRowProps {
  stage: EmbudoStage;
  leadsNuevos: number;
  index: number;
  key?: React.Key;
}

function BreakdownRow({ stage, leadsNuevos, index }: BreakdownRowProps) {
  const isStar = !!stage.star;
  const isSoon = !!stage.soon;

  const pct = stage.count !== null
    ? (leadsNuevos > 0 ? Math.round((stage.count / leadsNuevos) * 100) : stage.pctOfLeads)
    : null;

  return (
    <div
      className="yc-funnel-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        opacity: 0,
        animation: `yc-fade-in 0.45s ${index * 60 + 80}ms ease forwards`,
        borderBottom: '1px solid var(--yc-border)',
      }}
    >
      {/* Stage label */}
      <div className="yc-funnel-label" style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isStar && (
            <span style={{ color: 'var(--yc-gold-2)', fontSize: 12, lineHeight: 1 }}>★</span>
          )}
          <span
            className="yc-stage-label"
            style={{
              color: isSoon
                ? 'var(--yc-text-faint)'
                : isStar
                ? 'var(--yc-text)'
                : 'var(--yc-text-mute)',
              fontWeight: isStar ? 600 : 500,
              fontSize: 13,
            }}
          >
            {stage.label}
          </span>
        </div>
        {isSoon && (
          <span
            className="yc-soon-badge"
            style={{ alignSelf: 'flex-start', borderColor: 'rgba(231,193,90,0.3)', color: 'var(--yc-gold-2)' }}
          >
            próximamente · conectá Calendly
          </span>
        )}
      </div>

      {/* Count */}
      <div style={{ flex: '0 0 80px', textAlign: 'right' }}>
        {isSoon ? (
          <span style={{ fontSize: 13, color: 'var(--yc-text-faint)', fontStyle: 'italic' }}>—</span>
        ) : (
          <span
            className="yc-num"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: isStar ? 'var(--yc-gold-2)' : 'var(--yc-text)',
              letterSpacing: '-0.02em',
            }}
          >
            {fmtNum(stage.count ?? 0)}
          </span>
        )}
      </div>

      {/* % of leads */}
      <div style={{ flex: '0 0 72px', textAlign: 'right' }}>
        {pct !== null && !isSoon ? (
          <span
            className="yc-num"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isStar ? 'var(--yc-gold)' : 'var(--yc-text-mute)',
            }}
          >
            {pct}%
          </span>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--yc-text-faint)' }}>—</span>
        )}
      </div>

      {/* Drop from previous */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {stage.dropFromPrev !== null && stage.dropFromPrev > 0 && !isSoon ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(232,122,122,0.08)',
              border: '1px solid rgba(232,122,122,0.18)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--yc-red)',
            }}
          >
            −{stage.dropFromPrev}% del paso anterior
          </span>
        ) : stage.dropFromPrev === 0 && !isSoon && stage.id !== 'leads' ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(78,201,138,0.07)',
              border: '1px solid rgba(78,201,138,0.18)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--yc-green)',
            }}
          >
            todas siguen
          </span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--yc-text-faint)' }}>—</span>
        )}
      </div>
    </div>
  );
}

// ── EmbudoView ────────────────────────────────────────────

export default function EmbudoView({ funnelRespondio, rangeLabel }: EmbudoViewProps) {
  const stages = buildEmbudo(funnelRespondio);
  const { leads_nuevos, venta_cerrada, venta_perdida, tiempo_resp_mediana_min } = funnelRespondio;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 1. Header card */}
      <div
        className="yc-glass yc-fade-up"
        style={{ animationDelay: '0ms', padding: '22px 26px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--yc-text)',
              }}
            >
              El embudo, en detalle
            </h1>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 13,
                color: 'var(--yc-text-mute)',
                lineHeight: 1.5,
                maxWidth: 520,
              }}
            >
              El recorrido de cada lead nuevo hasta llegar a venta, para el período seleccionado.
              Cada etapa muestra cuántos avanzan y cuántos se pierden en el camino.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            {/* Range badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--yc-border)',
                fontSize: 11.5,
                color: 'var(--yc-text-mute)',
              }}
            >
              <Icons.Trend size={13} />
              {rangeLabel}
            </div>

            {/* Response time badge — only if data exists */}
            {tiempo_resp_mediana_min !== null && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 11px',
                  borderRadius: 999,
                  background: 'rgba(111,179,232,0.08)',
                  border: '1px solid rgba(111,179,232,0.22)',
                  fontSize: 11.5,
                  color: 'var(--yc-blue)',
                  fontWeight: 600,
                }}
              >
                <Icons.Clock size={12} />
                respuesta típica: {fmtTime(tiempo_resp_mediana_min)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Funnel visual */}
      <Funnel
        stages={stages}
        leadsNuevos={leads_nuevos}
        ventaCerrada={venta_cerrada}
        ventaPerdida={venta_perdida}
        rangeLabel={rangeLabel}
        delay={120}
      />

      {/* 3. Breakdown table card */}
      <div
        className="yc-glass yc-fade-up"
        style={{ animationDelay: '260ms', padding: '22px 26px' }}
      >
        {/* Card header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--yc-gold-faint)',
                border: '1px solid rgba(231,193,90,0.22)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--yc-gold)',
              }}
            >
              <Icons.Funnel size={15} sw={1.8} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--yc-text)' }}>
                Etapa por etapa
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--yc-text-faint)' }}>
                cantidad · % del total · cuántas se perdieron
              </p>
            </div>
          </div>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 0 8px',
            borderBottom: '1px solid var(--yc-border)',
          }}
        >
          <div style={{ flex: '0 0 220px', fontSize: 12, fontWeight: 600, color: 'var(--yc-text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Etapa
          </div>
          <div style={{ flex: '0 0 80px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--yc-text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Personas
          </div>
          <div style={{ flex: '0 0 72px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--yc-text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            % total
          </div>
          <div style={{ flex: 1, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--yc-text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Se perdieron
          </div>
        </div>

        {/* Rows */}
        <div>
          {stages.map((stage, i) => (
            <BreakdownRow
              key={stage.id}
              stage={stage}
              leadsNuevos={leads_nuevos}
              index={i}
            />
          ))}
        </div>

        {/* Divider + result summary */}
        <div className="yc-divider" style={{ marginTop: 8 }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginTop: 14,
            paddingTop: 2,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--yc-text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Resultado final
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--yc-green)', fontWeight: 600 }}>
              <Icons.Check size={14} sw={2.2} />
              <span className="yc-num">{fmtNum(venta_cerrada)}</span>
              <span style={{ fontWeight: 400, color: 'var(--yc-text-mute)' }}>cerradas</span>
            </span>
            <span
              style={{
                width: 1,
                height: 14,
                background: 'var(--yc-border)',
                display: 'inline-block',
              }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--yc-red)', fontWeight: 600 }}>
              <Icons.X size={14} sw={2.2} />
              <span className="yc-num">{fmtNum(venta_perdida)}</span>
              <span style={{ fontWeight: 400, color: 'var(--yc-text-mute)' }}>perdidas</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
