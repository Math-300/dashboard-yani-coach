// Yani Coach Dashboard — KpiCard component
// Ported from diseno-aprobado/dashboard.jsx lines 533-598
import React from 'react';
import { useCountUp, Sparkline, MiniRow } from './primitives';
import { Icons } from './icons';

export interface KpiCardChange {
  up: boolean;
  value: string;
  note: string;
}

export interface KpiCardMiniRow {
  label: string;
  value: string;
  accent?: string;
}

export interface KpiCardProps {
  icon: React.ComponentType<{ size?: number; sw?: number }>;
  accent?: string;
  question: string;
  valueDisplay: (n: number) => string;
  valueRaw: number;
  change?: KpiCardChange;
  sub?: string;
  mini?: KpiCardMiniRow[];
  spark?: number[];
  delay?: number;
}

export function KpiCard({
  icon: Icon,
  accent = 'var(--yc-gold)',
  question,
  valueDisplay,
  valueRaw,
  change,
  sub,
  mini = [],
  spark,
  delay = 0,
}: KpiCardProps) {
  const animated = useCountUp(valueRaw, { duration: 1400, delay }) as number;

  return (
    <article
      className="yc-glass yc-glass-hover yc-fade-up"
      style={{ animationDelay: `${delay}ms`, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 200 }}
    >
      {/* header: icon + question */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${accent}33 0%, ${accent}10 100%)`,
            color: accent,
            border: `1px solid ${accent}40`,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={17} sw={1.8} />
        </div>
        <span style={{ fontSize: 13.5, color: 'var(--yc-text-mute)', fontWeight: 500 }}>{question}</span>
      </div>

      {/* big number + sparkline + change */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span
            className="yc-num"
            style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1, color: 'var(--yc-text)' }}
          >
            {valueDisplay(animated)}
          </span>
          {change && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12.5,
                color: change.up ? 'var(--yc-green)' : 'var(--yc-red)',
                fontWeight: 600,
              }}
            >
              {change.up ? <Icons.ArrowUp size={12} sw={2.2} /> : <Icons.ArrowDown size={12} sw={2.2} />}
              {change.value}
              <span style={{ color: 'var(--yc-text-faint)', fontWeight: 400, marginLeft: 2 }}>{change.note}</span>
            </span>
          )}
          {!change && sub && (
            <span style={{ fontSize: 12.5, color: 'var(--yc-text-faint)' }}>{sub}</span>
          )}
        </div>
        {spark && spark.length >= 2 && (
          <div style={{ flexShrink: 0 }}>
            <Sparkline points={spark} color={accent} w={96} h={36} delay={delay + 250} />
          </div>
        )}
      </div>

      {mini.length > 0 && (
        <>
          <div className="yc-divider" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {mini.map((m, i) => (
              <MiniRow key={i} label={m.label} value={m.value} accent={m.accent} />
            ))}
          </div>
        </>
      )}
    </article>
  );
}
