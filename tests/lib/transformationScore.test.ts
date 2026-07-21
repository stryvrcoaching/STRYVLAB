import { describe, it, expect } from 'vitest'
import {
  getScoreLabel,
  DEFAULT_WEIGHTS,
  computeTransformationScore,
  type ComputeScoreInput,
  type DimensionWeights,
  type TransformationScoreResult,
} from '@/lib/coach/transformationScore'

// ── getScoreLabel ─────────────────────────────────────────────────────────────

describe('getScoreLabel', () => {
  it('returns "En difficulté" for scores 0–24', () => {
    expect(getScoreLabel(0)).toBe('En difficulté')
    expect(getScoreLabel(24)).toBe('En difficulté')
  })
  it('returns "En progression" for 25–49', () => {
    expect(getScoreLabel(25)).toBe('En progression')
    expect(getScoreLabel(49)).toBe('En progression')
  })
  it('returns "Sur la bonne voie" for 50–74', () => {
    expect(getScoreLabel(50)).toBe('Sur la bonne voie')
    expect(getScoreLabel(74)).toBe('Sur la bonne voie')
  })
  it('returns "Haute performance" for 75–89', () => {
    expect(getScoreLabel(75)).toBe('Haute performance')
    expect(getScoreLabel(89)).toBe('Haute performance')
  })
  it('returns "Potentiel maximal" for 90–100', () => {
    expect(getScoreLabel(90)).toBe('Potentiel maximal')
    expect(getScoreLabel(100)).toBe('Potentiel maximal')
  })
})

// ── DEFAULT_WEIGHTS ───────────────────────────────────────────────────────────

describe('DEFAULT_WEIGHTS', () => {
  const goals = ['fat_loss','hypertrophy','strength','recomp','maintenance','endurance','athletic'] as const
  it('every training_goal has weights that sum to 1.0', () => {
    for (const goal of goals) {
      const w = DEFAULT_WEIGHTS[goal]
      const sum = w.adherence + w.recovery + w.bodyProgress + w.performance
      expect(sum).toBeCloseTo(1.0, 5)
    }
  })
  it('covers all 7 training goals', () => {
    expect(goals.every(g => g in DEFAULT_WEIGHTS)).toBe(true)
  })
})

// ── computeTransformationScore — helpers ──────────────────────────────────────

function makeInput(overrides: Partial<ComputeScoreInput> = {}): ComputeScoreInput {
  return {
    trainingGoal: 'hypertrophy',
    window: 7,
    checkin: {
      field_averages: { energy: 4, sleep_quality: 4, sleep_duration: 7.5, stress: 2, muscle_soreness: 2 },
      response_rate: 90,
      configured_days_count: 7,
    },
    performance: {
      analysis: {
        exercises: [
          { completion_rate: 0.95, avg_rir: 1.5, overloads_last_4_weeks: 2, stagnation: false, overreaching: false },
          { completion_rate: 0.90, avg_rir: 2.0, overloads_last_4_weeks: 1, stagnation: false, overreaching: false },
        ],
        global_overreaching: false,
      },
      sessionsCount: 4,
      weeklyFrequency: 4,
    },
    bodyData: {
      weightSeries: [
        { date: '2026-05-01', value: 80 },
        { date: '2026-05-15', value: 80.5 },
        { date: '2026-05-29', value: 81 },
      ],
      bodyFatSeries: [],
      leanMassSeries: [],
      trainingGoal: 'hypertrophy',
    },
    weightsOverride: null,
    gender: null,
    latestBodyFat: null,
    ...overrides,
  }
}

function makeDims(overrides: Partial<TransformationScoreResult['dimensions']> = {}): TransformationScoreResult['dimensions'] {
  return {
    adherence:    { score: 80, weight: 0.25, dataPoints: 5 },
    recovery:     { score: 75, weight: 0.30, dataPoints: 5 },
    bodyProgress: { score: 60, weight: 0.20, dataPoints: 3, confidence: 'high' as const },
    performance:  { score: 80, weight: 0.25, dataPoints: 4 },
    ...overrides,
  }
}

// ── computeTransformationScore — main ─────────────────────────────────────────

