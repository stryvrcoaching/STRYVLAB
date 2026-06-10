import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { EnergeticDirection, AdaptiveState } from '@/lib/coach/phaseEngine/types'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const DIRECTIONS = [
  'aggressive_deficit', 'controlled_deficit', 'maintenance',
  'controlled_surplus', 'aggressive_surplus',
] as const

const ADAPTIVE_STATES = [
  'recovery_crash', 'systemic_fatigue', 'high_fatigue',
  'stable', 'recovered', 'supercompensated',
] as const

const bodySchema = z.object({
  phaseOverride: z
    .object({
      active: z.boolean(),
      direction: z.enum(DIRECTIONS).optional(),
      adaptiveState: z.enum(ADAPTIVE_STATES).optional(),
      reason: z.string().max(500).optional(),
    })
    .nullable()
    .optional(),
  phasePreferences: z
    .object({
      prioritizePerformance: z.boolean().optional(),
      aggressiveCutTolerance: z.number().min(0).max(1).optional(),
      preferredBulkAggressiveness: z.number().min(0).max(1).optional(),
    })
    .nullable()
    .optional(),
})

type Params = { params: { clientId: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const db = service()
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const update: Record<string, unknown> = {}

  if ('phaseOverride' in parsed.data) {
    const o = parsed.data.phaseOverride
    if (o == null) {
      update.phase_override = null
    } else if (o.active) {
      update.phase_override = {
        active: true,
        direction: o.direction as EnergeticDirection | undefined,
        adaptiveState: o.adaptiveState as AdaptiveState | undefined,
        reason: o.reason?.trim() || undefined,
        setAt: new Date().toISOString(),
      }
    } else {
      update.phase_override = { active: false, setAt: new Date().toISOString() }
    }
  }

  if ('phasePreferences' in parsed.data) {
    update.phase_preferences = parsed.data.phasePreferences
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await db
    .from('coach_clients')
    .update(update)
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .select('phase_override, phase_preferences')
    .single()

  if (error || !data) {
    console.error('PATCH phase-optimization/override:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({
    phaseOverride: data.phase_override,
    phasePreferences: data.phase_preferences,
  })
}
