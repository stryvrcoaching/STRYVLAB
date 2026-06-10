import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/clients/[clientId]/meal-logs?date=YYYY-MM-DD&page=0&limit=20
export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ownership } = await service()
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()
  if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const dateFilter = url.searchParams.get('date')
  const page = parseInt(url.searchParams.get('page') ?? '0', 10)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100)

  let query = service()
    .from('meal_logs')
    .select('*', { count: 'exact' })
    .eq('client_id', params.clientId)
    .order('logged_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (dateFilter) {
    query = query
      .gte('logged_at', `${dateFilter}T00:00:00.000Z`)
      .lte('logged_at', `${dateFilter}T23:59:59.999Z`)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit })
}
