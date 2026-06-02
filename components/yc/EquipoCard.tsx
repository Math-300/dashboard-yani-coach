// Yani Coach Dashboard — EquipoCard, TeamRow components
// Ported from diseno-aprobado/dashboard.jsx lines 793-868
import React from 'react';
import { useCountUp, fmt } from './primitives';

export interface TeamMember {
  name: string;
  chats: number;
  time: number | null; // mediana de minutos; null = no hay chats con tiempo registrado
  sinRespuesta: number;
  color: string;
  tone: string;
  dist: { menos15: number; e1560: number; e14h: number; mas4h: number };
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 10.5, color: 'var(--yc-text-mute)' }}>{label}</span>
    </span>
  );
}

export interface EquipoCardProps {
  team: TeamMember[];
  sinAtender: number;
  sinRespuestaTotal: number;
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
          {person.sinRespuesta > 0 ? (
            <span className="yc-num" style={{ fontSize: 11.5, color: 'var(--yc-red)' }}>
              {person.sinRespuesta} sin responder
            </span>
          ) : (
            <span style={{ fontSize: 11.5, color: 'var(--yc-text-mute)' }}>al día</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--yc-text-faint)' }}>tiempo típico 30d</span>
        </div>
        {/* distribución del tiempo de respuesta en 4 tramos */}
        {(() => {
          const d = person.dist;
          const tot = d.menos15 + d.e1560 + d.e14h + d.mas4h;
          if (tot === 0) return <div style={{ marginTop: 7, height: 7 }} />;
          const seg = (n: number, color: string, label: string) =>
            n > 0 ? (
              <div title={`${label}: ${n}`} style={{ width: `${(n / tot) * 100}%`, background: color, height: '100%' }} />
            ) : null;
          return (
            <div style={{ marginTop: 7, height: 7, borderRadius: 4, overflow: 'hidden', display: 'flex', gap: 1, background: 'rgba(255,255,255,0.05)' }}>
              {seg(d.menos15, 'var(--yc-green)', 'Menos de 15 min')}
              {seg(d.e1560, 'var(--yc-gold)', '15 min – 1 h')}
              {seg(d.e14h, '#f0a050', '1 – 4 h')}
              {seg(d.mas4h, 'var(--yc-red)', 'Más de 4 horas')}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export function EquipoCard({ team, sinAtender, sinRespuestaTotal, delay = 0 }: EquipoCardProps) {
  return (
    <section
      className="yc-glass yc-fade-up"
      style={{ animationDelay: `${delay}ms`, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <header>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>El equipo</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--yc-text-mute)' }}>cómo viene cada una</p>
      </header>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: -4 }}>
        <LegendDot color="var(--yc-green)" label="−15 min" />
        <LegendDot color="var(--yc-gold)" label="15 m–1 h" />
        <LegendDot color="#f0a050" label="1–4 h" />
        <LegendDot color="var(--yc-red)" label="+4 h" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {team.map((p, i) => (
          <TeamRow key={p.name} person={p} delay={delay + 200 + i * 150} />
        ))}
      </div>
      <div className="yc-divider" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            <span style={{ fontSize: 12.5, color: 'var(--yc-text-mute)' }}>Sin respuesta humana (período)</span>
          </div>
          <span className="yc-num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--yc-red)' }}>
            {fmt.num(sinRespuestaTotal)}
          </span>
        </div>
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
      </div>
    </section>
  );
}
