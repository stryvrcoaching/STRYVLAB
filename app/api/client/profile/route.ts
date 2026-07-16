import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const updateSchema = z.object({
  first_name: z.string().trim().min(1).max(100).optional(),
  last_name: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  goal: z.string().trim().max(1000).nullable().optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender: z.string().trim().max(40).nullable().optional(),
  training_goal: z.string().trim().max(80).nullable().optional(),
  fitness_level: z.string().trim().max(40).nullable().optional(),
  sport_practice: z.string().trim().max(40).nullable().optional(),
  weekly_frequency: z.number().int().min(1).max(7).nullable().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()

  const { data: client, error } = await db
    .from('coach_clients')
    .select('id, first_name, last_name, email, gender, created_at')
    .eq('user_id', user.id)
    .single()

  if (error || !client) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  return NextResponse.json(client)
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') }, { status: 400 })
  }

  const db = service()
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!client) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await db
    .from('coach_clients')
    .update(parsed.data)
    .eq('id', client.id)
    .select('id, first_name, last_name, email, gender, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
