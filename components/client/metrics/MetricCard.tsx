'use client'

import { useState } from 'react'
import MetricExpandedChart from './MetricExpandedChart'

interface DataPoint {
  date: string
  value: number
  bilanIndex?: number
}

interface Annotation {
  date: string
  label: string
}

interface Props {
  label: string
  value: string
  delta?: string
  deltaGood?: boolean
  series: DataPoint[]
  unit: string
  annotations?: Annotation[]
  expandable?: boolean
}

function Sparkline({ series, good }: { series: DataPoint[]; good: boolean }) {
  if (series.length < 2) return null
  const values = series.map(p => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 200
  const H = 40
  const pts = series.map((p, i) => {
    const x = (i / (series.length - 1)) * W
    const y = H - ((p.value - min) / range) * (H - 6) - 3
    return `${x},${y}`
  }).join(' ')
  const color = good ? 'rgba(242,242,242,0.5)' : 'rgba(239,68,68,0.5)'
  const last = series[series.length - 1]
  const lx = W
  const ly = H - ((last.value - min) / range) * (H - 6) - 3
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  )
}

export default function MetricCard({ label, value, delta, deltaGood = true, series, unit, annotations, expandable = true }: Props) {
  const [expanded, setExpanded] = useState(false)

  const cardClass = "w-full text-left bg-[#161616] rounded-2xl p-4 space-y-2 transition-all duration-300"

  if (!expandable) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a]">
            {label}
          </span>
          <div className="text-right">
            <span className="text-[20px] font-black text-[#f2f2f2] leading-none">{value}</span>
            {delta && (
              <p className={`text-[10px] font-medium mt-0.5 ${deltaGood ? 'text-[#808080]' : 'text-red-400'}`}>
                {delta}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className={`${cardClass} active:opacity-80`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a]">
          {label}
        </span>
        <div className="text-right">
          <span className="text-[20px] font-black text-[#f2f2f2] leading-none">{value}</span>
          {delta && (
            <p className={`text-[10px] font-medium mt-0.5 ${deltaGood ? 'text-[#808080]' : 'text-red-400'}`}>
              {delta}
            </p>
          )}
        </div>
      </div>

      {!expanded && <Sparkline series={series} good={deltaGood} />}

      {expanded && (
        <MetricExpandedChart series={series} annotations={annotations} unit={unit} />
      )}
    </button>
  )
}
