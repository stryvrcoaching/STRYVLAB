import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  const { annotationId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { error } = await db
    .from('metric_annotations')
    .delete()
    .eq('id', annotationId)
    .eq('client_id', clientRow.id)
    .eq('event_type', 'injury')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
