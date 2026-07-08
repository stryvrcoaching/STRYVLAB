import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import { assertClientAppEnabledForCoach, ClientAppAccessError } from "@/lib/billing/assertClientAppEnabled"
import { resolveClientLanguage } from "@/lib/client/resolve-language"
import type { ClientLang } from "@/lib/i18n/clientTranslations"
import { buildChatTodayStrip } from "@/lib/client/chat/today-strip"
import { listClientNotificationItems } from "@/lib/client/inbox"
import {
  extractTemplateName,
  isSystemAssessmentTemplateName,
} from "@/lib/assessments/templateSnapshot"
import {
  computePhysiologicalDateInTimezone,
  addDaysToDateKey,
  utcRangeForPhysiologicalDate,
} from "@/lib/client/checkin/timeWindows"
import ClientDashboard from "@/components/client/ClientDashboard"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export default async function ClientHomePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let firstName: string | null = null
  let lang: ClientLang = "fr"

  if (!user) {
    return (
      <ClientDashboard
        clientId=""
        clientFirstName={null}
        lang={lang}
        todayStrip={null}
        notifications={[]}
        assessments={{ pending: [], recent: [] }}
        coach={{ fullName: null }}
      />
    )
  }

  const db = service()
  const client = await resolveClientFromUser(
    user.id,
    user.email,
    db,
    "id, first_name, coach_id, timezone, profile_photo_url, training_goal, transformation_phase, created_at, step_target"
  )

  if (!client) {
    const { data: coachProfile } = await db
      .from("coach_profiles")
      .select("id")
      .eq("coach_id", user.id)
      .maybeSingle()

    if (coachProfile) {
      redirect("/dashboard")
    } else {
      redirect("/client/login")
    }
  }

  try {
    const coachId = (client as any)?.coach_id as string | null | undefined
    if (coachId) {
      await assertClientAppEnabledForCoach(db, coachId)
    }

    firstName = (client as any)?.first_name ?? null
    if ((client as any)?.id) {
      lang = await resolveClientLanguage(db, (client as any).id as string)
    }
  } catch (error) {
    if (error instanceof ClientAppAccessError) {
      return (
        <div className="min-h-dvh bg-[#0d0d0d] px-6 py-16 text-white">
          <div className="mx-auto flex max-w-lg flex-col items-center text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">
              STRYVR
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              Espace client non active
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65">
              L’espace client n’est pas active pour ce suivi. Contactez votre coach pour activer
              l’experience STRYVR.
            </p>
          </div>
        </div>
      )
    }

    throw error
  }

  const [todayStrip, notifications, submissionsRes, coachProfileRes] = await Promise.all([
    buildChatTodayStrip(db, (client as any)?.id as string),
    listClientNotificationItems(db, user.id, (client as any)?.id as string, false),
    db
      .from("assessment_responses")
      .select("id, template_snapshot, status, created_at, submitted_at, token, token_expires_at")
      .eq("client_id", (client as any)?.id as string)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("coach_profiles")
      .select("full_name, logo_url")
      .eq("coach_id", (client as any)?.coach_id as string)
      .maybeSingle(),
  ])

  const now = new Date()
  const timezone = (client as any)?.timezone || "Europe/Paris"
  const todayPhysio = computePhysiologicalDateInTimezone(now, timezone)
  const startPhysio = addDaysToDateKey(todayPhysio, -6)
  const { start: startUtc } = utcRangeForPhysiologicalDate(startPhysio, timezone)
  const { end: endUtc } = utcRangeForPhysiologicalDate(todayPhysio, timezone)

  const [weeklyStepsRes, weeklyComposerMealsRes, weeklyLegacyMealsRes, weeklySessionsRes] = await Promise.all([
    db.from("client_daily_checkins")
      .select("daily_steps, date")
      .eq("client_id", (client as any).id)
      .gte("date", startPhysio)
      .lte("date", todayPhysio),

    db.from("nutrition_meals")
      .select("total_calories, physiological_date")
      .eq("client_id", (client as any).id)
      .gte("physiological_date", startPhysio)
      .lte("physiological_date", todayPhysio),

    db.from("meal_logs")
      .select("estimated_macros, logged_at")
      .eq("client_id", (client as any).id)
      .gte("logged_at", startUtc.toISOString())
      .lte("logged_at", endUtc.toISOString())
      .eq("ai_status", "done"),

    db.from("client_session_logs")
      .select("id, completed_at, client_set_logs(actual_weight_kg, actual_reps, completed)")
      .eq("client_id", (client as any).id)
      .not("completed_at", "is", null)
      .gte("completed_at", startUtc.toISOString())
      .lte("completed_at", endUtc.toISOString())
  ])

  const stepsRows = (weeklyStepsRes.data ?? []) as any[]
  const stepsValues = stepsRows.map(r => r.daily_steps).filter(v => v != null)
  const weeklyStepAvg = stepsValues.length > 0
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
    const dateKey = m.logged_at.split("T")[0]
    caloriesMap[dateKey] = (caloriesMap[dateKey] || 0) + val
  }

  const calorieValues = Object.values(caloriesMap)
  const weeklyCalorieAvg = calorieValues.length > 0
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
        (submission.token_expires_at && new Date(submission.token_expires_at) < new Date())

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
        (submission.token_expires_at && new Date(submission.token_expires_at) < new Date())

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

  return (
    <ClientDashboard
      clientId={(client as any)?.id as string}
      clientFirstName={firstName}
      clientAvatarUrl={(client as any)?.profile_photo_url ?? null}
      clientGoal={(client as any)?.training_goal ?? null}
      clientPhase={(client as any)?.transformation_phase ?? null}
      clientCreatedAt={(client as any)?.created_at ?? null}
      lang={lang}
      todayStrip={todayStrip}
      notifications={notifications}
      assessments={{ pending, recent }}
      coach={{
        fullName: (coachProfileRes as any)?.data?.full_name ?? null,
      }}
      weeklyStepAvg={weeklyStepAvg}
      stepTarget={(client as any)?.step_target ?? null}
      weeklyCalorieAvg={weeklyCalorieAvg}
      weeklyVolume={weeklyVolume}
    />
  )
}
