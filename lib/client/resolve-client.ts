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
  const normalizedEmail = email?.trim().toLowerCase()

  const { data: clientById, error: clientByIdError } = await service
    .from('coach_clients')
    .select(selection)
    .eq('user_id', userId)
    .maybeSingle()

  if (clientByIdError) {
    console.error(`[resolve-client] error looking up client by user_id=${userId}:`, clientByIdError)
  }

  let client = clientById as unknown as ResolvedClient | null

  if (client) {
    return client
  }

  await service
    .from('coach_profiles')
    .select('id')
    .eq('coach_id', userId)
    .maybeSingle()

  // Permettre aussi aux coachs de se relier a un compte client de test via leur email.
  // Le fallback reste borne a une correspondance email exacte sur coach_clients.
  if (!client && normalizedEmail) {
    const { data: byEmail } = await service
      .from('coach_clients')
      .select(selection)
      .ilike('email', normalizedEmail)
      .limit(1)
      .maybeSingle()

    if (byEmail) {
      const resolved = byEmail as unknown as ResolvedClient
      if (resolved.user_id !== userId) {
        await service
          .from('coach_clients')
          .update({ user_id: userId })
          .eq('id', resolved.id)
      }
      client = resolved
    }
  }

  return client
}
