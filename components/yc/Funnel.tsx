// Yani Coach Dashboard — Funnel, FunnelRow, ResultCard components
// Ported from diseno-aprobado/dashboard.jsx lines 600-791
import React from 'react';
import { useCountUp, fmt } from './primitives';
import { Icons } from './icons';
import type { EmbudoStage } from '../../services/types';

// ── ResultCard ────────────────────────────────────────────

interface ResultCardProps {
  kind: 'win' | 'lose';
  target: number;
  delay: number;
}

function ResultCard({ kind, target, delay }: ResultCardProps) {
  const isWin = kind === 'win';
  const n = useCountUp(target, { duration: 1100, delay }) as number;
  const color = isWin ? 'var(--yc-green)' : 'var(--yc-red)';
  const label = isWin ? 'Venta cerrada' : 'Venta perdida';
  const Icon = isWin ? Icons.Check : Icons.X;
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        background: isWin
          ? 'linear-gradient(180deg, rgba(78,201,138,0.10) 0%, rgba(78,201,138,0.02) 100%)'
          : 'linear-gradient(180deg, rgba(232,122,122,0.08) 0%, rgba(232,122,122,0.015) 100%)',
        border: `1px solid ${isWin ? 'rgba(78,201,138,0.22)' : 'rgba(232,122,122,0.2)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: isWin ? 'rgba(78,201,138,0.18)' : 'rgba(232,122,122,0.18)',
          color,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={15} sw={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--yc-text-mute)' }}>{label}</div>
        <div
          className="yc-num"
          style={{ fontSize: 24, fontWeight: 600, color, letterSpacing: '-0.02em', lineHeight: 1.1 }}
        >
          {fmt.num(n)}
        </div>
      </div>
    </div>
  );
}

// ── FunnelRow ─────────────────────────────────────────────

interface FunnelRowProps {
  stage: EmbudoStage;
  leadsNuevos: number;
  index: number;
  baseDelay: number;
  key?: React.Key;
}

function buildHint(stage: EmbudoStage, leadsNuevos: number): string {
  if (stage.soon) return 'se activa cuando conectes Calendly';
  if (stage.id === 'leads') return 'todas las que entraron en el período';
  if (stage.id === 'primer_mensaje') {
    return `contactadas por el equipo · ${stage.pctOfLeads}%`;
  }
  if (stage.star) {
    // respondieron
    const cold = leadsNuevos - (stage.count ?? 0);
    return `contestaron ${stage.pctOfLeads}% · se enfriaron ${cold}`;
  }
  if (stage.id === 'interesados') {
    const pctOfResp = stage.dropFromPrev != null ? 100 - stage.dropFromPrev : stage.pctOfLeads;
    return `avanzaron ${pctOfResp}% de los que respondieron`;
  }
  return '';
}

function FunnelRow({ stage, leadsNuevos, index, baseDelay }: FunnelRowProps) {
  const delay = baseDelay + index * 110;
  const widthPct = stage.count != null ? (stage.count / leadsNuevos) * 100 : 55;
  const animated = useCountUp(stage.count ?? 0, {
    duration: 1100,
    delay: delay + 200,
    enabled: !stage.soon,
  }) as number;

  const hint = buildHint(stage, leadsNuevos);

  // Delta annotation derived from stage data
  const hasDelta = stage.id !== 'leads' && !stage.soon;
  const deltaText = (): { label: string; extra: string | null } => {
    if (stage.id === 'primer_mensaje') return { label: 'todas siguen', extra: null };
    if (stage.dropFromPrev != null && stage.dropFromPrev > 0) {
      const pctAdv = 100 - stage.dropFromPrev;
      const prev =
        stage.id === 'respondieron'
          ? leadsNuevos          // primer_mensaje == leadsNuevos in most cases
          : null;
      const lost =
        stage.id === 'respondieron' && prev != null
          ? prev - (stage.count ?? 0)
          : null;
      return {
        label: `↓ avanzó el ${pctAdv}%`,
        extra: lost != null ? `· no siguieron ${lost}` : null,
      };
    }
    return { label: '↓ avanzó el 100%', extra: null };
  };

  const delta = hasDelta ? deltaText() : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* left: stage name */}
        <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {stage.star && (
              <span style={{ color: 'var(--yc-gold-2)', fontSize: 12 }}>★</span>
            )}
            <span
              className="yc-stage-label"
              style={{
                color: stage.soon
                  ? 'var(--yc-text-faint)'
                  : stage.star
                  ? 'var(--yc-text)'
                  : 'var(--yc-text-mute)',
                fontWeight: stage.star ? 600 : 500,
              }}
            >
              {stage.label}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>{hint}</span>
        </div>

        {/* bar */}
        <div style={{ flex: 1, position: 'relative', height: 38, display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: `${widthPct}%`,
              height: 38,
              borderRadius: 10,
              transformOrigin: 'left center',
              animation: `yc-bar-grow 0.95s ${delay}ms cubic-bezier(.2,.7,.2,1) forwards`,
              transform: 'scaleX(0)',
              background: stage.soon
                ? 'transparent'
                : stage.star
                ? 'linear-gradient(90deg, rgba(231,193,90,0.45) 0%, rgba(231,193,90,0.22) 100%)'
                : 'linear-gradient(90deg, rgba(231,193,90,0.22) 0%, rgba(231,193,90,0.06) 100%)',
              border: stage.soon
                ? '1px dashed rgba(255,255,255,0.18)'
                : stage.star
                ? '1px solid rgba(231,193,90,0.4)'
                : '1px solid rgba(231,193,90,0.18)',
              boxShadow: stage.star
                ? '0 0 24px rgba(231,193,90,0.15), inset 0 1px 0 rgba(255,255,255,0.08)'
                : 'inset 0 1px 0 rgba(255,255,255,0.04)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 16,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {!stage.soon && (
              <span
                className="yc-num"
                style={{ fontSize: 18, fontWeight: 600, color: stage.star ? 'var(--yc-gold-2)' : 'var(--yc-text)' }}
              >
                {fmt.num(animated)}
              </span>
            )}
            {stage.soon && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--yc-text-faint)' }}>
                <span
                  className="yc-soon-badge"
                  style={{ borderColor: 'rgba(231,193,90,0.3)', color: 'var(--yc-gold-2)' }}
                >
                  próximamente
                </span>
                <span style={{ fontSize: 12, fontStyle: 'italic' }}>conectá Calendly para activar</span>
              </span>
            )}
            {/* gold sweep highlight for star row */}
            {stage.star && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,235,170,0.18), transparent)',
                  backgroundSize: '50% 100%',
                  backgroundRepeat: 'no-repeat',
                  animation: `yc-gold-sweep 2.6s ${delay + 1200}ms ease-in-out infinite`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* between-stage delta annotation */}
      {delta && (
        <div
          style={{
            marginLeft: 196,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingLeft: 8,
            height: 18,
            opacity: 0,
            animation: `yc-fade-in 0.5s ${delay + 800}ms ease forwards`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: stage.star ? 'var(--yc-blue)' : 'var(--yc-text-faint)',
              fontWeight: 600,
            }}
          >
            {delta.label}
          </span>
          {delta.extra && (
            <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>{delta.extra}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Funnel ────────────────────────────────────────────────

export interface FunnelProps {
  stages: EmbudoStage[];
  leadsNuevos: number;
  ventaCerrada: number;
  ventaPerdida: number;
  rangeLabel: string;
  delay?: number;
}

export function Funnel({
  stages,
  leadsNuevos,
  ventaCerrada,
  ventaPerdida,
  rangeLabel,
  delay = 0,
}: FunnelProps) {
  return (
    <section
      className="yc-glass yc-fade-up"
      style={{ animationDelay: `${delay}ms`, padding: 26, display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em' }}>El camino del lead</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--yc-text-mute)' }}>
            de las {leadsNuevos} personas nuevas, así se mueven hasta la venta
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 11px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--yc-border)',
            fontSize: 11.5,
            color: 'var(--yc-text-mute)',
            flexShrink: 0,
          }}
        >
          <Icons.Trend size={13} />
          {rangeLabel}
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {stages.map((s, i) => (
          <FunnelRow key={s.id} stage={s} leadsNuevos={leadsNuevos || 1} index={i} baseDelay={delay + 200} />
        ))}
      </div>

      {/* Resultado final: cerradas + perdidas */}
      <div className="yc-divider" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--yc-text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          Resultado final
        </span>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ResultCard kind="win" target={ventaCerrada} delay={delay + 1100} />
          <ResultCard kind="lose" target={ventaPerdida} delay={delay + 1250} />
        </div>
      </div>
    </section>
  );
}