describe('computeTransformationScore', () => {
  it('returns score in 0–100 range', () => {
    const result = computeTransformationScore(makeInput())
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('returns weightsSource "default" when no override', () => {
    const result = computeTransformationScore(makeInput())
    expect(result.weightsSource).toBe('default')
  })

  it('returns weightsSource "coach_override" when override provided', () => {
    const override: DimensionWeights = { adherence: 0.4, recovery: 0.3, bodyProgress: 0.2, performance: 0.1 }
    const result = computeTransformationScore(makeInput({ weightsOverride: override }))
    expect(result.weightsSource).toBe('coach_override')
  })

  it('returns correct window in result', () => {
    expect(computeTransformationScore(makeInput({ window: 30 })).window).toBe(30)
    expect(computeTransformationScore(makeInput({ window: 7 })).window).toBe(7)
  })

  it('marks insufficientData when no check-ins (recovery dataPoints < 3)', () => {
    const input = makeInput({
      checkin: { field_averages: {}, response_rate: null, configured_days_count: 0 },
    })
    const result = computeTransformationScore(input)
    expect(result.insufficientData).toBe(true)
  })

  it('returns explicit insufficient_data analysis state when no signal is interpretable', () => {
    const result = computeTransformationScore(makeInput({
      checkin: { field_averages: {}, response_rate: null, configured_days_count: 0 },
      performance: {
        analysis: {
          exercises: [],
          global_overreaching: false,
        },
        sessionsCount: 0,
        weeklyFrequency: 4,
      },
      bodyData: {
        weightSeries: [],
        bodyFatSeries: [],
        leanMassSeries: [],
        trainingGoal: 'hypertrophy',
      },
    }))
    expect(result.analysisState).toBe('insufficient_data')
    expect(result.analysisStateReason).toContain('aucun check-in')
    expect(result.analysisStateReason).toContain('aucune séance loggée')
    expect(result.analysisStateReason).toContain('aucun bilan corporel')
  })

  it('redistributes weights when a dimension has insufficient data', () => {
    const input = makeInput({
      bodyData: { weightSeries: [], bodyFatSeries: [], leanMassSeries: [], trainingGoal: 'hypertrophy' },
    })
    const result = computeTransformationScore(input)
    expect(result.dimensions.bodyProgress.weight).toBe(0)
    const { adherence, recovery, bodyProgress, performance } = result.dimensions
    const sum = adherence.weight + recovery.weight + bodyProgress.weight + performance.weight
    expect(sum).toBeCloseTo(1.0, 4)
  })

  it('fat_loss goal: rising weight trend scores poorly on body progress', () => {
    const input = makeInput({
      trainingGoal: 'fat_loss',
      bodyData: {
        weightSeries: [
          { date: '2026-05-01', value: 80 },
          { date: '2026-05-15', value: 81 },
          { date: '2026-05-29', value: 82 },
        ],
        bodyFatSeries: [],
        leanMassSeries: [],
        trainingGoal: 'fat_loss',
      },
    })
    const result = computeTransformationScore(input)
    expect(result.dimensions.bodyProgress.score).toBeLessThan(50)
  })

  it('fat_loss goal: falling weight trend scores well on body progress', () => {
    const input = makeInput({
      trainingGoal: 'fat_loss',
      bodyData: {
        weightSeries: [
          { date: '2026-05-01', value: 82 },
          { date: '2026-05-15', value: 81 },
          { date: '2026-05-29', value: 80 },
        ],
        bodyFatSeries: [],
        leanMassSeries: [],
        trainingGoal: 'fat_loss',
      },
    })
    const result = computeTransformationScore(input)
    expect(result.dimensions.bodyProgress.score).toBeGreaterThan(50)
  })

  it('generates high-severity alert for very low sleep duration', () => {
    const input = makeInput({
      checkin: {
        field_averages: { energy: 2, sleep_quality: 2, sleep_duration: 5.5, stress: 4, muscle_soreness: 4 },
        response_rate: 80,
        configured_days_count: 7,
      },
    })
    const result = computeTransformationScore(input)
    const recoveryAlert = result.alerts.find(a => a.dimension === 'recovery')
    expect(recoveryAlert).toBeDefined()
    expect(recoveryAlert?.severity).toBe('high')
  })

  it('keeps performance analyzable when exercises have overload signals and exposes explanations', () => {
    const result = computeTransformationScore(makeInput({
      performance: {
        analysis: {
          exercises: [
            { completion_rate: 0.95, avg_rir: 1.5, overloads_last_4_weeks: 2, stagnation: false, overreaching: false },
            { completion_rate: 0.9, avg_rir: 2, overloads_last_4_weeks: 1, stagnation: false, overreaching: false },
          ],
          global_overreaching: false,
        },
        sessionsCount: 4,
        weeklyFrequency: 4,
      },
    }))

    expect(result.dimensions.performance.score).toBeGreaterThan(70)
    expect(result.dimensions.performance.explanation).toContain('progressions de charge')
    expect(result.dimensions.performance.metrics?.some((metric) => metric.label === 'Exercices avec événement de surcharge')).toBe(true)
    expect(result.dimensions.performance.metrics?.some((metric) => metric.label === 'Règle de surcharge suivie')).toBe(true)
  })

  it('returns no high-severity alerts for a perfect client', () => {
    const perfect = makeInput({
      checkin: {
        field_averages: { energy: 5, sleep_quality: 5, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
        response_rate: 100,
        configured_days_count: 7,
      },
      performance: {
        analysis: {
          exercises: [
            { completion_rate: 1.0, avg_rir: 1, overloads_last_4_weeks: 3, stagnation: false, overreaching: false },
          ],
          global_overreaching: false,
        },
        sessionsCount: 4,
        weeklyFrequency: 4,
      },
    })
    const result = computeTransformationScore(perfect)
    expect(result.alerts.filter(a => a.severity === 'high').length).toBe(0)
    expect(result.analysisState).toBe('ready')
  })

  it('alerts are sorted high → medium → low', () => {
    const result = computeTransformationScore(makeInput({
      checkin: {
        field_averages: { sleep_duration: 5, stress: 5, energy: 1 },
        response_rate: 20,
        configured_days_count: 7,
      },
      performance: {
        analysis: {
          exercises: [
            { completion_rate: 0.5, avg_rir: 4, overloads_last_4_weeks: 0, stagnation: true, overreaching: true },
          ],
          global_overreaching: true,
        },
        sessionsCount: 1,
        weeklyFrequency: 5,
      },
    }))
    const severityOrder = { high: 0, medium: 1, low: 2 }
    for (let i = 1; i < result.alerts.length; i++) {
      expect(severityOrder[result.alerts[i - 1].severity]).toBeLessThanOrEqual(
        severityOrder[result.alerts[i].severity]
      )
    }
  })
})
