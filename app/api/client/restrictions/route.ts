import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const createSchema = z.object({
  bodyPart: z.string().min(1).max(50),
  severity: z.enum(['avoid', 'limit', 'monitor']),
  label: z.string().min(1).max(200),
  note: z.string().max(5000).optional().nullable(),
  annotationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

async function resolveClient(db: ReturnType<typeof serviceClient>, userId: string): Promise<{ clientId: string; coachId: string } | null> {
  const { data } = await db
    .from('coach_clients')
    .select('id, coach_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  return { clientId: data.id, coachId: data.coach_id }
}

export async function GET(_req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const client = await resolveClient(db, user.id)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const { clientId } = client

  const { data, error } = await db
    .from('metric_annotations')
    .select('id, label, body, body_part, severity, event_date')
    .eq('client_id', clientId)
    .eq('event_type', 'injury')
    .not('body_part', 'is', null)
    .order('event_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 })

  const db = serviceClient()
  const client = await resolveClient(db, user.id)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const { clientId, coachId } = client

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await db
    .from('metric_annotations')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      event_type: 'injury',
      label: parsed.data.label,
      body: parsed.data.note ?? null,
      body_part: parsed.data.bodyPart,
      severity: parsed.data.severity,
      event_date: parsed.data.annotationDate ?? today,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
