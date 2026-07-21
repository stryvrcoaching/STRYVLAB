import { describe, it, expect } from 'vitest'
import { computePhaseOptimization } from '@/lib/coach/phaseEngine/engine'
import { buildDerivedSignals } from '@/lib/coach/phaseEngine/signals'
import type { DerivedSignals } from '@/lib/coach/phaseEngine/types'
import { makeExerciseRow, makeRawInput } from './testFixtures'

function minimalSignals(): DerivedSignals & { insufficientData: boolean } {
  return buildDerivedSignals(makeRawInput())
}

function goodRecoverySignals(): DerivedSignals & { insufficientData: boolean } {
  return buildDerivedSignals(
    makeRawInput({
      checkin: { energy: 5, sleep_quality: 4, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
      checkinResponseRate: 100,
      performance: {
        exercises: [makeExerciseRow({ completion_rate: 0.95, overloads_last_4_weeks: 3 })],
        global_overreaching: false,
        sessionsCount: 12,
        weeklyFrequency: 3,
      },
    }),
  )
}

function crashSignals(): DerivedSignals & { insufficientData: boolean } {
  const daysAgo = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }
  return buildDerivedSignals(
    makeRawInput({
      weightSeries: [
        { date: daysAgo(21), value: 85 }, { date: daysAgo(14), value: 82 },
        { date: daysAgo(7), value: 79 }, { date: daysAgo(0), value: 76 },
      ],
      leanMassSeries: [
        { date: daysAgo(21), value: 70 }, { date: daysAgo(14), value: 68.5 },
        { date: daysAgo(7), value: 67 }, { date: daysAgo(0), value: 65.5 },
      ],
      checkin: { energy: 1, sleep_quality: 1, sleep_duration: 4, stress: 5, muscle_soreness: 5 },
      checkinResponseRate: 90,
      performance: {
        exercises: [
          makeExerciseRow({
            completion_rate: 0.5,
            avg_rir: 0,
            prescribed_rir: 0,
            stagnation: true,
            overreaching: true,
            intentional_intensity: true,
          }),
        ],
        global_overreaching: true,
        sessionsCount: 4,
        weeklyFrequency: 3,
      },
    }),
  )
}

describe('computePhaseOptimization', () => {
  it('returns a valid result with minimal data', () => {
    const result = computePhaseOptimization(minimalSignals())
    expect(result.phaseFit.score).toBeGreaterThanOrEqual(0)
    expect(result.phaseFit.score).toBeLessThanOrEqual(100)
    expect(result.phaseMatrix.rule).toBeDefined()
    expect(result.phaseMatrix.status).toBeDefined()
    expect(result.currentState.direction).toBeDefined()
    expect(result.currentState.adaptiveState).toBeDefined()
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.engineMetadata.engineVersion).toBe('v1')
    expect(result.analysisState).toBe('insufficient_data')
    expect(result.analysisStateReason).toContain('aucun check-in')
    expect(result.analysisStateReason).toContain('aucune séance loggée')
    expect(result.analysisStateReason).toContain('aucun bilan corporel')
  })

  it('detects recovery_crash with extreme fatigue signals', () => {
    const result = computePhaseOptimization(crashSignals())
    expect(result.phaseMatrix.rule).toBe('recovery_overload')
    expect(result.phaseMatrix.status).toBe('not_adapted')
    expect(result.currentState.adaptiveState).toBe('recovery_crash')
    expect(result.recommendedAdjustment.urgency).toBe('high')
    expect(result.recommendedAdjustment.horizon).toBe('acute')
  })

  it('detects positive adaptive state with excellent recovery', () => {
    const result = computePhaseOptimization(goodRecoverySignals())
    expect(['optimal_alignment', 'stable_alignment']).toContain(result.phaseMatrix.rule)
    expect(['stable', 'recovered', 'supercompensated']).toContain(result.currentState.adaptiveState)
    expect(result.analysisState).toBe('ready')
  })

  it('safety gate: aggressive_deficit blocked when dataQuality is minimal', () => {
    const signals = minimalSignals()
    signals.catabolicRisk = { value: 0, observed: false, confidence: 0.5 }
    signals.anabolicPotential = { value: 0, observed: false, confidence: 0.5 }
    const result = computePhaseOptimization(signals)
    expect(result.recommendedAdjustment.direction).not.toBe('aggressive_deficit')
    expect(result.recommendedAdjustment.direction).not.toBe('aggressive_surplus')
  })

  it('catabolic force maintenance when catabolicRisk > 0.70', () => {
    const signals = goodRecoverySignals()
    signals.catabolicRisk = { value: 0.85, observed: false, confidence: 0.8 }
    const result = computePhaseOptimization(signals)
    const recDir = result.recommendedAdjustment.direction
    expect(['maintenance', 'controlled_deficit'].includes(recDir)).toBe(true)
  })

  it('returns non-empty reasons', () => {
    const result = computePhaseOptimization(goodRecoverySignals())
    expect(result.reasons.length).toBeGreaterThan(0)
    expect(result.microCopy.length).toBeGreaterThan(0)
  })

  it('decisionTrace has ignoredSignals when confidence below threshold', () => {
    const result = computePhaseOptimization(minimalSignals())
    expect(Array.isArray(result.decisionTrace.ignoredSignals)).toBe(true)
  })

  it('opportunityStates is an array', () => {
    const result = computePhaseOptimization(goodRecoverySignals())
    expect(Array.isArray(result.currentState.opportunityStates)).toBe(true)
  })
})
