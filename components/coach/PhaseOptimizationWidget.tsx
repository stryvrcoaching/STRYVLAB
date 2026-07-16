"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPhaseEngineCopy,
  type PhaseEngineLocale,
} from "@/lib/coach/phaseEngine/localeCopy";
import type { PhaseHistoryPoint } from "@/lib/coach/phaseEngine/history";
import type {
  PhaseOptimizationResult,
  EnergeticDirection,
  AdaptiveState,
  CoachPhasePreferences,
  PhaseCoachDecision,
} from "@/lib/coach/phaseEngine/types";
import PhaseStatusAlert from "@/components/coach/phase-optimization/PhaseStatusAlert";
import PhaseInsightCard from "@/components/coach/phase-optimization/PhaseInsightCard";
import PhaseFooterMetricCard from "@/components/coach/phase-optimization/PhaseFooterMetricCard";
import PhaseCollapsibleSection from "@/components/coach/phase-optimization/PhaseCollapsibleSection";
import StryvrRangeSlider from "@/components/coach/phase-optimization/StryvrRangeSlider";
import CoachDocLinkButton from "@/components/coach/docs/CoachDocLinkButton";
import type { PhaseFooterMetricCards } from "@/lib/coach/phaseEngine/footerMetrics";
import { Flame } from "lucide-react";

const URGENCY_COLORS: Record<string, string> = {
  low: "rgba(255,255,255,0.45)",
  medium: "#f59e0b",
  high: "#ef4444",
};

function dataQualityColor(level: string): string {
  const map: Record<string, string> = {
    minimal: "rgba(239,68,68,0.75)",
    limited: "rgba(245,158,11,0.75)",
    good: "rgba(255,255,255,0.45)",
    high: "rgba(31,138,101,0.85)",
  };
  return map[level] ?? "rgba(255,255,255,0.4)";
}

const DIRECTION_OPTIONS: EnergeticDirection[] = [
  "aggressive_deficit",
  "controlled_deficit",
  "maintenance",
  "controlled_surplus",
  "aggressive_surplus",
];

const ADAPTIVE_OPTIONS: AdaptiveState[] = [
  "recovery_crash",
  "systemic_fatigue",
  "high_fatigue",
  "stable",
  "recovered",
  "supercompensated",
];

function WindowToggle({
  value,
  onChange,
}: {
  value: 7 | 30;
  onChange: (v: 7 | 30) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-0.5">
      {([7, 30] as const).map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
            value === w
              ? "bg-white/[0.08] text-white"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          {w}j
        </button>
      ))}
    </div>
  );
}



