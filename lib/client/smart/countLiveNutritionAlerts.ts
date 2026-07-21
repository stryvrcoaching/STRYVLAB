import type { SupabaseClient } from "@supabase/supabase-js";
import { computeNutritionAlerts } from "@/lib/client/smart/nutritionAlerts";
import { computeMacroEnergy } from "@/lib/nutrition/energy";
import { computePhysiologicalDate } from "@/lib/nutrition/physiological-date";
import { resolveProtocolDayByDate } from "@/lib/nutrition/protocol-schedule";
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone";
import { utcRangeForPhysiologicalDate } from "@/lib/client/checkin/timeWindows";

/**
 * Count live day-ops nutrition alerts (protein lag, hydration, etc.)
 * Same engine as the Nutrition page feed — keeps the tab badge in sync.
 */
export async function countLiveNutritionAlerts(
  db: SupabaseClient,
  clientId: string,
): Promise<number> {
  try {
    const timezone = await resolveClientTimezone(db, clientId);
    const date = computePhysiologicalDate(new Date(), timezone);
    const { start: physiologicalStart, end: physiologicalEnd } =
      utcRangeForPhysiologicalDate(date, timezone);

    const [{ data: proto }, { data: meals }, { data: water }] =
      await Promise.all([
        db
          .from("nutrition_protocols")
          .select(
            "schedule_start_date, nutrition_protocol_days(position, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)",
          )
          .eq("client_id", clientId)
          .eq("status", "shared")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        db
          .from("nutrition_meals")
          .select(
            "meal_type, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g",
          )
          .eq("client_id", clientId)
          .eq("physiological_date", date),
        db
          .from("client_water_logs")
          .select("amount_ml, caffeine_mg")
          .eq("client_id", clientId)
          .gte("logged_at", physiologicalStart.toISOString())
          .lte("logged_at", physiologicalEnd.toISOString()),
      ]);

    const td = resolveProtocolDayByDate(
      date,
      (proto as { schedule_start_date?: string | null } | null)
        ?.schedule_start_date ?? null,
      ((proto as { nutrition_protocol_days?: unknown } | null)
        ?.nutrition_protocol_days as Parameters<
        typeof resolveProtocolDayByDate
      >[2]) ?? [],
      ((proto as { nutrition_protocol_schedule_slots?: unknown } | null)
        ?.nutrition_protocol_schedule_slots as Parameters<
        typeof resolveProtocolDayByDate
      >[3]) ?? [],
    );

    const target = {
      kcal: Number(td?.calories ?? 0),
      protein_g: Number(td?.protein_g ?? 0),
      carbs_g: Number(td?.carbs_g ?? 0),
      fat_g: Number(td?.fat_g ?? 0),
      water_ml: Number(td?.hydration_ml ?? 2500),
    };

    const consumed = (meals ?? []).reduce(
      (acc, m) => ({
        kcal:
          acc.kcal +
          computeMacroEnergy({
            protein_g: Number(m.total_protein_g ?? 0),
            carbs_g: Number(m.total_carbs_g ?? 0),
            fat_g: Number(m.total_fat_g ?? 0),
            fiber_g: Number(m.total_fiber_g ?? 0),
          }),
        protein_g: acc.protein_g + Number(m.total_protein_g ?? 0),
        carbs_g: acc.carbs_g + Number(m.total_carbs_g ?? 0),
        fat_g: acc.fat_g + Number(m.total_fat_g ?? 0),
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );

    const water_ml = (water ?? []).reduce(
      (s, w) => s + Number(w.amount_ml ?? 0),
      0,
    );
    const caffeine_mg = (water ?? []).reduce(
      (s, w) => s + Number(w.caffeine_mg ?? 0),
      0,
    );
    const hasLunchLog = (meals ?? []).some((m) => m.meal_type === "lunch");

    const alerts = computeNutritionAlerts({
      consumed: { ...consumed, water_ml, caffeine_mg },
      target,
      currentHour: new Date().getHours(),
      hasLunchLog,
    });

    return alerts.length;
  } catch {
    return 0;
  }
}
