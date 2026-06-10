import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string } }

// DELETE /api/clients/[clientId]/access — suspend client: ban Supabase account + status=suspended
export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  // Vérifier ownership
  const { data: client } = await db
    .from('coach_clients')
    .select('id, email, user_id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  // Bannir le compte Supabase si il existe (ban_duration 87600h = ~10 ans = suspension permanente).
  // Priorité : user_id stocké sur coach_clients (défini après invite).
  // Fallback : recherche par email via listUsers (perPage: 1000 pour éviter la troncature à 50).
  const clientRecord = client as { id: string; email: string | null; user_id?: string | null }

  if (clientRecord.user_id) {
    await db.auth.admin.updateUserById(clientRecord.user_id, { ban_duration: '87600h' })
  } else if (clientRecord.email) {
    const { data: usersData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const supabaseUser = usersData?.users?.find((u: { email?: string }) => u.email === clientRecord.email)
    if (supabaseUser) {
      await db.auth.admin.updateUserById(supabaseUser.id, { ban_duration: '87600h' })
    }
  }

  // Mettre à jour le statut en DB
  const { error } = await db
    .from('coach_clients')
    .update({ status: 'suspended' })
    .eq('id', params.clientId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
