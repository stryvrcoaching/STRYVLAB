import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const AvailabilitiesSchema = z.array(
  z.object({
    day_of_week: z.number().min(1).max(7),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  })
)

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const { data, error } = await db
    .from('coach_availabilities')
    .select('id, day_of_week, start_time, end_time')
    .eq('coach_id', user.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const json = await req.json()
    const parsed = AvailabilitiesSchema.parse(json)

    const db = service()

    // Transaction manuelle : Supprime et recrée
    const { error: delErr } = await db
      .from('coach_availabilities')
      .delete()
      .eq('coach_id', user.id)

    if (delErr) throw delErr

    if (parsed.length > 0) {
      const inserts = parsed.map((item) => ({
        coach_id: user.id,
        day_of_week: item.day_of_week,
        start_time: item.start_time,
        end_time: item.end_time,
      }))

      const { error: insErr } = await db
        .from('coach_availabilities')
        .insert(inserts)

      if (insErr) throw insErr
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[coach/availabilities] error', err)
    return NextResponse.json(
      { error: err instanceof z.ZodError ? 'Validation failed' : 'Failed to save availabilities' },
      { status: 400 }
    )
  }
}
