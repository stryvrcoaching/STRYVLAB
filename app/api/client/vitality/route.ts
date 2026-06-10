import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface VitalityTrendPoint {
  date: string
  energy:   number | null
  sleep:    number | null
  stress:   number | null
  soreness: number | null
}

export interface VitalityResponse {
  score:        number | null
  checkinCount: number
  trend:        VitalityTrendPoint[]
}

export function computeVitalityScore(
  energy:   number | null,
  sleep:    number | null,
  stress:   number | null,
  soreness: number | null,
): number | null {
  if (energy == null && sleep == null && stress == null) return null
  let weighted = 0
  let divisor  = 0

  if (energy != null)   { weighted += ((energy - 1) / 4) * 1.5;            divisor += 1.5 }
  if (sleep != null)    { weighted += ((sleep - 1) / 3) * 1.5;             divisor += 1.5 }
  if (stress != null)   { weighted += (1 - (stress - 1) / 4) * 1.0;        divisor += 1.0 }
  if (soreness != null) { weighted += (1 - (soreness - 1) / 3) * 0.5;      divisor += 0.5 }

  if (divisor === 0) return null
  return Math.round(Math.min(100, Math.max(0, (weighted / divisor) * 100)))
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = svc()
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().split('T')[0]

  const { data: rows } = await service
    .from('client_daily_checkins')
    .select('date, energy_level, sleep_quality, stress_level, muscle_soreness')
    .eq('client_id', (client as any).id)
    .gte('date', sinceStr)
    .order('date', { ascending: true })

  if (!rows || rows.length === 0) {
    return NextResponse.json({ score: null, checkinCount: 0, trend: [] } satisfies VitalityResponse)
  }

  // Merge morning + evening for same date — take best available values
  const byDate = new Map<string, VitalityTrendPoint>()
  for (const r of rows as any[]) {
    const key = r.date as string
    const existing = byDate.get(key)
    byDate.set(key, {
      date:     key,
      energy:   r.energy_level    ?? existing?.energy   ?? null,
      sleep:    r.sleep_quality   ?? existing?.sleep    ?? null,
      stress:   r.stress_level    ?? existing?.stress   ?? null,
      soreness: r.muscle_soreness ?? existing?.soreness ?? null,
    })
  }

  const trend = Array.from(byDate.values())

  // Score = average of per-day scores for last 7 days with data
  const recent = trend.slice(-7)
  const scores = recent
    .map(d => computeVitalityScore(d.energy, d.sleep, d.stress, d.soreness))
    .filter((s): s is number => s != null)
  const score = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null

  return NextResponse.json({
    score,
    checkinCount: trend.length,
    trend,
  } satisfies VitalityResponse)
}
