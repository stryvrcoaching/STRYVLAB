import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  addDaysToDateKey,
  computePhysiologicalDateInTimezone,
  utcRangeForPhysiologicalDate,
} from "@/lib/client/checkin/timeWindows";
import { computeMacroEnergy } from "@/lib/nutrition/energy";
import { resolveProtocolDayByDate } from "@/lib/nutrition/protocol-schedule";
import {
  buildNutritionHubInsights,
  buildNutritionHubSummary,
  classifyNutritionAgendaDay,
  computeNutritionAdherence,
  computeNutritionDeltaPct,
  type NutritionHubCompleteness,
  type NutritionHubDayInput,
  type NutritionHubDayKind,
  type NutritionHubInsightInput,
} from "@/lib/coach/nutritionHub";
import { fetchActiveSmoothingPlanForCoach } from "@/lib/nutrition/smoothing/fetch";

const querySchema = z.object({
  window: z.enum(["3", "7", "14", "30"]).default("7"),
});

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function inferTrainingDay(protocolDay: Record<string, unknown> | null): boolean {
  if (!protocolDay) return false;
  const name = String(protocolDay.name ?? "").toLowerCase();
  const cycle = String(protocolDay.carb_cycle_type ?? "").toLowerCase();

  return (
    name.includes("entraînement") ||
    name.includes("entrainement") ||
    name.includes("training") ||
    cycle.includes("high")
  );
}

type ProtocolDayRecord = {
  position: number;
  name?: string | null;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  hydration_ml?: number | null;
  carb_cycle_type?: string | null;
};

