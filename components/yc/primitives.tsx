// Yani Coach Dashboard — shared primitive components and hooks
import React, { useState, useEffect, useRef, useId } from 'react';
import { formatDuration } from '../../services/format';

// ── HOOKS ─────────────────────────────────────────────────

export interface UseCountUpOptions {
  duration?: number;
  delay?: number;
  decimals?: number;
  enabled?: boolean;
}

/** Animated count-up. Cubic-bezier ease. Respects prefers-reduced-motion. */
export function useCountUp(
  target: number,
  { duration = 1400, delay = 0, decimals = 0, enabled = true }: UseCountUpOptions = {}
): number | string {
  const [v, setV] = useState<number>(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) { setV(target); return; }
    let raf: number;
    const start = performance.now() + delay;
    const from = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = ease(t);
      setV(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay, enabled]);

  return decimals > 0 ? v.toFixed(decimals) : Math.round(v);
}

/** Mounted-flag for skeleton → real-content swap. */
export function useAfterMount(ms = 700): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return done;
}

// ── SHARED PIECES ─────────────────────────────────────────

export interface SparklineProps {
  points: number[];
  color?: string;
  w?: number;
  h?: number;
  delay?: number;
  fill?: boolean;
}

/** Animated polyline sparkline. Draws on mount via stroke-dasharray. */
export function Sparkline({
  points,
  color = 'var(--yc-gold)',
  w = 92,
  h = 32,
  delay = 0,
  fill = true,
}: SparklineProps) {
  const uid = useId();
  // useId includes colons which are invalid in SVG id — strip them
  const gid = `spark-${uid.replace(/:/g, '')}`;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const path = points
    .map((y, i) => {
      const x = (i / (points.length - 1)) * (w - 4) + 2;
      const yy = h - 2 - ((y - min) / range) * (h - 6);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yy.toFixed(1)}`;
    })
    .join(' ');

  const lastX = w - 2;
  const lastY = h - 2 - ((points[points.length - 1] - min) / range) * (h - 6);
  const areaPath = `${path} L ${lastX} ${h} L 2 ${h} Z`;

  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <path
          d={areaPath}
          fill={`url(#${gid})`}
          opacity={0}
          style={{ animation: `yc-fade-in 0.8s ${delay + 400}ms ease forwards` }}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 240,
          strokeDashoffset: 240,
          animation: `yc-spark-draw 1.2s ${delay}ms cubic-bezier(.2,.7,.2,1) forwards`,
          ['--spark-len' as string]: 240,
        }}
      />
      <circle
        cx={lastX}
        cy={lastY}
        r="3"
        fill={color}
        opacity={0}
        style={{ animation: `yc-fade-in 0.4s ${delay + 1100}ms ease forwards` }}
      />
    </svg>
  );
}

export interface PulseDotProps {
  color?: string;
}

/** Pulsing green dot for "live" indicators. */
export function PulseDot({ color = 'var(--yc-green)' }: PulseDotProps) {
  return (
    <span
      className="yc-pulse"
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  );
}

export interface MiniRowProps {
  label: string;
  value: string | number;
  accent?: string;
  key?: React.Key;
}

/** Single mini-row: label + bold value with optional color */
export function MiniRow({ label, value, accent }: MiniRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
      <span style={{ fontSize: 12.5, color: 'var(--yc-text-mute)', fontWeight: 500 }}>{label}</span>
      <span className="yc-num" style={{ fontSize: 13.5, fontWeight: 600, color: accent || 'var(--yc-text)' }}>{value}</span>
    </div>
  );
}

/** Helper for currency / number formatting */
export const fmt = {
  ars: (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`,
  num: (n: number) => Math.round(n).toLocaleString('es-AR'),
  min: (n: number) => `${Math.round(n)} min`,
  dur: (n: number) => formatDuration(n),
};

// Silence unused import warning — useRef is available for consumers
void useRef;
