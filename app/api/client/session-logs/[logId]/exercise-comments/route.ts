import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

const bodySchema = z.object({
  program_exercise_id: z.string().uuid().nullable().optional(),
  exercise_key: z.string().trim().min(1).max(300),
  exercise_name: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(2000),
})

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function PUT(req: NextRequest, { params }: { params: { logId: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, 'id, coach_id, first_name, last_name')
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })

  const { data: log } = await db.from('client_session_logs')
    .select('id, session_name').eq('id', params.logId).eq('client_id', client.id).maybeSingle()
  if (!log) return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })

  const { data, error } = await db.from('client_session_exercise_comments').upsert({
    session_log_id: params.logId,
    client_id: client.id,
    ...parsed.data,
  }, { onConflict: 'session_log_id,exercise_key' }).select('id, body, updated_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const coachId = typeof client.coach_id === 'string' ? client.coach_id : null
  if (coachId) {
    const payload = {
      session_log_id: params.logId,
      exercise_comment_id: data.id,
      action_url: `/coach/clients/${client.id}/data/performances?session_log=${params.logId}`,
    }
    const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Le client'
    const body = `${clientName} a laissé un commentaire sur « ${parsed.data.exercise_name} »${log.session_name ? ` dans « ${log.session_name} »` : ''}.`
    const { data: existing } = await db.from('coach_notifications')
      .select('id').eq('coach_id', coachId).eq('status', 'pending')
      .contains('payload', { exercise_comment_id: data.id }).maybeSingle()

    if (existing) {
      await db.from('coach_notifications').update({ body, payload }).eq('id', existing.id)
    } else {
      await db.from('coach_notifications').insert({
        coach_id: coachId,
        client_id: client.id,
        category: 'training',
        subcategory: 'exercise_comment',
        priority: 3,
        status: 'pending',
        email_sent: false,
        title: 'Nouveau commentaire client',
        body,
        payload,
      })
    }
  }

  return NextResponse.json({ comment: data })
}
