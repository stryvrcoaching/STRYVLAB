export type SessionSetLogRow = {
  completed?: boolean
  actual_reps?: number | null
}

export type SessionLogListRow = {
  id: string
  session_name: string
  logged_at: string
  completed_at: string | null
  client_set_logs?: SessionSetLogRow[] | null
}

export function isEffectiveSet(s: SessionSetLogRow): boolean {
  return !!s.completed || s.actual_reps != null
}

export function isMeaningfulSession(log: SessionLogListRow): boolean {
  if (log.completed_at) return true
  return (log.client_set_logs ?? []).some(isEffectiveSet)
}

export function isCompletedSession(log: SessionLogListRow): boolean {
  return !!log.completed_at
}

export type SessionStatusFilter = 'all' | 'completed' | 'incomplete'

export function filterSessionsByStatus(
  logs: SessionLogListRow[],
  status: SessionStatusFilter,
): SessionLogListRow[] {
  if (status === 'completed') return logs.filter(isCompletedSession)
  if (status === 'incomplete') return logs.filter((l) => !isCompletedSession(l))
  return logs
}
