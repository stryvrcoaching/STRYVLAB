export const ASSESSMENT_REMINDER_DELAY_MS = 24 * 60 * 60 * 1000

type PendingAssessment = {
  createdAt: string
  expiresAt: string | null
  status: string
}

export function isPendingAssessmentReminderDue(
  assessment: PendingAssessment,
  now = new Date(),
): boolean {
  if (assessment.status !== 'pending') return false

  const createdAt = new Date(assessment.createdAt)
  const expiresAt = assessment.expiresAt ? new Date(assessment.expiresAt) : null
  if (Number.isNaN(createdAt.getTime())) return false
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= now)) return false

  return now.getTime() >= createdAt.getTime() + ASSESSMENT_REMINDER_DELAY_MS
}
