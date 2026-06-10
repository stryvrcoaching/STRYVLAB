'use client'

import { useState } from 'react'
import { Check, Minus, AlertTriangle } from 'lucide-react'
import type { CoherenceResult, CoherenceReason } from '@/lib/morpho/exerciseCoherence'

interface Props {
  coherence: CoherenceResult
}

const CONFIG = {
  optimal: { color: '#1f8a65', bg: 'bg-[#1f8a65]/12', label: 'Optimal',     Icon: Check },
  neutral: { color: 'rgba(255,255,255,0.4)', bg: 'bg-white/[0.05]', label: 'Neutre', Icon: Minus },
  caution: { color: '#f59e0b', bg: 'bg-amber-500/12', label: 'Sous-optimal', Icon: AlertTriangle },
} as const

const REASON_DOT: Record<CoherenceReason['effect'], string> = {
  boost: '#1f8a65',
  penalty: '#f59e0b',
  contraindication: '#ef4444',
  pattern: 'rgba(255,255,255,0.35)',
}

export function MorphoCoherenceBadge({ coherence }: Props) {
  const [hover, setHover] = useState(false)
  if (!coherence) return null

  const cfg = CONFIG[coherence.level]
  const Icon = cfg.Icon
  const lowConf = coherence.confidence === 'low'

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        className={`flex items-center justify-center w-4 h-4 rounded-full ${cfg.bg} ${lowConf ? 'opacity-50' : ''}`}
        style={{ color: cfg.color }}
      >
        <Icon size={9} strokeWidth={3} />
      </span>

      {hover && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-60 rounded-lg border-[0.3px] border-white/[0.08] bg-[#0f0f0f] px-3 py-2.5 shadow-xl shadow-black/40 pointer-events-none space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
            <span className="text-[8px] text-white/30">· morpho {coherence.confidence}</span>
          </div>
          {coherence.reasons.slice(0, 3).map((r, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: REASON_DOT[r.effect] }} />
              <p className="text-[10px] text-white/55 leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
