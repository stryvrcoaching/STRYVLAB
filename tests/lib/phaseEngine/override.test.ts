import { describe, it, expect } from 'vitest'
import { computePhaseOptimization } from '@/lib/coach/phaseEngine/engine'
import { buildDerivedSignals } from '@/lib/coach/phaseEngine/signals'
import {
  applyManualOverride,
  resolveCoachPhasePreferences,
  parseStoredPhaseOverride,
} from '@/lib/coach/phaseEngine/override'
import { makeExerciseRow, makeRawInput } from './testFixtures'

describe('resolveCoachPhasePreferences', () => {
  it('merges stored prefs over training_goal defaults', () => {
    const prefs = resolveCoachPhasePreferences('fat_loss', {
      aggressiveCutTolerance: 0.9,
      prioritizePerformance: true,
    })
    expect(prefs.aggressiveCutTolerance).toBe(0.9)
    expect(prefs.prioritizePerformance).toBe(true)
    expect(prefs.preferredBulkAggressiveness).toBe(0.25)
  })
})

describe('applyManualOverride', () => {
  it('replaces recommended direction when override active', () => {
    const signals = buildDerivedSignals(
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
    const base = computePhaseOptimization(signals)
    const stored = parseStoredPhaseOverride({
      active: true,
      direction: 'maintenance',
      adaptiveState: 'stable',
      reason: 'Semaine de stabilisation',
    })
    const result = applyManualOverride(base, stored)
    expect(result.recommendedAdjustment.direction).toBe('maintenance')
    expect(result.recommendedAdjustment.adaptiveState).toBe('stable')
    expect(result.manualOverride?.active).toBe(true)
    expect(result.decisionTrace.conflictingSignals).toContain('override_coach_actif')
    expect(result.microCopy).toContain('Semaine de stabilisation')
  })

  it('uses English override prefix when locale is en', () => {
    const signals = buildDerivedSignals(
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
    const base = computePhaseOptimization(signals, { locale: 'en' })
    const result = applyManualOverride(base, {
      active: true,
      direction: 'maintenance',
      reason: 'Stabilization week',
    }, 'en')
    expect(result.microCopy).toMatch(/^Coach manual adjustment :/)
  })

  it('clears override flag when inactive', () => {
    const signals = buildDerivedSignals(makeRawInput())
    const base = computePhaseOptimization(signals)
    const result = applyManualOverride(base, { active: false })
    expect(result.manualOverride?.active).toBe(false)
  })
})
