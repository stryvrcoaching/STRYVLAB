import type { SupabaseClient } from '@supabase/supabase-js'

import { getClientInboxUnreadCount } from '@/lib/client/inbox'

/**
 * OS app icon badge = grand total of all client signals
 * (messagerie + home system + nutrition).
 */
export async function getClientAppBadgeCount(
  db: SupabaseClient,
  clientId: string,
): Promise<number> {
  const breakdown = await getClientInboxUnreadCount(db, '', clientId)
  return breakdown.total
}
