import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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

  const { data: sessions } = await svc()
    .from('client_session_logs')
    .select('id, completed_at, program_session_id, client_set_logs(actual_weight_kg, actual_reps, rir_actual)')
    .eq('client_id', cc.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(3)

  const items = (sessions ?? []).map(s => {
    const sets = (s.client_set_logs ?? []) as any[]
    const volumeKg = sets.reduce(
      (sum, st) => sum + Number(st.actual_weight_kg ?? 0) * Number(st.actual_reps ?? 0),
      0,
    )
    const rirVals = sets.map(st => st.rir_actual).filter((v): v is number => v != null)
    const avgRir = rirVals.length > 0 ? rirVals.reduce((a, b) => a + b, 0) / rirVals.length : null
    return {
      id: s.id,
      completed_at: s.completed_at,
      program_session_id: s.program_session_id,
      volume_kg: Math.round(volumeKg),
      avg_rir: avgRir != null ? Math.round(avgRir * 10) / 10 : null,
    }
  })

  return NextResponse.json({ sessions: items })
}
