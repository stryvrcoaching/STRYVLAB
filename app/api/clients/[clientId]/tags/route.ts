import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string } }

// GET /api/clients/[clientId]/tags
export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await serviceClient()
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

  const { tag_id } = await req.json()
  if (!tag_id) return NextResponse.json({ error: 'tag_id requis' }, { status: 400 })

  const { error } = await serviceClient()
    .from('client_tags')
    .insert({ client_id: params.clientId, tag_id })

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
  if (!tagId) return NextResponse.json({ error: 'tag_id requis' }, { status: 400 })

  const { error } = await serviceClient()
    .from('client_tags')
    .delete()
    .eq('client_id', params.clientId)
    .eq('tag_id', tagId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
