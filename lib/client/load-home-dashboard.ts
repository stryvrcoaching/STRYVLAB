import type { SupabaseClient } from "@supabase/supabase-js"
import { unstable_cache } from "next/cache"
import { buildChatTodayStrip } from "@/lib/client/chat/today-strip"
import { listClientNotificationItems } from "@/lib/client/inbox"
import {
  extractTemplateName,
  isSystemAssessmentTemplateName,
} from "@/lib/assessments/templateSnapshot"
import {
  addDaysToDateKey,
  utcRangeForPhysiologicalDate,
} from "@/lib/client/checkin/timeWindows"
import type { ClientNotificationItem } from "@/lib/client/inbox"
import type { ChatTodayStripData } from "@/lib/client/chat/today-strip"

export type HomeDashboardData = {
  todayStrip: ChatTodayStripData | null
  notifications: ClientNotificationItem[]
  assessments: {
    pending: Array<{
      id: string
      name: string
      status: string
      createdAt: string
      submittedAt: string | null
      token: string | null
    }>
    recent: Array<{
      id: string
      name: string
      status: string
      createdAt: string
      submittedAt: string | null
      token: string | null
    }>
  }
  coach: {
    fullName: string | null
    avatarUrl: string | null
  }
  weeklyStepAvg: number | null
  weeklyCalorieAvg: number | null
  weeklyVolume: number
  streak: {
    current_streak: number
    longest_streak: number
    total_points: number
    available_points?: number
    level: string
  } | null
  nextAppointment: {
    id: string
    title: string
    starts_at: string
    ends_at: string
    client_timezone: string
    meeting_kind: string
    meeting_url: string | null
    status: string
  } | null
}

type LoadArgs = {
  db: SupabaseClient
  userId: string
  clientId: string
  coachId: string
  timezone: string
  todayPhysio: string
  todayStartUtc: Date
}

/** Coach branding changes rarely — short cache cuts a round-trip on cold open. */
function getCachedCoachProfile(coachId: string) {
  return unstable_cache(
    async () => {
      const { createClient } = await import("@supabase/supabase-js")
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { data } = await db
        .from("coach_profiles")
        .select("full_name, logo_url")
        .eq("coach_id", coachId)
        .maybeSingle()
      return {
        fullName: (data as any)?.full_name ?? null,
        avatarUrl: (data as any)?.logo_url ?? null,
      } as { fullName: string | null; avatarUrl: string | null }
    },
    ["client-home-coach-profile", coachId],
    { revalidate: 120, tags: [`coach-profile:${coachId}`] },
  )()
}

/**
 * All non-critical home dashboard data in one parallel batch.
 * Separated from the page so it can stream behind Suspense after a fast auth gate.
 */
