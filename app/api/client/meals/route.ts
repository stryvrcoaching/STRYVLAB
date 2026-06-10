import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { inngest } from '@/lib/inngest/client'

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

// GET /api/client/meals?date=YYYY-MM-DD&page=0&limit=20
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const url = new URL(req.url)
  const dateFilter = url.searchParams.get('date')
  const page = parseInt(url.searchParams.get('page') ?? '0', 10)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100)

  let query = service()
    .from('meal_logs')
    .select('*', { count: 'exact' })
    .eq('client_id', clientId)
    .order('logged_at', { ascending: true })
    .range(page * limit, (page + 1) * limit - 1)

  if (dateFilter) {
    query = query
      .gte('logged_at', `${dateFilter}T00:00:00.000Z`)
      .lte('logged_at', `${dateFilter}T23:59:59.999Z`)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit })
}

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  logged_at: z.string().datetime().optional(),
  photo_url: z.string().url().nullable().optional(),
  photo_urls: z.array(z.string().url()).max(3).optional(),
  transcript: z.string().max(2000).nullable().optional(),
  quality_rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  estimated_macros: z.object({
    calories_kcal: z.number().nonnegative().optional(),
    protein_g: z.number().nonnegative().optional(),
    carbs_g: z.number().nonnegative().optional(),
    fats_g: z.number().nonnegative().optional(),
    fiber_g: z.number().nonnegative().optional(),
  }).nullable().optional(),
})

// POST /api/client/meals
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const loggedAt = body.data.logged_at ?? new Date().toISOString()
  const hasAiContent = !!(body.data.transcript || (body.data.photo_urls ?? []).length > 0)

  const { data: meal, error } = await service()
    .from('meal_logs')
    .insert({
      client_id: clientId,
      name: body.data.name,
      logged_at: loggedAt,
      photo_url: body.data.photo_url ?? null,
      photo_urls: body.data.photo_urls ?? [],
      transcript: body.data.transcript ?? null,
      ai_status: hasAiContent ? 'pending' : 'done',
      quality_rating: body.data.quality_rating ?? null,
      notes: body.data.notes ?? null,
      estimated_macros: body.data.estimated_macros ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventDate = loggedAt.split('T')[0]
  const eventTime = loggedAt.split('T')[1]?.slice(0, 5) ?? null

  // Insert smart_agenda_events (fire and forget)
  void service().from('smart_agenda_events').insert({
    client_id: clientId,
    event_type: 'meal',
    event_date: eventDate,
    event_time: eventTime,
    source_id: meal.id,
    title: meal.name,
    summary: hasAiContent ? 'Analyse en cours...' : null,
    data: meal.estimated_macros ?? null,
  })

  // Award points (fire and forget)
  void service().from('client_points').insert({
    client_id: clientId,
    action_type: 'meal',
    points: 3,
    reference_id: meal.id,
  })

  // Trigger AI analysis if there's content to analyze
  if (hasAiContent) {
    await inngest.send({ name: 'meal/analyze.requested', data: { mealLogId: meal.id } })
  }

  return NextResponse.json(meal, { status: 201 })
}
