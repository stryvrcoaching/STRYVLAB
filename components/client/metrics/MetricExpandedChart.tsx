'use client'

import { useClientT } from '@/components/client/ClientI18nProvider'

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
  series: DataPoint[]
  annotations?: Annotation[]
  unit: string
}

export default function MetricExpandedChart({ series, annotations = [], unit }: Props) {
  const { t } = useClientT()
  if (series.length === 0) return null

  const W = 280
  const H = 110
  const PAD_X = 16
  const PAD_Y = 12

  const values = series.map(p => p.value)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const range = maxV - minV || 1

  function toX(i: number) {
    return PAD_X + (i / Math.max(series.length - 1, 1)) * (W - PAD_X * 2)
  }
  function toY(v: number) {
    return PAD_Y + (1 - (v - minV) / range) * (H - PAD_Y * 2)
  }

  const polylinePoints = series.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' ')

  const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10

  const annotationLines = annotations.map(ann => {
    const idx = series.findIndex(p => p.date >= ann.date)
    if (idx < 0) return null
    return { x: toX(idx), label: ann.label }
  }).filter((a): a is { x: number; label: string } => a !== null)

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 110 }} preserveAspectRatio="none">
        {annotationLines.map((a, i) => (
          <g key={i}>
            <line
              x1={a.x} y1={4} x2={a.x} y2={H - 4}
              stroke="rgba(255,255,255,0.2)" strokeWidth="1"
              strokeDasharray="3,3"
            />
            <text x={a.x + 3} y={10} fontSize="6" fill="rgba(255,255,255,0.3)">{a.label}</text>
          </g>
        ))}

        <polyline
          points={polylinePoints}
          fill="none"
          stroke="rgba(242,242,242,0.6)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {series.map((p, i) => {
          const x = toX(i)
          const y = toY(p.value)
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="#f2f2f2" />
              {p.bilanIndex != null && (
                <text
                  x={x} y={H - 2} textAnchor="middle"
                  fontSize="7" fill="rgba(255,255,255,0.3)"
                >
                  B{p.bilanIndex}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          { label: t('common.min.short'), value: `${minV}${unit}` },
          { label: t('common.avg.short'), value: `${avg}${unit}` },
          { label: t('common.max.short'), value: `${maxV}${unit}` },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a]">{label}</p>
            <p className="text-[11px] font-bold text-[#808080]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
