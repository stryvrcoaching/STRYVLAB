'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Zap, ChevronDown, ChevronUp, Sliders, FlaskConical, Microscope, HelpCircle, ArrowRight, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import type { IntelligenceResult, TemplateMeta, SRAHeatmapWeek, VolumeFocus } from '@/lib/programs/intelligence'
import { VOLUME_FOCUS_LABELS } from '@/lib/programs/intelligence'

interface Props {
  result: IntelligenceResult
  meta: TemplateMeta
  morphoConnected?: boolean
  morphoDate?: string
  sraHeatmap?: SRAHeatmapWeek[]
  labOverrides?: Record<string, number>
  presentPatterns?: string[]
  onOverrideChange?: (pattern: string, value: number) => void
  onOverrideReset?: () => void
  onVolumeFocusChange?: (group: string, focus: VolumeFocus) => void
  onAlertClick?: (sessionIndex: number, exerciseIndex: number) => void
}

const SUBSCORE_LABELS: Record<string, string> = {
  balance: 'Équilibre',
  recovery: 'Récupération',
  specificity: 'Cohérence objectif',
  progression: 'Progression',
  completeness: 'Couverture',
  redundancy: 'Diversité',
  jointLoad: 'Charge articulaire',
  coordination: 'Coordination',
  volumeCoverage: 'Volume MEV/MRV',
}

const SCORE_COLOR = (score: number) =>
  score >= 75 ? '#1f8a65' : score >= 50 ? '#f59e0b' : '#ef4444'

const SUBSCORE_ACCENT: Record<string, string> = {
  jointLoad: '#f97316',
  coordination: '#8b5cf6',
  volumeCoverage: '#3b82f6',
}

const SUBSCORE_TOOLTIPS: Record<string, string> = {
  balance: 'Ratio push/pull selon l\'objectif. Un déséquilibre chronique crée des compensations posturales et augmente le risque de blessure à l\'épaule.',
  recovery: 'Fenêtre SRA (Stimulus-Récupération-Adaptation) : temps minimum entre deux sollicitations du même muscle. Trop fréquent = fatigue cumulée sans adaptation.',
  specificity: 'Les exercices correspondent-ils à l\'objectif ? Hypertrophie = 6–15 reps, RIR 1–3, exercices polyarticulaires lourds.',
  progression: 'RIR semaine 1 doit être ≥ 1 pour laisser une marge d\'intensification. Commencer à RIR = 0 = stagnation rapide et surmenage précoce.',
  completeness: 'Patterns de mouvement requis par l\'objectif tous présents ? Hypertrophie = push + pull + jambes + core minimum.',
  redundancy: 'Exercices en doublon (même pattern + mêmes muscles + coeff similaire) diluent le stimulus sans apporter de nouveau signal d\'adaptation.',
  jointLoad: 'Stress cumulé sur épaule, genou et rachis. Croise avec les restrictions du profil client. Un score faible = risque articulaire élevé.',
  coordination: 'Complexité motrice moyenne du programme. Un débutant avec des exercices très techniques risque une mauvaise exécution et des blessures.',
  volumeCoverage: 'Volume hebdomadaire par groupe musculaire comparé aux seuils Israetel/RP : MEV (minimum efficace), MAV (optimal), MRV (maximum récupérable).',
}

const OVERRIDE_TOOLTIPS: Record<string, string> = {
  horizontal_push: 'Ajuste le stimulus des développés couchés, pompes et dips.',
  vertical_push: 'Ajuste le stimulus des développés au-dessus de la tête.',
  horizontal_pull: 'Ajuste le stimulus des tirages réalisés vers le buste.',
  vertical_pull: 'Ajuste le stimulus des tractions et tirages réalisés de haut en bas.',
  elbow_flexion: 'Multiplie le coefficient stimulus des exercices de biceps (curl barre, curl haltères…)',
  elbow_extension: 'Multiplie le coefficient stimulus des exercices de triceps (extensions, pushdown…)',
  squat_pattern: 'Ajuste le stimulus des squats, fentes et presses à cuisses.',
  hip_hinge: 'Ajuste le stimulus des soulevés de terre, extensions de hanche et variantes similaires.',
  knee_flexion: 'Ajuste le stimulus des flexions du genou, comme les leg curls.',
  core_flex: 'Ajuste le stimulus des flexions abdominales et relevés de jambes.',
  core_anti_flex: 'Ajuste le stimulus du gainage et des exercices de stabilité du tronc.',
  core_rotation: 'Ajuste le stimulus des rotations du tronc.',
  lateral_raise: 'Multiplie le coefficient stimulus des élévations latérales et exercices épaules isolés',
  calf_raise: 'Multiplie le coefficient stimulus des exercices de mollets',
  scapular_elevation: 'Ajuste le stimulus des haussements d’épaules.',
}

