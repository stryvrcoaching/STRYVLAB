import { describe, it, expect } from 'vitest'
import {
  normalizeBodyCompositionSignals,
  normalizeBehaviorSignals,
  normalizePerformanceSignals,
  normalizeRecoverySignals,
  buildDerivedSignals,
} from '@/lib/coach/phaseEngine/signals'
import { makeExerciseRow, makeRawInput } from './testFixtures'

const baseInput = makeRawInput()

describe('normalizeBodyCompositionSignals', () => {
  it('returns low confidence with < 2 weight points', () => {
    const result = normalizeBodyCompositionSignals({
      ...baseInput,
      weightSeries: [{ date: '2026-05-01', value: 80 }],
    })
    expect(result.weightTrend.confidence).toBeLessThan(0.4)
  })

  it('detects weight loss trend with sufficient points', () => {
    const result = normalizeBodyCompositionSignals({
      ...baseInput,
      weightSeries: [
        { date: '2026-04-01', value: 82 },
        { date: '2026-04-15', value: 81 },
        { date: '2026-05-01', value: 80 },
        { date: '2026-05-15', value: 79 },
      ],
    })
    expect(result.weightTrend.value).toBeLessThan(0)
    expect(result.weightTrend.confidence).toBeGreaterThan(0.5)
  })

  it('returns null waistTrend when no waist data', () => {
    const result = normalizeBodyCompositionSignals(baseInput)
    expect(result.waistTrend).toBeNull()
  })
})

describe('normalizeBehaviorSignals', () => {
  it('returns zero adherence with no data', () => {
    const result = normalizeBehaviorSignals(baseInput)
    expect(result.adherenceScore).toBe(0)
  })

  it('returns full adherence with 100% response rate and full sessions', () => {
    const result = normalizeBehaviorSignals({
      ...baseInput,
      checkinResponseRate: 100,
      performance: { ...baseInput.performance, sessionsCount: 12, weeklyFrequency: 3 },
    })
    expect(result.adherenceScore).toBeGreaterThan(0.85)
  })
})

describe('normalizePerformanceSignals', () => {
  it('returns low performance with stagnating exercises', () => {
    const result = normalizePerformanceSignals({
      ...baseInput,
      performance: {
        ...baseInput.performance,
        sessionsCount: 4,
        exercises: [
          makeExerciseRow({ completion_rate: 0.9, avg_rir: 3, stagnation: true }),
          makeExerciseRow({ exercise_id: 'ex-2', exercise_name: 'Row', completion_rate: 0.85, avg_rir: 3, stagnation: true }),
        ],
      },
    })
    expect(result.performanceTrend.value).toBeLessThan(0)
  })

  it('returns high performance with progressive overload', () => {
    const result = normalizePerformanceSignals({
      ...baseInput,
      performance: {
        ...baseInput.performance,
        sessionsCount: 8,
        exercises: [
          makeExerciseRow({ completion_rate: 0.95, avg_rir: 2, overloads_last_4_weeks: 3 }),
          makeExerciseRow({ exercise_id: 'ex-2', exercise_name: 'Bench', completion_rate: 0.9, avg_rir: 2, overloads_last_4_weeks: 2 }),
        ],
      },
    })
    expect(result.performanceTrend.value).toBeGreaterThan(0)
  })

  it('does not crush performance on low RIR when load is progressing', () => {
    const stagnant = normalizePerformanceSignals(
      makeRawInput({
        performance: {
          sessionsCount: 8,
          global_overreaching: false,
          weeklyFrequency: 3,
          exercises: [
            makeExerciseRow({ avg_rir: 0.5, prescribed_rir: 0, load_progressing: false, stagnation: true }),
          ],
        },
      }),
    )
    const progressing = normalizePerformanceSignals(
      makeRawInput({
        performance: {
          sessionsCount: 8,
          global_overreaching: false,
          weeklyFrequency: 3,
          exercises: [
            makeExerciseRow({
              avg_rir: 0.5,
              prescribed_rir: 0,
              intentional_intensity: true,
              load_progressing: true,
              stagnation: false,
            }),
          ],
        },
      }),
    )
    expect(progressing.performanceTrend.value).toBeGreaterThan(stagnant.performanceTrend.value)
  })
})

