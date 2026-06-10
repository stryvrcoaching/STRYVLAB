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

const updateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  body: z.string().max(5000).optional().nullable(),
  event_type: z.enum(['program_change', 'injury', 'travel', 'nutrition', 'note', 'lab_protocol']).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; annotationId: string }> }
) {
  const { clientId, annotationId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = updateSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.issues.map((i) => i.message).join(', ') }, { status: 400 })

  const db = serviceClient()
  const { data, error } = await db
    .from('metric_annotations')
    .update(body.data)
    .eq('id', annotationId)
    .eq('client_id', clientId)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; annotationId: string }> }
) {
  const { clientId, annotationId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const { error } = await db
    .from('metric_annotations')
    .delete()
    .eq('id', annotationId)
    .eq('client_id', clientId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
