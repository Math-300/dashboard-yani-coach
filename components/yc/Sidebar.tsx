// Yani Coach Dashboard — Sidebar component
// Ported verbatim from diseno-aprobado/dashboard.jsx (lines 272-411)
import React from 'react';
import { Icons } from './icons';
import { logout } from '../../services/authService';
import { useAuth } from '../../auth/AuthContext';

export type SectionId = 'resumen' | 'ventas' | 'equipo' | 'embudo' | 'plantillas';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
}

// ── NavGroup ──────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  Icon: (p: React.ComponentProps<typeof Icons.Summary>) => React.ReactElement | null;
  active?: boolean;
}

interface NavGroupProps {
  label: string;
  suffix?: string;
  collapsed: boolean;
  items: NavItem[];
  soon?: boolean;
  onSelect?: (id: string) => void;
  activeId?: string;
}

function NavGroup({ label, suffix, collapsed, items, soon = false, onSelect, activeId }: NavGroupProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {!collapsed && (
        <div
          className="yc-sidebar-text"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 10px 6px',
            color: 'var(--yc-text-faint)',
            fontSize: 10.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {label}
          {suffix && (
            <span style={{ color: 'var(--yc-text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>
              · {suffix}
            </span>
          )}
        </div>
      )}
      {items.map(({ id, label, Icon, active }) => (
        <div
          key={id}
          className={`yc-nav-item${active ? ' is-active' : ''}${soon ? ' is-soon' : ''}`}
          style={{
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '11px 0' : '9px 12px',
            cursor: soon ? 'default' : 'pointer',
          }}
          onClick={soon ? undefined : () => onSelect?.(id)}
        >
          <Icon size={18} style={{ color: active ? 'var(--yc-gold-2)' : 'currentColor' }} />
          {!collapsed && (
            <span
              className="yc-sidebar-text"
              style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {label}
            </span>
          )}
          {!collapsed && soon && <span className="yc-soon-badge yc-sidebar-text">pronto</span>}
          {collapsed && <span className="yc-tip">{label}{soon ? ' · pronto' : ''}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────

export function Sidebar({ collapsed, onToggle, activeSection, onSelect }: SidebarProps) {
  const { refreshSession } = useAuth();
  const w = collapsed ? 64 : 240;

  const metricsItems: NavItem[] = [
    { id: 'resumen', label: 'Resumen', Icon: Icons.Summary, active: activeSection === 'resumen' },
    { id: 'ventas', label: 'Ventas', Icon: Icons.Sales, active: activeSection === 'ventas' },
    { id: 'equipo', label: 'Equipo', Icon: Icons.Team, active: activeSection === 'equipo' },
    { id: 'embudo', label: 'Embudo', Icon: Icons.Funnel, active: activeSection === 'embudo' },
    { id: 'plantillas', label: 'Plantillas', Icon: Icons.Templates, active: activeSection === 'plantillas' },
  ];

  const soonItems: NavItem[] = [
    { id: 'masivos', label: 'Masivos WhatsApp', Icon: Icons.Whats },
    { id: 'clientes', label: 'Clientes', Icon: Icons.Clients },
  ];

  const handleLogout = async () => {
    await logout();
    await refreshSession();
  };

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
          <div
            className="yc-sidebar-text"
            style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, overflow: 'hidden' }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
              Yani <span className="yc-gold-text" style={{ fontWeight: 600 }}>Coach</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--yc-text-faint)', marginTop: 3 }}>panel de negocio</span>
          </div>
        )}
      </div>

      {/* Nav body */}
      <div
        className="yc-scroll"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: collapsed ? '14px 10px' : '14px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <NavGroup
          label="Métricas"
          collapsed={collapsed}
          items={metricsItems}
          onSelect={(id) => onSelect(id as SectionId)}
          activeId={activeSection}
        />
        <NavGroup
          label="Herramientas"
          suffix="próximamente"
          collapsed={collapsed}
          items={soonItems}
          soon
        />
      </div>

      {/* Footer: user block + collapse toggle + logout */}
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
          <div
            className="yc-sidebar-text"
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}
          >
            <div
              className="yc-avatar"
              style={{ background: 'linear-gradient(135deg, #2a2138 0%, #1a1420 100%)', color: 'var(--yc-gold-2)' }}
            >
              Y
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Yani</span>
              <span style={{ fontSize: 11, color: 'var(--yc-text-faint)', whiteSpace: 'nowrap' }}>cuenta personal</span>
            </div>
          </div>
        )}

        {/* Logout button — discreet icon when collapsed, tiny text link when expanded */}
        <button
          onClick={handleLogout}
          title="Salir"
          style={{
            border: '1px solid var(--yc-border)',
            background: 'rgba(255,255,255,0.02)',
            color: 'var(--yc-text-faint)',
            width: 28,
            height: 28,
            borderRadius: 7,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            transition: 'all .15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--yc-text-mute)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--yc-text-faint)';
          }}
          aria-label="Salir"
        >
          {/* Power/exit icon */}
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>

        {/* Collapse toggle */}
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
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--yc-text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--yc-text-mute)';
          }}
          aria-label={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? <Icons.ChevronRight size={16} /> : <Icons.ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
