import { computePhysiologicalDateInTimezone } from '@/lib/client/checkin/timeWindows'

export type InitMessageRow = {
  id: string
  message_type: string
  created_at: string
  metadata?: Record<string, unknown> | null
}

function isInteractiveMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  const component = metadata?.component
  return component === 'chips' || component === 'slider' || component === 'number' || component === 'time'
}

export function hasPendingInteractivePrompt(
  rows: Array<Pick<InitMessageRow, 'metadata'>>,
): boolean {
  return rows.some((row) => {
    const metadata = row.metadata ?? null
    if (!isInteractiveMetadata(metadata)) return false
    return metadata.answered !== true
  })
}

export function hasPendingInteractivePromptForFlow(
  rows: Array<Pick<InitMessageRow, 'metadata'>>,
  flowType: 'morning' | 'evening',
): boolean {
  return hasPendingInteractivePrompt(rows.filter((row) => (
    (row.metadata ?? {}).flow_type === flowType
  )))
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
