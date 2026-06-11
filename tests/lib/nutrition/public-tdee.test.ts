import { describe, expect, it } from 'vitest'
import {
  computePublicTdeePlan,
  validatePublicTdeeInput,
} from '@/lib/nutrition/public-tdee'

describe('validatePublicTdeeInput', () => {
  it('rejects missing core fields', () => {
    const issues = validatePublicTdeeInput({})
    expect(issues.map((issue) => issue.field)).toContain('gender')
    expect(issues.map((issue) => issue.field)).toContain('age')
    expect(issues.map((issue) => issue.field)).toContain('heightCm')
    expect(issues.map((issue) => issue.field)).toContain('weightKg')
    expect(issues.map((issue) => issue.field)).toContain('goal')
  })
})

describe('computePublicTdeePlan', () => {
  const baseInput = {
    gender: 'male' as const,
    age: 30,
    heightCm: 180,
    weightKg: 80,
    goal: 'deficit' as const,
    dailySteps: 8000,
    occupationMultiplier: 1,
    workoutsPerWeek: 4,
    sessionDurationMin: 60,
  }

  it('builds a complete plan with split and premium data', () => {
    const plan = computePublicTdeePlan(baseInput)

    expect(plan.result.calories).toBeGreaterThan(0)
    expect(plan.split.trainingDays).toBe(4)
    expect(plan.split.restDays).toBe(3)
    expect(plan.split.trainingDayCalories).toBeGreaterThan(plan.split.restDayCalories)
    expect(plan.split.averageCalories).toBe(plan.result.calories)
    expect(plan.split.weeklyCalories).toBe(plan.split.averageCalories * 7)
    expect(plan.confidence.label).toBeDefined()
    expect(plan.assumptions.length).toBeGreaterThan(0)
    expect(plan.guardrails.length).toBeGreaterThan(0)
    expect(plan.exportText).toContain('STRYV TDEE Expert')
    expect(plan.shareQuery).toContain('gender=male')
  })

  it('keeps a flat split when there is no training volume', () => {
    const plan = computePublicTdeePlan({
      ...baseInput,
      goal: 'maintenance',
      workoutsPerWeek: 0,
      sessionDurationMin: 0,
    })

    expect(plan.split.trainingDays).toBe(0)
    expect(plan.split.restDays).toBe(7)
    expect(plan.split.trainingDayCalories).toBe(plan.split.restDayCalories)
  })

  it('uses measured BMR when available', () => {
    const plan = computePublicTdeePlan({
      ...baseInput,
      bmrMeasuredKcal: 1900,
    })

    expect(plan.result.dataProvenance.bmrSource).toBe('measured')
    expect(plan.confidence.score).toBeGreaterThanOrEqual(60)
  })
})
