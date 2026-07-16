import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const settingsSchema = z.object({ pace: z.enum(['fast', 'balanced', 'demanding']) })
const MIN_CHANGE_MS = 28 * 24 * 60 * 60 * 1000

export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { data, error } = await serviceClient().from('coach_reward_settings').select('pace, last_pace_change_at').eq('coach_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data ?? { pace: 'balanced', last_pace_change_at: null } })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const parsed = settingsSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const db = serviceClient()
  const { data: current, error: currentError } = await db.from('coach_reward_settings').select('pace, last_pace_change_at').eq('coach_id', user.id).maybeSingle()
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 })
  if (current && current.pace !== parsed.data.pace && Date.now() - new Date(current.last_pace_change_at).getTime() < MIN_CHANGE_MS) {
    return NextResponse.json({ error: 'Le rythme peut être modifié une fois toutes les 4 semaines.' }, { status: 409 })
  }
  const { data, error } = await db.from('coach_reward_settings').upsert({ coach_id: user.id, pace: parsed.data.pace, last_pace_change_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select('pace, last_pace_change_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!current || current.pace !== parsed.data.pace) {
    await db.from('coach_reward_pace_changes').insert({ coach_id: user.id, previous_pace: current?.pace ?? null, next_pace: parsed.data.pace })
  }
  return NextResponse.json({ settings: data })
}
