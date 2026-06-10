'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import type { TransformationScoreResult } from '@/lib/coach/transformationScore'
import CoachDocLinkButton from '@/components/coach/docs/CoachDocLinkButton'

// ── Color interpolation: 0=red → 0.5=amber → 1=green ─────────────────────────
function tickColor(t: number): string {
  if (t < 0.5) {
    const g = Math.round(t * 2 * 155)
    return `rgb(215,${g},35)`
  }
  const r = Math.round(215 * (1 - (t - 0.5) * 2))
  return `rgb(${r},185,35)`
}

// ── Horizontal tick-bar meter ─────────────────────────────────────────────────
const TICK_COUNT = 62

function ScoreMeter({ score }: { score: number }) {
  const activeTicks = Math.round((Math.max(0, Math.min(100, score)) / 100) * TICK_COUNT)

  return (
    <div className="w-full">
      <div className="flex items-end gap-[2.5px]" style={{ height: '44px' }}>
        {Array.from({ length: TICK_COUNT }).map((_, i) => {
          const t = i / (TICK_COUNT - 1)
          const active = i < activeTicks
          const h = 18 + Math.round(Math.sin(t * Math.PI) * 12)
          return (
            <motion.div
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                height: `${h}px`,
                backgroundColor: active ? tickColor(t) : 'rgba(255,255,255,0.07)',
                transformOrigin: 'bottom',
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.006, duration: 0.2, ease: 'easeOut' }}
            />
          )
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] text-white/20 tabular-nums">0</span>
        <span className="text-[9px] text-white/20 tabular-nums">100</span>
      </div>
    </div>
  )
}

