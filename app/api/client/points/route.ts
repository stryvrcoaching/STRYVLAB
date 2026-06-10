import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/client/points?limit=10
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 50)

  const [streakRes, historyRes] = await Promise.all([
    service()
      .from('client_streaks')
      .select('*')
      .eq('client_id', client.id)
      .maybeSingle(),
    service()
      .from('client_points')
      .select('action_type, points, reference_id, earned_at')
      .eq('client_id', client.id)
      .order('earned_at', { ascending: false })
      .limit(limit),
  ])

  const streak = streakRes.data ?? {
    current_streak: 0,
    longest_streak: 0,
    total_points: 0,
    level: 'bronze',
    last_checkin_date: null,
  }

  return NextResponse.json({
    total_points: streak.total_points,
    level: streak.level,
    current_streak: streak.current_streak,
    longest_streak: streak.longest_streak,
    last_checkin_date: streak.last_checkin_date,
    history: historyRes.data ?? [],
  })
}
