import { activeWindowAt, type CheckinFlowType } from '@/lib/client/checkin/timeWindows'
import {
  getPendingSlots,
  type CheckinAvailability,
  type CompletedSession,
  type PendingSlot,
} from '@/lib/client/checkin/pendingCheckins'

export type { CompletedSession, PendingSlot }

/**
 * Which pending check-in to open (timezone-aware, max 2 backlog).
 *
 * Slots are returned oldest first so a missed check-in is always completed before
 * a more recent one, regardless of the current morning/evening window.
 */
export function determineSlotForClick(
  now: Date,
  timezone: string,
  sessions: CompletedSession[],
  availability?: CheckinAvailability,
): PendingSlot | null {
  const pending = getPendingSlots(now, timezone, sessions, availability)
  if (pending.length === 0) return null

  return pending[0]
}

export function determineFlowForClick(
  now: Date,
  timezone: string,
  sessions: CompletedSession[],
): CheckinFlowType | null {
  return determineSlotForClick(now, timezone, sessions)?.flow_type ?? null
}

/**
 * Whether proactive init should fire now (evening 21:00+ or morning 05:00–17:00 local).
 */
export function shouldProactiveInitNow(
  now: Date,
  timezone: string,
  flowType: CheckinFlowType,
  sessions: CompletedSession[],
  availability?: CheckinAvailability,
): boolean {
  if (!availability) {
    const window = activeWindowAt(now, timezone)
    if (window !== flowType) return false
  }

  const pending = getPendingSlots(now, timezone, sessions, availability)
  return pending.some(p => p.flow_type === flowType)
}

/** @deprecated Use determineFlowForClick with timezone — kept for gradual migration */
export function determineFlow(
  currentHour: number,
  chatSessions: CompletedSession[],
): CheckinFlowType | null {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'
  const now = new Date()
  now.setHours(currentHour, 0, 0, 0)
  return determineFlowForClick(now, timezone, chatSessions)
}
