"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

export type TdeePreview = {
  tdeeAdaptive: number;
  tdeeReference: number;
  deltaKcal: number;
  confidence: string;
  confidenceScore: number;
  confidenceReasons: string[];
  preview: Array<{
    id: string;
    name: string;
    position: number;
    current: { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
    proposed: { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
  }>;
};
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

  const [clientData, setClientData] = useState<NutritionClientData | null>(
    null,
  );
  const [clientLoading, setClientLoading] = useState(true);
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

  const setTransformationPhaseWithPreset = useCallback(
    (newPhase: TransformationPhase) => {
      setTransformationPhase(newPhase);
      const bf = biometricsConfig.body_fat_pct ?? clientData?.body_fat_pct ?? null;
      const weeklyFrequency = trainingConfig.weeklyFrequency;
      const mappedGoal = transformationPhaseToMacroGoal(newPhase);
      setGoal(mappedGoal);
      setCalorieAdjustPct(
        computePhaseDrivenCalorieAdjustPct({
          phase: newPhase,
          bodyFat: bf,
          weeklyFrequency,
          basePreset: computeSmartPreset,
        }),
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
  const [hydrationClimate, setHydrationClimate] =
    useState<HydrationClimate>("temperate");
  const [hydrationPhase, setHydrationPhase] = useState(100); // 0–200, 100 = baseline
  // Separate ref for the base hydration (before phase factor) — updated by debounced recalc
  const baseHydrationLitersRef = useRef<number | null>(null);
  const [days, setDays] = useState<DayDraft[]>([
    emptyDayDraft("Jour entraînement"),
    emptyDayDraft("Jour repos"),
  ]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [macroResult, setMacroResult] = useState<MacroResult | null>(null);
  // Calories after goal factor but before calorieAdjustPct — used by the adjustment slider display
  const [goalCalories, setGoalCalories] = useState<number | null>(null);
  const [hydrationLiters, setHydrationLiters] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [savedProtocolId, setSavedProtocolId] = useState<string | null>(
    existingProtocol?.id ?? null,
  );
  const [tdeeAdaptive, setTdeeAdaptive] = useState<number | null>(null);
  const [tdeeAdaptiveAt, setTdeeAdaptiveAt] = useState<Date | null>(null);
  const [tdeeDataSource, setTdeeDataSource] = useState<'weight_delta' | 'formula_proxy' | null>(null);
  const [tdeeHistory, setTdeeHistory] = useState<TdeeHistoryEntry[]>([]);
  const [applyingAdaptive, setApplyingAdaptive] = useState(false);
  const [tdeeAutoEnabled, setTdeeAutoEnabled] = useState<boolean>(existingProtocol?.tdee_auto_enabled ?? false);
  const [tdeeAdaptiveActive, setTdeeAdaptiveActive] = useState<boolean>(existingProtocol?.tdee_adaptive_active ?? false);
  const [tdeePreview, setTdeePreview] = useState<TdeePreview | null>(null);
  const [applyingTdeeConfirm, setApplyingTdeeConfirm] = useState(false);
  const [dataMode, setDataMode] = useState<NutritionDataMode>("bilan");
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
    Record<string, "selected" | "fallback">
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

  // ── Fetch client data ──────────────────────────────────────────────────────
  useEffect(() => {
    setClientLoading(true);
    const url = new URL(
      `/api/clients/${clientId}/nutrition-data`,
      typeof window !== "undefined" ? window.location.origin : "",
    );
    url.searchParams.set("mode", dataMode);
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
        if (d.tdeeAdaptive != null) setTdeeAdaptive(d.tdeeAdaptive);
        if (d.tdeeAdaptiveAt) setTdeeAdaptiveAt(new Date(d.tdeeAdaptiveAt));
        if (d.tdeeDataSource) setTdeeDataSource(d.tdeeDataSource);
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
        fetch(`/api/clients/${clientId}/nutrition-tdee-history`)
          .then(r => r.ok ? r.json() : [])
          .then(setTdeeHistory)
          .catch(() => {})
        // Load cycle state (best-effort, non-blocking)
        fetch(`/api/clients/${clientId}/cycle/status`)
          .then(r => r.ok ? r.json() : { cycleState: null })
          .then(d => setCycleState(d.cycleState ?? null))
          .catch(() => {})
      })
      .catch(() => {})
      .finally(() => setClientLoading(false));
  }, [clientId, dataMode, selectedSubmissionId]);

  // ── Load existing protocol days ────────────────────────────────────────────
  useEffect(() => {
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
    if (existingProtocol?.tdee_auto_enabled !== undefined) {
      setTdeeAutoEnabled(existingProtocol.tdee_auto_enabled);
    }
    if (existingProtocol?.tdee_adaptive_active !== undefined) {
      setTdeeAdaptiveActive(existingProtocol.tdee_adaptive_active);
    }
  }, [existingProtocol]);

  // ── Auto-recalc TDEE on page load if tdee_auto_enabled ────────────────────
  // Fires once when existingProtocol arrives and tdee_auto_enabled is true.
  // Uses a ref so it doesn't re-fire on every existingProtocol update.
  const autoRecalcFiredRef = useRef(false);
  useEffect(() => {
    if (autoRecalcFiredRef.current) return;
    if (!existingProtocol?.id) return;
    if (!existingProtocol.tdee_auto_enabled) return;
    autoRecalcFiredRef.current = true;
    // Silently recalculate — errors are non-blocking
    fetch(`/api/clients/${clientId}/nutrition-protocols/${existingProtocol.id}/apply-adaptive-tdee`, { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.tdeeAdaptive != null) {
          setTdeeAdaptive(data.tdeeAdaptive);
          setTdeeAdaptiveAt(new Date());
        }
      })
      .catch(() => {})
  }, [existingProtocol, clientId]);

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
  }, [clientData, macroResult, coherenceScore.score, days, dataMode, dataSource]);

  const canShare = !shareIssues.some((issue) => issue.severity === "blocking");
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
      schedule_slots: scheduleSlots
        .filter((slot) => slot.protocol_day_position >= 0 && slot.protocol_day_position < days.length)
        .map((slot) => ({
          week_index: slot.week_index,
          dow: slot.dow,
          protocol_day_position: slot.protocol_day_position,
        })),
      days: days.map((d, i) => ({
        name: d.name,
        position: i,
        calories: d.calories ? Number(d.calories) : null,
        protein_g: d.protein_g ? Number(d.protein_g) : null,
        carbs_g: d.carbs_g ? Number(d.carbs_g) : null,
        fat_g: d.fat_g ? Number(d.fat_g) : null,
        hydration_ml: d.hydration_ml ? Number(d.hydration_ml) : null,
        carb_cycle_type: d.carb_cycle_type || null,
        cycle_sync_phase: d.cycle_sync_phase || null,
        recommendations: d.recommendations || null,
      })),
    }),
    [protocolName, scheduleStartDate, scheduleSlots, days, cycleSyncEnabled],
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
        await fetch(
          `/api/clients/${clientId}/nutrition-protocols/${currentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        return currentId;
      } else {
        const r = await fetch(`/api/clients/${clientId}/nutrition-protocols`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const d = await r.json();
        const newId = d.protocol?.id ?? null;
        if (newId) setSavedProtocolId(newId);
        return newId;
      }
    } finally {
      setSaving(false);
    }
  }, [buildPayload, clientId, existingProtocol, savedProtocolId]);

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
      await fetch(`/api/clients/${clientId}/nutrition-protocols/${id}/share`, {
        method: "POST",
      });
    } finally {
      setSharing(false);
    }
  }, [canShare, shareIssues, save, clientId]);

  // Step 1: Calculate TDEE — returns preview, does NOT modify protocol days
  const applyAdaptiveTdee = useCallback(async () => {
    const currentId = savedProtocolId ?? existingProtocol?.id;
    if (!currentId) return;
    setApplyingAdaptive(true);
    setTdeePreview(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/nutrition-protocols/${currentId}/apply-adaptive-tdee`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTdeeAdaptive(data.tdeeAdaptive);
      setTdeeAdaptiveAt(new Date());
      setTdeePreview(data);
      fetch(`/api/clients/${clientId}/nutrition-tdee-history`)
        .then(r => r.ok ? r.json() : [])
        .then(setTdeeHistory)
        .catch(() => {});
    } finally {
      setApplyingAdaptive(false);
    }
  }, [clientId, savedProtocolId, existingProtocol]);

  // Step 2: Confirm — actually rescale protocol days
  const confirmApplyTdee = useCallback(async () => {
    const currentId = savedProtocolId ?? existingProtocol?.id;
    if (!currentId || !tdeePreview) return;
    setApplyingTdeeConfirm(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/nutrition-protocols/${currentId}/apply-adaptive-tdee`,
        { method: 'PUT' }
      );
      if (!res.ok) throw new Error(await res.text());
      setTdeePreview(null);
    } finally {
      setApplyingTdeeConfirm(false);
    }
  }, [clientId, savedProtocolId, existingProtocol, tdeePreview]);

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
    setTdeeAdaptiveActive(enabled);
    await fetch(`/api/clients/${clientId}/nutrition-protocols/${currentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tdee_adaptive_active: enabled }),
    });
  }, [clientId, savedProtocolId, existingProtocol]);

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
    calorieAdjustPct,
    setCalorieAdjustPct,
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
    cycleSyncEnabled,
    setCycleSyncEnabled,
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
    tdeeAdaptive,
    tdeeAdaptiveAt,
    tdeeDataSource,
    tdeeHistory,
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
