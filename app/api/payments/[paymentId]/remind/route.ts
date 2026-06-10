import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendPaymentReminderEmail } from '@/lib/email/mailer'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── POST /api/payments/[paymentId]/remind ────────────────────────────────────
// Manual payment reminder: sends an email to the client for a pending payment.
export async function POST(
  _req: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = serviceClient()

  const { data: payment } = await db
    .from('subscription_payments')
    .select(`
      id, amount_eur, payment_date, payment_method, status, client_id,
      subscription:client_subscriptions(
        formula:coach_formulas(name)
      )
    `)
    .eq('id', params.paymentId)
    .eq('coach_id', user.id)
    .single()

  if (!payment) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
  if (payment.status !== 'pending') {
    return NextResponse.json({ error: 'Ce paiement n\'est pas en attente' }, { status: 400 })
  }

  const { data: client } = await db
    .from('coach_clients')
    .select('first_name, last_name, email')
    .eq('id', payment.client_id)
    .single()

  if (!client?.email) {
    return NextResponse.json({ error: 'Le client n\'a pas d\'adresse email' }, { status: 400 })
  }

  const coachMeta = user.user_metadata ?? {}
  const coachName: string = coachMeta.full_name ?? coachMeta.first_name ?? user.email ?? 'Votre coach'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = payment.subscription as any
  const formulaName: string = sub?.formula?.name ?? 'Coaching'

  await sendPaymentReminderEmail({
    to: client.email,
    clientFirstName: client.first_name ?? '',
    coachName,
    formulaName,
    amount: Number(payment.amount_eur),
    dueDate: payment.payment_date,
    paymentMethod: payment.payment_method,
    fromName: coachName,
  })

  await db
    .from('subscription_payments')
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq('id', params.paymentId)

  return NextResponse.json({ sent: true })
}
