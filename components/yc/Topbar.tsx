// Yani Coach Dashboard — Topbar component
// Ported verbatim from diseno-aprobado/dashboard.jsx (lines 415-467)
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './icons';
import { PulseDot } from './primitives';
import DateRangePicker from '../DateRangePicker';
import { getPresetRange, type DateRangePreset } from '../../services/dateUtils';

// Mapping from pill id → DateRangePreset (using the preset ids defined in dateUtils.ts)
const PILL_PRESET_MAP: Record<string, DateRangePreset> = {
  today: 'today',
  '7d': 'week',
  month: 'month',
};

const PILL_LABELS: Record<string, string> = {
  today: 'Hoy',
  '7d': 'Últimos 7 días',
  month: 'Este mes',
};

const PILL_IDS = ['today', '7d', 'month'] as const;

interface TopbarProps {
  title?: string;
  subtitle?: string;
  /** One of: 'today' | '7d' | 'month' | 'custom' */
  activeRange: string;
  onRangeChange: (presetId: string, start: Date, end: Date) => void;
  lastUpdatedLabel: string;
  /** Current start date — needed to pass to DateRangePicker */
  startDate: Date;
  /** Current end date — needed to pass to DateRangePicker */
  endDate: Date;
}

export function Topbar({
  title,
  subtitle,
  activeRange,
  onRangeChange,
  lastUpdatedLabel,
  startDate,
  endDate,
}: TopbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  // Default subtitle: today in es-AR + tagline
  const defaultSubtitle =
    new Date().toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }) + ' · una mirada rápida a cómo viene la semana';

  return (
    <header
      style={{
        height: 72,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '0 32px',
        borderBottom: '1px solid var(--yc-border)',
        background: 'rgba(14,14,18,0.45)',
        backdropFilter: 'blur(14px)',
        position: 'relative',
        zIndex: 4,
      }}
    >
      {/* Title + subtitle */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>
          {title ? (
            title
          ) : (
            <>
              Mi negocio <span className="yc-gold-text" style={{ fontWeight: 600 }}>hoy</span>
            </>
          )}
        </h1>
        <span style={{ fontSize: 12, color: 'var(--yc-text-faint)', marginTop: 4 }}>
          {subtitle ?? defaultSubtitle}
        </span>
      </div>

      {/* Range pills + custom picker */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        {PILL_IDS.map((id) => (
          <button
            key={id}
            className={`yc-pill${activeRange === id ? ' is-active' : ''}`}
            onClick={() => {
              const preset = PILL_PRESET_MAP[id];
              const { start, end } = getPresetRange(preset);
              onRangeChange(id, start, end);
              setPickerOpen(false);
            }}
          >
            {PILL_LABELS[id]}
          </button>
        ))}

        {/* Custom range pill (dashed) */}
        <div ref={pickerRef} style={{ position: 'relative' }}>
          <button
            className={`yc-pill${activeRange === 'custom' ? ' is-active' : ''}`}
            style={{ borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => setPickerOpen((v) => !v)}
          >
            <Icons.Calendar size={13} />
            Rango personalizado
          </button>

          {/* Popover with DateRangePicker */}
          {pickerOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                zIndex: 50,
              }}
            >
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end, preset) => {
                  onRangeChange(preset ?? 'custom', start, end);
                  setPickerOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 28, width: 1, background: 'var(--yc-border)', flexShrink: 0 }} />

      {/* Freshness indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--yc-text-mute)', fontSize: 12.5, flexShrink: 0 }}>
        <PulseDot />
        <span>
          {lastUpdatedLabel !== 'se actualiza solo' ? (
            <>
              Actualizado hace <strong style={{ color: 'var(--yc-text)', fontWeight: 600 }}>{lastUpdatedLabel}</strong> · se refresca solo
            </>
          ) : (
            'Actualizado · se refresca solo'
          )}
        </span>
      </div>
    </header>
  );
}

export default Topbar;
