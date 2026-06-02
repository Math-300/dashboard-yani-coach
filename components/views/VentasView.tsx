// Yani Coach Dashboard — VentasView
// Merges SalesView + RecoveryView into one detail view with sub-tab switch.
// Visual language: yc-glass cards, gold/dark theme, CSS vars from yc-theme.css.
import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { KpiCard } from '../yc/KpiCard';
import { Icons } from '../yc/icons';
import { fmt } from '../yc/primitives';
import { Sale, PurchaseAttempt, PurchaseAttemptStatus } from '../../types';
import {
  calculateTotalRevenue,
  calculateAverageTicket,
  calculateRevenueByProduct,
  calculateRevenueByCategory,
  calculateSalesTrend,
  calculatePurchaseAttemptsByStatus,
  calculateRecoveryMetrics,
  calculateRecoveryByVendor,
  calculateAttemptTrends,
  calculateFailedAttempts,
  calculateRecoveredValue,
  ProductRevenue,
  CategoryRevenue,
  TrendData,
} from '../../services/metricsCalculator';

// ── Props ─────────────────────────────────────────────────

export interface VentasViewProps {
  sales: Sale[];
  attempts: PurchaseAttempt[];
  dateRange: { start: Date; end: Date };
  rangeLabel: string;
}

// ── Constants ─────────────────────────────────────────────

const GOLD_PALETTE = [
  '#e7c15a', '#f0d488', '#b8923f', '#d4a843',
  '#fde68a', '#a78042', '#c9973a', '#f5c842', '#8b6914', '#ffe4a0',
];

const STATUS_COLORS: Record<string, string> = {
  Exitoso: 'var(--yc-green)',
  Fallido: 'var(--yc-red)',
  Abandonado: '#f0a050',
};

// ── Tooltip helpers ───────────────────────────────────────

const TooltipBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    background: 'var(--yc-bg-3)',
    border: '1px solid var(--yc-border-hi)',
    borderRadius: 10,
    padding: '9px 13px',
    fontSize: 13,
    color: 'var(--yc-text)',
    boxShadow: 'var(--yc-shadow)',
    lineHeight: 1.6,
  }}>
    {children}
  </div>
);

const TrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TrendData;
  return (
    <TooltipBox>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{d.period || label}</div>
      <div style={{ color: 'var(--yc-gold)' }}>{fmt.ars(d.revenue)}</div>
      <div style={{ color: 'var(--yc-text-mute)' }}>{fmt.num(d.count)} ventas</div>
    </TooltipBox>
  );
};

const ProductTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ProductRevenue;
  return (
    <TooltipBox>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{d.productName}</div>
      <div style={{ color: 'var(--yc-gold)' }}>{fmt.ars(d.revenue)}</div>
      <div style={{ color: 'var(--yc-text-mute)' }}>{fmt.num(d.quantity)} ventas · {d.percentage}%</div>
    </TooltipBox>
  );
};

const CategoryTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as CategoryRevenue;
  return (
    <TooltipBox>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{d.category}</div>
      <div style={{ color: 'var(--yc-gold)' }}>{fmt.ars(d.revenue)}</div>
      <div style={{ color: 'var(--yc-text-mute)' }}>{fmt.num(d.count)} ventas · {d.percentage}%</div>
    </TooltipBox>
  );
};

const StatusTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipBox>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{d.status}</div>
      <div>{fmt.num(d.count)} intentos</div>
      <div style={{ color: 'var(--yc-gold)' }}>{fmt.ars(d.totalValue ?? 0)}</div>
      <div style={{ color: 'var(--yc-text-mute)' }}>{d.percentage}%</div>
    </TooltipBox>
  );
};

const AttemptTrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <TooltipBox>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {fmt.num(entry.value)}
        </div>
      ))}
    </TooltipBox>
  );
};

const VendorTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipBox>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{d.vendorName}</div>
      <div style={{ color: 'var(--yc-green)' }}>{d.recoveryRate}% recuperación</div>
      <div style={{ color: 'var(--yc-text-mute)' }}>{d.recoveredAttempts} de {d.assignedAttempts}</div>
    </TooltipBox>
  );
};

