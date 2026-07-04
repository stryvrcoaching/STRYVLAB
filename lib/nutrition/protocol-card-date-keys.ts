import { addDaysToDateKey, computePhysiologicalDateInTimezone } from '@/lib/client/checkin/timeWindows'

export type ProtocolCardDateKeyInput = {
  protocol: {
    id?: string | null
    schedule_start_date?: string | null
  }
  assignment?: {
    started_at?: string | null
    ended_at?: string | null
  } | null
  referenceDateKey: string
  timezone: string
}

export function buildTrailingDateKeys(startDate: string, endDate: string) {
  const keys: string[] = []
  let cursor = endDate
  while (cursor >= startDate) {
    keys.unshift(cursor)
    cursor = addDaysToDateKey(cursor, -1)
  }
  return keys
}

export function buildProtocolDateKeysForAnalytics({
  protocol,
  assignment,
  referenceDateKey,
  timezone,
}: ProtocolCardDateKeyInput) {
  const scheduleStartDate = String(protocol.schedule_start_date ?? '').trim()
  const reference = String(referenceDateKey ?? '').trim()
  const fallbackStart = scheduleStartDate || reference

  if (!assignment?.started_at) {
    return buildTrailingDateKeys(fallbackStart, reference)
  }

  const startDate = computePhysiologicalDateInTimezone(new Date(assignment.started_at), timezone)
  const endDate = assignment.ended_at
    ? computePhysiologicalDateInTimezone(new Date(assignment.ended_at), timezone)
    : reference

  return buildTrailingDateKeys(startDate, endDate)
}
