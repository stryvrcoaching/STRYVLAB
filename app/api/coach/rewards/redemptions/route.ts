import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = serviceClient()
  const { data, error: queryError } = await db
    .from('client_reward_redemptions')
    .select('id, client_id, reward_id, status, redeemed_at, shipping_recipient_name, shipping_address_line1, shipping_address_line2, shipping_postal_code, shipping_city, shipping_country, shipping_phone, coach_rewards!inner(id, title, description, cost_points, reward_type, coach_id), coach_clients!inner(first_name, last_name)')
    .eq('status', 'pending')
    .eq('coach_rewards.coach_id', user.id)
    .order('redeemed_at', { ascending: true })

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 })
  return NextResponse.json({ redemptions: data ?? [] })
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['fulfilled', 'cancelled']),
})

export async function PATCH(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = patchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const db = serviceClient()
  const { data: redemption, error: redemptionError } = await db
    .from('client_reward_redemptions')
    .select('id, client_id, status, reward:coach_rewards!inner(id, title, cost_points, coach_id)')
    .eq('id', body.data.id)
    .eq('reward.coach_id', user.id)
    .single()

  if (redemptionError || !redemption) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (redemption.status !== 'pending') return NextResponse.json({ error: 'Cette demande a déjà été traitée' }, { status: 409 })

  const reward = Array.isArray(redemption.reward) ? redemption.reward[0] : redemption.reward
  if (!reward) return NextResponse.json({ error: 'Récompense introuvable' }, { status: 404 })

  if (body.data.status === 'cancelled') {
    const { data: cancelled, error: refundError } = await db.rpc('cancel_client_reward_redemption', {
      p_redemption_id: redemption.id,
      p_client_id: redemption.client_id,
      p_coach_id: user.id,
    })
    if (refundError || !cancelled) return NextResponse.json({ error: 'Le remboursement des points a échoué' }, { status: 500 })
    return NextResponse.json({ redemption: { ...redemption, status: 'cancelled' }, refunded: true })
  }

  const { data: updated, error: updateError } = await db
    .from('client_reward_redemptions')
    .update({ status: body.data.status, fulfilled_at: body.data.status === 'fulfilled' ? new Date().toISOString() : null })
    .eq('id', redemption.id)
    .eq('status', 'pending')
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ redemption: updated, refunded: body.data.status === 'cancelled' })
}
