import type { SupabaseClient } from '@supabase/supabase-js'

export type ProgressionAction = 'training' | 'nutrition' | 'checkin' | 'checkin_late' | 'assessment' | 'milestone'

export type ProgressionAward = {
  clientId: string
  action: ProgressionAction
  basePoints: number
  sourceKey: string
  referenceId?: string | null
  occurredAt?: string
  metadata?: Record<string, unknown>
}

export type ProgressionAwardResult = {
  awarded_points: number
  total_points: number
  level: string
  wallet_points: number
  already_awarded: boolean
}

export type ProgressionLevel =
  | 'starter'
  | 'metal'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'master'
  | 'olympian'

export const PROGRESSION_LEVELS = [
  { level: 'starter', min: 0 },
  { level: 'metal', min: 25 },
  { level: 'bronze', min: 150 },
  { level: 'silver', min: 350 },
  { level: 'gold', min: 700 },
  { level: 'platinum', min: 1500 },
  { level: 'diamond', min: 3000 },
  { level: 'master', min: 4500 },
  { level: 'olympian', min: 6500 },
] as const satisfies ReadonlyArray<{ level: ProgressionLevel; min: number }>

export const PROGRESSION_LEVEL_COLORS: Record<ProgressionLevel, string> = {
  starter: '#a19d94',
  metal: '#aaa8a2',
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  platinum: '#e5e4e2',
  diamond: '#b9f2ff',
  master: '#c99cff',
  olympian: '#ffb347',
}

export function getProgressionSummary(totalPoints: number) {
  const safeTotal = Math.max(0, Math.round(Number(totalPoints) || 0))
  const currentIndex = PROGRESSION_LEVELS.reduce(
    (matchedIndex, rank, index) => (safeTotal >= rank.min ? index : matchedIndex),
    0,
  )
  const current = PROGRESSION_LEVELS[currentIndex]
  const next = PROGRESSION_LEVELS[currentIndex + 1] ?? null
  const progressPercent = next
    ? Math.max(0, Math.min(100, ((safeTotal - current.min) / (next.min - current.min)) * 100))
    : 100

  return {
    level: current.level,
    currentLevelMin: current.min,
    nextLevelMin: next?.min ?? current.min,
    nextLevelName: next?.level,
    isMaxLevel: !next,
    progressPercent,
  }
}

export async function awardProgression(
  db: SupabaseClient,
  award: ProgressionAward,
): Promise<ProgressionAwardResult | null> {
  const { data, error } = await db.rpc('award_client_progression', {
    p_client_id: award.clientId,
    p_action_type: award.action,
    p_base_points: Math.max(0, Math.round(award.basePoints)),
    p_source_key: award.sourceKey,
    p_reference_id: award.referenceId ?? null,
    p_occurred_at: award.occurredAt ?? new Date().toISOString(),
    p_metadata: award.metadata ?? {},
  })

  if (error) throw new Error(`Unable to award progression: ${error.message}`)
  return Array.isArray(data) ? data[0] ?? null : data
}

export const WEEKLY_PROGRESS_REFERENCE = {
  training: 45,
  nutrition: 45,
  checkins: 10,
} as const

export function trainingPointsForPrescribedSessions(sessionCount: number) {
  return sessionCount > 0 ? Math.max(1, Math.round(WEEKLY_PROGRESS_REFERENCE.training / sessionCount)) : 0
}

export function trainingPointsForCompletedSets(
  completedSetCount: number,
  plannedSetCount: number,
  prescribedSessionCount = 3,
) {
  const fullSessionPoints = trainingPointsForPrescribedSessions(prescribedSessionCount)
  const totalSets = Math.max(0, Math.floor(plannedSetCount))
  const completedSets = Math.max(0, Math.min(totalSets, Math.floor(completedSetCount)))

  if (totalSets === 0 || completedSets === 0) return 0

  return Math.floor(fullSessionPoints * (completedSets / totalSets))
}

export function nutritionPointsForAdherence(adherence: number) {
  const boundedAdherence = Math.max(0, Math.min(1, adherence))
  return Math.round((WEEKLY_PROGRESS_REFERENCE.nutrition / 7) * boundedAdherence)
}
