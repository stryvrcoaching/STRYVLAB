"use client";

import { useState } from "react";
import { Info, Droplets, AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import TdeeWaterfall from "./TdeeWaterfall";
import CalorieAdjustmentDisplay from "./CalorieAdjustmentDisplay";
import MacroSliders, { type MacroOverrides } from "./MacroSliders";
import InfoModal from "./InfoModal";
import { INJECTION_INFO_MODALS } from "@/lib/nutrition/infoModalDefinitions";
import type { MacroResult, MacroGoal } from "@/lib/formulas/macros";
import type { HydrationClimate } from "@/lib/formulas/hydration";
import CycleSyncPhaseGrid from "./CycleSyncPhaseGrid";
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget";
import type { CycleState } from "@/lib/cycle/cycleEngine";
import type { CyclePhaseObservation } from "@/lib/cycle/cycle-phase-observations";
import { getCycleSyncAdjustment } from "@/lib/nutrition/engine/cycleSync";
import {
  DEFAULT_CYCLE_SYNC_PROFILE,
  getEffectiveCycleSyncAdjustment,
  type CycleSyncProfile,
} from "@/lib/nutrition/cycle-sync-profile";
import CyclePhasePill from "@/components/client/cycle/CyclePhasePill";
import CoachDocLinkButton from "@/components/coach/docs/CoachDocLinkButton";
import type { NutritionDataMode } from "./useNutritionStudio";
import {
  buildNutritionDataQualityHeadline,
  getNutritionDataConfidenceLabel,
  getNutritionDataQualityIssues,
} from "@/lib/nutrition/dataQualityPresentation";
import {
  TRANSFORMATION_PHASE_OPTIONS,
  getTransformationPhaseLabel,
  transformationPhaseToMacroGoal,
  type TransformationPhase,
} from "@/lib/coach/transformationPhase";
import type { MissingDataKey } from "./missingData";
import { signalToMissingDataKey } from "./missingData";
import type { TdeeEstimationStatus } from "@/lib/nutrition/tdee-quality";
import type { PhaseProtocolPreview } from "@/lib/nutrition/phase-protocol-recalibration";

interface Props {
  goal: MacroGoal;
  transformationPhase: TransformationPhase;
  onTransformationPhaseChange: (phase: TransformationPhase) => void;
  phaseProtocolPreview?: PhaseProtocolPreview | null;
  onApplyPhaseProtocolPreview?: () => void;
  onDismissPhaseProtocolPreview?: () => void;
  calorieAdjustPct: number;
  onCalorieAdjustChange: (v: number) => void;
  proteinOverride: number | null;
  onProteinOverrideChange: (v: number | null) => void;
  macroOverrides: MacroOverrides;
  onMacroOverridesChange: (v: MacroOverrides) => void;
  macroResult: MacroResult | null;
  goalCalories: number | null;
  hydrationClimate: HydrationClimate;
  onHydrationClimateChange: (c: HydrationClimate) => void;
  hydrationPhase: number;
  onHydrationPhaseChange: (v: number) => void;
  hydrationLiters: number | null;
  leanMass: number | null;
  bodyWeight: number | null;
  dataMode?: NutritionDataMode;
  anchorDate?: string | null;
  realtimeWindowDays?: number;
  tdeeAdaptive: number | null;
  tdeeAdaptiveAt: Date | null;
  tdeeAdaptiveLower: number | null;
  tdeeAdaptiveUpper: number | null;
  tdeeObserved: number | null;
  tdeeObservedLower: number | null;
  tdeeObservedUpper: number | null;
  tdeeActionableStreak: number;
  tdeeDataSource: 'weight_delta' | 'formula_proxy' | null;
  tdeeHistory: import('./useNutritionStudio').TdeeHistoryEntry[];
  tdeeStabilityStatus: 'stable' | 'watch' | 'action' | null;
  tdeeLastSkipReason: string | null;
  tdeeLastSuccessAt: Date | null;
  tdeeProtocolStartDate: string | null;
  tdeeEstimationStatus: TdeeEstimationStatus;
  tdeeDataQualityScore: number | null;
  tdeeDataQualityReasons: string[];
  tdeeError: string | null;
  applyAdaptiveTdee: () => Promise<void>;
  applyingAdaptive: boolean;
  tdeeAdaptiveActive: boolean;
  onTdeeAdaptiveActiveToggle: (v: boolean) => Promise<void>;
  tdeeAutoEnabled: boolean;
  onTdeeAutoToggle: (v: boolean) => Promise<void>;
  isFemale?: boolean;
  currentCycleDay?: number | null;
  baseMacrosForCycleSync?: NutritionMacros | null;
  cycleState?: CycleState | null;
  cycleSyncEnabled?: boolean;
  onCycleSyncEnabledChange?: (v: boolean) => void;
  cycleSyncProfile?: CycleSyncProfile;
  onCycleSyncProfileChange?: (profile: CycleSyncProfile) => void;
  cyclePhaseObservations?: CyclePhaseObservation[];
  onResolveSignal?: (missingKey: MissingDataKey) => void;
}

const CLIMATE_OPTIONS: { value: HydrationClimate; label: string }[] = [
  { value: "cold", label: "❄️ Froid" },
  { value: "temperate", label: "🌤 Tempéré" },
  { value: "hot", label: "☀️ Chaud" },
  { value: "veryHot", label: "🔥 Très chaud" },
];

// ─── Hydratation phase helpers ────────────────────────────────────────────────

const PHASE_MARKERS = [
  { value: 40, label: "Pré-compét." },
  { value: 80, label: "Sèche" },
  { value: 100, label: "Base" },
  { value: 130, label: "Sèche int." },
  { value: 160, label: "Charge hydrique" },
];

function getPhaseLabel(v: number): string {
  if (v < 60) return "Pré-compétition";
  if (v < 90) return "Phase de sèche";
  if (v < 115) return "Hors-saison";
  if (v < 145) return "Sèche intensive";
  return "Charge hydrique";
}

function getPhaseDescription(v: number): string {
  if (v < 60)
    return "Réduction avant compétition — maintien minimal pour éviter la flatness musculaire.";
  if (v < 90)
    return "Sèche progressive — hydratation légèrement réduite pour minimiser la rétention extracellulaire.";
  if (v < 115)
    return "Baseline EFSA — hydratation optimale pour la performance et la récupération.";
  if (v < 145)
    return "Sèche intensive — volume accru pour soutenir le métabolisme sous déficit calorique fort.";
  return "Charge hydrique (RP Strength) — signal osmotique pour purger la rétention sous-cutanée avant la semaine d'affûtage.";
}

function getPhaseColor(v: number): string {
  if (v < 60) return "#f59e0b"; // amber — attention pré-compet
  if (v < 90) return "#3b82f6"; // bleu — sèche
  if (v < 115) return "#1f8a65"; // vert — baseline optimal
  if (v < 145) return "#3b82f6"; // bleu — sèche intensive
  return "#8b5cf6"; // violet — water loading
}

const PRIORITY_ICON = {
  critical: <AlertTriangle size={11} className="text-red-400 shrink-0" />,
  high: <AlertTriangle size={11} className="text-amber-400 shrink-0" />,
  medium: <Info size={11} className="text-blue-400 shrink-0" />,
  low: <CheckCircle2 size={11} className="text-white/30 shrink-0" />,
};

function getConfidenceTone(confidence?: "high" | "medium" | "low") {
  if (confidence === "high") {
    return {
      label: "Confiance haute",
      className: "text-[#7fe0b8] bg-[#1f8a65]/10 border-[#1f8a65]/25",
    };
  }
  if (confidence === "medium") {
    return {
      label: "Confiance moyenne",
      className: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    };
  }
  return {
    label: "Confiance faible",
    className: "text-red-300 bg-red-500/10 border-red-500/20",
  };
}

function formatLongFrenchDate(value: Date) {
  return value.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });
}

