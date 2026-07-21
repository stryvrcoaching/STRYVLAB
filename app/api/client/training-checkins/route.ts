import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

const schema = z.object({
  session_log_id: z.string().uuid().optional(),
  flex_session_id: z.string().uuid().optional(),
  phase: z.enum(['pre', 'post']),
  readiness: z.number().int().min(1).max(10).optional(),
  exertion: z.number().int().min(1).max(10).optional(),
  discomfort_level: z.number().int().min(0).max(3).default(0),
  discomfort_area: z.string().trim().max(120).nullable().optional(),
}).refine((value) => Boolean(value.session_log_id) !== Boolean(value.flex_session_id), 'Une séance est requise')

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  const value = parsed.data
  if ((value.phase === 'pre' && value.readiness === undefined) || (value.phase === 'post' && value.exertion === undefined)) {
    return NextResponse.json({ error: 'Ressenti requis' }, { status: 400 })
  }

  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const { data, error } = await db.from('training_session_checkins').upsert({
    client_id: client.id,
    ...value,
    discomfort_area: value.discomfort_level > 0 ? value.discomfort_area ?? null : null,
  }, { onConflict: value.session_log_id ? 'session_log_id,phase' : 'flex_session_id,phase' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ checkin: data }, { status: 201 })
}
