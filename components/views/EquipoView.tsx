// Yani Coach Dashboard — EquipoView
// Fuses PerformanceView + TeamView into a single "Equipo" detail view
// re-skinned to the approved glass-dark mockup aesthetic.
// Props are wired by the controller (App.tsx) — this file only renders.

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Seller, Contact, Interaction, Sale, LeadStatus, InteractionType } from '../../types';
import type { ResponsividadVendedoraRow, ResponsividadGeneralRow } from '../../services/types';
import { fmt, useCountUp } from '../yc/primitives';
import { formatDuration } from '../../services/format';
import { isDateInRange } from '../../services/dateUtils';

// ── Props ──────────────────────────────────────────────────

export interface EquipoViewProps {
  sellers: Seller[];
  responsividad: ResponsividadVendedoraRow[];
  responsividadGeneral: ResponsividadGeneralRow[];
  sales: Sale[];
  interactions: Interaction[];
  contacts: Contact[];
  dateRange: { start: Date; end: Date };
  rangeLabel: string;
}

// ── Types (internal) ──────────────────────────────────────

interface SellerRow {
  id: string;
  name: string;
  shortName: string;
  avatarUrl?: string;
  salesCount: number;
  salesAmount: number;
  closeRate: number;
  avgSalesCycle: number;
  avgLeadAge: number;
  avgTouchesPerSale: string;
  activeLeads: number;
  interactionsCount: number;
  leadsAssigned: number;
  // responsividad (filtrada por período — sólo para chatsRespondidos)
  chatsRespondidos: number;
  respMedianaMin: number | null;
  // responsividad general (30 días estable)
  respGeneralMedianaMin: number | null;
  respGeneralBMenos15: number;
  respGeneralB1560: number;
  respGeneralB14h: number;
  respGeneralBMas4h: number;
  // rank
  rank: number;
}

// ── Helpers ───────────────────────────────────────────────

/** Returns a human-readable short name (first name or first two words). */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}

/** Rank badge emoji or text. */
function rankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

/** Color for response time bar: green ≤15 min, gold ≤30 min, red >30 min. */
function respColor(minutes: number | null): string {
  if (minutes === null) return 'var(--yc-text-faint)';
  if (minutes <= 15) return 'var(--yc-green)';
  if (minutes <= 30) return 'var(--yc-gold)';
  return 'var(--yc-red)';
}

/** Width % for the mini response-time bar (reference = 30 min). */
function respBarWidth(minutes: number | null): number {
  if (minutes === null) return 0;
  return Math.min(100, (minutes / 30) * 100);
}

// ── Animated seller row ───────────────────────────────────

interface SellerRowCardProps {
  row: SellerRow;
  delay: number;
  isTop: boolean;
}