// Muscles affichés dans le radar — 10 axes
const RADAR_MUSCLES: { key: string; label: string }[] = [
  { key: 'dos', label: 'Dos' },
  { key: 'pectoraux', label: 'Pecto' },
  { key: 'epaules', label: 'Épaules' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'quadriceps', label: 'Quad' },
  { key: 'ischio-jambiers', label: 'Ischio' },
  { key: 'fessiers', label: 'Fessiers' },
  { key: 'mollets', label: 'Mollets' },
  { key: 'abdos', label: 'Abdos' },
]

const RADAR_MUSCLE_GROUPS: Record<string, string> = {
  dos: 'dos',
  grand_dorsal: 'dos',
  dos_superieur: 'dos',
  rhomboides: 'dos',
  trapeze: 'dos',
  trapeze_superieur: 'dos',
  trapeze_moyen: 'dos',
  trapeze_inferieur: 'dos',
  erecteurs_rachis: 'dos',
  lombaires: 'dos',
  pectoraux: 'pectoraux',
  grand_pectoral: 'pectoraux',
  grand_pectoral_sup: 'pectoraux',
  grand_pectoral_inf: 'pectoraux',
  grand_pectoral_superieur: 'pectoraux',
  grand_pectoral_inferieur: 'pectoraux',
  petit_pectoral: 'pectoraux',
  epaules: 'epaules',
  deltoide_anterieur: 'epaules',
  deltoide_lateral: 'epaules',
  deltoide_posterieur: 'epaules',
  coiffe_rotateurs: 'epaules',
  subscapulaire: 'epaules',
  biceps: 'biceps',
  biceps_brachial: 'biceps',
  brachial: 'biceps',
  brachial_anterieur: 'biceps',
  brachio_radial: 'biceps',
  triceps: 'triceps',
  triceps_brachii: 'triceps',
  triceps_lateral: 'triceps',
  triceps_medial: 'triceps',
  triceps_long: 'triceps',
  quadriceps: 'quadriceps',
  droit_femoral: 'quadriceps',
  rectus_femoris: 'quadriceps',
  vaste_lateral: 'quadriceps',
  vaste_medial: 'quadriceps',
  vaste_intermediaire: 'quadriceps',
  'ischio-jambiers': 'ischio-jambiers',
  ischio_jambiers: 'ischio-jambiers',
  biceps_femoral: 'ischio-jambiers',
  semi_membraneux: 'ischio-jambiers',
  semi_tendineux: 'ischio-jambiers',
  fessiers: 'fessiers',
  grand_fessier: 'fessiers',
  moyen_fessier: 'fessiers',
  petit_fessier: 'fessiers',
  mollets: 'mollets',
  mollet: 'mollets',
  gastrocnemien: 'mollets',
  soleaire: 'mollets',
  solea: 'mollets',
  abdos: 'abdos',
  droit_abdominal: 'abdos',
  droit_abdominal_inf: 'abdos',
  obliques: 'abdos',
  transverse: 'abdos',
  transverse_abdominal: 'abdos',
  sangle_abdominale: 'abdos',
}

