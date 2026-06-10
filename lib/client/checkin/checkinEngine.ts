import {
  activeWindowAt,
  type CheckinFlowType,
} from '@/lib/client/checkin/timeWindows'
import {
  getPendingSlots,
  type CompletedSession,
  type PendingSlot,
} from '@/lib/client/checkin/pendingCheckins'

export type { CompletedSession, PendingSlot }

/**
 * Which check-in to open from the top bar (timezone-aware windows, max 2 backlog).
 */
export function determineSlotForClick(
  now: Date,
  timezone: string,
  sessions: CompletedSession[],
): PendingSlot | null {
  const pending = getPendingSlots(now, timezone, sessions)
  if (pending.length === 0) return null

  const window = activeWindowAt(now, timezone)

  if (window === 'evening') {
    return pending.find(p => p.flow_type === 'evening') ?? pending[pending.length - 1] ?? null
  }

  if (window === 'morning') {
    return pending.find(p => p.flow_type === 'morning') ?? pending[pending.length - 1] ?? null
  }

  return pending[0] ?? null
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
): boolean {
  const window = activeWindowAt(now, timezone)
  if (window !== flowType) return false

  const pending = getPendingSlots(now, timezone, sessions)
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