function transformationTone(score: number): {
  label: string
  color: string
  bg: string
} {
  if (score >= 75) {
    return { label: 'Optimal', color: '#1f8a65', bg: 'rgba(31,138,101,0.15)' }
  }
  if (score >= 50) {
    return { label: 'A surveiller', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
  }
  return { label: 'A corriger', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
}

// ── Dimension pills ────────────────────────────────────────────────────────────
const DIM_LABELS: Record<string, string> = {
  adherence:    'ADH',
  recovery:     'REC',
  bodyProgress: 'CORPS',
  performance:  'PERF',
}

const DIM_FULL: Record<string, string> = {
  adherence:    'Adhérence',
  recovery:     'Récupération',
  bodyProgress: 'Progression corporelle',
  performance:  'Performance',
}

const DIM_DESC: Record<string, string> = {
  adherence:    'Régularité des check-ins + séances réalisées vs objectif',
  recovery:     'Énergie, qualité du sommeil, durée, stress, courbatures',
  bodyProgress: 'Tendance poids/masse grasse/masse maigre vs objectif',
  performance:  'Complétion des sets, RIR, surcharge progressive, stagnation',
}

function DimPill({
  dimKey,
  dim,
}: {
  dimKey: string
  dim: TransformationScoreResult['dimensions'][keyof TransformationScoreResult['dimensions']]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const score = dim.score
  const scoreColor =
    dim.weight === 0 ? 'text-white/20' :
    score < 25       ? 'text-red-400'   :
    score < 50       ? 'text-amber-400' :
                       'text-white/70'
  const weightPct = Math.round(dim.weight * 100)
  const noData = dim.weight === 0 || dim.dataPoints < 1

  return (
    <div ref={ref} className="relative">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="bg-white/[0.04] hover:bg-white/[0.07] transition-colors rounded-lg px-3 py-1.5 flex flex-col items-center gap-0.5 cursor-default"
      >
        <span className={`text-[15px] font-bold tabular-nums ${scoreColor}`}>
          {noData ? '—' : score}
        </span>
        <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/25">
          {DIM_LABELS[dimKey]}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 z-20 w-48 pointer-events-none"
            style={{ left: 'calc(50% - 96px)' }}
          >
            <div className="bg-[#1a1a1a] border-[0.3px] border-white/[0.10] rounded-xl px-3 py-2.5 shadow-xl">
              <p className="text-[10px] font-bold text-white/70 mb-1">{DIM_FULL[dimKey]}</p>
              <p className="text-[10px] text-white/35 leading-snug mb-2">{DIM_DESC[dimKey]}</p>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/25 uppercase tracking-[0.1em]">Score</span>
                <span className={`text-[12px] font-bold tabular-nums ${scoreColor}`}>
                  {noData ? '—' : score}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] text-white/25 uppercase tracking-[0.1em]">Poids</span>
                <span className="text-[10px] text-white/40 tabular-nums">{weightPct}%</span>
              </div>
              {dim.dataPoints > 0 && (
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px] text-white/25 uppercase tracking-[0.1em]">Données</span>
                  <span className="text-[10px] text-white/40 tabular-nums">{dim.dataPoints}</span>
                </div>
              )}
              {noData && (
                <p className="text-[9px] text-amber-400/60 mt-1.5">Données insuffisantes — poids redistribué</p>
              )}
            </div>
            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-[#1a1a1a] border-r-[0.3px] border-b-[0.3px] border-white/[0.10] rotate-45 -mt-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DimensionPills({ dimensions }: { dimensions: TransformationScoreResult['dimensions'] }) {
  return (
    <div className="flex gap-2 justify-center">
      {Object.entries(dimensions).map(([key, dim]) => (
        <DimPill key={key} dimKey={key} dim={dim} />
      ))}
    </div>
  )
}

// ── Alert list ────────────────────────────────────────────────────────────────
const SEVERITY_DOT: Record<string, string> = {
  high:   'bg-red-400',
  medium: 'bg-amber-400',
  low:    'bg-white/30',
}

const DIM_FULL_SHORT: Record<string, string> = {
  adherence:    'Adhérence',
  recovery:     'Récupération',
  bodyProgress: 'Corps',
  performance:  'Performance',
}

function AlertList({ alerts }: { alerts: TransformationScoreResult['alerts'] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#1f8a65] flex-shrink-0" />
        <span className="text-[11px] text-white/40">Aucune alerte — client en bonne dynamique</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className={`w-1.5 h-1.5 rounded-full mt-[3px] flex-shrink-0 ${SEVERITY_DOT[alert.severity]}`} />
          <div className="min-w-0">
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.1em]">
              {DIM_FULL_SHORT[alert.dimension]}
            </span>
            <span className="text-[11px] text-white/40 leading-snug"> — {alert.message}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Window toggle ─────────────────────────────────────────────────────────────
function WindowToggle({ value, onChange }: { value: 7 | 30; onChange: (v: 7 | 30) => void }) {
  return (
    <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
      {([7, 30] as const).map(w => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
            value === w ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/50'
          }`}
        >
          {w}j
        </button>
      ))}
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────
interface Props {
  clientId: string
}

export default function TransformationScoreWidget({ clientId }: Props) {
  const [win, setWin] = useState<7 | 30>(7)
  const [data, setData] = useState<TransformationScoreResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`/api/clients/${clientId}/transformation-score?window=${win}`)
      .then(r => r.json())
      .then((d: TransformationScoreResult) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clientId, win])

  return (
    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl px-6 py-5">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
          Score de transformation
        </p>
        <div className="flex items-center gap-2">
          <CoachDocLinkButton
            href="/coach/documentation/transformation-score"
            label="Documentation"
          />
          <WindowToggle value={win} onChange={setWin} />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(31,138,101,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-8 w-32 rounded-full bg-white/[0.04]" />
            <Skeleton className="h-7 w-24 rounded-md bg-white/[0.04]" />
          </div>
          {/* Score hero */}
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-[64px] w-[80px] rounded-xl bg-white/[0.04]" />
            <Skeleton className="h-3 w-28 rounded-full bg-white/[0.04]" />
          </div>
          {/* Tick bar */}
          <div className="flex items-end gap-[2.5px]" style={{ height: '44px' }}>
            {Array.from({ length: 28 }).map((_, i) => {
              const t = i / 27
              const h = 18 + Math.round(Math.sin(t * Math.PI) * 12)
              return (
                <div
                  key={i}
                  className="flex-1 rounded-[1px] bg-white/[0.05] animate-pulse"
                  style={{ height: `${h}px`, animationDelay: `${i * 0.04}s` }}
                />
              )
            })}
          </div>
          {/* 4 dimension pills */}
          <div className="flex gap-2 justify-center">
            {[56, 56, 70, 56].map((w, i) => (
              <Skeleton key={i} className="h-[52px] rounded-lg bg-white/[0.04]" style={{ width: `${w}px` }} />
            ))}
          </div>
          {/* Alert row */}
          <Skeleton className="h-3.5 w-52 rounded-full bg-white/[0.04]" />
        </div>
      ) : data ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(31,138,101,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                Lecture rapide
              </p>
            </div>
            <span
              className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{
                color: transformationTone(data.score).color,
                backgroundColor: transformationTone(data.score).bg,
              }}
            >
              {transformationTone(data.score).label}
            </span>
          </div>

          <div className="space-y-5">
            <div className="text-center">
              <motion.p
                key={data.score}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-[68px] font-bold leading-none text-white tracking-tight tabular-nums"
              >
                {data.score}
              </motion.p>
              <p className="mt-2 text-[13px] tracking-wide text-white/35">{data.label}</p>
            </div>

            <ScoreMeter score={data.score} />

            <DimensionPills dimensions={data.dimensions} />

            <AlertList alerts={data.alerts} />

            {data.insufficientData && (
              <p className="text-[9px] text-center text-amber-400/60">
                Données partielles — score estimé
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-white/30 text-center py-8">Erreur de chargement</p>
      )}
    </div>
  )
}
