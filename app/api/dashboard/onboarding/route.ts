import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(_req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = serviceClient()
  const coachId = user.id

  const [clientsRes, templatesRes, formulasRes] = await Promise.all([
    db.from('coach_clients').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
    db.from('assessment_templates').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
    db.from('coach_formulas').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
  ])

  return NextResponse.json({
    hasClient: (clientsRes.count ?? 0) > 0,
    hasTemplate: (templatesRes.count ?? 0) > 0,
    hasFormula: (formulasRes.count ?? 0) > 0,
  })
}
