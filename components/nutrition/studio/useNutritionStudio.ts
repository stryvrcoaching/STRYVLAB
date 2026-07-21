"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { readLocalStorage, writeLocalStorage } from "@/lib/client/browserStorage";
import type { MacroOverrides } from "./MacroSliders";
import {
  calculateMacros,
  computeSmartPreset,
  type MacroGoal,
  type MacroGender,
  type MacroResult,
} from "@/lib/formulas/macros";
import {
  calculateHydration,
  type HydrationClimate,
} from "@/lib/formulas/hydration";
import {
  type DayDraft,
  type NutritionProtocol,
  type NutritionClientData,
  emptyDayDraft,
  dayDraftFromDb,
} from "@/lib/nutrition/types";
import type { BMRSource } from "@/lib/nutrition/calculators";
import type { CycleState } from "@/lib/cycle/cycleEngine";
import type { CyclePhaseObservation } from "@/lib/cycle/cycle-phase-observations";
import {
  DEFAULT_CYCLE_SYNC_PROFILE,
  normalizeCycleSyncProfile,
  type CycleSyncProfile,
} from "@/lib/nutrition/cycle-sync-profile";
import type { TrainingWeekSchedule } from "@/lib/nutrition/training-week-schedule";
import { buildNutritionDataQualitySummary } from "@/lib/nutrition/dataQuality";
import {
  getNutritionSignalLabel,
  type NutritionSignalKey,
} from "@/lib/nutrition/dataGovernance";
import {
  computePhaseDrivenCalorieAdjustPct,
  inferTransformationPhaseFromTrainingGoal,
  resolveTransformationPhase,
  transformationPhaseToMacroGoal,
  type TransformationPhase,
} from "@/lib/coach/transformationPhase";
import type { TdeeEstimationStatus } from "@/lib/nutrition/tdee-quality";
import {
  buildPhaseProtocolPreview,
  type PhaseProtocolPreview,
  type ProtocolMacroTarget,
} from "@/lib/nutrition/phase-protocol-recalibration";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "veryActive";

export interface TrainingConfig {
  weeklyFrequency: number;
  sessionDurationMin: number;
  cardioFrequency: number;
  cardioDurationMin: number;
  dailySteps: number;
  trainingCaloriesWeekly: number | null;
}

export interface LifestyleConfig {
  stressLevel: number | null;
  sleepDurationH: number | null;
  sleepQuality: number | null;
  caffeineDailyMg: number | null;
  alcoholWeekly: number | null;
  workHoursPerWeek: number | null;
}

export interface BiometricsConfig {
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  lean_mass_kg: number | null;
  muscle_mass_kg: number | null;
  visceral_fat_level: number | null;
  bmr_kcal_measured: number | null;
  bmr_source: BMRSource;
}

const ACTIVITY_STEPS: Record<ActivityLevel, number> = {
  sedentary: 2000,
  light: 4000,
  moderate: 7000,
  active: 11000,
  veryActive: 15000,
};

const HYDRATION_ACTIVITY_MAP: Record<
  ActivityLevel,
  "sedentary" | "light" | "moderate" | "intense" | "athlete"
> = {
  sedentary: "sedentary",
  light: "light",
  moderate: "moderate",
  active: "intense",
  veryActive: "athlete",
};

function resolveStudioPhase(client: Pick<NutritionClientData, "transformation_phase" | "training_goal">) {
  return resolveTransformationPhase({
    transformationPhase: client.transformation_phase,
    trainingGoal: client.training_goal,
  });
}

function getActivityLevel(clientData: NutritionClientData): ActivityLevel {
  const freq = clientData.weekly_frequency ?? 0;
  if (freq === 0) return "sedentary";
  if (freq <= 2) return "light";
  if (freq <= 3) return "moderate";
  if (freq <= 5) return "active";
  return "veryActive";
}

export interface TdeeHistoryEntry {
  id: string
  calculated_at: string
  tdee_formula: number
  tdee_adaptive: number
  delta_kcal: number
  weight_samples: number
  calories_source: 'logs' | 'protocol'
  avg_intake_kcal: number
  weight_delta_kg: number
  protocol_updated: boolean
  confidence?: 'high' | 'medium' | 'low'
  confidence_score?: number
  confidence_reasons?: string[]
  window_days?: number
  tdee_lower?: number
  tdee_upper?: number
  complete_days?: number
  context_changed?: boolean
}

type TdeeDataSource = 'weight_delta' | 'formula_proxy' | null
type TdeeStabilityStatus = 'stable' | 'watch' | 'action' | null

function dedupeTdeeHistoryByDisplayedDate(entries: TdeeHistoryEntry[]) {
  const seen = new Set<string>()
  const deduped: TdeeHistoryEntry[] = []

  for (const entry of entries) {
    const key = new Date(entry.calculated_at).toLocaleDateString('en-CA')
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(entry)
  }

  return deduped
}

export type ScheduleSlotDraft = {
  week_index: number
  dow: number
  protocol_day_position: number
}

export type NutritionDataMode = "bilan" | "realtime";
export type StudioShareIssue = {
  severity: "blocking" | "warning";
  message: string;
};

export type CoherenceCheck = {
  label: string;
  ok: boolean;
  warning?: string;
};

