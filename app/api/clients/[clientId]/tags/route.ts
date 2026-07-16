import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { coachOwnsClient } from '@/lib/security/client-resource-access'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string } }
const idSchema = z.string().uuid()

async function requireOwnedClient(db: ReturnType<typeof serviceClient>, coachId: string, clientId: string) {
  if (!idSchema.safeParse(clientId).success) return false
  return coachOwnsClient({ db, coachUserId: coachId, clientId })
}

async function coachOwnsTag(db: ReturnType<typeof serviceClient>, coachId: string, tagId: string) {
  if (!idSchema.safeParse(tagId).success) return false

  const { data } = await db
    .from('coach_tags')
    .select('id')
    .eq('id', tagId)
    .eq('coach_id', coachId)
    .maybeSingle()

  return Boolean(data)
}

// GET /api/clients/[clientId]/tags
export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = serviceClient()
  if (!(await requireOwnedClient(db, user.id, params.clientId))) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  const { data, error } = await db
    .from('client_tags')
    .select('tag:coach_tags(*)')
    .eq('client_id', params.clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tags: data.map((r: { tag: unknown }) => r.tag) })
}

// POST /api/clients/[clientId]/tags — add a tag to a client
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const parsed = z.object({ tag_id: z.string().uuid() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'tag_id invalide' }, { status: 400 })

  const db = serviceClient()
  const [ownsClient, ownsTag] = await Promise.all([
    requireOwnedClient(db, user.id, params.clientId),
    coachOwnsTag(db, user.id, parsed.data.tag_id),
  ])
  if (!ownsClient || !ownsTag) {
    return NextResponse.json({ error: 'Ressource introuvable' }, { status: 404 })
  }

  const { error } = await db
    .from('client_tags')
    .insert({ client_id: params.clientId, tag_id: parsed.data.tag_id })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Tag déjà assigné' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true }, { status: 201 })
}

// DELETE /api/clients/[clientId]/tags?tag_id=xxx — remove a tag from a client
export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tagId = searchParams.get('tag_id')
  if (!tagId || !idSchema.safeParse(tagId).success) {
    return NextResponse.json({ error: 'tag_id invalide' }, { status: 400 })
  }

  const db = serviceClient()
  const [ownsClient, ownsTag] = await Promise.all([
    requireOwnedClient(db, user.id, params.clientId),
    coachOwnsTag(db, user.id, tagId),
  ])
  if (!ownsClient || !ownsTag) {
    return NextResponse.json({ error: 'Ressource introuvable' }, { status: 404 })
  }

  const { error } = await db
    .from('client_tags')
    .delete()
    .eq('client_id', params.clientId)
    .eq('tag_id', tagId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
