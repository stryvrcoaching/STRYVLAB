'use client'

import { useEffect, useState, useMemo } from 'react'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import { useChartScrubber } from '@/hooks/useChartScrubber'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { clientLocale } from '@/lib/i18n/clientTranslations'

type DayPoint = { date: string; consumed: number; target: number }
type DeltaPoint = { date: string; delta: number; consumed: number }

type Props = { days: number }

const MIN_LOGGED_KCAL = 800
const W = 320
const H = 100
const PAD = { top: 10, right: 8, bottom: 20, left: 36 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d)
}

export default function KcalVariationChart({ days }: Props) {
  const { lang, t } = useClientT()
  const locale = clientLocale(lang)
  const daySuffix = lang === 'es' ? 'd' : lang === 'en' ? 'd' : 'j'
  const [trend, setTrend] = useState<DayPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/client/nutrition/weekly-trend?days=${days}`)
      .then(r => r.ok ? r.json() : { trend: [] })
      .then(d => { setTrend(Array.isArray(d?.trend) ? d.trend : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days])

  const deltas = useMemo((): DeltaPoint[] => {
    const logged = trend.filter(p => p.consumed >= MIN_LOGGED_KCAL)
    return logged.map((p, i) => {
      if (i === 0) return { date: p.date, delta: 0, consumed: p.consumed }
      return { date: p.date, delta: p.consumed - logged[i - 1].consumed, consumed: p.consumed }
    }).slice(1)
  }, [trend])

  const { activeIndex, handlers, svgRef } = useChartScrubber(deltas.length, W, PAD.left, PAD.right)

  if (loading) {
    return (
      <div className="bg-[#161616] rounded-2xl p-4">
        <div className="h-4 w-36 bg-white/[0.06] rounded animate-pulse mb-4" />
        <div className="h-[100px] bg-white/[0.04] rounded-xl animate-pulse" />
      </div>
    )
  }

  if (deltas.length === 0) return null

  const maxAbs = Math.max(50, ...deltas.map(d => Math.abs(d.delta)))
  const midY = PAD.top + INNER_H / 2

  const toX = (i: number) => PAD.left + (deltas.length <= 1 ? INNER_W / 2 : (i / (deltas.length - 1)) * INNER_W)
  const toY = (v: number) => midY - (v / maxAbs) * (INNER_H / 2)

  const positives = deltas.filter(d => d.delta > 0)
  const negatives = deltas.filter(d => d.delta < 0)
  const avgDelta = deltas.reduce((s, d) => s + d.delta, 0) / deltas.length

  const activePoint = activeIndex !== null ? deltas[activeIndex] : null
  const barW = Math.max(2, INNER_W / deltas.length * 0.6)

  return (
    <div className="bg-[#161616] rounded-2xl p-4">
      <div className="mb-3">
        <p className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/50 mb-0.5">
          {t('nutrition.kcalVariation.title')}
        </p>
        {activePoint ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-bold text-white/50 tabular-nums">{formatDate(activePoint.date, locale)}</span>
            <span className={`text-[18px] font-black tabular-nums leading-none ${activePoint.delta >= 0 ? 'text-[#ffd15e]' : 'text-[#5dba87]'}`}>
              {activePoint.delta >= 0 ? '+' : ''}{Math.round(activePoint.delta)}
            </span>
            <span className="text-[10px] text-white/40">kcal · {Math.round(activePoint.consumed).toLocaleString(locale)} {t('nutrition.kcalVariation.total')}</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className={`text-[22px] font-black tabular-nums leading-none ${avgDelta >= 0 ? 'text-[#ffd15e]' : 'text-[#5dba87]'}`}>
              {avgDelta >= 0 ? '+' : ''}{Math.round(avgDelta)}
            </span>
            <span className="text-[10px] text-white/40">{t('nutrition.kcalVariation.avgDayToDay')}</span>
          </div>
        )}
      </div>

      <div className="w-full overflow-hidden touch-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: H }}
          preserveAspectRatio="none"
          {...handlers}
        >
          {/* Zero line */}
          <line x1={PAD.left} y1={midY} x2={W - PAD.right} y2={midY} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />

          {/* Y-axis labels */}
          <text x={PAD.left - 4} y={midY + 3.5} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.25)">0</text>
          <text x={PAD.left - 4} y={PAD.top + 3.5} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.18)">+{Math.round(maxAbs)}</text>
          <text x={PAD.left - 4} y={H - PAD.bottom + 1.5} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.18)">-{Math.round(maxAbs)}</text>

          {/* Bars */}
          {deltas.map((d, i) => {
            const x = toX(i)
            const y = toY(d.delta)
            const bH = Math.abs(midY - y)
            const isPos = d.delta >= 0
            const barY = isPos ? y : midY
            const isActive = activeIndex === i
            return (
              <rect
                key={d.date}
                x={x - barW / 2}
                y={barY}
                width={barW}
                height={Math.max(1, bH)}
                rx="1.5"
                fill={isPos ? `rgba(255,209,94,${isActive ? 1 : 0.7})` : `rgba(93,186,135,${isActive ? 1 : 0.7})`}
              />
            )
          })}

          {/* Scrub line */}
          {activeIndex !== null && (
            <line
              x1={toX(activeIndex)} y1={PAD.top}
              x2={toX(activeIndex)} y2={H - PAD.bottom}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.8"
              strokeDasharray="3 2"
            />
          )}

          {/* X-axis dates (hidden when scrubbing) */}
          {activeIndex === null && deltas.length >= 2 && (
            <>
              <text x={PAD.left} y={H - 2} textAnchor="start" fontSize="7" fill="rgba(255,255,255,0.25)">
                {formatDate(deltas[0].date, locale)}
              </text>
              <text x={W - PAD.right} y={H - 2} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.25)">
                {formatDate(deltas[deltas.length - 1].date, locale)}
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06] mt-2">
        <div>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">{t('nutrition.kcalVariation.increases')}</p>
          <p className="text-[12px] font-black text-[#ffd15e] tabular-nums">{positives.length}{daySuffix}</p>
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">{t('nutrition.kcalVariation.decreases')}</p>
          <p className="text-[12px] font-black text-[#5dba87] tabular-nums">{negatives.length}{daySuffix}</p>
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">{t('nutrition.kcalVariation.maxGap')}</p>
          <p className="text-[12px] font-black text-white tabular-nums">
            {Math.round(Math.max(...deltas.map(d => Math.abs(d.delta))))} kcal
          </p>
        </div>
      </div>
    </div>
  )
}
