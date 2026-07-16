import { describe, expect, it } from 'vitest'
import {
  findPersonalRecord,
  hasReachedWeeklyGoal,
  isWeeklyGoalAtRisk,
  weekStartFromDateKey,
} from '@/lib/client/progression-notifications'

describe('progression notifications', () => {
  it('starts weekly targets on Monday', () => {
    expect(weekStartFromDateKey('2026-07-19', 0)).toBe('2026-07-13')
    expect(weekStartFromDateKey('2026-07-16', 4)).toBe('2026-07-13')
  })

  it('only marks a weekly goal as reached at its configured threshold', () => {
    expect(hasReachedWeeklyGoal(2, 3)).toBe(false)
    expect(hasReachedWeeklyGoal(3, 3)).toBe(true)
    expect(hasReachedWeeklyGoal(4, null)).toBe(false)
  })

  it('only flags configured weekly goals that are not yet complete', () => {
    expect(isWeeklyGoalAtRisk(1, 3)).toBe(true)
    expect(isWeeklyGoalAtRisk(3, 3)).toBe(false)
    expect(isWeeklyGoalAtRisk(0, null)).toBe(false)
  })

  it('finds a record only when it improves an existing exercise history', () => {
    const record = findPersonalRecord(
      [{ exerciseId: 'squat', exerciseName: 'Squat', weightKg: 105, reps: 8 }],
      [{ exerciseId: 'squat', exerciseName: 'Squat', weightKg: 100, reps: 10 }],
    )

    expect(record).toMatchObject({ exerciseName: 'Squat', weightKg: 105, reps: 8 })
  })

  it('does not notify for a first logged set or a non-improving set', () => {
    expect(findPersonalRecord(
      [{ exerciseId: 'squat', exerciseName: 'Squat', weightKg: 100, reps: 8 }],
      [],
    )).toBeNull()

    expect(findPersonalRecord(
      [{ exerciseId: 'squat', exerciseName: 'Squat', weightKg: 100, reps: 8 }],
      [{ exerciseId: 'squat', exerciseName: 'Squat', weightKg: 100, reps: 10 }],
    )).toBeNull()
  })
})
