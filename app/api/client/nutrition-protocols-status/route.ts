import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/client/nutrition-protocols-status
// Fetch unviewed shared nutrition protocols for the authenticated client
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  // Find client by user_id
  const { data: cc } = await db
    .from('coach_clients')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .single()

  if (!cc) {
    return NextResponse.json({ client: null, unviewedProtocols: [] })
  }

  // Fetch unviewed shared protocols
  const { data: protocols } = await db
    .from('nutrition_protocols')
    .select('id, name, updated_at')
    .eq('client_id', cc.id)
    .eq('status', 'shared')
    .is('viewed_by_client_at', null)
    .order('updated_at', { ascending: false })

  return NextResponse.json({
    client: cc,
    unviewedProtocols: protocols ?? [],
  })
}

// PATCH /api/client/nutrition-protocols-status
// Mark a protocol as viewed by client
export async function PATCH(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { protocolId } = await req.json()
  if (!protocolId) {
    return NextResponse.json({ error: 'protocolId required' }, { status: 400 })
  }

  const db = serviceClient()

  // Find client by user_id
  const { data: cc } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!cc) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Update protocol viewed_by_client_at
  const { data, error } = await db
    .from('nutrition_protocols')
    .update({ viewed_by_client_at: new Date().toISOString() })
    .eq('id', protocolId)
    .eq('client_id', cc.id)
    .select()
    .single()

  if (error || !data) {
    console.error('PATCH /api/client/nutrition-protocols-status:', error)
    return NextResponse.json({ error: 'Failed to update protocol' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
