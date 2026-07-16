import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveProtocolDayByDate,
  resolveRestProtocolDay,
} from "@/lib/nutrition/protocol-schedule";
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone";
import { fetchClientDayOverride } from "@/lib/client/day-kind";
import {
  addDaysToDateKey,
  computePhysiologicalDateInTimezone,
  activeWindowAt,
  getLocalTimeParts,
  getLocalWeekday,
  utcRangeForPhysiologicalDate,
} from "@/lib/client/checkin/timeWindows";
import {
  countPendingSlots,
  createCheckinAvailability,
  getPendingSlots,
  type CheckinAvailability,
} from "@/lib/client/checkin/pendingCheckins";
import { filterSessionsForJsWeekday } from "@/lib/client/plannedSessions";

export type ChatTodayStripData = {
  date: string;
  sessions: { id: string; name: string; completed: boolean }[];
  calories: { logged: number; target: number };
  water: { logged: number; target: number };
  timezone: string;
  checkin: {
    morning: boolean;
    evening: boolean;
    pendingCount: number;
    availability: CheckinAvailability;
    activeWindow: "morning" | "evening" | null;
    sessions: { flow_type: string; date: string; completed_at: string }[];
    missed_checkins?: { flow_type: "morning" | "evening"; date: string }[];
  };
};

