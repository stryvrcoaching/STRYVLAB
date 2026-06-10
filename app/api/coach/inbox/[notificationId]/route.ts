import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const patchSchema = z.object({
  status: z.enum(['acknowledged', 'resolved']),
})

// PATCH /api/coach/inbox/[notificationId] — acknowledge ou resolve
export async function PATCH(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = patchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const db = service()

  // Vérifier ownership avant update
  const { data: notif } = await db
    .from('coach_notifications')
    .select('id')
    .eq('id', params.notificationId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!notif) return NextResponse.json({ error: 'Notification introuvable' }, { status: 404 })

  const { error } = await db
    .from('coach_notifications')
    .update({ status: body.data.status, updated_at: new Date().toISOString() })
    .eq('id', params.notificationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE /api/coach/inbox/[notificationId] — dismiss définitif
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  // Ownership check
  const { data: notif } = await db
    .from('coach_notifications')
    .select('id')
    .eq('id', params.notificationId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!notif) return NextResponse.json({ error: 'Notification introuvable' }, { status: 404 })

  const { error } = await db
    .from('coach_notifications')
    .delete()
    .eq('id', params.notificationId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
