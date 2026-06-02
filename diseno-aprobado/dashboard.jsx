// Yani Coach Dashboard — premium hi-fi (Variant A: Clásico + dorado)
// One-file React app. Pure CSS motion (no framer-motion dep needed).
// Inline lucide-style SVG icons keep us off another CDN. Geist via <link>.

const { useState, useEffect, useRef, useMemo } = React;

// ── ICONS (lucide-style, inline SVG) ──────────────────────
// Standardized 18x18 viewbox, strokeWidth 1.6, currentColor.
const Ico = ({ d, size = 18, sw = 1.6, fill, children, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill || 'none'}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  Logo: (p) => (
    <Ico {...p}>
      <path d="M5 3l7 9-7 9" />
      <path d="M12 12h7" />
    </Ico>
  ),
  Sparkle: (p) => (
    <Ico {...p}>
      <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
    </Ico>
  ),
  Summary: (p) => (
    <Ico {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Ico>
  ),
  Sales: (p) => (
    <Ico {...p}>
      <path d="M12 2v20" />
      <path d="M17 6H9.5a3 3 0 100 6h5a3 3 0 110 6H6" />
    </Ico>
  ),
  Team: (p) => (
    <Ico {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c.8-3.4 3.5-5.5 6.5-5.5s5.7 2.1 6.5 5.5" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M16 14.6c2.5.3 4.4 2.2 5 5.4" />
    </Ico>
  ),
  Funnel: (p) => (
    <Ico {...p}>
      <path d="M3 4h18l-7 9v7l-4-2v-5z" />
    </Ico>
  ),
  Templates: (p) => (
    <Ico {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </Ico>
  ),
  Whats: (p) => (
    <Ico {...p}>
      <path d="M21 11.5a8.5 8.5 0 11-3.6-6.9L21 4l-1.4 3.5A8.4 8.4 0 0121 11.5z" />
      <path d="M8 11c.3 2 2 3.7 4 4l1.6-1.6c.3-.3.7-.4 1.1-.2l2.4 1.1" strokeWidth="1.4" />
    </Ico>
  ),
  Clients: (p) => (
    <Ico {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20.5c1-3.6 4-5.5 7-5.5s6 1.9 7 5.5" />
    </Ico>
  ),
  ChevronLeft: (p) => <Ico {...p} d="M15 6l-6 6 6 6" />,
  ChevronRight: (p) => <Ico {...p} d="M9 6l6 6-6 6" />,
  ChevronDown: (p) => <Ico {...p} d="M6 9l6 6 6-6" />,
  ArrowUp: (p) => <Ico {...p} d="M12 19V5M5 12l7-7 7 7" />,
  ArrowDown: (p) => <Ico {...p} d="M12 5v14M19 12l-7 7-7-7" />,
  Dollar: (p) => (
    <Ico {...p}>
      <path d="M12 2v20" />
      <path d="M17 6H9.5a3 3 0 100 6h5a3 3 0 110 6H6" />
    </Ico>
  ),
  Clock: (p) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Ico>
  ),
  Target: (p) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Ico>
  ),
  Check: (p) => <Ico {...p} d="M20 6L9 17l-5-5" />,
  X: (p) => <Ico {...p} d="M18 6L6 18M6 6l12 12" />,
  Bell: (p) => (
    <Ico {...p}>
      <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 004 0" />
    </Ico>
  ),
  Alert: (p) => (
    <Ico {...p}>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v5" />
      <circle cx="12" cy="18" r=".5" fill="currentColor" />
    </Ico>
  ),
  Calendar: (p) => (
    <Ico {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </Ico>
  ),
  Sun: (p) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Ico>
  ),
  Search: (p) => (
    <Ico {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </Ico>
  ),
  Settings: (p) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </Ico>
  ),
  Refresh: (p) => (
    <Ico {...p}>
      <path d="M3 12a9 9 0 0115-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </Ico>
  ),
  Trend: (p) => <Ico {...p} d="M3 17l6-6 4 4 8-8M21 7h-6M21 7v6" />,
};

// ── HOOKS ─────────────────────────────────────────────────

// Animated count-up. Cubic-bezier ease. Respects prefers-reduced-motion.
function useCountUp(target, { duration = 1400, delay = 0, decimals = 0, enabled = true } = {}) {
  const [v, setV] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) { setV(target); return; }
    let raf;
    const start = performance.now() + delay;
    const from = 0;
    const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const tick = (now) => {
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

// Mounted-flag for skeleton → real-content swap.
function useAfterMount(ms = 700) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return done;
}

// ── SHARED PIECES ─────────────────────────────────────────

// Animated polyline sparkline. Draws on mount via stroke-dasharray.
function Sparkline({ points, color = 'var(--yc-gold)', w = 92, h = 32, delay = 0, fill = true }) {
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
  const gid = `spark-${Math.round(Math.random() * 1e9)}`;
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={areaPath} fill={`url(#${gid})`} opacity={0} style={{ animation: `yc-fade-in 0.8s ${delay + 400}ms ease forwards` }} />}
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
          ['--spark-len']: 240,
        }}
      />
      <circle cx={lastX} cy={lastY} r="3" fill={color} opacity={0} style={{ animation: `yc-fade-in 0.4s ${delay + 1100}ms ease forwards` }} />
    </svg>
  );
}

