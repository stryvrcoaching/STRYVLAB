import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Only remove an Auth identity when the deleted client had an explicit user_id
 * and that identity is not still used elsewhere in the application.
 *
 * Any lookup failure is treated as a reason to retain the Auth account.
 * This is a safeguard, not a substitute for a dedicated erasure workflow.
 */
export async function canDeleteOrphanClientAuthUser(params: {
  db: SupabaseClient
  authUserId: string | null | undefined
  requestingCoachId: string
}): Promise<boolean> {
  const { db, authUserId, requestingCoachId } = params
  if (!authUserId || authUserId === requestingCoachId) return false

  const references: Array<{ table: string; column: string }> = [
    { table: 'coach_clients', column: 'user_id' },
    { table: 'coach_clients', column: 'coach_id' },
    { table: 'coach_profiles', column: 'coach_id' },
  ]

  for (const { table, column } of references) {
    const { data, error } = await db
      .from(table)
      .select(column)
      .eq(column, authUserId)
      .limit(1)

    // Failing closed also covers unexpected/partial query results.
    if (error || !Array.isArray(data) || data.length !== 0) return false
  }

  return true
}
