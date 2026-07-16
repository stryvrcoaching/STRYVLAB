import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { CoachPlan } from '@/lib/billing/plans'
import { sendCoachTrialOnboardingEmail, type CoachTrialOnboardingEmailKey } from '@/lib/email/coach-trial-onboarding'
import { getNextDueCoachTrialEmail, getTrialDay } from '@/lib/onboarding/coach-trial-email-sequence'

export const runtime = 'nodejs'

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.headers.get('x-cron-secret') === secret
  )
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = db()
  const { data: profiles, error } = await service
    .from('coach_profiles')
    .select('coach_id, full_name, pro_email, plan, trial_started_at, trial_ends_at')
    .eq('billing_status', 'trialing')
    .eq('notif_onboarding_emails', true)
    .not('trial_started_at', 'is', null)
    .not('trial_ends_at', 'is', null)

  if (error) {
    console.error('[cron/coach-trial-onboarding] profile lookup failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  const skipped: string[] = []
  const failed: string[] = []

  for (const profile of profiles ?? []) {
    const coachId = profile.coach_id
    const [deliveries, clients, programs, protocols, auth] = await Promise.all([
      service.from('coach_trial_onboarding_email_deliveries').select('sequence_key').eq('coach_id', coachId),
      service.from('coach_clients').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
      service.from('programs').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
      service.from('nutrition_protocols').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
      profile.pro_email ? Promise.resolve({ data: { user: null } }) : service.auth.admin.getUserById(coachId),
    ])

    if (deliveries.error || clients.error || programs.error || protocols.error) {
      console.error('[cron/coach-trial-onboarding] progress lookup failed', { coachId, deliveries: deliveries.error, clients: clients.error, programs: programs.error, protocols: protocols.error })
      failed.push(coachId)
      continue
    }

    const trialDay = getTrialDay(profile.trial_started_at)
    const due = getNextDueCoachTrialEmail(
      trialDay,
      (deliveries.data ?? []).map((item) => item.sequence_key as CoachTrialOnboardingEmailKey),
    )
    if (!due) {
      skipped.push(coachId)
      continue
    }

    const email = profile.pro_email ?? auth.data.user?.email ?? null
    if (!email) {
      console.warn('[cron/coach-trial-onboarding] coach has no email:', coachId)
      skipped.push(coachId)
      continue
    }

    try {
      await sendCoachTrialOnboardingEmail({
        to: email,
        coachName: profile.full_name,
        plan: profile.plan as CoachPlan,
        sequenceKey: due.key,
        trialEndsAt: new Date(profile.trial_ends_at),
        clientCount: clients.count ?? 0,
        programCount: programs.count ?? 0,
        nutritionProtocolCount: protocols.count ?? 0,
      })

      const delivery = await service.from('coach_trial_onboarding_email_deliveries').insert({
        coach_id: coachId,
        sequence_key: due.key,
        context: {
          trial_day: trialDay,
          client_count: clients.count ?? 0,
          program_count: programs.count ?? 0,
          nutrition_protocol_count: protocols.count ?? 0,
        },
      })
      if (delivery.error && delivery.error.code !== '23505') throw delivery.error
      sent++
    } catch (sendError) {
      console.error('[cron/coach-trial-onboarding] email failed', { coachId, key: due.key, sendError })
      failed.push(coachId)
    }
  }

  return NextResponse.json({ sent, skipped: skipped.length, failed })
}

export async function GET(req: NextRequest) {
  return run(req)
}

export async function POST(req: NextRequest) {
  return run(req)
}
