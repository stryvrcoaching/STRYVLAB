import type { SupabaseClient } from '@supabase/supabase-js'

export type ClientAccessRow = {
  id: string
  coach_id: string | null
  user_id: string | null
}

export type ClientResourceAccess = {
  clientId: string
  role: 'coach' | 'client'
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function resolveClientAccessRole(client: ClientAccessRow, userId: string) {
  if (client.coach_id === userId) return 'coach' as const
  if (client.user_id === userId) return 'client' as const
  return null
}

export async function resolveClientResourceAccess(params: {
  db: SupabaseClient
  userId: string
  clientId: string
}): Promise<ClientResourceAccess | null> {
  if (!isUuid(params.clientId)) return null

  const { data, error } = await params.db
    .from('coach_clients')
    .select('id, coach_id, user_id')
    .eq('id', params.clientId)
    .maybeSingle()

  if (error || !data) return null

  const client = data as ClientAccessRow
  const role = resolveClientAccessRole(client, params.userId)
  if (role) return { clientId: client.id, role }

  return null
}

export async function coachOwnsClient(params: {
  db: SupabaseClient
  coachUserId: string
  clientId: string
}) {
  const access = await resolveClientResourceAccess({
    db: params.db,
    userId: params.coachUserId,
    clientId: params.clientId,
  })

  return access?.role === 'coach'
}
