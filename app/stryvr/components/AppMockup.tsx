'use client';

import { motion } from 'framer-motion';

/* Mockup dark industriel — DA Technogym
   Fond #0f0f0f, accent #F5D800 jaune, données massives, barres verticales */

function TrainingScreen() {
  const bars = [30,35,40,45,50,55,60,65,60,55,50,45,40,35,30,35,40,45,50,55];
  const activeCount = 12;

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 2 }}>
          SESSION EN COURS
        </p>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', margin: 0 }}>
          Développé couché
        </p>
      </div>

      {/* Curve zone */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#0f0f0f' }}>
        <svg viewBox="0 0 260 80" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
          {/* Sinusoidal curve */}
          <path
            d="M0,60 C40,60 60,20 100,25 C140,30 160,60 200,55 C230,52 250,30 260,28"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Moving dot */}
          <circle cx="100" cy="25" r="5" fill="#ffffff" />
          {/* Target diamond */}
          <path d="M200,50 L205,55 L200,60 L195,55 Z" fill="none" stroke="#F5D800" strokeWidth="1.5" />
          <path d="M230,25 L235,30 L230,35 L225,30 Z" fill="none" stroke="#F5D800" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Bars */}
      <div style={{ backgroundColor: '#0a0a0a', padding: '10px 12px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${(h / 65) * 100}%`,
                backgroundColor: i < activeCount ? '#F5D800' : '#2a2a2a',
                borderRadius: 0,
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
          {bars.map((v, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontSize: 4.5, color: i < activeCount ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom stats */}
      <div style={{ backgroundColor: '#111111', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, flexShrink: 0 }}>
        {[
          { label: 'REPS', value: '16/35' },
          { label: 'CHARGE', value: '60 kg' },
          { label: 'TEMPS', value: '00:06' },
        ].map((s, i) => (
          <div key={s.label} style={{ textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 2 }}>{s.label}</p>
            <p style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? '#F5D800' : '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaScreen() {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 10px', flexShrink: 0 }}>
        <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 2 }}>
          VENDREDI 16 MAI
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>Smart Agenda</p>
          {/* Score arc */}
          <svg width="34" height="34" viewBox="0 0 34 34">
            <circle cx="17" cy="17" r="13" fill="none" stroke="#2a2a2a" strokeWidth="3" />
            <circle cx="17" cy="17" r="13" fill="none" stroke="#F5D800" strokeWidth="3"
              strokeDasharray="58" strokeDashoffset="18" strokeLinecap="square"
              transform="rotate(-90 17 17)" />
            <text x="17" y="21" textAnchor="middle" style={{ fontSize: 8, fontWeight: 800, fill: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>74</text>
          </svg>
        </div>
      </div>

      {/* Macro bars */}
      <div style={{ margin: '0 14px 10px', backgroundColor: '#161616', padding: '8px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, flexShrink: 0 }}>
        {[
          { label: 'KCAL', val: '1840', pct: 0.72 },
          { label: 'PROT', val: '112g', pct: 0.66 },
          { label: 'EAU', val: '1.4L', pct: 0.58 },
        ].map(item => (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{item.label}</span>
              <span style={{ fontSize: 7, fontWeight: 700, color: '#F5D800' }}>{item.val}</span>
            </div>
            <div style={{ height: 2, backgroundColor: '#2a2a2a' }}>
              <div style={{ height: '100%', width: `${item.pct * 100}%`, backgroundColor: '#F5D800' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Events */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[
          { label: 'Check-in matinal', meta: 'Énergie · Sommeil · Humeur', status: 'done', time: '07:30' },
          { label: 'Déjeuner', meta: '620 kcal · 45g protéines', status: 'done', time: '12:15' },
          { label: 'Séance Push', meta: '6 exercices · ~55 min', status: 'active', time: '17:30' },
          { label: 'Compléments soir', meta: 'Magnésium · Oméga-3', status: 'pending', time: '21:00' },
        ].map(ev => (
          <div key={ev.label} style={{
            backgroundColor: ev.status === 'active' ? '#161616' : '#111111',
            borderLeft: ev.status === 'active' ? `2px solid #F5D800` : '2px solid transparent',
            padding: '7px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 9.5, fontWeight: ev.status === 'active' ? 700 : 600, color: ev.status === 'active' ? '#ffffff' : 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.3 }}>{ev.label}</p>
              <p style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{ev.meta}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', margin: 0 }}>{ev.time}</p>
              {ev.status === 'done' && <div style={{ width: 6, height: 6, backgroundColor: '#F5D800', marginLeft: 'auto', marginTop: 2 }} />}
              {ev.status === 'active' && <div style={{ width: 6, height: 6, backgroundColor: '#F5D800', marginLeft: 'auto', marginTop: 2, animation: 'pulse 1s infinite' }} />}
            </div>
          </div>
        ))}
      </div>

      {/* Phase strip */}
      <div style={{ margin: '8px 14px 12px', backgroundColor: '#161616', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, backgroundColor: '#F5D800' }} />
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: '#ffffff', textTransform: 'uppercase', margin: 0 }}>FAT LOSS · SEM. 3/8</p>
        </div>
        <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Déload dans 5 sem.</p>
      </div>
    </div>
  );
}

export function AppMockup({ screen = 'agenda' }: { screen?: 'agenda' | 'training' }) {
  return (
    <div
      className="relative select-none"
      style={{
        width: 260,
        height: 520,
        borderRadius: 32,
        backgroundColor: '#0a0a0a',
        padding: 8,
        transform: 'perspective(1200px) rotateY(-4deg) rotateX(2deg)',
        boxShadow: '0 48px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {/* Dynamic island */}
      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', width: 56, height: 14, backgroundColor: '#0a0a0a', borderRadius: 8, zIndex: 10 }} />
      {/* Screen */}
      <div style={{ width: '100%', height: '100%', borderRadius: 26, overflow: 'hidden' }}>
        {screen === 'training' ? <TrainingScreen /> : <AgendaScreen />}
      </div>
    </div>
  );
}

export function HeroPhoneStack() {
  return (
    <div className="relative flex items-center justify-center" style={{ height: 560 }}>
      {/* Glow */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(245,216,0,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Back phone — training */}
      <motion.div
        initial={{ opacity: 0, x: 60, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'absolute', right: -20, top: 40, zIndex: 1, transform: 'perspective(1200px) rotateY(-8deg) rotateX(3deg) scale(0.88)', opacity: 0.7 }}
      >
        <AppMockup screen="training" />
      </motion.div>

      {/* Front phone — agenda */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 30 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', zIndex: 2 }}
      >
        <AppMockup screen="agenda" />
      </motion.div>
    </div>
  );
}
