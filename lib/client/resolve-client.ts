import { SupabaseClient } from '@supabase/supabase-js'

export interface ResolvedClient {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  timezone?: string
  [key: string]: unknown
}

/**
 * Resolve a coach_clients row from auth user.
 * 1. Try user_id match (normal login)
 * 2. Fallback: email match + auto-link user_id (first magic link login)
 */
export async function resolveClientFromUser(
  userId: string,
  email: string | undefined,
  service: SupabaseClient,
  select = 'id'
): Promise<ResolvedClient | null> {
  const selection = select.includes('timezone') ? select : `${select}, timezone`

  const { data: clientById } = await service
    .from('coach_clients')
    .select(selection)
    .eq('user_id', userId)
    .single()

  let client = clientById as unknown as ResolvedClient | null

  if (!client && email) {
    const { data: byEmail } = await service
      .from('coach_clients')
      .select(selection)
      .eq('email', email)
      .is('user_id', null)
      .single()

    if (byEmail) {
      const resolved = byEmail as unknown as ResolvedClient
      await service
        .from('coach_clients')
        .update({ user_id: userId })
        .eq('id', resolved.id)
      client = resolved
    }
  }

  return client
}
