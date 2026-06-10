'use client'

import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { CoherenceScoreData } from './useNutritionStudio'

function getScoreConfig(score: number) {
  if (score >= 90) return { label: 'Excellent', color: 'text-[#1f8a65]', barColor: 'bg-[#1f8a65]' }
  if (score >= 75) return { label: 'Bon', color: 'text-blue-400', barColor: 'bg-blue-400' }
  if (score >= 55) return { label: 'Acceptable', color: 'text-amber-400', barColor: 'bg-amber-400' }
  return { label: 'À corriger', color: 'text-red-400', barColor: 'bg-red-400' }
}

export default function CoherenceScore({ coherence }: { coherence: CoherenceScoreData }) {
  const { score, checks } = coherence
  const config = getScoreConfig(score)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          Cohérence
        </span>
        <span className={`text-[13px] font-bold ${config.color}`}>
          {score}/100 — {config.label}
        </span>
      </div>

      <div className="h-[4px] w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
        {checks.map(check => (
          <div key={check.label} className="flex items-center gap-1">
            {check.ok
              ? <CheckCircle2 size={10} className="text-[#1f8a65] shrink-0" />
              : <AlertTriangle size={10} className="text-amber-400 shrink-0" />
            }
            <span className={`text-[9px] ${check.ok ? 'text-white/50' : 'text-amber-400'}`}>
              {check.warning ?? check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
