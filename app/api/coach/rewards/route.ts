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

const deliveryUrlSchema = z.string().url().max(2000).refine((value) => {
  const protocol = new URL(value).protocol
  return protocol === 'https:' || protocol === 'http:'
}, 'Le lien doit commencer par http:// ou https://')

// ─── GET /api/coach/rewards ───────────────────────────────────────────────────
export async function GET() {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await serviceClient()
    .from('coach_rewards')
    .select('*')
    .eq('coach_id', user.id)
    .order('cost_points', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rewards: data })
}

// ─── POST /api/coach/rewards ─────────────────────────────────────────────────
const postSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(300).nullable().optional(),
  cost_points: z.number().int().min(0),
  icon_name: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  reward_type: z.enum(['digital', 'physical']).optional().default('digital'),
  fulfillment_mode: z.enum(['manual', 'automatic']).optional().default('manual'),
  delivery_url: deliveryUrlSchema.nullable().optional(),
  is_active: z.boolean().optional().default(true),
})

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = postSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const { data, error } = await serviceClient()
    .from('coach_rewards')
    .insert({
      coach_id: user.id,
      ...body.data
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reward: data })
}

// ─── PATCH /api/coach/rewards ─────────────────────────────────────────────────
const patchSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(300).nullable().optional(),
  cost_points: z.number().int().min(0).optional(),
  icon_name: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  reward_type: z.enum(['digital', 'physical']).optional(),
  fulfillment_mode: z.enum(['manual', 'automatic']).optional(),
  delivery_url: deliveryUrlSchema.nullable().optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = patchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const { id, ...updates } = body.data
  const db = serviceClient()

  const { data: currentReward, error: currentRewardError } = await db
    .from('coach_rewards')
    .select('id')
    .eq('id', id)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (currentRewardError) return NextResponse.json({ error: currentRewardError.message }, { status: 500 })
  if (!currentReward) return NextResponse.json({ error: 'Récompense introuvable' }, { status: 404 })

  const { data, error } = await db
    .from('coach_rewards')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('coach_id', user.id) // security check
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reward: data })
}

// ─── DELETE /api/coach/rewards ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

  const { error } = await serviceClient()
    .from('coach_rewards')
    .delete()
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
