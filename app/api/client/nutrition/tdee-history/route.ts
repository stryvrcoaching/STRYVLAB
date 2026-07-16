export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fetchClientTdeeState } from '@/lib/nutrition/tdee-state'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = Math.min(365, Math.max(7, parseInt(req.nextUrl.searchParams.get('days') ?? '90', 10)))

  const { data: cc } = await svc()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const clientTdeeState = await fetchClientTdeeState(svc() as any, cc.id)

  // Fetch sparse adaptive TDEE history points
  const { data: history, error } = await svc()
    .from('nutrition_tdee_history')
    .select('calculated_at, tdee_adaptive, tdee_formula, delta_kcal, avg_intake_kcal, weight_delta_kg, weight_samples')
    .eq('client_id', cc.id)
    .gte('calculated_at', cutoff.toISOString())
    .order('calculated_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    history: history ?? [],
    clientTdee: clientTdeeState?.current_tdee ?? null,
    clientTdeeAt: clientTdeeState?.current_tdee_at ?? null,
    stabilityStatus: clientTdeeState?.stability_status ?? null,
  })
}
