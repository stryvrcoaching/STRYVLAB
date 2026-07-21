import { describe, expect, it } from 'vitest'
import {
  activityStateFromRatio,
  buildActivityBudget,
  estimateFreeActivityKcalDay,
  estimateNeatKcalDay,
  estimateEatStrengthKcalDay,
  estimateSessionsPerWeekFromPerformance,
} from '@/lib/coach/cockpit-activity'

describe('cockpit-activity', () => {
  it('estimates NEAT from steps and weight', () => {
    // 10000 * 0.0005 * 80 = 400
    expect(estimateNeatKcalDay(10000, 80)).toBe(400)
  })

  it('estimates strength EAT from duration-MET', () => {
    const kcal = estimateEatStrengthKcalDay({
      weightKg: 80,
      sessionsPerWeek: 4,
      sessionDurationMin: 60,
      trainingTypes: ['Musculation / Powerlifting'],
    })
    // 6 MET * 80 * 1h * 4/7 ≈ 274
    expect(kcal).toBeGreaterThan(200)
    expect(kcal).toBeLessThan(350)
  })

  it('builds ratio and state from NEAT+EAT budget', () => {
    const budget = buildActivityBudget({
      weightKg: 80,
      actualSteps: 10000,
      plannedSteps: 10000,
      planStrengthSessions: 4,
      planSessionDurationMin: 60,
      planTrainingTypes: ['Musculation / Powerlifting'],
      actualStrengthSessions: 4,
    })
    expect(budget.ratio).not.toBeNull()
    expect(budget.ratio!).toBeGreaterThan(0.85)
    expect(budget.ratio!).toBeLessThan(1.15)
    expect(budget.state).toBe('aligné')
    expect(budget.reality.neatKcalDay).toBe(400)
    expect(budget.reality.eatKcalDay).toBeGreaterThan(0)
    expect(budget.plan.totalKcalDay).toBeGreaterThan(budget.plan.neatKcalDay!)
  })

  it('flags low activity when steps and sessions lag', () => {
    const budget = buildActivityBudget({
      weightKg: 80,
      actualSteps: 3000,
      plannedSteps: 10000,
      planStrengthSessions: 4,
      planSessionDurationMin: 60,
      actualStrengthSessions: 1,
    })
    expect(budget.state).toBe('à corriger')
    expect(budget.ratio!).toBeLessThan(0.6)
  })

  it('returns à compléter without plan or reality', () => {
    const budget = buildActivityBudget({ weightKg: 80 })
    expect(budget.state).toBe('à compléter')
    expect(budget.ratio).toBeNull()
  })

  it('maps ratio bands to gauge states', () => {
    expect(activityStateFromRatio(1)).toBe('aligné')
    expect(activityStateFromRatio(0.7)).toBe('à surveiller')
    expect(activityStateFromRatio(0.4)).toBe('à corriger')
    expect(activityStateFromRatio(null)).toBe('à compléter')
  })

  it('estimates sessions/week from performance analysis', () => {
    const perWeek = estimateSessionsPerWeekFromPerformance({
      analysis: {
        analysis_period_weeks: 4,
        exercises: [
          { sessions_count: 8 },
          { sessions_count: 6 },
        ],
      },
    })
    expect(perWeek).toBe(2)
  })

  it('estimates free activity kcal from activity logs', () => {
    const kcal = estimateFreeActivityKcalDay(
      [
        { activity_type: 'running', duration_min: 40, intensity: 7 },
        { activity_type: 'cycling', duration_min: 60, intensity: 5 },
      ],
      80,
      7,
    )
    expect(kcal).not.toBeNull()
    expect(kcal!).toBeGreaterThan(50)
  })

  it('includes cardio logs in EAT reality', () => {
    const budget = buildActivityBudget({
      weightKg: 80,
      actualSteps: 8000,
      plannedSteps: 8000,
      planStrengthSessions: 0,
      planCardioSessions: 3,
      planCardioDurationMin: 40,
      actualCardioSessions: 3,
      actualCardioDurationMin: 40,
    })
    expect(budget.reality.eatKcalDay).toBeGreaterThan(0)
    expect(budget.state).toBe('aligné')
  })
})
