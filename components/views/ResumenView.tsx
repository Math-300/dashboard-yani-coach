// Yani Coach Dashboard — ResumenView
// Assembles the "Mi negocio hoy" screen (Fase 3 port).
// All values from real hook data — zero hardcoded business numbers.
import React from 'react';
import { Icons } from '../yc/icons';
import { KpiCard } from '../yc/KpiCard';
import { Funnel } from '../yc/Funnel';
import { EquipoCard, type TeamMember } from '../yc/EquipoCard';
import { fmt } from '../yc/primitives';
import { formatDuration } from '../../services/format';
import {
  ventasCard,
  respuestaCard,
  leadsCard,
  buildEmbudo,
  miniSeries,
} from '../../services/resumenMappers';
import type { Sale, Seller, KpiCounts, Contact } from '../../types';
import type { FunnelRespondioRow, ResponsividadVendedoraRow } from '../../services/types';

// ── ActionableHint ────────────────────────────────────────
// Ported from diseno-aprobado/dashboard.jsx lines 471-529.
// Hidden when urgentFollowUps === 0.

interface ActionableHintProps {
  urgentFollowUps: number;
  delay?: number;
}

function ActionableHint({ urgentFollowUps, delay = 0 }: ActionableHintProps) {
  if (urgentFollowUps === 0) return null;

  return (
    <div
      className="yc-glass yc-glass-hover yc-fade-up"
      style={{
        animationDelay: `${delay}ms`,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'linear-gradient(180deg, rgba(231,193,90,0.07) 0%, rgba(231,193,90,0.02) 100%)',
        borderColor: 'rgba(231,193,90,0.22)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(231,193,90,0.14)',
          color: 'var(--yc-gold-2)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          border: '1px solid rgba(231,193,90,0.3)',
        }}
      >
        <Icons.Alert size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--yc-text)', marginBottom: 2 }}>
          Tenés{' '}
          <span style={{ color: 'var(--yc-red)' }}>
            {fmt.num(urgentFollowUps)} {urgentFollowUps === 1 ? 'seguimiento vencido' : 'seguimientos vencidos'}
          </span>{' '}
          para retomar
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--yc-text-mute)' }}>
          {urgentFollowUps === 1
            ? 'Un lead que tocaba volver a contactar y ya pasó la fecha — mejor no lo dejes enfriar.'
            : 'Leads que tocaba volver a contactar y ya pasó la fecha — mejor no los dejes enfriar.'}
        </div>
      </div>
      <button
        style={{
          padding: '8px 14px',
          borderRadius: 10,
          border: '1px solid rgba(231,193,90,0.35)',
          background: 'linear-gradient(180deg, rgba(231,193,90,0.18), rgba(231,193,90,0.06))',
          color: 'var(--yc-gold-2)',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        Ver chats
        <Icons.ChevronRight size={14} />
      </button>
    </div>
  );
}

// ── rangeLabel helper ─────────────────────────────────────

function presetToLabel(presetId: string): string {
  switch (presetId) {
    case 'today': return 'hoy';
    case 'yesterday': return 'ayer';
    case '7d':
    case 'week': return 'últimos 7 días';
    case 'last_30_days': return 'últimos 30 días';
    case 'month': return 'este mes';
    case 'last_month': return 'mes pasado';
    case 'last_6_months': return 'últimos 6 meses';
    default: return 'período seleccionado';
  }
}

// ── Team derivation helpers ───────────────────────────────

/**
 * Derive a short display name from vendedora_nombre.
 * "María Beatriz Juzviachik" → "María Juzviachik"
 * "María del Carmen Vera"    → "María Vera"
 * Falls back to first word if only one token.
 */
