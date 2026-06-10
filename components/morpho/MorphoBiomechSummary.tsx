'use client'

import { ChevronRight, Dna } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { isMorphoV2, type MorphoAnalysisSummary } from '@/lib/morpho/types'

interface Props {
  /** undefined = chargement en cours · null = aucune analyse */
  latestAnalysis: MorphoAnalysisSummary | null | undefined
  onViewAnalysis: (analysis: MorphoAnalysisSummary) => void
}

const FRAME_LABELS: Record<string, Record<string, string>> = {
  biacromial: { narrow: 'Clavicules étroites', average: 'Clavicules moyennes', wide: 'Clavicules larges' },
  bi_iliac:   { narrow: 'Bassin étroit',       average: 'Bassin moyen',        wide: 'Bassin large'    },
  thorax_depth: { flat: 'Thorax plat',          average: 'Thorax moyen',        deep: 'Thorax épais'   },
}

const SQUAT_VAR: Record<string, string> = {
  high_bar: 'Squat High-Bar', low_bar: 'Squat Low-Bar',
  safety_bar: 'Safety Bar', goblet: 'Goblet Squat',
  front_squat: 'Front Squat', other: 'Squat (autre)',
}

const DEADLIFT_VAR: Record<string, string> = {
  conventional: 'Deadlift conventionnel', sumo: 'Sumo Deadlift',
  trap_bar: 'Trap Bar', romanian: 'Romanian (RDL)', other: 'Deadlift (autre)',
}

export function MorphoBiomechSummary({ latestAnalysis, onViewAnalysis }: Props) {
  if (latestAnalysis === undefined) {
    return <Skeleton className="h-[88px] w-full rounded-xl" />
  }

  const analysis = latestAnalysis
  if (!analysis || analysis.status !== 'completed' || !analysis.analysis_result) return null

  const result = analysis.analysis_result
  const isV2 = isMorphoV2(result)
  const v2 = isV2 ? result : null
  const score = result.score
  const scoreColor = score >= 70 ? '#1f8a65' : score >= 40 ? '#f59e0b' : '#ef4444'

  // Frame chips (v3+)
  const frameChips: string[] = []
  if (v2?.biomech.frame) {
    const f = v2.biomech.frame
    if (f.confidence !== 'low') {
      for (const key of ['biacromial', 'bi_iliac', 'thorax_depth'] as const) {
        const label = FRAME_LABELS[key]?.[f[key] ?? '']
        if (label) frameChips.push(label)
      }
    }
  }

  // Prescription chips (v3+)
  const prescChips: string[] = []
  if (v2?.biomech.setup_prescriptions) {
    const sp = v2.biomech.setup_prescriptions
    if (sp.squat_variation) prescChips.push(SQUAT_VAR[sp.squat_variation] ?? sp.squat_variation)
    if (sp.deadlift_variation) prescChips.push(DEADLIFT_VAR[sp.deadlift_variation] ?? sp.deadlift_variation)
  }

  const r = 18
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)

  return (
    <div className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] p-4">
      <div className="flex items-start gap-4">

        {/* Score ring */}
        <div className="relative shrink-0 flex items-center justify-center w-[44px] h-[44px]">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="3.5" />
            <circle cx="22" cy="22" r={r} stroke={scoreColor} strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${circ}`}
              strokeDashoffset={`${offset}`}
              transform="rotate(-90 22 22)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <span className="absolute text-[12px] font-bold" style={{ color: scoreColor }}>{score}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Dna size={11} className="text-[#1f8a65] shrink-0" />
              <span className="text-[11px] font-semibold text-white/80">Dernière analyse biomécanique</span>
              {analysis.prompt_version && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-white/[0.05] text-white/30">
                  {analysis.prompt_version.toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={() => onViewAnalysis(analysis)}
              className="flex items-center gap-0.5 text-[10px] text-[#1f8a65] hover:opacity-80 transition-opacity shrink-0"
            >
              Détail <ChevronRight size={11} />
            </button>
          </div>

          {/* Frame chips */}
          {frameChips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {frameChips.map((c, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-white/[0.05] text-[9px] text-white/55 border-[0.3px] border-white/[0.06]">
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* Prescription chips */}
          {prescChips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {prescChips.map((p, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-[#1f8a65]/[0.08] text-[9px] text-[#1f8a65] border-[0.3px] border-[#1f8a65]/20">
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Posture summary fallback */}
          {frameChips.length === 0 && prescChips.length === 0 && result.posture_summary && (
            <p className="text-[10px] text-white/40 italic line-clamp-1">{result.posture_summary}</p>
          )}

          {/* Date */}
          <p className="text-[9px] text-white/25">
            {new Date(analysis.analysis_date).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
