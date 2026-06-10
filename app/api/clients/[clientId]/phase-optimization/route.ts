import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildDerivedSignals } from "@/lib/coach/phaseEngine/signals";
import { computePhaseOptimization } from "@/lib/coach/phaseEngine/engine";
import { computeOptimalPhase } from "@/lib/coach/phaseEngine/decision";
import { ENGINE_VERSION } from "@/lib/coach/phaseEngine/engine";
import {
  snapshotFromResult,
  parseHistoryRows,
} from "@/lib/coach/phaseEngine/history";
import {
  applyManualOverride,
  parseStoredPhaseOverride,
  parseStoredPhasePreferences,
  resolveCoachPhasePreferences,
} from "@/lib/coach/phaseEngine/override";
import { deriveCoachPhasePreferences } from "@/lib/coach/phaseEngine/prefs";
import { parsePhaseEngineLocale } from "@/lib/coach/phaseEngine/localeCopy";
import { buildCoachDecision } from "@/lib/coach/phaseEngine/coachDecision";

import { buildPhaseFooterMetricCards } from "@/lib/coach/phaseEngine/footerMetrics";
import {
  buildPhaseClientProfile,
  resolveCyclicProtocolForToday,
} from "@/lib/coach/phaseEngine/clientProfile";
import { resolveProtocolDayByDate } from "@/lib/nutrition/protocol-schedule";
import type { NutritionProtocolDay } from "@/lib/nutrition/types";
import {
  buildExercisePerformanceRows,
  computeGlobalOverreaching,
  computeProgressionContext,
  type SessionAggregate,
} from "@/lib/coach/phaseEngine/performanceAggregation";
import type { RawSignalInput } from "@/lib/coach/phaseEngine/types";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const querySchema = z.object({
  window: z.coerce.number().min(7).max(90).default(30),
  locale: z.enum(["fr", "en"]).default("fr"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

type Params = { params: { clientId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = service();
  const { data: clientData } = await db
    .from("coach_clients")
    .select(
      "id, transformation_phase, training_goal, weekly_frequency, gender, fitness_level, phase_override, phase_preferences",
    )
    .eq("id", params.clientId)
    .eq("coach_id", user.id)
    .single();

  if (!clientData)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    window: url.searchParams.get("window") ?? 30,
    locale: parsePhaseEngineLocale(url.searchParams.get("locale")),
    date: url.searchParams.get("date") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  const { window: windowDays, locale, date } = parsed.data;

  const evaluationDate = date ?? new Date().toISOString().slice(0, 10);
  const evaluationTime = new Date(`${evaluationDate}T12:00:00Z`).getTime();
  const evaluationNow = Number.isNaN(evaluationTime) ? new Date() : new Date(evaluationTime);

  const checkinPeriodDays = Math.max(windowDays, 60);
  const periodStart = new Date(
    evaluationNow.getTime() - windowDays * 86400000,
  ).toISOString();

  const checkinPeriodStart = new Date(
    evaluationNow.getTime() - checkinPeriodDays * 86400000,
  ).toISOString();
  const checkinPeriodStartDate = checkinPeriodStart.slice(0, 10);
  const windowStartDate = new Date(
    evaluationNow.getTime() - windowDays * 86400000,
  ).toISOString().slice(0, 10);

  const eightWeeksAgo = new Date(evaluationNow.getTime() - 56 * 86400000).toISOString();

  const [
    checkinRes,
    sessionRes,
    oneRmSessionRes,
    progressionRes,
    metricsRes,
    configRes,
    protocolRes,
    nutritionMealsRes,
  ] = await Promise.all([
    db
      .from("client_daily_checkins")
      .select(
        "date, flow_type, sleep_hours, sleep_quality, energy_level, stress_level, muscle_soreness, rhr_morning, daily_steps",
      )
      .eq("client_id", params.clientId)
      .gte("date", checkinPeriodStartDate)
      .lte("date", evaluationDate)
      .order("date", { ascending: true }),

    db
      .from("client_session_logs")
      .select(
        `
        id, completed_at, program_session_id,
        client_set_logs(
          exercise_id, exercise_name, set_number, actual_reps, actual_weight_kg,
          completed, rir_actual, set_type
        )
      `,
      )
      .eq("client_id", params.clientId)
      .not("completed_at", "is", null)
      .gte("completed_at", periodStart)
      .lte("completed_at", evaluationNow.toISOString()),

    db
      .from("client_session_logs")
      .select(
        `
        completed_at,
        client_set_logs(
          exercise_name, actual_weight_kg, actual_reps, rir_actual, completed
        )
      `,
      )
      .eq("client_id", params.clientId)
      .not("completed_at", "is", null)
      .gte("completed_at", eightWeeksAgo)
      .lte("completed_at", evaluationNow.toISOString()),

    db
      .from("progression_events")
      .select("exercise_id, created_at, trigger_type")
      .eq("client_id", params.clientId)
      .gte("created_at", periodStart)
      .lte("created_at", evaluationNow.toISOString()),

    db
      .from("assessment_submissions")
      .select(
        "submitted_at, bilan_date, assessment_responses(field_key, value_number, value_text)",
      )
      .eq("client_id", params.clientId)
      .eq("status", "completed")
      .lte("submitted_at", evaluationNow.toISOString())
      .order("bilan_date", { ascending: true })
      .limit(20),

    db
      .from("daily_checkin_configs")
      .select("days_of_week")
      .eq("client_id", params.clientId)
      .eq("coach_id", user.id)
      .maybeSingle(),

    db
      .from("nutrition_protocols")
      .select(
        `
        schedule_start_date,
        nutrition_protocol_days(position, carb_cycle_type, calories, protein_g, carbs_g, fat_g, hydration_ml),
        nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)
      `,
      )
      .eq("client_id", params.clientId)
      .eq("status", "shared")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    db
      .from("nutrition_meals")
      .select(
        "physiological_date, total_calories, total_protein_g, total_carbs_g, total_fat_g",
      )
      .eq("client_id", params.clientId)
      .gte("physiological_date", windowStartDate)
      .lte("physiological_date", evaluationDate),
  ]);

  const checkinRows = (checkinRes.data ?? []) as {
    date: string;
    flow_type: string;
    sleep_hours: number | null;
    sleep_quality: number | null;
    energy_level: number | null;
    stress_level: number | null;
    muscle_soreness: number | null;
    rhr_morning: number | null;
    daily_steps: number | null;
  }[];

  const rhrSeries = checkinRows
    .filter((r) => r.rhr_morning != null && r.rhr_morning > 0)
    .map((r) => ({
      date: r.date,
      value: r.rhr_morning as number,
    }));

  const checkinRowsForAverages = checkinRows.filter(r => r.date >= windowStartDate);

  const fieldSums: Record<string, { sum: number; count: number }> = {};
  const uniqueDays = new Set<string>();

  for (const r of checkinRowsForAverages) {
    uniqueDays.add(r.date);
    const isMorning = r.flow_type === "morning";
    const fields: Record<string, number | null> = {
      energy: r.energy_level,
      steps: r.daily_steps,
      ...(isMorning
        ? { sleep_duration: r.sleep_hours, sleep_quality: r.sleep_quality }
        : { stress: r.stress_level, muscle_soreness: r.muscle_soreness }),
    };
    for (const [k, v] of Object.entries(fields)) {
      if (v == null) continue;
      if (!fieldSums[k]) fieldSums[k] = { sum: 0, count: 0 };
      fieldSums[k].sum += Number(v);
      fieldSums[k].count += 1;
    }
  }
  const fieldAverages: Record<string, number> = {};
  for (const [k, { sum, count }] of Object.entries(fieldSums)) {
    fieldAverages[k] = Math.round((sum / count) * 10) / 10;
  }

  const daysOfWeek: number[] = configRes.data?.days_of_week ?? [];
  let configuredDays = 0;
  if (daysOfWeek.length > 0) {
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(evaluationNow.getTime() - i * 86400000);
      const jsDay = d.getDay();
      const day = jsDay === 0 ? 6 : jsDay - 1;
      if (daysOfWeek.includes(day)) configuredDays++;
    }
  }
  const checkinResponseRate =
    configuredDays > 0
      ? Math.round((uniqueDays.size / configuredDays) * 100)
      : 0;

  const sessionLogs = (sessionRes.data ?? []) as {
    completed_at: string;
    program_session_id: string | null;
    client_set_logs?: {
      exercise_id: string;
      exercise_name: string;
      set_number: number;
      actual_reps: number | null;
      actual_weight_kg: number | null;
      completed: boolean;
      rir_actual: number | null;
      set_type: string | null;
    }[];
  }[];
  const progressionEvents = (progressionRes.data ?? []) as {
    exercise_id: string;
    trigger_type: string;
  }[];

  const programSessionIds = Array.from(
    new Set(
      sessionLogs
        .map((s) => s.program_session_id)
        .filter((id): id is string => !!id),
    ),
  );

  const prescribedRirByExercise = new Map<string, number | null>();
  if (programSessionIds.length > 0) {
    const { data: programExercises } = await db
      .from("program_exercises")
      .select("id, rir, target_rir")
      .in("session_id", programSessionIds);

    for (const pe of programExercises ?? []) {
      const row = pe as {
        id: string;
        rir: number | null;
        target_rir: number | null;
      };
      const target = row.target_rir ?? row.rir ?? null;
      if (target != null) prescribedRirByExercise.set(row.id, target);
    }
  }

  const sessionAggregates: SessionAggregate[] = sessionLogs.map((s) => ({
    completed_at: s.completed_at,
    sets: (s.client_set_logs ?? []).map((row) => ({
      exercise_id: row.exercise_id,
      exercise_name: row.exercise_name,
      set_number: row.set_number,
      completed: row.completed,
      rir_actual: row.rir_actual,
      actual_weight_kg: row.actual_weight_kg,
      actual_reps: row.actual_reps,
      set_type: row.set_type,
    })),
  }));

  const exercises = buildExercisePerformanceRows({
    sessions: sessionAggregates,
    progressionEvents,
    prescribedRirByExercise,
    windowDays,
  });

  const oneRmSessions = (oneRmSessionRes.data ?? []) as {
    completed_at: string;
    client_set_logs?: {
      exercise_name: string;
      actual_weight_kg: number | null;
      actual_reps: number | null;
      rir_actual: number | null;
    }[];
  }[];
  const setLogsForOneRm = oneRmSessions.flatMap((s) =>
    (s.client_set_logs ?? [])
      .filter((row) => row.actual_weight_kg != null && row.actual_reps != null)
      .map((row) => ({
        exercise_name: row.exercise_name,
        actual_weight_kg: row.actual_weight_kg,
        actual_reps: row.actual_reps,
        rir_actual: row.rir_actual,
        completed_at: s.completed_at,
      })),
  );

  const progression = computeProgressionContext({
    progressionEvents,
    setLogsForOneRm,
  });

  const cyclicProtocolMode = resolveCyclicProtocolForToday(
    protocolRes.data as Parameters<typeof resolveCyclicProtocolForToday>[0],
    evaluationDate,
  );

  const protocolDay = resolveProtocolDayByDate(
    evaluationDate,
    (protocolRes.data as any)?.schedule_start_date ?? null,
    (((protocolRes.data as any)?.nutrition_protocol_days ?? []) as Pick<
      NutritionProtocolDay,
      | "position"
      | "carb_cycle_type"
      | "calories"
      | "protein_g"
      | "carbs_g"
      | "fat_g"
      | "hydration_ml"
    >[]),
    ((protocolRes.data as any)?.nutrition_protocol_schedule_slots ?? []) as {
      week_index: number;
      dow: number;
      protocol_day_position: number;
    }[],
  );

  const clientProfile = buildPhaseClientProfile({
    fitnessLevel: clientData.fitness_level,
    transformationPhase: clientData.transformation_phase,
    trainingGoal: clientData.training_goal,
    cyclicProtocolMode,
  });

  const submissions = (metricsRes.data ?? []) as {
    bilan_date?: string;
    submitted_at?: string;
    assessment_responses?: { field_key: string; value_number: number | null; value_text?: string | null }[];
  }[];
  const weightSeries: RawSignalInput["weightSeries"] = [];
  const bodyFatSeries: RawSignalInput["bodyFatSeries"] = [];
  const leanMassSeries: RawSignalInput["leanMassSeries"] = [];
  const waistSeries: RawSignalInput["waistSeries"] = [];

  let targetWeight = 0;
  let targetDate: string | null = null;

  for (const sub of submissions) {
    const rawDate = sub.bilan_date ?? sub.submitted_at ?? "";
    const date = rawDate.split("T")[0];
    if (!date) continue;
    const responses = sub.assessment_responses ?? [];
    for (const r of responses) {
      if (r.value_number != null) {
        if (r.field_key === "weight_kg")
          weightSeries.push({ date, value: r.value_number });
        if (r.field_key === "body_fat_pct")
          bodyFatSeries.push({ date, value: r.value_number });
        if (r.field_key === "lean_mass_kg")
          leanMassSeries.push({ date, value: r.value_number });
        if (r.field_key === "waist_cm")
          waistSeries.push({ date, value: r.value_number });
        if (r.field_key === "target_weight_kg")
          targetWeight = r.value_number;
      }
      if (r.value_text != null && r.field_key === "goal_deadline") {
        targetDate = r.value_text;
      }
    }
  }

  const latestBodyFat =
    bodyFatSeries.length > 0
      ? bodyFatSeries[bodyFatSeries.length - 1].value
      : null;

  const nutritionMeals = (nutritionMealsRes.data ?? []) as {
    physiological_date: string;
    total_calories: number | null;
    total_protein_g: number | null;
    total_carbs_g: number | null;
    total_fat_g: number | null;
  }[];

  const nutritionByDate = new Map<
    string,
    { calories: number; protein: number; carbs: number; fat: number }
  >();
  for (const row of nutritionMeals) {
    const prev = nutritionByDate.get(row.physiological_date) ?? {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    nutritionByDate.set(row.physiological_date, {
      calories: prev.calories + Number(row.total_calories ?? 0),
      protein: prev.protein + Number(row.total_protein_g ?? 0),
      carbs: prev.carbs + Number(row.total_carbs_g ?? 0),
      fat: prev.fat + Number(row.total_fat_g ?? 0),
    });
  }

  const nutritionDays = Array.from(nutritionByDate.values());
  const avgNutrition =
    nutritionDays.length > 0
      ? {
          avgCalories: Math.round(
            nutritionDays.reduce((sum, day) => sum + day.calories, 0) /
              nutritionDays.length,
          ),
          avgProteinG:
            Math.round(
              (nutritionDays.reduce((sum, day) => sum + day.protein, 0) /
                nutritionDays.length) *
                10,
            ) / 10,
          avgCarbsG:
            Math.round(
              (nutritionDays.reduce((sum, day) => sum + day.carbs, 0) /
                nutritionDays.length) *
                10,
            ) / 10,
          avgFatG:
            Math.round(
              (nutritionDays.reduce((sum, day) => sum + day.fat, 0) /
                nutritionDays.length) *
                10,
            ) / 10,
        }
      : null;

  const targetCalories = protocolDay?.calories ?? null;
  const targetProteinG = protocolDay?.protein_g ?? null;
  const targetCarbsG = protocolDay?.carbs_g ?? null;
  const targetFatG = protocolDay?.fat_g ?? null;
  const targetHydrationMl = protocolDay?.hydration_ml ?? null;

  const calorieDeltaAvg =
    avgNutrition?.avgCalories != null && targetCalories != null && targetCalories > 0
      ? Math.round(((avgNutrition.avgCalories - targetCalories) / targetCalories) * 1000) / 10
      : null;
  const proteinDeltaAvg =
    avgNutrition?.avgProteinG != null && targetProteinG != null && targetProteinG > 0
      ? Math.round(((avgNutrition.avgProteinG - targetProteinG) / targetProteinG) * 1000) / 10
      : null;

  const rawInput: RawSignalInput = {
    weightSeries,
    bodyFatSeries,
    leanMassSeries,
    waistSeries,
    checkin: {
      energy: fieldAverages.energy ?? null,
      sleep_quality: fieldAverages.sleep_quality ?? null,
      sleep_duration: fieldAverages.sleep_duration ?? null,
      stress: fieldAverages.stress ?? null,
      muscle_soreness: fieldAverages.muscle_soreness ?? null,
      steps: fieldAverages.steps ?? null,
    },
    checkinResponseRate,
    anchorDate: evaluationDate,
    rhrSeries,
    performance: {
      exercises,
      global_overreaching: computeGlobalOverreaching(exercises),
      sessionsCount: sessionLogs.length,
      weeklyFrequency: Number(clientData.weekly_frequency ?? 3),
    },
    clientProfile,
    progression,
    nutrition: {
      target: {
        calories: targetCalories,
        protein_g: targetProteinG,
        carbs_g: targetCarbsG,
        fat_g: targetFatG,
        hydration_ml: targetHydrationMl,
      },
      actual: {
        avgCalories: avgNutrition?.avgCalories ?? null,
        avgProteinG: avgNutrition?.avgProteinG ?? null,
        avgCarbsG: avgNutrition?.avgCarbsG ?? null,
        avgFatG: avgNutrition?.avgFatG ?? null,
        avgHydrationMl: null,
      },
      adherence: {
        loggedDays: nutritionDays.length,
        expectedDays: windowDays,
        calorieDeltaAvg,
        proteinDeltaAvg,
        hydrationDeltaAvg: null,
      },
      source:
        nutritionDays.length > 0 && protocolDay
          ? "mixed"
          : nutritionDays.length > 0
            ? "meal_logs"
            : protocolDay
              ? "protocol_only"
              : "none",
    },
    latestBodyFat,
    gender:
      clientData.gender === "female" || clientData.gender === "male"
        ? clientData.gender
        : null,
    windowDays,
  };

  const signals = buildDerivedSignals(rawInput);
  const storedPrefsPartial = parseStoredPhasePreferences(
    clientData.phase_preferences,
  );
  const prefs = resolveCoachPhasePreferences(
    clientData.training_goal,
    storedPrefsPartial,
  );
  const derivedPhasePreferences = deriveCoachPhasePreferences(
    clientData.training_goal,
  );

  const engineResult = computePhaseOptimization(signals, {
    latestBodyFat,
    gender: rawInput.gender,
    prefs,
    locale,
  });

  const storedOverride = parseStoredPhaseOverride(clientData.phase_override);
  const result = applyManualOverride(engineResult, storedOverride, locale);

  if (!date) {
    const snap = snapshotFromResult(engineResult);
    await db.from("phase_optimization_history").upsert(
      {
        client_id: params.clientId,
        coach_id: user.id,
        recorded_on: evaluationDate,
        direction_score: snap.directionScore,
        adaptive_score: snap.adaptiveScore,
        direction: snap.direction,
        adaptive_state: snap.adaptiveState,
        data_quality: snap.dataQuality,
        engine_version: ENGINE_VERSION,
      },
      { onConflict: "client_id,recorded_on" },
    );
  }

  const historyStart = new Date(evaluationNow.getTime() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const { data: historyRows } = await db
    .from("phase_optimization_history")
    .select(
      "recorded_on, direction_score, adaptive_score, direction, adaptive_state",
    )
    .eq("client_id", params.clientId)
    .gte("recorded_on", historyStart)
    .lt("recorded_on", evaluationDate)
    .order("recorded_on", { ascending: true });

  const historyTrail = parseHistoryRows(historyRows);

  const c = rawInput.checkin;
  const sleepQuality = c.sleep_quality;
  const sleepDuration = c.sleep_duration;
  const sleepQualityNorm =
    sleepQuality != null ? Math.max(0, Math.min(1, (sleepQuality - 1) / 3)) : null;
  const sleepScore =
    sleepQualityNorm != null && sleepDuration != null
      ? Math.round(
          (sleepQualityNorm * 0.6 + Math.min(sleepDuration / 8, 1) * 0.4) *
            100,
        )
      : sleepQualityNorm != null
        ? Math.round(sleepQualityNorm * 100)
        : null;

  const { insufficientData: _insufficient, ...derivedSignals } = signals;

  const metricCards = buildPhaseFooterMetricCards(
    derivedSignals,
    { weightSeries, bodyFatSeries, windowDays },
    locale,
    sleepScore,
    evaluationNow,
  );

  const isStrategicPivot =
    clientData.training_goal === "hypertrophy" &&
    (clientProfile.currentPhase === "cut" || result.currentState.directionScore < 0);

  const insights = {
    strategicPivot: isStrategicPivot
      ? {
          id: "strategic-pivot-01",
          type: "STRATEGIC_PIVOT",
          status: "success",
          title: "Nettoyage Métabolique Actif",
          description: "Le point actuel est volontairement extrait de la Zone Optimale d'hypertrophie. Le protocole de restriction cyclique court terme (Carb Cycling) est appliqué pour réduire le BF et restaurer la sensibilité à l'insuline avant le prochain cycle de masse qualitative.",
          impact: "Pénalisation temporaire de la performance brute compensée par la préservation de la masse maigre.",
        }
      : undefined,
  };

  let weeksRemaining: number | null = null;
  if (targetDate) {
    const targetTime = new Date(targetDate).getTime();
    const nowTime = new Date(evaluationDate).getTime();
    if (!isNaN(targetTime)) {
      weeksRemaining = (targetTime - nowTime) / (1000 * 3600 * 24 * 7);
    }
  }

  const currentWeight = weightSeries.length > 0 ? weightSeries[weightSeries.length - 1].value : 0;
  const decision = computeOptimalPhase({
    currentWeight,
    targetWeight: targetWeight || currentWeight,
    weeksRemaining,
    cnsOverload: derivedSignals.cnsOverload || false
  });
  const coachDecision = buildCoachDecision(
    result,
    derivedSignals,
    rawInput,
    locale,
    historyTrail,
  );

  return NextResponse.json({
    ...result,
    locale,
    windowDays,
    transformationPhase: clientData.transformation_phase ?? null,
    trainingGoal: clientData.training_goal ?? null,
    clientProfile,
    derivedSignals,
    phasePreferences: prefs,
    derivedPhasePreferences,
    hasCustomPhasePreferences: storedPrefsPartial != null,
    historyTrail,
    metricCards,
    insights,
    coachDecision,
    enginePrescription: {
      optimalPhase: decision.phase,
      recommendedIntensity: decision.intensity,
      vetoActive: decision.vetoTriggered,
      clinicalReasoning: decision.reasoning
    }
  });
}
