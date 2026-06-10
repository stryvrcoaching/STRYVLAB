import { computePhysiologicalDateInTimezone } from '@/lib/client/checkin/timeWindows'

export type InitMessageRow = {
  id: string
  message_type: string
  created_at: string
  metadata?: Record<string, unknown> | null
}

export function hasInteractiveCheckinInit(row: InitMessageRow | null | undefined): boolean {
  const meta = (row?.metadata ?? {}) as Record<string, unknown>
  return meta.key === 'checkin_ready' && (meta.flow_type === 'morning' || meta.flow_type === 'evening')
}

export function shouldUpgradeInitMessageToInteractiveCheckin(
  row: InitMessageRow | null | undefined,
  shouldPromptCheckin: boolean,
): boolean {
  return shouldPromptCheckin && !hasInteractiveCheckinInit(row)
}

export function findExistingInitMessageForDate(
  rows: InitMessageRow[],
  messageType: string,
  timezone: string,
  physiologicalDate: string,
): InitMessageRow | undefined {
  return rows.find((row) => {
    if (row.message_type !== messageType) return false
    const createdAt = new Date(row.created_at)
    if (Number.isNaN(createdAt.getTime())) return false
    return computePhysiologicalDateInTimezone(createdAt, timezone) === physiologicalDate
  })
}
