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

async function verifyOwnership(db: ReturnType<typeof serviceClient>, clientId: string, userId: string) {
  const { data } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', userId)
    .maybeSingle()
  return !!data
}

const createSchema = z.object({
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1).max(200),
  body: z.string().max(5000).nullable().optional(),
  event_type: z.enum(['program_change', 'injury', 'travel', 'nutrition', 'note', 'lab_protocol']),
  body_part: z.string().max(50).optional().nullable(),
  severity: z.enum(['avoid', 'limit', 'monitor']).optional().nullable(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const owns = await verifyOwnership(db, clientId, user.id)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db
    .from('metric_annotations')
    .select('*')
    .eq('client_id', clientId)
    .order('event_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const owns = await verifyOwnership(db, clientId, user.id)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = createSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.issues.map((i) => i.message).join(', ') }, { status: 400 })

  const { data, error } = await db
    .from('metric_annotations')
    .insert({
      client_id: clientId,
      coach_id: user.id,
      ...body.data,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
