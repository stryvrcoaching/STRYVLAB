import type { CoachPlan } from '@/lib/billing/plans'
import type { CoachTrialOnboardingEmailKey, CoachTrialProgress } from '@/lib/email/coach-trial-onboarding'

export const COACH_TRIAL_EMAIL_SEQUENCE: Array<{ key: CoachTrialOnboardingEmailKey; day: number }> = [
  { key: 'setup', day: 3 },
  { key: 'workflow', day: 6 },
  { key: 'progress', day: 10 },
  { key: 'trial_ending', day: 13 },
]

export function getTrialDay(trialStartedAt: string | Date, now = new Date()) {
  const startedAt = new Date(trialStartedAt)
  const elapsed = now.getTime() - startedAt.getTime()
  return Math.max(0, Math.floor(elapsed / (24 * 60 * 60 * 1000)))
}

export function getNextDueCoachTrialEmail(
  trialDay: number,
  sentKeys: Iterable<CoachTrialOnboardingEmailKey>,
) {
  const sent = new Set(sentKeys)
  return COACH_TRIAL_EMAIL_SEQUENCE.find(({ key, day }) => trialDay >= day && !sent.has(key)) ?? null
}

export type CoachTrialEmailCandidate = {
  coachId: string
  email: string
  coachName: string | null
  plan: CoachPlan
  trialStartedAt: string
  trialEndsAt: string
  progress: CoachTrialProgress
}