function PhasePreferencesPanel({
  clientId,
  locale,
  prefs,
  derivedPrefs,
  hasCustom,
  onSaved,
}: {
  clientId: string;
  locale: PhaseEngineLocale;
  prefs: CoachPhasePreferences;
  derivedPrefs: CoachPhasePreferences;
  hasCustom: boolean;
  onSaved: () => void;
}) {
  const ui = getPhaseEngineCopy(locale).widgetUi;
  const [prioritizePerformance, setPrioritizePerformance] = useState(
    prefs.prioritizePerformance,
  );
  const [aggressiveCutTolerance, setAggressiveCutTolerance] = useState(
    prefs.aggressiveCutTolerance,
  );
  const [preferredBulkAggressiveness, setPreferredBulkAggressiveness] =
    useState(prefs.preferredBulkAggressiveness);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrioritizePerformance(prefs.prioritizePerformance);
    setAggressiveCutTolerance(prefs.aggressiveCutTolerance);
    setPreferredBulkAggressiveness(prefs.preferredBulkAggressiveness);
  }, [prefs]);

  async function save(clear = false) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/phase-optimization/override`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phasePreferences: clear
              ? null
              : {
                  prioritizePerformance,
                  aggressiveCutTolerance,
                  preferredBulkAggressiveness,
                },
          }),
        },
      );
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError(ui.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] leading-relaxed text-white/40">
        {ui.phasePrefsHint}
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/55">
        <input
          type="checkbox"
          checked={prioritizePerformance}
          onChange={(e) => setPrioritizePerformance(e.target.checked)}
          className="rounded border-white/20"
        />
        {ui.prioritizePerformance}
      </label>
      <StryvrRangeSlider
        label={ui.aggressiveCutTolerance}
        value={aggressiveCutTolerance}
        onChange={setAggressiveCutTolerance}
      />
      <StryvrRangeSlider
        label={ui.preferredBulkAggressiveness}
        value={preferredBulkAggressiveness}
        onChange={setPreferredBulkAggressiveness}
        accentColor="#5eead4"
      />
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(false)}
          className="flex-1 rounded-lg border border-[#1f8a65]/30 bg-[#1f8a65]/20 py-1.5 text-[10px] font-medium text-[#5eead4] disabled:opacity-50"
        >
          {saving ? ui.saving : ui.save}
        </button>
        {hasCustom && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setPrioritizePerformance(derivedPrefs.prioritizePerformance);
              setAggressiveCutTolerance(derivedPrefs.aggressiveCutTolerance);
              setPreferredBulkAggressiveness(
                derivedPrefs.preferredBulkAggressiveness,
              );
              save(true);
            }}
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[10px] text-white/45"
          >
            {ui.resetPrefsToGoal}
          </button>
        )}
      </div>
    </div>
  );
}

function ManualOverridePanel({
  clientId,
  locale,
  manualOverride,
  onSaved,
}: {
  clientId: string;
  locale: PhaseEngineLocale;
  manualOverride: PhaseOptimizationResult["manualOverride"];
  onSaved: () => void;
}) {
  const copy = getPhaseEngineCopy(locale);
  const ui = copy.widgetUi;
  const [active, setActive] = useState(manualOverride?.active ?? false);
  const [direction, setDirection] = useState<EnergeticDirection | "">(
    manualOverride?.direction ?? "",
  );
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState | "">(
    manualOverride?.adaptiveState ?? "",
  );
  const [reason, setReason] = useState(manualOverride?.reason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActive(manualOverride?.active ?? false);
    setDirection(manualOverride?.direction ?? "");
    setAdaptiveState(manualOverride?.adaptiveState ?? "");
    setReason(manualOverride?.reason ?? "");
  }, [manualOverride]);

  async function save(clear = false) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/phase-optimization/override`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phaseOverride: clear
              ? null
              : {
                  active,
                  direction: direction || undefined,
                  adaptiveState: adaptiveState || undefined,
                  reason: reason.trim() || undefined,
                },
          }),
        },
      );
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError(ui.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/55">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="rounded border-white/20"
        />
        {ui.forceRecommendation}
      </label>
      {active && (
        <>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as EnergeticDirection)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white/70 outline-none"
          >
            <option value="">{ui.directionOptional}</option>
            {DIRECTION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {copy.directionLabels[d]}
              </option>
            ))}
          </select>
          <select
            value={adaptiveState}
            onChange={(e) => setAdaptiveState(e.target.value as AdaptiveState)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white/70 outline-none"
          >
            <option value="">{ui.adaptiveOptional}</option>
            {ADAPTIVE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {copy.adaptiveStateLabels[s]}
              </option>
            ))}
          </select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={ui.reasonPlaceholder}
            rows={2}
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white/60 outline-none"
          />
        </>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(false)}
          className="flex-1 rounded-lg border border-[#1f8a65]/30 bg-[#1f8a65]/20 py-1.5 text-[10px] font-medium text-[#5eead4] disabled:opacity-50"
        >
          {saving ? ui.saving : ui.save}
        </button>
        {manualOverride?.active && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save(true)}
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[10px] text-white/45"
          >
            {ui.reset}
          </button>
        )}
      </div>
    </div>
  );
}

type WidgetData = PhaseOptimizationResult & {
  metricCards: PhaseFooterMetricCards;
  windowDays?: number;
  trainingGoal?: string | null;
  clientProfile?: import("@/lib/coach/phaseEngine/types").PhaseClientProfile;
  historyTrail?: PhaseHistoryPoint[];
  locale?: PhaseEngineLocale;
  phasePreferences?: CoachPhasePreferences;
  derivedPhasePreferences?: CoachPhasePreferences;
  hasCustomPhasePreferences?: boolean;
  enginePrescription?: {
    optimalPhase: string;
    recommendedIntensity: string;
    vetoActive: boolean;
    clinicalReasoning: string;
  };
  coachDecision?: PhaseCoachDecision;
  insights?: {
    strategicPivot?: {
      id: string;
      type: string;
      status: string;
      title: string;
      description: string;
      impact?: string;
    };
  };
};

function hasMeaningfulPhaseData(data: WidgetData): boolean {
  if (data.analysisState === "insufficient_data") return false;
  const signals = data.derivedSignals;
  return Boolean(
    signals.weightTrend.observed ||
      signals.bodyFatTrend.observed ||
      Boolean(signals.waistTrend?.observed) ||
      signals.performanceTrend.observed ||
      signals.recoveryTrend.observed ||
      signals.nutritionAdherence.observed ||
      data.coachDecision?.baselines.rhr.current != null,
  );
}

