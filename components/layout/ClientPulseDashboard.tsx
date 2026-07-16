"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  CircleDot,
  ChevronDown,
  Dumbbell,
  Droplets,
  Moon,
  RefreshCw,
  SlidersHorizontal,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import { calculateMacros } from "@/lib/formulas/macros";
import { CLIENT_IMPACT_EVENT, type ClientImpactEventDetail } from "@/lib/coach/client-impact-events";
import { buildCycleCockpitInsight } from "@/lib/coach/cycle-cockpit";
import type { CycleState } from "@/lib/cycle/cycleEngine";

type PulseData = {
  client: { first_name: string; last_name: string; profile_photo_url?: string | null; step_target?: number | null };
  nutrition: any | null;
  nutritionData: any | null;
  checkin: any | null;
  performance: any | null;
  cycleState: CycleState | null;
};

type GaugeState = "aligné" | "à surveiller" | "à corriger" | "à compléter";

const GAUGE_STATE: Record<GaugeState, { label: string; color: string; background: string }> = {
  "aligné": { label: "Aligné", color: "#7fe0b8", background: "rgba(31,138,101,0.16)" },
  "à surveiller": { label: "À surveiller", color: "#f5c15d", background: "rgba(245,158,11,0.14)" },
  "à corriger": { label: "À corriger", color: "#fda4af", background: "rgba(239,68,68,0.14)" },
  "à compléter": { label: "À compléter", color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.06)" },
};

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatK(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Math.round(Number(value) / 100) / 10}k`;
}

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function signed(value: number, suffix = "") {
  if (!value) return `0${suffix}`;
  return `${value > 0 ? "+" : ""}${Math.round(value)}${suffix}`;
}

function energyLabel(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  if (Math.abs(value) < 50) return "maintenance";
  return `${value < 0 ? "déficit" : "surplus"} ${Math.abs(Math.round(value))} kcal`;
}

function GaugeCard({
  icon: Icon,
  title,
  state,
  reality,
  reference,
  realityLabel,
  referenceLabel,
  summary,
  method,
  live = false,
  tolerance = 12,
}: {
  icon: typeof Activity;
  title: string;
  state: GaugeState;
  reality: number | null;
  reference?: number | null;
  realityLabel: string;
  referenceLabel?: string;
  summary: string;
  method: string;
  live?: boolean;
  tolerance?: number;
}) {
  const stateMeta = GAUGE_STATE[state];
  const hasReality = reality != null && Number.isFinite(reality);
  const hasReference = reference != null && Number.isFinite(reference);
  const zoneStart = hasReference ? clamp(reference! - tolerance) : 20;
  const zoneEnd = hasReference ? clamp(reference! + tolerance) : 80;
  const markersOverlap = hasReality && hasReference && Math.abs(reality! - reference!) <= 2;

  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-black/20 text-white/60"><Icon size={15} strokeWidth={2.15} /></span>
          <div className="min-w-0"><h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">{title}</h2>{live && <p className="mt-0.5 text-[9px] font-medium text-[#7fe0b8]">Brouillon reflété en direct</p>}</div>
        </div>
        <span className="shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: stateMeta.color, backgroundColor: stateMeta.background }}>{stateMeta.label}</span>
      </div>

      <div className="relative mt-4 h-8" aria-label={`${title}. ${realityLabel}${referenceLabel ? `. ${referenceLabel}` : ""}`}>
        <div className="absolute inset-x-0 top-[13px] h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <span className="absolute inset-y-0 rounded-full bg-[#1f8a65]/20" style={{ left: `${zoneStart}%`, width: `${zoneEnd - zoneStart}%` }} />
          <span className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
        </div>
        {hasReference && !markersOverlap && <span className="absolute top-[5px] h-[22px] w-0.5 -translate-x-1/2 rounded-full bg-white/55 shadow-[0_0_0_2px_rgba(13,13,13,0.9)] transition-[left] duration-300 motion-reduce:transition-none" style={{ left: `${clamp(reference!)}%` }} aria-hidden="true" />}
        {hasReality && <span className={`absolute top-[10px] h-3 w-3 -translate-x-1/2 rounded-full border-2 bg-[#dbe4df] shadow-[0_0_0_2px_rgba(219,228,223,0.22)] transition-[left] duration-300 motion-reduce:transition-none ${markersOverlap ? "border-white/55" : "border-[#0d0d0d]"}`} style={{ left: `${clamp(reality!)}%` }} aria-hidden="true" />}
      </div>

      <div className="mt-1 grid gap-1.5 text-[10px] leading-snug sm:grid-cols-2">
        <p className="text-white/70"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#dbe4df]" />{realityLabel}</p>
        {referenceLabel && <p className="text-white/45"><span className="mr-1.5 inline-block h-2.5 w-0.5 bg-white/55 align-[-2px]" />{referenceLabel}</p>}
      </div>
      <p className="mt-3 flex items-center gap-2 text-[11px] font-medium leading-relaxed text-white/60"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: stateMeta.color }} />{summary}</p>
      <details className="group mt-2.5">
        <summary className="cursor-pointer list-none text-[9px] text-white/32 transition-colors hover:text-white/60"><span className="group-open:hidden">Voir la méthode</span><span className="hidden group-open:inline">Masquer la méthode</span></summary>
        <p className="mt-1.5 border-l border-white/10 pl-2 text-[9px] leading-relaxed text-white/35">{method}</p>
      </details>
    </article>
  );
}

