// Yani Coach Dashboard — EquipoCard, TeamRow components
// Ported from diseno-aprobado/dashboard.jsx lines 793-868
import React from 'react';
import { useCountUp, fmt } from './primitives';

export interface TeamMember {
  name: string;
  chats: number;
  time: number | null; // mediana de minutos; null = no hay chats con tiempo registrado
  color: string;
  tone: string;
}

export interface EquipoCardProps {
  team: TeamMember[];
  sinAtender: number;
  delay?: number;
}

interface TeamRowProps {
  person: TeamMember;
  delay: number;
  key?: React.Key;
}

function TeamRow({ person, delay }: TeamRowProps) {
  const hasTime = person.time !== null;
  const time = useCountUp(person.time ?? 0, { duration: 1000, delay: delay + 100 }) as number;
  const chats = useCountUp(person.chats, { duration: 1000, delay: delay + 200 }) as number;
  const initial = person.name ? person.name[0].toUpperCase() : '?';

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
          <span className="yc-num" style={{ fontSize: 14, fontWeight: 600, color: hasTime ? person.color : 'var(--yc-text-mute)' }}>
            {hasTime ? fmt.dur(time) : 'sin dato'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <span className="yc-num" style={{ fontSize: 11.5, color: 'var(--yc-text-faint)' }}>
            respondió {fmt.num(chats)} chats
          </span>
          <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>{hasTime ? 'en promedio' : 'sin tiempo registrado'}</span>
        </div>
        {/* mini bar showing relative response time vs 30min reference */}
        <div style={{ marginTop: 6, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              width: hasTime ? `${Math.min(100, ((person.time ?? 0) / 30) * 100)}%` : '0%',
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

export function EquipoCard({ team, sinAtender, delay = 0 }: EquipoCardProps) {
  return (
    <section
      className="yc-glass yc-fade-up"
      style={{ animationDelay: `${delay}ms`, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <header>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>El equipo</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--yc-text-mute)' }}>cómo viene cada una</p>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {team.map((p, i) => (
          <TeamRow key={p.name} person={p} delay={delay + 200 + i * 150} />
        ))}
      </div>
      <div className="yc-divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--yc-red)',
              boxShadow: '0 0 10px rgba(232,122,122,0.5)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--yc-text-mute)' }}>Seguimientos vencidos</span>
        </div>
        <span className="yc-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--yc-red)' }}>
          {fmt.num(sinAtender)}
        </span>
      </div>
    </section>
  );
}
