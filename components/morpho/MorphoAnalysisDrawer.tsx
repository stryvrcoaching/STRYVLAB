'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, TrendingUp, TrendingDown, Minus,
  ChevronRight, Activity, Dna, Dumbbell,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  isMorphoV2,
  type MorphoAnalysisSummary,
  type BiomechMovementPattern,
  type PatternVerdict,
} from '@/lib/morpho/types'
import type { ExerciseRecommendation } from '@/lib/morpho/biomechEngine'

interface Props {
  analysis: MorphoAnalysisSummary | null
  clientId: string
  onClose: () => void
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const PATTERN_LABELS: Record<string, string> = {
  horizontal_push: 'Poussée horizontale',
  horizontal_pull: 'Tirage horizontal',
  vertical_push: 'Poussée verticale',
  vertical_pull: 'Tirage vertical',
  squat: 'Squat',
  hinge: 'Charnière',
  lunge: 'Fente',
  carry: 'Porté',
  rotation: 'Rotation',
  anti_rotation: 'Anti-rotation',
  core_anti_flex: 'Anti-flexion (Core)',
  unilateral_push: 'Poussée unilatérale',
  unilateral_pull: 'Tirage unilatéral',
}

const SYNDROME_LABELS: Record<string, string> = {
  upper_crossed: 'Syndrome croisé supérieur',
  lower_crossed: 'Syndrome croisé inférieur',
  layered: 'Syndrome en couches',
  none: 'Aucun',
}

const SEVERITY_LABELS: Record<string, string> = {
  mild: 'Léger',
  moderate: 'Modéré',
  marked: 'Marqué',
}

const CHAIN_LABELS: Record<string, string> = {
  underdeveloped: 'Sous-développée',
  balanced: 'Équilibrée',
  developed: 'Développée',
  unknown: 'Inconnue',
  anterior: 'Antérieure',
  posterior: 'Postérieure',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#1f8a65',
  medium: 'rgba(255,255,255,0.4)',
  low: '#f59e0b',
}

const ZONE_LABELS: Record<string, string> = {
  shoulders: 'Épaules',
  pelvis: 'Bassin',
  spine: 'Rachis',
  knees: 'Genoux',
  ankles: 'Chevilles',
}

const INSERTION_LABELS: Record<string, string> = {
  // v2 legacy
  biceps: 'Biceps',
  triceps: 'Triceps',
  calves: 'Mollets',
  pectorals: 'Pectoraux',
  traps: 'Trapèzes',
  quadriceps: 'Quadriceps',
  lats: 'Dorsaux',
  hamstrings: 'Ischio-jambiers',
  deltoids: 'Deltoïdes',
  // v3
  pec_sternal: 'Pect. sternal',
  pec_clavicular: 'Pect. claviculaire',
  gastrocnemius: 'Gastrocnémiens',
  quad_sweep: 'Vaste latéral (sweep)',
  deltoid_anterior: 'Deltoïde antérieur',
}

const INSERTION_VALUE_LABELS: Record<string, string> = {
  high: 'Haute',
  low: 'Basse',
  balanced: 'Équilibrée',
  unknown: 'Inconnue',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30 mb-2">{children}</p>
  )
}

function FlagBadge({ severity, label }: { severity: string; label: string }) {
  const colors = {
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    orange: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    green: 'bg-[#1f8a65]/10 text-[#1f8a65] border-[#1f8a65]/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border-[0.3px] ${colors[severity as keyof typeof colors] ?? 'bg-white/[0.04] text-white/50'}`}>
      {label}
    </span>
  )
}

function VerdictIcon({ verdict }: { verdict: PatternVerdict['verdict'] }) {
  if (verdict === 'advantage') return <TrendingUp size={11} className="text-[#1f8a65]" />
  if (verdict === 'disadvantage') return <TrendingDown size={11} className="text-amber-400" />
  return <Minus size={11} className="text-white/30" />
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#1f8a65' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${score}%`, background: color }}
      />
    </div>
  )
}

