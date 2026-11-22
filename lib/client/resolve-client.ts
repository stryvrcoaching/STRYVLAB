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
 * 2. Fallback: link one unclaimed, active profile by account email.
 */
export async function resolveClientFromUser(
  userId: string,
  email: string | undefined,
  service: SupabaseClient,
  select = 'id'
): Promise<ResolvedClient | null> {
  const selection = [select, ...['timezone', 'user_id', 'status'].filter((field) => !select.includes(field))].join(', ')
  const normalizedEmail = email?.trim().toLowerCase()

  const { data: clientById, error: clientByIdError } = await service
    .from('coach_clients')
    .select(selection)
    .eq('user_id', userId)
    .neq('status', 'suspended')
    .maybeSingle()

  if (clientByIdError) {
    console.error(`[resolve-client] error looking up client by user_id=${userId}:`, clientByIdError)
  }

  let client = clientById as unknown as ResolvedClient | null

  if (client) {
    return client
  }

  // Reject ambiguous email matches and never steal an existing or suspended link.
  if (!client && normalizedEmail) {
    const { data: byEmail } = await service
      .from('coach_clients')
      .select(selection)
      .ilike('email', normalizedEmail)
      .is('user_id', null)
      .eq('status', 'active')
      .maybeSingle()

    if (byEmail) {
      const resolved = byEmail as unknown as ResolvedClient
      const { data: linked } = await service
        .from('coach_clients')
        .update({ user_id: userId })
        .eq('id', resolved.id)
        .is('user_id', null)
        .eq('status', 'active')
        .select(selection)
        .maybeSingle()
      client = linked as unknown as ResolvedClient | null
    }
  }

  return client
}