function CycleGauge({ value, color, label, valueLabel }: { value: number; color: string; label: string; valueLabel: string }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const dash = Math.max(0, Math.min(1, value)) * circumference

  return (
    <div className="flex min-w-[82px] flex-col items-center gap-1 text-center">
      <div className="relative h-12 w-12">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">{valueLabel}</span>
      </div>
      <span className="text-[9px] uppercase tracking-[0.1em] text-white/40">{label}</span>
    </div>
  )
}

function CycleCockpitCard({ cycleState }: { cycleState: CycleState | null }) {
  const insight = buildCycleCockpitInsight(cycleState)
  if (!insight) return null

  const IconBySignal = {
    energy: Zap,
    nutrition: Droplets,
    training: Dumbbell,
  }
  const regularityLabel = insight.regularity === 'irregular'
    ? 'Rythme variable · dates réelles prioritaires'
    : insight.regularity === 'regular'
      ? 'Rythme personnel cohérent'
      : 'Apprentissage en cours'

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/20" style={{ color: insight.phaseColor }}><CircleDot size={17} /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/45">Contexte cycle</p>
            <p className="truncate text-[13px] font-semibold text-white">{insight.phaseLabel}</p>
          </div>
        </div>
        <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[9px] font-medium text-white/55">{insight.isEstimated ? 'Estimation' : 'Confirmé'}</span>
      </div>

      <div className="flex items-center justify-around gap-3 px-3.5 py-3">
        <CycleGauge value={insight.phaseProgress} color={insight.phaseColor} label="Phase" valueLabel={`J${insight.cycleDay}`} />
        <CycleGauge value={insight.cycleProgress} color="#dbe4df" label="Cycle" valueLabel={`${insight.cycleDay}/${insight.cycleLength}`} />
        <p className="min-w-0 text-[10px] leading-relaxed text-white/55">{regularityLabel}{insight.isPeriodStartExpected ? ' · Début à confirmer' : ''}</p>
      </div>

      <div className="grid gap-px border-t border-white/[0.06] bg-white/[0.06] sm:grid-cols-3">
        {insight.signals.map((signal) => {
          const Icon = IconBySignal[signal.key]
          return (
            <div key={signal.key} className="bg-[#171817] px-3 py-3">
              <div className="flex items-center gap-1.5" style={{ color: insight.phaseColor }}><Icon size={13} /><p className="text-[9px] font-semibold uppercase tracking-[0.1em]">{signal.label}</p></div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-white/55">{signal.detail}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function inferGoal(value: string | null | undefined): "deficit" | "maintenance" | "surplus" {
  if (value === "fat_loss") return "deficit";
  if (value === "hypertrophy" || value === "strength") return "surplus";
  return "maintenance";
}

function buildFormulaInput(raw: any, overrides?: { steps?: number | null; workouts?: number | null; cardioFrequency?: number | null; cardioDurationMin?: number | null; cardioTypes?: string[]; cardioRpe?: number | null; sessionDurationMin?: number | null; trainingTypes?: string[]; trainingRir?: number | null }) {
  const client = raw?.client;
  if (!client?.weight_kg || !client?.height_cm || !client?.age || !client?.gender) return null;
  const gender = client.gender === "female" ? "female" : client.gender === "male" ? "male" : null;
  if (!gender) return null;

  return {
    weight: Number(client.weight_kg),
    height: Number(client.height_cm),
    age: Number(client.age),
    gender,
    goal: inferGoal(client.training_goal),
    bodyFat: client.body_fat_pct ?? undefined,
    muscleMassKg: client.muscle_mass_kg ?? undefined,
    bmrKcalMeasured: client.bmr_kcal_measured ?? undefined,
    steps: Math.max(0, Number(overrides?.steps ?? client.daily_steps ?? 0)),
    occupationMultiplier: client.occupation_multiplier ?? undefined,
    workHoursPerWeek: client.work_hours_per_week ?? undefined,
    workouts: Math.max(0, Number(overrides?.workouts ?? client.weekly_frequency ?? 0)),
    sessionDurationMin: overrides?.sessionDurationMin ?? client.session_duration_min ?? undefined,
    trainingCaloriesWeekly: overrides?.sessionDurationMin != null ? undefined : client.training_calories_weekly ?? undefined,
    trainingTypes: overrides?.trainingTypes ?? undefined,
    trainingRir: overrides?.trainingRir ?? undefined,
    cardioFrequency: Math.max(0, Number(overrides?.cardioFrequency ?? client.cardio_frequency ?? 0)),
    cardioDurationMin: overrides?.cardioDurationMin ?? client.cardio_duration_min ?? undefined,
    cardioTypes: overrides?.cardioTypes ?? undefined,
    cardioRpe: overrides?.cardioRpe ?? undefined,
    sleepDurationH: client.sleep_duration_h ?? undefined,
    stressLevel: client.stress_level ?? undefined,
    energyLevel: client.energy_level ?? undefined,
    caffeineDaily: client.caffeine_daily_mg ?? undefined,
    alcoholWeekly: client.alcohol_weekly ?? undefined,
  } as const;
}

export default function ClientPulseDashboard() {
  const pathname = usePathname();
  const clientId = useMemo(() => pathname.match(/^\/coach\/clients\/([^/]+)/)?.[1] ?? null, [pathname]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PulseData | null>(null);
  const [nutritionDraft, setNutritionDraft] = useState<ClientImpactEventDetail["nutrition"] | null>(null);
  const [workoutDraft, setWorkoutDraft] = useState<ClientImpactEventDetail["workout"] | null>(null);
  const [impactRefresh, setImpactRefresh] = useState(0);

  useEffect(() => {
    if (!clientId) {
      setData(null);
      setNutritionDraft(null);
      setWorkoutDraft(null);
      return;
    }
    setOpen(window.localStorage.getItem(`coach-client-pulse:${clientId}`) === "open");
    setNutritionDraft(null);
    setWorkoutDraft(null);
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    const handleImpact = (event: Event) => {
      const detail = (event as CustomEvent<ClientImpactEventDetail>).detail;
      if (!detail || detail.clientId !== clientId) return;
      if (detail.kind === "nutrition-draft") setNutritionDraft(detail.nutrition ?? null);
      if (detail.kind === "workout-draft") setWorkoutDraft(detail.workout ?? null);
      if (detail.kind === "clear-nutrition-draft") setNutritionDraft(null);
      if (detail.kind === "clear-workout-draft") setWorkoutDraft(null);
      if (detail.kind === "refresh") setImpactRefresh((value) => value + 1);
    };
    window.addEventListener(CLIENT_IMPACT_EVENT, handleImpact);
    return () => window.removeEventListener(CLIENT_IMPACT_EVENT, handleImpact);
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);
    const load = () => Promise.all([
      fetch(`/api/clients/${clientId}`).then((response) => response.ok ? response.json() : null),
      fetch(`/api/clients/${clientId}/nutrition-hub?window=7`).then((response) => response.ok ? response.json() : null),
      fetch(`/api/clients/${clientId}/nutrition-data?mode=realtime`).then((response) => response.ok ? response.json() : null),
      fetch(`/api/clients/${clientId}/checkin-summary?days=30`).then((response) => response.ok ? response.json() : null),
      fetch(`/api/clients/${clientId}/performance-summary?weeks=8`).then((response) => response.ok ? response.json() : null),
      fetch(`/api/clients/${clientId}/cycle/status`).then((response) => response.ok ? response.json() : null),
    ]).then(([clientResponse, nutrition, nutritionData, checkin, performance, cycle]) => {
      if (!cancelled && clientResponse?.client) setData({ client: clientResponse.client, nutrition, nutritionData, checkin, performance, cycleState: cycle?.cycleState ?? null });
    }).catch(() => { if (!cancelled) setData(null); }).finally(() => { if (!cancelled) setLoading(false); });

    load();
    const interval = open ? window.setInterval(load, 30_000) : undefined;
    return () => { cancelled = true; if (interval) window.clearInterval(interval); };
  }, [clientId, open, impactRefresh]);

  const baseFormula = useMemo(() => data ? (() => { const input = buildFormulaInput(data.nutritionData); return input ? calculateMacros(input) : null; })() : null, [data]);
  const coachFormula = useMemo(() => data ? (() => {
    const plannedSteps = data.client.step_target != null ? Number(data.client.step_target) : null;
    const plannedTraining = data.nutritionData?.plannedTraining ?? {};
    const input = buildFormulaInput(data.nutritionData, {
      steps: plannedSteps,
      workouts: workoutDraft?.strengthFrequency ?? plannedTraining.strengthFrequency ?? workoutDraft?.weeklyFrequency ?? plannedTraining.weeklyFrequency,
      cardioFrequency: workoutDraft?.cardioFrequency ?? plannedTraining.cardioFrequency,
      cardioDurationMin: workoutDraft?.cardioDurationMin ?? plannedTraining.cardioDurationMin,
      cardioTypes: workoutDraft?.cardioTypes ?? plannedTraining.cardioTypes,
      cardioRpe: workoutDraft?.cardioRpe ?? plannedTraining.cardioRpe,
      sessionDurationMin: workoutDraft?.sessionDurationMin ?? plannedTraining.sessionDurationMin,
      trainingTypes: workoutDraft?.trainingTypes ?? plannedTraining.trainingTypes,
      trainingRir: workoutDraft?.trainingRir ?? plannedTraining.trainingRir,
    });
    return input ? calculateMacros(input) : null;
  })() : null, [data, workoutDraft]);

  if (!clientId || !data) return null;

  const { client, nutrition, nutritionData, checkin, performance } = data;
  const cycleInsight = buildCycleCockpitInsight(data.cycleState);
  const averages = checkin?.field_averages ?? {};
  const summary = nutrition?.summary ?? {};
  const energy = nutrition?.energy ?? {};
  const adaptiveTdee = energy.clientTdee != null ? Number(energy.clientTdee) : null;
  const currentTdee = adaptiveTdee ?? baseFormula?.tdee ?? null;
  const draftTdee = nutritionDraft?.tdee != null ? Number(nutritionDraft.tdee) : null;
  const plannedFormulaDelta = coachFormula && baseFormula ? coachFormula.tdee - baseFormula.tdee : 0;
  const coachTdee = draftTdee ?? (currentTdee != null ? currentTdee + plannedFormulaDelta : coachFormula?.tdee ?? null);
  const tdeeDelta = coachTdee != null && currentTdee != null ? coachTdee - currentTdee : 0;
  const targetCalories = nutrition?.trend?.points?.length ? Math.round(nutrition.trend.points.reduce((sum: number, point: any) => sum + Number(point.target?.calories ?? 0), 0) / nutrition.trend.points.length) : null;
  const actualCalories = nutrition?.trend?.points?.length ? Math.round(nutrition.trend.points.reduce((sum: number, point: any) => sum + Number(point.consumed?.calories ?? 0), 0) / nutrition.trend.points.length) : null;
  const draftCalories = nutritionDraft?.calories != null ? Number(nutritionDraft.calories) : null;
  const coachTargetCalories = draftCalories ?? targetCalories;
  const actualSteps = averages.daily_steps != null ? Number(averages.daily_steps) : nutritionData?.client?.daily_steps != null ? Number(nutritionData.client.daily_steps) : null;
  const plannedSteps = data.client.step_target != null ? Number(data.client.step_target) : null;
  const energyReality = actualCalories != null && currentTdee != null ? actualCalories - currentTdee : null;
  const energyPrescription = coachTargetCalories != null && coachTdee != null ? coachTargetCalories - coachTdee : null;
  const energyDifference = energyReality != null && energyPrescription != null ? Math.abs(energyReality - energyPrescription) : null;
  const energyState: GaugeState = energyDifference == null ? "à compléter" : energyDifference <= 150 ? "aligné" : energyDifference <= 350 ? "à surveiller" : "à corriger";
  const adherence = summary.adherenceCalories != null ? Number(summary.adherenceCalories) * 100 : null;
  const adherenceState: GaugeState = adherence == null ? "à compléter" : adherence >= 85 ? "aligné" : adherence >= 70 ? "à surveiller" : "à corriger";
  const activityRatio = actualSteps != null && plannedSteps != null && plannedSteps > 0 ? actualSteps / plannedSteps : null;
  const activityState: GaugeState = activityRatio == null ? "à compléter" : activityRatio >= 0.8 && activityRatio <= 1.15 ? "aligné" : activityRatio >= 0.6 && activityRatio <= 1.35 ? "à surveiller" : "à corriger";
  const overreaching = performance?.analysis?.global_overreaching;
  const recoverySignals = [
    averages.sleep_duration != null ? clamp(((Number(averages.sleep_duration) - 5) / 3) * 100) : null,
    averages.energy != null ? clamp(Number(averages.energy) * 10) : null,
    overreaching === true ? 25 : overreaching === false ? 75 : null,
  ].filter((value): value is number => value != null);
  const recovery = recoverySignals.length ? recoverySignals.reduce((total, value) => total + value, 0) / recoverySignals.length : null;
  const recoveryState: GaugeState = recovery == null ? "à compléter" : recovery >= 70 ? "aligné" : recovery >= 50 ? "à surveiller" : "à corriger";
  const hasLiveDraft = nutritionDraft != null || workoutDraft != null;
  const cockpitState: GaugeState = [energyState, adherenceState, activityState, recoveryState].includes("à corriger")
    ? "à corriger"
    : [energyState, adherenceState, activityState, recoveryState].includes("à surveiller")
      ? "à surveiller"
      : [energyState, adherenceState, activityState, recoveryState].every((state) => state === "à compléter")
        ? "à compléter"
        : "aligné";

  const toggle = () => {
    const next = !open;
    setOpen(next);
    window.localStorage.setItem(`coach-client-pulse:${clientId}`, next ? "open" : "closed");
  };
  return (
    <>
      <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${open ? "Fermer" : "Ouvrir"} le cockpit de ${client.first_name}. État : ${GAUGE_STATE[cockpitState].label.toLowerCase()}.`} className={`group flex h-9 items-center gap-2 rounded-xl border px-3 transition-colors ${open ? "border-[#1f8a65]/50 bg-[#1f8a65]/10" : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16] hover:bg-white/[0.05]"}`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#1f8a65]/15 text-[9px] font-bold text-[#7fe0b8]">{initials(client.first_name, client.last_name)}</span>
        <span className="hidden text-[11px] font-semibold text-white/75 sm:inline">Cockpit</span>
        {cycleInsight && <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.06]" style={{ color: cycleInsight.phaseColor }} aria-label={`Cycle : ${cycleInsight.phaseLabel}`}><CircleDot size={13} /></span>}
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GAUGE_STATE[cockpitState].color }} aria-hidden="true" />
        {open ? <X size={13} className="text-white/40" /> : <ChevronDown size={13} className="text-white/35 transition-transform group-hover:translate-y-0.5" />}
      </button>

      {open && (
        <aside className="fixed right-4 top-[84px] z-50 max-h-[calc(100vh-104px)] w-[min(440px,calc(100vw-2rem))] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/[0.1] bg-[#171817]/[0.98] shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {client.profile_photo_url ? <img src={client.profile_photo_url} alt="" className="h-8 w-8 rounded-xl object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1f8a65]/15 text-[11px] font-bold text-[#7fe0b8]">{initials(client.first_name, client.last_name)}</span>}
              <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-white">{client.first_name} {client.last_name}</p><p className="text-[10px] text-white/35">Cockpit décisionnel · réalité + impact coach</p></div>
            </div>
            <button type="button" onClick={toggle} className="rounded-lg p-1.5 text-white/35 hover:bg-white/[0.06] hover:text-white/70" aria-label="Fermer"><X size={15} /></button>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3 text-[10px] font-medium text-white/65" aria-label="Légende des jauges">
                <span className="flex items-center gap-1.5 whitespace-nowrap"><i aria-hidden="true" className="h-2 w-2 rounded-full border border-[#0d0d0d] bg-[#dbe4df] shadow-[0_0_0_1px_rgba(219,228,223,0.28)]" />Réel</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap"><i aria-hidden="true" className="h-3 w-0.5 bg-white/55" />Plan</span>
                <span className="hidden items-center gap-1.5 whitespace-nowrap text-white/45 sm:flex"><i aria-hidden="true" className="h-1.5 w-4 rounded-full bg-[#1f8a65]/30" />Zone attendue</span>
              </div>
              <span className="shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: GAUGE_STATE[cockpitState].color, backgroundColor: GAUGE_STATE[cockpitState].background }}>{GAUGE_STATE[cockpitState].label}</span>
            </div>

            <CycleCockpitCard cycleState={data.cycleState} />

            <GaugeCard
              icon={Zap}
              title="Énergie & prescription"
              state={energyState}
              reality={energyReality == null ? null : clamp(((energyReality + 750) / 1500) * 100)}
              reference={energyPrescription == null ? null : clamp(((energyPrescription + 750) / 1500) * 100)}
              realityLabel={`Réel : ${energyLabel(energyReality)}`}
              referenceLabel={`${hasLiveDraft ? "Brouillon" : "Plan"} : ${energyLabel(energyPrescription)}`}
              summary={energyDifference == null ? "Apports et dépense requis pour comparer le terrain au plan." : `${Math.round(energyDifference)} kcal/j d’écart avec le plan`}
              method={`${adaptiveTdee != null ? "TDEE adaptatif" : "TDEE par formule"} comparé aux moyennes d’apports sur 7 jours. La projection du brouillon utilise les paramètres nutrition et entraînement actuellement édités.`}
              live={hasLiveDraft}
              tolerance={10}
            />

            <GaugeCard
              icon={Utensils}
              title="Adhérence nutritionnelle"
              state={adherenceState}
              reality={adherence}
              reference={85}
              realityLabel={`Observée : ${adherence == null ? "—" : `${Math.round(adherence)}%`}`}
              referenceLabel="Repère : ≥ 85%"
              summary={adherence == null ? "Aucune adhérence exploitable sur la fenêtre observée." : `${adherence >= 85 ? "+" : "−"}${Math.abs(Math.round(adherence - 85))} points par rapport au repère`}
              method="Calculé à partir de l’adhérence calorique sur la fenêtre nutritionnelle active. Ce signal décrit l’exécution observée ; il ne prédit pas l’adhérence future."
              tolerance={15}
            />

            <GaugeCard
              icon={Activity}
              title="Activité quotidienne"
              state={activityState}
              reality={activityRatio == null ? null : clamp(activityRatio * 50)}
              reference={50}
              realityLabel={`Observée : ${formatK(actualSteps)} pas/j`}
              referenceLabel={`Plan : ${formatK(plannedSteps)} pas/j`}
              summary={activityRatio == null ? "Objectif et relevé d’activité requis." : `${Math.round(activityRatio * 100)}% de l’objectif quotidien`}
              method="Moyenne de pas observée comparée à l’objectif défini dans le profil coach. La zone alignée couvre 80 à 115% de l’objectif."
              tolerance={8}
            />

            <GaugeCard
              icon={Moon}
              title="Récupération & capacité"
              state={recoveryState}
              reality={recovery}
              reference={65}
              realityLabel={`Disponibilité : ${recovery == null ? "—" : `${Math.round(recovery)}/100`}`}
              referenceLabel="Repère : ≥ 65"
              summary={recovery == null ? "Signaux de sommeil, d’énergie ou de charge requis." : Math.abs(recovery - 65) <= 2 ? "Au niveau du repère de disponibilité" : `${Math.abs(Math.round(recovery - 65))} points ${recovery > 65 ? "au-dessus" : "sous"} du repère`}
              method="Signal de disponibilité basé sur le sommeil et l’énergie des check-ins, complété par le signal de surcharge observée. C’est une aide à la décision, pas un diagnostic médical."
              tolerance={15}
            />

            <section className={`rounded-xl border px-3 py-3 ${hasLiveDraft ? "border-[#1f8a65]/35 bg-[#1f8a65]/[0.07]" : "border-white/[0.06] bg-white/[0.02]"}`}>
              <div className="flex items-center gap-2"><SlidersHorizontal size={13} className={hasLiveDraft ? "text-[#7fe0b8]" : "text-white/55"} /><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">Impact du coach</p></div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-white/45">{nutritionDraft ? "Nutrition Studio est reflété avant partage au client." : workoutDraft ? "Workout Studio est reflété dans la projection énergétique avant partage au client." : "Les brouillons Nutrition Studio et Workout Studio apparaissent ici, sans modifier le plan partagé."}</p>
              {workoutDraft && <p className="mt-2 text-[10px] text-[#dbe4df]">Brouillon entraînement : {workoutDraft.weeklyFrequency ?? "—"} séances{workoutDraft.setsWeekly != null ? ` · ${Math.round(workoutDraft.setsWeekly)} séries` : ""}{workoutDraft.trainingRir != null ? ` · RIR ${Math.round(workoutDraft.trainingRir * 10) / 10}` : ""}{tdeeDelta !== 0 ? ` · impact énergétique ${signed(tdeeDelta, " kcal/j")}` : ""}</p>}
            </section>

            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[10px] text-white/30"><span className="flex items-center gap-1.5"><Utensils size={12} /> {nutritionData?.mode === "realtime" ? "Sources temps réel sélectionnées" : "Sources bilan"}</span>{loading && <RefreshCw size={12} className="animate-spin text-white/45" />}</div>
          </div>
        </aside>
      )}
    </>
  );
}
