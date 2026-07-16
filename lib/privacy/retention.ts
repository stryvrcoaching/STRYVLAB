export const POST_CANCELLATION_ACCESS_DAYS = 90

export type CoachDataAccessMode = 'active' | 'read_only' | 'expired'

export function createPostCancellationWindow(endedAt = new Date()) {
  const exportAvailableUntil = new Date(endedAt)
  exportAvailableUntil.setUTCDate(exportAvailableUntil.getUTCDate() + POST_CANCELLATION_ACCESS_DAYS)

  return {
    billingEndedAt: endedAt.toISOString(),
    exportAvailableUntil: exportAvailableUntil.toISOString(),
    deletionScheduledAt: exportAvailableUntil.toISOString(),
  }
}

export function getCoachDataAccessMode(
  billingStatus: string | null | undefined,
  exportAvailableUntil: string | null | undefined,
  now = new Date(),
): CoachDataAccessMode {
  if (billingStatus !== 'canceled') return 'active'
  if (!exportAvailableUntil) return 'read_only'

  const deadline = new Date(exportAvailableUntil)
  if (Number.isNaN(deadline.getTime())) return 'read_only'
  return deadline > now ? 'read_only' : 'expired'
}