export type CoherenceScoreData = {
  score: number;
  checks: CoherenceCheck[];
  summary: string;
  strengths: string[];
  cautions: string[];
  nextStep?: string;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNutritionStudio(
  clientId: string,
  existingProtocol?: NutritionProtocol,
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataModeStorageKey = useMemo(
    () => `nutrition_studio_data_mode:${clientId}`,
    [clientId],
  );

  const [clientData, setClientData] = useState<NutritionClientData | null>(
    null,
  );
  const [clientLoading, setClientLoading] = useState(true);
  const [foodProfileStatus, setFoodProfileStatus] = useState<
    "loading" | "unknown" | "none" | "declared"
  >("loading");
  const [protocolName, setProtocolName] = useState(
    existingProtocol?.name ?? "Nouveau protocole",
  );
  const [goal, setGoal] = useState<MacroGoal>("surplus");
  const [transformationPhase, setTransformationPhase] = useState<TransformationPhase>(
    inferTransformationPhaseFromTrainingGoal("hypertrophy"),
  );
  const [calorieAdjustPct, setCalorieAdjustPct] = useState(0);

  const [proteinOverride, setProteinOverride] = useState<number | null>(null);
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>({
    weeklyFrequency: 3,
    sessionDurationMin: 60,
    cardioFrequency: 0,
    cardioDurationMin: 0,
    dailySteps: 0,
    trainingCaloriesWeekly: null,
  });
  const [lifestyleConfig, setLifestyleConfig] = useState<LifestyleConfig>({
    stressLevel: null,
    sleepDurationH: null,
    sleepQuality: null,
    caffeineDailyMg: null,
    alcoholWeekly: null,
    workHoursPerWeek: null,
  });
  const [biometricsConfig, setBiometricsConfig] = useState<BiometricsConfig>({
    weight_kg: null,
    height_cm: null,
    body_fat_pct: null,
    lean_mass_kg: null,
    muscle_mass_kg: null,
    visceral_fat_level: null,
    bmr_kcal_measured: null,
    bmr_source: "estimated",
  });

  const setGoalWithPreset = useCallback(
    (newGoal: MacroGoal) => {
      setGoal(newGoal);
      const bf =
        biometricsConfig.body_fat_pct ?? clientData?.body_fat_pct ?? null;
      setCalorieAdjustPct(
        computeSmartPreset(newGoal, bf, trainingConfig.weeklyFrequency),
      );
    },
    [
      biometricsConfig.body_fat_pct,
      clientData?.body_fat_pct,
      trainingConfig.weeklyFrequency,
    ],
  );

  const [macroOverrides, setMacroOverrides] = useState<MacroOverrides>({
    protein_g: null,
    fat_g: null,
    carbs_g: null,
  });
  const [cycleSyncEnabled, setCycleSyncEnabled] = useState<boolean>(false);
  const [cycleSyncProfile, setCycleSyncProfile] = useState<CycleSyncProfile>(DEFAULT_CYCLE_SYNC_PROFILE);
  const [cyclePhaseObservations, setCyclePhaseObservations] = useState<CyclePhaseObservation[]>([]);
  const [hydrationClimate, setHydrationClimate] =
    useState<HydrationClimate>("temperate");
  const [hydrationPhase, setHydrationPhase] = useState(100); // 0–200, 100 = baseline
  // Separate ref for the base hydration (before phase factor) — updated by debounced recalc
  const baseHydrationLitersRef = useRef<number | null>(null);
  const [days, setDays] = useState<DayDraft[]>([
    { ...emptyDayDraft("Jour entraînement"), role: "training" },
    { ...emptyDayDraft("Jour repos"), role: "rest" },
  ]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [macroResult, setMacroResult] = useState<MacroResult | null>(null);
  const [phaseSyncBaseTarget, setPhaseSyncBaseTarget] = useState<ProtocolMacroTarget | null>(null);
  // Calories after goal factor but before calorieAdjustPct — used by the adjustment slider display
  const [goalCalories, setGoalCalories] = useState<number | null>(null);

  const captureProtocolTarget = useCallback(() => {
    if (macroResult && !phaseSyncBaseTarget) {
      setPhaseSyncBaseTarget({ calories: macroResult.calories, protein: macroResult.macros.p, carbs: macroResult.macros.c, fat: macroResult.macros.f });
    }
  }, [macroResult, phaseSyncBaseTarget]);

  const setCalorieAdjustPctWithProtocolSync = useCallback((value: number) => {
    captureProtocolTarget();
    setCalorieAdjustPct(value);
  }, [captureProtocolTarget]);

  const setMacroOverridesWithProtocolSync = useCallback((value: MacroOverrides) => {
    captureProtocolTarget();
    setMacroOverrides(value);
  }, [captureProtocolTarget]);

  const setTransformationPhaseWithPreset = useCallback(
    (newPhase: TransformationPhase) => {
      captureProtocolTarget();
      setTransformationPhase(newPhase);
      const bf = biometricsConfig.body_fat_pct ?? clientData?.body_fat_pct ?? null;
      const mappedGoal = transformationPhaseToMacroGoal(newPhase);
      setGoal(mappedGoal);
      setCalorieAdjustPct(computePhaseDrivenCalorieAdjustPct({ phase: newPhase, bodyFat: bf, weeklyFrequency: trainingConfig.weeklyFrequency, basePreset: computeSmartPreset }));
    },
    [biometricsConfig.body_fat_pct, captureProtocolTarget, clientData?.body_fat_pct, trainingConfig.weeklyFrequency],
  );
  const [hydrationLiters, setHydrationLiters] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [savedProtocolId, setSavedProtocolId] = useState<string | null>(
    existingProtocol?.id ?? null,
  );
  const [tdeeAdaptive, setTdeeAdaptive] = useState<number | null>(null);
  const [tdeeAdaptiveAt, setTdeeAdaptiveAt] = useState<Date | null>(null);
  const [tdeeAdaptiveLower, setTdeeAdaptiveLower] = useState<number | null>(null);
  const [tdeeAdaptiveUpper, setTdeeAdaptiveUpper] = useState<number | null>(null);
  const [tdeeObserved, setTdeeObserved] = useState<number | null>(null);
  const [tdeeObservedLower, setTdeeObservedLower] = useState<number | null>(null);
  const [tdeeObservedUpper, setTdeeObservedUpper] = useState<number | null>(null);
  const [tdeeActionableStreak, setTdeeActionableStreak] = useState(0);
  const [tdeeDataSource, setTdeeDataSource] = useState<TdeeDataSource>(null);
  const [tdeeHistory, setTdeeHistory] = useState<TdeeHistoryEntry[]>([]);
  const [tdeeStabilityStatus, setTdeeStabilityStatus] = useState<TdeeStabilityStatus>(null);
  const [tdeeLastSkipReason, setTdeeLastSkipReason] = useState<string | null>(null);
  const [tdeeLastSuccessAt, setTdeeLastSuccessAt] = useState<Date | null>(null);
  const [tdeeProtocolStartDate, setTdeeProtocolStartDate] = useState<string | null>(null);
  const [tdeeEstimationStatus, setTdeeEstimationStatus] = useState<TdeeEstimationStatus>('collecting');
  const [tdeeDataQualityScore, setTdeeDataQualityScore] = useState<number | null>(null);
  const [tdeeDataQualityReasons, setTdeeDataQualityReasons] = useState<string[]>([]);
  const [tdeeError, setTdeeError] = useState<string | null>(null);
  const [applyingAdaptive, setApplyingAdaptive] = useState(false);
  const [tdeeAutoEnabled, setTdeeAutoEnabled] = useState<boolean>(existingProtocol?.tdee_auto_enabled ?? false);
  const [tdeeAdaptiveActive, setTdeeAdaptiveActive] = useState<boolean>(existingProtocol?.tdee_adaptive_active ?? false);
  const [dataMode, setDataMode] = useState<NutritionDataMode>(() => {
    const stored = readLocalStorage(`nutrition_studio_data_mode:${clientId}`);
    return stored === "realtime" ? "realtime" : "bilan";
  });
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<
    string | null
  >(null);
  // Server-resolved submission ID — which bilan the server actually used.
  // Separate from selectedSubmissionId so setting it doesn't re-trigger the fetch effect.
  const [resolvedSubmissionId, setResolvedSubmissionId] = useState<string | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<
    Array<{ id: string; date: string; status: string; submitted_at: string }>
  >([]);
  const [dataSource, setDataSource] = useState<
    Record<string, "selected" | "fallback" | "manual" | "estimated">
  >({});
  const [anchorDate, setAnchorDate] = useState<string | null>(null);
  const [realtimeWindowDays, setRealtimeWindowDays] = useState<number>(7);
  const [trainingWeekSchedule, setTrainingWeekSchedule] =
    useState<TrainingWeekSchedule | null>(null);
  const [selectedScheduleDow, setSelectedScheduleDow] = useState<number | null>(
    null,
  );
  const [scheduleStartDate, setScheduleStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlotDraft[]>([]);
  const [cycleState, setCycleState] = useState<CycleState | null>(null);

  useEffect(() => {
    writeLocalStorage(dataModeStorageKey, dataMode);
  }, [dataMode, dataModeStorageKey]);

  useEffect(() => {
    const stored = readLocalStorage(dataModeStorageKey);
    setDataMode(stored === "realtime" ? "realtime" : "bilan");
  }, [dataModeStorageKey]);

  useEffect(() => {
    let cancelled = false;
    const loadFoodProfile = async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/food-profile`, {
          cache: "no-store",
        });
        const payload = response.ok ? await response.json() : null;
        if (!cancelled) setFoodProfileStatus(payload?.status ?? "unknown");
      } catch {
        if (!cancelled) setFoodProfileStatus("unknown");
      }
    };
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ clientId?: string }>).detail;
      if (!detail?.clientId || detail.clientId === clientId) void loadFoodProfile();
    };
    void loadFoodProfile();
    window.addEventListener("stryv:food-profile-updated", onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("stryv:food-profile-updated", onUpdated);
    };
  }, [clientId]);

  // ── Fetch client data ──────────────────────────────────────────────────────
  useEffect(() => {
    setClientLoading(true);
    const url = new URL(
      `/api/clients/${clientId}/nutrition-data`,
      typeof window !== "undefined" ? window.location.origin : "",
    );
    url.searchParams.set("mode", dataMode);
    if (existingProtocol?.id) {
      url.searchParams.set("protocolId", existingProtocol.id);
    }
    if (dataMode === "bilan" && selectedSubmissionId) {
      url.searchParams.set("submissionId", selectedSubmissionId);
    }
    fetch(url.toString())
      .then((r) => r.json())
      .then((d) => {
        const cd: NutritionClientData = d.client;
        setClientData(cd);
        if (d.allSubmissions) {
          setAllSubmissions(d.allSubmissions);
        }
        if (d.selectedSubmissionId) {
          setResolvedSubmissionId(d.selectedSubmissionId);
        }
        if (d.dataSource) {
          setDataSource(d.dataSource);
        }
        setAnchorDate(d.anchorDate ?? null);
        setRealtimeWindowDays(
          typeof d.realtimeWindowDays === "number" ? d.realtimeWindowDays : 7,
        );
        setTdeeAdaptive(typeof d.tdeeAdaptive === 'number' ? d.tdeeAdaptive : null);
        setTdeeAdaptiveAt(d.tdeeAdaptiveAt ? new Date(d.tdeeAdaptiveAt) : null);
        setTdeeAdaptiveLower(typeof d.tdeeAdaptiveLower === 'number' ? d.tdeeAdaptiveLower : null);
        setTdeeAdaptiveUpper(typeof d.tdeeAdaptiveUpper === 'number' ? d.tdeeAdaptiveUpper : null);
        setTdeeObserved(typeof d.tdeeObserved === 'number' ? d.tdeeObserved : null);
        setTdeeObservedLower(typeof d.tdeeObservedLower === 'number' ? d.tdeeObservedLower : null);
        setTdeeObservedUpper(typeof d.tdeeObservedUpper === 'number' ? d.tdeeObservedUpper : null);
        setTdeeActionableStreak(typeof d.tdeeActionableStreak === 'number' ? d.tdeeActionableStreak : 0);
        setTdeeDataSource((d.tdeeDataSource ?? null) as TdeeDataSource);
        setTdeeStabilityStatus((d.tdeeStabilityStatus ?? null) as TdeeStabilityStatus);
        setTdeeLastSkipReason(d.tdeeLastSkipReason ?? null);
        setTdeeLastSuccessAt(d.tdeeLastSuccessAt ? new Date(d.tdeeLastSuccessAt) : null);
        setTdeeProtocolStartDate(d.tdeeProtocolStartDate ?? null);
        setTdeeEstimationStatus((d.tdeeEstimationStatus ?? 'collecting') as TdeeEstimationStatus);
        setTdeeDataQualityScore(typeof d.tdeeDataQualityScore === 'number' ? d.tdeeDataQualityScore : null);
        setTdeeDataQualityReasons(Array.isArray(d.tdeeDataQualityReasons) ? d.tdeeDataQualityReasons : []);
        if (d.trainingWeekSchedule) {
          setTrainingWeekSchedule(d.trainingWeekSchedule);
        } else {
          setTrainingWeekSchedule(null);
        }
        const resolvedPhase = resolveStudioPhase(cd);
        const mappedGoal = transformationPhaseToMacroGoal(resolvedPhase);
        setTransformationPhase(resolvedPhase);
        setGoal(mappedGoal);
        setCalorieAdjustPct(
          computePhaseDrivenCalorieAdjustPct({
            phase: resolvedPhase,
            bodyFat: cd.body_fat_pct ?? null,
            weeklyFrequency: cd.weekly_frequency ?? 0,
            basePreset: computeSmartPreset,
          }),
        );
        setTrainingConfig({
          weeklyFrequency: cd.weekly_frequency ?? 3,
          sessionDurationMin: cd.session_duration_min ?? 60,
          cardioFrequency: cd.cardio_frequency ?? 0,
          cardioDurationMin: cd.cardio_duration_min ?? 0,
          dailySteps: cd.daily_steps ?? 0,
          trainingCaloriesWeekly: cd.training_calories_weekly,
        });
        setLifestyleConfig({
          stressLevel: cd.stress_level,
          sleepDurationH: cd.sleep_duration_h,
          sleepQuality: cd.sleep_quality,
          caffeineDailyMg: cd.caffeine_daily_mg,
          alcoholWeekly: cd.alcohol_weekly,
          workHoursPerWeek: cd.work_hours_per_week,
        });
        setBiometricsConfig({
          weight_kg: cd.weight_kg,
          height_cm: cd.height_cm,
          body_fat_pct: cd.body_fat_pct,
          lean_mass_kg: cd.lean_mass_kg,
          muscle_mass_kg: cd.muscle_mass_kg,
          visceral_fat_level: cd.visceral_fat_level,
          bmr_kcal_measured: cd.bmr_kcal_measured,
          bmr_source: cd.bmr_kcal_measured ? "measured" : "estimated",
        });
      })
      .then(() => {
        // Load TDEE history for current client
        const historyUrl = new URL(
          `/api/clients/${clientId}/nutrition-tdee-history`,
          typeof window !== "undefined" ? window.location.origin : "",
        );
        if (existingProtocol?.id) {
          historyUrl.searchParams.set("protocolId", existingProtocol.id);
        }
        fetch(historyUrl.toString())
          .then(r => r.ok ? r.json() : { history: [] })
          .then((historyData) => {
            setTdeeHistory(
              dedupeTdeeHistoryByDisplayedDate(
                Array.isArray(historyData?.history) ? historyData.history : [],
              ),
            );
            setTdeeStabilityStatus((historyData?.stabilityStatus ?? null) as TdeeStabilityStatus);
            setTdeeLastSkipReason(historyData?.lastSkipReason ?? null);
            setTdeeEstimationStatus((historyData?.estimationStatus ?? 'collecting') as TdeeEstimationStatus);
            setTdeeDataQualityScore(typeof historyData?.dataQualityScore === 'number' ? historyData.dataQualityScore : null);
            setTdeeDataQualityReasons(Array.isArray(historyData?.dataQualityReasons) ? historyData.dataQualityReasons : []);
            setTdeeAdaptive(typeof historyData?.clientTdee === 'number' ? historyData.clientTdee : null);
            setTdeeAdaptiveAt(historyData?.clientTdeeAt ? new Date(historyData.clientTdeeAt) : null);
            setTdeeAdaptiveLower(typeof historyData?.clientTdeeLower === 'number' ? historyData.clientTdeeLower : null);
            setTdeeAdaptiveUpper(typeof historyData?.clientTdeeUpper === 'number' ? historyData.clientTdeeUpper : null);
            setTdeeObserved(typeof historyData?.observedTdee === 'number' ? historyData.observedTdee : null);
            setTdeeObservedLower(typeof historyData?.observedTdeeLower === 'number' ? historyData.observedTdeeLower : null);
            setTdeeObservedUpper(typeof historyData?.observedTdeeUpper === 'number' ? historyData.observedTdeeUpper : null);
            setTdeeActionableStreak(typeof historyData?.actionableStreak === 'number' ? historyData.actionableStreak : 0);
          })
          .catch(() => {})
        // Load cycle state (best-effort, non-blocking)
        fetch(`/api/clients/${clientId}/cycle/status`)
          .then(r => r.ok ? r.json() : { cycleState: null })
          .then(d => {
            setCycleState(d.cycleState ?? null)
            setCyclePhaseObservations(Array.isArray(d.phaseObservations) ? d.phaseObservations : [])
          })
          .catch(() => {})
      })
      .catch(() => {})
      .finally(() => setClientLoading(false));
  }, [clientId, dataMode, selectedSubmissionId, existingProtocol?.id]);

  // ── Load existing protocol days ────────────────────────────────────────────
  useLayoutEffect(() => {
    if (existingProtocol?.days?.length) {
      setDays(existingProtocol.days.map(dayDraftFromDb));
      setProtocolName(existingProtocol.name);
    }
    if (existingProtocol?.schedule_start_date) {
      setScheduleStartDate(existingProtocol.schedule_start_date);
    }
    if (existingProtocol?.schedule_slots) {
      setScheduleSlots(
        existingProtocol.schedule_slots.map((slot) => ({
          week_index: slot.week_index,
          dow: slot.dow,
          protocol_day_position: slot.protocol_day_position,
        })),
      );
    }
    if (existingProtocol?.cycle_sync_enabled !== undefined) {
      setCycleSyncEnabled(existingProtocol.cycle_sync_enabled);
    }
    if (existingProtocol?.cycle_sync_profile) {
      setCycleSyncProfile(normalizeCycleSyncProfile(existingProtocol.cycle_sync_profile));
    }
    if (existingProtocol?.tdee_auto_enabled !== undefined) {
      setTdeeAutoEnabled(existingProtocol.tdee_auto_enabled);
    }
    if (existingProtocol?.tdee_adaptive_active !== undefined) {
      setTdeeAdaptiveActive(existingProtocol.tdee_adaptive_active);
    }
    if (existingProtocol?.tdee_adaptive != null) {
      setTdeeAdaptive(existingProtocol.tdee_adaptive);
    }
    if (existingProtocol?.tdee_adaptive_at) {
      setTdeeAdaptiveAt(new Date(existingProtocol.tdee_adaptive_at));
    }
    if (existingProtocol?.tdee_data_source) {
      setTdeeDataSource(existingProtocol.tdee_data_source);
    }
  }, [existingProtocol]);

  // ── Debounced recalculation ────────────────────────────────────────────────
  useEffect(() => {
    if (!clientData) return;

    // biometricsConfig overrides clientData — allows ParameterAdjustmentPanel edits to apply
    const weight = biometricsConfig.weight_kg ?? clientData.weight_kg;
    const height = biometricsConfig.height_cm ?? clientData.height_cm;
    const age = clientData.age;
    if (weight == null || height == null || age == null) return;

    const cd = clientData;
    const gender: MacroGender = cd.gender === "female" ? "female" : "male";

    const recalculate = () => {
      const dataQuality = buildNutritionDataQualitySummary({
        clientData: cd,
        dataMode,
        dataSource,
      });
      const useRealtimeBodyEstimate = dataMode === "realtime";
      const input = {
        weight,
        height,
        age,
        gender,
        goal,
        dataMode,
        bodyFat: useRealtimeBodyEstimate
          ? undefined
          : (biometricsConfig.body_fat_pct ?? cd.body_fat_pct ?? undefined),
        muscleMassKg: useRealtimeBodyEstimate
          ? undefined
          : (biometricsConfig.muscle_mass_kg ?? cd.muscle_mass_kg ?? undefined),
        bmrKcalMeasured: useRealtimeBodyEstimate
          ? undefined
          : (biometricsConfig.bmr_kcal_measured ?? cd.bmr_kcal_measured ?? undefined),
        visceralFatLevel: useRealtimeBodyEstimate
          ? undefined
          : (biometricsConfig.visceral_fat_level ?? cd.visceral_fat_level ?? undefined),
        steps: trainingConfig.dailySteps || undefined,
        occupationMultiplier: cd.occupation_multiplier ?? undefined,
        workHoursPerWeek: lifestyleConfig.workHoursPerWeek ?? undefined,
        workouts: trainingConfig.weeklyFrequency,
        sessionDurationMin: trainingConfig.sessionDurationMin,
        trainingCaloriesWeekly:
          trainingConfig.trainingCaloriesWeekly ?? undefined,
        cardioFrequency: trainingConfig.cardioFrequency || undefined,
        cardioDurationMin: trainingConfig.cardioDurationMin || undefined,
        stressLevel: lifestyleConfig.stressLevel ?? undefined,
        sleepDurationH: lifestyleConfig.sleepDurationH ?? undefined,
        sleepQuality: lifestyleConfig.sleepQuality ?? undefined,
        caffeineDaily: lifestyleConfig.caffeineDailyMg ?? undefined,
        alcoholWeekly: lifestyleConfig.alcoholWeekly ?? undefined,
        dataQuality,
      };

      const result = calculateMacros(input);
      // If adaptive TDEE is active and calculated, use it as the base instead of formula
      const tdee = (tdeeAdaptiveActive && tdeeAdaptive != null) ? tdeeAdaptive : result.tdee;
      if (tdeeAdaptiveActive && tdeeAdaptive != null) result.tdee = tdeeAdaptive;
      setGoalCalories(tdee);
      const targetCal = Math.round(tdee * (1 + calorieAdjustPct / 100));
      result.calories = targetCal;
      // Carbs absorb delta when not manually overridden
      if (!macroOverrides.carbs_g) {
        const remaining = targetCal - result.macros.p * 4 - result.macros.f * 9;
        result.macros.c = Math.max(0, Math.round(remaining / 4));
        // Recompute from actual rounded macros so MacroSliders and CalorieAdjustmentDisplay are always in sync
        result.calories = result.macros.p * 4 + result.macros.f * 9 + result.macros.c * 4;
      }
      // Apply macro overrides — each overridden macro becomes source of truth
      // Calories = P×4 + L×9 + G×4 (all effective values)
      if (macroOverrides.protein_g !== null) result.macros.p = macroOverrides.protein_g;
      if (macroOverrides.fat_g !== null) result.macros.f = macroOverrides.fat_g;
      if (macroOverrides.carbs_g !== null) result.macros.c = macroOverrides.carbs_g;
      if (macroOverrides.protein_g !== null || macroOverrides.fat_g !== null || macroOverrides.carbs_g !== null) {
        result.calories = Math.round(result.macros.p * 4 + result.macros.f * 9 + result.macros.c * 4);
      }
      // Legacy proteinOverride (g/kg LBM) — applied only when no direct g override
      if (proteinOverride != null && macroOverrides.protein_g === null) {
        result.macros.p = Math.round(proteinOverride * result.leanMass);
        const remaining = result.calories - result.macros.p * 4 - result.macros.f * 9;
        result.macros.c = Math.max(0, Math.round(remaining / 4));
        result.calories = Math.round(result.macros.p * 4 + result.macros.f * 9 + result.macros.c * 4);
      }
      setMacroResult(result);

      const actLevel = getActivityLevel(cd);
      const hydInput = {
        weight,
        gender: gender as "male" | "female",
        activity: HYDRATION_ACTIVITY_MAP[actLevel],
        climate: hydrationClimate,
      };
      const hydResult = calculateHydration(hydInput);
      // Store base liters (without phase factor) so phase slider updates are instant
      baseHydrationLitersRef.current = hydResult.liters;
      const phaseFactor = hydrationPhase / 100;
      setHydrationLiters(Math.round(hydResult.liters * phaseFactor * 10) / 10);
    };

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(recalculate, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    clientData,
    biometricsConfig,
    goal,
    calorieAdjustPct,
    proteinOverride,
    macroOverrides,
    trainingConfig,
    lifestyleConfig,
    hydrationClimate,
    hydrationPhase,
    dataMode,
    dataSource,
    tdeeAdaptiveActive,
    tdeeAdaptive,
  ]);

  // Instant update when only hydrationPhase changes — no debounce needed (pure multiplication)
  useEffect(() => {
    if (baseHydrationLitersRef.current === null) return;
    const phaseFactor = hydrationPhase / 100;
    setHydrationLiters(
      Math.round(baseHydrationLitersRef.current * phaseFactor * 10) / 10,
    );
  }, [hydrationPhase]);

  // ── Coherence Score ────────────────────────────────────────────────────────
  const coherenceScore = useMemo((): CoherenceScoreData => {
    if (!macroResult) {
      return {
        score: 0,
        checks: [],
        summary: "Le calcul n'est pas encore disponible.",
        strengths: [],
        cautions: ["Les donnees necessaires au calcul sont encore insuffisantes."],
        nextStep: "Completer les donnees de base du client pour lancer le calcul.",
      };
    }
    const checks: CoherenceCheck[] = [];
    const strengths: string[] = [];
    const cautions: string[] = [];
    const { macros, leanMass, calories } = macroResult;

    const protPerKg = leanMass > 0 ? macros.p / leanMass : 0;
    checks.push({
      label: "Protéines",
      ok: protPerKg >= 1.8,
      warning:
        protPerKg < 1.8
          ? `${protPerKg.toFixed(1)}g/kg LBM (min 1.8)`
          : undefined,
    });
    if (protPerKg >= 1.8) {
      strengths.push("l'apport proteique couvre bien la protection de la masse maigre");
    } else {
      cautions.push("les proteines restent un peu basses pour bien proteger la masse maigre");
    }

    const fatPerKg = clientData ? macros.f / (clientData.weight_kg ?? 1) : 0;
    checks.push({
      label: "Lipides",
      ok: fatPerKg >= 0.6,
      warning: fatPerKg < 0.6 ? "Risque hormonal" : undefined,
    });
    if (fatPerKg >= 0.6) {
      strengths.push("le niveau de lipides reste dans une zone prudente");
    } else {
      cautions.push("les lipides sont trop bas et exposent a une base hormonale fragile");
    }

    const floor = clientData?.gender === "female" ? 1200 : 1500;
    checks.push({
      label: "Calories min.",
      ok: calories >= floor,
      warning:
        calories < floor ? `${calories} kcal sous le minimum` : undefined,
    });
    if (calories >= floor) {
      strengths.push("le total calorique reste au-dessus du plancher minimal");
    } else {
      cautions.push("le niveau calorique descend sous le minimum prudent");
    }

    const carbsPerKg = clientData ? macros.c / (clientData.weight_kg ?? 1) : 0;
    const carbWarning = carbsPerKg > 8;
    checks.push({
      label: "Glucides",
      ok: !carbWarning,
      warning: carbWarning
        ? `${macros.c}g = ${carbsPerKg.toFixed(0)}g/kg — répartir 4-5 repas`
        : undefined,
    });
    if (!carbWarning) {
      strengths.push("la charge glucidique reste exploitable sans forcer la repartition");
    } else {
      cautions.push("les glucides sont tres hauts et demandent une repartition plus rigoureuse");
    }

    checks.push({ label: "Hydratation", ok: hydrationLiters !== null });
    if (hydrationLiters !== null) {
      strengths.push("l'objectif d'hydratation est bien defini");
    } else {
      cautions.push("l'objectif d'hydratation n'est pas encore renseigne");
    }

    if (macroResult.dataQuality) {
      const { score: qualityScore, confidence, signals } = macroResult.dataQuality;
      if (confidence === "high") {
        strengths.push("la base de donnees recente est solide pour soutenir les ajustements");
      } else if (confidence === "medium") {
        cautions.push("la base de donnees est exploitable mais demande encore un peu de validation coach");
      } else {
        cautions.push("la base de donnees est trop fragile pour pousser des ajustements agressifs");
      }

      const weakSignals = signals.filter((signal) => signal.score < 0.7).slice(0, 2);
      weakSignals.forEach((signal) => {
        const label = getNutritionSignalLabel(signal.key);
        if (signal.reason === "absent") {
          cautions.push(`${label.toLowerCase()} manque encore pour fiabiliser davantage le calcul`);
        } else if (signal.reason === "fallback") {
          cautions.push(`${label.toLowerCase()} repose sur une valeur heritee a reconfirmer`);
        } else if (signal.reason === "base_structurelle" && dataMode === "realtime") {
          cautions.push(`${label.toLowerCase()} vient d'une base plus ancienne et reste surtout informative en temps reel`);
        }
      });

      if (qualityScore >= 80) {
        strengths.push("les donnees utiles au mode actif sont globalement fraiches et coherentes");
      }
    }

    const passCount = checks.filter((c) => c.ok).length;
    const score = Math.round((passCount / checks.length) * 100);
    const summary =
      score >= 90
        ? "Le protocole est tres coherent et peut servir de base solide sans reserve majeure."
        : score >= 75
          ? "La base est bonne. Le calcul est fiable, avec quelques points a garder en tete."
          : score >= 55
            ? "Le calcul reste exploitable, mais plusieurs parametres meritent une verification avant de pousser trop loin les ajustements."
            : "La base est trop fragile pour inspirer pleinement confiance. Il vaut mieux corriger les points faibles avant partage.";
    const nextStep =
      cautions[0]
        ? `Priorite du moment: ${cautions[0]}.`
        : "Aucune correction prioritaire identifiee.";

    return {
      score,
      checks,
      summary,
      strengths: Array.from(new Set(strengths)).slice(0, 3),
      cautions: Array.from(new Set(cautions)).slice(0, 4),
      nextStep,
    };
  }, [macroResult, hydrationLiters, clientData, dataMode]);

  // ── Missing Data Alerts ────────────────────────────────────────────────────
  interface MissingAlert {
    field: string;
    category: "biometric" | "training" | "lifestyle";
    severity: "warning" | "critical";
    label: string;
  }

  const missingDataAlerts = useMemo((): MissingAlert[] => {
    if (!clientData) return [];
    const alerts: MissingAlert[] = [];

    // Critical biometric fields
    if (!clientData.bmr_kcal_measured) {
      alerts.push({
        field: "bmr",
        category: "biometric",
        severity: "critical",
        label: "[CRITICAL] BMR absent du bilan",
      });
    }
    if (!clientData.weight_kg) {
      alerts.push({
        field: "weight_kg",
        category: "biometric",
        severity: "critical",
        label: "[CRITICAL] Poids non renseigné",
      });
    }
    if (!clientData.body_fat_pct) {
      alerts.push({
        field: "body_fat_pct",
        category: "biometric",
        severity: "critical",
        label: "[CRITICAL] % Graisse corporelle absent",
      });
    }
    if (!clientData.height_cm) {
      alerts.push({
        field: "height_cm",
        category: "biometric",
        severity: "critical",
        label: "[CRITICAL] Taille non renseignée",
      });
    }

    // Warning training fields
    if (!clientData.weekly_frequency) {
      alerts.push({
        field: "weekly_frequency",
        category: "training",
        severity: "warning",
        label: "[WARNING] Fréquence d'entraînement non indiquée",
      });
    }
    if (!clientData.daily_steps) {
      alerts.push({
        field: "daily_steps",
        category: "training",
        severity: "warning",
        label: "[WARNING] Nombre de pas inconnu",
      });
    }

    return alerts;
  }, [clientData]);

  const shareIssues = useMemo((): StudioShareIssue[] => {
    const issues: StudioShareIssue[] = [];

    if (!clientData || !macroResult) {
      issues.push({
        severity: "blocking",
        message: "Calcul nutritionnel incomplet.",
      });
      return issues;
    }

    if (foodProfileStatus === "unknown" || foodProfileStatus === "loading") {
      issues.push({
        severity: "blocking",
        message: "Le statut allergique doit être confirmé avant le partage.",
      });
    }

    if (coherenceScore.score < 55) {
      issues.push({
        severity: "blocking",
        message: "Cohérence trop faible pour partager le protocole.",
      });
    }

    if (!clientData.weight_kg || !clientData.height_cm) {
      issues.push({
        severity: "blocking",
        message: "Poids ou taille manquant.",
      });
    }

    if (
      dataMode !== "realtime" &&
      !clientData.bmr_kcal_measured &&
      !clientData.body_fat_pct &&
      !clientData.lean_mass_kg &&
      !clientData.muscle_mass_kg
    ) {
      issues.push({
        severity: "blocking",
        message: "Aucune base corporelle fiable pour estimer proprement le métabolisme.",
      });
    }

    if (
      !days.some(
        (day) =>
          Number(day.calories) > 0 &&
          Number(day.protein_g) > 0 &&
          Number(day.carbs_g) >= 0 &&
          Number(day.fat_g) > 0,
      )
    ) {
      issues.push({
        severity: "blocking",
        message: "Aucun jour du protocole n'est encore injecté ou renseigné.",
      });
    }

    if (dataMode !== "realtime") {
      const warningKeys: NutritionSignalKey[] = [
        "weight_kg",
        "body_fat_pct",
        "daily_steps",
        "sleep_duration_h",
        "stress_level",
      ];

      for (const key of warningKeys) {
        if (dataSource[key] === "fallback") {
          issues.push({
            severity: "warning",
            message: `Le ${getNutritionSignalLabel(key)} affiché ne vient pas du bilan sélectionné. Vérifie cette donnée avant de partager le protocole.`,
          });
        }
      }
    }

    return issues;
  }, [clientData, macroResult, coherenceScore.score, days, dataMode, dataSource, foodProfileStatus]);

  const canShare = !shareIssues.some((issue) => issue.severity === "blocking");
  const phaseProtocolPreview = useMemo<PhaseProtocolPreview | null>(() => {
    if (!phaseSyncBaseTarget || !macroResult) return null;
    const nextTarget = { calories: macroResult.calories, protein: macroResult.macros.p, carbs: macroResult.macros.c, fat: macroResult.macros.f };
    if (JSON.stringify(nextTarget) === JSON.stringify(phaseSyncBaseTarget)) return null;
    return buildPhaseProtocolPreview({ days, previousTarget: phaseSyncBaseTarget, nextTarget });
  }, [days, macroResult, phaseSyncBaseTarget]);

  const applyPhaseProtocolPreview = useCallback(() => {
    if (!phaseProtocolPreview) return;
    setDays(phaseProtocolPreview.days);
    setPhaseSyncBaseTarget(null);
  }, [phaseProtocolPreview]);

  const dismissPhaseProtocolPreview = useCallback(() => setPhaseSyncBaseTarget(null), []);

  const updateDay = useCallback((index: number, patch: Partial<DayDraft>) => {
    setDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }, []);

  const addDay = useCallback(
    (name?: string) => {
      setDays((prev) => [
        ...prev,
        emptyDayDraft(name ?? `Jour ${prev.length + 1}`),
      ]);
      setActiveDayIndex(days.length);
    },
    [days.length],
  );

  const removeDay = useCallback((index: number) => {
    setDays((prev) => prev.filter((_, i) => i !== index));
    setActiveDayIndex((prev) => Math.max(0, prev >= index ? prev - 1 : prev));
  }, []);

  // ── Injection actions ──────────────────────────────────────────────────────
  const injectMacrosToDay = useCallback(
    (dayIndex: number) => {
      if (!macroResult) return;
      updateDay(dayIndex, {
        calories: String(macroResult.calories),
        protein_g: String(macroResult.macros.p),
        carbs_g: String(macroResult.macros.c),
        fat_g: String(macroResult.macros.f),
      });
    },
    [macroResult, updateDay],
  );

  const injectHydrationToDay = useCallback(
    (dayIndex: number) => {
      if (!hydrationLiters) return;
      updateDay(dayIndex, {
        hydration_ml: String(Math.round(hydrationLiters * 1000)),
      });
    },
    [hydrationLiters, updateDay],
  );

  const injectAllToDay = useCallback(
    (dayIndex: number) => {
      injectMacrosToDay(dayIndex);
      injectHydrationToDay(dayIndex);
    },
    [injectMacrosToDay, injectHydrationToDay],
  );

  // ── Save / Share ───────────────────────────────────────────────────────────
  const buildPayload = useCallback(
    () => ({
      name: protocolName,
      schedule_start_date: scheduleStartDate,
      cycle_sync_enabled: cycleSyncEnabled,
      cycle_sync_profile: cycleSyncProfile,
      schedule_slots: scheduleSlots
        .filter((slot) => slot.protocol_day_position >= 0 && slot.protocol_day_position < days.length)
        .map((slot) => ({
          week_index: slot.week_index,
          dow: slot.dow,
          protocol_day_position: slot.protocol_day_position,
        })),
      days: days.map((d, i) => ({
        id: d.dbId,
        name: d.name,
        position: i,
        calories: d.calories ? Number(d.calories) : null,
        protein_g: d.protein_g ? Number(d.protein_g) : null,
        carbs_g: d.carbs_g ? Number(d.carbs_g) : null,
        fat_g: d.fat_g ? Number(d.fat_g) : null,
        hydration_ml: d.hydration_ml ? Number(d.hydration_ml) : null,
        role: d.role,
        carb_cycle_type: d.carb_cycle_type || null,
        cycle_sync_phase: d.cycle_sync_phase || null,
        recommendations: d.recommendations || null,
        meal_plan: d.meal_plan ?? [],
      })),
    }),
    [protocolName, scheduleStartDate, scheduleSlots, days, cycleSyncEnabled, cycleSyncProfile],
  );

  const save = useCallback(async (): Promise<string | null> => {
    setSaving(true);
    try {
      // Include tdee_reference when saving so apply-adaptive-tdee can compute
      // ratios against the real TDEE, not the post-deficit absolute day calories.
      const payload = {
        ...buildPayload(),
        ...(goalCalories != null ? { tdee_reference: Math.round(goalCalories) } : {}),
      };
      const currentId = savedProtocolId ?? existingProtocol?.id;
      if (currentId) {
        const response = await fetch(
          `/api/clients/${clientId}/nutrition-protocols/${currentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "La sauvegarde du protocole a échoué.");
        }
        return currentId;
      } else {
        const r = await fetch(`/api/clients/${clientId}/nutrition-protocols`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const errorText = await r.text();
          throw new Error(errorText || "La création du protocole a échoué.");
        }
        const d = await r.json();
        const newId = d.protocol?.id ?? null;
        if (newId) setSavedProtocolId(newId);
        return newId;
      }
    } finally {
      setSaving(false);
    }
  }, [buildPayload, clientId, existingProtocol, goalCalories, savedProtocolId]);

  const share = useCallback(async () => {
    if (!canShare) {
      const blocking = shareIssues
        .filter((issue) => issue.severity === "blocking")
        .map((issue) => `- ${issue.message}`)
        .join("\n");
      throw new Error(blocking || "Le protocole n'est pas prêt à être partagé.");
    }
    setSharing(true);
    try {
      const id = await save();
      if (!id) return;
      const response = await fetch(`/api/clients/${clientId}/nutrition-protocols/${id}/share`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorText = await response.text();
        let message = "Le partage du protocole a échoué.";
        try {
          message = JSON.parse(errorText)?.error ?? message;
        } catch {
          if (errorText) message = errorText;
        }
        throw new Error(message);
      }
    } finally {
      setSharing(false);
    }
  }, [canShare, shareIssues, save, clientId]);

  // Step 1: Calculate TDEE — returns preview, does NOT modify protocol days
  const applyAdaptiveTdee = useCallback(async () => {
    const currentId = savedProtocolId ?? existingProtocol?.id;
    if (!currentId) return;
    setApplyingAdaptive(true);
    setTdeeError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/nutrition-protocols/${currentId}/apply-adaptive-tdee`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const text = await res.text();
        let message = 'Le recalcul du TDEE adaptatif a échoué.';
        try {
          const parsed = JSON.parse(text);
          message = parsed.detail ?? parsed.error ?? message;
        } catch {
          if (text.trim()) message = text;
        }
        throw new Error(message);
      }
      const data = await res.json();
      if (tdeeAdaptiveActive && data.tdeeAdaptive !== tdeeAdaptive) {
        captureProtocolTarget();
      }
      setTdeeAdaptive(data.tdeeAdaptive);
      setTdeeAdaptiveAt(data.tdeeAdaptiveAt ? new Date(data.tdeeAdaptiveAt) : null);
      setTdeeAdaptiveLower(typeof data.tdeeLower === 'number' && data.tdeeAdaptive != null ? data.tdeeLower : null);
      setTdeeAdaptiveUpper(typeof data.tdeeUpper === 'number' && data.tdeeAdaptive != null ? data.tdeeUpper : null);
      setTdeeObserved(typeof data.tdeeObserved === 'number' ? data.tdeeObserved : null);
      setTdeeObservedLower(typeof data.tdeeLower === 'number' ? data.tdeeLower : null);
      setTdeeObservedUpper(typeof data.tdeeUpper === 'number' ? data.tdeeUpper : null);
      setTdeeActionableStreak(typeof data.tdeeActionableStreak === 'number' ? data.tdeeActionableStreak : 0);
      setTdeeStabilityStatus((data.tdeeStabilityStatus ?? null) as TdeeStabilityStatus);
      setTdeeEstimationStatus((data.tdeeEstimationStatus ?? 'collecting') as TdeeEstimationStatus);
      setTdeeDataQualityScore(typeof data.tdeeDataQualityScore === 'number' ? data.tdeeDataQualityScore : null);
      setTdeeDataQualityReasons(Array.isArray(data.tdeeDataQualityReasons) ? data.tdeeDataQualityReasons : []);
      setTdeeLastSuccessAt(data.tdeeAdaptiveAt ? new Date(data.tdeeAdaptiveAt) : null);
      setTdeeLastSkipReason(null);
      const historyUrl = new URL(
        `/api/clients/${clientId}/nutrition-tdee-history`,
        typeof window !== "undefined" ? window.location.origin : "",
      );
      if (existingProtocol?.id) {
        historyUrl.searchParams.set("protocolId", existingProtocol.id);
      }
      fetch(historyUrl.toString())
        .then(r => r.ok ? r.json() : { history: [] })
        .then((historyData) => {
          setTdeeHistory(
            dedupeTdeeHistoryByDisplayedDate(
              Array.isArray(historyData?.history) ? historyData.history : [],
            ),
          );
          setTdeeStabilityStatus((historyData?.stabilityStatus ?? null) as TdeeStabilityStatus);
          setTdeeLastSkipReason(historyData?.lastSkipReason ?? null);
          setTdeeEstimationStatus((historyData?.estimationStatus ?? 'collecting') as TdeeEstimationStatus);
          setTdeeDataQualityScore(typeof historyData?.dataQualityScore === 'number' ? historyData.dataQualityScore : null);
          setTdeeDataQualityReasons(Array.isArray(historyData?.dataQualityReasons) ? historyData.dataQualityReasons : []);
          setTdeeAdaptive(typeof historyData?.clientTdee === 'number' ? historyData.clientTdee : null);
          setTdeeAdaptiveAt(historyData?.clientTdeeAt ? new Date(historyData.clientTdeeAt) : null);
          setTdeeAdaptiveLower(typeof historyData?.clientTdeeLower === 'number' ? historyData.clientTdeeLower : null);
          setTdeeAdaptiveUpper(typeof historyData?.clientTdeeUpper === 'number' ? historyData.clientTdeeUpper : null);
          setTdeeObserved(typeof historyData?.observedTdee === 'number' ? historyData.observedTdee : null);
          setTdeeObservedLower(typeof historyData?.observedTdeeLower === 'number' ? historyData.observedTdeeLower : null);
          setTdeeObservedUpper(typeof historyData?.observedTdeeUpper === 'number' ? historyData.observedTdeeUpper : null);
          setTdeeActionableStreak(typeof historyData?.actionableStreak === 'number' ? historyData.actionableStreak : 0);
        })
        .catch(() => {});
    } catch (error) {
      setTdeeError(error instanceof Error ? error.message : 'Le recalcul du TDEE adaptatif a échoué.');
    } finally {
      setApplyingAdaptive(false);
    }
  }, [captureProtocolTarget, clientId, existingProtocol, savedProtocolId, tdeeAdaptive, tdeeAdaptiveActive]);

  const onTdeeAutoToggle = useCallback(async (enabled: boolean) => {
    const currentId = savedProtocolId ?? existingProtocol?.id;
    if (!currentId) return;
    setTdeeAutoEnabled(enabled);
    await fetch(`/api/clients/${clientId}/nutrition-protocols/${currentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tdee_auto_enabled: enabled }),
    });
  }, [clientId, savedProtocolId, existingProtocol]);

  const onTdeeAdaptiveActiveToggle = useCallback(async (enabled: boolean) => {
    const currentId = savedProtocolId ?? existingProtocol?.id;
    if (!currentId) return;
    if (enabled && !tdeeAdaptiveActive && tdeeAdaptive != null) {
      captureProtocolTarget();
    }
    try {
      const response = await fetch(`/api/clients/${clientId}/nutrition-protocols/${currentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tdee_adaptive_active: enabled }),
      });
      if (!response.ok) throw new Error(await response.text());
      setTdeeAdaptiveActive(enabled);
    } catch (error) {
      setTdeeError(error instanceof Error ? error.message : "La mise à jour du TDEE adaptatif a échoué.");
    }
  }, [captureProtocolTarget, clientId, existingProtocol, savedProtocolId, tdeeAdaptive, tdeeAdaptiveActive]);

  return {
    clientData,
    setClientData,
    clientLoading,
    protocolName,
    setProtocolName,
    goal,
    setGoal,
    setGoalWithPreset,
    transformationPhase,
    setTransformationPhase,
    setTransformationPhaseWithPreset,
    phaseProtocolPreview,
    applyPhaseProtocolPreview,
    dismissPhaseProtocolPreview,
    calorieAdjustPct,
    setCalorieAdjustPct,
    setCalorieAdjustPctWithProtocolSync,
    proteinOverride,
    setProteinOverride,
    trainingConfig,
    setTrainingConfig,
    lifestyleConfig,
    setLifestyleConfig,
    biometricsConfig,
    setBiometricsConfig,
    macroOverrides,
    setMacroOverrides,
    setMacroOverridesWithProtocolSync,
    cycleSyncEnabled,
    setCycleSyncEnabled,
    cycleSyncProfile,
    setCycleSyncProfile,
    cyclePhaseObservations,
    hydrationClimate,
    setHydrationClimate,
    hydrationPhase,
    setHydrationPhase,
    days,
    activeDayIndex,
    setActiveDayIndex,
    macroResult,
    goalCalories,
    hydrationLiters,
    coherenceScore,
    updateDay,
    addDay,
    removeDay,
    injectMacrosToDay,
    injectHydrationToDay,
    injectAllToDay,
    saving,
    sharing,
    showPreview,
    setShowPreview,
    save,
    share,
    selectedSubmissionId,
    setSelectedSubmissionId,
    resolvedSubmissionId,
    allSubmissions,
    dataMode,
    setDataMode,
    anchorDate,
    realtimeWindowDays,
    missingDataAlerts,
    shareIssues,
    canShare,
    dataSource,
    setDataSource,
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
    trainingWeekSchedule,
    selectedScheduleDow,
    setSelectedScheduleDow,
    scheduleStartDate,
    setScheduleStartDate,
    scheduleSlots,
    setScheduleSlots,
    cycleState,
  };
}
