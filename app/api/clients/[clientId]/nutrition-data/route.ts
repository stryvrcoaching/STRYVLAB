import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { NutritionClientData } from "@/lib/nutrition/types";
import {
  buildTrainingWeekSchedule,
  normalizeProgramForSchedule,
  pickActiveProgramForSchedule,
} from "@/lib/nutrition/training-week-schedule";
import { fetchClientDayOverride, resolveEffectiveDayKind } from '@/lib/client/day-kind'
import { z } from "zod";
import { getLatestClientMetrics } from "@/lib/client/latest-metrics";
import {
  computeRollingAverage,
  getLatestValueInWindow,
} from "@/lib/client/checkin/rollingSignals";
import { computePhysiologicalDateInTimezone } from "@/lib/client/checkin/timeWindows";
import { hasTemplateBlock } from "@/lib/assessments/templateSnapshot";
import {
  DEFAULT_REALTIME_WINDOW_DAYS,
  canUseRealtimeSignal,
  getNutritionSignalWindowDays,
} from "@/lib/nutrition/dataGovernance";
import { computeRobustAverageRestSec } from "@/lib/training/restMetrics";
import { fetchClientTdeeState, hasCurrentTdeeSkip } from "@/lib/nutrition/tdee-state";
import { resolveProtocolStartDate } from "@/lib/nutrition/weightSamples";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function avg(samples: number[]): number | null {
  if (samples.length === 0) return null;
  return (
    Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10
  );
}

