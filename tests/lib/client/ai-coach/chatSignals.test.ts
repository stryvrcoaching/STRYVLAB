import { describe, it, expect } from 'vitest'
import { computeDailySignals } from '@/lib/client/ai-coach/chatSignals'

describe('chatSignals', () => {
  it('computes correct percentages', () => {
    const signals = computeDailySignals({
      targetKcal: 2000,
      targetProtein: 150,
      targetWaterMl: 2500,
      totalKcal: 1000,
      totalProtein: 75,
      totalWaterMl: 2500,
      bilans: [],
      checkinsPast3Days: [],
      session: null
    })

    expect(signals.caloriesPct).toBe(50)
    expect(signals.proteinPct).toBe(50)
    expect(signals.hydrationPct).toBe(100)
    expect(signals.missingMeals).toBe(false)
    expect(signals.hasCompletedSession).toBe(false)
  })

  it('handles zero targets without Infinity', () => {
    const signals = computeDailySignals({
      targetKcal: 0,
      targetProtein: 0,
      targetWaterMl: 0,
      totalKcal: 1000,
      totalProtein: 75,
      totalWaterMl: 2500,
      bilans: [],
      checkinsPast3Days: [],
      session: { completed_at: '2026-05-28T10:00:00Z' }
    })

    expect(signals.caloriesPct).toBe(0)
    expect(signals.proteinPct).toBe(0)
    expect(signals.hydrationPct).toBe(0)
    expect(signals.missingMeals).toBe(false)
    expect(signals.hasCompletedSession).toBe(true)
  })

  it('computes energy trend', () => {
    const signals = computeDailySignals({
      targetKcal: 2000,
      targetProtein: 150,
      targetWaterMl: 2500,
      totalKcal: 1000,
      totalProtein: 75,
      totalWaterMl: 2500,
      bilans: [],
      checkinsPast3Days: [
        { date: '2026-05-26', energy_level: 2 },
        { date: '2026-05-27', energy_level: 3 },
        { date: '2026-05-28', energy_level: 4 }
      ],
      session: null
    })

    expect(signals.energyTrend).toBe('improving')
  })

  it('computes weight delta', () => {
    const signals = computeDailySignals({
      targetKcal: 2000,
      targetProtein: 150,
      targetWaterMl: 2500,
      totalKcal: 1000,
      totalProtein: 75,
      totalWaterMl: 2500,
      bilans: [
        { assessment_responses: [{ field_key: 'weight_kg', value_number: 80 }] },
        { assessment_responses: [{ field_key: 'weight_kg', value_number: 78 }] }
      ],
      checkinsPast3Days: [],
      session: null
    })

    expect(signals.weightDelta7d).toBe(-2)
  })
})
