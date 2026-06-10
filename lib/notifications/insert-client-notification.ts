import { SupabaseClient } from '@supabase/supabase-js'

interface NotificationPayload {
  coachId:      string
  clientId:     string
  type:         'assessment_sent' | 'assessment_completed' | 'program_assigned' | 'program_updated' | 'bilan_received' | 'session_reminder' | 'payment_received'
  message:      string
  submissionId?: string
}

/**
 * Insert a notification visible to both coach (by coach_id) and client (by target_user_id).
 * Fetches the client's user_id to populate target_user_id — if the client has no account yet,
 * the notification is still stored and will be visible once they link their account.
 */
export async function insertClientNotification(
  db: SupabaseClient,
  payload: NotificationPayload
) {
  // Resolve client's auth user_id so they can see the notification in their app
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('user_id')
    .eq('id', payload.clientId)
    .single()

  await db.from('client_notifications').insert({
    coach_id:       payload.coachId,
    client_id:      payload.clientId,
    submission_id:  payload.submissionId ?? null,
    type:           payload.type,
    message:        payload.message,
    target_user_id: clientRow?.user_id ?? null,
  })
}
