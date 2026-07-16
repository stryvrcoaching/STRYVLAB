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

const shippingSchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  addressLine1: z.string().trim().min(3).max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal('')),
  postalCode: z.string().trim().min(2).max(20),
  city: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
})

const postSchema = z.object({
  rewardId: z.string().uuid(),
  shipping: shippingSchema.optional(),
})

const deleteSchema = z.object({
  redemptionId: z.string().uuid()
})

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = postSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const { rewardId, shipping } = body.data
  const db = serviceClient()

  // 1. Get client data
  const { data: clientData, error: clientErr } = await db
    .from('coach_clients')
    .select('id, coach_id, first_name, last_name')
    .eq('user_id', user.id)
    .single()

  if (clientErr || !clientData) return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 })

  // 2. Get reward data
  const { data: reward, error: rewardErr } = await db
    .from('coach_rewards')
    .select('id, title, cost_points, is_active, coach_id, reward_type')
    .eq('id', rewardId)
    .single()

  if (rewardErr || !reward) return NextResponse.json({ error: 'Cadeau introuvable' }, { status: 404 })
  if (!reward.is_active) return NextResponse.json({ error: 'Ce cadeau n\'est plus disponible' }, { status: 400 })
  if (reward.coach_id !== clientData.coach_id) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
  if (reward.reward_type === 'physical' && !shipping) {
    return NextResponse.json({ error: 'Les coordonnées de livraison sont requises pour cette récompense.' }, { status: 400 })
  }

  // 3. Deduct points and create the redemption atomically. Automatic rewards are
  // fulfilled at this point; manual rewards remain pending for the coach.
  const { data: redemptionResult, error: redeemErr } = await db.rpc('redeem_client_reward', {
    p_client_id: clientData.id,
    p_reward_id: reward.id,
    p_shipping_recipient_name: shipping?.recipientName ?? null,
    p_shipping_address_line1: shipping?.addressLine1 ?? null,
    p_shipping_address_line2: shipping?.addressLine2 || null,
    p_shipping_postal_code: shipping?.postalCode ?? null,
    p_shipping_city: shipping?.city ?? null,
    p_shipping_country: shipping?.country ?? null,
    p_shipping_phone: shipping?.phone || null,
  })

  if (redeemErr) {
    const message = redeemErr.message ?? ''
    if (message.includes('INSUFFICIENT_POINTS')) return NextResponse.json({ error: 'Fonds insuffisants' }, { status: 400 })
    if (message.includes('REWARD_ALREADY_REDEEMED') || redeemErr.code === '23505') return NextResponse.json({ error: 'Cette récompense a déjà été obtenue ou est en attente' }, { status: 409 })
    if (message.includes('REWARD_NOT_ACTIVE')) return NextResponse.json({ error: 'Ce cadeau n\'est plus disponible' }, { status: 400 })
    if (message.includes('CLIENT_STREAK_NOT_FOUND')) return NextResponse.json({ error: 'Données de progression introuvables' }, { status: 404 })
    if (message.includes('SHIPPING_ADDRESS_REQUIRED')) return NextResponse.json({ error: 'Les coordonnées de livraison sont requises pour cette récompense.' }, { status: 400 })
    return NextResponse.json({ error: 'Impossible de finaliser cet échange' }, { status: 500 })
  }

  const redemption = Array.isArray(redemptionResult) ? redemptionResult[0] : redemptionResult
  if (!redemption) return NextResponse.json({ error: 'Impossible de finaliser cet échange' }, { status: 500 })

  const clientName = [clientData.first_name, clientData.last_name].filter(Boolean).join(' ') || 'Un client'
  if (redemption.redemption_status === 'pending') {
    const { error: notificationError } = await db.from('coach_notifications').insert({
      coach_id: clientData.coach_id,
      client_id: clientData.id,
      category: 'engagement',
      subcategory: 'reward_redemption',
      title: 'Nouvelle demande de récompense',
      body: redemption.reward_type === 'physical'
        ? `${clientName} demande « ${redemption.reward_title ?? reward.title ?? 'une récompense'} » : ses coordonnées de livraison sont confirmées.`
        : `${clientName} demande « ${redemption.reward_title ?? reward.title ?? 'une récompense'} » contre ${redemption.reward_cost_points ?? reward.cost_points} points.`,
      payload: { reward_id: reward.id, redemption_id: redemption.redemption_id, cost_points: redemption.reward_cost_points ?? reward.cost_points, reward_type: redemption.reward_type },
      status: 'pending',
      priority: 3,
      email_sent: false,
    })
    if (notificationError) console.error('[client-rewards] coach notification failed', notificationError)
  }

  return NextResponse.json({
    success: true,
    redemption: {
      id: redemption.redemption_id,
      status: redemption.redemption_status,
    },
    deliveryUrl: redemption.delivery_url,
  })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = deleteSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const db = serviceClient()
  const { data: clientData, error: clientErr } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (clientErr || !clientData) return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 })

  const { data: redemption, error: redemptionErr } = await db
    .from('client_reward_redemptions')
    .select('id, client_id, reward_id, status, coach_rewards!inner(cost_points, coach_id)')
    .eq('id', body.data.redemptionId)
    .eq('client_id', clientData.id)
    .eq('status', 'pending')
    .maybeSingle()
  if (redemptionErr) return NextResponse.json({ error: redemptionErr.message }, { status: 500 })
  if (!redemption) return NextResponse.json({ error: 'Cette demande ne peut plus être annulée' }, { status: 409 })

  const reward = Array.isArray(redemption.coach_rewards) ? redemption.coach_rewards[0] : redemption.coach_rewards
  const costPoints = Number(reward?.cost_points ?? 0)

  const { data: cancelled, error: cancelErr } = await db.rpc('cancel_client_reward_redemption', {
    p_redemption_id: redemption.id,
    p_client_id: clientData.id,
    p_coach_id: reward?.coach_id,
  })
  if (cancelErr || !cancelled) return NextResponse.json({ error: 'Impossible d’annuler cette demande' }, { status: 409 })

  await db
    .from('coach_notifications')
    .update({ status: 'resolved' })
    .contains('payload', { redemption_id: redemption.id })

  return NextResponse.json({ success: true, refunded: costPoints })
}
