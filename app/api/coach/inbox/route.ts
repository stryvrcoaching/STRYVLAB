import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/coach/inbox
// ?summary=true  → uniquement { pending: Map<clientId, count> }
// ?count=true    → uniquement { total: number }
// (défaut)       → liste complète des notifications avec client + excerpt
export async function GET(req: Request) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const summaryMode = searchParams.get('summary') === 'true'
  const countMode   = searchParams.get('count') === 'true'
  const clientFilter = searchParams.get('client') // filtrer par client

  const db = service()

  let query = db
    .from('coach_notifications')
    .select(`
      id,
      client_id,
      chat_message_id,
      category,
      subcategory,
      title,
      body,
      payload,
      priority,
      status,
      email_sent,
      created_at,
      coach_clients!inner(id, first_name, last_name),
      chat_messages(content)
    `)
    .eq('coach_id', user.id)
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  if (clientFilter) query = query.eq('client_id', clientFilter)

  const { data: notifications, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (notifications ?? []) as any[]

  // count mode — juste le total pour le badge NavDock
  if (countMode) {
    return NextResponse.json({ total: rows.length })
  }

  // summary mode — Map<clientId, count> pour les pastilles sur la liste clients
  if (summaryMode) {
    const pending: Record<string, number> = {}
    for (const n of rows) {
      pending[n.client_id] = (pending[n.client_id] ?? 0) + 1
    }
    return NextResponse.json({ pending, total: rows.length })
  }

  // mode complet — liste enrichie pour la page Inbox
  const enriched = rows.map((n) => ({
    id: n.id,
    clientId: n.client_id,
    clientName: n.coach_clients
      ? `${n.coach_clients.first_name} ${n.coach_clients.last_name}`
      : '—',
    chatMessageId: n.chat_message_id,
    title: n.title ?? null,
    body: n.body ?? null,
    payload: (n.payload ?? null) as Record<string, unknown> | null,
    messageExcerpt: n.body
      ? String(n.body).slice(0, 200)
      : n.chat_messages?.content
      ? String(n.chat_messages.content).slice(0, 200)
      : null,
    category:    n.category as string,
    subcategory: n.subcategory as string | null,
    priority:    n.priority as number,
    status:      n.status as string,
    emailSent:   n.email_sent as boolean,
    createdAt:   n.created_at as string,
  }))

  return NextResponse.json({ notifications: enriched, total: enriched.length })
}
