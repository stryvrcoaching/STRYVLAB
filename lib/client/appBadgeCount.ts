import type { SupabaseClient } from '@supabase/supabase-js'

import { buildChatTodayStrip } from '@/lib/client/chat/today-strip'
import { getClientInboxUnreadCount } from '@/lib/client/inbox'

/** The sole count shown on the installed-app icon. */
export async function getClientAppBadgeCount(
  db: SupabaseClient,
  clientId: string,
): Promise<number> {
  const [inbox, todayStrip] = await Promise.all([
    getClientInboxUnreadCount(db, '', clientId),
    buildChatTodayStrip(db, clientId),
  ])

  return inbox.total + (todayStrip.checkin.pendingCount ?? 0)
}