type ScheduleSlotRecord = {
  week_index: number;
  dow: number;
  protocol_day_position: number;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { clientId } = await params;
  const db = serviceClient();

  const { data: ownedClient, error: clientError } = await db
    .from("coach_clients")
    .select("id, timezone")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }

  if (!ownedClient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const timezone =
    (ownedClient as { timezone?: string | null }).timezone || "Europe/Paris";
  const windowDays = Number(parsed.data.window) as 3 | 7 | 14 | 30;
  const today = computePhysiologicalDateInTimezone(new Date(), timezone);
  // dateKeys includes today for the agenda ("Journées observées")
  const dateKeys = Array.from({ length: windowDays }, (_, index) =>
    addDaysToDateKey(today, -(windowDays - index - 1)),
  );
  // chartDateKeys excludes today — a partial day distorts charts and KPIs
  const chartDateKeys = dateKeys.filter((key) => key !== today);
  const earliestRange = utcRangeForPhysiologicalDate(dateKeys[0], timezone);
  const latestRange = utcRangeForPhysiologicalDate(
    dateKeys[dateKeys.length - 1],
    timezone,
  );

  const [
    { data: protocol, error: protocolError },
    { data: meals, error: mealsError },
    { data: waterLogs, error: waterError },
    { data: tdeeHistory, error: tdeeError },
    activeSmoothingPlan,
  ] = await Promise.all([
      db
        .from("nutrition_protocols")
        .select(
          "schedule_start_date, tdee_adaptive, tdee_adaptive_at, tdee_data_source, nutrition_protocol_days(position, name, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)",
        )
        .eq("client_id", clientId)
        .eq("status", "shared")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("nutrition_meals")
        .select(
          "physiological_date, meal_type, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g",
        )
        .eq("client_id", clientId)
        .neq("meal_type", "drinks")
        .in("physiological_date", dateKeys),
      db
        .from("client_water_logs")
        .select("amount_ml, logged_at")
        .eq("client_id", clientId)
        .gte("logged_at", earliestRange.start.toISOString())
        .lte("logged_at", latestRange.end.toISOString()),
      db
        .from("nutrition_tdee_history")
        .select(
          "calculated_at, tdee_adaptive, tdee_formula, delta_kcal, avg_intake_kcal, weight_delta_kg, weight_samples",
        )
        .eq("client_id", clientId)
        .gte("calculated_at", earliestRange.start.toISOString())
        .order("calculated_at", { ascending: true }),
      fetchActiveSmoothingPlanForCoach(db as any, user.id, clientId),
    ]);

  if (protocolError || mealsError || waterError || tdeeError) {
    return NextResponse.json(
      {
        error:
          protocolError?.message ||
          mealsError?.message ||
          waterError?.message ||
          tdeeError?.message ||
          "Failed to load nutrition hub data",
      },
      { status: 500 },
    );
  }

  const protocolDays = ((protocol as any)?.nutrition_protocol_days ??
    []) as ProtocolDayRecord[];
  const scheduleSlots = ((protocol as any)?.nutrition_protocol_schedule_slots ??
    []) as ScheduleSlotRecord[];
  const smoothingDays = [...(activeSmoothingPlan?.days ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const smoothingByDate = new Map(
    smoothingDays.map((day) => [day.date, day] as const),
  );
  const remainingSmoothingByDate = new Map<string, number>();
  let remainingSmoothingKcal = smoothingDays.reduce(
    (sum, day) => sum + Number(day.kcal_delta ?? 0),
    0,
  );
  for (const day of smoothingDays) {
    remainingSmoothingByDate.set(day.date, remainingSmoothingKcal);
    remainingSmoothingKcal -= Number(day.kcal_delta ?? 0);
  }

  const mealsByDate = new Map<
    string,
    {
      mealCount: number;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }
  >();

  for (const meal of (meals ?? []) as any[]) {
    const key = meal.physiological_date as string;
    const current = mealsByDate.get(key) ?? {
      mealCount: 0,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    };

    current.mealCount += 1;
    current.protein_g += Number(meal.total_protein_g ?? 0);
    current.carbs_g += Number(meal.total_carbs_g ?? 0);
    current.fat_g += Number(meal.total_fat_g ?? 0);
    current.calories += computeMacroEnergy({
      protein_g: Number(meal.total_protein_g ?? 0),
      carbs_g: Number(meal.total_carbs_g ?? 0),
      fat_g: Number(meal.total_fat_g ?? 0),
      fiber_g: Number(meal.total_fiber_g ?? 0),
    });

    mealsByDate.set(key, current);
  }

  const waterByDate = new Map<string, number>();
  for (const dateKey of dateKeys) {
    const range = utcRangeForPhysiologicalDate(dateKey, timezone);
    const total = ((waterLogs ?? []) as Array<{ amount_ml: number | null; logged_at: string }>)
      .filter((entry) => {
        const timestamp = new Date(entry.logged_at).getTime();
        return (
          timestamp >= range.start.getTime() && timestamp <= range.end.getTime()
        );
      })
      .reduce((sum, entry) => sum + Number(entry.amount_ml ?? 0), 0);
    waterByDate.set(dateKey, total);
  }

  function buildDayEntry(dateKey: string) {
    const protocolDay = resolveProtocolDayByDate(
      dateKey,
      (protocol as any)?.schedule_start_date ?? null,
      protocolDays,
      scheduleSlots,
    ) as ProtocolDayRecord | null;
    const mealsForDay = mealsByDate.get(dateKey) ?? {
      mealCount: 0,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    };
    const hydration_ml = waterByDate.get(dateKey) ?? 0;
    const dayKind: NutritionHubDayKind = inferTrainingDay(protocolDay) ? "training" : protocolDay ? "off" : "unknown";
    const completeness: NutritionHubCompleteness =
      mealsForDay.mealCount === 0 && hydration_ml === 0
        ? "missing"
        : mealsForDay.mealCount === 0 || hydration_ml === 0
          ? "partial"
          : "complete";

    const target = {
      calories: protocolDay?.calories != null ? Number(protocolDay.calories) : null,
      protein_g: protocolDay?.protein_g != null ? Number(protocolDay.protein_g) : null,
      carbs_g: protocolDay?.carbs_g != null ? Number(protocolDay.carbs_g) : null,
      fat_g: protocolDay?.fat_g != null ? Number(protocolDay.fat_g) : null,
      hydration_ml:
        protocolDay?.hydration_ml != null
          ? Number(protocolDay.hydration_ml)
          : null,
    };

    return { mealsForDay, hydration_ml, dayKind, completeness, target };
  }

  // Charts, KPIs, insights: exclude today (partial day skews averages)
  const days: NutritionHubDayInput[] = [];
  const insightInputs: NutritionHubInsightInput[] = [];
  const chartAgenda = chartDateKeys.map((dateKey) => {
    const { mealsForDay, hydration_ml, dayKind, completeness, target } = buildDayEntry(dateKey);

    days.push({
      dayKind,
      completeness,
      consumed: {
        calories: mealsForDay.calories,
        protein_g: mealsForDay.protein_g,
        carbs_g: mealsForDay.carbs_g,
        fat_g: mealsForDay.fat_g,
        hydration_ml,
      },
      target,
    });

    insightInputs.push({
      dayKind,
      completeness,
      adherence: {
        protein: computeNutritionAdherence(mealsForDay.protein_g, target.protein_g),
        carbs: computeNutritionAdherence(mealsForDay.carbs_g, target.carbs_g),
        hydration: computeNutritionAdherence(hydration_ml, target.hydration_ml),
      },
      deltaPct: {
        calories: computeNutritionDeltaPct(mealsForDay.calories, target.calories),
      },
    });

    const status = classifyNutritionAgendaDay({
      completeness,
      consumed: { calories: mealsForDay.calories },
      target: { calories: target.calories },
    });

    return {
      date: dateKey,
      dayKind,
      status,
      mealCount: mealsForDay.mealCount,
      consumed: {
        calories: Math.round(mealsForDay.calories),
        protein_g: Math.round(mealsForDay.protein_g),
        carbs_g: Math.round(mealsForDay.carbs_g),
        fat_g: Math.round(mealsForDay.fat_g),
        hydration_ml: Math.round(hydration_ml),
      },
      target,
    };
  });

  // Agenda ("Journées observées"): full window including today
  const agenda = dateKeys.map((dateKey) => {
    const { mealsForDay, hydration_ml, dayKind, completeness, target } = buildDayEntry(dateKey);
    const status = classifyNutritionAgendaDay({
      completeness,
      consumed: { calories: mealsForDay.calories },
      target: { calories: target.calories },
    });
    return {
      date: dateKey,
      isToday: dateKey === today,
      dayKind,
      status,
      mealCount: mealsForDay.mealCount,
      consumed: {
        calories: Math.round(mealsForDay.calories),
        protein_g: Math.round(mealsForDay.protein_g),
        carbs_g: Math.round(mealsForDay.carbs_g),
        fat_g: Math.round(mealsForDay.fat_g),
        hydration_ml: Math.round(hydration_ml),
      },
      target,
      smoothing: (() => {
        const day = smoothingByDate.get(dateKey);
        if (!day || !activeSmoothingPlan) return null;
        return {
          planId: activeSmoothingPlan.id,
          sourceDate: activeSmoothingPlan.source_date,
          direction: activeSmoothingPlan.direction,
          kcalDelta: Number(day.kcal_delta ?? 0),
          remainingKcal: Number(remainingSmoothingByDate.get(dateKey) ?? day.kcal_delta ?? 0),
          dayStatus: day.status,
          coachNote: activeSmoothingPlan.coach_note,
          coachLastAction: activeSmoothingPlan.coach_last_action,
        };
      })(),
    };
  });

  const summary = buildNutritionHubSummary(days);
  const dataQuality = {
    validDays: days.filter((day) => day.completeness === "complete").length,
    partialDays: days.filter((day) => day.completeness === "partial").length,
    missingMealDays: chartAgenda.filter((day) => day.mealCount === 0).length,
    missingHydrationDays: chartAgenda.filter(
      (day) => day.consumed.hydration_ml === 0,
    ).length,
  };

  return NextResponse.json({
    summary,
    trend: {
      window: windowDays,
      points: chartAgenda.map((day) => ({
        date: day.date,
        consumed: day.consumed,
        target: day.target,
        dayKind: day.dayKind,
        completeness:
          day.status === "missing"
            ? "missing"
            : day.status === "partial"
              ? "partial"
              : "complete",
      })),
    },
    insights: buildNutritionHubInsights(insightInputs),
    agenda,
    energy: {
      protocolTdee: (protocol as any)?.tdee_adaptive ?? null,
      protocolTdeeAt: (protocol as any)?.tdee_adaptive_at ?? null,
      tdeeDataSource: (protocol as any)?.tdee_data_source ?? null,
      tdeeHistory: ((tdeeHistory ?? []) as any[]).map((point) => ({
        calculated_at: point.calculated_at,
        tdee_adaptive: Number(point.tdee_adaptive ?? 0),
        tdee_formula: Number(point.tdee_formula ?? 0),
        delta_kcal: Number(point.delta_kcal ?? 0),
        avg_intake_kcal: Number(point.avg_intake_kcal ?? 0),
        weight_delta_kg: Number(point.weight_delta_kg ?? 0),
        weight_samples: Number(point.weight_samples ?? 0),
      })),
    },
    dataQuality,
    availableWindows: [3, 7, 14, 30],
    activeSmoothingPlan: activeSmoothingPlan
      ? {
          id: activeSmoothingPlan.id,
          sourceDate: activeSmoothingPlan.source_date,
          sourceTargetKcal: activeSmoothingPlan.source_target_kcal,
          sourceConsumedKcal: activeSmoothingPlan.source_consumed_kcal,
          direction: activeSmoothingPlan.direction,
          durationDays: activeSmoothingPlan.duration_days,
          smoothableDeltaKcal: activeSmoothingPlan.smoothable_delta_kcal,
          strategy: activeSmoothingPlan.strategy,
          status: activeSmoothingPlan.status,
          createdBy: activeSmoothingPlan.created_by,
          coachNote: activeSmoothingPlan.coach_note,
          coachNoteUpdatedAt: activeSmoothingPlan.coach_note_updated_at,
          coachLastAction: activeSmoothingPlan.coach_last_action,
          days: smoothingDays.map((day) => ({
            date: day.date,
            kcalDelta: Number(day.kcal_delta ?? 0),
            status: day.status,
            remainingKcal: Number(remainingSmoothingByDate.get(day.date) ?? 0),
          })),
        }
      : null,
  });
}