// ── Shared section card ───────────────────────────────────

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  accentBorder?: boolean;
}

function SectionCard({ title, subtitle, icon, children, delay = 0, accentBorder }: SectionCardProps) {
  return (
    <div
      className="yc-glass yc-fade-up"
      style={{
        animationDelay: `${delay}ms`,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        ...(accentBorder ? {
          borderColor: 'rgba(231,193,90,0.28)',
          background: 'linear-gradient(180deg, rgba(231,193,90,0.05) 0%, rgba(255,255,255,0.018) 100%)',
        } : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--yc-text)', letterSpacing: '-0.012em' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: 'var(--yc-text-mute)', marginTop: 3 }}>{subtitle}</div>}
        </div>
        {icon && (
          <div style={{ color: 'var(--yc-gold)', flexShrink: 0, opacity: 0.7 }}>
            {icon}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{
      height: 180,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--yc-text-faint)',
      fontSize: 13,
    }}>
      {msg}
    </div>
  );
}

// ── Granularity pill toggle ───────────────────────────────

interface GranularityPillsProps {
  value: 'day' | 'week' | 'month';
  onChange: (v: 'day' | 'week' | 'month') => void;
}

function GranularityPills({ value, onChange }: GranularityPillsProps) {
  const opts = [
    { k: 'day' as const, label: 'Día' },
    { k: 'week' as const, label: 'Semana' },
    { k: 'month' as const, label: 'Mes' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {opts.map(({ k, label }) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`yc-pill${value === k ? ' is-active' : ''}`}
          style={{ padding: '5px 12px', fontSize: 12 }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── VENTAS TAB ────────────────────────────────────────────

interface VentasTabProps {
  sales: Sale[];
  dateRange: { start: Date; end: Date };
}

function VentasTab({ sales, dateRange }: VentasTabProps) {
  const [gran, setGran] = useState<'day' | 'week' | 'month'>('week');

  const metrics = useMemo(() => {
    const totalRevenue = calculateTotalRevenue(sales, dateRange);
    const averageTicket = calculateAverageTicket(sales);
    const productRevenue = calculateRevenueByProduct(sales);
    const categoryRevenue = calculateRevenueByCategory(sales);
    const salesTrend = calculateSalesTrend(sales, gran);
    return {
      totalRevenue,
      averageTicket,
      productRevenue,
      categoryRevenue,
      salesTrend,
      totalSales: sales.length,
    };
  }, [sales, dateRange, gran]);

  const topProducts = metrics.productRevenue.slice(0, 10);

  // Build sparkline from trend revenue values
  const spark = useMemo(() => {
    const pts = metrics.salesTrend.map(t => t.revenue);
    return pts.length >= 2 ? pts : undefined;
  }, [metrics.salesTrend]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <KpiCard
          icon={Icons.Dollar}
          accent="var(--yc-gold)"
          question="Total vendido"
          valueRaw={metrics.totalRevenue}
          valueDisplay={(n) => fmt.ars(n)}
          spark={spark}
          delay={0}
        />
        <KpiCard
          icon={Icons.Sales}
          accent="var(--yc-green)"
          question="Ventas en el período"
          valueRaw={metrics.totalSales}
          valueDisplay={(n) => fmt.num(n)}
          sub={metrics.totalSales === 0 ? 'Sin ventas' : undefined}
          delay={80}
        />
        <KpiCard
          icon={Icons.Target}
          accent="var(--yc-blue)"
          question="Ticket promedio"
          valueRaw={metrics.averageTicket}
          valueDisplay={(n) => fmt.ars(n)}
          delay={160}
        />
        {metrics.productRevenue.length > 0 && (
          <KpiCard
            icon={Icons.Trend}
            accent="#f0a050"
            question="Productos distintos"
            valueRaw={metrics.productRevenue.length}
            valueDisplay={(n) => fmt.num(n)}
            sub={metrics.productRevenue[0]?.productName ?? ''}
            delay={240}
          />
        )}
      </div>

      {/* Trend + Products row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Sales trend area chart */}
        <SectionCard
          title="Tendencia de ventas"
          subtitle={`Ingresos por ${gran === 'day' ? 'día' : gran === 'week' ? 'semana' : 'mes'}`}
          icon={<Icons.Trend size={17} />}
          delay={60}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <GranularityPills value={gran} onChange={setGran} />
          </div>
          {metrics.salesTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280} minHeight={200} minWidth={0} debounce={200}>
              <AreaChart
                data={metrics.salesTrend}
                margin={{ top: 10, right: 20, bottom: 40, left: 10 }}
              >
                <defs>
                  <linearGradient id="vc-gold-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--yc-gold)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--yc-gold)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--yc-border)" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                  axisLine={{ stroke: 'var(--yc-border)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  width={48}
                />
                <Tooltip content={<TrendTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--yc-gold)"
                  strokeWidth={2}
                  fill="url(#vc-gold-fill)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--yc-gold)', stroke: 'var(--yc-bg-0)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState msg="Sin datos de tendencia" />
          )}
        </SectionCard>

        {/* Top products horizontal bar */}
        <SectionCard
          title="Productos más vendidos"
          subtitle="Top 10 por cantidad"
          icon={<Icons.Sales size={17} />}
          delay={100}
        >
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={280} minHeight={200} minWidth={0} debounce={200}>
              <BarChart
                layout="vertical"
                data={topProducts}
                margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--yc-border)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="productName"
                  tick={{ fontSize: 10, fill: 'var(--yc-text-mute)' }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip content={<ProductTooltip />} />
                <Bar dataKey="quantity" radius={[0, 4, 4, 0]}>
                  {topProducts.map((_, i) => (
                    <Cell key={i} fill={GOLD_PALETTE[i % GOLD_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState msg="Sin datos de productos" />
          )}
        </SectionCard>
      </div>

      {/* Categories row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Pie chart */}
        <SectionCard
          title="Ingresos por categoría"
          subtitle="Distribución por tipo de producto"
          delay={140}
        >
          {metrics.categoryRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={280} minHeight={200} minWidth={0} debounce={200}>
              <PieChart>
                <Pie
                  data={metrics.categoryRevenue}
                  cx="50%"
                  cy="48%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="revenue"
                  nameKey="category"
                >
                  {metrics.categoryRevenue.map((_, i) => (
                    <Cell key={i} fill={GOLD_PALETTE[i % GOLD_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CategoryTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 12.5, color: 'var(--yc-text)' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState msg="Sin datos de categorías" />
          )}
        </SectionCard>

        {/* Category breakdown list */}
        <SectionCard title="Desglose por categoría" delay={180}>
          {metrics.categoryRevenue.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {metrics.categoryRevenue.map((cat, i) => (
                <div
                  key={cat.category}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid var(--yc-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 999, background: GOLD_PALETTE[i % GOLD_PALETTE.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, color: 'var(--yc-text)', fontWeight: 500 }}>{cat.category}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="yc-num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--yc-text)' }}>{fmt.ars(cat.revenue)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--yc-text-faint)' }}>{fmt.num(cat.count)} ventas · {cat.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState msg="Sin datos" />
          )}
        </SectionCard>
      </div>

      {/* Product ranking table */}
      <SectionCard title="Ranking de productos" subtitle="Detalle por producto" delay={200}>
        {metrics.productRevenue.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--yc-border)' }}>
                  {['#', 'Producto', 'Cant.', 'Ingresos', '% Total'].map((h, ci) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 10px',
                        fontWeight: 600,
                        fontSize: 12,
                        color: 'var(--yc-text-mute)',
                        textAlign: ci === 0 || ci === 1 ? 'left' : ci === 2 ? 'center' : 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.productRevenue.slice(0, 10).map((p, i) => (
                  <tr
                    key={p.productName}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '9px 10px', width: 36 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 999,
                        background: i === 0 ? 'var(--yc-gold)' : i === 1 ? 'rgba(255,255,255,0.18)' : i === 2 ? '#b8923f' : 'rgba(255,255,255,0.07)',
                        color: i < 3 ? (i === 1 ? 'var(--yc-bg-0)' : 'var(--yc-bg-0)') : 'var(--yc-text-mute)',
                        display: 'grid', placeItems: 'center',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {i + 1}
                      </div>
                    </td>
                    <td style={{ padding: '9px 10px', color: 'var(--yc-text)', fontWeight: 500 }}>{p.productName}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--yc-text-mute)' }}>{fmt.num(p.quantity)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                      <span className="yc-num" style={{ fontWeight: 600, color: 'var(--yc-text)' }}>{fmt.ars(p.revenue)}</span>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <div style={{ width: 52, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${p.percentage}%`, height: '100%', background: 'var(--yc-gold)', borderRadius: 999 }} />
                        </div>
                        <span style={{ fontSize: 11.5, color: 'var(--yc-text-faint)', width: 36, textAlign: 'right' }}>{p.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState msg="Sin datos de ventas en el período" />
        )}
      </SectionCard>

      {/* Recent sales list (last 8) */}
      {sales.length > 0 && (
        <SectionCard title="Ventas recientes" subtitle={`Últimas ${Math.min(sales.length, 8)}`} delay={220}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...sales]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 8)
              .map((s, i) => {
                const d = new Date(s.date);
                const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
                return (
                  <div
                    key={s.id || i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '9px 12px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--yc-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'rgba(231,193,90,0.12)',
                        border: '1px solid rgba(231,193,90,0.2)',
                        color: 'var(--yc-gold)',
                        display: 'grid', placeItems: 'center', flexShrink: 0,
                      }}>
                        <Icons.Sales size={14} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--yc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.productName}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--yc-text-faint)' }}>{dateStr}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="yc-num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--yc-text)' }}>{fmt.ars(s.amount)}</div>
                      {s.paymentStatus && (
                        <div style={{ fontSize: 11, color: s.paymentStatus === 'Pagado' ? 'var(--yc-green)' : 'var(--yc-text-faint)' }}>
                          {s.paymentStatus}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── RECUPERACIÓN TAB ──────────────────────────────────────

interface RecuperacionTabProps {
  attempts: PurchaseAttempt[];
}

function RecuperacionTab({ attempts }: RecuperacionTabProps) {
  const totalAttempts = attempts.length;
  const failedAttempts = useMemo(() => calculateFailedAttempts(attempts), [attempts]);
  const recoveredValue = useMemo(() => calculateRecoveredValue(attempts), [attempts]);
  const recoveryMetrics = useMemo(() => calculateRecoveryMetrics(attempts, [], []), [attempts]);
  const attemptsByStatus = useMemo(() => calculatePurchaseAttemptsByStatus(attempts), [attempts]);
  const recoveryByVendor = useMemo(() => calculateRecoveryByVendor(attempts, []), [attempts]);
  const attemptTrends = useMemo(() => calculateAttemptTrends(attempts, 'week'), [attempts]);

  const trendChartData = useMemo(() =>
    attemptTrends.map(t => ({
      period: t.period,
      Exitoso: t.successful,
      Fallido: t.failed,
      Abandonado: t.abandoned,
    })),
    [attemptTrends]
  );

  const recoverableAttempts = useMemo(() =>
    attempts
      .filter(a => a.status === PurchaseAttemptStatus.FAILED || a.status === PurchaseAttemptStatus.ABANDONED)
      .slice(0, 10),
    [attempts]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <KpiCard
          icon={Icons.Funnel}
          accent="var(--yc-blue)"
          question="Total intentos de compra"
          valueRaw={totalAttempts}
          valueDisplay={(n) => fmt.num(n)}
          sub="En el período"
          delay={0}
        />
        <KpiCard
          icon={Icons.X}
          accent="var(--yc-red)"
          question="Intentos fallidos/abandonados"
          valueRaw={failedAttempts}
          valueDisplay={(n) => fmt.num(n)}
          sub="Fallidos + Abandonados"
          delay={80}
        />
        <KpiCard
          icon={Icons.Refresh}
          accent="var(--yc-gold)"
          question="Tasa de recuperación"
          valueRaw={recoveryMetrics.recoveryRate}
          valueDisplay={(n) => `${Math.round(n)}%`}
          sub={`${recoveryMetrics.recovered} de ${recoveryMetrics.totalRecoverable}`}
          change={recoveryMetrics.recoveryRate > 0 ? {
            up: recoveryMetrics.recoveryRate >= 50,
            value: `${recoveryMetrics.recoveryRate}%`,
            note: 'recuperados',
          } : undefined}
          delay={160}
        />
        <KpiCard
          icon={Icons.Dollar}
          accent="var(--yc-green)"
          question="Valor recuperado"
          valueRaw={recoveredValue}
          valueDisplay={(n) => fmt.ars(n)}
          sub={recoveryMetrics.potentialValue > 0 ? `de ${fmt.ars(recoveryMetrics.potentialValue)} potencial` : undefined}
          delay={240}
        />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Pie: distribution by status */}
        <SectionCard title="Distribución por estado" subtitle="Proporción de intentos" delay={60}>
          {attemptsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={280} minHeight={200} minWidth={0} debounce={200}>
              <PieChart>
                <Pie
                  data={attemptsByStatus}
                  cx="50%"
                  cy="48%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                  dataKey="count"
                >
                  {attemptsByStatus.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip content={<StatusTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: 'var(--yc-text-mute)' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState msg="Sin datos de intentos" />
          )}
        </SectionCard>

        {/* Line: attempt trends */}
        <SectionCard title="Tendencia de intentos" subtitle="Por semana" delay={100}>
          {trendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280} minHeight={200} minWidth={0} debounce={200}>
              <LineChart
                data={trendChartData}
                margin={{ top: 10, right: 20, bottom: 40, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--yc-border)" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip content={<AttemptTrendTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: 'var(--yc-text-mute)' }}>{value}</span>
                  )}
                />
                <Line type="monotone" dataKey="Exitoso" stroke={STATUS_COLORS.Exitoso} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Fallido" stroke={STATUS_COLORS.Fallido} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Abandonado" stroke={STATUS_COLORS.Abandonado} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState msg="Sin datos de tendencia" />
          )}
        </SectionCard>
      </div>

      {/* Second charts row: value by status + recovery by vendor */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Bar: value by status */}
        <SectionCard title="Valor por estado" subtitle="Monto total de intentos" delay={140}>
          {attemptsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={260} minHeight={200} minWidth={0} debounce={200}>
              <BarChart
                data={attemptsByStatus}
                margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--yc-border)" />
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  width={46}
                />
                <Tooltip content={<StatusTooltip />} />
                <Bar dataKey="totalValue" radius={[4, 4, 0, 0]}>
                  {attemptsByStatus.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState msg="Sin datos" />
          )}
        </SectionCard>

        {/* Bar: recovery rate by vendor */}
        {recoveryByVendor.length > 0 && (
          <SectionCard title="Recuperación por vendedora" subtitle="Tasa %" delay={180}>
            <ResponsiveContainer width="100%" height={260} minHeight={200} minWidth={0} debounce={200}>
              <BarChart
                layout="vertical"
                data={recoveryByVendor}
                margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--yc-border)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="vendorName"
                  tick={{ fontSize: 11, fill: 'var(--yc-text-mute)' }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip content={<VendorTooltip />} />
                <Bar dataKey="recoveryRate" radius={[0, 4, 4, 0]} fill="var(--yc-gold)" />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}
      </div>

      {/* Status breakdown table */}
      <SectionCard title="Análisis de intentos por estado" delay={200}>
        {attemptsByStatus.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--yc-border)' }}>
                  {['Estado', 'Cantidad', '% del total', 'Valor total'].map((h, ci) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 10px',
                        fontWeight: 600,
                        fontSize: 12,
                        color: 'var(--yc-text-mute)',
                        textAlign: ci === 0 ? 'left' : 'center',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attemptsByStatus.map((item, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '9px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_COLORS[item.status] || '#6b7280', flexShrink: 0 }} />
                        <span style={{ color: 'var(--yc-text)', fontWeight: 500 }}>{item.status}</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                      <span className="yc-num" style={{ fontWeight: 600, color: 'var(--yc-text)' }}>{fmt.num(item.count)}</span>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--yc-text-mute)' }}>{item.percentage}%</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                      <span className="yc-num" style={{ fontWeight: 600, color: 'var(--yc-text)' }}>{fmt.ars(item.totalValue ?? 0)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState msg="Sin datos de intentos de compra" />
        )}
      </SectionCard>

      {/* Recoverable attempts table */}
      {recoverableAttempts.length > 0 && (
        <SectionCard
          title="Intentos en seguimiento"
          subtitle="Fallidos y abandonados — requieren gestión"
          accentBorder
          delay={240}
          icon={<Icons.Alert size={17} />}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(231,193,90,0.15)' }}>
                  {['ID', 'Monto', 'Estado', 'Vendedora', 'Días'].map((h, ci) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 10px',
                        fontWeight: 600,
                        fontSize: 12,
                        color: 'var(--yc-text-mute)',
                        textAlign: ci === 1 || ci === 4 ? 'right' : ci === 2 ? 'center' : 'left',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recoverableAttempts.map((attempt, i) => {
                  const daysInFollowUp = attempt.recoverySellerId
                    ? Math.ceil(Math.abs(Date.now() - new Date(attempt.date).getTime()) / 86400000)
                    : 0;
                  const isOld = daysInFollowUp > 7;
                  return (
                    <tr
                      key={attempt.id || i}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(231,193,90,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '9px 10px', color: 'var(--yc-text-faint)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        #{(attempt.id ?? String(i + 1)).slice(0, 8)}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                        <span className="yc-num" style={{ fontWeight: 600, color: 'var(--yc-text)' }}>{fmt.ars(attempt.amount ?? 0)}</span>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '3px 8px', borderRadius: 999,
                          fontSize: 11, fontWeight: 600,
                          background: attempt.status === PurchaseAttemptStatus.FAILED ? 'rgba(232,122,122,0.14)' : 'rgba(240,160,80,0.14)',
                          color: attempt.status === PurchaseAttemptStatus.FAILED ? 'var(--yc-red)' : '#f0a050',
                          border: `1px solid ${attempt.status === PurchaseAttemptStatus.FAILED ? 'rgba(232,122,122,0.25)' : 'rgba(240,160,80,0.25)'}`,
                        }}>
                          {attempt.status}
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px', color: attempt.recoverySellerId ? 'var(--yc-text)' : 'var(--yc-text-faint)', fontSize: 12.5 }}>
                        {attempt.recoverySellerId ? `ID: ${attempt.recoverySellerId.slice(0, 8)}` : 'Sin asignar'}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                        <span className="yc-num" style={{ fontWeight: 600, color: isOld ? 'var(--yc-red)' : 'var(--yc-text-mute)', fontSize: 13 }}>
                          {daysInFollowUp}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── ROOT COMPONENT ────────────────────────────────────────

export default function VentasView({ sales, attempts, dateRange, rangeLabel }: VentasViewProps) {
  const [tab, setTab] = useState<'ventas' | 'recuperacion'>('ventas');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="yc-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.022em', color: 'var(--yc-text)' }}>
            Ventas & Recuperación
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--yc-text-mute)' }}>
            {rangeLabel} · {sales.length} ventas · {attempts.length} intentos de compra
          </p>
        </div>

        {/* Tab pills */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setTab('ventas')}
            className={`yc-pill${tab === 'ventas' ? ' is-active' : ''}`}
          >
            <Icons.Sales size={14} />
            Ventas
          </button>
          <button
            type="button"
            onClick={() => setTab('recuperacion')}
            className={`yc-pill${tab === 'recuperacion' ? ' is-active' : ''}`}
          >
            <Icons.Refresh size={14} />
            Recuperación
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="yc-divider" />

      {/* Active tab content */}
      {tab === 'ventas'
        ? <VentasTab sales={sales} dateRange={dateRange} />
        : <RecuperacionTab attempts={attempts} />
      }
    </div>
  );
}
