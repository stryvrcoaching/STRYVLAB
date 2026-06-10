import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const bodySchema = z.object({
  activity_type: z.enum(['running', 'cycling', 'swimming', 'walking', 'team_sport', 'other']),
  custom_label: z.string().max(80).optional(),
  started_at: z.string().datetime(),
  duration_min: z.number().int().min(1).max(360),
  intensity: z.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
})

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getClientId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: cc } = await svc().from('coach_clients').select('id').eq('user_id', user.id).single()
  return cc?.id ?? null
}

export async function GET(req: NextRequest) {
  const clientId = await getClientId()
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const date = url.searchParams.get('date')

  let q = svc()
    .from('client_activity_logs')
    .select('id, activity_type, custom_label, started_at, duration_min, intensity, notes')
    .eq('client_id', clientId)
    .order('started_at', { ascending: false })
    .limit(50)

  if (date) {
    q = q.gte('started_at', `${date}T00:00:00Z`).lte('started_at', `${date}T23:59:59Z`)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const clientId = await getClientId()
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  const { data, error } = await svc()
    .from('client_activity_logs')
    .insert({ ...parsed.data, client_id: clientId })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
