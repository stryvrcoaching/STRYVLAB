import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

const noteSchema = z.object({
  exercise_key: z.string().trim().min(1).max(300),
  exercise_name: z.string().trim().min(1).max(300),
  body: z.string().trim().max(2000),
})

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function currentClient() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return resolveClientFromUser(user.id, user.email, service())
}

export async function GET(req: NextRequest) {
  const client = await currentClient()
  if (!client) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const keys = (req.nextUrl.searchParams.get('exercise_keys') ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
    .slice(0, 100)
  if (keys.length === 0) return NextResponse.json({ notes: [] })

  const { data, error } = await service()
    .from('client_exercise_notes')
    .select('exercise_key, exercise_name, body, updated_at')
    .eq('client_id', client.id)
    .in('exercise_key', keys)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data ?? [] })
}

export async function PUT(req: NextRequest) {
  const client = await currentClient()
  if (!client) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const parsed = noteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })

  const db = service()
  if (!parsed.data.body) {
    const { error } = await db.from('client_exercise_notes')
      .delete().eq('client_id', client.id).eq('exercise_key', parsed.data.exercise_key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ note: null })
  }

  const { data, error } = await db.from('client_exercise_notes').upsert({
    client_id: client.id,
    ...parsed.data,
  }, { onConflict: 'client_id,exercise_key' }).select('exercise_key, exercise_name, body, updated_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data })
}
