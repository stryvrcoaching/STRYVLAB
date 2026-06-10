'use client'

import type { AdherenceResult } from '@/lib/client/smart/adherenceScore'
import { useClientT } from '@/components/client/ClientI18nProvider'

function getTheme(score: number, t: (k: string) => string) {
  if (score >= 75) return {
    bg: '#f2f2f2',
    accent: '#080808',
    textPrimary: '#080808',
    textSecondary: 'rgba(0,0,0,0.5)',
    trackColor: 'rgba(0,0,0,0.12)',
    deltaBg: 'rgba(0,0,0,0.10)',
    label: score >= 85 ? t('smart.adherence.elite') : t('smart.adherence.fit'),
  }
  if (score >= 50) return {
    bg: '#1a1a1a',
    accent: '#f2f2f2',
    textPrimary: '#f2f2f2',
    textSecondary: 'rgba(255,255,255,0.4)',
    trackColor: 'rgba(255,255,255,0.06)',
    deltaBg: 'rgba(255,255,255,0.08)',
    label: score >= 60 ? t('smart.adherence.good') : t('smart.adherence.improve'),
  }
  return {
    bg: '#111111',
    accent: '#ef4444',
    textPrimary: '#ef4444',
    textSecondary: 'rgba(239,68,68,0.5)',
    trackColor: 'rgba(255,255,255,0.06)',
    deltaBg: 'rgba(239,68,68,0.10)',
    label: t('smart.adherence.restart'),
  }
}

const DIMS = [
  { key: 'sport'     as const, label: 'Sport',       color: 'var(--data-petrol)' },
  { key: 'nutrition' as const, label: 'Nutrition',   color: 'var(--data-gold)' },
  { key: 'hydration' as const, label: 'Hydratation', color: 'var(--data-copper)' },
  { key: 'checkins'  as const, label: 'Check-ins',   color: '#808080' },
]

export default function AdherenceScoreCard({ score, scoreDelta, dimensions }: AdherenceResult) {
  const { t: translate } = useClientT()
  const t = getTheme(score, translate as (k: string) => string)
  const r = 68
  const arcTotal = Math.PI * r
  const arcOffset = arcTotal * (1 - score / 100)
  const isLight = score >= 75

  return (
    <div
      className="rounded-2xl px-5 pt-5 pb-4 relative overflow-hidden"
      style={{ background: t.bg }}
    >
      {/* Delta badge */}
      {scoreDelta !== 0 && (
        <div
          className="absolute top-4 right-4 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full"
          style={{ background: t.deltaBg, color: t.textPrimary }}
        >
          {scoreDelta > 0 ? '+' : ''}{scoreDelta} vs hier
        </div>
      )}

      {/* Anneau + score */}
      <div className="flex justify-center relative" style={{ height: 96 }}>
        <svg viewBox="0 0 160 86" style={{ width: 200, height: 96 }}>
          <path
            d={`M ${80 - r} 82 A ${r} ${r} 0 0 1 ${80 + r} 82`}
            fill="none"
            stroke={t.trackColor}
            strokeWidth={13}
            strokeLinecap="round"
          />
          <path
            d={`M ${80 - r} 82 A ${r} ${r} 0 0 1 ${80 + r} 82`}
            fill="none"
            stroke={t.accent}
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray={arcTotal}
            strokeDashoffset={arcOffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span
            className="font-black font-mono leading-none tabular-nums"
            style={{ fontSize: 40, color: t.accent }}
          >
            {score}
          </span>
          <span
            className="font-barlow-condensed font-bold uppercase tracking-[0.2em] mt-0.5"
            style={{ fontSize: 9, color: t.textSecondary }}
          >
            {t.label}
          </span>
        </div>
      </div>

      {/* 4 dimensions */}
      <div className="grid grid-cols-4 gap-3 mt-4">
        {DIMS.map(d => {
          const val = dimensions[d.key]
          const pct = (val / 25) * 100
          const dimColor = isLight ? 'rgba(0,0,0,0.6)' : d.color
          const barBg = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.07)'
          const barFill = isLight ? 'rgba(0,0,0,0.5)' : d.color
          return (
            <div key={d.key} className="flex flex-col items-center gap-1.5">
              <span
                className="font-black font-mono tabular-nums"
                style={{ fontSize: 16, color: dimColor }}
              >
                {val}
              </span>
              <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: barBg }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: barFill, transition: 'width 0.6s ease' }}
                />
              </div>
              <span
                className="font-barlow-condensed font-bold uppercase tracking-[0.08em] text-center leading-tight"
                style={{ fontSize: 7, color: t.textSecondary }}
              >
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
