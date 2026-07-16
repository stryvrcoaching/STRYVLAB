import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { nextWeeklyRun } from '@/lib/assessments/automation'

function db() { return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function PATCH(req: NextRequest, { params }: { params: { automationId: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const body = await req.json()
  const id = params.automationId
  const service = db()
  const { data: current } = await service.from('assessment_automations').select('*').eq('id', id).eq('coach_id', user.id).single()
  if (!current) return NextResponse.json({ error: 'Automatisation introuvable' }, { status: 404 })
  const updates: Record<string, unknown> = {}
  if (body.status) updates.status = body.status
  if (body.day_of_week !== undefined) updates.day_of_week = Number(body.day_of_week)
  if (body.send_time) updates.send_time = body.send_time
  if (body.timezone) updates.timezone = body.timezone
  if (body.ends_on !== undefined) updates.ends_on = body.ends_on || null
  if (body.status === 'active' || body.day_of_week !== undefined || body.send_time || body.timezone) {
    updates.next_run_at = nextWeeklyRun({
      dayOfWeek: Number(updates.day_of_week ?? current.day_of_week),
      time: String(updates.send_time ?? current.send_time).slice(0, 5),
      timezone: String(updates.timezone ?? current.timezone),
      startsOn: String(current.starts_on),
    })
  }
  const { data, error } = await service.from('assessment_automations').update(updates).eq('id', id).eq('coach_id', user.id).select('*, template:assessment_templates(id, name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ automation: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { automationId: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { error } = await db().from('assessment_automations').delete().eq('id', params.automationId).eq('coach_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
