import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

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

  const { data, error } = await serviceClient()
    .from('subscription_payments')
    .update(parsed.data)
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
