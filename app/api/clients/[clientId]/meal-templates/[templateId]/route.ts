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

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  calories_kcal: z.number().int().nonnegative().nullable().optional(),
  protein_g: z.number().nonnegative().nullable().optional(),
  carbs_g: z.number().nonnegative().nullable().optional(),
  fats_g: z.number().nonnegative().nullable().optional(),
  fiber_g: z.number().nonnegative().nullable().optional(),
  position: z.number().int().nonnegative().optional(),
})

// PATCH /api/clients/[clientId]/meal-templates/[templateId]
export async function PATCH(req: NextRequest, { params }: { params: { clientId: string; templateId: string } }) {
  const coach = await getAuthCoach(params.clientId)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = patchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { data, error } = await service()
    .from('coach_meal_templates')
    .update(body.data)
    .eq('id', params.templateId)
    .eq('client_id', params.clientId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/clients/[clientId]/meal-templates/[templateId]
export async function DELETE(_req: NextRequest, { params }: { params: { clientId: string; templateId: string } }) {
  const coach = await getAuthCoach(params.clientId)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await service()
    .from('coach_meal_templates')
    .delete()
    .eq('id', params.templateId)
    .eq('client_id', params.clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
