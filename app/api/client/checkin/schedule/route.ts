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

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data?.id ?? null
}

// GET /api/client/checkin/schedule
export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data, error } = await service()
    .from('daily_checkin_schedules')
    .select('*')
    .eq('client_id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

const scheduleEntrySchema = z.object({
  moment: z.enum(['morning', 'evening']),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(1),
})

const bodySchema = z.object({
  schedules: z.array(scheduleEntrySchema).min(1).max(2),
  push_token: z.string().nullable().optional(),
})

// POST /api/client/checkin/schedule
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const rows = body.data.schedules.map(s => ({
    client_id: clientId,
    moment: s.moment,
    scheduled_time: s.scheduled_time,
    timezone: s.timezone,
  }))

  const { data, error } = await service()
    .from('daily_checkin_schedules')
    .upsert(rows, { onConflict: 'client_id,moment' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const primaryTimezone = body.data.schedules[0]?.timezone
  if (primaryTimezone) {
    const { error: timezoneError } = await service()
      .from('coach_clients')
      .update({ timezone: primaryTimezone })
      .eq('id', clientId)
    if (timezoneError) return NextResponse.json({ error: timezoneError.message }, { status: 500 })
  }

  if (body.data.push_token !== undefined) {
    const { error: pushError } = await service()
      .from('coach_clients')
      .update({ push_token: body.data.push_token })
      .eq('id', clientId)
    if (pushError) {
      return NextResponse.json({ error: pushError.message }, { status: 500 })
    }
  }

  return NextResponse.json(data)
}
