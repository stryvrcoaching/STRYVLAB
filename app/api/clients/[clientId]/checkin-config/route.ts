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

async function getCoach(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

async function ownsClient(coachId: string, clientId: string) {
  const { data } = await service()
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', coachId)
    .single()
  return !!data
}

// GET /api/clients/[clientId]/checkin-config
export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const coach = await getCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await ownsClient(coach.id, params.clientId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await service()
    .from('daily_checkin_configs')
    .select('*')
    .eq('client_id', params.clientId)
    .eq('coach_id', coach.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? null)
}

const momentSchema = z.object({
  moment: z.enum(['morning', 'evening']),
  fields: z.array(z.string()),
})

const bodySchema = z.object({
  is_active: z.boolean(),
  days_of_week: z.array(z.number().int().min(0).max(6)),
  moments: z.array(momentSchema),
})

// POST /api/clients/[clientId]/checkin-config
export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const coach = await getCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await ownsClient(coach.id, params.clientId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { data, error } = await service()
    .from('daily_checkin_configs')
    .upsert(
      {
        coach_id: coach.id,
        client_id: params.clientId,
        is_active: body.data.is_active,
        days_of_week: body.data.days_of_week,
        moments: body.data.moments,
      },
      { onConflict: 'coach_id,client_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 200 })
}