// Traduction slugs normalisés → français naturel (après normalizeFiberSlug côté moteur)
// Doit rester en sync avec BIOMECH_TO_FR dans scoring.ts
const FIBER_LABEL_FR: Record<string, string> = {
  // Fessiers
  grand_fessier: 'Grand fessier',
  moyen_fessier: 'Moyen fessier',
  petit_fessier: 'Petit fessier',
  fessiers: 'Fessiers',
  // Ischio-jambiers
  ischio_jambiers: 'Ischio-jambiers',
  'ischio-jambiers': 'Ischio-jambiers',
  biceps_femoral: 'Biceps fémoral',
  semi_membraneux: 'Semi-membraneux',
  semi_tendineux: 'Semi-tendineux',
  // Quadriceps
  quadriceps: 'Quadriceps',
  droit_femoral: 'Droit fémoral',
  rectus_femoris: 'Droit fémoral',
  vaste_lateral: 'Vaste latéral',
  vaste_medial: 'Vaste médial',
  // Dos
  grand_dorsal: 'Grand dorsal',
  dos_superieur: 'Dos sup.',
  dos: 'Dos',
  rhomboides: 'Rhomboïdes',
  trapeze: 'Trapèze',
  trapeze_superieur: 'Trapèze sup.',
  trapeze_moyen: 'Trapèze moy.',
  trapeze_inferieur: 'Trapèze inf.',
  erecteurs_rachis: 'Érecteurs rachis',
  erecteurs_spinaux: 'Érecteurs rachis',
  lombaires: 'Lombaires',
  // Pectoraux
  grand_pectoral: 'Grand pectoral',
  grand_pectoral_sup: 'Grand pect. sup.',
  grand_pectoral_inf: 'Grand pect. inf.',
  grand_pectoral_superieur: 'Grand pectoral supérieur',
  grand_pectoral_inferieur: 'Grand pectoral inférieur',
  petit_pectoral: 'Petit pectoral',
  pectoraux: 'Pectoraux',
  // Épaules
  deltoide_anterieur: 'Deltoïde ant.',
  deltoide_lateral: 'Deltoïde lat.',
  deltoide_posterieur: 'Deltoïde post.',
  coiffe_rotateurs: 'Coiffe rotateurs',
  subscapulaire: 'Subscapulaire',
  epaules: 'Épaules',
  // Bras
  biceps: 'Biceps',
  biceps_brachial: 'Biceps brachial',
  brachial: 'Brachial',
  brachial_anterieur: 'Brachial ant.',
  brachio_radial: 'Brachio-radial',
  triceps: 'Triceps',
  triceps_long: 'Triceps — longue portion',
  triceps_lateral: 'Triceps — faisceau latéral',
  triceps_medial: 'Triceps — faisceau médial',
  // Mollets
  gastrocnemien: 'Gastrocnémien',
  soleaire: 'Soléaire',
  solea: 'Soléaire',
  mollet: 'Mollets',
  mollets: 'Mollets',
  // Core
  droit_abdominal: 'Droit abdominal',
  droit_abdominal_inf: 'Abdominaux inf.',
  obliques: 'Obliques',
  obliques_externes: 'Obliques externes',
  obliques_internes: 'Obliques internes',
  transverse: 'Transverse',
  transverse_abdominal: 'Transverse abdominal',
  sangle_abdominale: 'Sangle abdominale',
  abdos: 'Abdos',
}

const PATTERN_LABEL_FR: Record<string, string> = {
  horizontal_push: 'Poussée horizontale', vertical_push: 'Poussée verticale',
  horizontal_pull: 'Tirage horizontal', vertical_pull: 'Tirage vertical',
  squat_pattern: 'Dominante genou', hip_hinge: 'Charnière de hanche',
  knee_flexion: 'Flexion du genou', knee_extension: 'Extension du genou',
  wrist_flexion: 'Flexion du poignet', wrist_extension: 'Extension du poignet', forearm_rotation: 'Rotation de l’avant-bras',
  elbow_flexion: 'Biceps', elbow_extension: 'Triceps',
  lateral_raise: 'Élévation latérale', shoulder_abduction: 'Élévation latérale', calf_raise: 'Mollets',
  core_flex: 'Flexion abdominale', core_anti_flex: 'Gainage', anti_rotation: 'Gainage anti-rotation', core_rotation: 'Rotation du tronc',
  carry: 'Porté chargé', scapular_elevation: 'Haussement d’épaules',
  hip_abduction: 'Abduction', hip_adduction: 'Adduction',
  shoulder_rotation: 'Rotation de l’épaule', scapular_retraction: 'Rétraction des omoplates',
  scapular_protraction: 'Protraction',
}

