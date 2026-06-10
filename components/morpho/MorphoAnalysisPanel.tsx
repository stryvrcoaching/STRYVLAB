'use client'

import { MorphoEvolutionChart } from './MorphoEvolutionChart'
import type { MorphoAnalysisResult } from '@/lib/morpho/types'

interface Props {
  result: MorphoAnalysisResult
  stimulusAdjustments?: Record<string, number> | null
  analysisDate?: string
  clientId: string
}

const ZONE_LABELS: Record<string, string> = {
  shoulders: 'Épaules', pelvis: 'Bassin', spine: 'Colonne', knees: 'Genoux', ankles: 'Chevilles'
}

const SEVERITY_STYLES: Record<string, string> = {
  red: 'text-red-400 bg-red-500/10 border-red-500/20',
  orange: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  green: 'text-[#1f8a65] bg-[#1f8a65]/10 border-[#1f8a65]/20',
}

const TYPE_STYLES: Record<string, string> = {
  exercise: 'text-[#1f8a65] bg-[#1f8a65]/10 border-[#1f8a65]/20',
  correction: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  contraindication: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const TYPE_LABELS: Record<string, string> = {
  exercise: 'Exercice', correction: 'Correction', contraindication: 'Contre-indication'
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 75 ? '#1f8a65' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Score postural</p>
        <p className="text-[22px] font-black leading-none" style={{ color }}>{score}<span className="text-[12px] font-bold text-white/30">/100</span></p>
      </div>
      <div className="h-[3px] w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  )
}

export function MorphoAnalysisPanel({ result, analysisDate, clientId }: Props) {
  return (
    <div className="space-y-4">
      {analysisDate && (
        <p className="text-[9px] text-white/30">
          {new Date(analysisDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      <ScoreGauge score={result.score} />

      {result.posture_summary && (
        <p className="text-[11px] text-white/50 italic leading-relaxed">{result.posture_summary}</p>
      )}

      {/* Flags par zone */}
      {result.flags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Zones</p>
          <div className="flex flex-wrap gap-1.5">
            {result.flags.map((flag, i) => (
              <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded-lg border-[0.3px] text-[10px] font-semibold ${SEVERITY_STYLES[flag.severity]}`}>
                <span className="text-white/50">{ZONE_LABELS[flag.zone] ?? flag.zone}</span>
                <span>— {flag.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points d'attention */}
      {result.attention_points.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Points d'attention</p>
          <div className="space-y-1">
            {result.attention_points
              .sort((a, b) => a.priority - b.priority)
              .map((pt, i) => (
                <div key={i} className="flex items-start gap-2 bg-white/[0.02] rounded-lg p-2.5 border-[0.3px] border-white/[0.06]">
                  <span className={`text-[9px] font-black shrink-0 mt-0.5 ${pt.priority === 1 ? 'text-red-400' : pt.priority === 2 ? 'text-amber-400' : 'text-white/30'}`}>
                    P{pt.priority}
                  </span>
                  <p className="text-[11px] text-white/60 leading-snug">{pt.description}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recommandations */}
      {result.recommendations.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Recommandations</p>
          <div className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="bg-white/[0.02] rounded-lg p-2.5 border-[0.3px] border-white/[0.06] space-y-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border-[0.3px] ${TYPE_STYLES[rec.type]}`}>
                  {TYPE_LABELS[rec.type] ?? rec.type}
                </span>
                <p className="text-[11px] text-white/60 leading-snug">{rec.description}</p>
                {rec.reference && (
                  <p className="text-[9px] text-white/30 font-mono">{rec.reference}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Asymétries */}
      {result.asymmetries && result.asymmetries.posture_notes && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Asymétries</p>
          <div className="bg-white/[0.02] rounded-lg p-3 border-[0.3px] border-white/[0.06] space-y-1.5">
            {result.asymmetries.shoulder_imbalance_cm != null && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">Épaules</span>
                <span className={`text-[10px] font-bold ${result.asymmetries.shoulder_imbalance_cm > 2 ? 'text-amber-400' : 'text-white/60'}`}>
                  {result.asymmetries.shoulder_imbalance_cm} cm
                </span>
              </div>
            )}
            {result.asymmetries.arm_diff_cm != null && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">Bras</span>
                <span className={`text-[10px] font-bold ${result.asymmetries.arm_diff_cm > 2 ? 'text-amber-400' : 'text-white/60'}`}>
                  {result.asymmetries.arm_diff_cm} cm
                </span>
              </div>
            )}
            {result.asymmetries.hip_imbalance_cm != null && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">Hanches</span>
                <span className={`text-[10px] font-bold ${result.asymmetries.hip_imbalance_cm > 2 ? 'text-amber-400' : 'text-white/60'}`}>
                  {result.asymmetries.hip_imbalance_cm} cm
                </span>
              </div>
            )}
            <p className="text-[10px] text-white/40 italic">{result.asymmetries.posture_notes}</p>
          </div>
        </div>
      )}

      {/* Évolution timeline */}
      <MorphoEvolutionChart clientId={clientId} />
    </div>
  )
}
