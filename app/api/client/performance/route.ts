import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Resolve clientId from auth user
  const { data: client } = await service
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30')
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString().split('T')[0]

  // Fetch session logs with set logs
  const { data: sessionLogs, error } = await service
    .from('client_session_logs')
    .select(`
      id,
      session_name,
      logged_at,
      completed_at,
      duration_min,
      client_set_logs (
        exercise_name,
        set_number,
        actual_reps,
        actual_weight_kg,
        completed,
        rpe
      )
    `)
    .eq('client_id', client.id)
    .gte('logged_at', sinceISO)
    .order('logged_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const logs = sessionLogs ?? []

  // ─── KPIs ────────────────────────────────────────────────────────────────
  const completedSessions = logs.filter((l) => l.completed_at).length
  const allSets = logs.flatMap((l) => l.client_set_logs ?? [])
  const completedSets = allSets.filter((s) => s.completed)
  const totalVolume = completedSets.reduce((sum, s) => {
    return sum + (s.actual_reps ?? 0) * (parseFloat(String(s.actual_weight_kg)) || 0)
  }, 0)
  const durationsMin = logs
    .filter((l) => l.duration_min != null)
    .map((l) => l.duration_min as number)
  const avgDuration = durationsMin.length
    ? Math.round(durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length)
    : 0

  // ─── Volume timeline (daily) ──────────────────────────────────────────────
  const timelineMap: Record<string, { date: string; volume: number; sessions: number }> = {}
  for (const log of logs) {
    const date = log.logged_at
    if (!timelineMap[date]) timelineMap[date] = { date, volume: 0, sessions: 0 }
    timelineMap[date].sessions += 1
    for (const s of log.client_set_logs ?? []) {
      if (s.completed) {
        timelineMap[date].volume +=
          (s.actual_reps ?? 0) * (parseFloat(String(s.actual_weight_kg)) || 0)
      }
    }
  }
  const timeline = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date))

  // ─── Exercise progression (top 6 by volume) ───────────────────────────────
  const exerciseMap: Record<
    string,
    { name: string; points: { date: string; maxWeight: number; totalVolume: number }[] }
  > = {}
  for (const log of logs) {
    for (const s of log.client_set_logs ?? []) {
      if (!s.completed || !s.actual_weight_kg) continue
      const name = s.exercise_name
      if (!exerciseMap[name]) exerciseMap[name] = { name, points: [] }
      const weight = parseFloat(String(s.actual_weight_kg))
      const existing = exerciseMap[name].points.find((p) => p.date === log.logged_at)
      if (existing) {
        existing.maxWeight = Math.max(existing.maxWeight, weight)
        existing.totalVolume += (s.actual_reps ?? 0) * weight
      } else {
        exerciseMap[name].points.push({
          date: log.logged_at,
          maxWeight: weight,
          totalVolume: (s.actual_reps ?? 0) * weight,
        })
      }
    }
  }
  const exerciseProgression = Object.values(exerciseMap)
    .sort((a, b) => {
      const volA = a.points.reduce((s, p) => s + p.totalVolume, 0)
      const volB = b.points.reduce((s, p) => s + p.totalVolume, 0)
      return volB - volA
    })
    .slice(0, 6)

  // ─── RPE trend ────────────────────────────────────────────────────────────
  const rpeTrend = logs
    .filter((l) => l.completed_at)
    .map((l) => {
      const rpes = (l.client_set_logs ?? [])
        .filter((s) => s.rpe != null && s.completed)
        .map((s) => s.rpe as number)
      const avgRpe = rpes.length
        ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10
        : null
      return { date: l.logged_at, avgRpe }
    })
    .filter((r) => r.avgRpe != null)

  return NextResponse.json({
    kpis: {
      totalSessions: logs.length,
      completedSessions,
      totalSets: completedSets.length,
      totalVolume: Math.round(totalVolume),
      avgDuration,
      days,
    },
    timeline,
    exerciseProgression,
    rpeTrend,
  })
}