function ConfidenceDot({ level }: { level: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{ background: CONFIDENCE_COLORS[level] ?? 'rgba(255,255,255,0.2)' }}
      title={`Confiance : ${level}`}
    />
  )
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<string, string> = {
  PECTORAUX: 'Pectoraux', DORSAUX: 'Dorsaux', QUADRICEPS: 'Quadriceps',
  ISCHIO_JAMBIERS: 'Ischio-jambiers', EPAULES: 'Épaules', TRICEPS: 'Triceps',
  BICEPS: 'Biceps', FESSIERS: 'Fessiers', MOLLETS: 'Mollets',
  TRAPEZE: 'Trapèze', ABDOMINAUX_CORE: 'Abdos / Core', ERECTEURS_SPINAUX: 'Érecteurs spinaux',
}

const ADV_CONFIG = {
  advantageous:    { label: 'Optimal',        color: '#1f8a65', dot: 'bg-[#1f8a65]' },
  neutral:         { label: 'Neutre',          color: 'rgba(255,255,255,0.4)', dot: 'bg-white/30' },
  disadvantageous: { label: 'Sous-optimal',   color: '#f59e0b', dot: 'bg-amber-400' },
  contraindicated: { label: 'Contre-indiqué', color: '#ef4444', dot: 'bg-red-400' },
}