function formatPatternLabel(pattern: string) {
  return PATTERN_LABEL_FR[pattern] ?? 'Mouvement à qualifier'
}

function formatStimulusAdjustment(value: number) {
  const delta = Math.round((value - 1) * 100)
  return delta === 0 ? 'Référence du catalogue' : `${delta > 0 ? '+' : ''}${delta} % de stimulus estimé`
}

// Couleur de barre selon intensité relative (% du max dans la séance)
function barColor(pct: number): string {
  if (pct >= 60) return '#1f8a65'
  if (pct >= 30) return '#34d399'
  return '#6ee7b7'
}

const ALERT_STYLE = {
  critical: {
    Icon: AlertCircle,
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-300',
  },
  warning: {
    Icon: AlertTriangle,
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
  },
  info: {
    Icon: Info,
    border: 'border-white/[0.06]',
    bg: 'bg-white/[0.03]',
    text: 'text-white/65',
  },
} as const

export default function ProgramIntelligencePanel({
  result, meta, onAlertClick,
  morphoConnected, morphoDate, sraHeatmap,
  labOverrides, presentPatterns, onOverrideChange, onOverrideReset, onVolumeFocusChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [labOpen, setLabOpen] = useState(false)
  const [expandedSubscore, setExpandedSubscore] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const globalColor = SCORE_COLOR(result.globalScore)

  const radarDistribution = Object.entries(result.distribution).reduce<Record<string, number>>((acc, [muscle, volume]) => {
    const group = RADAR_MUSCLE_GROUPS[muscle]
    if (!group) return acc
    acc[group] = (acc[group] ?? 0) + volume
    return acc
  }, {})

  // Radar — agréger les sous-muscles par groupe puis normaliser sur le max
  const radarRaw = RADAR_MUSCLES.map(({ key, label }) => ({
    muscle: label,
    volume: radarDistribution[key] ?? 0,
  }))
  const radarMax = Math.max(...radarRaw.map(d => d.volume), 1)
  const radarData = radarRaw.map(d => ({
    muscle: d.muscle,
    rawVolume: d.volume,
    volume: Math.round((d.volume / radarMax) * 100),
  }))
  const priorityAlerts = result.alerts.slice(0, 4)

  return (
    <div className="flex flex-col gap-3">

      {/* ── Header + score global ── */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-[#1f8a65]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Smart Fit</p>
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="text-white/30 hover:text-white/60">
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        <div className="flex items-end gap-2 mb-2">
          <motion.span
            key={result.globalScore}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[2.4rem] font-black leading-none"
            style={{ color: globalColor }}
          >
            {result.globalScore}
          </motion.span>
          <span className="text-[13px] text-white/30 mb-1">/100</span>
        </div>

        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden mb-3">
          {Object.entries(result.subscores).map(([key, val]) => (
            <div
              key={key}
              className="flex-1 rounded-full"
              style={{ backgroundColor: SCORE_COLOR(val), opacity: 0.7 + (val / 100) * 0.3 }}
              title={`${SUBSCORE_LABELS[key]}: ${val}`}
            />
          ))}
        </div>

        <p className="text-[11px] text-white/50 leading-relaxed">{result.globalNarrative}</p>
      </div>

      {!collapsed && (
        <>
          {/* ── Actions prioritaires ── */}
          {priorityAlerts.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">
                    Actions prioritaires
                  </p>
                  <p className="text-[9px] text-white/25 mt-0.5">
                    Les premiers points à corriger pour améliorer le score utilement.
                  </p>
                </div>
                <span className="text-[9px] text-white/20">{priorityAlerts.length} point{priorityAlerts.length > 1 ? 's' : ''}</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {priorityAlerts.map((alert, index) => {
                  const cfg = ALERT_STYLE[alert.severity]
                  const Icon = cfg.Icon
                  const canJump = alert.sessionIndex != null && alert.exerciseIndex != null && onAlertClick

                  return (
                    <div
                      key={`${alert.code}-${alert.sessionIndex ?? 'g'}-${alert.exerciseIndex ?? index}`}
                      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon size={12} className={`shrink-0 mt-0.5 ${cfg.text}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-semibold ${cfg.text}`}>{alert.title}</p>
                          <p className="text-[10px] text-white/45 leading-relaxed mt-1">
                            {alert.explanation}
                          </p>
                          <p className="text-[10px] text-white/60 leading-relaxed mt-1">
                            {alert.suggestion}
                          </p>
                          {canJump && (
                            <button
                              type="button"
                              onClick={() => onAlertClick?.(alert.sessionIndex!, alert.exerciseIndex!)}
                              className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1f8a65] hover:opacity-80 transition-opacity"
                            >
                              <ArrowRight size={10} />
                              Voir l’exercice
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Volume MEV/MAV/MRV par objectif musculaire ── */}
          {result.volumeFocus.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-0.5">
                Objectifs et stimulus hebdomadaire
              </p>
              <p className="text-[9px] text-white/25 mb-3">Les seuils s’appliquent au groupe complet, pas à chaque faisceau isolé.</p>

              <div className="flex flex-col gap-3">
                {result.volumeFocus.map(group => {
                  const isBelowTarget = group.targetMin != null && group.volume < group.targetMin
                  const isOverMrv = group.volume > group.mrv
                  const isOverMav = group.mode !== 'priority' && group.volume > group.mav && !isOverMrv
                  const barColor = isOverMrv ? '#ef4444' : isOverMav ? '#f59e0b' : isBelowTarget ? '#6b7280' : '#1f8a65'
                  const fillPct = Math.min((group.volume / group.mrv) * 100, 100)
                  const targetLabel = group.mode === 'priority'
                    ? `cible MAV → MRV (${group.mav}–${group.mrv})`
                    : group.mode === 'maintenance'
                      ? `maintien ${group.targetMin}–${group.mev}`
                      : group.mode === 'off'
                        ? 'non évalué comme objectif'
                        : `progression MEV → MAV (${group.mev}–${group.mav})`

                  return (
                    <div key={group.key}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[9px] text-white/55">{group.label}</span>
                        {onVolumeFocusChange ? (
                          <select
                            value={group.mode}
                            onChange={(event) => onVolumeFocusChange(group.key, event.target.value as VolumeFocus)}
                            aria-label={`Objectif ${group.label}`}
                            className="max-w-[108px] rounded-md border border-white/[0.08] bg-black/20 px-1.5 py-1 text-[8px] text-white/60 outline-none focus:border-[#1f8a65]"
                          >
                            {Object.entries(VOLUME_FOCUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[8px] text-white/30">{VOLUME_FOCUS_LABELS[group.mode]}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[8px] text-white/25">{targetLabel}</span>
                        <span className="text-[8px] font-mono" style={{ color: barColor }}>{group.volume.toFixed(1)} <span className="text-white/20">/{group.mrv}</span></span>
                      </div>
                      <div className="relative h-[5px] bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 h-full rounded-full opacity-15" style={{ width: `${Math.min((group.mev / group.mrv) * 100, 100)}%`, backgroundColor: '#1f8a65' }} />
                        <div className="absolute top-0 h-full rounded-full opacity-10" style={{ left: `${(group.mev / group.mrv) * 100}%`, width: `${Math.min(((group.mav - group.mev) / group.mrv) * 100, 100)}%`, backgroundColor: '#1f8a65' }} />
                        <motion.div className="absolute top-0 left-0 h-full rounded-full" style={{ backgroundColor: barColor }} initial={{ width: 0 }} animate={{ width: `${fillPct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── KPIs globaux ── */}
          {result.programStats.totalSets > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2.5">Charge prescrite hebdomadaire</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Séries planifiées', value: result.programStats.totalSets },
                  {
                    label: 'Reps est.', value: result.programStats.totalEstimatedReps >= 1000
                      ? `${(result.programStats.totalEstimatedReps / 1000).toFixed(1)}k`
                      : result.programStats.totalEstimatedReps
                  },
                  { label: 'Exercices uniques', value: result.programStats.totalExercises },
                  { label: 'Exercices / séance', value: result.programStats.avgExercisesPerSession },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/[0.02] rounded-xl p-2 flex items-center justify-between gap-1.5">
                    <p className="text-[8px] text-white/40">{label}</p>
                    <p className="text-[14px] font-black text-white leading-none">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Radar distribution globale ── */}
          {mounted && radarRaw.some(d => d.volume > 0) && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-1">
                Distribution du stimulus
              </p>
              <p className="text-[9px] text-white/25 mb-3">Stimulus estimé, normalisé sur le groupe le plus sollicité</p>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <Tooltip
                      formatter={(value: number, _name, item) => [`${item?.payload?.rawVolume?.toFixed?.(1) ?? value}`, 'Volume pondéré']}
                      labelFormatter={(label) => `${label}`}
                      contentStyle={{ background: '#0f0f0f', border: 'none', borderRadius: 8, fontSize: 10 }}
                      itemStyle={{ color: 'rgba(255,255,255,0.7)' }}
                    />
                    <PolarAngleAxis
                      dataKey="muscle"
                      tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.45)', fontWeight: 600 }}
                    />
                    <Radar
                      name="Volume"
                      dataKey="volume"
                      stroke="#1f8a65"
                      fill="#1f8a65"
                      fillOpacity={0.2}
                      strokeWidth={1.5}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Répartition par faisceau musculaire — par séance ── */}
          {result.programStats.sessionsStats.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-0.5">
                Stimulus direct par faisceau
              </p>
              <p className="text-[9px] text-white/25 mb-3">Par séance · cible principale de chaque exercice</p>

              <div className="flex flex-col gap-4">
                {result.programStats.sessionsStats.map((s, i) => {
                  const fibers = Object.entries(s.fiberVolumes).sort(([, a], [, b]) => b - a)
                  if (fibers.length === 0) return null

                  const maxVol = fibers[0][1]

                  return (
                    <div key={i}>
                      {/* En-tête séance */}
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold text-white/70 truncate flex-1 mr-2">
                          {s.name || `Séance ${i + 1}`}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] text-white/30 font-mono">{s.totalSets}s</span>
                          <span className="text-[9px] text-white/15">·</span>
                          <span className="text-[9px] text-white/30 font-mono">{s.exerciseCount} ex.</span>
                        </div>
                      </div>

                      {/* Barres faisceaux */}
                      <div className="flex flex-col gap-1.5">
                        {fibers.map(([fiber, vol]) => {
                          const pct = maxVol > 0 ? Math.round((vol / maxVol) * 100) : 0
                          const label = FIBER_LABEL_FR[fiber] ?? 'Muscle à qualifier'
                          const color = barColor(pct)
                          return (
                            <div key={fiber} className="flex items-center gap-2">
                              <span
                                className="text-[9px] text-white/40 shrink-0 text-right"
                                style={{ width: 96 }}
                              >
                                {label}
                              </span>
                              <div className="flex-1 h-[6px] bg-white/[0.04] rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.4, ease: 'easeOut' }}
                                />
                              </div>
                              <span className="text-[9px] font-mono text-white/25 w-8 text-right shrink-0">
                                {vol.toFixed(1)}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Patterns de la séance */}
                      {s.patterns.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.patterns.slice(0, 5).map(p => (
                            <span key={p} className="text-[8px] font-medium text-white/30 bg-white/[0.03] px-1.5 py-0.5 rounded">
                              {PATTERN_LABEL_FR[p] ?? p}
                            </span>
                          ))}
                          {s.patterns.length > 5 && (
                            <span className="text-[8px] text-white/20">+{s.patterns.length - 5}</span>
                          )}
                        </div>
                      )}

                      {/* Séparateur entre séances */}
                      {i < result.programStats.sessionsStats.length - 1 && (
                        <div className="mt-3 h-px bg-white/[0.04]" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Section Lab ── */}
          <div className="rounded-xl border-[0.3px] border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.03] overflow-hidden">
            <button
              onClick={() => setLabOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#8b5cf6]/[0.04] transition-colors"
            >
              <div className="flex items-center gap-2">
                <FlaskConical size={13} className="text-[#8b5cf6]" />
                <span className="text-[11px] font-semibold text-[#8b5cf6]">Lab — ajustement du stimulus</span>
                <span className="text-[9px] text-[#8b5cf6]/50 bg-[#8b5cf6]/10 px-1.5 py-0.5 rounded-full">BETA</span>
                {morphoConnected && (
                  <span className="text-[9px] text-[#1f8a65] bg-[#1f8a65]/10 px-1.5 py-0.5 rounded-full">
                    Morpho {morphoDate ? `(${morphoDate})` : 'connecté'}
                  </span>
                )}
              </div>
              {labOpen
                ? <ChevronUp size={13} className="text-[#8b5cf6]/50" />
                : <ChevronDown size={13} className="text-[#8b5cf6]/50" />
              }
            </button>

            {labOpen && (
              <div className="px-4 pb-4 space-y-4">

                {/* Score global anchor */}
                <div className="flex items-end gap-2 pt-1">
                  <span className="text-[2rem] font-black leading-none" style={{ color: globalColor }}>
                    {result.globalScore}
                  </span>
                  <span className="text-[11px] text-white/30 mb-0.5">/100</span>
                  <span className="text-[10px] text-white/30 mb-0.5 ml-1">score global</span>
                </div>

                {/* Subscores avec tooltips */}
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-2 flex items-center gap-1.5">
                    <Microscope size={10} />
                    Sous-scores détaillés
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(result.subscores).map(([key, score]) => {
                      const labelAccent = key === 'jointLoad' ? '#f97316' : key === 'coordination' ? '#8b5cf6' : key === 'volumeCoverage' ? '#3b82f6' : undefined
                      const tooltip = SUBSCORE_TOOLTIPS[key]
                      return (
                        <div key={key} className="rounded-lg bg-black/20 px-2.5 py-2">
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <span
                              className="text-[9px] capitalize leading-tight flex-1"
                              style={{ color: labelAccent ? `${labelAccent}99` : 'rgba(255,255,255,0.35)' }}
                            >
                              {SUBSCORE_LABELS[key] ?? key}
                            </span>
                            {tooltip && (
                              <button
                                onClick={() => setExpandedSubscore(expandedSubscore === key ? null : key)}
                                className="shrink-0 text-white/20 hover:text-white/50 transition-colors"
                              >
                                <HelpCircle size={9} />
                              </button>
                            )}
                          </div>
                          <span
                            className="text-[18px] font-black font-mono leading-none"
                            style={{ color: score >= 75 ? '#1f8a65' : score >= 50 ? '#f59e0b' : '#ef4444' }}
                          >
                            {Math.round(score)}
                          </span>
                          {expandedSubscore === key && tooltip && (
                            <p className="text-[9px] text-white/40 mt-1.5 leading-relaxed border-t border-white/[0.06] pt-1.5">
                              {tooltip}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Heatmap fatigue restructurée */}
                {sraHeatmap && sraHeatmap.some(w => w.muscles.length > 0) && (() => {
                  const heatmapWeeks = sraHeatmap
                  const allMuscles = Array.from(new Set(heatmapWeeks.flatMap(w => w.muscles.map(m => m.name))))
                  return (
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-1 flex items-center gap-1.5">
                        <Zap size={10} />
                        Charge de récupération estimée
                      </p>
                      <p className="text-[8px] text-white/20 mb-2 leading-relaxed">
                        Projection théorique du programme actuel : volume estimé, espacement des séances et niveau du pratiquant. Ce n’est pas une mesure de fatigue réelle.
                      </p>
                      <div className="flex items-center gap-3 mb-2">
                        {[
                          { color: '#1f8a65', label: 'Optimal (<30%)' },
                          { color: '#f59e0b', label: 'Élevé (30–60%)' },
                          { color: '#ef4444', label: 'Critique (>60%)' },
                        ].map(({ color, label }) => (
                          <div key={label} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
                            <span className="text-[8px] text-white/30">{label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[9px]">
                          <thead>
                            <tr>
                              <th className="text-left text-white/25 pr-2 pb-1 font-normal">Muscle</th>
                              {heatmapWeeks.map(w => (
                                <th key={w.week} className="text-center text-white/25 px-1 pb-1 font-normal w-12">S{w.week}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {allMuscles.map(muscle => (
                              <tr key={muscle}>
                                <td className="text-white/40 pr-2 py-0.5">{FIBER_LABEL_FR[muscle] ?? 'Muscle à qualifier'}</td>
                                {heatmapWeeks.map(week => {
                                  const entry = week.muscles.find(x => x.name === muscle)
                                  const fatigue = entry?.fatigue ?? 0
                                  const bg = fatigue > 60 ? 'rgba(239,68,68,0.3)' : fatigue > 30 ? 'rgba(245,158,11,0.25)' : fatigue > 0 ? 'rgba(31,138,101,0.2)' : 'rgba(255,255,255,0.02)'
                                  return (
                                    <td key={week.week} className="px-1 py-0.5">
                                      <div
                                        className="h-4 rounded"
                                        style={{ backgroundColor: bg }}
                                        title={fatigue > 0 ? `${fatigue}%` : '—'}
                                      />
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* Overrides coefficients */}
                {presentPatterns && presentPatterns.length > 0 && onOverrideChange && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 flex items-center gap-1.5">
                        <Sliders size={10} />
                        Ajustements du stimulus
                      </p>
                      {onOverrideReset && Object.keys(labOverrides ?? {}).some(k => (labOverrides ?? {})[k] !== 1.0) && (
                        <button
                          onClick={onOverrideReset}
                          className="text-[9px] text-[#8b5cf6]/60 hover:text-[#8b5cf6] transition-colors"
                        >
                          Réinitialiser
                        </button>
                      )}
                    </div>
                    <p className="text-[8px] text-white/20 mb-2 leading-relaxed">
                      Ajustement temporaire, non enregistré. À 110 %, chaque série du mouvement concerné compte comme 1,1 série de stimulus estimé. Il met à jour le volume estimé, le radar, la récupération, le score et les alertes — jamais les séries prescrites.
                    </p>
                    <div className="space-y-2">
                      {presentPatterns.map(pattern => {
                        const currentVal = (labOverrides ?? {})[pattern] ?? 1.0
                        const tooltip = OVERRIDE_TOOLTIPS[pattern]
                        return (
                          <div key={pattern}>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-white/40 w-32 shrink-0 truncate capitalize">
                                {formatPatternLabel(pattern)}
                              </span>
                              <input
                                type="range"
                                min={0.5}
                                max={1.5}
                                step={0.05}
                                value={currentVal}
                                onChange={e => onOverrideChange(pattern, parseFloat(e.target.value))}
                                className="flex-1 accent-[#8b5cf6] h-1"
                              />
                              <span
                                className="text-[9px] font-mono w-8 text-right shrink-0"
                                style={{ color: currentVal !== 1.0 ? '#8b5cf6' : 'rgba(255,255,255,0.3)' }}
                              >
                                {Math.round(currentVal * 100)} %
                              </span>
                            </div>
                            <p className="text-[8px] text-white/20 ml-32 mt-0.5 leading-relaxed pl-2">
                              {formatStimulusAdjustment(currentVal)} · {tooltip ?? 'Ajuste le stimulus estimé des exercices de cette famille de mouvements.'}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Badge Morpho */}
                <div className="pt-1 border-t border-white/[0.04]">
                  {morphoConnected ? (
                    <p className="text-[9px] text-[#1f8a65]/70 leading-relaxed">
                      Ajustements morpho actifs{morphoDate ? ` (analyse du ${morphoDate})` : ''} — les coefficients stimulus sont modulés par les asymétries mesurées.
                    </p>
                  ) : (
                    <p className="text-[9px] text-white/25 leading-relaxed">
                      Aucune analyse morpho disponible — coefficients standards du catalogue.
                    </p>
                  )}
                </div>

              </div>
            )}
          </div>

        </>
      )}
    </div>
  )
}