describe('normalizeRecoverySignals', () => {
  it('returns poor recovery with high stress and soreness', () => {
    const result = normalizeRecoverySignals({
      ...baseInput,
      checkin: { energy: 1, sleep_quality: 2, sleep_duration: 5, stress: 5, muscle_soreness: 5 },
    })
    expect(result.recoveryScore).toBeLessThan(0.4)
  })

  it('returns good recovery with optimal signals', () => {
    const result = normalizeRecoverySignals({
      ...baseInput,
      checkin: { energy: 5, sleep_quality: 4, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
    })
    expect(result.recoveryScore).toBeGreaterThan(0.75)
  })

  it('treats sleep_quality 4/4 as fully optimal', () => {
    const result = normalizeRecoverySignals({
      ...baseInput,
      checkin: { sleep_quality: 4 },
    })
    expect(result.sleepScore).toBe(1)
    expect(result.recoveryScore).toBe(1)
  })
})

describe('buildDerivedSignals', () => {
  it('returns minimal dataQuality with no data', () => {
    const result = buildDerivedSignals(baseInput)
    expect(result.dataQuality).toBe('minimal')
    expect(result.insufficientData).toBe(true)
  })

  it('catabolicRisk increases when weight drops fast + fatigue high', () => {
    const daysAgo = (n: number) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString().slice(0, 10)
    }
    const result = buildDerivedSignals({
      ...baseInput,
      weightSeries: [
        { date: daysAgo(21), value: 85 },
        { date: daysAgo(14), value: 83.5 },
        { date: daysAgo(7), value: 82 },
        { date: daysAgo(0), value: 80.5 },
      ],
      leanMassSeries: [
        { date: daysAgo(21), value: 70 },
        { date: daysAgo(14), value: 69.5 },
        { date: daysAgo(7), value: 69 },
        { date: daysAgo(0), value: 68.5 },
      ],
      checkin: { energy: 1, sleep_quality: 2, stress: 5, muscle_soreness: 5, sleep_duration: 5 },
      checkinResponseRate: 80,
    })
    expect(result.catabolicRisk.value).toBeGreaterThan(0.4)
  })

  it('uses anchorDate for signal freshness instead of wall-clock today', () => {
    const result = buildDerivedSignals({
      ...baseInput,
      anchorDate: '2026-05-29',
      weightSeries: [
        { date: '2026-05-15', value: 80 },
        { date: '2026-05-29', value: 79.5 },
      ],
    })

    expect(result.weightTrend.confidence).toBeGreaterThan(0.4)
    expect(result.dataCoverage).toBeGreaterThan(0)
  })

  it('anabolicPotential increases with good recovery + performance', () => {
    const result = buildDerivedSignals({
      ...baseInput,
      checkin: { energy: 5, sleep_quality: 4, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
      checkinResponseRate: 100,
      performance: {
        exercises: [makeExerciseRow({ completion_rate: 0.95, overloads_last_4_weeks: 3 })],
        global_overreaching: false,
        sessionsCount: 12,
        weeklyFrequency: 3,
      },
    })
    expect(result.anabolicPotential.value).toBeGreaterThan(0.5)
  })

  it('dampens subjective fatigue when progression events are active', () => {
    const baseline = buildDerivedSignals(
      makeRawInput({
        checkin: { energy: 2, sleep_quality: 2, stress: 4, muscle_soreness: 4, sleep_duration: 6 },
        checkinResponseRate: 80,
      }),
    )
    const withProgression = buildDerivedSignals(
      makeRawInput({
        checkin: { energy: 2, sleep_quality: 2, stress: 4, muscle_soreness: 4, sleep_duration: 6 },
        checkinResponseRate: 80,
        progression: {
          overloadEventCount: 3,
          compoundOneRmImproving: true,
          recentPrDetected: true,
        },
      }),
    )
    expect(withProgression.fatigueIndex.value).toBeLessThan(baseline.fatigueIndex.value)
  })
})

describe('buildDerivedSignals RHR and CNS Overload', () => {
  it('computes rhrDelta correctly with sufficient RHR points', () => {
    const daysAgo = (n: number) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString().slice(0, 10)
    }

    const rhrSeries = [
      // 21 baseline points around 60 bpm
      ...Array.from({ length: 21 }, (_, i) => ({
        date: daysAgo(i + 3),
        value: 60,
      })),
      // 3 acute points around 66 bpm (10% increase, >8%)
      { date: daysAgo(2), value: 66 },
      { date: daysAgo(1), value: 66 },
      { date: daysAgo(0), value: 66 },
    ]

    const result = buildDerivedSignals(
      makeRawInput({
        rhrSeries,
        anchorDate: daysAgo(0),
        checkin: { energy: 4, sleep_quality: 4, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
      })
    )

    expect(result.rhrDelta).toBeDefined()
    expect(result.rhrDelta?.currentRhr).toBe(66)
    expect(result.rhrDelta?.baselineRhr).toBe(60)
    expect(result.rhrDelta?.deviationPercentage).toBe(10)
    expect(result.rhrDelta?.isCnsOverloaded).toBe(true)
    expect(result.cnsOverload).toBe(true)
  })

  it('does not flag CNS overload when RHR is lower than baseline', () => {
    const daysAgo = (n: number) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString().slice(0, 10)
    }

    const rhrSeries = [
      ...Array.from({ length: 21 }, (_, i) => ({
        date: daysAgo(i + 3),
        value: 66,
      })),
      { date: daysAgo(2), value: 60 },
      { date: daysAgo(1), value: 60 },
      { date: daysAgo(0), value: 60 },
    ]

    const result = buildDerivedSignals(
      makeRawInput({
        rhrSeries,
        anchorDate: daysAgo(0),
        checkin: { energy: 4, sleep_quality: 4, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
      })
    )

    expect(result.rhrDelta?.deviationPercentage).toBeLessThan(-8)
    expect(result.rhrDelta?.isCnsOverloaded).toBe(false)
    expect(result.cnsOverload).toBe(false)
  })

  it('does not infer subjective fatigue when check-in recovery fields are missing', () => {
    const daysAgo = (n: number) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString().slice(0, 10)
    }

    const rhrSeries = [
      ...Array.from({ length: 24 }, (_, i) => ({
        date: daysAgo(i),
        value: 60,
      })),
    ]

    const result = buildDerivedSignals(
      makeRawInput({
        rhrSeries,
        anchorDate: daysAgo(0),
      })
    )

    expect(result.fatigueIndex.observed).toBe(false)
    expect(result.rhrDelta?.isCnsOverloaded).toBe(false)
    expect(result.cnsOverload).toBe(false)
  })

  it('keeps cnsOverload false when RHR is stable and subjective fatigue is low', () => {
    const daysAgo = (n: number) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString().slice(0, 10)
    }

    const rhrSeries = [
      ...Array.from({ length: 24 }, (_, i) => ({
        date: daysAgo(i),
        value: 60,
      })),
    ]

    const result = buildDerivedSignals(
      makeRawInput({
        rhrSeries,
        anchorDate: daysAgo(0),
        checkin: { energy: 4, sleep_quality: 4, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
      })
    )

    expect(result.rhrDelta?.isCnsOverloaded).toBe(false)
    expect(result.cnsOverload).toBe(false)
  })

  it('triggers cnsOverload via subjective fatigue fallback even if RHR is stable', () => {
    const daysAgo = (n: number) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString().slice(0, 10)
    }

    const rhrSeries = [
      ...Array.from({ length: 24 }, (_, i) => ({
        date: daysAgo(i),
        value: 60,
      })),
    ]

    const result = buildDerivedSignals(
      makeRawInput({
        rhrSeries,
        anchorDate: daysAgo(0),
        checkin: { energy: 1, sleep_quality: 1, sleep_duration: 3, stress: 5, muscle_soreness: 5 },
      })
    )

    expect(result.rhrDelta?.isCnsOverloaded).toBe(false)
    expect(result.cnsOverload).toBe(true) // Subjective OR safety gate
  })
})
