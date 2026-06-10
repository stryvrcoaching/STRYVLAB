import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendPaymentReminderEmail } from '@/lib/email/mailer'

// ─── POST /api/cron/payment-reminders ─────────────────────────────────────────
// Called by Vercel Cron daily.
// Sends reminder emails for pending payments due in 3 days.
// Protected by CRON_SECRET header.

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()
  const today = new Date()

  // Fetch coach profiles with reminders enabled
  const { data: profiles } = await db
    .from('coach_profiles')
    .select('coach_id, notif_payment_reminder, notif_payment_reminder_days')
    .eq('notif_payment_reminder', true)

  const defaultDays = 3
  const coachTargetDates: Record<string, string> = {}

  if (profiles && profiles.length > 0) {
    for (const p of profiles) {
      const days = p.notif_payment_reminder_days ?? defaultDays
      const target = new Date(today)
      target.setDate(target.getDate() + days)
      coachTargetDates[p.coach_id] = target.toISOString().split('T')[0]
    }
  }

  const defaultTargetDate = new Date(today)
  defaultTargetDate.setDate(defaultTargetDate.getDate() + defaultDays)
  const defaultTargetDateStr = defaultTargetDate.toISOString().split('T')[0]

  // Fetch pending payments in the J+1 → J+7 window not yet reminded
  const maxTarget = new Date(today)
  maxTarget.setDate(maxTarget.getDate() + 7)
  const minTarget = new Date(today)
  minTarget.setDate(minTarget.getDate() + 1)

  const { data: payments, error } = await db
    .from('subscription_payments')
    .select(`
      id, amount_eur, payment_date, payment_method, coach_id, client_id,
      subscription:client_subscriptions(
        formula:coach_formulas(name)
      )
    `)
    .eq('status', 'pending')
    .gte('payment_date', minTarget.toISOString().split('T')[0])
    .lte('payment_date', maxTarget.toISOString().split('T')[0])
    .is('reminder_sent_at', null)

  if (error) {
    console.error('[cron/payment-reminders] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!payments || payments.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No payments due in window' })
  }

  // Filter by each coach's configured delay
  const filteredPayments = payments.filter(p => {
    const targetDate = coachTargetDates[p.coach_id] ?? defaultTargetDateStr
    return p.payment_date === targetDate
  })

  if (filteredPayments.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No payments matching coach reminder settings' })
  }

  // Resolve coach info once per coach
  const coachIds = Array.from(new Set(filteredPayments.map(p => p.coach_id)))
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

      if (!client?.email) continue

      const coach = coachMap[payment.coach_id] ?? { name: 'Votre coach' }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = payment.subscription as any
      const formulaName: string = sub?.formula?.name ?? 'Coaching'

      await sendPaymentReminderEmail({
        to: client.email,
        clientFirstName: client.first_name ?? '',
        coachName: coach.name,
        formulaName,
        amount: Number(payment.amount_eur),
        dueDate: payment.payment_date,
        paymentMethod: payment.payment_method,
        fromName: coach.name,
      })

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