function formatTdeeSkipReason(reason: string) {
  const labels: Record<string, string> = {
    window_too_short_since_protocol_start:
      "la fenêtre de données depuis le début du protocole est encore trop courte",
    insufficient_weight_samples:
      "il manque suffisamment de pesées pour établir une tendance",
    low_confidence:
      "les données disponibles ne permettent pas encore un calcul suffisamment fiable",
  };

  return labels[reason] ?? "les données disponibles ne permettent pas encore un calcul fiable";
}

function getTdeeEstimationStatusLabel(status: TdeeEstimationStatus) {
  if (status === 'actionable') return 'Estimation exploitable';
  if (status === 'observing') return 'En observation';
  return 'Données à compléter';
}

function getTdeeEstimationStatusClassName(status: TdeeEstimationStatus) {
  if (status === 'actionable') return 'border-[#1f8a65]/25 bg-[#1f8a65]/10 text-[#7fe0b8]';
  if (status === 'observing') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  return 'border-white/[0.08] bg-white/[0.04] text-white/55';
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

function SelectInput<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-1 text-[11px] text-white/80 outline-none focus:border-[#1f8a65]/40 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#181818]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function CalculationEngine({
  goal,
  transformationPhase,
  onTransformationPhaseChange,
  phaseProtocolPreview,
  onApplyPhaseProtocolPreview,
  onDismissPhaseProtocolPreview,
  calorieAdjustPct,
  onCalorieAdjustChange,
  proteinOverride,
  onProteinOverrideChange,
  macroOverrides,
  onMacroOverridesChange,
  macroResult,
  goalCalories,
  hydrationClimate,
  onHydrationClimateChange,
  hydrationPhase,
  onHydrationPhaseChange,
  hydrationLiters,
  leanMass,
  bodyWeight,
  dataMode = "bilan",
  anchorDate,
  realtimeWindowDays = 7,
  tdeeAdaptive,
  tdeeAdaptiveAt,
  tdeeAdaptiveLower,
  tdeeAdaptiveUpper,
  tdeeObserved,
  tdeeObservedLower,
  tdeeObservedUpper,
  tdeeActionableStreak,
  tdeeDataSource,
  tdeeHistory,
  tdeeStabilityStatus,
  tdeeLastSkipReason,
  tdeeLastSuccessAt,
  tdeeProtocolStartDate,
  tdeeEstimationStatus,
  tdeeDataQualityScore,
  tdeeDataQualityReasons,
  tdeeError,
  applyAdaptiveTdee,
  applyingAdaptive,
  tdeeAdaptiveActive,
  onTdeeAdaptiveActiveToggle,
  tdeeAutoEnabled,
  onTdeeAutoToggle,
  isFemale = false,
  currentCycleDay,
  baseMacrosForCycleSync,
  cycleState,
  cycleSyncEnabled = false,
  onCycleSyncEnabledChange,
  cycleSyncProfile = DEFAULT_CYCLE_SYNC_PROFILE,
  onCycleSyncProfileChange,
  cyclePhaseObservations = [],
  onResolveSignal,
}: Props) {
  const [openInfoModal, setOpenInfoModal] = useState<string | null>(null);

  const getDaysSinceProtocolStart = () => {
    if (!tdeeProtocolStartDate) return null;
    const anchor = new Date(`${tdeeProtocolStartDate.slice(0, 10)}T00:00:00.000Z`);
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const anchorUtc = anchor.getTime();
    return Math.max(0, Math.floor((todayUtc - anchorUtc) / 86400000));
  };
  const daysSinceProtocolStart = getDaysSinceProtocolStart();


  const anyMacroOverride =
    macroOverrides.protein_g !== null ||
    macroOverrides.fat_g !== null ||
    macroOverrides.carbs_g !== null

  const displayCaloriePct =
    anyMacroOverride && macroResult
      ? Math.max(
          -30,
          Math.min(
            30,
            Math.round(
              ((macroResult.calories - macroResult.tdee) / macroResult.tdee) * 100,
            ),
          ),
        )
      : calorieAdjustPct

  const actionableSuggestions = (macroResult?.smartProtocol ?? [])
    .filter((s) => ["critical", "high"].includes(s.priority))
    .slice(0, 3);
  const dataQualityIssues = getNutritionDataQualityIssues(
    macroResult?.dataQuality,
    dataMode,
  );
  const dataQualityHeadline = buildNutritionDataQualityHeadline(
    macroResult?.dataQuality,
    dataMode,
  );
  const macroGoalLabel =
    goal === "deficit"
      ? "Déficit"
      : goal === "surplus"
        ? "Surplus"
        : "Maintenance";

  return (
    <div className="h-full flex flex-col">
      {/* ── TITRE COLONNE — aligné avec Col 1 et Col 3 ───────────────── */}
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.04] shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-white">
              Calcul nutritionnel
            </p>
            <p className="mt-1 text-[10px] text-white/35">
              {dataMode === "realtime"
                ? `Mode temps reel · moyennes recentes ancrees au ${anchorDate ?? "jour courant"} · fenetre ${realtimeWindowDays}j`
                : `Mode bilan · calcul ancre au ${anchorDate ?? "bilan actif"}`}
            </p>
            {macroResult?.dataQuality && (
              <p
                className={`mt-1 text-[10px] ${
                  macroResult.dataQuality.confidence === "high"
                    ? "text-[#7fe0b8]/70"
                    : macroResult.dataQuality.confidence === "medium"
                      ? "text-amber-300/70"
                      : "text-red-300/75"
                }`}
              >
                Confiance des données {macroResult.dataQuality.score}/100 ·{" "}
                {getNutritionDataConfidenceLabel(
                  macroResult.dataQuality.confidence,
                )}
              </p>
            )}
            {dataQualityHeadline && (
              <p className="mt-1 text-[10px] text-white/40 leading-relaxed">
                {dataQualityHeadline}
              </p>
            )}
          </div>
          <div
            className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium ${
              dataMode === "realtime"
                ? "border-[#1f8a65]/30 bg-[#1f8a65]/10 text-[#7fe0b8]"
                : "border-white/[0.08] bg-white/[0.04] text-white/65"
            }`}
          >
            {dataMode === "realtime" ? "Temps reel" : "Bilan"}
          </div>
        </div>
      </div>

      {/* ── CONTENU SCROLLABLE ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-5 p-4 pb-40">
        {/* ── DÉPENSE ÉNERGÉTIQUE ───────────────────────────────────────── */}
        <div>
          <SectionDivider label="Dépense énergétique" />
          {macroResult ? (
            <TdeeWaterfall result={macroResult} />
          ) : (
            <div className="space-y-3 animate-pulse">
              {/* Stacked bar */}
              <div className="h-[8px] w-full rounded-full bg-white/[0.06]" />
              {/* 4-segment grid */}
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-2 w-10 rounded bg-white/[0.05]" />
                    <div className="h-4 w-12 rounded bg-white/[0.07]" />
                    <div className="h-2 w-8 rounded bg-white/[0.04]" />
                  </div>
                ))}
              </div>
              {/* TDEE total row */}
              <div className="flex justify-between pt-1 border-t border-white/[0.04]">
                <div className="h-2.5 w-16 rounded bg-white/[0.04]" />
                <div className="h-4 w-20 rounded bg-white/[0.06]" />
              </div>
            </div>
          )}
        </div>

        {/* ── TDEE ADAPTATIF ───────────────────────────────────────────── */}
        <div className={`border-[0.3px] rounded-xl p-4 space-y-3 transition-all ${
          tdeeAdaptiveActive
            ? 'bg-[#1f8a65]/08 border-[#1f8a65]/30'
            : 'bg-white/[0.03] border-white/[0.06]'
        }`}>

          {/* Header : titre + bouton Calculer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/40">
                TDEE adaptatif
                {tdeeDataSource === 'formula_proxy' && (
                  <span className="ml-2 text-amber-400">⚠ Proxy</span>
                )}
              </p>
              <button
                onClick={() => setOpenInfoModal("tdeeClientTruth")}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                aria-label="Ouvrir la documentation TDEE"
              >
                <Info size={11} />
              </button>
            </div>
            <button
              onClick={applyAdaptiveTdee}
              disabled={applyingAdaptive}
              className="text-[11px] font-bold text-[#1f8a65] hover:text-[#217356] disabled:opacity-50 transition-colors"
            >
              {applyingAdaptive ? 'Calcul…' : tdeeAdaptive != null ? 'Recalculer' : 'Calculer'}
            </button>
          </div>

          {tdeeAdaptive != null ? (
            <>
              {/* Valeur + confiance */}
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-[28px] font-black text-white leading-none tabular-nums">
                    {tdeeAdaptive.toLocaleString('fr-FR')}
                  </p>
                  <p className="text-[13px] text-white/40">kcal/jour</p>
                </div>
                {tdeeHistory[0]?.confidence && (
                  <div className={`inline-flex items-center rounded-lg border px-2 py-1 text-[10px] font-medium ${
                    getConfidenceTone(tdeeHistory[0].confidence).className
                  }`}>
                    {getConfidenceTone(tdeeHistory[0].confidence).label}
                    {typeof tdeeHistory[0].confidence_score === 'number' && (
                      <span className="ml-1 opacity-80">{tdeeHistory[0].confidence_score}/100</span>
                    )}
                  </div>
                )}
                {macroResult?.tdee != null && (
                  <p className={`text-[11px] font-semibold ml-auto ${
                    tdeeAdaptive - macroResult.tdee > 0 ? 'text-[#1f8a65]' : 'text-amber-400'
                  }`}>
                    {tdeeAdaptive - macroResult.tdee > 0 ? '↑' : '↓'}{' '}
                    {tdeeAdaptive - macroResult.tdee > 0 ? '+' : ''}{tdeeAdaptive - macroResult.tdee} vs formule
                  </p>
                )}
              </div>

              {tdeeAdaptiveLower != null && tdeeAdaptiveUpper != null && (
                <p className="text-[10px] text-white/35">
                  Plage d’incertitude : {tdeeAdaptiveLower.toLocaleString('fr-FR')}–{tdeeAdaptiveUpper.toLocaleString('fr-FR')} kcal/jour
                </p>
              )}

              {daysSinceProtocolStart !== null && daysSinceProtocolStart < 14 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 flex items-start gap-2">
                  <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={14} />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-amber-200 leading-tight">
                      Calibrage en cours (Jour {daysSinceProtocolStart})
                    </p>
                    <p className="text-[9px] leading-relaxed text-amber-100/70">
                      Ce protocole a démarré il y a moins de 14 jours. Les variations de poids initiales (eau/glycogène) peuvent temporairement fausser la pente de calcul. Il est recommandé de surveiller ce TDEE sans l'appliquer immédiatement.
                    </p>
                  </div>
                </div>
              )}


              {(tdeeLastSuccessAt ?? tdeeAdaptiveAt) && (
                <p className="text-[10px] text-white/30">
                  Mis à jour le {formatLongFrenchDate(tdeeLastSuccessAt ?? tdeeAdaptiveAt!)}
                </p>
              )}

              {(tdeeStabilityStatus || tdeeLastSuccessAt || tdeeLastSkipReason) && (
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className={`rounded-lg border px-2 py-1 ${getTdeeEstimationStatusClassName(tdeeEstimationStatus)}`}>
                    {getTdeeEstimationStatusLabel(tdeeEstimationStatus)}
                    {tdeeDataQualityScore != null && ` · ${tdeeDataQualityScore}/100`}
                  </span>
                  {tdeeStabilityStatus && (
                    <span
                      className={`rounded-lg border px-2 py-1 ${
                        tdeeStabilityStatus === 'stable'
                          ? 'border-[#1f8a65]/25 bg-[#1f8a65]/10 text-[#7fe0b8]'
                          : tdeeStabilityStatus === 'watch'
                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                            : 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                      }`}
                    >
                      {tdeeStabilityStatus === 'stable'
                        ? 'Stable'
                        : tdeeStabilityStatus === 'watch'
                          ? 'Sous surveillance'
                          : 'Ajustement validé'}
                    </span>
                  )}
                  {tdeeLastSuccessAt && (
                    <span className="text-white/25">
                      Dernier calcul utile {formatLongFrenchDate(tdeeLastSuccessAt)}
                    </span>
                  )}
                </div>
              )}

              {/* Toggle — utiliser comme source de vérité */}
              <button
                onClick={() => onTdeeAdaptiveActiveToggle(!tdeeAdaptiveActive)}
                className={`flex items-center justify-between w-full rounded-xl px-3 py-2.5 transition-all border ${
                  tdeeAdaptiveActive
                    ? 'bg-[#1f8a65]/15 border-[#1f8a65]/30'
                    : 'bg-white/[0.03] border-white/[0.06]'
                }`}
              >
                <div className="text-left">
                  <p className={`text-[10px] font-bold ${tdeeAdaptiveActive ? 'text-[#1f8a65]' : 'text-white/50'}`}>
                    {tdeeAdaptiveActive ? 'TDEE client actif — source de vérité' : 'Utiliser comme base de calcul'}
                  </p>
                  <p className="text-[9px] text-white/25 mt-0.5">
                    {tdeeAdaptiveActive
                      ? 'Macros et déficit pilotés par le TDEE client stabilisé'
                      : 'Remplace le TDEE estimé dans tous les calculs'}
                  </p>
                </div>
                <div className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ml-3 ${
                  tdeeAdaptiveActive ? 'bg-[#1f8a65]' : 'bg-white/[0.12]'
                }`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                    tdeeAdaptiveActive ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </div>
              </button>

              {/* Données du calcul — KPIs */}
              {tdeeHistory[0] && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04]">
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-[0.1em] font-bold mb-0.5">Calories moy.</p>
                    <p className="text-[11px] font-bold text-white tabular-nums">{tdeeHistory[0].avg_intake_kcal} kcal</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-[0.1em] font-bold mb-0.5">Δ poids</p>
                    <p className={`text-[11px] font-bold tabular-nums ${Number(tdeeHistory[0].weight_delta_kg) > 0 ? 'text-amber-400' : 'text-[#1f8a65]'}`}>
                      {Number(tdeeHistory[0].weight_delta_kg) > 0 ? '+' : ''}{Number(tdeeHistory[0].weight_delta_kg).toFixed(2)} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-[0.1em] font-bold mb-0.5">Pesées</p>
                    <p className="text-[11px] font-bold text-white tabular-nums">{tdeeHistory[0].weight_samples}</p>
                  </div>
                </div>
              )}

              {/* Accordéon — Comprendre ce résultat */}
              {tdeeHistory[0] && (
                <details className="group">
                  <summary className="text-[10px] text-white/40 cursor-pointer hover:text-white/60 transition-colors list-none flex items-center gap-1">
                    <span className="group-open:hidden">▶</span>
                    <span className="hidden group-open:inline">▼</span>
                    Comprendre ce résultat
                  </summary>
                  <div className="mt-3 space-y-3">

                    {/* Formule */}
                    <div className="bg-white/[0.03] rounded-xl p-3 space-y-1.5">
                      <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold">Comment c'est calculé</p>
                      <p className="text-[10px] text-white/50 leading-relaxed">
                        Pente robuste (médiane de Theil–Sen) :
                      </p>
                      <p className="text-[10px] font-mono text-white/60 bg-white/[0.04] rounded-lg px-2 py-1.5">
                        TDEE = apport moyen − (pente de poids × 7700)
                      </p>
                      <p className="text-[10px] text-white/40 leading-relaxed">
                        {tdeeHistory[0].avg_intake_kcal} kcal/j − (pente de poids × 7700)
                        {' '}= <span className="text-white font-bold">{tdeeAdaptive} kcal</span>
                      </p>
                      <p className="text-[9px] text-white/25 leading-relaxed mt-1">
                        Si le poids baisse → le corps brûle plus que l'apport → TDEE plus élevé.
                        Si le poids monte → le corps brûle moins → TDEE plus bas.
                      </p>
                    </div>

                    {/* Facteurs de confiance */}
                    {tdeeHistory[0].confidence_reasons && (tdeeHistory[0].confidence_reasons as string[]).length > 0 && (
                      <div className="bg-white/[0.03] rounded-xl p-3 space-y-2">
                        <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold">Facteurs de confiance</p>
                        {(tdeeHistory[0].confidence_reasons as string[]).map((reason: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-white/20 text-[10px] mt-0.5 shrink-0">·</span>
                            <p className="text-[10px] text-white/45 leading-relaxed">{reason}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {tdeeDataQualityReasons.length > 0 && (
                      <div className="bg-white/[0.03] rounded-xl p-3 space-y-2">
                        <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold">Qualité de la collecte</p>
                        {tdeeDataQualityReasons.map((reason, index) => (
                          <div key={`${reason}-${index}`} className="flex items-start gap-2">
                            <span className="text-white/20 text-[10px] mt-0.5 shrink-0">·</span>
                            <p className="text-[10px] text-white/45 leading-relaxed">{reason}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommandations */}
                    <div className="bg-white/[0.03] rounded-xl p-3 space-y-2">
                      <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold">Pour améliorer la précision</p>
                      {tdeeHistory[0].weight_samples < 6 && (
                        <div className="flex items-start gap-2">
                          <span className="text-amber-400/60 text-[10px] mt-0.5 shrink-0">→</span>
                          <p className="text-[10px] text-white/40 leading-relaxed">
                            Pesée quotidienne au réveil — plus il y a de points, plus la tendance est fiable.
                          </p>
                        </div>
                      )}
                      {tdeeHistory[0].calories_source === 'protocol' && (
                        <div className="flex items-start gap-2">
                          <span className="text-amber-400/60 text-[10px] mt-0.5 shrink-0">→</span>
                          <p className="text-[10px] text-white/40 leading-relaxed">
                            Logger les repas dans l'app — le calcul utilisera les vraies calories consommées.
                          </p>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <span className="text-[#1f8a65]/60 text-[10px] mt-0.5 shrink-0">→</span>
                        <p className="text-[10px] text-white/40 leading-relaxed">
                          Recalcul recommandé toutes les 2–3 semaines en phase de cut, toutes les 4 semaines en maintenance ou prise de masse.
                        </p>
                      </div>
                    </div>

                    {/* Historique */}
                    {tdeeHistory.length > 1 && (
                      <div className="space-y-1.5">
                        <p className="text-[9px] text-white/25 uppercase tracking-[0.1em] font-bold">Historique ({tdeeHistory.length} calculs)</p>
                        {tdeeHistory.map(h => (
                          <div key={h.id} className="flex items-center justify-between text-[10px] text-white/40">
                            <span>{formatLongFrenchDate(new Date(h.calculated_at))}</span>
                            <span className="tabular-nums">{h.tdee_formula} → {h.tdee_adaptive} kcal</span>
                            <span className={h.delta_kcal > 0 ? 'text-[#1f8a65]' : 'text-amber-400'}>
                              {h.delta_kcal > 0 ? '+' : ''}{h.delta_kcal}
                            </span>
                            <span className="text-white/20">
                              {h.confidence === 'high' ? 'haut' : h.confidence === 'medium' ? 'moy' : 'bas'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] ${getTdeeEstimationStatusClassName(tdeeEstimationStatus)}`}>
                {getTdeeEstimationStatusLabel(tdeeEstimationStatus)}
                {tdeeDataQualityScore != null && ` · ${tdeeDataQualityScore}/100`}
              </span>
              <p className="text-[11px] text-white/30 leading-relaxed">
                {tdeeEstimationStatus === 'collecting'
                  ? 'Le moteur enregistre les signaux client, sans encore promouvoir de TDEE de référence.'
                  : 'Une estimation est observée en shadow mode ; elle ne peut pas encore modifier le protocole.'}
              </p>
              {tdeeObserved != null && (
                <p className="text-[11px] text-white/55">
                  Estimation observée : <span className="font-bold text-white">{tdeeObserved.toLocaleString('fr-FR')} kcal/jour</span>
                  {tdeeObservedLower != null && tdeeObservedUpper != null && ` · plage ${tdeeObservedLower.toLocaleString('fr-FR')}–${tdeeObservedUpper.toLocaleString('fr-FR')}`}
                </p>
              )}
              {tdeeEstimationStatus === 'actionable' && tdeeAdaptive == null && (
                <p className="text-[10px] text-white/35">
                  Validation {Math.min(tdeeActionableStreak, 2)}/2 : une seconde fenêtre exploitable est requise avant toute promotion.
                </p>
              )}
            </div>
          )}

          {tdeeError && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <p className="text-[10px] leading-relaxed text-amber-200">{tdeeError}</p>
            </div>
          )}

          {!tdeeError && tdeeLastSkipReason && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <p className="text-[10px] leading-relaxed text-white/45">
                Calcul automatique en attente : {formatTdeeSkipReason(tdeeLastSkipReason)}.
              </p>
            </div>
          )}

          {/* Toggle suivi client automatique */}
          <button
            onClick={() => onTdeeAutoToggle(!tdeeAutoEnabled)}
            className={`flex items-center justify-between w-full rounded-xl px-3 py-2 transition-all border ${
              tdeeAutoEnabled
                ? 'bg-[#1f8a65]/08 border-[#1f8a65]/20'
                : 'bg-white/[0.02] border-white/[0.04]'
            }`}
          >
            <p className={`text-[9px] font-bold ${tdeeAutoEnabled ? 'text-[#1f8a65]' : 'text-white/30'}`}>
              {tdeeAutoEnabled ? 'Suivi TDEE client actif · quotidien' : 'Suivi TDEE client · désactivé'}
            </p>
            <div className={`relative w-7 h-3.5 rounded-full transition-colors shrink-0 ml-3 ${
              tdeeAutoEnabled ? 'bg-[#1f8a65]' : 'bg-white/[0.10]'
            }`}>
              <div className={`absolute top-[2px] w-2.5 h-2.5 rounded-full bg-white transition-all ${
                tdeeAutoEnabled ? 'left-[15px]' : 'left-[2px]'
              }`} />
            </div>
          </button>
        </div>

        {/* ── PHASE ACTIVE ─────────────────────────────────────────────── */}
        <div>
          <SectionDivider label="Phase active" />
          <div className="rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.03] p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <SelectInput
                value={transformationPhase}
                options={TRANSFORMATION_PHASE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onChange={onTransformationPhaseChange}
                className="min-w-[180px]"
              />
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-white/65">
                Direction nutrition: {macroGoalLabel}
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-white/45">
              {getTransformationPhaseLabel(transformationPhase)} active. Cette phase pilote la direction nutritionnelle,
              puis le moteur applique les formules de {transformationPhaseToMacroGoal(transformationPhase)} avec les ajustements adaptes.
            </p>
            {phaseProtocolPreview && (
              <div className="mt-3 rounded-xl border border-[#1f8a65]/25 bg-[#1f8a65]/[0.07] p-3">
                <p className="text-[10px] font-semibold text-white/90">Synchronisation du plan prête</p>
                <p className="mt-1 text-[10px] leading-relaxed text-white/55">
                  {phaseProtocolPreview.changedDays} journée{phaseProtocolPreview.changedDays > 1 ? 's' : ''} type et {phaseProtocolPreview.changedMealPlans} plan{phaseProtocolPreview.changedMealPlans > 1 ? 's' : ''} alimentaire{phaseProtocolPreview.changedMealPlans > 1 ? 's' : ''} seront recalibrés en conservant les écarts entre jours, les portions fixes et les limites définies par le coach. Ensuite, enregistre le protocole pour conserver ces changements.
                </p>
                {phaseProtocolPreview.warnings.length > 0 && <p className="mt-1 text-[9px] text-amber-200/80">{phaseProtocolPreview.warnings[0]}</p>}
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={onApplyPhaseProtocolPreview} className="rounded-lg bg-[#1f8a65] px-2.5 py-1.5 text-[9px] font-bold text-white">Appliquer au plan</button>
                  <button type="button" onClick={onDismissPhaseProtocolPreview} className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[9px] font-semibold text-white/60">Conserver tel quel</button>
                </div>
              </div>
            )}
          </div>

          {macroResult && (
            <div className="mt-3">
              <CalorieAdjustmentDisplay
                value={displayCaloriePct}
                baseCalories={goalCalories}
                targetCalories={macroResult.calories}
                onChange={onCalorieAdjustChange}
                readOnly={anyMacroOverride}
              />
            </div>
          )}
        </div>

        {/* ── MACROS ───────────────────────────────────────────────────── */}
        <div>
          <SectionDivider label="Macronutriments" />
          {macroResult ? (
            <MacroSliders
              calcProtein={macroResult.macros.p}
              calcFat={macroResult.macros.f}
              calcCarbs={macroResult.macros.c}
              overrides={macroOverrides}
              onOverridesChange={onMacroOverridesChange}
              leanMass={leanMass}
              bodyWeight={bodyWeight}
              tdee={macroResult.tdee}
            />
          ) : (
            <div className="space-y-4 animate-pulse">
              <div className="h-7 w-28 rounded bg-white/[0.06]" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/[0.08] shrink-0" />
                    <div className="w-16 h-2.5 rounded bg-white/[0.05]" />
                    <div className="w-10 h-2.5 rounded bg-white/[0.06]" />
                    <div className="w-8 h-2.5 rounded bg-white/[0.04]" />
                  </div>
                  <div className="ml-3.5 h-1.5 w-full rounded-full bg-white/[0.06]" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── HYDRATATION ──────────────────────────────────────────────── */}
        <div>
          <SectionDivider label="Hydratation" />

          {/* Climat */}
          <div className="flex items-center gap-2 mb-4">
            <SelectInput<HydrationClimate>
              value={hydrationClimate}
              options={CLIMATE_OPTIONS}
              onChange={onHydrationClimateChange}
            />
          </div>

          {/* Phase d'hydratation — slider continu */}
          <div className="space-y-3">
            {/* Label phase + valeur résultante */}
            <div className="flex items-center justify-between">
              <span
                className="text-[11px] font-semibold"
                style={{ color: getPhaseColor(hydrationPhase) }}
              >
                {getPhaseLabel(hydrationPhase)}
              </span>
              {hydrationLiters && (
                <div className="flex items-center gap-1.5">
                  <Droplets size={12} className="text-blue-400 shrink-0" />
                  <span className="text-[15px] font-bold text-white">
                    {hydrationLiters.toFixed(1)}
                  </span>
                  <span className="text-[11px] text-white/40">L</span>
                  <span className="text-[10px] text-white/30 ml-1">
                    · {Math.round(hydrationLiters * 4)} verres
                  </span>
                </div>
              )}
            </div>

            {/* Description courte de la phase */}
            <p className="text-[10px] text-white/40 leading-relaxed">
              {getPhaseDescription(hydrationPhase)}
            </p>

            {/* Slider continu 0–200 */}
            <div className="relative">
              <style>{`
              .hydration-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: var(--thumb-color);
                cursor: pointer;
                border: 2px solid rgba(255,255,255,0.15);
                box-shadow: 0 0 0 3px rgba(0,0,0,0.3);
                transition: transform 0.1s ease;
              }
              .hydration-slider::-moz-range-thumb {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: var(--thumb-color);
                cursor: pointer;
                border: 2px solid rgba(255,255,255,0.15);
                box-shadow: 0 0 0 3px rgba(0,0,0,0.3);
              }
              .hydration-slider:active::-webkit-slider-thumb {
                transform: scale(1.2);
              }
            `}</style>
              <input
                type="range"
                min={40}
                max={200}
                step={1}
                value={hydrationPhase}
                onChange={(e) => onHydrationPhaseChange(Number(e.target.value))}
                className="hydration-slider w-full h-1.5 rounded-full outline-none appearance-none cursor-pointer"
                style={
                  {
                    "--thumb-color": getPhaseColor(hydrationPhase),
                    background: `linear-gradient(to right, ${getPhaseColor(hydrationPhase)} 0%, ${getPhaseColor(hydrationPhase)} ${((hydrationPhase - 40) / 160) * 100}%, rgba(255,255,255,0.06) ${((hydrationPhase - 40) / 160) * 100}%, rgba(255,255,255,0.06) 100%)`,
                  } as React.CSSProperties
                }
              />
              {/* Marqueurs indicatifs non-magnétiques */}
              <div className="relative mt-2 h-4">
                {PHASE_MARKERS.map((m, i) => {
                  const pct = ((m.value - 40) / 160) * 100;
                  const isFirst = i === 0;
                  const isLast = i === PHASE_MARKERS.length - 1;
                  const transform = isFirst
                    ? "translateX(0%)"
                    : isLast
                      ? "translateX(-100%)"
                      : "translateX(-50%)";
                  const align = isFirst
                    ? "items-start"
                    : isLast
                      ? "items-end"
                      : "items-center";
                  return (
                    <div
                      key={m.value}
                      className={`absolute flex flex-col ${align}`}
                      style={{ left: `${pct}%`, transform }}
                    >
                      <div className="w-px h-1.5 bg-white/[0.15]" />
                      <span className="text-[8px] text-white/30 whitespace-nowrap mt-0.5">
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Indicateur % baseline */}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/25">
                Base EFSA × {(hydrationPhase / 100).toFixed(2)}
              </span>
              <span
                className={`font-semibold ${hydrationPhase < 80 ? "text-amber-400" : hydrationPhase > 150 ? "text-blue-400" : "text-white/50"}`}
              >
                {hydrationPhase < 100 ? "" : "+"}
                {hydrationPhase - 100}%
              </span>
            </div>
          </div>
        </div>

        {/* ── CYCLE SYNC ───────────────────────────────────────────────── */}
        {isFemale && (
          <div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SectionDivider label="Cycle Sync (femme)" />
              </div>
              <CoachDocLinkButton href="/coach/documentation/cycle-sync" label="Guide Cycle Sync" />
            </div>

            {/* Toggle — same style as Carb Cycling */}
            <div className="flex gap-1.5 mb-3 flex-wrap">
              <button
                onClick={() => onCycleSyncEnabledChange?.(false)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  !cycleSyncEnabled
                    ? 'bg-[#1f8a65]/15 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30'
                    : 'bg-white/[0.04] text-white/50 border-[0.3px] border-white/[0.06] hover:text-white/70'
                }`}
              >
                Désactivé
              </button>
              <button
                onClick={() => onCycleSyncEnabledChange?.(true)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  cycleSyncEnabled
                    ? 'bg-[#a855f7]/10 text-[#a855f7] border-[0.3px] border-[#a855f7]/30'
                    : 'bg-white/[0.04] text-white/50 border-[0.3px] border-white/[0.06] hover:text-white/70'
                }`}
              >
                Activé — Ajustement auto
              </button>
            </div>

            {cycleSyncEnabled && (
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" />
                <p className="text-[9px] text-[#a855f7]/80 uppercase tracking-[0.14em] font-semibold">
                  Actif — appliqué automatiquement à la cliente
                </p>
              </div>
            )}

            {cycleSyncEnabled && (
              <div className="mb-3 rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.025] p-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">Intensité d’ajustement</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {([
                    ['conservative', 'Prudent'],
                    ['standard', 'Standard'],
                    ['custom', 'Personnalisé'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onCycleSyncProfileChange?.({
                        mode,
                        intensity_percent: mode === 'conservative' ? 50 : mode === 'standard' ? 100 : cycleSyncProfile.intensity_percent,
                      })}
                      className={`rounded-lg px-2 py-1 text-[9px] font-medium transition-colors ${
                        cycleSyncProfile.mode === mode
                          ? 'bg-[#a855f7]/15 text-[#d8b4fe]'
                          : 'bg-white/[0.04] text-white/45 hover:text-white/70'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {cycleSyncProfile.mode === 'custom' && (
                  <label className="mt-2 flex items-center justify-between gap-3 text-[9px] text-white/45">
                    Intensité
                    <input
                      type="number"
                      min={25}
                      max={125}
                      value={cycleSyncProfile.intensity_percent}
                      onChange={(event) => onCycleSyncProfileChange?.({
                        mode: 'custom',
                        intensity_percent: Math.min(125, Math.max(25, Number(event.target.value) || 25)),
                      })}
                      className="h-7 w-16 rounded-md border-[0.3px] border-white/[0.08] bg-white/[0.04] px-2 text-right text-[10px] text-white outline-none"
                    />
                  </label>
                )}
                <p className="mt-2 text-[9px] leading-relaxed text-white/35">La confiance des dates de règles limite toujours l’automatisation, même avec un profil personnalisé.</p>
              </div>
            )}

            {cycleSyncEnabled && (
              <>
                <CycleSyncPhaseGrid
                  baseMacros={baseMacrosForCycleSync}
                  currentCycleDay={currentCycleDay}
                />
                <div className="mt-3 space-y-2">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
                    Cycle menstruel de la cliente
                  </p>
                  {!cycleState ? (
                    <div className="rounded-xl bg-amber-500/[0.06] border-[0.3px] border-amber-500/20 p-3">
                      <p className="text-[10px] text-amber-400/80">Données de cycle non disponibles.</p>
                    </div>
                  ) : !cycleState.hasActiveCycle ? (
                    <p className="text-[11px] text-white/30">Ménopause / aménorrhée — Cycle sync désactivé.</p>
                  ) : (
                    <div className="rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] p-3 space-y-3">
                      {cycleState.currentPhase && cycleState.currentCycleDay ? (
                        <div className="flex items-center justify-between">
                          <CyclePhasePill
                            phase={cycleState.currentPhase}
                            cycleDay={cycleState.currentCycleDay}
                            confidence={cycleState.confidence}
                            size="md"
                          />
                          {cycleState.nextPhaseIn != null && (
                            <span className="text-[10px] text-white/30">
                              Phase suivante dans {cycleState.nextPhaseIn}j
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-amber-500/[0.06] border-[0.3px] border-amber-500/20 p-3 space-y-1">
                          <p className="text-[10px] text-amber-400/80 font-medium">Aucun log de cycle disponible.</p>
                          <p className="text-[10px] text-white/40 leading-relaxed">La cliente doit renseigner son cycle depuis l&apos;app → <span className="text-white/60">Profil → Mon Cycle</span>.</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] text-white/30 mb-0.5">Cycle moyen</p>
                          <p className="text-[13px] font-mono text-white/70">{cycleState.avgCycleLengthDays}j</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-white/30 mb-0.5">Précision</p>
                          <p className="text-[11px] text-white/60">
                            {cycleState.confidence === 'calibrated' ? '● Calibré' : cycleState.confidence === 'learning' ? '◑ En cours' : '◐ Estimé'}
                            {' '}({cycleState.logsCount} cycle{cycleState.logsCount !== 1 ? 's' : ''})
                          </p>
                        </div>
                      </div>
                      {cycleState.currentPhase && (() => {
                        const observation = cyclePhaseObservations.find((item) => item.phase === cycleState.currentPhase)
                        if (!observation || observation.samples === 0) return null
                        return (
                          <div className="border-t border-white/[0.06] pt-2">
                            <p className="text-[9px] text-white/30 uppercase tracking-[0.12em]">Observations de cette phase</p>
                            <p className="mt-1 text-[10px] text-white/50">
                              {observation.samples} check-in{observation.samples > 1 ? 's' : ''} · énergie {observation.energyAverage ?? '—'}/5 · faim {observation.hungerAverage ?? '—'}/4
                            </p>
                            <p className="mt-1 text-[9px] text-white/30">Indication coach uniquement : ces données ne modifient jamais le plan sans décision explicite.</p>
                          </div>
                        )
                      })()}
                      {cycleState.currentPhase && (() => {
                        const effective = getEffectiveCycleSyncAdjustment({
                          adjustment: getCycleSyncAdjustment(cycleState.currentPhase!),
                          cycleState,
                          profile: cycleSyncProfile,
                        })
                        const adj = effective.adjustment
                        if (!adj.caloriesDelta && !adj.proteinDelta && !adj.carbsDelta) return null
                        return (
                          <div className="border-t border-white/[0.06] pt-2 space-y-1">
                            <p className="text-[9px] text-white/30 uppercase tracking-[0.12em]">Ajustements réellement appliqués</p>
                            {adj.caloriesDelta !== 0 && <p className="text-[11px] text-white/50">{adj.caloriesDelta > 0 ? '+' : ''}{adj.caloriesDelta} kcal/j</p>}
                            {adj.proteinDelta !== 0 && <p className="text-[11px] text-white/50">{adj.proteinDelta > 0 ? '+' : ''}{adj.proteinDelta}g protéines</p>}
                            {adj.carbsDelta !== 0 && <p className="text-[11px] text-white/50">{adj.carbsDelta > 0 ? '+' : ''}{adj.carbsDelta}g glucides</p>}
                            {effective.isCautious && <p className="text-[9px] text-amber-200/75">Application réduite par le profil choisi ou la fiabilité actuelle du cycle.</p>}
                            <p className="text-[10px] text-white/35 leading-relaxed">{adj.notes[0]}</p>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SMART ALERTS ─────────────────────────────────────────────── */}
        {actionableSuggestions.length > 0 && (
          <div>
            <SectionDivider label="Smart Alerts" />
            <div className="space-y-2">
              {actionableSuggestions.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-xl p-3 border-[0.3px] ${
                    s.priority === "critical"
                      ? "bg-red-500/[0.08] border-red-500/20"
                      : "bg-amber-500/[0.08] border-amber-500/20"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {PRIORITY_ICON[s.priority as keyof typeof PRIORITY_ICON]}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white/85 leading-snug">
                        {s.title}
                      </p>
                      <p className="text-[10px] text-white/45 mt-0.5 leading-relaxed">
                        {s.rationale}
                      </p>
                      {(s.id === "data_quality_low" || s.id === "data_quality_medium") &&
                        dataQualityIssues.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {dataQualityIssues.slice(0, 3).map((issue) => {
                              const missingKey = signalToMissingDataKey(issue.key);
                              return (
                                <div
                                  key={`${s.id}-${issue.key}`}
                                  className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2"
                                >
                                  <p className="text-[10px] font-medium text-white/80">
                                    {issue.summary}
                                  </p>
                                  <p className="mt-1 text-[10px] text-white/45 leading-relaxed">
                                    {issue.action}
                                  </p>
                                  {missingKey && onResolveSignal && (
                                    <button
                                      onClick={() => onResolveSignal(missingKey)}
                                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                                    >
                                      <Wrench size={11} />
                                      Corriger cette donnée
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      {s.source && (
                        <p className="text-[9px] text-white/25 mt-0.5 italic">
                          {s.source}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info modals */}
        {openInfoModal &&
          INJECTION_INFO_MODALS[
            openInfoModal as keyof typeof INJECTION_INFO_MODALS
          ] && (
            <InfoModal
              isOpen={true}
              title={
                INJECTION_INFO_MODALS[
                  openInfoModal as keyof typeof INJECTION_INFO_MODALS
                ].title
              }
              description={
                INJECTION_INFO_MODALS[
                  openInfoModal as keyof typeof INJECTION_INFO_MODALS
                ].description
              }
              example={
                INJECTION_INFO_MODALS[
                  openInfoModal as keyof typeof INJECTION_INFO_MODALS
                ].example
              }
              whenToUse={
                INJECTION_INFO_MODALS[
                  openInfoModal as keyof typeof INJECTION_INFO_MODALS
                ].whenToUse
              }
              tabs={
                INJECTION_INFO_MODALS[
                  openInfoModal as keyof typeof INJECTION_INFO_MODALS
                ].tabs
              }
              docLink={openInfoModal === 'tdeeClientTruth' ? '/coach/documentation/adaptive-tdee' : undefined}
              onClose={() => setOpenInfoModal(null)}
            />
          )}
      </div>
      {/* end scrollable */}
    </div>
  );
}