function shortName(nombre: string | null): string {
  if (!nombre) return 'Asesora';
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  // Use first token + last token to keep names distinguishable
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function deriveTeam(responsividad: ResponsividadVendedoraRow[]): TeamMember[] {
  if (responsividad.length === 0) return [];

  // Find the lowest median time → gets green; others get gold
  const bestTime = Math.min(...responsividad.map((r) => r.resp_mediana_min ?? Infinity));

  return responsividad.map((r) => {
    const isBest = (r.resp_mediana_min ?? Infinity) === bestTime;
    return {
      name: shortName(r.vendedora_nombre),
      chats: r.chats_respondidos,
      time: r.resp_mediana_min == null ? null : Math.round(r.resp_mediana_min),
      color: isBest ? 'var(--yc-green)' : 'var(--yc-gold)',
      tone: isBest ? '#1e3a2a' : '#3a2f1c',
    };
  });
}

// ── ResumenView ───────────────────────────────────────────

export interface ResumenViewProps {
  sales: Sale[];
  funnelRespondio: FunnelRespondioRow;
  responsividad: ResponsividadVendedoraRow[];
  kpiCounts: KpiCounts;
  sellers: Seller[];
  contacts: Contact[];
  rangeLabel: string;
}

export function ResumenView({
  sales,
  funnelRespondio,
  responsividad,
  kpiCounts,
  contacts,
  rangeLabel,
}: ResumenViewProps) {
  // ── mapper outputs ────────────────────────────────────
  const ventas = ventasCard(sales);
  const respuesta = respuestaCard(funnelRespondio, responsividad, kpiCounts.urgentFollowUps);
  const leads = leadsCard(funnelRespondio);
  const stages = buildEmbudo(funnelRespondio);
  const team = deriveTeam(responsividad);

  // ── Sparklines (datos reales: forma de la tendencia en el período) ──
  // Ventas por tramo (suma de montos) y leads por tramo (conteo de altas).
  // Respuesta NO tiene serie diaria honesta → sin sparkline.
  const ventasSpark = miniSeries(sales, (s) => s.date, (s) => s.amount || 0);
  const leadsSpark = miniSeries(contacts, (c) => c.createdAt, () => 1);

  // ── KPI: Ventas — mini rows ───────────────────────────
  const ventasMini = [
    { label: 'Ventas cerradas', value: String(ventas.count) },
    { label: 'Ticket promedio', value: fmt.ars(ventas.ticketPromedio) },
  ];

  // ── KPI: Respuesta — mini rows ────────────────────────
  const respMini: { label: string; value: string; accent?: string }[] = [
    {
      label: 'Seguimientos vencidos',
      value: fmt.num(respuesta.sinAtender),
      accent: 'var(--yc-red)',
    },
    ...respuesta.porVendedora.map((r) => ({
      label: shortName(r.vendedora_nombre),
      value: `${r.resp_mediana_min == null ? 'sin dato' : formatDuration(r.resp_mediana_min)} · ${r.chats_respondidos} respuestas`,
    })),
  ];

  // ── KPI: Leads — mini rows ────────────────────────────
  const leadsMini = [
    { label: 'Tasa de respuesta', value: `${leads.tasaRespuesta}%`, accent: 'var(--yc-blue)' },
    { label: 'Llegaron a venta', value: String(leads.llegaronVenta), accent: 'var(--yc-green)' },
  ];

  // ── Sparklines (real data only) ───────────────────────
  // Sales sparkline: NOT computed here — no daily series available without
  // bucketing sales by day across the range, which requires the date range
  // endpoints. Omitted to stay honest. (See task spec: "omit rather than fake")

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 1. Actionable hint — hidden when 0 urgent follow-ups */}
      <ActionableHint urgentFollowUps={kpiCounts.urgentFollowUps} delay={0} />

      {/* 2. KPI row — 3 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <KpiCard
          delay={120}
          icon={Icons.Dollar}
          accent="var(--yc-gold)"
          question="¿Cuánto vendimos?"
          valueRaw={ventas.total}
          valueDisplay={fmt.ars}
          sub={ventas.count === 0
            ? 'sin ventas en el período'
            : `en ${ventas.count} ${ventas.count === 1 ? 'venta' : 'ventas'}`}
          spark={ventasSpark.length > 0 ? ventasSpark : undefined}
          mini={ventasMini}
        />
        <KpiCard
          delay={220}
          icon={Icons.Clock}
          accent="var(--yc-blue)"
          question="¿El equipo responde bien?"
          valueRaw={respuesta.medianaMin ?? 0}
          valueDisplay={(v) => (respuesta.medianaMin == null ? 'sin dato' : formatDuration(v))}
          sub="tardan en contestar al lead"
          mini={respMini}
        />
        <KpiCard
          delay={320}
          icon={Icons.Target}
          accent="var(--yc-green)"
          question="¿Cuántos respondieron?"
          valueRaw={leads.respondieron}
          valueDisplay={(n) => `${fmt.num(n)} de ${fmt.num(leads.leadsNuevos)}`}
          sub="leads nuevos te contestaron"
          spark={leadsSpark.length > 0 ? leadsSpark : undefined}
          mini={leadsMini}
        />
      </div>

      {/* 3. Funnel + Equipo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16 }}>
        <Funnel
          stages={stages}
          leadsNuevos={funnelRespondio.leads_nuevos}
          ventaCerrada={funnelRespondio.venta_cerrada}
          ventaPerdida={funnelRespondio.venta_perdida}
          rangeLabel={rangeLabel}
          delay={500}
        />
        <EquipoCard
          team={team}
          sinAtender={kpiCounts.urgentFollowUps}
          delay={600}
        />
      </div>
    </div>
  );
}

// Re-export for consumers that don't need the full view
export { presetToLabel };