export function MorphoAnalysisDrawer({ analysis, clientId, onClose }: Props) {
  const [exMap, setExMap] = useState<ExerciseRecommendation[] | null>(null)
  const [exMapLoading, setExMapLoading] = useState(false)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Fetch exercise map when analysis changes (v2/v3 only)
  useEffect(() => {
    if (!analysis || !clientId) { setExMap(null); return }
    const result = analysis.analysis_result
    if (!result || !isMorphoV2(result)) { setExMap(null); return }
    setExMapLoading(true)
    setExMap(null)
    fetch(`/api/clients/${clientId}/morpho/exercise-map`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.recommendations) setExMap(data.recommendations) })
      .catch(() => {})
      .finally(() => setExMapLoading(false))
  }, [analysis?.id, clientId])

  const result = analysis?.analysis_result ?? null
  const isV2 = result != null && isMorphoV2(result)
  const v2 = isV2 ? result : null

  // Group exercise map by muscle group
  const exMapByGroup = exMap
    ? exMap.reduce<Record<string, ExerciseRecommendation[]>>((acc, r) => {
        if (!acc[r.muscle_group]) acc[r.muscle_group] = []
        acc[r.muscle_group].push(r)
        return acc
      }, {})
    : null

  return (
    <AnimatePresence>
      {analysis && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-[480px] bg-[#121212] flex flex-col overflow-hidden border-l border-white/[0.06]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <Dna size={14} className="text-[#1f8a65]" />
                <div>
                  <p className="text-[13px] font-semibold text-white">Analyse MorphoPro</p>
                  <p className="text-[10px] text-white/40">
                    {new Date(analysis.analysis_date).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                    {analysis.prompt_version && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[9px] text-white/40">
                        {analysis.prompt_version.toUpperCase()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-lg hover:bg-white/[0.04]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

              {!result ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Activity size={24} className="text-white/20" />
                  <p className="text-[12px] text-white/40">Analyse non disponible</p>
                  {analysis.error_message && (
                    <p className="text-[11px] text-red-400/80">{analysis.error_message}</p>
                  )}
                </div>
              ) : (
                <>
                  {/* ── Score ── */}
                  <div className="space-y-2">
                    <SectionLabel>Score postural</SectionLabel>
                    <div className="bg-white/[0.02] rounded-xl p-4 border-[0.3px] border-white/[0.06] space-y-3">
                      <div className="flex items-end gap-2">
                        <span className="text-5xl font-bold text-white tabular-nums">{result.score}</span>
                        <span className="text-[13px] text-white/30 mb-1">/100</span>
                        {v2 && (
                          <span className="ml-auto text-[10px] text-white/30 flex items-center gap-1">
                            <ConfidenceDot level={v2.meta.overall_confidence} />
                            {v2.meta.overall_confidence}
                          </span>
                        )}
                      </div>
                      <ScoreBar score={result.score} />
                      {result.posture_summary && (
                        <p className="text-[11px] text-white/50 leading-relaxed">{result.posture_summary}</p>
                      )}
                    </div>
                  </div>

                  {/* ── Flags ── */}
                  {result.flags.length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Drapeaux posturaux</SectionLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {result.flags.map((f, i) => (
                          <FlagBadge key={i} severity={f.severity} label={`${ZONE_LABELS[f.zone] ?? f.zone} — ${f.label}`} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Asymétries ── */}
                  <div className="space-y-2">
                    <SectionLabel>Asymétries</SectionLabel>
                    <div className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] overflow-hidden">
                      {[
                        { label: 'Épaules', value: result.asymmetries.shoulder_imbalance_cm, unit: 'cm' },
                        { label: 'Hanches', value: result.asymmetries.hip_imbalance_cm, unit: 'cm' },
                        { label: 'Bras (diff.)', value: result.asymmetries.arm_diff_cm, unit: 'cm' },
                        ...(v2 ? [
                          { label: 'Jambes (diff.)', value: v2.asymmetries.leg_length_diff_cm, unit: 'cm' },
                          { label: 'Rotation pelvienne', value: v2.asymmetries.pelvic_rotation_deg, unit: '°' },
                        ] : []),
                      ].map((row, i, arr) => (
                        <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                          <span className="text-[11px] text-white/50">{row.label}</span>
                          <span className="text-[11px] font-mono text-white/80">
                            {row.value != null ? `${row.value}${row.unit}` : '—'}
                          </span>
                        </div>
                      ))}
                      {result.asymmetries.posture_notes && (
                        <div className="px-4 py-2.5 border-t border-white/[0.04]">
                          <p className="text-[10px] text-white/35 italic">{result.asymmetries.posture_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Points d'attention ── */}
                  {result.attention_points.length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Points d&apos;attention</SectionLabel>
                      <div className="space-y-1.5">
                        {result.attention_points
                          .slice()
                          .sort((a, b) => a.priority - b.priority)
                          .map((pt, i) => (
                            <div key={i} className="flex items-start gap-3 bg-white/[0.02] rounded-xl px-3 py-2.5 border-[0.3px] border-white/[0.06]">
                              <span className="text-[10px] font-bold text-white/25 w-4 shrink-0 text-right mt-0.5">{pt.priority}</span>
                              <div className="min-w-0">
                                <p className="text-[11px] text-white/70">{pt.description}</p>
                                {pt.zone && <p className="text-[10px] text-white/30 mt-0.5">{pt.zone}</p>}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* ── Recommandations ── */}
                  {result.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Recommandations</SectionLabel>
                      <div className="space-y-1.5">
                        {result.recommendations.map((rec, i) => {
                          const typeColors = {
                            exercise: 'text-[#1f8a65]',
                            correction: 'text-amber-400',
                            contraindication: 'text-red-400',
                          }
                          return (
                            <div key={i} className="flex items-start gap-2.5 bg-white/[0.02] rounded-xl px-3 py-2.5 border-[0.3px] border-white/[0.06]">
                              <ChevronRight size={11} className={`mt-0.5 shrink-0 ${typeColors[rec.type] ?? 'text-white/30'}`} />
                              <div className="min-w-0">
                                <p className="text-[11px] text-white/70">{rec.description}</p>
                                {rec.reference && <p className="text-[10px] text-white/30 mt-0.5">{rec.reference}</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Ajustements stimulus ── */}
                  {analysis.stimulus_adjustments && Object.keys(analysis.stimulus_adjustments).length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Ajustements stimulus</SectionLabel>
                      <div className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] overflow-hidden">
                        {Object.entries(analysis.stimulus_adjustments).map(([pattern, mult], i, arr) => {
                          const pct = Math.round((mult - 1) * 100)
                          return (
                            <div key={pattern} className={`flex items-center justify-between px-4 py-2 ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                              <span className="text-[10px] text-white/50">{PATTERN_LABELS[pattern] ?? pattern.replace(/_/g, ' ')}</span>
                              <span className={`text-[11px] font-mono font-semibold ${pct > 0 ? 'text-[#1f8a65]' : pct < 0 ? 'text-amber-400' : 'text-white/40'}`}>
                                {pct > 0 ? '+' : ''}{pct}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ════════════ V2 BIOMECH ════════════ */}
                  {v2 && (
                    <>
                      {/* ── Pattern verdicts ── */}
                      {v2.biomech.pattern_verdicts.length > 0 && (
                        <div className="space-y-2">
                          <SectionLabel>Verdicts patterns mouvement</SectionLabel>
                          <div className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] overflow-hidden">
                            {v2.biomech.pattern_verdicts.map((pv, i, arr) => (
                              <div key={pv.pattern} className={`flex items-start gap-3 px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                                <VerdictIcon verdict={pv.verdict} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-medium text-white/75">
                                      {PATTERN_LABELS[pv.pattern] ?? pv.pattern}
                                    </span>
                                    <span className={`text-[9px] font-semibold shrink-0 ${
                                      pv.verdict === 'advantage' ? 'text-[#1f8a65]'
                                      : pv.verdict === 'disadvantage' ? 'text-amber-400'
                                      : 'text-white/30'
                                    }`}>
                                      {pv.verdict === 'advantage' ? 'Avantage' : pv.verdict === 'disadvantage' ? 'Désavantage' : 'Neutre'}
                                    </span>
                                  </div>
                                  {pv.rationale && (
                                    <p className="text-[10px] text-white/35 mt-0.5 leading-relaxed">{pv.rationale}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Syndromes posturaux ── */}
                      {v2.biomech.postural_syndromes.filter(s => s.name !== 'none').length > 0 && (
                        <div className="space-y-2">
                          <SectionLabel>Syndromes posturaux</SectionLabel>
                          <div className="space-y-1.5">
                            {v2.biomech.postural_syndromes
                              .filter(s => s.name !== 'none')
                              .map((s) => (
                                <div key={s.name} className="bg-white/[0.02] rounded-xl px-4 py-3 border-[0.3px] border-white/[0.06]">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] font-medium text-white/75">
                                      {SYNDROME_LABELS[s.name] ?? s.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {s.present && s.severity && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                          s.severity === 'marked' ? 'bg-red-500/10 text-red-400'
                                          : s.severity === 'moderate' ? 'bg-amber-500/10 text-amber-400'
                                          : 'bg-white/[0.06] text-white/40'
                                        }`}>
                                          {SEVERITY_LABELS[s.severity]}
                                        </span>
                                      )}
                                      {!s.present && (
                                        <span className="text-[9px] text-white/25">Absent</span>
                                      )}
                                      <ConfidenceDot level={s.confidence} />
                                    </div>
                                  </div>
                                  {s.markers.length > 0 && (
                                    <p className="text-[10px] text-white/35 leading-relaxed">
                                      {s.markers.join(' · ')}
                                    </p>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* ── Chain assessment ── */}
                      <div className="space-y-2">
                        <SectionLabel>Bilan chaînes musculaires</SectionLabel>
                        <div className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] overflow-hidden">
                          {[
                            { label: 'Chaîne postérieure', value: v2.biomech.chain_assessment.posterior_chain },
                            { label: 'Chaîne antérieure', value: v2.biomech.chain_assessment.anterior_chain },
                            { label: 'Dominance croisée', value: v2.biomech.chain_assessment.dominant_cross_chain },
                          ].map((row, i, arr) => (
                            <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                              <span className="text-[11px] text-white/50">{row.label}</span>
                              <span className={`text-[11px] font-semibold ${
                                row.value === 'developed' || row.value === 'balanced' ? 'text-[#1f8a65]'
                                : row.value === 'underdeveloped' ? 'text-amber-400'
                                : 'text-white/40'
                              }`}>
                                {CHAIN_LABELS[row.value] ?? row.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Structure Osseuse (Frame) ── */}
                      {v2.biomech.frame && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <SectionLabel>Structure osseuse</SectionLabel>
                            <ConfidenceDot level={v2.biomech.frame.confidence} />
                          </div>
                          <div className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] overflow-hidden">
                            {[
                              { label: 'Clavicules', value: v2.biomech.frame.biacromial },
                              { label: 'Bassin (Bi-iliaque)', value: v2.biomech.frame.bi_iliac },
                              { label: 'Thorax (Profondeur)', value: v2.biomech.frame.thorax_depth },
                              { label: 'Écart inter-pectoral', value: v2.biomech.frame.inter_pectoral_gap },
                              { label: 'Valgus coude', value: v2.biomech.frame.elbow_carrying_angle },
                              { label: 'Alignement genoux', value: v2.biomech.frame.knee_alignment },
                              { label: 'Ossature globale', value: v2.biomech.frame.skeletal_frame },
                            ].filter(row => row.value != null && row.value !== 'unknown').map((row, i, arr) => {
                              const FRAME_LABELS: Record<string, string> = {
                                narrow: 'Étroit', average: 'Moyen', wide: 'Large',
                                flat: 'Plat', deep: 'Épais',
                                light: 'Légère', medium: 'Moyenne', heavy: 'Lourde',
                                valgus: 'Valgus (en X)', varus: 'Varus (en O)', neutral: 'Neutre',
                                normal: 'Normal', mild_valgus: 'Valgus léger', marked_valgus: 'Valgus marqué',
                                unknown: 'Inconnue'
                              }
                              return (
                                <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                                  <span className="text-[11px] text-white/50">{row.label}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-white/80">
                                      {FRAME_LABELS[row.value!] ?? row.value}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── Segments ── */}
                      <div className="space-y-2">
                        <SectionLabel>Analyse segmentaire</SectionLabel>

                        {/* Ratios clés */}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Ratio tronc / fémur', value: v2.biomech.segments.trunk_to_femur_ratio, hint: '>1 = favorable squat' },
                            { label: 'Ratio bras / tronc', value: v2.biomech.segments.arm_to_torso_ratio, hint: '>1 = favorable deadlift' },
                          ].map((r) => (
                            <div key={r.label} className="bg-white/[0.02] rounded-xl px-3 py-2.5 border-[0.3px] border-white/[0.06]">
                              <p className="text-[9px] text-white/35 mb-1">{r.label}</p>
                              <p className="text-[18px] font-mono font-bold text-white/80">
                                {r.value != null ? r.value.toFixed(2) : '—'}
                              </p>
                              <p className="text-[9px] text-white/25 mt-0.5">{r.hint}</p>
                            </div>
                          ))}
                        </div>

                        {/* Longueurs individuelles */}
                        {(() => {
                          const seg = v2.biomech.segments
                          const CLASS_LABELS: Record<string, string> = {
                            short: 'Court', average: 'Moyen', long: 'Long', unknown: '—',
                          }
                          const rows: Array<{ label: string; seg: typeof seg.torso }> = [
                            { label: 'Tronc', seg: seg.torso },
                            { label: 'Fémur G', seg: seg.femur_l },
                            { label: 'Fémur D', seg: seg.femur_r },
                            { label: 'Tibia G', seg: seg.tibia_l },
                            { label: 'Tibia D', seg: seg.tibia_r },
                            { label: 'Bras G', seg: seg.arm_l },
                            { label: 'Bras D', seg: seg.arm_r },
                            { label: 'Avant-bras G', seg: seg.forearm_l },
                            { label: 'Avant-bras D', seg: seg.forearm_r },
                          ]
                          return (
                            <div className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] overflow-hidden">
                              {rows.map((row, i, arr) => (
                                <div key={row.label} className={`flex items-center px-4 py-2 ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                                  <span className="text-[11px] text-white/50 w-28 shrink-0">{row.label}</span>
                                  <span className={`text-[11px] font-semibold w-16 shrink-0 ${
                                    row.seg.classification === 'long' ? 'text-[#1f8a65]'
                                    : row.seg.classification === 'short' ? 'text-amber-400'
                                    : 'text-white/50'
                                  }`}>
                                    {CLASS_LABELS[row.seg.classification] ?? '—'}
                                  </span>
                                  <span className="text-[10px] font-mono text-white/35 ml-auto">
                                    {row.seg.cm != null ? `${Math.round(row.seg.cm)} cm` : '—'}
                                  </span>
                                  <ConfidenceDot level={row.seg.confidence} />
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>

                      {/* ── Insertions musculaires ── */}
                      {v2.biomech.insertions.filter(ins => ins.value !== 'unknown').length > 0 && (
                        <div className="space-y-2">
                          <SectionLabel>Insertions musculaires</SectionLabel>
                          <div className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] overflow-hidden">
                            {v2.biomech.insertions
                              .filter(ins => ins.value !== 'unknown')
                              .map((ins, i, arr) => (
                                <div key={ins.muscle} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-white/60">{INSERTION_LABELS[ins.muscle] ?? ins.muscle}</span>
                                    <ConfidenceDot level={ins.confidence} />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-white/70">{INSERTION_VALUE_LABELS[ins.value] ?? ins.value}</span>
                                    {ins.note && (
                                      <span className="text-[9px] text-white/30 italic truncate max-w-[120px]">{ins.note}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* ── Setup Prescriptions ── */}
                      {v2.biomech.setup_prescriptions && (
                        <div className="space-y-2">
                          <SectionLabel>Recommandations de Placement (Setup)</SectionLabel>
                          <div className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] overflow-hidden">
                            {[
                              { label: 'Squat (Stance)', value: v2.biomech.setup_prescriptions.squat_stance },
                              { label: 'Squat (Variation)', value: v2.biomech.setup_prescriptions.squat_variation },
                              { label: 'Deadlift', value: v2.biomech.setup_prescriptions.deadlift_variation },
                              { label: 'Bench (Grip)', value: v2.biomech.setup_prescriptions.bench_grip },
                              { label: 'Overhead Press', value: v2.biomech.setup_prescriptions.ohp_implement },
                              { label: 'Tirages (Grip)', value: v2.biomech.setup_prescriptions.pull_grip },
                            ].map((row, i, arr) => {
                              const SETUP_LABELS: Record<string, string> = {
                                high_bar: 'High Bar', low_bar: 'Low Bar', safety_bar: 'Safety Bar',
                                goblet: 'Goblet Squat', front_squat: 'Front Squat',
                                conventional: 'Traditionnel', sumo: 'Sumo', trap_bar: 'Trap Bar',
                                romanian: 'Roumain (RDL)',
                                barbell: 'Barre', dumbbell: 'Haltères', landmine: 'Landmine',
                                pronated: 'Pronation', supinated: 'Supination', neutral: 'Neutre', mixed: 'Mixte',
                                other: 'Autre'
                              }
                              return (
                                <div key={i} className={`flex items-center px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                                  <span className="text-[11px] text-white/50 w-28 shrink-0">{row.label}</span>
                                  <span className="text-[11px] font-semibold text-white/80 flex-1 break-words">
                                    {SETUP_LABELS[row.value] ?? row.value}
                                  </span>
                                </div>
                              )
                            })}
                            {v2.biomech.setup_prescriptions.rationale && (
                              <div className="px-4 py-2.5 border-t border-white/[0.04]">
                                <p className="text-[10px] text-white/35 italic leading-relaxed">
                                  {v2.biomech.setup_prescriptions.rationale}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {/* ── Carte exercices recommandés ── */}
                      {(exMapLoading || exMapByGroup) && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Dumbbell size={11} className="text-[#1f8a65]" />
                            <SectionLabel>Exercices recommandés</SectionLabel>
                          </div>
                          {exMapLoading && (
                            <div className="space-y-1.5">
                              {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                            </div>
                          )}
                          {exMapByGroup && Object.entries(exMapByGroup).map(([group, recs]) => {
                            const sorted = [...recs].sort((a, b) => {
                              const order = { advantageous: 0, neutral: 1, disadvantageous: 2, contraindicated: 3 }
                              return (order[a.advantage] ?? 9) - (order[b.advantage] ?? 9)
                            })
                            return (
                              <div key={group} className="bg-white/[0.02] rounded-xl border-[0.3px] border-white/[0.06] overflow-hidden">
                                <div className="px-4 py-2 border-b border-white/[0.04]">
                                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">
                                    {GROUP_LABELS[group] ?? group}
                                  </p>
                                </div>
                                {sorted.map((rec, i, arr) => {
                                  const cfg = ADV_CONFIG[rec.advantage]
                                  return (
                                    <div key={rec.slot} className={`flex items-start gap-3 px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[11px] text-white/75 font-medium truncate">{rec.ex_name}</span>
                                          <span className="text-[8px] font-bold shrink-0" style={{ color: cfg.color }}>{cfg.label}</span>
                                        </div>
                                        {rec.reasoning && (
                                          <p className="text-[9px] text-white/30 mt-0.5 leading-relaxed line-clamp-2">{rec.reasoning}</p>
                                        )}
                                        {rec.suggested_substitution && rec.advantage === 'contraindicated' && (
                                          <p className="text-[9px] text-[#1f8a65]/70 mt-0.5">→ {rec.suggested_substitution}</p>
                                        )}
                                      </div>
                                      <span className="text-[8px] text-white/20 shrink-0 font-mono">{rec.slot}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
