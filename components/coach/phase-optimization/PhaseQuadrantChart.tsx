'use client'

import { motion } from 'framer-motion'
import { getPhaseEngineCopy, type PhaseEngineLocale } from '@/lib/coach/phaseEngine/localeCopy'
import {
  optimalZoneCenterFromContext,
  scoreToPlotX,
  scoreToPlotY,
  type PlotLayout,
} from '@/lib/coach/phaseEngine/quadrant'
import type { PhaseHistoryPoint } from '@/lib/coach/phaseEngine/history'
import type { PhaseClientProfile, PhaseOptimizationResult } from '@/lib/coach/phaseEngine/types'
import PhaseQuadrantLegend from './PhaseQuadrantLegend'

const SVG_W = 400
const SVG_H = 300
const PAD = 10

const LAYOUT: PlotLayout = { width: SVG_W, height: SVG_H, padding: PAD }

const CURRENT_GLOW = '#facc15'

function buildTrailPath(points: { x: number; y: number }[]): string | null {
  if (points.length < 2) return null
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

interface Props {
  result: PhaseOptimizationResult
  historyTrail: PhaseHistoryPoint[]
  locale: PhaseEngineLocale
  trainingGoal?: string | null
  clientProfile?: PhaseClientProfile | null
}

export default function PhaseQuadrantChart({
  result,
  historyTrail,
  locale,
  trainingGoal,
  clientProfile,
}: Props) {
  const copy = getPhaseEngineCopy(locale)
  const { currentState: cs } = result
  const ql = copy.quadrantLabels

  const trailPoints = historyTrail.map(p => ({
    x: scoreToPlotX(p.directionScore, LAYOUT),
    y: scoreToPlotY(p.adaptiveScore, LAYOUT),
  }))
  const trailPathD = buildTrailPath(trailPoints)
  const showTrailPath = trailPathD != null && trailPoints.length >= 2

  const cxCurrent = scoreToPlotX(cs.directionScore, LAYOUT)
  const cyCurrent = scoreToPlotY(cs.adaptiveScore, LAYOUT)

  const ra = result.recommendedAdjustment
  const profile =
    clientProfile ??
    ({
      experienceLevel: 'intermediate',
      currentPhase: 'recomp',
      cyclicProtocolMode: null,
    } satisfies PhaseClientProfile)

  const enginePhase = (result as any).enginePrescription?.optimalPhase;
  let optimalTarget = { directionScore: 0, adaptiveScore: 0 };
  if (enginePhase) {
    switch (enginePhase) {
      case 'AGGRESSIVE_CUT': optimalTarget = { directionScore: -0.8, adaptiveScore: -0.6 }; break;
      case 'MODERATE_CUT': optimalTarget = { directionScore: -0.4, adaptiveScore: -0.2 }; break;
      case 'MAINTENANCE': optimalTarget = { directionScore: 0, adaptiveScore: 0.4 }; break;
      case 'LEAN_BULK': optimalTarget = { directionScore: 0.6, adaptiveScore: 0.5 }; break;
      case 'DELOAD': optimalTarget = { directionScore: 0, adaptiveScore: 0.8 }; break;
      case 'PEAK_WEEK': optimalTarget = { directionScore: -0.9, adaptiveScore: -0.8 }; break;
    }
  } else {
    optimalTarget = optimalZoneCenterFromContext({
      trainingGoal,
      clientProfile: profile,
      recommendedDirection: ra.direction,
      recommendedAdaptiveState: ra.adaptiveState,
      recommendedDirectionScore: ra.directionScore,
      recommendedAdaptiveScore: ra.adaptiveScore,
    })
  }
  const cxOptimal = scoreToPlotX(optimalTarget.directionScore, LAYOUT)
  const cyOptimal = scoreToPlotY(optimalTarget.adaptiveScore, LAYOUT)

  const midX = SVG_W / 2
  const midY = SVG_H / 2
  const { width: plotW, height: plotH } = {
    width: SVG_W - PAD * 2,
    height: SVG_H - PAD * 2,
  }
  const maxR = Math.min(plotW, plotH) / 2
  const tickLen = 5
  const axisFontSize = 10

  return (
    <div className="overflow-hidden rounded-xl bg-black/35 ring-1 ring-inset ring-white/[0.06]">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="h-[min(300px,42vw)] min-h-[240px] w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-label={
          locale === 'fr'
            ? 'Cadran direction énergétique et état adaptatif'
            : 'Energetic direction and adaptive state quadrant'
        }
      >
        <defs>
          <linearGradient id="phaseOptimalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(45,212,191,0.14)" />
            <stop offset="100%" stopColor="rgba(31,138,101,0.1)" />
          </linearGradient>
          <filter id="phaseCurrentGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[0.5, 1].map(t => (
          <ellipse
            key={t}
            cx={midX}
            cy={midY}
            rx={maxR * t}
            ry={maxR * t * 0.72}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={0.75}
          />
        ))}

        <ellipse
          cx={cxOptimal}
          cy={cyOptimal}
          rx={maxR * 0.38}
          ry={maxR * 0.28}
          fill="url(#phaseOptimalGrad)"
          stroke="#2dd4bf"
          strokeWidth={1}
          strokeDasharray="5 3"
          strokeOpacity={0.75}
        />

        <line x1={PAD} y1={midY} x2={SVG_W - PAD} y2={midY} stroke="rgba(255,255,255,0.12)" strokeWidth={0.75} />
        <line x1={midX} y1={PAD} x2={midX} y2={SVG_H - PAD} stroke="rgba(255,255,255,0.12)" strokeWidth={0.75} />

        {[
          [PAD, midY, PAD + tickLen, midY],
          [SVG_W - PAD, midY, SVG_W - PAD - tickLen, midY],
          [midX, PAD, midX, PAD + tickLen],
          [midX, SVG_H - PAD, midX, SVG_H - PAD - tickLen],
        ].map((c, i) => (
          <line
            key={i}
            x1={c[0]}
            y1={c[1]}
            x2={c[2]}
            y2={c[3]}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={0.75}
          />
        ))}

        <text
          x={PAD + 2}
          y={SVG_H - 5}
          fontSize={axisFontSize}
          fill="#a3a3a3"
          letterSpacing="0.14em"
          textAnchor="start"
        >
          {ql.deficit.toUpperCase()}
        </text>
        <text
          x={midX}
          y={SVG_H - 5}
          fontSize={axisFontSize}
          fill="#a3a3a3"
          letterSpacing="0.14em"
          textAnchor="middle"
        >
          {ql.maintenance.toUpperCase()}
        </text>
        <text
          x={SVG_W - PAD - 2}
          y={SVG_H - 5}
          fontSize={axisFontSize}
          fill="#a3a3a3"
          letterSpacing="0.14em"
          textAnchor="end"
        >
          {ql.surplus.toUpperCase()}
        </text>
        <text
          x={PAD - 3}
          y={PAD + 12}
          fontSize={axisFontSize}
          fill="#a3a3a3"
          letterSpacing="0.14em"
          textAnchor="end"
        >
          {ql.supercompensated.toUpperCase()}
        </text>
        <text
          x={PAD - 3}
          y={SVG_H - PAD - 4}
          fontSize={axisFontSize}
          fill="#a3a3a3"
          letterSpacing="0.14em"
          textAnchor="end"
        >
          {ql.fatigue.toUpperCase()}
        </text>

        {showTrailPath && (
          <motion.path
            d={trailPathD}
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        )}

        <circle cx={cxCurrent} cy={cyCurrent} r={7} fill={CURRENT_GLOW} opacity={0.18} filter="url(#phaseCurrentGlow)" />
        <motion.circle
          animate={{ cx: cxCurrent, cy: cyCurrent }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          r={5}
          fill={CURRENT_GLOW}
          filter="url(#phaseCurrentGlow)"
        />
        <circle cx={cxCurrent} cy={cyCurrent} r={2.5} fill="#fffbeb" />
      </svg>
      <div className="border-t border-white/[0.05] px-3 py-2">
        <PhaseQuadrantLegend locale={locale} showTrail={showTrailPath} trailLabel={ql.trailLegend} compact />
      </div>
    </div>
  )
}
