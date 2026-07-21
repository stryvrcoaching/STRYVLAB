'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SessionLog } from '@/lib/client/progressTypes'
import { useClientT } from '@/components/client/ClientI18nProvider'

interface SessionPoint {
  date: string // YYYY-MM-DD
  maxWeight: number
  sessionName: string
}

interface ExerciseData {
  name: string
  points: SessionPoint[]
}

interface Props {
  rawLogs: SessionLog[]
}

export default function ExerciseProgressionChart({ rawLogs }: Props) {
  const { t } = useClientT()
  // 1. Process rawLogs into exercise progression data
  const exercisesData = useMemo((): ExerciseData[] => {
    const exerciseMap: Record<string, SessionPoint[]> = {}

    for (const log of rawLogs) {
      const date = log.logged_at.split('T')[0]
      const sessionName = log.session_name

      // Group sets by exercise name and find max weight per exercise per session
      const exerciseMaxes: Record<string, number> = {}

      for (const set of log.client_set_logs) {
        if (!set.completed || !set.actual_weight_kg) continue

        const weight = parseFloat(String(set.actual_weight_kg))
        if (!weight || weight <= 0) continue

        const exName = set.exercise_name
        if (!exerciseMaxes[exName] || weight > exerciseMaxes[exName]) {
          exerciseMaxes[exName] = weight
        }
      }

      // Add data points to each exercise
      for (const [exName, maxWeight] of Object.entries(exerciseMaxes)) {
        if (!exerciseMap[exName]) exerciseMap[exName] = []
        exerciseMap[exName].push({ date, maxWeight, sessionName })
      }
    }

    // Filter: only exercises with >= 3 data points and sort by latest max weight
    const result = Object.entries(exerciseMap)
      .filter(([, points]) => points.length >= 3)
      .map(([name, points]) => ({
        name,
        points: points.sort((a, b) => a.date.localeCompare(b.date)), // Chronological order
      }))
      .sort((a, b) => {
        // Sort by latest max weight (descending)
        const maxA = Math.max(...a.points.map(p => p.maxWeight))
        const maxB = Math.max(...b.points.map(p => p.maxWeight))
        return maxB - maxA
      })

    return result
  }, [rawLogs])

  const [selectedExerciseIdx, setSelectedExerciseIdx] = useState(0)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (exercisesData.length === 0) {
    return null
  }

  const currentExercise = exercisesData[selectedExerciseIdx]
  if (!currentExercise) return null

  const points = currentExercise.points.slice(-12) // Last 12 sessions max
  const weights = points.map(p => p.maxWeight)
  const minWeight = Math.min(...weights)
  const maxWeight = Math.max(...weights)
  const range = maxWeight - minWeight || 1
  const minDisplay = minWeight - Math.ceil(range * 0.1)
  const maxDisplay = maxWeight + Math.ceil(range * 0.1)
  const displayRange = maxDisplay - minDisplay

  // SVG chart dimensions
  const viewBoxWidth = 300
  const viewBoxHeight = 100
  const chartLeft = 30
  const chartRight = 10
  const chartTop = 10
  const chartBottom = 20
  const chartWidth = viewBoxWidth - chartLeft - chartRight
  const chartHeight = viewBoxHeight - chartTop - chartBottom

  // Normalize weight to SVG Y coordinate
  const chartY = (weight: number) => {
    return viewBoxHeight - chartBottom - ((weight - minDisplay) / displayRange) * chartHeight
  }

  // Normalize index to SVG X coordinate
  const chartX = (idx: number) => {
    if (points.length === 1) return chartLeft + chartWidth / 2
    return chartLeft + (idx / (points.length - 1)) * chartWidth
  }

  // Build bezier path
  let pathD = ''
  for (let i = 0; i < points.length; i++) {
    const x = chartX(i)
    const y = chartY(points[i].maxWeight)

    if (i === 0) {
      pathD += `M ${x} ${y}`
    } else {
      // Bezier curve with smooth control points
      const prevX = chartX(i - 1)
      const prevY = chartY(points[i - 1].maxWeight)
      const cp1x = prevX + (x - prevX) / 3
      const cp1y = prevY
      const cp2x = prevX + (2 * (x - prevX)) / 3
      const cp2y = y
      pathD += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x} ${y}`
    }
  }

  // Calculate stats
  const minSessionWeight = Math.min(...weights)
  const maxSessionWeight = Math.max(...weights)
  const firstWeight = points[0].maxWeight
  const lastWeight = points[points.length - 1].maxWeight
  const progression = lastWeight - firstWeight

  return (
    <div className="rounded-2xl bg-[#161616] p-4">
      <p className="mb-3 px-1 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/40">
        {t('programme.progressionByExercise')}
      </p>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 px-1 -mx-1 snap-x">
        {exercisesData.map((ex, idx) => {
          const isSelected = idx === selectedExerciseIdx
          const maxExWeight = Math.max(...ex.points.map(p => p.maxWeight))
          return (
            <button
              key={`${ex.name}-${idx}`}
              onClick={() => setSelectedExerciseIdx(idx)}
              className={`shrink-0 whitespace-nowrap snap-start rounded-xl px-3 py-1.5 text-[10px] font-semibold transition-all duration-200 ${
                isSelected
                  ? 'bg-[#f2f2f2] text-[#080808]'
                  : 'bg-black/[0.12] text-white/35 hover:bg-black/[0.18] hover:text-white/60'
              }`}
            >
              {ex.name} · {maxExWeight}kg
            </button>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-2xl bg-black/[0.12] p-2.5">
        <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="w-full h-[140px]">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = viewBoxHeight - chartBottom - ratio * chartHeight
            return (
              <line
                key={`grid-${i}`}
                x1={chartLeft}
                y1={y}
                x2={viewBoxWidth - chartRight}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            )
          })}

          {/* Y axis labels */}
          <text
            x={chartLeft - 4}
            y={viewBoxHeight - chartBottom + 3}
            textAnchor="end"
            fontSize="8"
            fill="rgba(255,255,255,0.3)"
            fontFamily="monospace"
          >
            {Math.round(minDisplay)}kg
          </text>
          <text
            x={chartLeft - 4}
            y={chartTop + 5}
            textAnchor="end"
            fontSize="8"
            fill="rgba(255,255,255,0.3)"
            fontFamily="monospace"
          >
            {Math.round(maxDisplay)}kg
          </text>

          {/* Line path */}
          <path
            d={pathD}
            fill="none"
            stroke="#f2f2f2"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((point, idx) => {
            const x = chartX(idx)
            const y = chartY(point.maxWeight)
            const isHovered = idx === hoveredIdx
            return (
              <g key={`point-${idx}`} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 4 : 3}
                  fill="#f2f2f2"
                  className="cursor-pointer transition-all"
                />
                {isHovered && (
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    fontSize="9"
                    fill="white"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {point.maxWeight}kg
                  </text>
                )}
                {isHovered && (
                  <text
                    x={x}
                    y={y + 14}
                    textAnchor="middle"
                    fontSize="8"
                    fill="rgba(255,255,255,0.5)"
                    fontFamily="sans-serif"
                  >
                    {point.date}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatPill label="Max" value={`${Math.round(maxSessionWeight)}kg`} />
        <StatPill
          label={t('progress.kpi.progression')}
          value={`${progression >= 0 ? '+' : ''}${Math.round(progression * 10) / 10}kg`}
          accent={progression > 0}
        />
        <StatPill label={t('progress.kpi.sessions')} value={`${points.length}`} />
      </div>
    </div>
  )
}

function StatPill({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded-2xl px-2 py-2.5 ${accent ? 'bg-[#f2f2f2]/15' : 'bg-black/[0.12]'}`}>
      <p className={`text-[9px] font-semibold uppercase tracking-[0.1em] ${accent ? 'text-[#f2f2f2]' : 'text-white/40'}`}>
        {label}
      </p>
      <p className={`text-[13px] font-bold font-mono ${accent ? 'text-[#f2f2f2]' : 'text-white/70'}`}>
        {value}
      </p>
    </div>
  )
}
