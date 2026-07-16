export interface FeedbackPriorityInput {
  priorityUser?: 'low' | 'medium' | 'critical' | null
  status?: string | null
  occurrences?: number | null
  updatedAt?: string | null
}

const severityWeights = {
  low: 1,
  medium: 2,
  critical: 4,
} as const

export function feedbackPriorityScore(input: FeedbackPriorityInput) {
  const severity = severityWeights[input.priorityUser ?? 'low'] ?? 1
  const occurrences = Math.max(1, input.occurrences ?? 1)
  const frequencyWeight = occurrences >= 5 ? 4 : occurrences >= 3 ? 3 : occurrences >= 2 ? 2 : 1
  const backlogWeight = input.status === 'planned' ? 2 : input.status === 'reviewed' ? 3 : input.status === 'new' ? 4 : 1

  const ageHours = input.updatedAt
    ? Math.max(0, (Date.now() - new Date(input.updatedAt).getTime()) / (1000 * 60 * 60))
    : 0
  const recencyWeight = ageHours <= 24 ? 4 : ageHours <= 72 ? 3 : ageHours <= 168 ? 2 : 1

  return severity * 4 + frequencyWeight * 3 + backlogWeight * 2 + recencyWeight
}