// Pulsing green dot for "live" indicators.
function PulseDot({ color = 'var(--yc-green)' }) {
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

// Single mini-row: label + bold value with optional color
function MiniRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
      <span style={{ fontSize: 12.5, color: 'var(--yc-text-mute)', fontWeight: 500 }}>{label}</span>
      <span className="yc-num" style={{ fontSize: 13.5, fontWeight: 600, color: accent || 'var(--yc-text)' }}>{value}</span>
    </div>
  );
}

// Helper for currency / number formatting
const fmt = {
  ars: (n) => `$${Math.round(n).toLocaleString('es-AR')}`,
  num: (n) => Math.round(n).toLocaleString('es-AR'),
  min: (n) => `${Math.round(n)} min`,
};

// ── SIDEBAR ───────────────────────────────────────────────

function Sidebar({ collapsed, onToggle }) {
  const w = collapsed ? 64 : 240;
  const metricsItems = [
    { id: 'resumen', label: 'Resumen', Icon: Icons.Summary, active: true },
    { id: 'ventas', label: 'Ventas', Icon: Icons.Sales },
    { id: 'equipo', label: 'Equipo', Icon: Icons.Team },
    { id: 'embudo', label: 'Embudo', Icon: Icons.Funnel },
  ];
  const soonItems = [
    { id: 'plantillas', label: 'Plantillas', Icon: Icons.Templates },
    { id: 'masivos', label: 'Masivos WhatsApp', Icon: Icons.Whats },
    { id: 'clientes', label: 'Clientes', Icon: Icons.Clients },
  ];

  return (
    <aside
      className="yc-sidebar-auto"
      style={{
        width: w,
        height: '100%',
        flexShrink: 0,
        borderRight: '1px solid var(--yc-border)',
        background: 'rgba(8, 8, 12, 0.4)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.32s cubic-bezier(.2,.7,.2,1)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      {/* Logo block */}
      <div
        style={{
          padding: collapsed ? '20px 12px' : '20px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          borderBottom: '1px solid var(--yc-border)',
          height: 72,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--yc-gold-2) 0%, var(--yc-gold) 50%, #a8843a 100%)',
            display: 'grid',
            placeItems: 'center',
            color: '#1a1208',
            boxShadow: '0 4px 16px rgba(231,193,90,0.25), inset 0 1px 0 rgba(255,255,255,0.4)',
            flexShrink: 0,
          }}
        >
          <Icons.Sparkle size={18} sw={1.8} />
        </div>
        {!collapsed && (
          <div className="yc-sidebar-text" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, overflow: 'hidden' }}>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Yani <span className="yc-gold-text" style={{ fontWeight: 600 }}>Coach</span></span>
            <span style={{ fontSize: 11, color: 'var(--yc-text-faint)', marginTop: 3 }}>panel de negocio</span>
          </div>
        )}
      </div>

      {/* Nav body */}
      <div className="yc-scroll" style={{ flex: 1, overflow: 'auto', padding: collapsed ? '14px 10px' : '14px 14px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <NavGroup label="Métricas" collapsed={collapsed} items={metricsItems} />
        <NavGroup label="Herramientas" suffix="próximamente" collapsed={collapsed} items={soonItems} soon />
      </div>

      {/* Footer: collapse toggle + user */}
      <div
        style={{
          borderTop: '1px solid var(--yc-border)',
          padding: collapsed ? '12px 10px' : '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {!collapsed && (
          <div className="yc-sidebar-text" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div className="yc-avatar" style={{ background: 'linear-gradient(135deg, #2a2138 0%, #1a1420 100%)', color: 'var(--yc-gold-2)' }}>Y</div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Yani</span>
              <span style={{ fontSize: 11, color: 'var(--yc-text-faint)', whiteSpace: 'nowrap' }}>cuenta personal</span>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            border: '1px solid var(--yc-border)',
            background: 'rgba(255,255,255,0.02)',
            color: 'var(--yc-text-mute)',
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            transition: 'all .15s ease',
            marginLeft: collapsed ? 'auto' : 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--yc-text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = 'var(--yc-text-mute)'; }}
          aria-label={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? <Icons.ChevronRight size={16} /> : <Icons.ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}

function NavGroup({ label, suffix, collapsed, items, soon = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {!collapsed && (
        <div className="yc-sidebar-text" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 6px', color: 'var(--yc-text-faint)', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {label}
          {suffix && <span style={{ color: 'var(--yc-text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>· {suffix}</span>}
        </div>
      )}
      {items.map(({ id, label, Icon, active }) => (
        <div
          key={id}
          className={`yc-nav-item ${active ? 'is-active' : ''} ${soon ? 'is-soon' : ''}`}
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '11px 0' : '9px 12px' }}
        >
          <Icon size={18} style={{ color: active ? 'var(--yc-gold-2)' : 'currentColor' }} />
          {!collapsed && <span className="yc-sidebar-text" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
          {!collapsed && soon && <span className="yc-soon-badge yc-sidebar-text">pronto</span>}
          {collapsed && <span className="yc-tip">{label}{soon ? ' · pronto' : ''}</span>}
        </div>
      ))}
    </div>
  );
}

// ── TOPBAR ────────────────────────────────────────────────

function Topbar() {
  const [range, setRange] = useState('7d');
  const ranges = [
    { id: 'today', label: 'Hoy' },
    { id: '7d', label: 'Últimos 7 días' },
    { id: 'month', label: 'Este mes' },
  ];
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
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>
          Mi negocio <span className="yc-gold-text" style={{ fontWeight: 600 }}>hoy</span>
        </h1>
        <span style={{ fontSize: 12, color: 'var(--yc-text-faint)', marginTop: 4 }}>
          martes, 26 de mayo · una mirada rápida a cómo viene la semana
        </span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {ranges.map((r) => (
          <button key={r.id} className={`yc-pill ${range === r.id ? 'is-active' : ''}`} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
        <button className="yc-pill" style={{ borderStyle: 'dashed' }}>
          <Icons.Calendar size={13} />
          Rango personalizado
        </button>
      </div>

      <div style={{ height: 28, width: 1, background: 'var(--yc-border)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--yc-text-mute)', fontSize: 12.5 }}>
        <PulseDot />
        <span>Actualizado hace <strong style={{ color: 'var(--yc-text)', fontWeight: 600 }}>2 min</strong> · se refresca solo</span>
      </div>
    </header>
  );
}

// ── ACTIONABLE HINT ───────────────────────────────────────

function ActionableHint({ delay = 0 }) {
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
          Tenés <span style={{ color: 'var(--yc-red)' }}>3 leads sin atender</span> hace más de 1h
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--yc-text-mute)' }}>
          Dos de ellas habían mostrado interés — mejor no las dejes enfriar.
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

// ── KPI CARD ──────────────────────────────────────────────

function KpiCard({ icon: Icon, accent = 'var(--yc-gold)', question, valueDisplay, valueRaw, change, sub, mini = [], spark, delay = 0 }) {
  const animated = useCountUp(valueRaw, { duration: 1400, delay });
  // The card's display formatter takes the live animated number and returns
  // the formatted string. The formatter is passed in via valueDisplay(animated).
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
          <span className="yc-num" style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1, color: 'var(--yc-text)' }}>
            {valueDisplay(animated)}
          </span>
          {change && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: change.up ? 'var(--yc-green)' : 'var(--yc-red)', fontWeight: 600 }}>
              {change.up ? <Icons.ArrowUp size={12} sw={2.2} /> : <Icons.ArrowDown size={12} sw={2.2} />}
              {change.value}
              <span style={{ color: 'var(--yc-text-faint)', fontWeight: 400, marginLeft: 2 }}>{change.note}</span>
            </span>
          )}
          {!change && sub && (
            <span style={{ fontSize: 12.5, color: 'var(--yc-text-faint)' }}>{sub}</span>
          )}
        </div>
        {spark && (
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

// ── FUNNEL ────────────────────────────────────────────────

const FUNNEL = [
  { id: 'leads', name: 'Leads nuevos', n: 310, hint: 'todas las que entraron esta semana' },
  { id: 'msg', name: 'Primer mensaje enviado', n: 310, hint: 'contactadas por Mary y Dochi · 100%', delta: { type: 'eq' } },
  { id: 'reply', name: 'Respondieron', n: 124, hint: 'contestaron 40% · se enfriaron 186', star: true, delta: { type: 'drop', pct: 40, lost: 186 } },
  { id: 'interest', name: 'Interesados', n: 58, hint: 'avanzaron 47% de los que respondieron', delta: { type: 'advance', pct: 47, lost: 66 } },
  { id: 'call', name: 'Agendó / entró en llamada', n: null, soon: true, hint: 'se activa cuando conectes Calendly' },
];

function Funnel({ delay = 0 }) {
  const max = 310;
  return (
    <section
      className="yc-glass yc-fade-up"
      style={{ animationDelay: `${delay}ms`, padding: 26, display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em' }}>El camino del lead</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--yc-text-mute)' }}>
            de las 310 personas nuevas, así se mueven hasta la venta
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--yc-border)', fontSize: 11.5, color: 'var(--yc-text-mute)' }}>
          <Icons.Trend size={13} />
          últimos 7 días
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {FUNNEL.map((s, i) => (
          <FunnelRow key={s.id} stage={s} max={max} index={i} baseDelay={delay + 200} />
        ))}
      </div>

      {/* Resultado final: cerradas + perdidas */}
      <div className="yc-divider" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--yc-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Resultado final
        </span>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ResultCard kind="win" delay={delay + 1100} />
          <ResultCard kind="lose" delay={delay + 1250} />
        </div>
      </div>
    </section>
  );
}

function FunnelRow({ stage, max, index, baseDelay }) {
  const delay = baseDelay + index * 110;
  const widthPct = stage.n != null ? (stage.n / max) * 100 : 55;
  const animated = useCountUp(stage.n || 0, { duration: 1100, delay: delay + 200, enabled: !stage.soon });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* left: stage name */}
        <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {stage.star && (
              <span style={{ color: 'var(--yc-gold-2)', fontSize: 12 }}>★</span>
            )}
            <span className="yc-stage-label" style={{ color: stage.soon ? 'var(--yc-text-faint)' : stage.star ? 'var(--yc-text)' : 'var(--yc-text-mute)', fontWeight: stage.star ? 600 : 500 }}>
              {stage.name}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>{stage.hint}</span>
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
              boxShadow: stage.star ? '0 0 24px rgba(231,193,90,0.15), inset 0 1px 0 rgba(255,255,255,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 16,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {!stage.soon && (
              <span className="yc-num" style={{ fontSize: 18, fontWeight: 600, color: stage.star ? 'var(--yc-gold-2)' : 'var(--yc-text)' }}>
                {fmt.num(animated)}
              </span>
            )}
            {stage.soon && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--yc-text-faint)' }}>
                <span className="yc-soon-badge" style={{ borderColor: 'rgba(231,193,90,0.3)', color: 'var(--yc-gold-2)' }}>próximamente</span>
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
      {stage.delta && (
        <div style={{ marginLeft: 196, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 8, height: 18, opacity: 0, animation: `yc-fade-in 0.5s ${delay + 800}ms ease forwards` }}>
          <span style={{ fontSize: 11, color: stage.delta.type === 'drop' ? 'var(--yc-blue)' : 'var(--yc-text-faint)', fontWeight: 600 }}>
            {stage.delta.type === 'eq' && '↓ todas siguen'}
            {stage.delta.type === 'drop' && `↓ avanzó el ${stage.delta.pct}%`}
            {stage.delta.type === 'advance' && `↓ avanzó el ${stage.delta.pct}%`}
          </span>
          {stage.delta.lost > 0 && (
            <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>
              · se cayeron {stage.delta.lost}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ kind, delay }) {
  const isWin = kind === 'win';
  const target = isWin ? 12 : 22;
  const n = useCountUp(target, { duration: 1100, delay });
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
        <div className="yc-num" style={{ fontSize: 24, fontWeight: 600, color, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {fmt.num(n)}
        </div>
      </div>
    </div>
  );
}

// ── EQUIPO CARD ───────────────────────────────────────────

const TEAM = [
  { id: 'dochi', name: 'Dochi', chats: 47, time: 11, color: 'var(--yc-green)', tone: '#1e3a2a', tag: 'arriba' },
  { id: 'mary', name: 'Mary', chats: 39, time: 26, color: 'var(--yc-gold)', tone: '#3a2f1c', tag: 'normal' },
];

function EquipoCard({ delay = 0 }) {
  return (
    <section className="yc-glass yc-fade-up" style={{ animationDelay: `${delay}ms`, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>El equipo</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--yc-text-mute)' }}>cómo viene cada una</p>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TEAM.map((p, i) => (
          <TeamRow key={p.id} person={p} delay={delay + 200 + i * 150} />
        ))}
      </div>
      <div className="yc-divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--yc-red)', boxShadow: '0 0 10px rgba(232,122,122,0.5)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--yc-text-mute)' }}>Sin atender ahora</span>
        </div>
        <span className="yc-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--yc-red)' }}>3 chats</span>
      </div>
    </section>
  );
}

function TeamRow({ person, delay }) {
  const time = useCountUp(person.time, { duration: 1000, delay: delay + 100 });
  const chats = useCountUp(person.chats, { duration: 1000, delay: delay + 200 });
  const initial = person.name[0];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        className="yc-avatar"
        style={{
          background: `linear-gradient(135deg, ${person.tone} 0%, rgba(0,0,0,0.4) 100%)`,
          color: person.color,
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{person.name}</span>
          <span className="yc-num" style={{ fontSize: 14, fontWeight: 600, color: person.color }}>
            {fmt.min(time)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <span className="yc-num" style={{ fontSize: 11.5, color: 'var(--yc-text-faint)' }}>{fmt.num(chats)} chats</span>
          <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>en responder</span>
        </div>
        {/* mini bar showing relative response time vs goal (20min target) */}
        <div style={{ marginTop: 6, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, (person.time / 30) * 100)}%`,
              height: '100%',
              background: person.color,
              opacity: 0.7,
              transformOrigin: 'left',
              animation: `yc-bar-grow 0.9s ${delay + 250}ms cubic-bezier(.2,.7,.2,1) forwards`,
              transform: 'scaleX(0)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── SKELETON (first-paint shimmer) ────────────────────────

function SkeletonScreen() {
  return (
    <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="yc-skeleton" style={{ height: 64, borderRadius: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="yc-skeleton" style={{ height: 200, borderRadius: 16 }} />
        <div className="yc-skeleton" style={{ height: 200, borderRadius: 16 }} />
        <div className="yc-skeleton" style={{ height: 200, borderRadius: 16 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, flex: 1, minHeight: 320 }}>
        <div className="yc-skeleton" style={{ borderRadius: 16 }} />
        <div className="yc-skeleton" style={{ borderRadius: 16 }} />
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const ready = useAfterMount(600);

  // Sparkline trend data — 7 days
  const sparkSales = [180, 320, 280, 410, 520, 480, 720];
  const sparkResp = [42, 30, 24, 26, 22, 19, 18]; // tiempo de respuesta (baja = mejor)
  const sparkRate = [22, 28, 25, 31, 35, 38, 40];

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Topbar />

        {!ready ? (
          <SkeletonScreen />
        ) : (
          <div className="yc-scroll" style={{ flex: 1, overflow: 'auto', padding: '20px 32px 32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1500, margin: '0 auto' }}>
              <ActionableHint delay={0} />

              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <KpiCard
                  delay={120}
                  icon={Icons.Dollar}
                  accent="var(--yc-gold)"
                  question="¿Cuánto vendimos?"
                  valueRaw={4250}
                  valueDisplay={fmt.ars}
                  change={{ up: true, value: '12%', note: 'vs 7 días anteriores' }}
                  spark={sparkSales}
                  mini={[
                    { label: 'Ventas cerradas', value: '12' },
                    { label: 'Ticket promedio', value: '$354' },
                  ]}
                />
                <KpiCard
                  delay={220}
                  icon={Icons.Clock}
                  accent="var(--yc-blue)"
                  question="¿El equipo responde bien?"
                  valueRaw={18}
                  valueDisplay={(v) => `${Math.round(v)} min`}
                  sub="tiempo promedio en contestar al lead"
                  spark={sparkResp}
                  mini={[
                    { label: 'Sin atender ahora', value: '3 chats', accent: 'var(--yc-red)' },
                    { label: 'Dochi', value: '11 min · 47 chats' },
                    { label: 'Mary', value: '26 min · 39 chats' },
                  ]}
                />
                <KpiCard
                  delay={320}
                  icon={Icons.Target}
                  accent="var(--yc-green)"
                  question="¿Dónde está la gente?"
                  valueRaw={124}
                  valueDisplay={fmt.num}
                  sub="leads respondieron de 310 nuevos"
                  spark={sparkRate}
                  mini={[
                    { label: 'Tasa de respuesta', value: '40%', accent: 'var(--yc-blue)' },
                    { label: 'Llegaron a venta', value: '12', accent: 'var(--yc-green)' },
                  ]}
                />
              </div>

              {/* Funnel + equipo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16 }}>
                <Funnel delay={500} />
                <EquipoCard delay={600} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
