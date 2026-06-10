import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { IntelligenceProfile } from '@/lib/programs/intelligence/types'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id, training_goal, fitness_level, equipment')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: annotations } = await db
    .from('metric_annotations')
    .select('id, label, body, body_part, severity, event_date')
    .eq('client_id', clientId)
    .eq('event_type', 'injury')
    .not('body_part', 'is', null)
    .order('event_date', { ascending: false })

  const profile: IntelligenceProfile = {
    injuries: (annotations ?? []).map((a) => ({
      bodyPart: a.body_part as string,
      severity: a.severity as 'avoid' | 'limit' | 'monitor',
    })),
    equipment: (clientRow.equipment as string[]) ?? [],
    fitnessLevel: clientRow.fitness_level ?? undefined,
    goal: clientRow.training_goal ?? undefined,
  }

  return NextResponse.json(profile)
}
