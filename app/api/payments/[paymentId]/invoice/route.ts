import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generateReceiptPdf } from '@/lib/pdf/receipt'
import { sendInvoiceEmail } from '@/lib/email/mailer'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const METHOD_LABELS: Record<string, string> = {
  manual: 'Manuel', bank_transfer: 'Virement bancaire', card: 'Carte bancaire',
  cash: 'Espèces', stripe: 'Stripe', other: 'Autre',
}

// ─── Generate sequential invoice number for this coach ────────────────────────
async function nextInvoiceNumber(db: ReturnType<typeof serviceClient>, coachId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  const { data } = await db
    .from('subscription_payments')
    .select('invoice_number')
    .eq('coach_id', coachId)
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  let seq = 1
  if (data?.invoice_number) {
    const parts = data.invoice_number.split('-')
    const last = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(last)) seq = last + 1
  }

  return `${prefix}${String(seq).padStart(4, '0')}`
}

// ─── POST /api/payments/[paymentId]/invoice ───────────────────────────────────
// Body: { sendEmail?: boolean }
// Returns: PDF as application/pdf — OR — { sent: true } if email only
export async function POST(
  req: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sendEmail = body.sendEmail === true

  const db = serviceClient()

  // Fetch payment with subscription + formula + client
  const { data: payment } = await db
    .from('subscription_payments')
    .select(`
      id, amount_eur, payment_date, payment_method, description, invoice_number,
      client_id,
      subscription:client_subscriptions(
        formula:coach_formulas(name, billing_cycle)
      )
    `)
    .eq('id', params.paymentId)
    .eq('coach_id', user.id)
    .single()

  if (!payment) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })

  // Fetch client
  const { data: client } = await db
    .from('coach_clients')
    .select('first_name, last_name, email')
    .eq('id', payment.client_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  // Coach info — prefer coach_profiles, fallback to auth metadata
  const { data: coachProfile } = await db
    .from('coach_profiles')
    .select('full_name, brand_name, pro_email, logo_url')
    .eq('coach_id', user.id)
    .maybeSingle()

  const coachMeta = user.user_metadata ?? {}
  const coachName: string = coachProfile?.brand_name ?? coachProfile?.full_name ?? coachMeta.full_name ?? coachMeta.first_name ?? user.email ?? 'Votre coach'
  const coachEmail: string = coachProfile?.pro_email ?? user.email ?? ''
  const coachLogoUrl: string | null = coachProfile?.logo_url ?? null

  // Invoice number — reuse existing or generate new
  let invoiceNumber = payment.invoice_number
  if (!invoiceNumber) {
    invoiceNumber = await nextInvoiceNumber(db, user.id)
    await db
      .from('subscription_payments')
      .update({ invoice_number: invoiceNumber })
      .eq('id', params.paymentId)
  }

  // Period label (month/year of payment date)
  const paymentDate = new Date(payment.payment_date)
  const period = paymentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const capitalizedPeriod = period.charAt(0).toUpperCase() + period.slice(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = payment.subscription as any
  const formulaName: string = sub?.formula?.name ?? payment.description ?? 'Coaching'

  const receiptData = {
    invoiceNumber,
    date: payment.payment_date,
    coachName,
    coachEmail,
    coachLogoUrl,
    clientName: `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim(),
    clientEmail: client.email ?? '',
    formulaName,
    period: capitalizedPeriod,
    amount: Number(payment.amount_eur),
    paymentMethod: payment.payment_method,
  }

  const pdfBuffer = await generateReceiptPdf(receiptData)

  if (sendEmail) {
    if (!client.email) {
      return NextResponse.json({ error: 'Le client n\'a pas d\'adresse email' }, { status: 400 })
    }

    await sendInvoiceEmail({
      to: client.email,
      clientFirstName: client.first_name ?? '',
      coachName,
      invoiceNumber,
      amount: Number(payment.amount_eur),
      pdfBuffer,
      fromName: coachName,
    })

    // Mark as sent
    await db
      .from('subscription_payments')
      .update({ invoice_sent_at: new Date().toISOString() })
      .eq('id', params.paymentId)

    return NextResponse.json({ sent: true, invoiceNumber })
  }

  // Direct download — pass Uint8Array (BodyInit compatible)
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recu-${invoiceNumber}.pdf"`,
    },
  })
}
