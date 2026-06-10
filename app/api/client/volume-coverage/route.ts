import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getVolumeTargets, VOLUME_GROUP_LABELS, MUSCLE_TO_VOLUME_GROUP } from '@/lib/programs/intelligence/volume-targets'
import { getBiomechData } from '@/lib/programs/intelligence/catalog-utils'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await svc().from('coach_clients').select('id').eq('user_id', user.id).single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Week bounds
  const now = new Date()
  const dow = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const { data: sessionLogs } = await svc()
    .from('client_session_logs')
    .select('id, client_set_logs(exercise_name, completed_at)')
    .eq('client_id', cc.id)
    .not('completed_at', 'is', null)
    .gte('completed_at', monday.toISOString())
    .lte('completed_at', sunday.toISOString())

  const setRows = (sessionLogs ?? []).flatMap(s => (s.client_set_logs ?? []) as any[])

  // Use static catalog JSON via getBiomechData (no DB table needed)
  const volumeByGroup: Record<string, number> = {}
  for (const set of setRows) {
    const biomech = getBiomechData(set.exercise_name)
    if (!biomech) continue
    const primaryMuscle = biomech.primaryMuscle
    const primaryAct = biomech.primaryActivation ?? 1
    const secondary = biomech.secondaryMuscles ?? []
    const secondaryAct = biomech.secondaryActivations ?? []

    if (primaryMuscle) {
      const g = (MUSCLE_TO_VOLUME_GROUP as Record<string, string>)[primaryMuscle]
      if (g) volumeByGroup[g] = (volumeByGroup[g] ?? 0) + primaryAct
    }
    secondary.forEach((m, i) => {
      const g = (MUSCLE_TO_VOLUME_GROUP as Record<string, string>)[m]
      if (!g) return
      volumeByGroup[g] = (volumeByGroup[g] ?? 0) + (secondaryAct[i] ?? 0.5)
    })
  }

  const groups = Object.keys(VOLUME_GROUP_LABELS).map(g => {
    const [mev, mav, mrv] = getVolumeTargets(g, 'hypertrophy', 'intermediate')
    return {
      group: g,
      label: (VOLUME_GROUP_LABELS as Record<string, string>)[g],
      actual: Math.round((volumeByGroup[g] ?? 0) * 10) / 10,
      mev,
      mav,
      mrv,
    }
  })

  return NextResponse.json({
    week_start: monday.toISOString().slice(0, 10),
    sessions_count: (sessionLogs ?? []).length,
    groups,
  })
}
