import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runGenerateSubscriptionDues } from '@/lib/payments/generate-subscription-dues'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// POST /api/payments/generate-dues — coach-triggered generation for their roster
export async function POST() {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const result = await runGenerateSubscriptionDues(serviceClient(), {
      coachId: user.id,
      leadDays: 7,
      maxPeriodsPerSub: 3,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Génération impossible' },
      { status: 500 },
    )
  }
}
