// Yani Coach — Dashboard wireframe variants
// Low-fi, sketchy, side-by-side. Each variant explores a different combo
// of embudo shape, KPI card style, and accent color.

const SK = {
  ink: '#1f1a14',
  paper: '#fbf7ee',
  paperAlt: '#f4ede0',
  mute: 'rgba(31,26,20,0.55)',
  faint: 'rgba(31,26,20,0.18)',
  faintBg: 'rgba(31,26,20,0.04)',
  // accents
  dorado: '#c8a544',
  cobre: '#b56a3e',
  esmeralda: '#3f7a5a',
  rojo: '#c64a4a',
  verde: '#3f7a5a',
  azul: '#4a6fa5',
};

// ── primitives ─────────────────────────────────────────────

function Box({ children, style = {}, dashed = false, thick = false, fill, ...rest }) {
  return (
    <div
      style={{
        border: `${thick ? 2 : 1.5}px ${dashed ? 'dashed' : 'solid'} ${SK.ink}`,
        borderRadius: 6,
        background: fill || 'transparent',
        padding: 12,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

function Scribble({ lines = 1, width = '100%', gap = 6 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 2,
            width: typeof width === 'string' ? width : `${width}%`,
            background: SK.faint,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

function Label({ children, size = 13, weight = 600, italic = false, color, style = {} }) {
  return (
    <span
      style={{
        fontFamily: '"Kalam", "Caveat", cursive',
        fontSize: size,
        fontWeight: weight,
        fontStyle: italic ? 'italic' : 'normal',
        color: color || SK.ink,
        lineHeight: 1.15,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function BigNum({ children, color }) {
  return (
    <span
      style={{
        fontFamily: '"Caveat", cursive',
        fontSize: 40,
        fontWeight: 700,
        color: color || SK.ink,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}
    >
      {children}
    </span>
  );
}

function Pill({ children, active = false, dashed = false, accent }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 999,
        border: `1.5px ${dashed ? 'dashed' : 'solid'} ${active ? (accent || SK.ink) : SK.faint}`,
        background: active ? (accent ? `${accent}22` : SK.faintBg) : 'transparent',
        color: active ? (accent || SK.ink) : SK.mute,
        fontFamily: '"Kalam", cursive',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function PulseDot({ color = SK.verde }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 0 3px ${color}33`,
        }}
      />
    </span>
  );
}

// crooked annotation arrow with handwritten note
function Annot({ children, color = SK.cobre, dx = 0, dy = 0, rot = -4, style = {} }) {
  return (
    <div
      style={{
        position: 'absolute',
        transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)`,
        color,
        fontFamily: '"Caveat", cursive',
        fontSize: 16,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// avatar circle for equipo
function Avatar({ initial, color = SK.faint, size = 26 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: `1.5px solid ${SK.ink}`,
        background: color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Caveat", cursive',
        fontSize: size * 0.55,
        fontWeight: 700,
        color: SK.ink,
      }}
    >
      {initial}
    </span>
  );
}

// ── shared chrome bits ─────────────────────────────────────

function Sidebar({ accent = SK.dorado, collapsed = false }) {
  const w = collapsed ? 56 : 200;
  const items = [
    ['◐', 'Resumen', true],
    ['$', 'Ventas', false],
    ['◇', 'Equipo', false],
    ['▽', 'Embudo', false],
  ];
  const soon = [
    ['▢', 'Plantillas'],
    ['◯', 'Masivos WA'],
    ['◑', 'Clientes'],
  ];
  return (
    <Box
      style={{
        width: w,
        height: '100%',
        padding: 14,
        background: SK.paperAlt,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'width .2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            border: `1.5px solid ${SK.ink}`,
            background: accent,
            display: 'grid',
            placeItems: 'center',
            fontFamily: '"Caveat", cursive',
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Y
        </div>
        {!collapsed && <Label size={15} weight={700}>Yani Coach</Label>}
      </div>
      {!collapsed && <Label size={10} color={SK.mute} style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>Métricas</Label>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(([ic, name, active]) => (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 10px',
              borderRadius: 6,
              background: active ? `${accent}22` : 'transparent',
              borderLeft: active ? `3px solid ${accent}` : '3px solid transparent',
              color: active ? SK.ink : SK.mute,
            }}
          >
            <span style={{ fontFamily: 'serif', fontSize: 14 }}>{ic}</span>
            {!collapsed && <Label size={13} weight={active ? 700 : 500} color={active ? SK.ink : SK.mute}>{name}</Label>}
          </div>
        ))}
      </div>
      {!collapsed && (
        <>
          <Label size={10} color={SK.mute} style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Herramientas
          </Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {soon.map(([ic, name]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', opacity: 0.5 }}>
                <span style={{ fontFamily: 'serif', fontSize: 14 }}>{ic}</span>
                <Label size={12} weight={500} color={SK.mute}>{name}</Label>
                <span style={{ marginLeft: 'auto' }}>
                  <Pill dashed>pronto</Pill>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
        <Box style={{ padding: '4px 8px', borderRadius: 6 }}>
          <Label size={12}>{collapsed ? '›' : '‹'}</Label>
        </Box>
      </div>
    </Box>
  );
}

function Topbar({ accent = SK.dorado, title = 'Mi negocio', highlight = 'hoy', dense = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: dense ? '10px 16px' : '14px 20px', borderBottom: `1.5px solid ${SK.faint}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: '"Caveat", cursive', fontSize: 32, fontWeight: 700, color: SK.ink, lineHeight: 1 }}>
          {title}{' '}
          <span style={{ color: accent }}>{highlight}</span>
        </span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Pill>Hoy</Pill>
        <Pill active accent={accent}>Últimos 7 días</Pill>
        <Pill>Este mes</Pill>
        <Pill dashed>Rango…</Pill>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PulseDot />
        <Label size={11} color={SK.mute}>actualizado hace 2 min · se refresca solo</Label>
      </div>
    </div>
  );
}

// ── KPI variants ───────────────────────────────────────────

function KpiGlass({ icon, q, big, sub, mini = [], accent = SK.dorado, sparkline = false }) {
  return (
    <Box style={{ flex: 1, padding: 18, background: 'rgba(255,255,255,0.55)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <Label size={13} color={SK.mute}>{q}</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <BigNum>{big}</BigNum>
        {sparkline && <SparkLine accent={accent} />}
      </div>
      <Label size={11} color={SK.mute} italic style={{ display: 'block', marginTop: 4 }}>{sub}</Label>
      <div style={{ borderTop: `1px dashed ${SK.faint}`, marginTop: 12, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {mini.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Label size={11} color={SK.mute}>{m[0]}</Label>
            <Label size={11} weight={700} color={m[2] || SK.ink}>{m[1]}</Label>
          </div>
        ))}
      </div>
    </Box>
  );
}

function KpiSolid({ icon, q, big, sub, mini = [], accent = SK.cobre }) {
  return (
    <Box style={{ flex: 1, padding: 18, background: SK.paperAlt, borderColor: SK.ink, borderWidth: 2 }} thick>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Label size={12} color={SK.mute} style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{q}</Label>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <BigNum>{big}</BigNum>
      <Label size={11} color={SK.mute} italic style={{ display: 'block', marginTop: 4 }}>{sub}</Label>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {mini.map((m, i) => (
          <Box key={i} style={{ flex: 1, padding: '6px 8px', borderRadius: 4 }}>
            <Label size={10} color={SK.mute}>{m[0]}</Label>
            <Label size={13} weight={700} color={m[2] || SK.ink} style={{ display: 'block' }}>{m[1]}</Label>
          </Box>
        ))}
      </div>
    </Box>
  );
}

function SparkLine({ accent = SK.dorado, w = 80, h = 28 }) {
  // hand-drawn looking polyline
  const pts = [3, 8, 6, 12, 9, 16, 22, 18, 24].map((y, i, a) => {
    const x = (i / (a.length - 1)) * (w - 4) + 2;
    return `${x},${h - y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w - 2} cy={h - 24} r={3} fill={accent} />
    </svg>
  );
}

function KpiSpark({ icon, q, big, sub, accent = SK.esmeralda, mini = [] }) {
  return (
    <Box style={{ flex: 1, padding: 18, background: SK.paper, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <Label size={12} color={SK.mute}>{q}</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
        <BigNum>{big}</BigNum>
        <SparkLine accent={accent} w={100} h={36} />
      </div>
      <Label size={11} color={SK.mute} italic style={{ display: 'block', marginTop: 4 }}>{sub}</Label>
      {mini.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 14 }}>
          {mini.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
              <Label size={10} color={SK.mute}>{m[0]}</Label>
              <Label size={12} weight={700} color={m[2] || SK.ink}>{m[1]}</Label>
            </div>
          ))}
        </div>
      )}
    </Box>
  );
}

// ── Funnel variants ────────────────────────────────────────

const FUNNEL_STAGES = [
  { name: 'Leads nuevos', n: 310, pct: 100, hint: 'todas las que entraron' },
  { name: 'Primer mensaje enviado', n: 310, pct: 100, hint: 'contactadas por Mary + Dochi' },
  { name: '⭐ Respondieron', n: 124, pct: 40, hint: 'se enfriaron 186', star: true },
  { name: 'Interesados', n: 58, pct: 47, hint: 'avanzaron del 40%' },
  { name: 'Agendó / llamada', n: null, pct: null, hint: 'se activa con Calendly', soon: true },
];

// V1: vertical funnel (clásico)
function FunnelVertical({ accent = SK.dorado }) {
  const max = 310;
  return (
    <Box style={{ flex: 1, padding: 20, background: 'rgba(255,255,255,0.55)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Label size={18} weight={700}>El camino del lead</Label>
        <Label size={11} color={SK.mute} italic>de izquierda a derecha, paso a paso</Label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {FUNNEL_STAGES.map((s, i) => {
          const widthPct = s.n ? (s.n / max) * 100 : 60;
          return (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 170, textAlign: 'right' }}>
                  <Label size={13} weight={s.star ? 700 : 500} color={s.soon ? SK.mute : SK.ink}>{s.name}</Label>
                  <div><Label size={10} color={SK.mute} italic>{s.hint}</Label></div>
                </div>
                <div style={{ flex: 1, position: 'relative', height: 32 }}>
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: '100%',
                      borderRadius: 6,
                      border: `${s.soon ? '1.5px dashed' : '1.5px solid'} ${SK.ink}`,
                      background: s.soon
                        ? 'transparent'
                        : s.star
                        ? `${accent}66`
                        : `${accent}33`,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 12,
                    }}
                  >
                    {!s.soon && <Label size={15} weight={700}>{s.n}</Label>}
                    {s.soon && <Label size={11} color={SK.mute} italic>PRÓXIMAMENTE</Label>}
                  </div>
                </div>
                <div style={{ width: 56 }}>
                  {s.pct !== null && <Label size={12} weight={700} color={s.star ? accent : SK.mute}>{s.pct}%</Label>}
                </div>
              </div>
              {i < FUNNEL_STAGES.length - 1 && (
                <div style={{ marginLeft: 180, height: 12, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontFamily: '"Caveat", cursive', color: SK.mute, fontSize: 13 }}>↓</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${SK.faint}`, display: 'flex', gap: 14 }}>
        <Box style={{ flex: 1, padding: '10px 14px', background: `${SK.verde}1a` }}>
          <Label size={11} color={SK.mute}>✅ Venta cerrada</Label>
          <BigNum color={SK.verde}>12</BigNum>
        </Box>
        <Box style={{ flex: 1, padding: '10px 14px', background: `${SK.rojo}1a` }}>
          <Label size={11} color={SK.mute}>❌ Venta perdida</Label>
          <BigNum color={SK.rojo}>22</BigNum>
        </Box>
      </div>
    </Box>
  );
}

// V2: horizontal funnel (cada etapa = una columna que se va angostando)
function FunnelHorizontal({ accent = SK.cobre }) {
  const max = 310;
  return (
    <Box style={{ flex: 1, padding: 20, background: SK.paper }}>
      <Label size={18} weight={700}>El camino del lead</Label>
      <Label size={11} color={SK.mute} italic style={{ display: 'block', marginTop: 2, marginBottom: 16 }}>
        cada barra es más chica que la anterior — ahí ves dónde se traban
      </Label>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 200 }}>
        {FUNNEL_STAGES.map((s, i) => {
          const h = s.n ? (s.n / max) * 100 : 30;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: `${h}%`,
                    borderRadius: '6px 6px 0 0',
                    border: `${s.soon ? '1.5px dashed' : '1.5px solid'} ${SK.ink}`,
                    borderBottom: 'none',
                    background: s.soon ? 'transparent' : s.star ? `${accent}77` : `${accent}33`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: 6,
                  }}
                >
                  {!s.soon ? (
                    <BigNum>{s.n}</BigNum>
                  ) : (
                    <Label size={10} color={SK.mute} italic style={{ textAlign: 'center' }}>PRÓXIMA-<br />MENTE</Label>
                  )}
                </div>
              </div>
              <div style={{ borderTop: `1.5px solid ${SK.ink}`, width: '100%', paddingTop: 6, textAlign: 'center', minHeight: 56 }}>
                <Label size={11} weight={s.star ? 700 : 500}>{s.name}</Label>
                <div style={{ marginTop: 2 }}>
                  <Label size={9} color={SK.mute} italic>{s.hint}</Label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
        {[100, 100, 40, 47, null].map((p, i) => (
          <Label key={i} size={11} weight={700} color={i === 2 ? accent : SK.mute}>{p !== null ? `${p}% →` : ''}</Label>
        ))}
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${SK.faint}`, display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
        <Label size={13} color={SK.verde} weight={700}>✅ Vendidas: 12</Label>
        <Label size={13} color={SK.rojo} weight={700}>❌ Perdidas: 22</Label>
      </div>
    </Box>
  );
}

// V3: recharts-style funnel (silueta triangular)
function FunnelChart({ accent = SK.esmeralda }) {
  const max = 310;
  const stages = FUNNEL_STAGES;
  return (
    <Box style={{ flex: 1, padding: 20, background: SK.paper }}>
      <Label size={18} weight={700}>El camino del lead</Label>
      <Label size={11} color={SK.mute} italic style={{ display: 'block', marginTop: 2, marginBottom: 14 }}>
        embudo clásico — silueta que se achica
      </Label>
      <div style={{ display: 'flex', gap: 16 }}>
        {/* triangular funnel shape, centered */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {stages.map((s, i) => {
            const widthPct = s.n ? (s.n / max) * 100 : 35;
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 38 }}>
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: '100%',
                    borderRadius: 4,
                    border: `${s.soon ? '1.5px dashed' : '1.5px solid'} ${SK.ink}`,
                    background: s.soon ? 'transparent' : s.star ? `${accent}88` : `${accent}33`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Label size={13} weight={s.star ? 700 : 500}>{s.name}</Label>
                  {!s.soon && <Label size={14} weight={700}>· {s.n}</Label>}
                  {s.soon && <Label size={10} color={SK.mute} italic>(pronto)</Label>}
                </div>
              </div>
            );
          })}
        </div>
        {/* side legend with deltas */}
        <div style={{ width: 130, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6 }}>
          {stages.map((s, i) => (
            <div key={i} style={{ height: 38, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {s.pct !== null && <Label size={12} weight={700} color={s.star ? accent : SK.mute}>{s.pct}%</Label>}
              <Label size={9} color={SK.mute} italic>{s.hint}</Label>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${SK.faint}`, display: 'flex', gap: 14 }}>
        <Box style={{ flex: 1, padding: '8px 12px', background: `${SK.verde}1a` }}>
          <Label size={11} color={SK.mute}>✅ Cerradas</Label>
          <BigNum color={SK.verde}>12</BigNum>
        </Box>
        <Box style={{ flex: 1, padding: '8px 12px', background: `${SK.rojo}1a` }}>
          <Label size={11} color={SK.mute}>❌ Perdidas</Label>
          <BigNum color={SK.rojo}>22</BigNum>
        </Box>
      </div>
    </Box>
  );
}

// V4: barras horizontales con drop-off explícito
function FunnelBars({ accent = SK.esmeralda }) {
  const max = 310;
  return (
    <Box style={{ flex: 1, padding: 20, background: SK.paper }}>
      <Label size={18} weight={700}>El camino del lead</Label>
      <Label size={11} color={SK.mute} italic style={{ display: 'block', marginTop: 2, marginBottom: 14 }}>
        cada barra muestra cuántos avanzaron y cuántos se cayeron
      </Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FUNNEL_STAGES.map((s, i) => {
          const widthPct = s.n ? (s.n / max) * 100 : 50;
          const drop = i > 0 && FUNNEL_STAGES[i - 1].n && s.n ? FUNNEL_STAGES[i - 1].n - s.n : 0;
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Label size={12} weight={s.star ? 700 : 500}>{s.name}</Label>
                <Label size={12} weight={700} color={s.star ? accent : SK.ink}>
                  {s.n !== null ? s.n : 'pronto'} {s.pct !== null && `· ${s.pct}%`}
                </Label>
              </div>
              <div style={{ height: 14, display: 'flex', borderRadius: 4, overflow: 'hidden', border: `1.5px ${s.soon ? 'dashed' : 'solid'} ${SK.ink}` }}>
                <div style={{ width: `${widthPct}%`, background: s.soon ? 'transparent' : s.star ? `${accent}77` : `${accent}33` }} />
                {drop > 0 && (
                  <div style={{ flex: 1, background: `repeating-linear-gradient(45deg, transparent 0 4px, ${SK.faint} 4px 5px)` }} />
                )}
              </div>
              {drop > 0 && (
                <Label size={10} color={SK.rojo} italic style={{ display: 'block', marginTop: 2 }}>
                  ↳ se cayeron {drop}
                </Label>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${SK.faint}`, display: 'flex', gap: 10 }}>
        <Box style={{ flex: 1, padding: '8px 12px', background: `${SK.verde}1a`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label size={11}>✅ Cerrada</Label>
          <BigNum color={SK.verde}>12</BigNum>
        </Box>
        <Box style={{ flex: 1, padding: '8px 12px', background: `${SK.rojo}1a`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label size={11}>❌ Perdida</Label>
          <BigNum color={SK.rojo}>22</BigNum>
        </Box>
      </div>
    </Box>
  );
}

// ── extras ─────────────────────────────────────────────────

function ActionableHint({ accent = SK.dorado }) {
  return (
    <Box style={{ background: `${accent}1a`, borderColor: accent, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 18 }}>💡</span>
      <div style={{ flex: 1 }}>
        <Label size={13} weight={700}>Tenés 3 leads sin atender hace más de 1h</Label>
        <Label size={11} color={SK.mute} italic style={{ display: 'block' }}>las primeras 2 estaban interesadas — no las dejes enfriar</Label>
      </div>
      <Pill active accent={accent}>Ver chats →</Pill>
    </Box>
  );
}

function EquipoStrip({ accent = SK.dorado, layout = 'row' }) {
  const people = [
    { name: 'Dochi', chats: 47, tiempo: '11 min', color: SK.verde },
    { name: 'Mary', chats: 39, tiempo: '26 min', color: SK.cobre },
  ];
  return (
    <Box style={{ padding: 16, background: 'rgba(255,255,255,0.45)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Label size={14} weight={700}>El equipo</Label>
        <Label size={10} color={SK.mute} italic>tiempo promedio de respuesta</Label>
      </div>
      <div style={{ display: 'flex', flexDirection: layout === 'col' ? 'column' : 'row', gap: 10 }}>
        {people.map(p => (
          <div key={p.name} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: `1px dashed ${SK.faint}`, borderRadius: 6 }}>
            <Avatar initial={p.name[0]} color={`${p.color}33`} size={32} />
            <div style={{ flex: 1 }}>
              <Label size={13} weight={700}>{p.name}</Label>
              <div><Label size={10} color={SK.mute}>{p.chats} chats</Label></div>
            </div>
            <Label size={14} weight={700} color={p.color}>{p.tiempo}</Label>
          </div>
        ))}
      </div>
    </Box>
  );
}

// ── VARIANT A: Clásico ─────────────────────────────────────
// sidebar L · topbar T · 3 KPI glass · funnel vertical · equipo + hint
function VariantA() {
  const accent = SK.dorado;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: SK.paper, fontFamily: '"Kalam", cursive' }}>
      <Sidebar accent={accent} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar accent={accent} />
        <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto', position: 'relative' }}>
          <ActionableHint accent={accent} />
          <div style={{ display: 'flex', gap: 14, position: 'relative' }}>
            <KpiGlass icon="💰" q="¿Cuánto vendimos?" big="$4.250" sub="▲ 12% vs 7 días" accent={accent}
              mini={[['Ventas cerradas', '12'], ['Ticket promedio', '$354']]} />
            <KpiGlass icon="⏱️" q="¿El equipo responde?" big="18 min" sub="promedio de respuesta" accent={accent}
              mini={[['Sin atender', '3', SK.rojo], ['Dochi', '11 min · 47'], ['Mary', '26 min · 39']]} />
            <KpiGlass icon="🎯" q="¿Dónde está la gente?" big="124" sub="leads respondieron de 310" accent={accent}
              mini={[['Tasa de respuesta', '40%', SK.azul], ['Llegaron a venta', '12', SK.verde]]} />
            <Annot dx={-30} dy={-22} rot={-8}>3 cards en glass ✦</Annot>
          </div>
          <div style={{ display: 'flex', gap: 14, position: 'relative' }}>
            <div style={{ flex: 2, position: 'relative' }}>
              <FunnelVertical accent={accent} />
              <Annot dx={-50} dy={120} rot={-6} color={SK.cobre}>la barra clave ⭐</Annot>
            </div>
            <EquipoStrip accent={accent} layout="col" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VARIANT B: Funnel Hero — embudo es la estrella ─────────
// sidebar colapsado · funnel grande horizontal · KPIs en rail derecho
function VariantB() {
  const accent = SK.cobre;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: SK.paper, fontFamily: '"Kalam", cursive' }}>
      <Sidebar accent={accent} collapsed />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar accent={accent} dense />
        <div style={{ flex: 1, padding: 20, display: 'flex', gap: 16, overflow: 'auto', position: 'relative' }}>
          {/* main: funnel hero */}
          <div style={{ flex: 1.7, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
            <FunnelHorizontal accent={accent} />
            <Annot dx={20} dy={-10} rot={-3} color={SK.cobre}>embudo es el héroe — toma toda la pantalla</Annot>
            <EquipoStrip accent={accent} />
          </div>
          {/* right rail: KPIs sólidos apilados */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
            <KpiSolid icon="💰" q="Vendido" big="$4.250" sub="▲ 12% últimos 7 días" accent={accent}
              mini={[['Cerradas', '12'], ['Ticket', '$354']]} />
            <KpiSolid icon="⏱️" q="Respuesta" big="18 min" sub="promedio del equipo" accent={accent}
              mini={[['Sin atender', '3', SK.rojo], ['Equipo', '2 personas']]} />
            <KpiSolid icon="🎯" q="Respondieron" big="124" sub="de 310 nuevos · 40%" accent={accent}
              mini={[['Avanzaron', '58'], ['Vendidas', '12', SK.verde]]} />
            <Annot dx={-12} dy={-18} rot={4} color={SK.cobre}>cards sólidas, apiladas →</Annot>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VARIANT C: Story Feed — narrativo vertical, top tabs ──
// sin sidebar (tabs arriba) · KPIs con sparkline · funnel chart (silueta)
function VariantC() {
  const accent = SK.esmeralda;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: SK.paper, fontFamily: '"Kalam", cursive' }}>
      {/* nav con tabs en lugar de sidebar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderBottom: `1.5px solid ${SK.faint}`, gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${SK.ink}`, background: accent, display: 'grid', placeItems: 'center', fontFamily: '"Caveat",cursive', fontWeight: 700 }}>Y</div>
          <Label size={14} weight={700}>Yani Coach</Label>
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
          {['Resumen', 'Ventas', 'Equipo', 'Embudo'].map((t, i) => (
            <span key={t} style={{ padding: '6px 12px', borderRadius: 6, background: i === 0 ? `${accent}22` : 'transparent', borderBottom: i === 0 ? `2px solid ${accent}` : '2px solid transparent' }}>
              <Label size={12} weight={i === 0 ? 700 : 500} color={i === 0 ? SK.ink : SK.mute}>{t}</Label>
            </span>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Pill>Hoy</Pill><Pill active accent={accent}>7 días</Pill><Pill>Mes</Pill>
          <PulseDot color={accent} />
          <Label size={10} color={SK.mute}>actualizado</Label>
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', position: 'relative' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <span style={{ fontFamily: '"Caveat",cursive', fontSize: 38, fontWeight: 700 }}>
              Mi negocio <span style={{ color: accent }}>hoy</span>
            </span>
            <Label size={12} color={SK.mute} italic style={{ display: 'block' }}>una historia de tres capítulos — qué vendiste, cómo respondió tu equipo, dónde están las personas</Label>
          </div>
          <ActionableHint accent={accent} />
          {/* capítulo 1: dinero */}
          <div style={{ position: 'relative' }}>
            <Label size={11} color={SK.mute} style={{ textTransform: 'uppercase', letterSpacing: '.1em' }}>· capítulo 1 ·</Label>
            <KpiSpark icon="💰" q="¿Cuánto vendimos esta semana?" big="$4.250" sub="▲ 12% vs los 7 días anteriores" accent={accent}
              mini={[['Cerradas', '12'], ['Ticket', '$354'], ['Récord', 'Mar 23']]} />
            <Annot dx={420} dy={-50} rot={-5} color={accent}>sparkline integrada →</Annot>
          </div>
          {/* capítulo 2: equipo */}
          <div>
            <Label size={11} color={SK.mute} style={{ textTransform: 'uppercase', letterSpacing: '.1em' }}>· capítulo 2 ·</Label>
            <KpiSpark icon="⏱️" q="¿El equipo está respondiendo bien?" big="18 min" sub="promedio · 3 sin atender" accent={accent}
              mini={[['Dochi', '11 min / 47'], ['Mary', '26 min / 39'], ['Sin atender', '3', SK.rojo]]} />
          </div>
          {/* capítulo 3: gente */}
          <div>
            <Label size={11} color={SK.mute} style={{ textTransform: 'uppercase', letterSpacing: '.1em' }}>· capítulo 3 ·</Label>
            <KpiSpark icon="🎯" q="¿Dónde está la gente?" big="124" sub="leads respondieron de 310 · 40%" accent={accent}
              mini={[['Interesados', '58'], ['Vendidas', '12', SK.verde], ['Perdidas', '22', SK.rojo]]} />
          </div>
          {/* embudo */}
          <FunnelChart accent={accent} />
          <Annot dx={20} dy={-200} rot={3} color={SK.cobre} style={{ position: 'absolute', right: 0 }}>silueta clásica</Annot>
        </div>
      </div>
    </div>
  );
}

// ── VARIANT D: Split Studio — funnel-barras + rail ────────
// sidebar L · split 60/40 · funnel-barras izq · KPI + equipo der
function VariantD() {
  const accent = SK.esmeralda;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: SK.paper, fontFamily: '"Kalam", cursive' }}>
      <Sidebar accent={accent} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar accent={accent} />
        <div style={{ flex: 1, padding: 20, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, overflow: 'auto', position: 'relative' }}>
          {/* col izq: embudo + hint */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
            <ActionableHint accent={accent} />
            <FunnelBars accent={accent} />
            <Annot dx={20} dy={-280} rot={-4} color={accent}>barras + drop-off explícito ↓</Annot>
          </div>
          {/* col der: KPIs + equipo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
            <KpiGlass icon="💰" q="Vendido" big="$4.250" sub="▲ 12% últimos 7 días" sparkline accent={accent}
              mini={[['Cerradas', '12'], ['Ticket', '$354']]} />
            <KpiGlass icon="⏱️" q="Tiempo respuesta" big="18 min" sub="3 sin atender" sparkline accent={accent}
              mini={[['Dochi', '11 min'], ['Mary', '26 min']]} />
            <KpiGlass icon="🎯" q="Respuesta" big="40%" sub="124 de 310 leads" sparkline accent={accent}
              mini={[['Interesados', '58'], ['Vendidas', '12', SK.verde]]} />
            <EquipoStrip accent={accent} layout="col" />
            <Annot dx={-30} dy={-470} rot={6} color={accent}>rail con sparkline</Annot>
          </div>
        </div>
      </div>
    </div>
  );
}

window.YaniWireframes = { VariantA, VariantB, VariantC, VariantD };
