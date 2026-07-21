import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { resolvePaymentDueDate } from '@/lib/payments/due-date'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { paymentId: string } }
const idSchema = z.string().uuid()
const updateSchema = z.object({
  status: z.enum(['paid', 'pending', 'failed', 'refunded']).optional(),
  payment_method: z.enum(['manual', 'bank_transfer', 'card', 'cash', 'stripe', 'other']).optional(),
  payment_date: z.string().date().optional(),
  due_date: z.string().date().nullable().optional(),
  amount_eur: z.coerce.number().positive().max(1_000_000).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  reference: z.string().trim().max(200).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0)

// PATCH /api/payments/[paymentId]
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!idSchema.safeParse(params.paymentId).success) {
    return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Mise à jour invalide' }, { status: 400 })

  const db = serviceClient()
  const patch = { ...parsed.data }

  // If moving to pending/failed without due_date, ensure one exists for auto-reminders
  if (
    (patch.status === 'pending' || patch.status === 'failed') &&
    patch.due_date === undefined
  ) {
    const { data: current } = await db
      .from('subscription_payments')
      .select('due_date, payment_date, status, reminder_sent_at')
      .eq('id', params.paymentId)
      .eq('coach_id', user.id)
      .maybeSingle()

    if (current && !current.due_date) {
      patch.due_date = resolvePaymentDueDate({
        status: patch.status,
        due_date: null,
        payment_date: patch.payment_date ?? current.payment_date,
      })
    }
    // Re-open as pending → allow a fresh auto-reminder cycle
    if (patch.status === 'pending' && current?.status !== 'pending') {
      ;(patch as Record<string, unknown>).reminder_sent_at = null
    }
  } else if (patch.due_date === null && (patch.status === 'pending' || patch.status === 'failed')) {
    patch.due_date = resolvePaymentDueDate({
      status: patch.status,
      due_date: null,
      payment_date: patch.payment_date,
    })
  }

  // Changing due_date on a pending payment re-arms the reminder
  if (patch.due_date !== undefined && patch.due_date !== null) {
    ;(patch as Record<string, unknown>).reminder_sent_at = null
  }

  const { data, error } = await db
    .from('subscription_payments')
    .update(patch)
    .eq('id', params.paymentId)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
  return NextResponse.json({ payment: data })
}

// DELETE /api/payments/[paymentId]
export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!idSchema.safeParse(params.paymentId).success) {
    return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
  }

  const { error } = await serviceClient()
    .from('subscription_payments')
    .delete()
    .eq('id', params.paymentId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
