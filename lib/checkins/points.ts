export type ActionType = 'checkin' | 'checkin_late' | 'session' | 'bilan' | 'meal'

export const POINTS_BY_ACTION: Record<ActionType, number> = {
  checkin: 10,
  checkin_late: 5,
  session: 25,
  bilan: 20,
  meal: 3,
}

export type Level = 'bronze' | 'silver' | 'gold' | 'platinum'

export const LEVEL_THRESHOLDS: { level: Level; min: number }[] = [
  { level: 'platinum', min: 700 },
  { level: 'gold', min: 300 },
  { level: 'silver', min: 100 },
  { level: 'bronze', min: 0 },
]

export function getLevelFromPoints(totalPoints: number): Level {
  for (const { level, min } of LEVEL_THRESHOLDS) {
    if (totalPoints >= min) return level
  }
  return 'bronze'
}

export function getPointsForAction(actionType: ActionType): number {
  return POINTS_BY_ACTION[actionType]
}
