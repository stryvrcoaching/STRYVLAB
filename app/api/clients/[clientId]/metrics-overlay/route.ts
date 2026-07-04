export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import {
  buildMetricsOverlayResponse,
  buildOverlayDateKeys,
} from '@/lib/coach/metricsOverlay'

const querySchema = z.object({
  window: z.enum(['7', '14', '30', '90', '180', '365', '730']).default('30'),
})

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { clientId } = await params
  const db = serviceClient()

  const { data: ownedClient, error: clientError } = await db
    .from('coach_clients')
    .select('id, timezone')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 })
  }

  if (!ownedClient) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const timezone =
      String((ownedClient as { timezone?: string | null }).timezone ?? '').trim() ||
      await resolveClientTimezone(db, clientId)
    const windowDays = Number(parsed.data.window)
    const { startDateKey, endDateKey, dateKeys } = buildOverlayDateKeys(timezone, windowDays)

    const payload = await buildMetricsOverlayResponse(
      db,
      {
        clientId,
        coachId: user.id,
        timezone,
        dateKeys,
        startDateKey,
        endDateKey,
      },
      windowDays,
    )

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[metrics-overlay GET]', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load metrics overlay',
      },
      { status: 500 },
    )
  }
}
