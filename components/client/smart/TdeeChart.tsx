'use client'

import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import { useChartScrubber } from '@/hooks/useChartScrubber'

type TdeePoint = {
  calculated_at: string
  tdee_adaptive: number
  tdee_formula: number
  delta_kcal: number
  avg_intake_kcal: number
  weight_delta_kg: number
  weight_samples: number
}

type Props = { days: number }

const W = 320
const H = 120
const PAD = { top: 12, right: 8, bottom: 20, left: 36 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

function formatDate(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d)
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

export default function TdeeChart({ days }: Props) {
  const [data, setData] = useState<TdeePoint[]>([])
  const [protocolTdee, setProtocolTdee] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/client/nutrition/tdee-history?days=${days}`)
      .then(r => r.ok ? r.json() : { history: [], protocolTdee: null })
      .then((res: { history: TdeePoint[]; protocolTdee: number | null }) => {
        setData(Array.isArray(res?.history) ? res.history : [])
        setProtocolTdee(typeof res?.protocolTdee === 'number' ? res.protocolTdee : null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [days])

  const filtered = useMemo(() => {
    if (data.length > 0) return data
    if (protocolTdee !== null) {
      return [{
        calculated_at: new Date().toISOString(),
        tdee_adaptive: protocolTdee,
        tdee_formula: protocolTdee,
        delta_kcal: 0,
        avg_intake_kcal: protocolTdee,
        weight_delta_kg: 0,
        weight_samples: 0,
      }]
    }
    return []
  }, [data, protocolTdee])

  const { activeIndex, handlers, svgRef } = useChartScrubber(filtered.length, W, PAD.left, PAD.right)

  if (loading) {
    return (
      <div className="bg-[#161616] rounded-2xl p-4">
        <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse mb-4" />
        <div className="h-[140px] bg-white/[0.04] rounded-xl animate-pulse" />
      </div>
    )
  }

  if (filtered.length === 0) return null

  const allAdaptive = filtered.map(p => p.tdee_adaptive)
  const allFormula  = filtered.map(p => p.tdee_formula)
  const allVals = [...allAdaptive, ...allFormula]
  const minY = Math.min(...allVals) - 100
  const maxY = Math.max(...allVals) + 100

  const toX = (i: number) => PAD.left + (filtered.length <= 1 ? INNER_W / 2 : (i / (filtered.length - 1)) * INNER_W)
  const toY = (v: number) => PAD.top + INNER_H - ((v - minY) / (maxY - minY)) * INNER_H

  const adaptivePts: [number, number][] = filtered.map((p, i) => [toX(i), toY(p.tdee_adaptive)])
  const formulaPts:  [number, number][] = filtered.map((p, i) => [toX(i), toY(p.tdee_formula)])

  const bandMin = Math.min(...allAdaptive)
  const bandMax = Math.max(...allAdaptive)
  const bandTopPts: [number, number][] = filtered.map((_, i) => [toX(i), toY(bandMax)])
  const bandBotPts: [number, number][] = filtered.map((_, i) => [toX(i), toY(bandMin)] as [number, number]).reverse()
  const bandPath = svgPath(bandTopPts) + ' L ' + bandBotPts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ') + ' Z'

  const yTicks = [minY + 100, (minY + maxY) / 2, maxY - 100].map(v => Math.round(v / 50) * 50)

  const latest = filtered[filtered.length - 1]
  const prev   = filtered.length >= 2 ? filtered[filtered.length - 2] : null
  const deltaTrend = prev ? latest.tdee_adaptive - prev.tdee_adaptive : 0
  const deltaVsFormula = latest.tdee_adaptive - latest.tdee_formula

  const activePoint = activeIndex !== null ? filtered[activeIndex] : null

  return (
    <div className="bg-[#161616] rounded-2xl p-4">

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/50 mb-0.5">
            Dépense énergétique
          </p>
          {activePoint ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-bold text-white/50 tabular-nums">{formatDate(activePoint.calculated_at)}</span>
              <span className="text-[18px] font-black text-white tabular-nums leading-none">
                {activePoint.tdee_adaptive.toLocaleString('fr-FR')}
              </span>
              <span className="text-[10px] text-white/40">kcal/j</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] font-black text-white tabular-nums leading-none">
                {latest.tdee_adaptive.toLocaleString('fr-FR')}
              </span>
              <span className="text-[10px] text-white/40">kcal/jour</span>
              {deltaTrend !== 0 && (
                <span className="text-[10px] font-bold flex items-center gap-0.5 text-white/40">
                  {deltaTrend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {deltaTrend > 0 ? '+' : ''}{deltaTrend} kcal
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SVG chart */}
      <div className="w-full overflow-hidden touch-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: H }}
          preserveAspectRatio="none"
          {...handlers}
        >
          {yTicks.map(tick => {
            const y = toY(tick)
            return (
              <g key={tick}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.25)">{tick}</text>
              </g>
            )
          })}

          {filtered.length > 1 && (
            <path d={bandPath} fill="rgba(104,159,250,0.08)" stroke="none" />
          )}

          <path d={svgPath(formulaPts)} fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1" strokeDasharray="3 3" />
          <path d={svgPath(adaptivePts)} fill="none" stroke={NUTRITION_UI_COLORS.calories} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

          {/* Default dots (hidden when scrubbing) */}
          {activeIndex === null && adaptivePts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === adaptivePts.length - 1 ? 3 : 1.5}
              fill={i === adaptivePts.length - 1 ? NUTRITION_UI_COLORS.calories : 'rgba(104,159,250,0.5)'} />
          ))}

          {/* X-axis dates (hidden when scrubbing) */}
          {activeIndex === null && filtered.length >= 2 && (
            <>
              <text x={PAD.left} y={H - 2} textAnchor="start" fontSize="7" fill="rgba(255,255,255,0.25)">
                {formatDate(filtered[0].calculated_at)}
              </text>
              <text x={W - PAD.right} y={H - 2} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.25)">
                {formatDate(filtered[filtered.length - 1].calculated_at)}
              </text>
            </>
          )}

          {/* Scrubber */}
          {activeIndex !== null && (() => {
            const x = toX(activeIndex)
            const pt = filtered[activeIndex]
            const ay = toY(pt.tdee_adaptive)
            const fy = toY(pt.tdee_formula)
            const delta = pt.tdee_adaptive - pt.tdee_formula
            const tooltipW = 108
            const tx = Math.min(Math.max(x - tooltipW / 2, PAD.left), W - PAD.right - tooltipW)
            const ty = PAD.top

            return (
              <g>
                <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom}
                  stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" strokeDasharray="3 2" />
                <circle cx={x} cy={ay} r="3.5" fill={NUTRITION_UI_COLORS.calories} />
                <circle cx={x} cy={fy} r="3" fill="rgba(255,255,255,0.4)" />

                <rect x={tx} y={ty} width={tooltipW} height={54} rx="5"
                  fill="rgba(22,22,22,0.96)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

                <text x={tx + 8} y={ty + 13} fontSize="8" fill="rgba(255,255,255,0.45)" fontWeight="600">
                  {formatDate(pt.calculated_at)}
                </text>

                <circle cx={tx + 10} cy={ty + 25} r="3" fill={NUTRITION_UI_COLORS.calories} />
                <text x={tx + 17} y={ty + 29} fontSize="8" fill="rgba(255,255,255,0.55)">Adaptatif</text>
                <text x={tx + tooltipW - 8} y={ty + 29} fontSize="8.5" fill="white" textAnchor="end" fontWeight="700">
                  {pt.tdee_adaptive.toLocaleString('fr-FR')}
                </text>

                <circle cx={tx + 10} cy={ty + 40} r="3" fill="rgba(255,255,255,0.3)" />
                <text x={tx + 17} y={ty + 44} fontSize="8" fill="rgba(255,255,255,0.55)">Formule</text>
                <text x={tx + tooltipW - 8} y={ty + 44} fontSize="8.5" fill="rgba(255,255,255,0.6)" textAnchor="end" fontWeight="700">
                  {pt.tdee_formula.toLocaleString('fr-FR')}
                </text>

                <rect x={tx + 8} y={ty + 49} width={tooltipW - 16} height={13} rx="3"
                  fill={delta >= 0 ? 'rgba(93,186,135,0.15)' : 'rgba(255,209,94,0.15)'} />
                <text x={tx + tooltipW / 2} y={ty + 58.5} fontSize="7.5" textAnchor="middle"
                  fill={delta >= 0 ? '#5dba87' : '#ffd15e'} fontWeight="700">
                  {delta >= 0 ? '+' : ''}{delta} kcal vs formule
                </text>
              </g>
            )
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-[2px] rounded" style={{ background: NUTRITION_UI_COLORS.calories }} />
          <span className="text-[9px] text-white/40">Adaptatif</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="3 3"/></svg>
          <span className="text-[9px] text-white/40">Formule</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-3 rounded-sm" style={{ background: 'rgba(104,159,250,0.12)' }} />
          <span className="text-[9px] text-white/40">Plage flux</span>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06]">
        <div>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">vs formule</p>
          <p className={`text-[12px] font-black tabular-nums ${deltaVsFormula >= 0 ? 'text-[#22c55e]' : 'text-[#f59e0b]'}`}>
            {deltaVsFormula >= 0 ? '+' : ''}{deltaVsFormula} kcal
          </p>
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">Apport moy.</p>
          <p className="text-[12px] font-black text-white tabular-nums">
            {latest.avg_intake_kcal.toLocaleString('fr-FR')} kcal
          </p>
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">Tendance</p>
          <p className={`text-[12px] font-black flex items-center gap-1 ${
            deltaTrend > 20 ? 'text-[#22c55e]' : deltaTrend < -20 ? 'text-[#f59e0b]' : 'text-white/50'
          }`}>
            {deltaTrend > 20 ? <><TrendingUp size={12} /> Hausse</> : deltaTrend < -20 ? <><TrendingDown size={12} /> Baisse</> : <><Minus size={12} /> Stable</>}
          </p>
        </div>
      </div>
    </div>
  )
}
