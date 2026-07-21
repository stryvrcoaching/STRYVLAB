"use client";

/**
 * Client Cockpit — decision seat while coaching one client.
 * Vision & rules: docs/COCKPIT_PRODUCT_CHARTER.md
 * Direction engine: lib/coach/cockpit-directions.ts
 * UI order is fixed: Direction → legend → cycle → gauges → draft impact.
 */

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
import { CLIENT_IMPACT_EVENT, type ClientImpactEventDetail } from "@/lib/coach/client-impact-events";
import { buildCycleCockpitInsight } from "@/lib/coach/cycle-cockpit";
import { computeCockpitSignals } from "@/lib/coach/cockpit-signals";
import {
  filterActiveDirections,
  markDirectionTreated,
  snoozeDirection,
} from "@/lib/coach/cockpit-direction-dismiss";
import type { GaugeState } from "@/lib/coach/cockpit-directions";
import type { CycleState } from "@/lib/cycle/cycleEngine";
import { CockpitDirectionsPanel } from "@/components/coach/CockpitDirectionsPanel";
import CoachConversationSheet from "@/components/coach/CoachConversationSheet";

type PulseData = {
  client: { first_name: string; last_name: string; profile_photo_url?: string | null; step_target?: number | null };
  nutrition: any | null;
  nutritionData: any | null;
  checkin: any | null;
  performance: any | null;
  cycleState: CycleState | null;
};

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
  /** Optional breakdown chips under the chart (e.g. NEAT · EAT) */
  chips,
}: {
  icon: typeof Activity;
  title: string;
  state: GaugeState;
  /** 0–100 position on spectrum (or absolute fill for dual-bar mode) */
  reality: number | null;
  reference?: number | null;
  realityLabel: string;
  referenceLabel?: string;
  summary: string;
  method: string;
  live?: boolean;
  tolerance?: number;
  chips?: Array<{ label: string; value: string; tone?: "real" | "plan" | "muted" }>;
}) {
  const stateMeta = GAUGE_STATE[state];
  const hasReality = reality != null && Number.isFinite(reality);
  const hasReference = reference != null && Number.isFinite(reference);
  const zoneStart = hasReference ? clamp(reference! - tolerance) : 20;
  const zoneEnd = hasReference ? clamp(reference! + tolerance) : 80;
  const realPct = hasReality ? clamp(reality!) : 0;
  const planPct = hasReference ? clamp(reference!) : 0;

  // Cap chips to 3 to keep the card scannable
  const visibleChips = chips?.slice(0, 3);

  return (
    <article className="rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-white/[0.015] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-black/25 text-white/65"
            style={{ boxShadow: `inset 0 0 0 1px ${stateMeta.color}22` }}
          >
            <Icon size={14} strokeWidth={2.15} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-white/85">
              {title}
            </h2>
            {live && (
              <p className="mt-0.5 text-[9px] font-medium text-[#7fe0b8]">
                Brouillon live
              </p>
            )}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: stateMeta.color, backgroundColor: stateMeta.background }}
        >
          {stateMeta.label}
        </span>
      </div>

      {/* Dual comparison bars */}
      <div
        className="mt-2.5 space-y-1.5"
        aria-label={`${title}. ${realityLabel}${referenceLabel ? `. ${referenceLabel}` : ""}`}
      >
        <div>
          <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px]">
            <span className="font-semibold uppercase tracking-[0.08em] text-white/45">
              Réel
            </span>
            <span className="truncate font-semibold tabular-nums text-white/85">
              {realityLabel}
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
            {hasReference && (
              <span
                className="absolute inset-y-0 rounded-full bg-[#1f8a65]/15"
                style={{ left: `${zoneStart}%`, width: `${Math.max(0, zoneEnd - zoneStart)}%` }}
                aria-hidden
              />
            )}
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{
                width: hasReality ? `${realPct}%` : "0%",
                background: hasReality
                  ? `linear-gradient(90deg, ${stateMeta.color}55, ${stateMeta.color})`
                  : "transparent",
              }}
            />
            {hasReference && (
              <span
                className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-white/70 shadow-[0_0_0_2px_rgba(13,13,13,0.85)]"
                style={{ left: `calc(${planPct}% - 1px)` }}
                title="Plan"
                aria-hidden
              />
            )}
          </div>
        </div>

        {hasReference && (
          <div>
            <div className="mb-0.5 flex items-center justify-between gap-2 text-[9px]">
              <span className="font-semibold uppercase tracking-[0.08em] text-white/35">
                Plan
              </span>
              <span className="truncate tabular-nums text-white/50">{referenceLabel}</span>
            </div>
            <div className="relative h-1 overflow-hidden rounded-full bg-white/[0.05]">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-white/25 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${planPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {visibleChips && visibleChips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleChips.map((chip) => (
            <span
              key={`${chip.label}-${chip.value}`}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-black/20 px-1.5 py-0.5 text-[9px] font-medium text-white/55"
            >
              <span className="text-white/35">{chip.label}</span>
              <span
                className={
                  chip.tone === "real"
                    ? "tabular-nums text-[#dbe4df]"
                    : chip.tone === "plan"
                      ? "tabular-nums text-white/70"
                      : "tabular-nums text-white/60"
                }
              >
                {chip.value}
              </span>
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium leading-snug text-white/70">
        <span
          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: stateMeta.color }}
        />
        {summary}
      </p>
      <details className="group mt-1.5">
        <summary className="cursor-pointer list-none text-[9px] text-white/28 transition-colors hover:text-white/55">
          <span className="group-open:hidden">Méthode</span>
          <span className="hidden group-open:inline">Masquer</span>
        </summary>
        <p className="mt-1 border-l border-white/10 pl-2 text-[9px] leading-relaxed text-white/32">
          {method}
        </p>
      </details>
    </article>
  );
}

function CycleGauge({ value, color, label, valueLabel }: { value: number; color: string; label: string; valueLabel: string }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const dash = Math.max(0, Math.min(1, value)) * circumference

  return (
    <div className="flex min-w-[64px] flex-col items-center gap-0.5 text-center">
      <div className="relative h-10 w-10">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-white">{valueLabel}</span>
      </div>
      <span className="text-[8px] uppercase tracking-[0.1em] text-white/40">{label}</span>
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
    ? 'Rythme variable'
    : insight.regularity === 'regular'
      ? 'Rythme cohérent'
      : 'Apprentissage'

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]">
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/20" style={{ color: insight.phaseColor }}><CircleDot size={14} /></span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-white">
              {insight.phaseLabel}
              <span className="ml-1.5 text-[9px] font-medium uppercase tracking-[0.08em] text-white/35">Cycle</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CycleGauge value={insight.phaseProgress} color={insight.phaseColor} label="Phase" valueLabel={`J${insight.cycleDay}`} />
          <CycleGauge value={insight.cycleProgress} color="#dbe4df" label="Cycle" valueLabel={`${insight.cycleDay}/${insight.cycleLength}`} />
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-medium text-white/50">
            {insight.isEstimated ? 'Est.' : 'OK'}
          </span>
        </div>
      </div>

      <div className="grid gap-px border-t border-white/[0.06] bg-white/[0.06] sm:grid-cols-3">
        {insight.signals.map((signal) => {
          const Icon = IconBySignal[signal.key]
          return (
            <div key={signal.key} className="bg-[#171817] px-2 py-1.5">
              <div className="flex items-center gap-1" style={{ color: insight.phaseColor }}>
                <Icon size={11} />
                <p className="text-[8px] font-semibold uppercase tracking-[0.08em]">{signal.label}</p>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/55">{signal.detail}</p>
            </div>
          )
        })}
      </div>
      <p className="border-t border-white/[0.05] px-2.5 py-1 text-[9px] text-white/35">
        {regularityLabel}{insight.isPeriodStartExpected ? ' · Début à confirmer' : ''}
      </p>
    </section>
  )
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
  const [dismissTick, setDismissTick] = useState(0);
  const [messageDraft, setMessageDraft] = useState<string | null>(null);

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

  if (!clientId || !data) return null;

  const { client, nutritionData } = data;
  const cycleInsight = buildCycleCockpitInsight(data.cycleState);
  const signals = computeCockpitSignals(clientId, data, {
    nutrition: nutritionDraft,
    workout: workoutDraft,
  });
  const {
    energyState,
    adherenceState,
    activityState,
    recoveryState,
    cockpitState,
    energyReality,
    energyPrescription,
    energyDifference,
    adherence,
    activityRatio,
    actualSteps,
    plannedSteps,
    activityBudget,
    recovery,
    hasLiveDraft,
  } = signals;

  // Force re-read dismiss map when dismissTick changes
  void dismissTick;
  const directions = filterActiveDirections(clientId, signals.directions);
  const primaryDirection = directions[0] ?? null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    window.localStorage.setItem(`coach-client-pulse:${clientId}`, next ? "open" : "closed");
  };
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${open ? "Fermer" : "Ouvrir"} le cockpit de ${client.first_name}. ${primaryDirection ? `Direction : ${primaryDirection.title}.` : ""} État : ${GAUGE_STATE[cockpitState].label.toLowerCase()}.`}
        className={`group flex h-9 max-w-[min(420px,46vw)] items-center gap-2 rounded-xl border px-3 transition-colors ${open ? "border-[#1f8a65]/50 bg-[#1f8a65]/10" : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16] hover:bg-white/[0.05]"}`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#1f8a65]/15 text-[9px] font-bold text-[#7fe0b8]">{initials(client.first_name, client.last_name)}</span>
        <span className="hidden shrink-0 text-[11px] font-semibold text-white/75 sm:inline">Cockpit</span>
        {primaryDirection && !open && (
          <span className="hidden min-w-0 truncate text-[11px] font-medium text-white/55 lg:inline">
            · {primaryDirection.title}
          </span>
        )}
        {cycleInsight && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.06]" style={{ color: cycleInsight.phaseColor }} aria-label={`Cycle : ${cycleInsight.phaseLabel}`}><CircleDot size={13} /></span>}
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: GAUGE_STATE[cockpitState].color }} aria-hidden="true" />
        {open ? (
          <X size={13} className="shrink-0 text-white/40" />
        ) : (
          <ChevronDown
            size={13}
            className="shrink-0 text-white/35 transition-transform group-hover:translate-y-0.5"
          />
        )}
      </button>

      {/* Horizontal header extension — keeps page readable below */}
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/25 backdrop-blur-[1px]"
            aria-label="Fermer le cockpit"
            onClick={toggle}
          />
          <aside
            className="fixed left-3 right-3 z-50 flex max-h-[min(48vh,520px)] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#141414]/[0.98] shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:left-4 sm:right-4"
            style={{ top: "calc(1rem + 3.5rem + 0.35rem)" }}
            role="dialog"
            aria-modal="true"
            aria-label={`Cockpit ${client.first_name} ${client.last_name}`}
          >
            {/* Extension header — denser chrome */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2 sm:px-4">
              <div className="flex min-w-0 items-center gap-2">
                {client.profile_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={client.profile_photo_url}
                    alt=""
                    className="h-7 w-7 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1f8a65]/15 text-[10px] font-bold text-[#7fe0b8]">
                    {initials(client.first_name, client.last_name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {client.first_name} {client.last_name}
                    <span className="ml-1.5 hidden font-medium text-white/35 sm:inline">
                      · Cockpit
                    </span>
                  </p>
                  <p className="truncate text-[11px] font-medium text-white/50">
                    {primaryDirection
                      ? primaryDirection.title
                      : "Réalité vs plan · prochaine action"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                  style={{
                    color: GAUGE_STATE[cockpitState].color,
                    backgroundColor: GAUGE_STATE[cockpitState].background,
                  }}
                >
                  {GAUGE_STATE[cockpitState].label}
                </span>
                <div
                  className="hidden items-center gap-2 text-[9px] text-white/40 lg:flex"
                  aria-label="Légende des jauges"
                >
                  <span className="flex items-center gap-1">
                    <i className="h-1.5 w-3 rounded-full bg-[#7fe0b8]/80" />
                    Réel
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="h-2.5 w-0.5 bg-white/70" />
                    Plan
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggle}
                  className="rounded-lg p-1 text-white/35 hover:bg-white/[0.06] hover:text-white/70"
                  aria-label="Fermer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Horizontal body: direction | signals */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid gap-0 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.4fr)]">
                {/* Left: decision */}
                <div className="space-y-2 border-b border-white/[0.06] p-2.5 sm:p-3 lg:border-b-0 lg:border-r lg:border-white/[0.06]">
                  <CockpitDirectionsPanel
                    directions={directions}
                    compact
                    onMessage={(dir) => {
                      if (dir.clientMessage) setMessageDraft(dir.clientMessage);
                    }}
                    onTreated={(id) => {
                      markDirectionTreated(clientId, id);
                      setDismissTick((t) => t + 1);
                    }}
                    onSnooze={(id) => {
                      snoozeDirection(clientId, id, 7);
                      setDismissTick((t) => t + 1);
                    }}
                  />
                  {(hasLiveDraft || nutritionDraft || workoutDraft) && (
                    <section className="rounded-lg border border-[#1f8a65]/35 bg-[#1f8a65]/[0.07] px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <SlidersHorizontal size={12} className="text-[#7fe0b8]" />
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/75">
                          Impact brouillon
                        </p>
                      </div>
                      <p className="mt-1 text-[10px] leading-snug text-white/50">
                        {nutritionDraft
                          ? "Nutrition Studio reflété avant partage."
                          : "Workout Studio reflété avant partage."}
                      </p>
                      {workoutDraft && (
                        <p className="mt-1 text-[11px] font-medium tabular-nums text-[#dbe4df]">
                          {workoutDraft.weeklyFrequency ?? "—"} séances
                          {workoutDraft.setsWeekly != null
                            ? ` · ${Math.round(workoutDraft.setsWeekly)} séries`
                            : ""}
                        </p>
                      )}
                    </section>
                  )}
                </div>

                {/* Right: cycle + gauges in compact grid */}
                <div className="space-y-2 p-2.5 sm:p-3">
                  <CycleCockpitCard cycleState={data.cycleState} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <GaugeCard
                      icon={Zap}
                      title="Énergie & prescription"
                      state={energyState}
                      reality={
                        energyReality == null
                          ? null
                          : clamp(((energyReality + 750) / 1500) * 100)
                      }
                      reference={
                        energyPrescription == null
                          ? null
                          : clamp(((energyPrescription + 750) / 1500) * 100)
                      }
                      realityLabel={`Réel : ${energyLabel(energyReality)}`}
                      referenceLabel={`${hasLiveDraft ? "Brouillon" : "Plan"} : ${energyLabel(energyPrescription)}`}
                      summary={
                        energyDifference == null
                          ? "Apports et dépense requis pour comparer le terrain au plan."
                          : `${Math.round(energyDifference)} kcal/j d’écart avec le plan`
                      }
                      method="TDEE (adaptatif ou formule) vs apports moyens 7j. Brouillon studio inclus dans la projection."
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
                      summary={
                        adherence == null
                          ? "Aucune adhérence exploitable sur la fenêtre observée."
                          : `${adherence >= 85 ? "+" : "−"}${Math.abs(Math.round(adherence - 85))} pts vs repère`
                      }
                      method="Adhérence calorique sur la fenêtre nutritionnelle active."
                      tolerance={15}
                    />
                    <GaugeCard
                      icon={Activity}
                      title="Activité (NEAT + EAT)"
                      state={activityState}
                      reality={
                        activityBudget.reality.totalKcalDay != null &&
                        activityBudget.plan.totalKcalDay != null &&
                        activityBudget.plan.totalKcalDay > 0
                          ? clamp(
                              (activityBudget.reality.totalKcalDay /
                                activityBudget.plan.totalKcalDay) *
                                50,
                            )
                          : activityRatio == null
                            ? null
                            : clamp(activityRatio * 50)
                      }
                      reference={50}
                      realityLabel={
                        activityBudget.reality.totalKcalDay != null
                          ? `Réel : ${Math.round(activityBudget.reality.totalKcalDay)} kcal/j`
                          : actualSteps != null
                            ? `Réel : ${formatK(actualSteps)} pas/j`
                            : "Réel : —"
                      }
                      referenceLabel={
                        activityBudget.plan.totalKcalDay != null
                          ? `Plan : ${Math.round(activityBudget.plan.totalKcalDay)} kcal/j`
                          : plannedSteps != null
                            ? `Plan : ${formatK(plannedSteps)} pas/j`
                            : "Plan : —"
                      }
                      summary={activityBudget.summary}
                      method={activityBudget.method}
                      tolerance={8}
                      chips={[
                        ...(activityBudget.reality.neatKcalDay != null ||
                        activityBudget.plan.neatKcalDay != null
                          ? [
                              {
                                label: "NEAT",
                                value:
                                  activityBudget.reality.neatKcalDay != null
                                    ? `${Math.round(activityBudget.reality.neatKcalDay)}`
                                    : "—",
                                tone: "real" as const,
                              },
                            ]
                          : []),
                        ...(activityBudget.reality.eatKcalDay != null ||
                        activityBudget.plan.eatKcalDay != null
                          ? [
                              {
                                label: "EAT",
                                value:
                                  activityBudget.reality.eatKcalDay != null
                                    ? `${Math.round(activityBudget.reality.eatKcalDay)}`
                                    : activityBudget.plan.eatKcalDay != null
                                      ? `p${Math.round(activityBudget.plan.eatKcalDay)}`
                                      : "—",
                                tone: "real" as const,
                              },
                            ]
                          : []),
                        ...(actualSteps != null
                          ? [
                              {
                                label: "Pas",
                                value: `${Math.round(actualSteps)}`,
                                tone: "muted" as const,
                              },
                            ]
                          : []),
                        ...(activityBudget.reality.strengthSessionsPerWeek !=
                          null ||
                        activityBudget.plan.strengthSessionsPerWeek != null
                          ? [
                              {
                                label: "Séances",
                                value: `${activityBudget.reality.strengthSessionsPerWeek ?? "—"}/${activityBudget.plan.strengthSessionsPerWeek ?? "—"}`,
                                tone: "plan" as const,
                              },
                            ]
                          : []),
                        ...(activityBudget.reality.cardioSessionsPerWeek !=
                          null
                          ? [
                              {
                                label: "Cardio log",
                                value: `${activityBudget.reality.cardioSessionsPerWeek}/sem`,
                                tone: "muted" as const,
                              },
                            ]
                          : []),
                      ]}
                    />
                    <GaugeCard
                      icon={Moon}
                      title="Récupération & capacité"
                      state={recoveryState}
                      reality={recovery}
                      reference={65}
                      realityLabel={`Disponibilité : ${recovery == null ? "—" : `${Math.round(recovery)}/100`}`}
                      referenceLabel="Repère : ≥ 65"
                      summary={
                        recovery == null
                          ? "Signaux de sommeil, d’énergie ou de charge requis."
                          : Math.abs(recovery - 65) <= 2
                            ? "Au niveau du repère de disponibilité"
                            : `${Math.abs(Math.round(recovery - 65))} pts ${recovery > 65 ? "au-dessus" : "sous"} le repère`
                      }
                      method="Sommeil + énergie check-in + signal de surcharge. Aide à la décision, pas diagnostic."
                      tolerance={15}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5 text-[9px] text-white/28">
                    <span className="flex items-center gap-1">
                      <Utensils size={11} />
                      {nutritionData?.mode === "realtime"
                        ? "Temps réel · pas + séances + activités"
                        : "Sources bilan"}
                    </span>
                    {loading && (
                      <RefreshCw
                        size={11}
                        className="animate-spin text-white/45"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      <CoachConversationSheet
        notification={
          messageDraft
            ? {
                clientId,
                clientName: `${client.first_name} ${client.last_name}`,
                messageExcerpt: null,
                draftContent: messageDraft,
              }
            : null
        }
        onClose={() => setMessageDraft(null)}
        onSent={() => setMessageDraft(null)}
      />
    </>
  );
}
