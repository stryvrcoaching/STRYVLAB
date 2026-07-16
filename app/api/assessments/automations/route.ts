import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { nextWeeklyRun } from '@/lib/assessments/automation'

function db() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function auth() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const clientId = new URL(req.url).searchParams.get('client_id')
  let query = db().from('assessment_automations').select('*, template:assessment_templates(id, name)').eq('coach_id', user.id).order('created_at', { ascending: false })
  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ automations: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const body = await req.json()
  const required = ['client_id', 'template_id', 'day_of_week', 'send_time']
  if (required.some((key) => body[key] === undefined || body[key] === '')) return NextResponse.json({ error: 'Paramètres incomplets' }, { status: 400 })
  const service = db()
  const { data: client } = await service.from('coach_clients').select('id').eq('id', body.client_id).eq('coach_id', user.id).single()
  const { data: template } = await service.from('assessment_templates').select('id').eq('id', body.template_id).eq('coach_id', user.id).single()
  if (!client || !template) return NextResponse.json({ error: 'Client ou template introuvable' }, { status: 404 })
  const timezone = body.timezone || 'Europe/Brussels'
  const startsOn = body.starts_on || new Date().toISOString().slice(0, 10)
  const nextRunAt = nextWeeklyRun({ dayOfWeek: Number(body.day_of_week), time: body.send_time, timezone, startsOn })
  const { data, error } = await service.from('assessment_automations').insert({
    coach_id: user.id, client_id: body.client_id, template_id: body.template_id,
    frequency: 'weekly', day_of_week: Number(body.day_of_week), send_time: body.send_time,
    timezone, starts_on: startsOn, ends_on: body.ends_on || null, next_run_at: nextRunAt,
  }).select('*, template:assessment_templates(id, name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 409 : 500 })
  return NextResponse.json({ automation: data }, { status: 201 })
}
