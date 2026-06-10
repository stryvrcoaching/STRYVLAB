import {
  type CheckinFlowType,
  addDaysToDateKey,
  computePhysiologicalDateInTimezone,
  isWithinBacklogWindow,
} from '@/lib/client/checkin/timeWindows'

export type CompletedSession = { flow_type: string; completed_at: string | null; date?: string }

export type PendingSlot = {
  date: string
  flow_type: CheckinFlowType
}

function isCompleted(
  date: string,
  flowType: CheckinFlowType,
  sessions: CompletedSession[],
): boolean {
  return sessions.some(
    s => s.flow_type === flowType && s.completed_at != null && (s.date == null || s.date === date),
  )
}

function slotSortKey(slot: PendingSlot): string {
  return `${slot.date}:${slot.flow_type === 'morning' ? '0' : '1'}`
}

/** Up to 2 incomplete check-ins within the last 24h per slot open time. */
export function getPendingSlots(
  now: Date,
  timezone: string,
  sessions: CompletedSession[],
): PendingSlot[] {
  const todayKey = computePhysiologicalDateInTimezone(now, timezone)
  const yesterdayKey = addDaysToDateKey(todayKey, -1)

  const candidates: PendingSlot[] = []
  for (const date of [yesterdayKey, todayKey]) {
    for (const flow_type of ['morning', 'evening'] as const) {
      if (isCompleted(date, flow_type, sessions)) continue
      if (!isWithinBacklogWindow(now, date, flow_type, timezone)) continue
      candidates.push({ date, flow_type })
    }
  }

  candidates.sort((a, b) => slotSortKey(a).localeCompare(slotSortKey(b)))
  return candidates.slice(-2)
}

export function countPendingSlots(
  now: Date,
  timezone: string,
  sessions: CompletedSession[],
): number {
  return getPendingSlots(now, timezone, sessions).length
}