const SellerRowCard: React.FC<SellerRowCardProps> = function SellerRowCard({ row, delay, isTop }) {
  const animAmount = useCountUp(row.salesAmount, { duration: 1000, delay: delay + 100 }) as number;
  const color = isTop ? 'var(--yc-gold)' : row.rank === 2 ? 'var(--yc-gold-2)' : 'var(--yc-text-mute)';
  const avatarBg = isTop
    ? 'linear-gradient(135deg, #3a2f1c 0%, rgba(0,0,0,0.4) 100%)'
    : 'linear-gradient(135deg, #1c1c2a 0%, rgba(0,0,0,0.4) 100%)';

  return (
    <div
      className="yc-glass yc-glass-hover yc-fade-up"
      style={{
        animationDelay: `${delay}ms`,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        borderColor: isTop ? 'rgba(231,193,90,0.22)' : 'var(--yc-border)',
        background: isTop
          ? 'linear-gradient(180deg, rgba(231,193,90,0.07) 0%, rgba(231,193,90,0.02) 100%)'
          : undefined,
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          width: 28,
          textAlign: 'center',
          fontSize: row.rank <= 3 ? 18 : 13,
          fontWeight: 700,
          color: 'var(--yc-text-mute)',
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {rankBadge(row.rank)}
      </div>

      {/* Avatar */}
      <div
        className="yc-avatar"
        style={{
          background: avatarBg,
          color,
          borderColor: isTop ? 'rgba(231,193,90,0.3)' : 'rgba(255,255,255,0.1)',
          width: 36,
          height: 36,
          fontSize: 14,
        }}
      >
        {row.shortName[0].toUpperCase()}
      </div>

      {/* Name + interactions */}
      <div style={{ width: 110, flexShrink: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: isTop ? 'var(--yc-gold-2)' : 'var(--yc-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.shortName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--yc-text-faint)', marginTop: 2 }}>
          {row.interactionsCount} interacciones
        </div>
      </div>

      {/* Sales count + amount */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            className="yc-num"
            style={{ fontSize: 18, fontWeight: 700, color, letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            {fmt.ars(animAmount)}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--yc-text-mute)' }}>
            · {row.salesCount} {row.salesCount === 1 ? 'venta' : 'ventas'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          {/* Close rate pill */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 99,
              background: row.closeRate > 10
                ? 'rgba(78,201,138,0.13)'
                : 'rgba(231,193,90,0.1)',
              color: row.closeRate > 10 ? 'var(--yc-green)' : 'var(--yc-gold)',
              border: `1px solid ${row.closeRate > 10 ? 'rgba(78,201,138,0.25)' : 'rgba(231,193,90,0.2)'}`,
            }}
          >
            {row.closeRate.toFixed(0)}% conversión
          </span>
          {/* Leads */}
          <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>
            {row.activeLeads} leads abiertos
          </span>
          {/* Cycle */}
          {row.avgSalesCycle > 0 && (
            <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>
              {row.avgSalesCycle}d hasta la venta
            </span>
          )}
        </div>
      </div>

      {/* Responsividad block — fuente: promedio general 30 días */}
      <div style={{ width: 116, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 10, color: 'var(--yc-text-faint)', lineHeight: 1.2 }}>
            tiempo típico<br />
            <span style={{ fontSize: 9, opacity: 0.7 }}>30d · 8–22h</span>
          </span>
          <span
            className="yc-num"
            style={{ fontSize: 13, fontWeight: 600, color: respColor(row.respGeneralMedianaMin) }}
          >
            {row.respGeneralMedianaMin !== null
              ? formatDuration(row.respGeneralMedianaMin)
              : 'sin dato'}
          </span>
        </div>
        {/* Barra apilada de 4 tramos */}
        {(() => {
          const tot =
            row.respGeneralBMenos15 +
            row.respGeneralB1560 +
            row.respGeneralB14h +
            row.respGeneralBMas4h;
          if (tot === 0) return (
            <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} />
          );
          const seg = (n: number, c: string, label: string) =>
            n > 0 ? (
              <div
                key={label}
                title={`${label}: ${n}`}
                style={{ width: `${(n / tot) * 100}%`, background: c, height: '100%' }}
              />
            ) : null;
          return (
            <div
              style={{
                height: 7,
                borderRadius: 4,
                overflow: 'hidden',
                display: 'flex',
                gap: 1,
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              {seg(row.respGeneralBMenos15, 'var(--yc-green)', 'Menos de 15 min')}
              {seg(row.respGeneralB1560, 'var(--yc-gold)', '15 min – 1 h')}
              {seg(row.respGeneralB14h, '#f0a050', '1 – 4 h')}
              {seg(row.respGeneralBMas4h, 'var(--yc-red)', 'Más de 4 horas')}
            </div>
          );
        })()}
        <div style={{ fontSize: 10, color: 'var(--yc-text-faint)', marginTop: 3 }}>
          {row.chatsRespondidos > 0 ? `${row.chatsRespondidos} resp. (período)` : 'sin datos período'}
        </div>
      </div>
    </div>
  );
}

// ── Custom bar chart tooltip ──────────────────────────────

interface ChartPayloadItem {
  payload: { name: string; amount: number };
  value: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: ChartPayloadItem[];
}

function SalesBarTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: 'var(--yc-bg-3)',
        border: '1px solid var(--yc-border-hi)',
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 13,
        color: 'var(--yc-text)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{d.name}</div>
      <div style={{ color: 'var(--yc-gold)' }}>{fmt.ars(d.amount)}</div>
    </div>
  );
}

// ── Summary insight strip ────────────────────────────────

interface InsightProps {
  rows: SellerRow[];
}

function Insights({ rows }: InsightProps) {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => b.salesAmount - a.salesAmount);
  const top = sorted[0];

  const byResp = rows
    .filter((r) => r.respGeneralMedianaMin !== null)
    .sort((a, b) => (a.respGeneralMedianaMin ?? 9999) - (b.respGeneralMedianaMin ?? 9999));
  const fastest = byResp[0] ?? null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* Top seller */}
      <div
        className="yc-glass yc-fade-up"
        style={{
          flex: '1 1 200px',
          padding: '14px 18px',
          animationDelay: '50ms',
          borderColor: 'rgba(231,193,90,0.18)',
          background: 'linear-gradient(180deg, rgba(231,193,90,0.06) 0%, transparent 100%)',
        }}
      >
        <div style={{ fontSize: 11.5, color: 'var(--yc-text-mute)', marginBottom: 4 }}>
          Más ventas
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🥇</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--yc-gold-2)' }}>
              {top.shortName}
            </div>
            <div
              className="yc-num"
              style={{ fontSize: 12, color: 'var(--yc-text-mute)', marginTop: 1 }}
            >
              {fmt.ars(top.salesAmount)} · {top.salesCount} {top.salesCount === 1 ? 'venta' : 'ventas'}
            </div>
          </div>
        </div>
      </div>

      {/* Fastest responder */}
      {fastest && (
        <div
          className="yc-glass yc-fade-up"
          style={{
            flex: '1 1 200px',
            padding: '14px 18px',
            animationDelay: '150ms',
            borderColor: 'rgba(78,201,138,0.18)',
            background: 'linear-gradient(180deg, rgba(78,201,138,0.05) 0%, transparent 100%)',
          }}
        >
          <div style={{ fontSize: 11.5, color: 'var(--yc-text-mute)', marginBottom: 4 }}>
            Responde más rápido
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--yc-green)' }}>
                {fastest.shortName}
              </div>
              <div
                className="yc-num"
                style={{ fontSize: 12, color: 'var(--yc-text-mute)', marginTop: 1 }}
              >
                {formatDuration(fastest.respGeneralMedianaMin!)} típico 30d
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team total */}
      <div
        className="yc-glass yc-fade-up"
        style={{
          flex: '1 1 200px',
          padding: '14px 18px',
          animationDelay: '250ms',
        }}
      >
        <div style={{ fontSize: 11.5, color: 'var(--yc-text-mute)', marginBottom: 4 }}>
          Total equipo
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>👥</span>
          <div>
            <div
              className="yc-num"
              style={{ fontSize: 14, fontWeight: 700, color: 'var(--yc-text)' }}
            >
              {fmt.ars(rows.reduce((s, r) => s + r.salesAmount, 0))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--yc-text-mute)', marginTop: 1 }}>
              {rows.reduce((s, r) => s + r.salesCount, 0)} ventas ·{' '}
              {rows.filter((r) => r.salesAmount > 0 || r.activeLeads > 0).length} activas
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────

export default function EquipoView({
  sellers,
  responsividad,
  responsividadGeneral,
  sales,
  interactions,
  contacts,
  dateRange,
  rangeLabel,
}: EquipoViewProps) {
  // Build one enriched row per seller
  const rows = useMemo<SellerRow[]>(() => {
    if (sellers.length === 0) return [];

    const respMap = new Map<string, ResponsividadVendedoraRow>();
    responsividad.forEach((r) => {
      // match by id first, then by name
      if (r.vendedora_id) respMap.set(r.vendedora_id, r);
    });
    // also index by name for fallback
    const respByName = new Map<string, ResponsividadVendedoraRow>();
    responsividad.forEach((r) => {
      if (r.vendedora_nombre) respByName.set(r.vendedora_nombre.trim().toLowerCase(), r);
    });

    // Lookup de responsividad general (30d estable) por nombre exacto.
    // Filtramos la fila total (vendedora_id === null) y usamos vendedora_nombre como clave.
    const generalByName = new Map<string, ResponsividadGeneralRow>();
    responsividadGeneral.forEach((r) => {
      if (r.vendedora_id !== null && r.vendedora_nombre) {
        generalByName.set(r.vendedora_nombre.trim().toLowerCase(), r);
      }
    });

    const isInRange = (d: string) => isDateInRange(d, dateRange.start, dateRange.end);

    return sellers
      .map((seller): SellerRow => {
        // ── Sales ──
        const sellerSales = sales.filter((s) => s.sellerId === seller.id);
        const salesCount = sellerSales.length;
        const salesAmount = sellerSales.reduce((sum, s) => sum + (s.amount ?? 0), 0);

        // ── Conversión (histórica) ──
        // El ciclo de venta ronda ~139 días: contar contactos en estado "Venta Cerrada"
        // dentro del rango da casi siempre 0 (los leads nuevos aún no compran). La conversión
        // honesta y estable es ventas/leads del rollup all-time de la vendedora.
        const allContacts = contacts.filter((c) => c.assignedSellerId === seller.id);
        const closeRate = seller.leadsTotal > 0 ? (seller.salesCount / seller.leadsTotal) * 100 : 0;

        // ── Active leads ──
        const activeStatuses = [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.INTERESTED];
        const activeLeads = allContacts.filter((c) => activeStatuses.includes(c.status)).length;

        // ── Leads assigned in period ──
        const leadsAssigned = allContacts.filter((c) => isInRange(c.createdAt)).length;

        // ── Average sales cycle ──
        let totalCycleDays = 0;
        let cycleCount = 0;
        sellerSales.forEach((sale) => {
          if (sale.salesCycleDays != null) {
            totalCycleDays += sale.salesCycleDays;
            cycleCount++;
          } else {
            const contact = contacts.find((c) => c.id === sale.contactId);
            if (contact) {
              const diff = Math.max(
                0,
                Math.ceil(
                  (new Date(sale.date).getTime() - new Date(contact.createdAt).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              );
              totalCycleDays += diff;
              cycleCount++;
            }
          }
        });
        const avgSalesCycle = cycleCount > 0 ? Math.round(totalCycleDays / cycleCount) : 0;

        // ── Average lead age (active leads only) ──
        const activeLeadContacts = allContacts.filter((c) => activeStatuses.includes(c.status));
        const now = Date.now();
        const totalAge = activeLeadContacts.reduce((sum, c) => {
          const age = Math.max(0, Math.ceil((now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
          return sum + age;
        }, 0);
        const avgLeadAge = activeLeadContacts.length > 0 ? Math.round(totalAge / activeLeadContacts.length) : 0;

        // ── Touches per sale ──
        let touchesTotal = 0;
        sellerSales.forEach((sale) => {
          if (sale.interactionCountSnapshot != null) {
            touchesTotal += sale.interactionCountSnapshot;
          } else {
            const saleTs = new Date(sale.date).getTime();
            touchesTotal += interactions.filter(
              (i) => i.contactId === sale.contactId && new Date(i.date).getTime() <= saleTs
            ).length;
          }
        });
        const avgTouchesPerSale =
          salesCount > 0 ? (touchesTotal / salesCount).toFixed(1) : '0';

        // ── Interactions count ──
        const sellerInteractions = interactions.filter((i) => i.sellerId === seller.id);
        const interactionsCount = sellerInteractions.length;

        // ── Responsividad (período filtrado) ──
        const resp =
          respMap.get(seller.id) ??
          respByName.get(seller.name.trim().toLowerCase()) ??
          null;

        // ── Responsividad general 30d (match por nombre exacto, case-insensitive) ──
        const genResp = generalByName.get(seller.name.trim().toLowerCase()) ?? null;

        return {
          id: seller.id,
          name: seller.name,
          shortName: shortName(seller.name),
          avatarUrl: seller.avatarUrl,
          salesCount,
          salesAmount,
          closeRate,
          avgSalesCycle,
          avgLeadAge,
          avgTouchesPerSale,
          activeLeads,
          interactionsCount,
          leadsAssigned,
          chatsRespondidos: resp?.chats_respondidos ?? 0,
          respMedianaMin: resp?.resp_mediana_min ?? null,
          respGeneralMedianaMin: genResp?.resp_mediana_min ?? null,
          respGeneralBMenos15: genResp?.b_menos_15 ?? 0,
          respGeneralB1560: genResp?.b_15_60 ?? 0,
          respGeneralB14h: genResp?.b_1_4h ?? 0,
          respGeneralBMas4h: genResp?.b_mas_4h ?? 0,
          rank: 0, // filled below after sort
        };
      })
      .sort((a, b) => {
        if (b.salesAmount !== a.salesAmount) return b.salesAmount - a.salesAmount;
        return b.salesCount - a.salesCount;
      })
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [sellers, responsividad, responsividadGeneral, sales, interactions, contacts, dateRange]);

  // Chart data: sales amount per seller (horizontal bar)
  const chartData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => a.salesAmount - b.salesAmount)
        .map((r) => ({ name: r.shortName, amount: r.salesAmount, rank: r.rank })),
    [rows]
  );

  // Interaction breakdown per seller (stacked bar)
  const activityData = useMemo(
    () =>
      sellers.map((seller) => {
        const si = interactions.filter((i) => i.sellerId === seller.id);
        return {
          name: shortName(seller.name),
          Llamadas: si.filter((i) => i.type === InteractionType.CALL).length,
          WhatsApp: si.filter((i) => i.type === InteractionType.WHATSAPP).length,
          Email: si.filter((i) => i.type === InteractionType.EMAIL).length,
        };
      }),
    [sellers, interactions]
  );

  const hasData = rows.length > 0;
  const hasSalesData = rows.some((r) => r.salesAmount > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ──────────────────────────────────────── */}
      <div
        className="yc-fade-up"
        style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: 'var(--yc-text)',
            }}
          >
            El equipo
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--yc-text-mute)' }}>
            desempeño y responsividad · {rangeLabel}
          </p>
        </div>
      </div>

      {!hasData ? (
        <div
          className="yc-glass"
          style={{ padding: 40, textAlign: 'center', color: 'var(--yc-text-faint)', fontSize: 14 }}
        >
          Sin datos de vendedoras para el período seleccionado.
        </div>
      ) : (
        <>
          {/* ── Summary insights ──────────────────────── */}
          <Insights rows={rows} />

          {/* ── Seller performance rows ───────────────── */}
          <section>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--yc-text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 10,
              }}
            >
              Ranking individual
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((row, i) => (
                <SellerRowCard
                  key={row.id}
                  row={row}
                  delay={300 + i * 80}
                  isTop={row.rank === 1}
                />
              ))}
            </div>
            {/* Leyenda barra de tramos de respuesta */}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { label: '< 15 min', color: 'var(--yc-green)' },
                { label: '15 min – 1 h', color: 'var(--yc-gold)' },
                { label: '1 – 4 h', color: '#f0a050' },
                { label: '+ 4 h', color: 'var(--yc-red)' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: item.color,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Charts row ────────────────────────────── */}
          {hasSalesData && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {/* Sales by seller bar chart */}
              <section
                className="yc-glass yc-fade-up"
                style={{ animationDelay: '400ms', padding: 22 }}
              >
                <header style={{ marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>
                    Ventas por asesora
                  </h2>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--yc-text-mute)' }}>
                    monto total · {rangeLabel}
                  </p>
                </header>
                <ResponsiveContainer
                  width="100%"
                  height={280}
                  minHeight={200}
                  minWidth={0}
                  debounce={200}
                >
                  <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => fmt.ars(v)}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip content={<SalesBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="amount" radius={[0, 5, 5, 0]}>
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.rank === 1 ? 'var(--yc-gold)' : 'rgba(240,234,218,0.18)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </section>

              {/* Activity by seller stacked bar */}
              <section
                className="yc-glass yc-fade-up"
                style={{ animationDelay: '500ms', padding: 22 }}
              >
                <header style={{ marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>
                    Actividad por asesora
                  </h2>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--yc-text-mute)' }}>
                    interacciones por canal
                  </p>
                </header>
                <ResponsiveContainer
                  width="100%"
                  height={280}
                  minHeight={200}
                  minWidth={0}
                  debounce={200}
                >
                  <BarChart
                    data={activityData}
                    margin={{ top: 10, right: 20, bottom: 40, left: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'var(--yc-text-mute)', angle: -20, textAnchor: 'end' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{
                        background: 'var(--yc-bg-3)',
                        border: '1px solid var(--yc-border-hi)',
                        borderRadius: 10,
                        fontSize: 12,
                        color: 'var(--yc-text)',
                      }}
                    />
                    <Bar dataKey="Llamadas" stackId="a" fill="var(--yc-gold)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="WhatsApp" stackId="a" fill="var(--yc-green)" />
                    <Bar dataKey="Email" stackId="a" fill="var(--yc-blue)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {/* Legend below chart to avoid overlap */}
                <div style={{ display: 'flex', gap: 14, marginTop: 6, paddingLeft: 10 }}>
                  {[
                    { label: 'Llamadas', color: 'var(--yc-gold)' },
                    { label: 'WhatsApp', color: 'var(--yc-green)' },
                    { label: 'Email', color: 'var(--yc-blue)' },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: item.color,
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ── Efficiency detail table ────────────────── */}
          <section
            className="yc-glass yc-fade-up"
            style={{ animationDelay: '600ms', overflow: 'hidden' }}
          >
            <header
              style={{
                padding: '16px 22px',
                borderBottom: '1px solid var(--yc-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>
                Eficiencia del equipo
              </h2>
              <span style={{ fontSize: 12, color: 'var(--yc-text-faint)' }}>· días, mensajes, espera</span>
            </header>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      borderBottom: '1px solid var(--yc-border)',
                    }}
                  >
                    {['Asesora', 'Leads nuevos', 'Días hasta la venta', 'Días esperando', 'Mensajes para cerrar', 'Leads abiertos'].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: '10px 16px',
                            textAlign: h === 'Asesora' ? 'left' : 'center',
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--yc-text-faint)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      style={{ borderBottom: '1px solid var(--yc-border)' }}
                    >
                      {/* Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div
                            className="yc-avatar"
                            style={{
                              width: 28,
                              height: 28,
                              fontSize: 11,
                              background:
                                row.rank === 1
                                  ? 'linear-gradient(135deg, #3a2f1c 0%, rgba(0,0,0,0.4) 100%)'
                                  : 'linear-gradient(135deg, #1c1c2a 0%, rgba(0,0,0,0.4) 100%)',
                              color: row.rank === 1 ? 'var(--yc-gold)' : 'var(--yc-text-mute)',
                            }}
                          >
                            {row.shortName[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--yc-text)' }}>
                            {row.shortName}
                          </span>
                        </div>
                      </td>
                      {/* Leads nuevos */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className="yc-num" style={{ color: 'var(--yc-text-mute)' }}>
                          {row.leadsAssigned}
                        </span>
                      </td>
                      {/* Ciclo venta */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          className="yc-num"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.04)',
                            color:
                              row.avgSalesCycle === 0
                                ? 'var(--yc-text-faint)'
                                : row.avgSalesCycle < 7
                                ? 'var(--yc-green)'
                                : row.avgSalesCycle < 15
                                ? 'var(--yc-gold)'
                                : 'var(--yc-red)',
                          }}
                        >
                          {row.avgSalesCycle > 0 ? `${row.avgSalesCycle}d` : '—'}
                        </span>
                      </td>
                      {/* Antigüedad activa */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          className="yc-num"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.04)',
                            color:
                              row.avgLeadAge === 0
                                ? 'var(--yc-text-faint)'
                                : row.avgLeadAge < 10
                                ? 'var(--yc-green)'
                                : row.avgLeadAge < 30
                                ? 'var(--yc-gold)'
                                : 'var(--yc-red)',
                          }}
                        >
                          {row.avgLeadAge > 0 ? `${row.avgLeadAge}d` : '—'}
                        </span>
                      </td>
                      {/* Toques/cierre */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          className="yc-num"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--yc-text-mute)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {row.avgTouchesPerSale}
                        </span>
                      </td>
                      {/* Leads activos */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          className="yc-num"
                          style={{
                            fontSize: 12,
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'rgba(111,179,232,0.12)',
                            color: 'var(--yc-blue)',
                            border: '1px solid rgba(111,179,232,0.2)',
                          }}
                        >
                          {row.activeLeads}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
