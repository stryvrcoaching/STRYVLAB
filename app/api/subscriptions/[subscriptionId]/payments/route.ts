import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendPaymentReceiptEmail } from '@/lib/email/mailer'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { subscriptionId: string } }

// GET /api/subscriptions/[subscriptionId]/payments
export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await serviceClient()
    .from('subscription_payments')
    .select('*')
    .eq('subscription_id', params.subscriptionId)
    .eq('coach_id', user.id)
    .order('payment_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payments: data })
}

// POST /api/subscriptions/[subscriptionId]/payments — enregistrer un paiement
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { client_id, amount_eur, status, payment_method, payment_date, due_date, description, reference } = body

  if (!client_id || amount_eur === undefined) {
    return NextResponse.json({ error: 'client_id et amount_eur requis' }, { status: 400 })
  }

  const { data, error } = await serviceClient()
    .from('subscription_payments')
    .insert({
      coach_id: user.id,
      client_id,
      subscription_id: params.subscriptionId,
      amount_eur: Number(amount_eur),
      status: status ?? 'paid',
      payment_method: payment_method ?? 'manual',
      payment_date: payment_date ?? new Date().toISOString().split('T')[0],
      due_date: due_date ?? null,
      description: description ?? null,
      reference: reference ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reçu email si paiement confirmé
  const resolvedStatus = status ?? 'paid'
  if (resolvedStatus === 'paid') {
    try {
      const { data: client } = await serviceClient()
        .from('coach_clients')
        .select('first_name, last_name, email')
        .eq('id', client_id)
        .single()
      if (client?.email) {
        const coachMeta = (await createServerClient().auth.getUser()).data.user?.user_metadata
        const coachName = coachMeta?.full_name ?? coachMeta?.first_name ?? null
        await sendPaymentReceiptEmail({
          to: client.email,
          clientFirstName: client.first_name,
          coachName,
          amount: Number(amount_eur),
          description: description ?? null,
          paymentDate: payment_date ?? new Date().toISOString().split('T')[0],
          reference: reference ?? null,
          method: payment_method ?? 'manual',
        })
      }
    } catch (emailError) {
      console.error('Payment receipt email failed (non-blocking):', emailError)
    }
  }

  return NextResponse.json({ payment: data }, { status: 201 })
}
