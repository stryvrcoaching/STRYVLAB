import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendPaymentReminderEmail } from '@/lib/email/mailer'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import { addLocalDays, localIsoDate } from '@/lib/payments/due-date'

// ─── /api/cron/payment-reminders ──────────────────────────────────────────────
// Called by Vercel Cron daily. Sends one reminder per pending payment when:
//  - due_date is exactly J-{coachDays} (coach setting, default 3), or
//  - due_date is today (jour J), or
//  - due_date is overdue (up to 14 days past) and never reminded.
// Only coaches with notif_payment_reminder = true.

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isAuthorizedCronRequest(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  return (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.headers.get('x-cron-secret') === secret
  )
}

type PaymentRow = {
  id: string
  amount_eur: number
  due_date: string
  payment_method: string
  coach_id: string
  client_id: string
  description?: string | null
  subscription?: { formula?: { name?: string } | null } | null
}

function shouldRemindPayment(
  payment: PaymentRow,
  today: string,
  coachDays: number,
): boolean {
  if (!payment.due_date) return false
  // Advance reminder: due_date === today + coachDays  (J-N)
  if (payment.due_date === addLocalDays(today, coachDays)) return true
  // Day of due
  if (payment.due_date === today) return true
  // Overdue catch-up (once, thanks to reminder_sent_at)
  if (payment.due_date < today) return true
  return false
}

async function runPaymentReminders(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()
  const today = localIsoDate()
  const defaultDays = 3

  // Only coaches who opted into auto reminders
  const { data: profiles } = await db
    .from('coach_profiles')
    .select('coach_id, notif_payment_reminder, notif_payment_reminder_days')
    .eq('notif_payment_reminder', true)

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No coaches with payment reminders enabled' })
  }

  const coachDaysMap: Record<string, number> = {}
  for (const p of profiles) {
    coachDaysMap[p.coach_id] = p.notif_payment_reminder_days ?? defaultDays
  }
  const enabledCoachIds = Object.keys(coachDaysMap)

  // Window: overdue up to 14 days → upcoming up to 7 days (covers J-1..J-7)
  const minDue = addLocalDays(today, -14)
  const maxDue = addLocalDays(today, 7)

  const { data: payments, error } = await db
    .from('subscription_payments')
    .select(
      `
      id, amount_eur, due_date, payment_method, coach_id, client_id, description,
      subscription:client_subscriptions(
        formula:coach_formulas(name)
      )
    `,
    )
    .eq('status', 'pending')
    .in('coach_id', enabledCoachIds)
    .not('due_date', 'is', null)
    .gte('due_date', minDue)
    .lte('due_date', maxDue)
    .is('reminder_sent_at', null)

  if (error) {
    console.error('[cron/payment-reminders] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!payments || payments.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No payments due in window' })
  }

  const filteredPayments = (payments as PaymentRow[]).filter((p) => {
    const days = coachDaysMap[p.coach_id] ?? defaultDays
    return shouldRemindPayment(p, today, days)
  })

  if (filteredPayments.length === 0) {
    return NextResponse.json({
      sent: 0,
      message: 'No payments matching coach reminder settings',
    })
  }

  const coachIds = Array.from(new Set(filteredPayments.map((p) => p.coach_id)))
  const coachMap: Record<string, { name: string }> = {}

  for (const coachId of coachIds) {
    const { data: coachUser } = await db.auth.admin.getUserById(coachId)
    if (coachUser?.user) {
      const meta = coachUser.user.user_metadata ?? {}
      coachMap[coachId] = {
        name: meta.full_name ?? meta.first_name ?? coachUser.user.email ?? 'Votre coach',
      }
    }
  }

  let sentCount = 0
  const errors: string[] = []

  for (const payment of filteredPayments) {
    try {
      const { data: client } = await db
        .from('coach_clients')
        .select('first_name, last_name, email')
        .eq('id', payment.client_id)
        .single()

      const coach = coachMap[payment.coach_id] ?? { name: 'Votre coach' }
      const sub = payment.subscription as { formula?: { name?: string } } | null
      const formulaName: string =
        sub?.formula?.name ?? payment.description ?? 'Coaching'

      // Skip if neither email nor client id (cannot reach anyone)
      if (!client?.email && !payment.client_id) {
        continue
      }

      if (client?.email) {
        await sendPaymentReminderEmail({
          to: client.email,
          clientFirstName: client.first_name ?? '',
          coachName: coach.name,
          formulaName,
          amount: Number(payment.amount_eur),
          dueDate: payment.due_date,
          paymentMethod: payment.payment_method,
          fromName: coach.name,
        })
      }

      try {
        await createClientAppNotification(db, {
          clientId: payment.client_id,
          coachId: payment.coach_id,
          type: 'system_reminder',
          copyKey: 'payment.reminder',
          copyParams: {
            amount: Number(payment.amount_eur),
            dueDate: payment.due_date,
            formulaName,
          },
          payload: {
            event: 'payment_reminder',
            payment_id: payment.id,
            priority: 'important',
          },
          actionUrl: `/client/paiement?payment_id=${encodeURIComponent(payment.id)}`,
          pushKind: 'essential',
          pushTag: `payment-reminder-${payment.id}`,
        })
      } catch (notifErr) {
        // Email may already be sent — don't fail the cron for app notif
        console.error(
          `[cron/payment-reminders] in-app notif failed for ${payment.id}:`,
          notifErr,
        )
        // If no email either, do not mark as reminded so we can retry
        if (!client?.email) {
          errors.push(payment.id)
          continue
        }
      }

      await db
        .from('subscription_payments')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', payment.id)

      sentCount++

    } catch (err) {
      console.error(`[cron] Failed for payment ${payment.id}:`, err)
      errors.push(payment.id)
    }
  }

  return NextResponse.json({
    sent: sentCount,
    errors: errors.length > 0 ? errors : undefined,
  })
}

export async function GET(req: NextRequest) {
  return runPaymentReminders(req)
}

export async function POST(req: NextRequest) {
  return runPaymentReminders(req)
}
