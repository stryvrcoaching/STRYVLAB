'use client'

import { useEffect, useState, useMemo } from 'react'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import { useChartScrubber } from '@/hooks/useChartScrubber'
import { useClientT } from '@/components/client/ClientI18nProvider'

type TdeePoint = {
  calculated_at: string
  tdee_adaptive: number
  avg_intake_kcal: number
}

type DayPoint = { date: string; consumed: number; target: number }

type ViewMode = 'tdee' | 'target'

type ChartPoint = {
  date: string
  reference: number
  intake: number
  gap: number
}

type Props = { days: number }

const MIN_LOGGED_KCAL = 800
const W = 320
const H = 130
const PAD = { top: 12, right: 8, bottom: 20, left: 38 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

function isoDate(ts: string): string { return ts.slice(0, 10) }

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d)
}

function svgPath(points: [number, number][]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`
  const d: string[] = [`M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`]
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const cpx = (x0 + x1) / 2
    d.push(`C ${cpx.toFixed(1)} ${y0.toFixed(1)}, ${cpx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`)
  }
  return d.join(' ')
}

function ScrubTooltip({
  x, refY, intakeY, point, refColor, refLabel,
}: {
  x: number
  refY: number
  intakeY: number
  point: ChartPoint
  refColor: string
  refLabel: string
  locale: string
  intakeLabel: string
  gapSuffix: string
  numberLocale: string
}) {
  const gap = point.gap
  const isDeficit = gap <= 0
  const tooltipW = 108
  const tooltipH = 58
  // Keep tooltip inside SVG bounds
  const tx = Math.min(Math.max(x - tooltipW / 2, PAD.left), W - PAD.right - tooltipW)
  const ty = PAD.top

  return (
    <g>
      {/* Vertical scrub line */}
      <line
        x1={x} y1={PAD.top}
        x2={x} y2={H - PAD.bottom}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.8"
        strokeDasharray="3 2"
      />
      {/* Dots on lines */}
      <circle cx={x} cy={refY} r="3.5" fill={refColor} />
      <circle cx={x} cy={intakeY} r="3.5" fill="#f2f2f2" />

      {/* Tooltip card */}
      <rect x={tx} y={ty} width={tooltipW} height={tooltipH} rx="5" fill="rgba(22,22,22,0.96)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

      {/* Date */}
      <text x={tx + 8} y={ty + 13} fontSize="8" fill="rgba(255,255,255,0.45)" fontWeight="600">
        {formatDate(point.date, locale)}
      </text>

      {/* Reference line */}
      <circle cx={tx + 10} cy={ty + 25} r="3" fill={refColor} />
      <text x={tx + 17} y={ty + 29} fontSize="8" fill="rgba(255,255,255,0.55)">
        {refLabel}
      </text>
      <text x={tx + tooltipW - 8} y={ty + 29} fontSize="8.5" fill="white" textAnchor="end" fontWeight="700">
        {Math.round(point.reference).toLocaleString(numberLocale)}
      </text>

      {/* Intake line */}
      <circle cx={tx + 10} cy={ty + 40} r="3" fill="#f2f2f2" />
      <text x={tx + 17} y={ty + 44} fontSize="8" fill="rgba(255,255,255,0.55)">
        {intakeLabel}
      </text>
      <text x={tx + tooltipW - 8} y={ty + 44} fontSize="8.5" fill="white" textAnchor="end" fontWeight="700">
        {Math.round(point.intake).toLocaleString(numberLocale)}
      </text>

      {/* Gap badge */}
      <rect x={tx + 8} y={ty + 51} width={tooltipW - 16} height={13} rx="3"
        fill={isDeficit ? 'rgba(93,186,135,0.15)' : 'rgba(255,209,94,0.15)'} />
      <text x={tx + tooltipW / 2} y={ty + 60.5} fontSize="7.5" textAnchor="middle"
        fill={isDeficit ? '#5dba87' : '#ffd15e'} fontWeight="700">
        {gap > 0 ? '+' : ''}{Math.round(gap)} kcal {gapSuffix}
      </text>
    </g>
  )
}

export default function TdeeVsIntakeChart({ days }: Props) {
  const { lang, t } = useClientT()
  const [tdeeData, setTdeeData] = useState<TdeePoint[]>([])
  const [clientTdee, setClientTdee] = useState<number | null>(null)
  const [trendData, setTrendData] = useState<DayPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('tdee')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/client/nutrition/tdee-history?days=${days}`).then(r => r.ok ? r.json() : { history: [], clientTdee: null }),
      fetch(`/api/client/nutrition/weekly-trend?days=${days}`).then(r => r.ok ? r.json() : { trend: [] }),
    ]).then(([tdeeRes, weekly]: [{ history: TdeePoint[]; clientTdee: number | null }, { trend: DayPoint[] }]) => {
      setTdeeData(Array.isArray(tdeeRes?.history) ? tdeeRes.history : [])
      setClientTdee(typeof tdeeRes?.clientTdee === 'number' ? tdeeRes.clientTdee : null)
      setTrendData(Array.isArray(weekly?.trend) ? weekly.trend : [])
      setLoading(false)
    }).catch(() => { setLoading(false) })
  }, [days])

  const tdeeMerged = useMemo((): ChartPoint[] => {
    if (clientTdee === null || trendData.length === 0) return []
    const tdeeByDate = new Map<string, number>()
    for (const p of tdeeData) tdeeByDate.set(isoDate(p.calculated_at), p.tdee_adaptive)
    const sorted = [...tdeeData].sort((a, b) => a.calculated_at.localeCompare(b.calculated_at))
    let lastTdee: number | null = null
    let idx = 0
    return trendData.map(day => {
      while (idx < sorted.length && isoDate(sorted[idx].calculated_at) <= day.date) {
        lastTdee = sorted[idx].tdee_adaptive
        idx++
      }
      const ref = tdeeByDate.get(day.date) ?? lastTdee ?? clientTdee
      return { date: day.date, reference: ref, intake: day.consumed, gap: day.consumed - ref }
    }).filter(p => p.intake > 0) // inclut tous les jours avec au moins 1 repas loggé
  }, [tdeeData, clientTdee, trendData])

  const targetMerged = useMemo((): ChartPoint[] => {
    return trendData
      .filter(p => p.consumed >= MIN_LOGGED_KCAL)
      .map(p => ({ date: p.date, reference: p.target, intake: p.consumed, gap: p.consumed - p.target }))
  }, [trendData])

  // hasTdee = true dès que le TDEE client est calculé et qu'on a au moins 1 jour loggé.
  // Une ligne TDEE horizontale fixe est parfaitement lisible même avec 1 seul point.
  const hasTdee = clientTdee !== null && tdeeMerged.length >= 1
  const activePoints = view === 'tdee' && hasTdee ? tdeeMerged : targetMerged

  const { activeIndex, handlers, svgRef } = useChartScrubber(activePoints.length, W, PAD.left, PAD.right)
  const locale = lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-GB' : 'fr-FR'
  const daySuffix = lang === 'es' ? 'd' : lang === 'en' ? 'd' : 'j'

  if (loading) {
    return (
      <div className="bg-[#161616] rounded-2xl p-4">
        <div className="h-4 w-40 bg-white/[0.06] rounded animate-pulse mb-4" />
        <div className="h-[140px] bg-white/[0.04] rounded-xl animate-pulse" />
      </div>
    )
  }

  // Afficher si l'une ou l'autre vue a des données
  if (activePoints.length < 1) return null

  const refColor = (view === 'tdee' && hasTdee) ? NUTRITION_UI_COLORS.calories : NUTRITION_UI_COLORS.carbs
  const refLabel = (view === 'tdee' && hasTdee) ? 'TDEE' : 'Cible'

  // SVG scales
  const allKcal = [...activePoints.map(p => p.reference), ...activePoints.map(p => p.intake)]
  const rawMin = Math.min(...allKcal)
  const rawMax = Math.max(...allKcal)
  const yscalePad = (rawMax - rawMin) * 0.15 + 80
  const minY = rawMin - yscalePad
  const maxY = rawMax + yscalePad

  const toX = (i: number) => PAD.left + (activePoints.length <= 1 ? INNER_W / 2 : (i / (activePoints.length - 1)) * INNER_W)
  const toY = (v: number) => PAD.top + INNER_H - ((v - minY) / (maxY - minY)) * INNER_H

  const refPts: [number, number][] = activePoints.map((p, i) => [toX(i), toY(p.reference)])
  const intakePts: [number, number][] = activePoints.map((p, i) => [toX(i), toY(p.intake)])

  const deficitClipId = `defClip-${view}`
  const surplusClipId = `surClip-${view}`

  const yTicks = [
    Math.round((minY + yscalePad) / 100) * 100,
    Math.round((minY + maxY) / 2 / 100) * 100,
    Math.round((maxY - yscalePad) / 100) * 100,
  ]

  // Scrubber display values — show active point or aggregate
  const displayPoint = activeIndex !== null ? activePoints[activeIndex] : null
  const avgGap = activePoints.reduce((s, p) => s + p.gap, 0) / activePoints.length
  const deficitDays = activePoints.filter(p => p.gap < -50).length
  const surplusDays = activePoints.filter(p => p.gap > 50).length
  const gapLabel = view === 'tdee' && hasTdee
    ? (avgGap <= 0 ? t('nutrition.chart.deficit') : t('nutrition.chart.surplus'))
    : (avgGap <= 0 ? t('nutrition.chart.belowTarget') : t('nutrition.chart.aboveTarget'))

  return (
    <div className="bg-[#161616] rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/50 mb-0.5">
            {view === 'tdee' && hasTdee ? t('nutrition.chart.tdeeVsIntake') : t('nutrition.chart.targetVsIntake')}
          </p>
          {displayPoint ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-bold text-white/50 tabular-nums">{formatDate(displayPoint.date, locale)}</span>
              <span className={`text-[18px] font-black tabular-nums leading-none ${displayPoint.gap <= 0 ? 'text-[#5dba87]' : 'text-[#ffd15e]'}`}>
                {displayPoint.gap > 0 ? '+' : ''}{Math.round(displayPoint.gap)}
              </span>
              <span className="text-[10px] text-white/40">kcal</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className={`text-[22px] font-black tabular-nums leading-none ${avgGap <= 0 ? 'text-[#5dba87]' : 'text-[#ffd15e]'}`}>
                {avgGap > 0 ? '+' : ''}{Math.round(avgGap)}
              </span>
              <span className="text-[10px] text-white/40">{t('nutrition.chart.avgGap', { label: gapLabel })}</span>
            </div>
          )}
        </div>

        {/* Toggle vue */}
        <div className="flex items-center bg-white/[0.04] rounded-xl p-[3px] gap-[2px]">
          {hasTdee && (
            <button
              onClick={() => setView('tdee')}
              className={`text-[9px] font-bold px-2.5 py-1 rounded-lg transition-all leading-none ${
                view === 'tdee' ? 'bg-white/[0.10] text-white' : 'text-white/30'
              }`}
            >
              TDEE
            </button>
          )}
          <button
            onClick={() => setView('target')}
            className={`text-[9px] font-bold px-2.5 py-1 rounded-lg transition-all leading-none ${
              view === 'target' || !hasTdee ? 'bg-white/[0.10] text-white' : 'text-white/30'
            }`}
          >
            {t('common.target')}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full overflow-hidden touch-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: H }}
          preserveAspectRatio="none"
          {...handlers}
        >
          <defs>
            <clipPath id={deficitClipId}>
              <polygon points={[
                ...refPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`),
                `${(W - PAD.right).toFixed(1)},${(H - PAD.bottom).toFixed(1)}`,
                `${PAD.left.toFixed(1)},${(H - PAD.bottom).toFixed(1)}`,
              ].join(' ')} />
            </clipPath>
            <clipPath id={surplusClipId}>
              <polygon points={[
                `${PAD.left.toFixed(1)},${PAD.top.toFixed(1)}`,
                `${(W - PAD.right).toFixed(1)},${PAD.top.toFixed(1)}`,
                ...refPts.slice().reverse().map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`),
              ].join(' ')} />
            </clipPath>
          </defs>

          {yTicks.map(tick => {
            const y = toY(tick)
            return (
              <g key={tick}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.22)">{tick}</text>
              </g>
            )
          })}

          <path
            d={svgPath(intakePts) + ` L ${intakePts[intakePts.length-1][0].toFixed(1)} ${(H - PAD.bottom).toFixed(1)} L ${intakePts[0][0].toFixed(1)} ${(H - PAD.bottom).toFixed(1)} Z`}
            fill="rgba(93,186,135,0.12)"
            clipPath={`url(#${deficitClipId})`}
          />
          <path
            d={svgPath(intakePts) + ` L ${intakePts[intakePts.length-1][0].toFixed(1)} ${PAD.top.toFixed(1)} L ${intakePts[0][0].toFixed(1)} ${PAD.top.toFixed(1)} Z`}
            fill="rgba(255,209,94,0.12)"
            clipPath={`url(#${surplusClipId})`}
          />

          <path d={svgPath(refPts)} fill="none" stroke={refColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d={svgPath(intakePts)} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />

          {/* Default dots on last point (hidden when scrubbing) */}
          {activeIndex === null && (
            <>
              <circle cx={refPts[refPts.length-1][0]} cy={refPts[refPts.length-1][1]} r="3" fill={refColor} />
              <circle cx={intakePts[intakePts.length-1][0]} cy={intakePts[intakePts.length-1][1]} r="3" fill="#f2f2f2" />
            </>
          )}

          {/* X-axis labels (hidden when scrubbing) */}
          {activeIndex === null && activePoints.length >= 2 && (
            <>
              <text x={PAD.left} y={H - 2} textAnchor="start" fontSize="7" fill="rgba(255,255,255,0.25)">
                {formatDate(activePoints[0].date, locale)}
              </text>
              <text x={W - PAD.right} y={H - 2} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.25)">
                {formatDate(activePoints[activePoints.length - 1].date, locale)}
              </text>
            </>
          )}

          {/* Scrubber overlay */}
          {activeIndex !== null && (
            <ScrubTooltip
              x={toX(activeIndex)}
              refY={toY(activePoints[activeIndex].reference)}
              intakeY={toY(activePoints[activeIndex].intake)}
              point={activePoints[activeIndex]}
              refColor={refColor}
              refLabel={refLabel}
              locale={locale}
              intakeLabel={t('nutrition.chart.intake')}
              gapSuffix={activePoints[activeIndex].gap <= 0 ? t('nutrition.chart.deficit') : t('nutrition.chart.surplus')}
              numberLocale={locale}
            />
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-[2px] rounded" style={{ background: refColor }} />
          <span className="text-[9px] text-white/40">{refLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-[2px] bg-white/60 rounded" />
          <span className="text-[9px] text-white/40">{t('nutrition.chart.intake')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#5dba87]/20" />
          <span className="text-[9px] text-white/40">{view === 'tdee' && hasTdee ? t('nutrition.chart.deficit') : t('nutrition.chart.belowTarget')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#ffd15e]/20" />
          <span className="text-[9px] text-white/40">{view === 'tdee' && hasTdee ? t('nutrition.chart.surplus') : t('nutrition.chart.aboveTarget')}</span>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06]">
        <div>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">
            {view === 'tdee' && hasTdee ? t('nutrition.chart.deficit') : t('nutrition.chart.belowTarget')}
          </p>
          <p className="text-[12px] font-black text-[#5dba87] tabular-nums">{deficitDays}{daySuffix}</p>
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">
            {view === 'tdee' && hasTdee ? t('nutrition.chart.surplus') : t('nutrition.chart.aboveTarget')}
          </p>
          <p className="text-[12px] font-black text-[#ffd15e] tabular-nums">{surplusDays}{daySuffix}</p>
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">{t('nutrition.chart.balance')}</p>
          <p className="text-[12px] font-black text-white tabular-nums">
            {activePoints.length - deficitDays - surplusDays}{daySuffix}
          </p>
        </div>
      </div>

      {!hasTdee && (
        <p className="text-[10px] text-white/25 mt-2 leading-relaxed">
          {t('nutrition.chart.tdeeUnlock')}
        </p>
      )}
    </div>
  )
}
