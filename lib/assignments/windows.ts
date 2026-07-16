import { computePhysiologicalDateInTimezone } from '@/lib/client/checkin/timeWindows'

export type AssignmentWindow = {
  started_at: string
  ended_at: string | null
}

export function overlapsAssignmentWindow(
  assignment: AssignmentWindow,
  rangeStartIso: string,
  rangeEndIso: string,
) {
  const assignmentStart = new Date(assignment.started_at).getTime()
  const assignmentEnd = assignment.ended_at
    ? new Date(assignment.ended_at).getTime()
    : Number.POSITIVE_INFINITY
  const rangeStart = new Date(rangeStartIso).getTime()
  const rangeEnd = new Date(rangeEndIso).getTime()

  return assignmentStart <= rangeEnd && assignmentEnd >= rangeStart
}

export function isTimestampInsideAssignment(
  timestampIso: string,
  assignment: AssignmentWindow,
) {
  const timestamp = new Date(timestampIso).getTime()
  const assignmentStart = new Date(assignment.started_at).getTime()
  const assignmentEnd = assignment.ended_at
    ? new Date(assignment.ended_at).getTime()
    : Number.POSITIVE_INFINITY

  return timestamp >= assignmentStart && timestamp <= assignmentEnd
}

export function isDateKeyInsideAssignment(
  dateKey: string,
  assignment: AssignmentWindow,
  timezone: string,
  todayDateKey: string,
) {
  const startDateKey = computePhysiologicalDateInTimezone(new Date(assignment.started_at), timezone)
  const endDateKey = assignment.ended_at
    ? computePhysiologicalDateInTimezone(new Date(assignment.ended_at), timezone)
    : todayDateKey

  return dateKey >= startDateKey && dateKey <= endDateKey
}
