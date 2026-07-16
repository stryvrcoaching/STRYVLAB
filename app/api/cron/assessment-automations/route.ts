import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { sendBilanEmail } from '@/lib/email/mailer'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import { nextWeeklyRun } from '@/lib/assessments/automation'

function db() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = db()
  const now = new Date()
  const { data: automations, error } = await service
    .from('assessment_automations')
    .select('*, client:coach_clients(id, first_name, last_name, email), template:assessment_templates(id, name, blocks)')
    .eq('status', 'active')
    .lte('next_run_at', now.toISOString())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  const failures: string[] = []
  for (const automation of automations ?? []) {
    if (automation.ends_on && automation.ends_on < now.toISOString().slice(0, 10)) {
      await service.from('assessment_automations').update({ status: 'paused' }).eq('id', automation.id)
      continue
    }
    try {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: submission, error: insertError } = await service.from('assessment_submissions').insert({
        coach_id: automation.coach_id,
        client_id: automation.client_id,
        template_id: automation.template_id,
        template_snapshot: automation.template.blocks,
        status: 'pending',
        filled_by: 'client',
        token,
        token_expires_at: tokenExpiresAt,
        bilan_date: now.toISOString().slice(0, 10),
      }).select().single()
      if (insertError || !submission) throw new Error(insertError?.message ?? 'Création du bilan impossible')

      await createClientAppNotification(service, {
        coachId: automation.coach_id,
        clientId: automation.client_id,
        type: 'bilan_pending',
        copyKey: 'assessment.available',
        actionUrl: `/bilan/${token}`,
        payload: { assessment_submission_id: submission.id, token },
        pushKind: 'bilan',
      })
      if (automation.client?.email) {
        await sendBilanEmail({
          to: automation.client.email,
          clientFirstName: automation.client.first_name,
          coachName: 'Votre coach',
          templateName: automation.template.name,
          bilanUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/bilan/${token}`,
          expiresAt: new Date(tokenExpiresAt),
        })
      }
      const nextRunAt = nextWeeklyRun({
        dayOfWeek: automation.day_of_week,
        time: String(automation.send_time).slice(0, 5),
        timezone: automation.timezone,
        startsOn: automation.starts_on,
      }, new Date(now.getTime() + 60_000))
      await service.from('assessment_automations').update({ last_run_at: now.toISOString(), next_run_at: nextRunAt }).eq('id', automation.id)
      sent += 1
    } catch (automationError) {
      console.error(`[cron/assessment-automations] ${automation.id}`, automationError)
      failures.push(automation.id)
    }
  }
  return NextResponse.json({ sent, failures })
}
