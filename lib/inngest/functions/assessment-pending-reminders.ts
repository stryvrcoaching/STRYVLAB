import { createClient as createServiceClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest/client'
import { isPendingAssessmentReminderDue } from '@/lib/assessments/pending-reminder'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export const assessmentPendingRemindersFunction = inngest.createFunction(
  {
    id: 'assessment-pending-reminders',
    retries: 1,
    triggers: [{ cron: '*/15 * * * *' }],
  },
  async ({ step }) => step.run('send-assessment-pending-reminders', async () => {
    const db = service()
    const now = new Date()
    const { data: submissions, error } = await db
      .from('assessment_submissions')
      .select('id, client_id, coach_id, token, status, created_at, token_expires_at')
      .eq('status', 'pending')
      .lte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .not('token', 'is', null)

    if (error) throw new Error(`assessment pending reminders fetch: ${error.message}`)

    let sent = 0
    for (const submission of submissions ?? []) {
      if (!isPendingAssessmentReminderDue({
        status: submission.status,
        createdAt: submission.created_at,
        expiresAt: submission.token_expires_at,
      }, now)) continue

      const event = 'assessment_pending_reminder'
      const { data: existing } = await db
        .from('coach_client_notifications')
        .select('id')
        .eq('client_id', submission.client_id)
        .eq('type', 'bilan_pending')
        .contains('payload', {
          event,
          assessment_submission_id: submission.id,
        })
        .limit(1)
      if (existing?.length) continue

      try {
        await createClientAppNotification(db, {
          clientId: submission.client_id,
          coachId: submission.coach_id,
          type: 'bilan_pending',
          copyKey: 'assessment.reminder',
          actionUrl: `/bilan/${submission.token}`,
          payload: {
            event,
            assessment_submission_id: submission.id,
            token: submission.token,
          },
          pushKind: 'bilan',
          pushTag: `stryv-assessment-reminder-${submission.id}`,
        })
        sent++
      } catch {
        // A failing client must not block reminders for other pending assessments.
      }
    }

    return { sent }
  }),
)