export async function loadHomeDashboardData({
  db,
  userId,
  clientId,
  coachId,
  timezone,
  todayPhysio,
  todayStartUtc,
}: LoadArgs): Promise<HomeDashboardData> {
  const notificationsSince = new Date(
    todayStartUtc.getTime() - 6 * 24 * 60 * 60 * 1000,
  ).toISOString()

  const startPhysio = addDaysToDateKey(todayPhysio, -6)
  const { start: startUtc } = utcRangeForPhysiologicalDate(startPhysio, timezone)
  const { end: endUtc } = utcRangeForPhysiologicalDate(todayPhysio, timezone)

  const [
    todayStrip,
    notifications,
    submissionsRes,
    coach,
    streakRes,
    progressionRes,
    walletRes,
    nextAppointmentRes,
    weeklyStepsRes,
    weeklyComposerMealsRes,
    weeklyLegacyMealsRes,
    weeklySessionsRes,
  ] = await Promise.all([
    buildChatTodayStrip(db, clientId, timezone),
    listClientNotificationItems(db, userId, clientId, false, {
      includeLegacy: false,
      createdAfter: notificationsSince,
    }),
    db
      .from("assessment_responses")
      .select("id, template_snapshot, status, created_at, submitted_at, token, token_expires_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20),
    coachId
      ? getCachedCoachProfile(coachId)
      : Promise.resolve({ fullName: null, avatarUrl: null }),
    db
      .from("client_streaks")
      .select("current_streak, longest_streak")
      .eq("client_id", clientId)
      .maybeSingle(),
    db
      .from("client_progression_profiles")
      .select("total_points, level")
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("client_reward_wallets")
      .select("earned_points, spent_points")
      .eq("client_id", clientId)
      .eq("coach_id", coachId)
      .maybeSingle(),
    db
      .from("coaching_appointments")
      .select("id, title, starts_at, ends_at, client_timezone, meeting_kind, meeting_url, status")
      .eq("client_id", clientId)
      .gte("starts_at", new Date().toISOString())
      .lte("starts_at", new Date(Date.now() + 14 * 24 * 3600_000).toISOString())
      .not("status", "in", '("cancelled")')
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from("client_daily_checkins")
      .select("daily_steps, date")
      .eq("client_id", clientId)
      .gte("date", startPhysio)
      .lte("date", todayPhysio),
    db
      .from("nutrition_meals")
      .select("total_calories, physiological_date")
      .eq("client_id", clientId)
      .gte("physiological_date", startPhysio)
      .lte("physiological_date", todayPhysio),
    db
      .from("meal_logs")
      .select("estimated_macros, logged_at")
      .eq("client_id", clientId)
      .gte("logged_at", startUtc.toISOString())
      .lte("logged_at", endUtc.toISOString())
      .eq("ai_status", "done"),
    db
      .from("client_session_logs")
      .select("id, completed_at, client_set_logs(actual_weight_kg, actual_reps, completed)")
      .eq("client_id", clientId)
      .not("completed_at", "is", null)
      .gte("completed_at", startUtc.toISOString())
      .lte("completed_at", endUtc.toISOString()),
  ])

  const stepsRows = (weeklyStepsRes.data ?? []) as any[]
  const stepsValues = stepsRows.map((r) => r.daily_steps).filter((v) => v != null)
  const weeklyStepAvg =
    stepsValues.length > 0
      ? Math.round(stepsValues.reduce((s, v) => s + v, 0) / stepsValues.length)
      : null

  const compMeals = (weeklyComposerMealsRes.data ?? []) as any[]
  const legMeals = (weeklyLegacyMealsRes.data ?? []) as any[]
  const caloriesMap: Record<string, number> = {}

  for (const m of compMeals) {
    const val = Number(m.total_calories) || 0
    caloriesMap[m.physiological_date] = (caloriesMap[m.physiological_date] || 0) + val
  }
  for (const m of legMeals) {
    const em = m.estimated_macros as Record<string, number> | null
    const val = em?.calories_kcal ?? 0
    const dateKey = String(m.logged_at).split("T")[0]
    caloriesMap[dateKey] = (caloriesMap[dateKey] || 0) + val
  }

  const calorieValues = Object.values(caloriesMap)
  const weeklyCalorieAvg =
    calorieValues.length > 0
      ? Math.round(calorieValues.reduce((s, v) => s + v, 0) / calorieValues.length)
      : null

  const sessionsLogs = (weeklySessionsRes.data ?? []) as any[]
  let weeklyVolume = 0
  for (const s of sessionsLogs) {
    const sets = (s.client_set_logs ?? []) as any[]
    for (const set of sets) {
      if (set.completed && set.actual_weight_kg != null && set.actual_reps != null) {
        weeklyVolume += Number(set.actual_weight_kg) * Number(set.actual_reps)
      }
    }
  }

  const submissions = (submissionsRes as any)?.data ?? []
  const pending = submissions
    .filter((submission: any) => {
      const expired =
        submission.status === "pending" &&
        submission.token_expires_at &&
        new Date(submission.token_expires_at) < new Date()
      return submission.status === "pending" && !expired
    })
    .map((submission: any) => ({
      id: submission.id as string,
      name: extractTemplateName(submission.template_snapshot),
      status: submission.status as string,
      createdAt: submission.created_at as string,
      submittedAt: submission.submitted_at as string | null,
      token: submission.token as string | null,
    }))

  const recent = submissions
    .filter((submission: any) => {
      if (isSystemAssessmentTemplateName(extractTemplateName(submission.template_snapshot))) {
        return false
      }
      const expired =
        submission.status === "pending" &&
        submission.token_expires_at &&
        new Date(submission.token_expires_at) < new Date()
      return submission.status === "completed" || expired
    })
    .slice(0, 3)
    .map((submission: any) => ({
      id: submission.id as string,
      name: extractTemplateName(submission.template_snapshot),
      status: submission.status as string,
      createdAt: submission.created_at as string,
      submittedAt: submission.submitted_at as string | null,
      token: submission.token as string | null,
    }))

  const legacyStreak = (streakRes as any)?.data
  const progression = (progressionRes as any)?.data
  const wallet = (walletRes as any)?.data
  const streak = progression
    ? {
        current_streak: legacyStreak?.current_streak ?? 0,
        longest_streak: legacyStreak?.longest_streak ?? 0,
        total_points: Number(progression.total_points) || 0,
        available_points: Math.max(
          0,
          (Number(wallet?.earned_points) || 0) - (Number(wallet?.spent_points) || 0),
        ),
        level: progression.level,
      }
    : legacyStreak
      ? {
          current_streak: legacyStreak.current_streak ?? 0,
          longest_streak: legacyStreak.longest_streak ?? 0,
          total_points: 0,
          level: "bronze",
        }
      : null

  return {
    todayStrip,
    notifications,
    assessments: { pending, recent },
    coach,
    weeklyStepAvg,
    weeklyCalorieAvg,
    weeklyVolume,
    streak,
    nextAppointment: (nextAppointmentRes as any)?.data ?? null,
  }
}
