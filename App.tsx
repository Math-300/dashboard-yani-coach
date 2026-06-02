import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar, type SectionId } from './components/yc/Sidebar';
import { Topbar } from './components/yc/Topbar';
import { useDashboardData } from './hooks/useDashboardData';
import { AuthProvider } from './auth/AuthContext';
import AuthGuard from './auth/AuthGuard';
import LoginView from './components/LoginView';
import { loadInitialRange, savePresetSelection, getPresetRange, type DateRangePreset } from './services/dateUtils';
import { getCacheState } from './services/cacheService';
import { ResumenView, presetToLabel } from './components/views/ResumenView';

// ── Skeleton (first-paint shimmer) ────────────────────────
// Ported from diseno-aprobado/dashboard.jsx lines 872-887
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

// ── lastUpdatedLabel helper ────────────────────────────────
function buildLastUpdatedLabel(): string {
  const state = getCacheState();
  const ts = state.lastFetch ?? state.data?.timestamp ?? null;
  if (!ts) return 'se actualiza solo';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'hace un momento';
  if (diffMin === 1) return '1 min';
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  return diffH === 1 ? '1 h' : `${diffH} h`;
}

// ── DashboardShell ────────────────────────────────────────
function DashboardShell() {
  const [section, setSection] = useState<SectionId>('resumen');
  const [collapsed, setCollapsed] = useState(false);

  // Initialize date range from persisted localStorage preset
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => loadInitialRange().range);

  // Track which pill id is "active" for the Topbar
  const [activePresetId, setActivePresetId] = useState<string>(() => {
    const { preset } = loadInitialRange();
    // Map dateUtils preset IDs → pill IDs used in Topbar
    if (preset === 'today') return 'today';
    if (preset === 'week') return '7d';
    if (preset === 'month') return 'month';
    if (preset === 'custom') return 'custom';
    return 'custom'; // any other preset (last_30_days etc.) shows as custom in topbar
  });

  const {
    contacts,
    sales,
    sellers,
    kpiCounts,
    funnelRespondio,
    responsividad,
    isLoading,
    error,
    refresh,
    isInitialLoad,
  } = useDashboardData(dateRange.start, dateRange.end);

  const handleRangeChange = (presetId: string, start: Date, end: Date) => {
    setDateRange({ start, end });
    setActivePresetId(presetId);
    // Map pill id → DateRangePreset for persistence
    const presetMap: Record<string, DateRangePreset> = {
      today: 'today',
      '7d': 'week',
      month: 'month',
      custom: 'custom',
    };
    const preset: DateRangePreset = presetMap[presetId] ?? 'custom';
    savePresetSelection(preset, { start, end });
  };

  const lastUpdatedLabel = buildLastUpdatedLabel();

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        activeSection={section}
        onSelect={setSection}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          activeRange={activePresetId}
          onRangeChange={handleRangeChange}
          lastUpdatedLabel={lastUpdatedLabel}
          startDate={dateRange.start}
          endDate={dateRange.end}
        />

        {/* Loading initial state — skeleton shimmer */}
        {isInitialLoad ? (
          <SkeletonScreen />
        ) : error ? (
          /* Error state — always visible, never hidden */
          <div
            className="yc-glass"
            style={{
              margin: '32px',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--yc-text)' }}>
              No se pudieron cargar los datos
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--yc-text-mute)' }}>
              {error.message}
            </span>
            <button
              onClick={refresh}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: '1px solid rgba(231,193,90,0.35)',
                background: 'linear-gradient(180deg, rgba(231,193,90,0.18), rgba(231,193,90,0.06))',
                color: 'var(--yc-gold-2)',
                fontSize: 13,
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
                fontFamily: 'inherit',
              }}
            >
              Reintentar
            </button>
          </div>
        ) : (
          /* Main content scroll area */
          <div
            className="yc-scroll"
            style={{ flex: 1, overflow: 'auto', padding: '20px 32px 32px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1500, margin: '0 auto' }}>
              {/* ── Section views ─────────────────────── */}
              {section === 'resumen' && (
                <ResumenView
                  sales={sales}
                  funnelRespondio={funnelRespondio}
                  responsividad={responsividad}
                  kpiCounts={kpiCounts}
                  sellers={sellers}
                  contacts={contacts}
                  rangeLabel={presetToLabel(activePresetId)}
                />
              )}
              {section === 'ventas' && (
                <div className="yc-glass" style={{ padding: 24 }}>
                  Ventas — próximamente
                </div>
              )}
              {section === 'equipo' && (
                <div className="yc-glass" style={{ padding: 24 }}>
                  Equipo — próximamente
                </div>
              )}
              {section === 'embudo' && (
                <div className="yc-glass" style={{ padding: 24 }}>
                  Embudo — próximamente
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <DashboardShell />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
