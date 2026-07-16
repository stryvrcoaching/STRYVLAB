import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

export function createServiceDb(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function requireAuthedUser() {
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, error: error?.message ?? 'Non authentifié' }
  return { user, error: null }
}

export async function resolveClientForUser(userId: string, email?: string) {
  const db = createServiceDb()
  const client = await resolveClientFromUser(userId, email, db, 'id, coach_id')
  if (!client) return null
  return client as { id: string; coach_id: string | null }
}

export async function assertCoachOwnsClient(coachUserId: string, clientId: string) {
  const db = createServiceDb()
  const { data, error } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', coachUserId)
    .single()

  if (error || !data) return null
  return data as { id: string }
}