export async function buildChatTodayStrip(
  db: SupabaseClient,
  clientId: string,
  timezoneOverride?: string | null,
): Promise<ChatTodayStripData> {
  const now = new Date();
  const timezone =
    timezoneOverride?.trim() || (await resolveClientTimezone(db, clientId));
  const todayPhysio = computePhysiologicalDateInTimezone(now, timezone);
  const yesterdayPhysio = addDaysToDateKey(todayPhysio, -1);
  const physioWeekday = getLocalWeekday(
    new Date(`${todayPhysio}T12:00:00.000Z`),
    timezone,
  );
  const { start: physiologicalStart, end: physiologicalEnd } =
    utcRangeForPhysiologicalDate(todayPhysio, timezone);


  const [
    { data: sessions },
    { data: composerMeals },
    { data: legacyMeals },
    { data: waterRows },
    { data: checkinRows },
    { data: completedProgramSessions },
    { data: protocol },
    { data: skippedSessions },
    { data: checkinConfig },
    { data: checkinSchedules },
  ] = await Promise.all([
    db
      .from("program_sessions")
      .select(
        "id, name, day_of_week, days_of_week, programs!inner(status, client_id, is_client_visible)",
      )
      .eq("programs.client_id", clientId)
      .eq("programs.status", "active")
      .eq("programs.is_client_visible", true),

    db
      .from("nutrition_meals")
      .select("total_calories")
      .eq("client_id", clientId)
      .eq("physiological_date", todayPhysio),

    db
      .from("meal_logs")
      .select("estimated_macros")
      .eq("client_id", clientId)
      .gte("logged_at", physiologicalStart.toISOString())
      .lt("logged_at", new Date(physiologicalEnd.getTime() + 1).toISOString())
      .eq("ai_status", "done"),

    db
      .from("client_water_logs")
      .select("amount_ml")
      .eq("client_id", clientId)
      .gte("logged_at", physiologicalStart.toISOString())
      .lte("logged_at", physiologicalEnd.toISOString()),

    db
      .from("client_daily_checkins")
      .select("flow_type, date")
      .eq("client_id", clientId)
      .in("date", [todayPhysio, yesterdayPhysio]),

    db
      .from("client_session_logs")
      .select("program_session_id, session_name")
      .eq("client_id", clientId)
      .not("completed_at", "is", null)
      .gte("completed_at", physiologicalStart.toISOString())
      .lte("completed_at", physiologicalEnd.toISOString()),

    db
      .from("nutrition_protocols")
      .select(
        "schedule_start_date, nutrition_protocol_days(position, calories, hydration_ml, name, carb_cycle_type), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)",
      )
      .eq("client_id", clientId)
      .eq("status", "shared")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    db
      .from("client_workout_skips")
      .select("program_session_id")
      .eq("client_id", clientId)
      .eq("scheduled_date", todayPhysio),

    db
      .from("daily_checkin_configs")
      .select("is_active, days_of_week")
      .eq("client_id", clientId)
      .maybeSingle(),

    db
      .from("daily_checkin_schedules")
      .select("moment, scheduled_time")
      .eq("client_id", clientId),
  ]);

  const caloriesLogged =
    (composerMeals ?? []).reduce(
      (s: number, m: any) => s + (Number(m.total_calories) || 0),
      0,
    ) +
    (legacyMeals ?? []).reduce((s: number, m: any) => {
      const em = m.estimated_macros as Record<string, number> | null;
      return s + (em?.calories_kcal ?? 0);
    }, 0);

  const waterLogged = (waterRows ?? []).reduce(
    (s: number, r: any) => s + (Number(r.amount_ml) || 0),
    0,
  );

  const dayOverride = await fetchClientDayOverride(db, clientId, todayPhysio);
  const protocolDays = (protocol as any)?.nutrition_protocol_days ?? [];
  const rawProtocolDay = resolveProtocolDayByDate(
    todayPhysio,
    (protocol as any)?.schedule_start_date ?? null,
    protocolDays,
    (protocol as any)?.nutrition_protocol_schedule_slots ?? [],
  );
  const protocolDay =
    dayOverride?.kind === "off"
      ? (resolveRestProtocolDay(protocolDays) ?? rawProtocolDay)
      : rawProtocolDay;
  const calorieTarget = Number((protocolDay as any)?.calories ?? 2000);
  const hydrationTarget = Number((protocolDay as any)?.hydration_ml ?? 2500);

  const sessionRows = (
    (checkinRows ?? []) as Array<{ flow_type: string; date: string }>
  ).map((row) => ({
    flow_type: row.flow_type,
    date: row.date,
    completed_at: "done",
  }));
  const availability: CheckinAvailability = createCheckinAvailability(
    checkinConfig as { is_active?: boolean | null; days_of_week?: number[] | null } | null,
    checkinSchedules as Array<{ moment: string; scheduled_time: string }> | null,
  );
  const pendingCount = countPendingSlots(now, timezone, sessionRows, availability);
  const plannedSessions = filterSessionsForJsWeekday(
    (sessions ?? []) as Array<{
      id: string;
      name: string;
      day_of_week?: number | null;
      days_of_week?: number[] | null;
    }>,
    physioWeekday,
  );
  const completedIds = new Set(
    ((completedProgramSessions ?? []) as any[])
      .map((row: any) => row.program_session_id)
      .filter(Boolean),
  );
  const completedNames = new Set(
    ((completedProgramSessions ?? []) as any[])
      .map((row: any) => row.session_name)
      .filter(Boolean),
  );
  const skippedIds = new Set(
    ((skippedSessions ?? []) as any[])
      .map((row: any) => row.program_session_id)
      .filter(Boolean),
  );
  const seenSessionKeys = new Set<string>();
  const visibleSessions = plannedSessions.filter((session: any) => {
    if (skippedIds.has(session.id)) return false;
    const key = String(session.name ?? session.id).trim().toLocaleLowerCase();
    if (seenSessionKeys.has(key)) return false;
    seenSessionKeys.add(key);
    return true;
  });

  return {
    date: todayPhysio,
    sessions: visibleSessions.map((s: any) => ({
      id: s.id,
      name: s.name,
      completed: completedIds.has(s.id) || completedNames.has(s.name),
    })),
    calories: { logged: Math.round(caloriesLogged), target: calorieTarget },
    water: { logged: waterLogged, target: hydrationTarget },
    timezone,
    checkin: {
      morning: sessionRows.some(
        (s) =>
          s.flow_type === "morning" && s.date === todayPhysio && s.completed_at,
      ),
      evening: sessionRows.some(
        (s) =>
          s.flow_type === "evening" && s.date === todayPhysio && s.completed_at,
      ),
      pendingCount,
      availability,
      activeWindow: activeWindowAt(now, timezone),
      sessions: sessionRows,
      missed_checkins: getPendingSlots(now, timezone, sessionRows, availability),
    },
  };
}
