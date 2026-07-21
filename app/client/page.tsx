import { Suspense } from "react"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import {
  assertClientAppEnabledForCoach,
  ClientAppAccessError,
} from "@/lib/billing/assertClientAppEnabled"
import { resolveClientLanguage } from "@/lib/client/resolve-language"
import type { ClientLang } from "@/lib/i18n/clientTranslations"
import ClientDashboard from "@/components/client/ClientDashboard"
import ClientHomeSkeleton from "@/components/client/ClientHomeSkeleton"
import ClientHomeContent, {
  type HomeIdentity,
} from "@/app/client/ClientHomeContent"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function AccessUnavailable() {
  return (
    <div className="min-h-dvh bg-[#121212] px-6 py-16 text-white">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">
          STRYVR
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Espace client indisponible
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          L’espace client n’est pas actif pour ce suivi. Contactez votre coach pour activer
          l’expérience STRYVR.
        </p>
      </div>
    </div>
  )
}

/**
 * Fast gate (auth + client + access) then stream heavy dashboard data.
 * First paint can show the identity skeleton while queries resolve.
 */
export default async function ClientHomePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const langFallback: ClientLang = "fr"

  if (!user) {
    return (
      <ClientDashboard
        clientId=""
        clientFirstName={null}
        lang={langFallback}
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
    "id, first_name, coach_id, timezone, profile_photo_url, training_goal, transformation_phase, created_at, step_target, gender",
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

  const coachId = ((client as any)?.coach_id as string | null | undefined) ?? null
  const clientId = (client as any)?.id as string

  // Access + language in parallel — both needed before streaming body.
  let lang: ClientLang = langFallback
  try {
    const [, resolvedLang] = await Promise.all([
      coachId ? assertClientAppEnabledForCoach(db, coachId) : Promise.resolve(null),
      resolveClientLanguage(db, clientId),
    ])
    lang = resolvedLang
  } catch (error) {
    if (error instanceof ClientAppAccessError) {
      return <AccessUnavailable />
    }
    throw error
  }

  const identity: HomeIdentity = {
    userId: user.id,
    clientId,
    coachId: coachId ?? "",
    firstName: (client as any)?.first_name ?? null,
    avatarUrl: (client as any)?.profile_photo_url ?? null,
    goal: (client as any)?.training_goal ?? null,
    phase: (client as any)?.transformation_phase ?? null,
    createdAt: (client as any)?.created_at ?? null,
    gender: (client as any)?.gender ?? "male",
    stepTarget: (client as any)?.step_target ?? null,
    timezone: (client as any)?.timezone || "Europe/Paris",
    lang,
  }

  return (
    <Suspense
      fallback={<ClientHomeSkeleton firstName={identity.firstName} />}
    >
      <ClientHomeContent identity={identity} />
    </Suspense>
  )
}