function roundTo1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildAnchoredWindow(anchorDate: string, days: number) {
  const endExclusive = new Date(`${anchorDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const startInclusive = new Date(endExclusive);
  startInclusive.setUTCDate(startInclusive.getUTCDate() - days);

  return {
    startInclusive,
    endExclusive,
  };
}

function estimateTrainingCaloriesWeekly(params: {
  weightKg: number | null;
  weeklyFrequency: number | null;
  avgSessionDurationMin: number | null;
  avgEffectiveSets: number | null;
  avgRestSec: number | null;
}) {
  const {
    weightKg,
    weeklyFrequency,
    avgSessionDurationMin,
    avgEffectiveSets,
    avgRestSec,
  } = params;
  if (
    weightKg == null ||
    weeklyFrequency == null ||
    avgSessionDurationMin == null ||
    weeklyFrequency <= 0 ||
    avgSessionDurationMin <= 0
  ) {
    return null;
  }

  let met = 4.8;
  if (avgEffectiveSets != null) {
    if (avgEffectiveSets >= 24) met += 0.7;
    else if (avgEffectiveSets >= 18) met += 0.45;
    else if (avgEffectiveSets >= 12) met += 0.2;
  }
  if (avgRestSec != null) {
    if (avgRestSec <= 60) met += 0.4;
    else if (avgRestSec <= 90) met += 0.2;
    else if (avgRestSec >= 180) met -= 0.15;
  }
  if (avgSessionDurationMin >= 90) met += 0.2;

  const boundedMet = clamp(met, 4.5, 6.2);
  return Math.round(
    (boundedMet * weightKg * avgSessionDurationMin / 60) * weeklyFrequency,
  );
}

const OCCUPATION_MULTIPLIER_MAP: Record<string, number> = {
  "Sédentaire (bureau)": 1.0,
  "Légèrement actif": 1.05,
  "Modérément actif": 1.1,
  "Très actif (travail physique)": 1.18,
};

// Schema for PATCH requests
const nutritionDataPatchSchema = z.object({
  weight_kg: z.number().positive().optional(),
  height_cm: z.number().positive().optional(),
  body_fat_pct: z.number().min(0).max(100).optional(),
  body_fat_source: z.enum(["measured", "estimated"]).optional(),
  body_fat_source_method: z.string().min(1).optional(),
  lean_mass_kg: z.number().positive().optional(),
  lean_mass_source: z.enum(["measured", "estimated"]).optional(),
  lean_mass_source_method: z.string().min(1).optional(),
  muscle_mass_kg: z.number().positive().optional(),
  muscle_mass_source: z.enum(["measured", "estimated"]).optional(),
  muscle_mass_source_method: z.string().min(1).optional(),
  bmr_kcal_measured: z.number().positive().optional(),
  bmr_source: z.enum(["measured", "estimated", "calculated"]).optional(),
  visceral_fat_level: z.number().min(0).optional(),
  weekly_frequency: z.number().min(0).max(14).optional(),
  session_duration_min: z.number().min(0).max(240).optional(),
  training_calories_weekly: z.number().min(0).optional(),
  daily_steps: z.number().min(0).optional(),
  cardio_frequency: z.number().min(0).max(14).optional(),
  cardio_duration_min: z.number().min(0).max(240).optional(),
  sleep_duration_h: z.number().min(0).max(24).optional(),
  sleep_quality: z.number().min(0).max(10).optional(),
  stress_level: z.number().min(0).max(10).optional(),
  caffeine_daily_mg: z.number().min(0).optional(),
  alcohol_weekly: z.number().min(0).optional(),
  work_hours_per_week: z.number().min(0).max(168).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { clientId } = params;

  // Ownership check
  const { data: client, error: clientError } = await db
    .from("coach_clients")
    .select(
      "id, first_name, last_name, email, date_of_birth, gender, weekly_frequency, fitness_level, transformation_phase, training_goal, sport_practice, equipment_category, timezone",
    )
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Extract submissionId from query params (optional)
  const { searchParams } = new URL(req.url);
  const mode =
    searchParams.get("mode") === "realtime" ? "realtime" : "bilan";
  const requestedSubmissionId = searchParams.get("submissionId");
  const requestedProtocolId = searchParams.get("protocolId");

  // Fetch all submissions for the bilan selector (no limit)
  const { data: rawSubmissions } = await db
    .from("assessment_submissions")
    .select("id, submitted_at, bilan_date, status, template_snapshot")
    .eq("client_id", clientId)
    .eq("coach_id", user.id)
    .in("status", ["completed", "in_progress"])
    .order("submitted_at", { ascending: false });

  const allSubmissions = (rawSubmissions ?? []).filter(
    (submission: any) => !hasTemplateBlock(submission?.template_snapshot, "checkin_realtime_block"),
  );

  // Determine which submission to fetch data from
  let selectedSubmissionId = mode === "bilan" ? requestedSubmissionId : null;
  let targetSubmissionId = mode === "bilan" ? requestedSubmissionId : null;

  // If no specific submission requested, use latest
  if (!targetSubmissionId && allSubmissions && allSubmissions.length > 0) {
    targetSubmissionId = allSubmissions[0].id;
    selectedSubmissionId = targetSubmissionId;
  }

  const selectedSubmissionMeta =
    mode === "bilan"
      ? allSubmissions.find((submission: any) => submission.id === targetSubmissionId) ?? null
      : null;
  const clientTimezone =
    typeof client.timezone === "string" && client.timezone.length > 0
      ? client.timezone
      : "Europe/Paris";
  const anchorDate =
    mode === "bilan" && selectedSubmissionMeta
      ? (
          selectedSubmissionMeta.bilan_date
          ?? String(selectedSubmissionMeta.submitted_at).slice(0, 10)
        )
      : computePhysiologicalDateInTimezone(new Date(), clientTimezone);
  const realtimeWindowDays = DEFAULT_REALTIME_WINDOW_DAYS;

  // Fetch assessment data for the selected submission AND all previous submissions (for fallback)
  let submissions: Array<{
    id: string;
    client_id: string;
    submitted_at: string;
    assessment_responses: Array<{
      field_key: string;
      value_number: number | null;
      value_text: string | null;
      value_json: unknown;
    }>;
  }> = [];

  if (targetSubmissionId) {
    // Fetch target submission
    const { data: targetData } = await db
      .from("assessment_submissions")
      .select(
        `
        id,
        client_id,
        submitted_at,
        assessment_responses(field_key, value_number, value_text, value_json)
      `,
      )
      .eq("id", targetSubmissionId)
      .eq("client_id", clientId)
      .eq("coach_id", user.id)
      .single();
    if (targetData) {
      submissions = [targetData];
    }

    // Also fetch ALL older submissions (for fallback values if target has missing data)
    if (allSubmissions && allSubmissions.length > 1) {
      const olderIds = allSubmissions
        .slice(1)
        .map((s: any) => s.id);
      if (olderIds.length > 0) {
        const { data: olderData } = await db
          .from("assessment_submissions")
          .select(
            `
            id,
            client_id,
            submitted_at,
            assessment_responses(field_key, value_number, value_text, value_json)
          `,
          )
          .in("id", olderIds)
          .eq("client_id", clientId)
          .eq("coach_id", user.id)
          .order("submitted_at", { ascending: false });
        if (olderData) {
          submissions = [...submissions, ...olderData];
        }
      }
    }
  }

  // Recent client check-ins are considered the freshest client-entered signals.
  const { data: recentCheckins } = await db
    .from("client_daily_checkins")
    .select("date, flow_type, weight_kg, daily_steps, sleep_hours, sleep_quality, energy_level, stress_level")
    .eq("client_id", clientId)
    .lte("date", anchorDate)
    .order("date", { ascending: false })
    .limit(30);

  const entry = {
    weight_kg: null as number | null,
    body_fat_pct: null as number | null,
    height_cm: null as number | null,
    waist_cm: null as number | null,
    neck_cm: null as number | null,
    hips_cm: null as number | null,
    muscle_mass_kg: null as number | null,
    lean_mass_kg: null as number | null,
    bmr_kcal_measured: null as number | null,
    visceral_fat_level: null as number | null,
    session_duration_min: null as number | null,
    training_calories: null as number | null,
    training_frequency: null as number | null,
    daily_steps: null as number | null,
    cardio_frequency: null as number | null,
    cardio_duration_min: null as number | null,
    caffeine_daily_mg: null as number | null,
    alcohol_weekly: null as number | null,
    work_hours_per_week: null as number | null,
    occupation: null as string | null,
    menstrual_cycle: null as string | null,
    stress_samples: [] as number[],
    sleep_h_samples: [] as number[],
    sleep_q_samples: [] as number[],
    energy_samples: [] as number[],
  };

  // Track data source (selected submission vs fallback vs manual)
  const dataSource: Record<string, 'selected' | 'fallback' | 'manual' | 'estimated'> = {
    weight_kg: 'fallback',
    body_fat_pct: 'fallback',
    height_cm: 'fallback',
    waist_cm: 'fallback',
    neck_cm: 'fallback',
    hips_cm: 'fallback',
    muscle_mass_kg: 'fallback',
    lean_mass_kg: 'fallback',
    bmr_kcal_measured: 'fallback',
    visceral_fat_level: 'fallback',
    weekly_frequency: 'fallback',
    session_duration_min: 'fallback',
    training_calories: 'fallback',
    daily_steps: 'fallback',
    cardio_frequency: 'fallback',
    cardio_duration_min: 'fallback',
    sleep_duration_h: 'fallback',
    sleep_quality: 'fallback',
    stress_level: 'fallback',
    caffeine_daily_mg: 'fallback',
    alcohol_weekly: 'fallback',
    work_hours_per_week: 'fallback',
  };

  const BIOMETRIC = [
    "weight_kg",
    "body_fat_pct",
    "height_cm",
    "waist_cm",
    "neck_cm",
    "hips_cm",
    "muscle_mass_kg",
    "lean_mass_kg",
    "bmr_kcal_measured",
    "visceral_fat_level",
  ];
  const TRAINING = [
    "session_duration_min",
    "training_calories",
    "training_frequency",
  ];
  const CARDIO = ["daily_steps", "cardio_frequency", "cardio_duration_min"];
  const LIFESTYLE = [
    "caffeine_daily_mg",
    "alcohol_weekly",
    "work_hours_per_week",
  ];

  for (const sub of submissions ?? []) {
    const responses =
      (sub.assessment_responses as {
        field_key: string;
        value_number: number | null;
        value_text: string | null;
        value_json: unknown;
      }[]) ?? [];
    for (const r of responses) {
      const num = r.value_number;

      if (
        BIOMETRIC.includes(r.field_key) &&
        (entry as Record<string, unknown>)[r.field_key] === null &&
        num !== null
      ) {
        (entry as Record<string, unknown>)[r.field_key] = num;
        dataSource[r.field_key] = sub.id === targetSubmissionId ? 'selected' : 'fallback';
        continue;
      }
      if (
        TRAINING.includes(r.field_key) &&
        (entry as Record<string, unknown>)[r.field_key] === null &&
        num !== null
      ) {
        (entry as Record<string, unknown>)[r.field_key] = num;
        dataSource[r.field_key] = sub.id === targetSubmissionId ? 'selected' : 'fallback';
        continue;
      }
      if (
        CARDIO.includes(r.field_key) &&
        (entry as Record<string, unknown>)[r.field_key] === null &&
        num !== null
      ) {
        (entry as Record<string, unknown>)[r.field_key] = num;
        dataSource[r.field_key] = sub.id === targetSubmissionId ? 'selected' : 'fallback';
        continue;
      }
      if (
        LIFESTYLE.includes(r.field_key) &&
        (entry as Record<string, unknown>)[r.field_key] === null &&
        num !== null
      ) {
        (entry as Record<string, unknown>)[r.field_key] = num;
        dataSource[r.field_key] = sub.id === targetSubmissionId ? 'selected' : 'fallback';
        continue;
      }
      if (
        r.field_key === "stress_level" &&
        num !== null &&
        entry.stress_samples.length < 3
      ) {
        entry.stress_samples.push(num);
        continue;
      }
      if (
        r.field_key === "sleep_duration_h" &&
        num !== null &&
        entry.sleep_h_samples.length < 3
      ) {
        entry.sleep_h_samples.push(num);
        continue;
      }
      if (
        r.field_key === "sleep_quality" &&
        num !== null &&
        entry.sleep_q_samples.length < 3
      ) {
        entry.sleep_q_samples.push(num);
        continue;
      }
      if (
        r.field_key === "energy_level" &&
        num !== null &&
        entry.energy_samples.length < 3
      ) {
        entry.energy_samples.push(num);
        continue;
      }
      if (
        r.field_key === "occupation" &&
        entry.occupation === null &&
        r.value_text
      ) {
        entry.occupation = r.value_text;
        continue;
      }
      if (
        r.field_key === "menstrual_cycle" &&
        entry.menstrual_cycle === null &&
        r.value_text
      ) {
        entry.menstrual_cycle = r.value_text;
        continue;
      }
    }
  }

  // Fetch manual nutrition data overrides
  // Priority: per-submission data (if submission selected), then global fallback
  let manualData = null;

  if (mode === "bilan" && targetSubmissionId) {
    const { data: perSubmission } = await db
      .from("coach_client_nutrition_manual_data")
      .select("*")
      .eq("client_id", clientId)
      .eq("coach_id", user.id)
      .eq("assessment_submission_id", targetSubmissionId)
      .single();
    if (perSubmission) manualData = perSubmission;
  }

  // If no per-submission data, try global fallback (assessment_submission_id IS NULL)
  if (!manualData) {
    const { data: globalFallback } = await db
      .from("coach_client_nutrition_manual_data")
      .select("*")
      .eq("client_id", clientId)
      .eq("coach_id", user.id)
      .is("assessment_submission_id", null)
      .single();
    if (globalFallback) manualData = globalFallback;
  }

  // Override with manual data (takes priority over assessment, but check-ins overwrite this in realtime)
  if (manualData) {
    for (const field of [
      "weight_kg",
      "height_cm",
      "body_fat_pct",
      "lean_mass_kg",
      "muscle_mass_kg",
      "bmr_kcal_measured",
      "visceral_fat_level",
      "weekly_frequency",
      "session_duration_min",
      "training_calories_weekly",
      "daily_steps",
      "cardio_frequency",
      "cardio_duration_min",
      "sleep_duration_h",
      "sleep_quality",
      "stress_level",
      "caffeine_daily_mg",
      "alcohol_weekly",
      "work_hours_per_week",
    ]) {
      const value = (manualData as Record<string, unknown>)[field];
      if (value !== null && value !== undefined) {
        const entryField =
          field === "weekly_frequency"
            ? "training_frequency"
            : field === "training_calories_weekly"
              ? "training_calories"
              : field === "sleep_duration_h"
                ? "sleep_h_samples"
                : field === "sleep_quality"
                  ? "sleep_q_samples"
                  : field === "stress_level"
                ? "stress_samples"
                    : field;
        const sourceField =
          field === "training_calories_weekly" ? "training_calories" : field;
        if (entryField === "sleep_h_samples") {
          entry.sleep_h_samples = [Number(value)];
        } else if (entryField === "sleep_q_samples") {
          entry.sleep_q_samples = [Number(value)];
        } else if (entryField === "stress_samples") {
          entry.stress_samples = [Number(value)];
        } else {
          (entry as Record<string, unknown>)[entryField] = value;
        }
        if (
          (field === "body_fat_pct" &&
            (manualData as Record<string, unknown>).body_fat_source === "estimated") ||
          (field === "lean_mass_kg" &&
            (manualData as Record<string, unknown>).lean_mass_source === "estimated") ||
          (field === "muscle_mass_kg" &&
            (manualData as Record<string, unknown>).muscle_mass_source === "estimated")
        ) {
          dataSource[sourceField] = 'estimated';
        } else {
          dataSource[sourceField] = 'manual';
        }
      }
    }
  }

  // Overlay with freshest check-in values.
  if (recentCheckins && recentCheckins.length > 0) {
    const weightWindowDays = getNutritionSignalWindowDays("weight_kg", mode);
    if (canUseRealtimeSignal("weight_kg", mode) && weightWindowDays) {
      const weightLatest = getLatestValueInWindow(
        recentCheckins.map((c: any) => ({
          date: String(c.date),
          value: c.weight_kg != null ? Number(c.weight_kg) : null,
        })),
        anchorDate,
        weightWindowDays,
      );
      if (weightLatest != null && dataSource.weight_kg !== "manual") {
        entry.weight_kg = weightLatest;
        dataSource.weight_kg = "selected";
      }
    }

    const stepsWindowDays = getNutritionSignalWindowDays("daily_steps", mode);
    if (canUseRealtimeSignal("daily_steps", mode) && stepsWindowDays) {
      const stepsAvg = computeRollingAverage(
        recentCheckins.map((c: any) => ({
          date: String(c.date),
          value: c.daily_steps != null ? Number(c.daily_steps) : null,
        })),
        anchorDate,
        stepsWindowDays,
      );
      if (stepsAvg != null && dataSource.daily_steps !== "manual") {
        entry.daily_steps = stepsAvg;
        dataSource.daily_steps = 'selected';
      }
    }

    const sleepDurationWindowDays = getNutritionSignalWindowDays(
      "sleep_duration_h",
      mode,
    );
    if (canUseRealtimeSignal("sleep_duration_h", mode) && sleepDurationWindowDays) {
      const recentSleepH = computeRollingAverage(
        recentCheckins.map((c: any) => ({
          date: String(c.date),
          value: c.sleep_hours != null ? Number(c.sleep_hours) : null,
        })),
        anchorDate,
        sleepDurationWindowDays,
      );
      if (recentSleepH != null && dataSource.sleep_duration_h !== "manual") {
        entry.sleep_h_samples = [recentSleepH];
        dataSource.sleep_duration_h = "selected";
      }
    }

    const sleepQualityWindowDays = getNutritionSignalWindowDays(
      "sleep_quality",
      mode,
    );
    if (canUseRealtimeSignal("sleep_quality", mode) && sleepQualityWindowDays) {
      const recentSleepQ = computeRollingAverage(
        recentCheckins.map((c: any) => ({
          date: String(c.date),
          value: c.sleep_quality != null ? Number(c.sleep_quality) : null,
        })),
        anchorDate,
        sleepQualityWindowDays,
      );
      if (recentSleepQ != null && dataSource.sleep_quality !== "manual") {
        entry.sleep_q_samples = [recentSleepQ];
        dataSource.sleep_quality = "selected";
      }
    }

    const energyWindowDays = getNutritionSignalWindowDays("energy_level", mode);
    if (canUseRealtimeSignal("energy_level", mode) && energyWindowDays) {
      const recentEnergy = computeRollingAverage(
        recentCheckins.map((c: any) => ({
          date: String(c.date),
          value: c.energy_level != null ? Number(c.energy_level) : null,
        })),
        anchorDate,
        energyWindowDays,
      );
      if (recentEnergy != null) {
        entry.energy_samples = [recentEnergy];
      }
    }

    const stressWindowDays = getNutritionSignalWindowDays("stress_level", mode);
    if (canUseRealtimeSignal("stress_level", mode) && stressWindowDays) {
      const recentStress = computeRollingAverage(
        recentCheckins.map((c: any) => ({
          date: String(c.date),
          value: c.stress_level != null ? Number(c.stress_level) : null,
        })),
        anchorDate,
        stressWindowDays,
      );
      if (recentStress != null && dataSource.stress_level !== "manual") {
        entry.stress_samples = [recentStress];
        dataSource.stress_level = "selected";
      }
    }
  }

  // Canonical latest values (assessment_responses enriched in realtime, plus check-in freshness)
  const latest = await getLatestClientMetrics(db, clientId, [
    "weight_kg",
    "sleep_duration_h",
    "sleep_quality",
    "energy_level",
    "stress_level",
  ]);
  if (mode === "realtime" && latest.weight_kg) {
    entry.weight_kg = latest.weight_kg.value;
    dataSource.weight_kg = "selected";
  }

  // Manual overrides have been moved above the real-time overlays.

  const { startInclusive, endExclusive } = buildAnchoredWindow(anchorDate, 28);
  const { startInclusive: caffeineStartInclusive } = buildAnchoredWindow(
    anchorDate,
    7,
  );

  const [
    { data: clientPrograms },
    { data: recentSessionLogs },
    { data: recentActivityLogs },
    { data: recentCaffeineLogs },
  ] = await Promise.all([
    db
      .from("programs")
      .select(
        `
        id, name, goal, status, session_mode, is_client_visible, created_at,
        program_sessions (
          id, name, day_of_week, days_of_week, position,
            program_exercises (
              id, name, sets, reps, rep_min, rep_max, rest_sec, rir, target_rir,
              tempo, movement_pattern, is_unilateral, is_compound,
              execution_type, target_hr_zone
            )
        )
      `,
      )
      .eq("client_id", clientId)
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .from("client_session_logs")
      .select(
        `
        id, logged_at, completed_at, duration_min,
        client_set_logs ( completed, actual_reps, rest_sec_actual )
      `,
      )
      .eq("client_id", clientId)
      .gte("logged_at", startInclusive.toISOString())
      .lt("logged_at", endExclusive.toISOString())
      .order("logged_at", { ascending: false }),
    db
      .from("client_activity_logs")
      .select("id, started_at, duration_min")
      .eq("client_id", clientId)
      .gte("started_at", startInclusive.toISOString())
      .lt("started_at", endExclusive.toISOString())
      .order("started_at", { ascending: false }),
    db
      .from("client_water_logs")
      .select("logged_at, caffeine_mg")
      .eq("client_id", clientId)
      .gte("logged_at", caffeineStartInclusive.toISOString())
      .lt("logged_at", endExclusive.toISOString())
      .order("logged_at", { ascending: false }),
  ]);

  const activeProgram = pickActiveProgramForSchedule(clientPrograms ?? []);
  const trainingWeekSchedule = buildTrainingWeekSchedule(
    activeProgram ? normalizeProgramForSchedule(activeProgram as any) : null,
  );

  const plannedCardioExercises = (activeProgram?.program_sessions ?? [])
    .flatMap((session: any) => session.program_exercises ?? [])
    .filter((exercise: any) => exercise.execution_type && exercise.execution_type !== "reps_rir");
  const plannedCardioSessions = (activeProgram?.program_sessions ?? []).filter((session: any) =>
    (session.program_exercises ?? []).some((exercise: any) => exercise.execution_type && exercise.execution_type !== "reps_rir"),
  );
  const plannedCardioMinutes = plannedCardioExercises.reduce((total: number, exercise: any) => {
    if (exercise.execution_type !== "time_rpe") return total;
    const raw = String(exercise.reps ?? "");
    const match = raw.match(/\d+(?:[.,]\d+)?/);
    return total + (match ? Number(match[0].replace(",", ".")) : 0);
  }, 0);
  const plannedCardioTypes = Array.from(new Set(
    plannedCardioExercises
      .map((exercise: any) => String(exercise.target_hr_zone ?? "").trim())
      .filter(Boolean),
  ));
  const plannedCardioRpeValues = plannedCardioExercises
    .map((exercise: any) => Number(exercise.target_rir ?? exercise.rir))
    .filter((value: number) => Number.isFinite(value) && value >= 1 && value <= 10);
  const plannedTraining = {
    weeklyFrequency: trainingWeekSchedule.days.filter((day) => day.kind === "training").length || null,
    cardioFrequency: plannedCardioSessions.length || null,
    cardioDurationMin: plannedCardioSessions.length > 0
      ? Math.round((plannedCardioMinutes / plannedCardioSessions.length) * 10) / 10
      : null,
    cardioTypes: plannedCardioTypes,
    cardioRpe: plannedCardioRpeValues.length > 0
      ? Math.round((plannedCardioRpeValues.reduce((sum: number, value: number) => sum + value, 0) / plannedCardioRpeValues.length) * 10) / 10
      : null,
  };
  const plannedStrengthExercises = (activeProgram?.program_sessions ?? [])
    .flatMap((session: any) => session.program_exercises ?? [])
    .filter((exercise: any) => !exercise.execution_type || exercise.execution_type === "reps_rir");
  const plannedStrengthFrequency = (activeProgram?.program_sessions ?? []).filter((session: any) =>
    (session.program_exercises ?? []).some((exercise: any) => !exercise.execution_type || exercise.execution_type === "reps_rir"),
  ).length;
  const parseRepNumbers = (value: unknown) => (String(value ?? "").match(/\d+(?:[.,]\d+)?/g) ?? []).map((item) => Number(item.replace(",", ".")));
  const averagePlannedReps = (value: unknown) => {
    const numbers = parseRepNumbers(value);
    if (numbers.length === 0) return 0;
    return numbers.length > 1 ? (numbers[0] + numbers[1]) / 2 : numbers[0];
  };
  const plannedSetsWeekly = plannedStrengthExercises.reduce((sum: number, exercise: any) => sum + Math.max(0, Number(exercise.sets ?? 0)), 0);
  const plannedRepsWeekly = plannedStrengthExercises.reduce((sum: number, exercise: any) => sum + Math.max(0, Number(exercise.sets ?? 0) * averagePlannedReps(exercise.reps)), 0);
  const plannedRestMinutesWeekly = plannedStrengthExercises.reduce((sum: number, exercise: any) => sum + Math.max(0, Number(exercise.sets ?? 0) - 1) * Math.max(0, Number(exercise.rest_sec ?? 0)) / 60, 0);
  const plannedTrainingRirValues = plannedStrengthExercises
    .map((exercise: any) => Number(exercise.target_rir ?? exercise.rir))
    .filter((value: number) => Number.isFinite(value) && value >= 0 && value <= 5);
  const plannedStrengthWorkMinutes = plannedRepsWeekly * 3 / 60;
  plannedTraining.sessionDurationMin = trainingWeekSchedule.days.filter((day) => day.kind === "training").length > 0
    ? (plannedCardioMinutes + plannedStrengthWorkMinutes + plannedRestMinutesWeekly) / (trainingWeekSchedule.days.filter((day) => day.kind === "training").length)
    : null;
  plannedTraining.trainingTypes = plannedStrengthExercises.length > 0 ? ["Musculation / Powerlifting"] : [];
  plannedTraining.strengthFrequency = plannedStrengthFrequency || null;
  plannedTraining.trainingRir = plannedTrainingRirValues.length > 0
    ? plannedTrainingRirValues.reduce((sum: number, value: number) => sum + value, 0) / plannedTrainingRirValues.length
    : null;
  plannedTraining.setsWeekly = plannedSetsWeekly;
  plannedTraining.repsWeekly = plannedRepsWeekly;
  plannedTraining.restMinutesWeekly = plannedRestMinutesWeekly;

  if (dataSource.weekly_frequency !== "manual") {
    const scheduledTrainingDays = trainingWeekSchedule.days.filter(
      (day) => day.kind === "training",
    ).length;
    if (scheduledTrainingDays > 0) {
      entry.training_frequency = scheduledTrainingDays;
      dataSource.weekly_frequency = "selected";
    }
  }

  const meaningfulSessionLogs = ((recentSessionLogs ?? []) as any[]).filter(
    (log) =>
      !!log.completed_at ||
      ((log.client_set_logs ?? []) as any[]).some(
        (set) => !!set.completed || set.actual_reps != null,
      ),
  );
  const durationSamples = meaningfulSessionLogs
    .map((log) => Number(log.duration_min))
    .filter((value) => Number.isFinite(value) && value > 0);
  const avgSessionDurationMin =
    durationSamples.length > 0
      ? roundTo1(
          durationSamples.reduce((sum, value) => sum + value, 0)
            / durationSamples.length,
        )
      : null;

  const effectiveSetCounts = meaningfulSessionLogs
    .map((log) =>
      ((log.client_set_logs ?? []) as any[]).filter(
        (set) => !!set.completed || set.actual_reps != null,
      ).length,
    )
    .filter((count) => count > 0);
  const avgEffectiveSets =
    effectiveSetCounts.length > 0
      ? roundTo1(
          effectiveSetCounts.reduce((sum, value) => sum + value, 0)
            / effectiveSetCounts.length,
        )
      : null;

  const restValues = meaningfulSessionLogs.flatMap((log) =>
    ((log.client_set_logs ?? []) as any[])
      .map((set) => Number(set.rest_sec_actual))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
  const avgRestSec = computeRobustAverageRestSec(restValues);

  if (dataSource.session_duration_min !== "manual" && avgSessionDurationMin != null) {
    entry.session_duration_min = avgSessionDurationMin;
    dataSource.session_duration_min = "selected";
  }

  const trainingCaloriesEstimate = estimateTrainingCaloriesWeekly({
    weightKg: entry.weight_kg,
    weeklyFrequency: entry.training_frequency ?? client.weekly_frequency ?? null,
    avgSessionDurationMin,
    avgEffectiveSets,
    avgRestSec,
  });
  if (dataSource.training_calories !== "manual" && trainingCaloriesEstimate != null) {
    entry.training_calories = trainingCaloriesEstimate;
    dataSource.training_calories = "selected";
  }

  const activityLogs = (recentActivityLogs ?? []) as Array<{
    id: string;
    started_at: string;
    duration_min: number;
  }>;
  if (dataSource.cardio_frequency !== "manual" && activityLogs.length > 0) {
    entry.cardio_frequency = roundTo1((activityLogs.length / 28) * 7);
    dataSource.cardio_frequency = "selected";
  }
  if (dataSource.cardio_duration_min !== "manual" && activityLogs.length > 0) {
    entry.cardio_duration_min = roundTo1(
      activityLogs.reduce((sum, log) => sum + Number(log.duration_min ?? 0), 0)
        / activityLogs.length,
    );
    dataSource.cardio_duration_min = "selected";
  }

  if (dataSource.caffeine_daily_mg !== "manual") {
    const caffeineTotalMg = ((recentCaffeineLogs ?? []) as any[]).reduce(
      (sum, log) => sum + Number(log.caffeine_mg ?? 0),
      0,
    );
    if (caffeineTotalMg > 0) {
      entry.caffeine_daily_mg = roundTo1(caffeineTotalMg / 7);
      dataSource.caffeine_daily_mg = "selected";
    }
  }

  let age: number | null = null;
  if (client.date_of_birth) {
    const dob = new Date(client.date_of_birth);
    const today = new Date();
    age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  }

  // Clamp training fields to sensible ranges
  if (entry.session_duration_min !== null) {
    entry.session_duration_min = Math.max(
      15,
      Math.min(240, entry.session_duration_min),
    );
  }
  if (entry.cardio_frequency !== null) {
    entry.cardio_frequency = Math.max(0, Math.min(14, entry.cardio_frequency));
  }
  if (entry.cardio_duration_min !== null) {
    entry.cardio_duration_min = Math.max(
      0,
      Math.min(180, entry.cardio_duration_min),
    );
  }

  // Validate weekly_frequency bounds (1-7 days/week)
  let validWeeklyFrequency =
    entry.training_frequency ?? client.weekly_frequency;
  if (
    validWeeklyFrequency != null &&
    (validWeeklyFrequency < 1 || validWeeklyFrequency > 7)
  ) {
    validWeeklyFrequency = null;
  }

  const result: NutritionClientData = {
    id: client.id,
    name: [client.first_name, client.last_name].filter(Boolean).join(" "),
    gender: client.gender ?? null,
    age,
    height_cm: entry.height_cm,
    weight_kg: entry.weight_kg,
    waist_cm: entry.waist_cm,
    neck_cm: entry.neck_cm,
    hips_cm: entry.hips_cm,
    body_fat_pct: entry.body_fat_pct,
    muscle_mass_kg: entry.muscle_mass_kg,
    lean_mass_kg: entry.lean_mass_kg,
    bmr_kcal_measured: entry.bmr_kcal_measured,
    visceral_fat_level: entry.visceral_fat_level,
    weekly_frequency: validWeeklyFrequency,
    transformation_phase: client.transformation_phase ?? null,
    training_goal: client.training_goal ?? null,
    sport_practice: client.sport_practice ?? null,
    session_duration_min: entry.session_duration_min,
    training_calories_weekly: entry.training_calories,
    cardio_frequency: entry.cardio_frequency,
    cardio_duration_min: entry.cardio_duration_min,
    daily_steps: entry.daily_steps,
    stress_level: avg(entry.stress_samples),
    sleep_duration_h: avg(entry.sleep_h_samples),
    sleep_quality: avg(entry.sleep_q_samples),
    energy_level: avg(entry.energy_samples),
    caffeine_daily_mg: entry.caffeine_daily_mg,
    alcohol_weekly: entry.alcohol_weekly,
    work_hours_per_week: entry.work_hours_per_week,
    menstrual_cycle: entry.menstrual_cycle,
    occupation: entry.occupation,
    occupation_multiplier: entry.occupation
      ? (OCCUPATION_MULTIPLIER_MAP[entry.occupation] ?? null)
      : null,
  };

  const anchorJsDay = new Date(`${anchorDate}T12:00:00Z`).getUTCDay()
  const anchorDow = anchorJsDay === 0 ? 7 : anchorJsDay
  const anchorScheduleEntry = trainingWeekSchedule.days.find((d) => d.dow === anchorDow) ?? null
  const dayOverride = await fetchClientDayOverride(db, clientId, anchorDate)
  const effectiveDayKind = resolveEffectiveDayKind({
    weekdayKind: anchorScheduleEntry?.kind ?? null,
    overrideKind: dayOverride?.kind ?? null,
  })

  const [clientTdeeState, activeProtocol, tdeeProtocolStartDate] = await Promise.all([
    fetchClientTdeeState(db as any, clientId),
    requestedProtocolId
      ? db
          .from("nutrition_protocols")
          .select("name, tdee_reference, tdee_snapshot_source, tdee_snapshot_used_at")
          .eq("id", requestedProtocolId)
          .eq("client_id", clientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    requestedProtocolId
      ? resolveProtocolStartDate(db as any, clientId, "", requestedProtocolId)
      : Promise.resolve(null),
  ]);
  const resolvedTdeeProtocolStartDate =
    tdeeProtocolStartDate ??
    (requestedProtocolId
      ? await resolveProtocolStartDate(
          db as any,
          clientId,
          String((activeProtocol as any)?.name ?? ""),
          requestedProtocolId,
        )
      : null);

  return NextResponse.json({
    client: result,
    mode,
    anchorDate,
    realtimeWindowDays,
    dataSource,
    tdeeAdaptive: clientTdeeState?.current_tdee ?? null,
    tdeeAdaptiveAt: clientTdeeState?.current_tdee_at ?? null,
    tdeeAdaptiveLower: clientTdeeState?.current_tdee_lower ?? null,
    tdeeAdaptiveUpper: clientTdeeState?.current_tdee_upper ?? null,
    tdeeObserved: clientTdeeState?.latest_observed_tdee ?? null,
    tdeeObservedLower: clientTdeeState?.latest_observed_lower ?? null,
    tdeeObservedUpper: clientTdeeState?.latest_observed_upper ?? null,
    tdeeActionableStreak: clientTdeeState?.actionable_streak ?? 0,
    tdeeDataSource: clientTdeeState?.source ?? null,
    tdeeStabilityStatus: clientTdeeState?.stability_status ?? null,
    tdeeEstimationStatus: clientTdeeState?.estimation_status ?? 'collecting',
    tdeeDataQualityScore: clientTdeeState?.data_quality_score ?? null,
    tdeeDataQualityReasons: clientTdeeState?.data_quality_reasons ?? [],
    tdeeLastSkipReason: hasCurrentTdeeSkip(clientTdeeState)
      ? clientTdeeState?.last_skip_reason ?? null
      : null,
    tdeeLastSuccessAt: clientTdeeState?.last_success_at ?? null,
    tdeeProtocolStartDate: resolvedTdeeProtocolStartDate,
    tdeeProtocolSnapshot: (activeProtocol as any)?.tdee_reference ?? null,
    tdeeProtocolSnapshotAt: (activeProtocol as any)?.tdee_snapshot_used_at ?? null,
    tdeeProtocolSnapshotSource: (activeProtocol as any)?.tdee_snapshot_source ?? null,
    allSubmissions: (allSubmissions || []).map((s: any) => ({
      id: s.id,
      date: new Date(
        s.bilan_date ? `${s.bilan_date}T12:00:00.000Z` : s.submitted_at,
      ).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      }),
      bilan_date: s.bilan_date ?? null,
      status: s.status,
      submitted_at: s.submitted_at,
    })),
    selectedSubmissionId: selectedSubmissionId || null,
    trainingWeekSchedule,
    plannedTraining,
    dayOverride,
    effectiveDayKind,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { clientId } = params;

  // Ownership check
  const { data: client, error: clientError } = await db
    .from("coach_clients")
    .select("id, coach_id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const validated = nutritionDataPatchSchema.parse(body);

    // Get selected submission from query params (to tie data to specific bilan)
    const { searchParams } = new URL(req.url);
    const targetSubmissionId = searchParams.get("submissionId");

    // Insert or upsert into manual data table
    // If submissionId provided, data is tied to that bilan only
    // If no submissionId, data is global fallback
    const { error: upsertError } = await db
      .from("coach_client_nutrition_manual_data")
      .upsert(
        {
          client_id: clientId,
          coach_id: user.id,
          assessment_submission_id: targetSubmissionId || null,
          ...validated,
        },
        { onConflict: "client_id,coach_id,assessment_submission_id" },
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to update nutrition data" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, message: "Données mises à jour" },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 },
      );
    }
    console.error("PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