function phaseBadgeExplanation(
  data: WidgetData,
  copy: ReturnType<typeof getPhaseEngineCopy>,
): string {
  if (data.insufficientData && !hasMeaningfulPhaseData(data)) {
    return data.analysisStateReason ?? "Aucune donnée exploitable sur la fenêtre sélectionnée.";
  }
  const decision = data.coachDecision;
  if (decision?.matrix.matchedConditions[0]) return decision.matrix.matchedConditions[0];
  if (decision?.watchouts[0]) return decision.watchouts[0];
  if (data.constraintFlags[0]) {
    return copy.reasonMap[data.constraintFlags[0]] ?? data.constraintFlags[0];
  }
  return decision?.matrix.summary ?? data.microCopy;
}

export function StrategicPivotAlert({ insight }: { insight: any }) {
  if (!insight || insight.type !== 'STRATEGIC_PIVOT') return null;

  return (
    <div className="relative mb-3 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
      
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/55">
          <Flame className="h-3.5 w-3.5 text-[#5eead4]" />
        </div>
        
        <div className="space-y-1">
          <h4 className="flex items-center gap-2 text-[13px] font-semibold text-white/82">
            {insight.title}
            <span className="rounded-full bg-[#1f8a65]/12 px-2 py-0.5 text-[10px] font-medium text-[#5eead4] border border-[#1f8a65]/20">
              Contrôlé
            </span>
          </h4>
          <p className="text-[11px] leading-relaxed text-white/52">
            {insight.description}
          </p>
          {insight.impact && (
            <p className="pt-1 text-[10px] text-white/36">
              <span className="text-white/26">Impact :</span> {insight.impact}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CoachDecisionPanel({ decision }: { decision: PhaseCoachDecision }) {
  const rhr = decision.baselines.rhr;
  const confidence = decision.confidenceModel;
  const rhrValue =
    rhr.current != null
      ? `${rhr.current} bpm${
          rhr.deviationPct != null
            ? ` (${rhr.deviationPct > 0 ? "+" : ""}${rhr.deviationPct}%)`
            : ""
        }`
      : "—";
  const confidenceTone =
    decision.matrix.status === "not_adapted"
      ? "bg-red-500/12 text-red-300"
      : decision.matrix.status === "partially_adapted"
        ? "bg-amber-500/15 text-amber-300"
        : confidence.level === "high"
          ? "bg-[#1f8a65]/15 text-[#5eead4]"
          : confidence.level === "moderate"
            ? "bg-amber-500/15 text-amber-300"
            : "bg-white/[0.08] text-white/55";
  const keySignals = [
    ...decision.matrix.matchedConditions.slice(0, 2),
    ...decision.primaryDrivers.slice(0, 2),
  ].slice(0, 3);
  const confidenceNoteRaw =
    confidence.limitations[0] ?? confidence.strengths[0] ?? null;
  const confidenceNote =
    confidenceNoteRaw?.includes("Baseline RHR") && rhr.baseline != null
      ? null
      : confidenceNoteRaw;
  const shortTermDays = decision.sevenDayTrajectory.days.slice(0, 3);
  const uniformShortTerm =
    shortTermDays.length > 0 &&
    shortTermDays.every(
      (day) =>
        day.focus === shortTermDays[0]?.focus &&
        day.intensityPct === shortTermDays[0]?.intensityPct,
    );

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
            Verdict coach
          </p>
          <p className="mt-1 text-[13px] font-semibold text-white/80">
            {decision.headline}
          </p>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${confidenceTone}`}>
          {confidence.scorePct}% fiable
        </span>
      </div>

      <div className="rounded-lg bg-white/[0.03] px-3 py-2">
        <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
          Verdict
        </p>
        <p className="mt-1 text-[12px] leading-snug text-white/65">
          {decision.matrix.summary}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-white/42">
          {decision.matrix.rationale}
        </p>
      </div>

      <div className="mt-2.5 grid gap-1.5 sm:grid-cols-3">
        <PhaseFooterMetricCard
          label="RHR"
          value={rhrValue}
          subtitle={
            rhr.status === "insufficient"
              ? "base en construction"
              : rhr.baseline != null
              ? `base ${rhr.baseline} · n=${rhr.sampleCount}`
              : `n=${rhr.sampleCount}`
          }
          zone={
            rhr.status === "overload"
              ? "poor"
              : rhr.status === "stable"
                ? "optimal"
                : null
          }
          zoneLabel={
            rhr.status === "overload"
              ? "Surcharge"
              : rhr.status === "stable"
                ? "Stable"
                : "En lecture"
          }
        />
        <PhaseFooterMetricCard
          label="Récupération"
          value={String(decision.baselines.recovery.capacityPct)}
          unit="%"
          subtitle={`fatigue ${decision.baselines.recovery.fatiguePct}%`}
          zone={
            decision.baselines.recovery.capacityPct >= 65
              ? "optimal"
              : decision.baselines.recovery.capacityPct >= 40
                ? "average"
                : "poor"
          }
        />
        <PhaseFooterMetricCard
          label="Performance"
          value={
            decision.baselines.performance.trendPct != null
              ? String(decision.baselines.performance.trendPct)
              : "—"
          }
          unit={
            decision.baselines.performance.trendPct != null ? "%" : undefined
          }
          subtitle={`${decision.baselines.performance.confidencePct}% confiance`}
          zone={metricZoneFromPct(decision.baselines.performance.trendPct)}
        />
      </div>

      {keySignals.length > 0 && (
        <div className="mt-2.5">
          <p className="mb-2 text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
            Points clés
          </p>
          <div className="flex flex-wrap gap-1.5">
            {keySignals.map((signal) => (
              <span
                key={signal}
                className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[9px] font-medium text-white/45"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2.5 grid gap-1.5 md:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
            Action conseillée
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/65">
            {decision.recommendation}
          </p>
          <p className="mt-1.5 text-[10px] text-white/38">
            {decision.temporal.summary}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
              7 prochains jours
            </p>
            <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white/35">
              {decision.sevenDayTrajectory.strategy.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-semibold text-white/70">
            {decision.sevenDayTrajectory.title}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-white/45">
            {decision.sevenDayTrajectory.summary}
          </p>
        </div>
      </div>

      <div className="mt-2.5 rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
            Prochains jours
          </p>
          {confidenceNote && (
            <span className="text-[9px] text-white/28">{confidenceNote}</span>
          )}
        </div>
        {uniformShortTerm ? (
          <div className="rounded-md bg-black/20 px-3 py-1.5">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
              Jours 1 à 3
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-tight text-white/62">
              {shortTermDays[0]?.focus}
            </p>
            <p className="mt-1 text-[9px] text-white/35">
              Intensité {shortTermDays[0]?.intensityPct}% sur les 3 prochains jours
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {shortTermDays.map((day) => (
              <div key={day.day} className="rounded-md bg-black/20 px-2 py-1.5">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
                  Jour {day.day}
                </p>
                <p className="mt-1 text-[10px] font-semibold leading-tight text-white/60">
                  {day.focus}
                </p>
                <p className="mt-1 text-[9px] text-white/35">
                  Intensité {day.intensityPct}%
                </p>
              </div>
            ))}
          </div>
        )}
          <p className="mt-1.5 text-[9px] leading-snug text-white/30">
          À valider : {decision.sevenDayTrajectory.days[0]?.exitCriteria.join(" · ")}
          </p>
      </div>

      {decision.watchouts.length > 0 && (
        <div className="mt-2 space-y-1">
          {decision.watchouts.map((watchout) => (
            <PhaseStatusAlert key={watchout} message={watchout} tone="medium" />
          ))}
        </div>
      )}
    </div>
  );
}

function metricZoneFromPct(
  value: number | null,
): "poor" | "average" | "optimal" | null {
  if (value == null) return null;
  if (value >= 65) return "optimal";
  if (value >= 40) return "average";
  return "poor";
}

function phaseMeterColor(t: number): string {
  if (t < 0.5) {
    const g = Math.round(t * 2 * 155);
    return `rgb(215,${g},35)`;
  }
  const r = Math.round(215 * (1 - (t - 0.5) * 2));
  return `rgb(${r},185,35)`;
}

const PHASE_TICK_COUNT = 62;

function PhaseConfidenceMeter({ score }: { score: number }) {
  const activeTicks = Math.round(
    (Math.max(0, Math.min(100, score)) / 100) * PHASE_TICK_COUNT,
  );

  return (
    <div className="w-full">
      <div className="flex items-end gap-[2.5px]" style={{ height: "44px" }}>
        {Array.from({ length: PHASE_TICK_COUNT }).map((_, i) => {
          const t = i / (PHASE_TICK_COUNT - 1);
          const active = i < activeTicks;
          const height = 18 + Math.round(Math.sin(t * Math.PI) * 12);

          return (
            <motion.div
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                height: `${height}px`,
                backgroundColor: active
                  ? phaseMeterColor(t)
                  : "rgba(255,255,255,0.07)",
                transformOrigin: "bottom",
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{
                delay: i * 0.004,
                duration: 0.18,
                ease: "easeOut",
              }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[9px] text-white/20 tabular-nums">
        <span>Risque</span>
        <span>Optimal</span>
      </div>
    </div>
  );
}

function oneGlanceStatus(
  decision: PhaseCoachDecision | undefined,
  data?: WidgetData,
): {
  label: string;
  color: string;
  bg: string;
} {
  if (data?.insufficientData && !hasMeaningfulPhaseData(data)) {
    return {
      label: "Données insuffisantes",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.15)",
    };
  }
  if (decision?.matrix.status === "not_adapted") {
    return { label: "Phase non adaptée", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
  }
  if (decision?.matrix.status === "partially_adapted") {
    return { label: "Sous surveillance", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
  }
  if (data?.phaseFit.band === "incoherent") {
    return { label: "Phase incohérente", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
  }
  if (data?.phaseFit.band === "fragile") {
    return { label: "Phase fragile", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
  }
  if (!decision) {
    return { label: "Analyse en cours", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
  }
  if (decision.sevenDayTrajectory.strategy === "deload") {
    return { label: "Phase non optimale", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
  }
  if (decision.confidenceModel.level === "high") {
    return { label: "Phase optimale", color: "#1f8a65", bg: "rgba(31,138,101,0.15)" };
  }
  return { label: "Stable à surveiller", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
}

function oneGlanceTone(decision: PhaseCoachDecision | undefined, data?: WidgetData): string {
  if (data?.insufficientData && !hasMeaningfulPhaseData(data)) return "En attente";
  if (decision?.matrix.status === "not_adapted") return "A corriger";
  if (decision?.matrix.status === "partially_adapted") return "A surveiller";
  if (data?.phaseFit.band === "incoherent") return "A corriger";
  if (data?.phaseFit.band === "fragile") return "Fragile";
  if (data?.phaseFit.band === "workable") return "Exploitable";
  if (!decision) return "En cours";
  if (decision.sevenDayTrajectory.strategy === "deload") return "A corriger";
  if (decision.confidenceModel.level === "high") return "Optimal";
  return "A surveiller";
}

function formatPhaseTarget(value: string | undefined): string {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function OneGlancePhaseCard({
  data,
  copy,
}: {
  data: WidgetData;
  copy: ReturnType<typeof getPhaseEngineCopy>;
}) {
  const decision = data.coachDecision;
  const status = oneGlanceStatus(decision, data);
  const tone = oneGlanceTone(decision, data);
  const score = data.phaseFit.score;
  const sevenDay = decision?.sevenDayTrajectory.days.length ?? 7;
  const fourteenDayText =
    decision?.sevenDayTrajectory.strategy === "deload"
      ? "si critères de sortie validés"
      : "si dynamique stable";
  const currentStateLabel = copy.adaptiveStateLabels[data.currentState.adaptiveState];
  const targetLabel = data.enginePrescription?.optimalPhase
    ? formatPhaseTarget(data.enginePrescription.optimalPhase)
    : copy.directionLabels[data.recommendedAdjustment.direction];
  const shortReason = phaseBadgeExplanation(data, copy);
  const noData =
    data.analysisState === "insufficient_data" ||
    (data.insufficientData && !hasMeaningfulPhaseData(data));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
            Lecture rapide
          </p>
        </div>
        <div className="max-w-[13rem] text-right">
          <span
            className="inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: status.color, backgroundColor: status.bg }}
          >
            {tone}
          </span>
          <p className="mt-1 text-[10px] leading-snug text-white/38">
            {shortReason}
          </p>
        </div>
      </div>

      <div className="mb-5 text-center">
        <p className="text-[10px] text-white/35">Niveau d'optimisation</p>
        <p className="text-[68px] font-bold leading-none tracking-tight tabular-nums text-white">
          {noData ? "—" : score}
        </p>
        <p className="mt-2 text-[13px] tracking-wide text-white/35">
          {noData ? "Données insuffisantes" : currentStateLabel}
        </p>
      </div>

      {!noData && (
        <div className="mb-4">
          <PhaseConfidenceMeter score={score} />
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-3">
        <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
            Etat actuel
          </p>
          <p className="mt-1 text-[14px] font-semibold text-white/82">
            {noData ? "Non lisible" : currentStateLabel}
          </p>
          <p className="mt-0.5 text-[10px] text-white/35">
            {noData ? "Aucun signal disponible" : copy.directionLabels[data.currentState.direction]}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
            Cap conseillé
          </p>
          <p className="mt-1 text-[14px] font-semibold text-white/82">
            {noData ? "En attente de données" : targetLabel}
          </p>
          <p className="mt-0.5 text-[10px] text-white/35">
            {noData ? "Créer une base de lecture" : copy.urgencyLabels[data.recommendedAdjustment.urgency]}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
            Horizon
          </p>
          <p className="mt-1 text-[14px] font-semibold text-white/82">
            {noData
              ? "Aucun horizon fiable"
              : decision?.sevenDayTrajectory.title ?? copy.horizonLabels[data.recommendedAdjustment.horizon]}
          </p>
          <p className="mt-0.5 text-[10px] text-white/35">
            {noData ? "Attendre les premiers signaux" : `${sevenDay} jours actifs`}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2.5">
        <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
          Pourquoi
        </p>
        <p className="mt-1 text-[11px] leading-snug text-white/52">
          {shortReason}
        </p>
        {!noData && decision?.recommendation && (
          <div className="mt-2 border-t border-white/[0.06] pt-2">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
              Prochaine action
            </p>
            <p className="mt-1 text-[11px] leading-snug text-white/65">
              {decision.recommendation}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
            Fenêtre 7j
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-white/70">
            {noData
              ? "Créer la base"
              : decision?.sevenDayTrajectory.strategy === "deload"
                ? "Reconditionnement"
                : "Maintien / progression"}
          </p>
          <p className="text-[9px] text-white/35">
            {noData ? "Check-ins, séances ou bilan" : `${sevenDay} jours actifs`}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
            Validation
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-white/70">
            {noData ? "Première lecture" : "Suivi continu"}
          </p>
          <p className="text-[9px] text-white/35">
            {noData ? "Dès qu'un premier signal remonte" : fourteenDayText}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PhaseOptimizationWidget({
  clientId,
}: {
  clientId: string;
}) {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [window, setWindowDays] = useState<7 | 30>(30);
  const [locale, setLocale] = useState<PhaseEngineLocale>("fr");
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(
      `/api/clients/${clientId}/phase-optimization?window=${window}&locale=${locale}`,
    )
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("PhaseOptimizationWidget error:", err);
        setError(err.message || "Erreur de chargement");
        setLoading(false);
      });
  }, [clientId, window, locale, reloadKey]);

  if (loading) {
    return (
      <div className="flex flex-col rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] px-6 py-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-40 bg-white/[0.04]" />
            <Skeleton className="h-2.5 w-24 bg-white/[0.04]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-12 rounded-lg bg-white/[0.04]" />
            <Skeleton className="h-6 w-14 rounded-lg bg-white/[0.04]" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="mb-5 flex items-start justify-between gap-3">
            <Skeleton className="h-2 w-24 bg-white/[0.04]" />
            <Skeleton className="h-7 w-24 rounded-md bg-white/[0.04]" />
          </div>

          <div className="mb-5 flex flex-col items-center gap-2 text-center">
            <Skeleton className="h-[68px] w-[88px] rounded-xl bg-white/[0.04]" />
            <Skeleton className="h-3 w-28 rounded-full bg-white/[0.04]" />
          </div>

          <div className="mb-4 flex items-end gap-[2.5px]" style={{ height: "44px" }}>
            {Array.from({ length: 62 }).map((_, i) => {
              const h = 18 + Math.round(Math.sin((i / 61) * Math.PI) * 12);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-[1px] bg-white/[0.05] animate-pulse"
                  style={{ height: `${h}px`, animationDelay: `${i * 0.012}s` }}
                />
              );
            })}
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                <Skeleton className="mb-2 h-2 w-16 bg-white/[0.04]" />
                <Skeleton className="mb-1.5 h-3.5 w-24 bg-white/[0.04]" />
                <Skeleton className="h-2.5 w-20 bg-white/[0.04]" />
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2.5">
            <Skeleton className="mb-2 h-2 w-12 bg-white/[0.04]" />
            <Skeleton className="mb-1.5 h-2.5 w-full bg-white/[0.04]" />
            <Skeleton className="h-2.5 w-4/5 bg-white/[0.04]" />
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                <Skeleton className="mb-2 h-2 w-16 bg-white/[0.04]" />
                <Skeleton className="mb-1.5 h-3 w-24 bg-white/[0.04]" />
                <Skeleton className="h-2.5 w-20 bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 divide-y divide-white/[0.06]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="py-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-3 rounded-full bg-white/[0.04]" />
                <Skeleton className="h-2.5 w-32 bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col rounded-2xl border-[0.3px] border-red-500/20 bg-red-950/10 px-6 py-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 mb-3">
          Phases optimales
        </p>
        <p className="text-[11px] text-red-400/80">
          Erreur de chargement: {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const {
    currentState: cs,
    recommendedAdjustment: ra,
    decisionTrace: dt,
  } = data;
  const copy = getPhaseEngineCopy(locale);
  const ui = copy.widgetUi;
  const mc = data.metricCards;
  const phasePrefs = data.phasePreferences ?? {
    prioritizePerformance: false,
    aggressiveCutTolerance: 0.5,
    preferredBulkAggressiveness: 0.5,
  };
  const derivedPrefs = data.derivedPhasePreferences ?? phasePrefs;
  const noData =
    data.analysisState === "insufficient_data" ||
    (data.insufficientData && !hasMeaningfulPhaseData(data));

  const alertTone =
    ra.urgency === "high"
      ? "high"
      : ra.urgency === "medium"
        ? "medium"
        : "watch";

  const hasSignalReview =
    data.insights?.strategicPivot ||
    data.coachDecision?.matrix.matchedConditions.length ||
    data.constraintFlags.length > 0 ||
    cs.opportunityStates.length > 0 ||
    dt.negativeFactors.length > 0 ||
    dt.conflictingSignals.length > 0;

  const coachActive =
    (data.hasCustomPhasePreferences ?? false) ||
    (data.manualOverride?.active ?? false);

  return (
    <div className="flex flex-col rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] px-6 py-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
            {ui.title}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: dataQualityColor(data.dataQuality) }}
            />
            <span
              className="text-[10px]"
              style={{ color: dataQualityColor(data.dataQuality) }}
            >
              {copy.dataQualityLabels[data.dataQuality]}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <CoachDocLinkButton
            href="/coach/documentation/phase-optimization"
            label="Documentation"
          />
          <WindowToggle value={window} onChange={setWindowDays} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5">
        <OneGlancePhaseCard data={data} copy={copy} />

        <PhaseCollapsibleSection title="Actions recommandées" defaultOpen>
          {noData ? (
            <PhaseInsightCard>
              <PhaseStatusAlert
                message={
                  data.analysisStateReason ??
                  "Aucune donnée coach exploitable sur cette fenêtre. Le moteur attend au moins un check-in, une séance, un bilan corporel ou des logs nutrition avant de conclure."
                }
                tone="watch"
                prominent
              />
            </PhaseInsightCard>
          ) : data.enginePrescription ? (
            <div
              className={`rounded-xl border p-4 shadow-sm ${
                data.enginePrescription.vetoActive
                  ? "border-red-500/50 bg-red-950/20 text-red-400"
                  : "border-[#5eead4]/30 bg-[#5eead4]/10 text-[#5eead4]"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em] bg-white/[0.08]">
                  {data.enginePrescription.optimalPhase.replace(/_/g, " ")}
                </span>
                {data.enginePrescription.vetoActive && (
                  <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30">
                    VETO ACTIF
                  </span>
                )}
              </div>
              <p className={`text-xs leading-relaxed ${data.enginePrescription.vetoActive ? "text-red-200/80" : "text-white/70"}`}>
                {data.enginePrescription.clinicalReasoning}
              </p>
            </div>
          ) : (
            <PhaseInsightCard>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                  style={{
                    color: URGENCY_COLORS[ra.urgency],
                    backgroundColor: `${URGENCY_COLORS[ra.urgency]}18`,
                    border: `0.5px solid ${URGENCY_COLORS[ra.urgency]}40`,
                  }}
                >
                  {copy.urgencyLabels[ra.urgency]}
                </span>
                <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[9px] font-medium text-white/40">
                  {copy.horizonLabels[ra.horizon]}
                </span>
              </div>
              <PhaseStatusAlert message={data.microCopy} tone={alertTone} prominent />
            </PhaseInsightCard>
          )}

          {!noData && data.coachDecision && (
            <CoachDecisionPanel decision={data.coachDecision} />
          )}
        </PhaseCollapsibleSection>

        <PhaseCollapsibleSection title="Signaux à suivre">
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
            <PhaseFooterMetricCard
              label="Poids"
              value={mc.weight.value}
              unit={mc.weight.unit}
              subtitle={mc.weight.subtitle}
              zone={mc.weight.zone}
              zoneLabel={mc.weight.zoneLabel}
            />
            <PhaseFooterMetricCard
              label="BF"
              value={mc.bodyFat.value}
              unit={mc.bodyFat.unit}
              subtitle={mc.bodyFat.subtitle}
              zone={mc.bodyFat.zone}
              zoneLabel={mc.bodyFat.zoneLabel}
            />
            <PhaseFooterMetricCard
              label="Sommeil"
              value={mc.sleep.value}
              unit={mc.sleep.unit}
              zone={mc.sleep.zone}
              zoneLabel={mc.sleep.zoneLabel}
            />
            <PhaseFooterMetricCard
              label="Performance"
              value={mc.performance.value}
              unit={mc.performance.unit}
              zone={mc.performance.zone}
              zoneLabel={mc.performance.zoneLabel}
            />
            <PhaseFooterMetricCard
              label="RHR"
              value={mc.rhr.value}
              unit={mc.rhr.unit}
              subtitle={mc.rhr.subtitle}
              zone={mc.rhr.zone}
              zoneLabel={mc.rhr.zoneLabel}
            />
          </div>
        </PhaseCollapsibleSection>

        <PhaseCollapsibleSection title="Facteurs de décision">
            <div className="space-y-3">
            <p className="text-[10px] leading-relaxed text-white/40">
              Cette section montre les signaux réellement utilisés pour produire le verdict. Un facteur absent n’a pas participé à la décision sur la fenêtre sélectionnée.
            </p>
            {!hasSignalReview && (
              <div className="rounded-lg bg-white/[0.02] px-3 py-2.5 text-[10px] text-white/40">
                Aucun facteur dominant détecté. Le moteur conserve une lecture neutre et continue de surveiller les prochains check-ins, séances et bilans.
              </div>
            )}
            {data.insights?.strategicPivot && (
              <StrategicPivotAlert insight={data.insights.strategicPivot} />
            )}
            {data.coachDecision?.matrix.matchedConditions &&
              data.coachDecision.matrix.matchedConditions.length > 0 && (
                <div className="rounded-lg bg-white/[0.02] px-3 py-2.5">
                  <p className="mb-2 text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
                    Ce qui déclenche le verdict
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.coachDecision.matrix.matchedConditions.map((item) => (
                      <span
                        key={item}
                        className="rounded-md bg-white/[0.05] px-2 py-1 text-[9px] font-medium text-white/45"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
            )}
            {data.constraintFlags.length > 0 && (
              <div className="rounded-lg bg-white/[0.02] px-3 py-2.5">
                <p className="mb-2 text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
                  Points à surveiller
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.constraintFlags.map((flag) => (
                    <span
                      key={flag}
                      className="rounded-md bg-white/[0.05] px-2 py-1 text-[9px] text-white/50"
                    >
                      {
                        (copy.reasonMap[flag] ?? flag)
                          .split(" — ")[0]
                          .split(" - ")[0]
                      }
                    </span>
                  ))}
                </div>
              </div>
            )}
            <AnimatePresence>
              {cs.opportunityStates.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2 rounded-lg bg-white/[0.02] px-3 py-2.5"
                >
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
                    Opportunités
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cs.opportunityStates.map((op) => (
                      <span
                        key={op}
                        className="rounded-md px-2 py-1 text-[9px] text-[#5eead4]"
                        style={{
                          backgroundColor: "rgba(31,138,101,0.12)",
                          border: "0.5px solid rgba(31,138,101,0.28)",
                        }}
                      >
                        {op.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {(dt.negativeFactors.length > 0 || dt.conflictingSignals.length > 0) && (
              <div className="space-y-2 rounded-lg bg-white/[0.02] px-3 py-2.5 text-[10px] text-white/40">
                {dt.negativeFactors.length > 0 && (
                  <p>
                    <span className="text-white/25">Freins dominants </span>
                    <span className="text-red-400/75">
                      {dt.negativeFactors.join(", ")}
                    </span>
                  </p>
                )}
                {dt.conflictingSignals.length > 0 && (
                  <p className="text-white/30">
                    {ui.conflicts} ({Math.round(dt.conflictSeverity * 100)}%) :{" "}
                    {dt.conflictingSignals
                      .map((s) =>
                        s === "override_coach_actif"
                          ? copy.overrideTraceLabel
                          : s,
                      )
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
            </div>
          </PhaseCollapsibleSection>

        <PhaseCollapsibleSection
          title="Réglages coach"
          badge={
            coachActive ? (
              <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/45">
                Actif
              </span>
            ) : undefined
          }
        >
          <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[10px] font-semibold text-white/65">Comment utiliser ces réglages</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/40">
              Les préférences modulent la sensibilité du moteur pour ce client. Le réglage manuel remplace la recommandation affichée : utilisez-le seulement lorsqu’un contexte terrain non mesuré justifie de reprendre la main, puis documentez la raison.
            </p>
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                {ui.phasePrefs}
              </p>
              <div className="mb-3 space-y-1.5 text-[10px] leading-relaxed text-white/38">
                <p><span className="text-white/55">Favoriser la performance</span> augmente légèrement la priorité donnée aux performances lorsque leur tendance est fiable.</p>
                <p><span className="text-white/55">Tolérance au déficit</span> autorise plus ou moins facilement une direction de cut agressive.</p>
                <p><span className="text-white/55">Tolérance au surplus</span> autorise plus ou moins facilement une prise de masse offensive.</p>
              </div>
              <PhasePreferencesPanel
                clientId={clientId}
                locale={locale}
                prefs={phasePrefs}
                derivedPrefs={derivedPrefs}
                hasCustom={data.hasCustomPhasePreferences ?? false}
                onSaved={() => setReloadKey((k) => k + 1)}
              />
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                {ui.manualOverride}
              </p>
              <p className="mb-3 text-[10px] leading-relaxed text-white/38">
                Force le cap ou l’état affiché sans effacer le calcul automatique. L’impact est immédiat sur la recommandation visible ; la raison sert de trace pour le suivi coach.
              </p>
              <ManualOverridePanel
                clientId={clientId}
                locale={locale}
                manualOverride={data.manualOverride}
                onSaved={() => setReloadKey((k) => k + 1)}
              />
            </div>
          </div>
        </PhaseCollapsibleSection>
      </div>
    </div>
  );
}
