import { createClient as createServiceClient } from "@supabase/supabase-js"
import ClientDashboard from "@/components/client/ClientDashboard"
import { loadHomeDashboardData } from "@/lib/client/load-home-dashboard"
import {
  computePhysiologicalDateInTimezone,
  utcRangeForPhysiologicalDate,
} from "@/lib/client/checkin/timeWindows"
import type { ClientLang } from "@/lib/i18n/clientTranslations"

export type HomeIdentity = {
  userId: string
  clientId: string
  coachId: string
  firstName: string | null
  avatarUrl: string | null
  goal: string | null
  phase: string | null
  createdAt: string | null
  gender: string | null
  stepTarget: number | null
  timezone: string
  lang: ClientLang
}

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Async server component streamed behind Suspense.
 * Auth/access gate stays in page.tsx so redirects remain synchronous.
 */
export default async function ClientHomeContent({
  identity,
}: {
  identity: HomeIdentity
}) {
  const db = service()
  const todayPhysio = computePhysiologicalDateInTimezone(
    new Date(),
    identity.timezone,
  )
  const { start: todayStartUtc } = utcRangeForPhysiologicalDate(
    todayPhysio,
    identity.timezone,
  )

  const data = await loadHomeDashboardData({
    db,
    userId: identity.userId,
    clientId: identity.clientId,
    coachId: identity.coachId,
    timezone: identity.timezone,
    todayPhysio,
    todayStartUtc,
  })

  return (
    <ClientDashboard
      clientId={identity.clientId}
      clientFirstName={identity.firstName}
      clientAvatarUrl={identity.avatarUrl}
      clientGoal={identity.goal}
      clientPhase={identity.phase}
      clientCreatedAt={identity.createdAt}
      clientGender={identity.gender ?? "male"}
      lang={identity.lang}
      todayStrip={data.todayStrip}
      notifications={data.notifications}
      assessments={data.assessments}
      coach={data.coach}
      weeklyStepAvg={data.weeklyStepAvg}
      stepTarget={identity.stepTarget}
      weeklyCalorieAvg={data.weeklyCalorieAvg}
      weeklyVolume={data.weeklyVolume}
      streak={data.streak}
      nextAppointment={data.nextAppointment}
    />
  )
}
