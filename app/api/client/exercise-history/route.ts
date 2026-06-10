import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const exerciseName = req.nextUrl.searchParams.get('name')
  if (!exerciseName) return NextResponse.json({ error: 'Missing name param' }, { status: 400 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: clientRow } = await service
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const since = new Date()
  since.setDate(since.getDate() - 112) // 16 weeks

  // Query from client_session_logs (has client_id + completed_at) — same pattern as recap page
  const { data: sessionLogs, error } = await service
    .from('client_session_logs')
    .select(`
      id,
      session_name,
      completed_at,
      client_set_logs(
        set_number,
        exercise_name,
        actual_weight_kg,
        actual_reps,
        rir_actual,
        side,
        completed
      )
    `)
    .eq('client_id', clientRow.id)
    .not('completed_at', 'is', null)
    .gte('completed_at', since.toISOString())
    .order('completed_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter sets for the requested exercise and build session map
  const sessions: {
    date: string
    session_name: string
    sets: { set_number: number; weight_kg: number; reps: number; rir: number | null; side: string }[]
    best_weight: number
  }[] = []

  for (const session of sessionLogs ?? []) {
    const relevantSets = ((session.client_set_logs ?? []) as any[])
      .filter((s: any) => s.exercise_name === exerciseName && s.completed === true)

    if (relevantSets.length === 0) continue

    const mappedSets = relevantSets.map((s: any) => ({
      set_number: s.set_number ?? 1,
      weight_kg: parseFloat(String(s.actual_weight_kg)) || 0,
      reps: s.actual_reps ?? 0,
      rir: s.rir_actual != null ? Number(s.rir_actual) : null,
      side: s.side ?? 'bilateral',
    }))

    const best_weight = Math.max(...mappedSets.map((s: any) => s.weight_kg))

    sessions.push({
      date: (session.completed_at as string).slice(0, 10),
      session_name: session.session_name ?? '',
      sets: mappedSets,
      best_weight,
    })
  }

  const allBestWeights = sessions.map(s => s.best_weight)
  const allTimeBest = allBestWeights.length > 0 ? Math.max(...allBestWeights) : 0
  const firstBest = allBestWeights[0] ?? 0
  const lastBest = allBestWeights[allBestWeights.length - 1] ?? 0
  const progression = Math.round((lastBest - firstBest) * 10) / 10

  return NextResponse.json({
    sessions,
    all_time_best: allTimeBest,
    progression,
    session_count: sessions.length,
  })
}
