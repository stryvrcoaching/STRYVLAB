export type ActionType = 'checkin' | 'checkin_late' | 'session' | 'bilan' | 'meal' | 'streak_bonus' | 'quest_reward'

export const POINTS_BY_ACTION: Record<ActionType, number> = {
  checkin: 10,
  checkin_late: 5,
  session: 25,
  bilan: 20,
  meal: 3,
  streak_bonus: 50,
  quest_reward: 100,
}

export type Level = 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'olympian'

export const LEVEL_THRESHOLDS: { level: Level; min: number }[] = [
  { level: 'olympian', min: 6500 },
  { level: 'master', min: 4500 },
  { level: 'diamond', min: 3000 },
  { level: 'platinum', min: 1500 },
  { level: 'gold', min: 700 },
  { level: 'silver', min: 350 },
  { level: 'bronze', min: 150 },
  { level: 'iron', min: 0 },
]

export function getLevelFromPoints(totalPoints: number): Level {
  for (const { level, min } of LEVEL_THRESHOLDS) {
    if (totalPoints >= min) return level
  }
  return 'iron'
}

export function getPointsForAction(actionType: ActionType): number {
  return POINTS_BY_ACTION[actionType]
}
