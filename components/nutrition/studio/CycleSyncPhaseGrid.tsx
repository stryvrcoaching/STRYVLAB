"use client"

import { Moon } from "lucide-react"
import {
  getCycleSyncAdjustment,
  detectCurrentPhase,
} from "@/lib/nutrition/engine/cycleSync"
import type { CyclePhase } from "@/lib/nutrition/engine/cycleSync"
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget"

const PHASES: CyclePhase[] = ["follicular", "ovulatory", "luteal", "menstrual"]

const PHASE_LABELS: Record<CyclePhase, string> = {
  follicular: "Phase folliculaire",
  ovulatory:  "Phase ovulatoire",
  luteal:     "Phase lutéale",
  menstrual:  "Menstruation",
}

const PHASE_DAYS: Record<CyclePhase, string> = {
  follicular: "J6–J13",
  ovulatory:  "J14–J16",
  luteal:     "J17–J28",
  menstrual:  "J1–J5",
}

const PHASE_COLORS: Record<CyclePhase, { bg: string; border: string; dot: string; tag: string }> = {
  follicular: { bg: "rgba(34,197,94,0.06)",   border: "rgba(34,197,94,0.18)",   dot: "#22c55e", tag: "bg-green-500/10 text-green-400" },
  ovulatory:  { bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.18)",  dot: "#fbbf24", tag: "bg-amber-500/10 text-amber-400" },
  luteal:     { bg: "rgba(168,85,247,0.06)",  border: "rgba(168,85,247,0.18)",  dot: "#a855f7", tag: "bg-purple-500/10 text-purple-400" },
  menstrual:  { bg: "rgba(239,68,68,0.06)",   border: "rgba(239,68,68,0.18)",   dot: "#ef4444", tag: "bg-red-500/10 text-red-400"    },
}

function ResultRow({
  label,
  base,
  delta,
  unit,
}: {
  label: string
  base: number
  delta: number
  unit: string
}) {
  if (delta === 0) return null
  const result = Math.round(base + delta)
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[9px] text-white/35 uppercase tracking-[0.12em] shrink-0">{label}</span>
      <span className="text-[9px] font-mono text-right">
        <span className="text-white/30">{Math.round(base)}</span>
        <span className="text-white/45"> {delta > 0 ? "+" : ""}{delta}{unit}</span>
        <span className="text-white/75 font-semibold"> = {result}{unit}</span>
      </span>
    </div>
  )
}

function DeltaOnly({ value, unit, label }: { value: number; unit: string; label: string }) {
  if (value === 0) return null
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-white/35 uppercase tracking-[0.12em]">{label}</span>
      <span className={`text-[10px] font-semibold ${value > 0 ? "text-white/70" : "text-white/50"}`}>
        {value > 0 ? "+" : ""}{value}{unit}
      </span>
    </div>
  )
}

interface Props {
  baseMacros?: NutritionMacros | null
  currentCycleDay?: number | null
}

export default function CycleSyncPhaseGrid({ baseMacros, currentCycleDay }: Props) {
  const currentPhase = currentCycleDay != null ? detectCurrentPhase(currentCycleDay) : null

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-white/40 leading-relaxed">
        Ajustements macros automatiques selon la phase du cycle menstruel (Davidsen 2007, Oosthuyse &amp; Bosch 2010).
        Les valeurs ci-dessous sont additives — elles s&apos;appliquent sur la base calculée.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {PHASES.map((phase) => {
          const adj = getCycleSyncAdjustment(phase)
          const colors = PHASE_COLORS[phase]
          const isCurrent = phase === currentPhase
          const isDimmed = currentPhase !== null && !isCurrent
          const hasDeltas = adj.caloriesDelta !== 0 || adj.proteinDelta !== 0 || adj.carbsDelta !== 0 || adj.fatDelta !== 0

          return (
            <div
              key={phase}
              className={`rounded-xl p-3 space-y-2.5 transition-opacity ${isDimmed ? "opacity-35" : "opacity-100"}`}
              style={{
                background: isDimmed ? "rgba(255,255,255,0.02)" : colors.bg,
                border: `0.3px solid ${isCurrent ? colors.dot : isDimmed ? "rgba(255,255,255,0.06)" : colors.border}`,
                boxShadow: isCurrent ? `0 0 0 1px ${colors.dot}33` : undefined,
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: colors.border }}
                  >
                    <Moon size={8} style={{ color: colors.dot }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-white/80 leading-tight">
                      {PHASE_LABELS[phase]}
                    </p>
                    <p className="text-[8px] text-white/30">{PHASE_DAYS[phase]}</p>
                  </div>
                </div>
                {isCurrent && (
                  <span className={`text-[7px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${colors.tag}`}>
                    Actuelle
                  </span>
                )}
              </div>

              {/* Macros: base + delta = result, or delta-only if no base */}
              <div className="space-y-1">
                {!hasDeltas ? (
                  <p className="text-[9px] text-white/30 italic">Aucun ajustement</p>
                ) : baseMacros ? (
                  <>
                    <ResultRow label="Calories"  base={baseMacros.kcal}      delta={adj.caloriesDelta}    unit=" kcal" />
                    <ResultRow label="Protéines" base={baseMacros.protein_g} delta={adj.proteinDelta}     unit="g" />
                    <ResultRow label="Glucides"  base={baseMacros.carbs_g}   delta={adj.carbsDelta}       unit="g" />
                    <ResultRow label="Lipides"   base={baseMacros.fat_g}     delta={adj.fatDelta}         unit="g" />
                    <DeltaOnly value={adj.hydrationDeltaMl} unit=" ml" label="Hydratation" />
                  </>
                ) : (
                  <>
                    <DeltaOnly value={adj.caloriesDelta}    unit=" kcal" label="Calories" />
                    <DeltaOnly value={adj.proteinDelta}     unit="g"     label="Protéines" />
                    <DeltaOnly value={adj.carbsDelta}       unit="g"     label="Glucides" />
                    <DeltaOnly value={adj.fatDelta}         unit="g"     label="Lipides" />
                    <DeltaOnly value={adj.hydrationDeltaMl} unit=" ml"  label="Hydratation" />
                  </>
                )}
              </div>

              {/* Optimal deficit badge */}
              {adj.optimalForDeficit && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500/70" />
                  <p className="text-[8px] text-white/35">Phase optimale déficit</p>
                </div>
              )}

              {/* First note */}
              <p className="text-[9px] text-white/30 leading-relaxed line-clamp-2">
                {adj.notes[0]}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
