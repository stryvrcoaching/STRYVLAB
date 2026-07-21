"use client";

import { useState, useEffect, useRef } from "react";
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
import PhaseCollapsibleSection from "@/components/coach/phase-optimization/PhaseCollapsibleSection";
import StryvrRangeSlider from "@/components/coach/phase-optimization/StryvrRangeSlider";
import CoachDocLinkButton from "@/components/coach/docs/CoachDocLinkButton";
import type { PhaseFooterMetricCards } from "@/lib/coach/phaseEngine/footerMetrics";
import type { MetricZone } from "@/components/coach/phase-optimization/MetricZoneBar";

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

function zoneTone(zone: MetricZone | null): string {
  if (zone === "optimal") return "text-[#7fe0b8]";
  if (zone === "average") return "text-amber-400";
  if (zone === "poor") return "text-red-400";
  return "text-white/45";
}

/** Compact hover pill — same pattern as TransformationScore DimPill */
function HoverPill({
  label,
  value,
  unit,
  subtitle,
  detail,
  toneClass,
}: {
  label: string;
  value: string;
  unit?: string;
  subtitle?: string;
  detail?: string;
  toneClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const noData = !value || value === "—" || value === "null";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex min-w-[72px] cursor-default flex-col items-center gap-0.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 transition-colors hover:bg-white/[0.07]"
      >
        <span
          className={`text-[14px] font-bold tabular-nums leading-none ${
            noData ? "text-white/20" : toneClass ?? "text-white/75"
          }`}
        >
          {noData ? "—" : value}
          {!noData && unit ? (
            <span className="ml-0.5 text-[9px] font-medium text-white/30">
              {unit}
            </span>
          ) : null}
        </span>
        <span className="text-center text-[8px] font-bold uppercase tracking-[0.04em] leading-tight text-white/25">
          {label}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute bottom-full z-20 mb-2 w-56 max-w-[calc(100vw-2rem)]"
            style={{ left: "calc(50% - 7rem)" }}
          >
            <div className="rounded-xl border-[0.3px] border-white/[0.10] bg-[#1a1a1a] px-3 py-2.5 shadow-xl">
              <p className="mb-1 text-[10px] font-bold text-white/70">{label}</p>
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-[0.1em] text-white/25">
                  Valeur
                </span>
                <span
                  className={`text-[12px] font-bold tabular-nums ${
                    noData ? "text-white/20" : toneClass ?? "text-white/70"
                  }`}
                >
                  {noData ? "—" : `${value}${unit ? ` ${unit}` : ""}`}
                </span>
              </div>
              {subtitle ? (
                <p className="mt-1.5 text-[10px] leading-snug text-white/40">
                  {subtitle}
                </p>
              ) : null}
              {detail ? (
                <p className="mt-1 text-[10px] leading-snug text-white/35">
                  {detail}
                </p>
              ) : null}
            </div>
            <div className="flex justify-center">
              <div className="-mt-1 h-2 w-2 rotate-45 border-b-[0.3px] border-r-[0.3px] border-white/[0.10] bg-[#1a1a1a]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

function oneGlanceTone(
  decision: PhaseCoachDecision | undefined,
  data?: WidgetData,
): { label: string; color: string; bg: string } {
  if (data?.insufficientData && !hasMeaningfulPhaseData(data)) {
    return {
      label: "En attente",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.15)",
    };
  }
  if (decision?.matrix.status === "not_adapted") {
    return { label: "A corriger", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
  }
  if (decision?.matrix.status === "partially_adapted") {
    return {
      label: "A surveiller",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.15)",
    };
  }
  if (data?.phaseFit.band === "incoherent") {
    return { label: "A corriger", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
  }
  if (data?.phaseFit.band === "fragile") {
    return { label: "Fragile", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
  }
  if (!decision) {
    return {
      label: "En cours",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.15)",
    };
  }
  if (decision.sevenDayTrajectory.strategy === "deload") {
    return { label: "A corriger", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
  }
  if (decision.confidenceModel.level === "high") {
    return {
      label: "Optimal",
      color: "#1f8a65",
      bg: "rgba(31,138,101,0.15)",
    };
  }
  return {
    label: "A surveiller",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
  };
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
  const tone = oneGlanceTone(decision, data);
  const score = data.phaseFit.score;
  const currentStateLabel =
    copy.adaptiveStateLabels[data.currentState.adaptiveState];
  const targetLabel = data.enginePrescription?.optimalPhase
    ? formatPhaseTarget(data.enginePrescription.optimalPhase)
    : copy.directionLabels[data.recommendedAdjustment.direction];
  const shortReason = phaseBadgeExplanation(data, copy);
  const noData =
    data.analysisState === "insufficient_data" ||
    (data.insufficientData && !hasMeaningfulPhaseData(data));
  const nextAction =
    decision?.recommendation ??
    (data.enginePrescription?.clinicalReasoning
      ? data.enginePrescription.clinicalReasoning
      : data.microCopy);
  const horizonLabel = noData
    ? "—"
    : (decision?.sevenDayTrajectory.title ??
      copy.horizonLabels[data.recommendedAdjustment.horizon]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
          Lecture rapide
        </p>
        <span
          className="inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: tone.color, backgroundColor: tone.bg }}
        >
          {tone.label}
        </span>
      </div>

      <div className="mb-4 text-center">
        <p className="text-[10px] text-white/35">Niveau d&apos;optimisation</p>
        <p className="text-[56px] font-bold leading-none tracking-tight tabular-nums text-white">
          {noData ? "—" : score}
        </p>
        <p className="mt-1.5 text-[12px] tracking-wide text-white/35">
          {noData ? "Données insuffisantes" : currentStateLabel}
        </p>
      </div>

      {!noData && (
        <div className="mb-4">
          <PhaseConfidenceMeter score={score} />
        </div>
      )}

      {/* 3 key decision pills with hover — mirrors transformation score */}
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <HoverPill
          label="État"
          value={noData ? "—" : currentStateLabel}
          subtitle={
            noData
              ? "Aucun signal disponible"
              : copy.directionLabels[data.currentState.direction]
          }
          detail="État adaptatif actuel du client sur la fenêtre analysée."
        />
        <HoverPill
          label="Cap"
          value={noData ? "—" : targetLabel}
          subtitle={
            noData
              ? "En attente de données"
              : copy.urgencyLabels[data.recommendedAdjustment.urgency]
          }
          detail="Direction énergétique conseillée par le moteur de phase."
          toneClass="text-[#7fe0b8]"
        />
        <HoverPill
          label="Horizon"
          value={horizonLabel}
          subtitle={
            noData
              ? "Attendre les premiers signaux"
              : `${decision?.sevenDayTrajectory.days.length ?? 7} jours actifs`
          }
          detail="Fenêtre d’action recommandée pour valider ou ajuster la phase."
        />
      </div>

      {/* Compact action strip */}
      <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
        <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">
          {noData ? "Pourquoi" : "Action recommandée"}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-white/60">
          {noData ? shortReason : nextAction}
        </p>
        {!noData && decision?.headline && decision.headline !== nextAction && (
          <p className="mt-1.5 text-[10px] leading-snug text-white/38">
            {decision.headline}
          </p>
        )}
        {!noData &&
          decision?.watchouts &&
          decision.watchouts.length > 0 && (
            <p className="mt-1.5 text-[10px] leading-snug text-amber-400/70">
              {decision.watchouts[0]}
            </p>
          )}
      </div>
    </div>
  );
}

function SignalPills({
  cards,
}: {
  cards: PhaseFooterMetricCards;
}) {
  const items: Array<{
    label: string;
    value: string;
    unit?: string;
    subtitle?: string;
    detail?: string;
    zone: MetricZone | null;
    zoneLabel?: string;
  }> = [
    {
      label: "Poids",
      value: cards.weight.value,
      unit: cards.weight.unit,
      subtitle: cards.weight.subtitle,
      zone: cards.weight.zone,
      zoneLabel: cards.weight.zoneLabel,
    },
    {
      label: "BF",
      value: cards.bodyFat.value,
      unit: cards.bodyFat.unit,
      subtitle: cards.bodyFat.subtitle,
      zone: cards.bodyFat.zone,
      zoneLabel: cards.bodyFat.zoneLabel,
    },
    {
      label: "Sommeil",
      value: cards.sleep.value,
      unit: cards.sleep.unit,
      zone: cards.sleep.zone,
      zoneLabel: cards.sleep.zoneLabel,
    },
    {
      label: "Performance",
      value: cards.performance.value,
      unit: cards.performance.unit,
      subtitle: cards.performance.subtitle ?? "Tendance de performance (moteur de phase)",
      zone: cards.performance.zone,
      zoneLabel: cards.performance.zoneLabel,
      detail:
        "Tendance de progression des charges / complétion sur la fenêtre — pas le même calcul que le pilier Performance du score de transformation.",
    },
    {
      label: "RHR",
      value: cards.rhr.value,
      unit: cards.rhr.unit,
      subtitle: cards.rhr.subtitle,
      zone: cards.rhr.zone,
      zoneLabel: cards.rhr.zoneLabel,
    },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((item) => (
        <HoverPill
          key={item.label}
          label={item.label}
          value={item.value}
          unit={item.unit}
          subtitle={item.subtitle ?? item.zoneLabel}
          detail={
            item.detail ??
            (item.zoneLabel
              ? `Zone : ${item.zoneLabel}`
              : "Signal suivi pour l’optimisation de phase.")
          }
          toneClass={zoneTone(item.zone)}
        />
      ))}
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
  const [locale] = useState<PhaseEngineLocale>("fr");
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
            <Skeleton className="h-[56px] w-[72px] rounded-xl bg-white/[0.04]" />
            <Skeleton className="h-3 w-28 rounded-full bg-white/[0.04]" />
          </div>
          <div className="mb-4 flex items-end gap-[2.5px]" style={{ height: "44px" }}>
            {Array.from({ length: 40 }).map((_, i) => {
              const h = 18 + Math.round(Math.sin((i / 39) * Math.PI) * 12);
              return (
                <div
                  key={i}
                  className="flex-1 animate-pulse rounded-[1px] bg-white/[0.05]"
                  style={{ height: `${h}px`, animationDelay: `${i * 0.012}s` }}
                />
              );
            })}
          </div>
          <div className="mb-4 flex justify-center gap-2">
            {[64, 64, 72].map((w, i) => (
              <Skeleton
                key={i}
                className="h-[48px] rounded-lg bg-white/[0.04]"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
          <Skeleton className="h-14 w-full rounded-lg bg-white/[0.04]" />
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {[52, 48, 56, 48, 48].map((w, i) => (
            <Skeleton
              key={i}
              className="h-[48px] rounded-lg bg-white/[0.04]"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col rounded-2xl border-[0.3px] border-red-500/20 bg-red-950/10 px-6 py-5">
        <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
          Phases optimales
        </p>
        <p className="text-[11px] text-red-400/80">
          Erreur de chargement: {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const copy = getPhaseEngineCopy(locale);
  const ui = copy.widgetUi;
  const phasePrefs = data.phasePreferences ?? {
    prioritizePerformance: false,
    aggressiveCutTolerance: 0.5,
    preferredBulkAggressiveness: 0.5,
  };
  const derivedPrefs = data.derivedPhasePreferences ?? phasePrefs;
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

      <div className="flex flex-1 flex-col gap-4">
        <OneGlancePhaseCard data={data} copy={copy} />

        {/* Signaux — compact hover pills */}
        <div>
          <p className="mb-2.5 text-center text-[8px] font-bold uppercase tracking-[0.12em] text-white/25">
            Signaux à suivre
          </p>
          <SignalPills cards={data.metricCards} />
        </div>

        {/* Réglages coach — kept intact */}
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
            <p className="text-[10px] font-semibold text-white/65">
              Comment utiliser ces réglages
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/40">
              Les préférences modulent la sensibilité du moteur pour ce client.
              Le réglage manuel remplace la recommandation affichée : utilisez-le
              seulement lorsqu’un contexte terrain non mesuré justifie de reprendre
              la main, puis documentez la raison.
            </p>
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                {ui.phasePrefs}
              </p>
              <div className="mb-3 space-y-1.5 text-[10px] leading-relaxed text-white/38">
                <p>
                  <span className="text-white/55">Favoriser la performance</span>{" "}
                  augmente légèrement la priorité donnée aux performances lorsque
                  leur tendance est fiable.
                </p>
                <p>
                  <span className="text-white/55">Tolérance au déficit</span>{" "}
                  autorise plus ou moins facilement une direction de cut agressive.
                </p>
                <p>
                  <span className="text-white/55">Tolérance au surplus</span>{" "}
                  autorise plus ou moins facilement une prise de masse offensive.
                </p>
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
                Force le cap ou l’état affiché sans effacer le calcul automatique.
                L’impact est immédiat sur la recommandation visible ; la raison sert
                de trace pour le suivi coach.
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
