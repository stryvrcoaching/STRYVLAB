// lib/notifications/sendCoachNotification.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendCoachAlertEmail } from '@/lib/email/mailer'

type NotificationCategory = 'safety' | 'out_of_scope' | 'pattern_inquiry' | 'engagement' | 'weight_off_track'

export interface NotifyCoachParams {
  db: SupabaseClient
  coachId: string
  clientId: string
  chatMessageId?: string
  category: NotificationCategory
  subcategory?: string
  priority: 1 | 2 | 3 | 4 | 5
  coachEmail: string
  coachFirstName: string
  clientFirstName: string
  messageExcerpt?: string
}

export async function notifyCoach(params: NotifyCoachParams): Promise<void> {
  const {
    db, coachId, clientId, chatMessageId,
    category, subcategory, priority,
    coachEmail, coachFirstName, clientFirstName, messageExcerpt,
  } = params

  // 1. INSERT coach_notifications
  await db.from('coach_notifications').insert({
    coach_id: coachId,
    client_id: clientId,
    chat_message_id: chatMessageId ?? null,
    category,
    subcategory: subcategory ?? null,
    priority,
    email_sent: false,
  })

  // 2. Email immédiat pour safety — les autres catégories gérées par Bloc E (préférences coach)
  if (category === 'safety') {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stryvlab.com'
    const inboxUrl = `${siteUrl}/coach/clients/${clientId}`
    const excerpt = (messageExcerpt ?? '').slice(0, 200)

    await sendCoachAlertEmail({
      to: coachEmail,
      coachFirstName,
      clientFirstName,
      category,
      messageExcerpt: excerpt,
      inboxUrl,
    })

    // Marquer email_sent=true sur toutes les notifs safety pending du client
    await db
      .from('coach_notifications')
      .update({ email_sent: true })
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .eq('category', 'safety')
      .eq('status', 'pending')
  }
}
