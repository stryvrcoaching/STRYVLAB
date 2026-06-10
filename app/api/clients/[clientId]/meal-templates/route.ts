import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getAuthCoach(clientId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await service()
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .maybeSingle()
  if (!data) return null
  return user
}

// GET /api/clients/[clientId]/meal-templates
export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const coach = await getAuthCoach(params.clientId)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await service()
    .from('coach_meal_templates')
    .select('*')
    .eq('client_id', params.clientId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  calories_kcal: z.number().int().nonnegative().nullable().optional(),
  protein_g: z.number().nonnegative().nullable().optional(),
  carbs_g: z.number().nonnegative().nullable().optional(),
  fats_g: z.number().nonnegative().nullable().optional(),
  fiber_g: z.number().nonnegative().nullable().optional(),
  position: z.number().int().nonnegative().optional(),
})

// POST /api/clients/[clientId]/meal-templates
export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  const coach = await getAuthCoach(params.clientId)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  // Auto position = count + 1
  const { count } = await service()
    .from('coach_meal_templates')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', params.clientId)

  const { data, error } = await service()
    .from('coach_meal_templates')
    .insert({
      coach_id: coach.id,
      client_id: params.clientId,
      name: body.data.name,
      description: body.data.description ?? null,
      calories_kcal: body.data.calories_kcal ?? null,
      protein_g: body.data.protein_g ?? null,
      carbs_g: body.data.carbs_g ?? null,
      fats_g: body.data.fats_g ?? null,
      fiber_g: body.data.fiber_g ?? null,
      position: body.data.position ?? (count ?? 0),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
