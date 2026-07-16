import { describe, expect, it } from 'vitest'
import { buildCoachDecision } from '@/lib/coach/phaseEngine/coachDecision'
import { computePhaseOptimization } from '@/lib/coach/phaseEngine/engine'
import { buildDerivedSignals } from '@/lib/coach/phaseEngine/signals'
import { makeRawInput } from './testFixtures'

const ANCHOR_DATE = '2026-05-29'

function daysAgo(n: number): string {
  const d = new Date(`${ANCHOR_DATE}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function rhrSeries({
  baseline,
  acute,
}: {
  baseline: number
  acute: number
}) {
  return [
    ...Array.from({ length: 21 }, (_, i) => ({
      date: daysAgo(i + 3),
      value: baseline,
    })),
    { date: daysAgo(2), value: acute },
    { date: daysAgo(1), value: acute },
    { date: daysAgo(0), value: acute },
  ]
}

describe('buildCoachDecision', () => {
  it('exposes RHR baseline status and overload drivers for the coach', () => {
    const raw = makeRawInput({
      anchorDate: ANCHOR_DATE,
      rhrSeries: rhrSeries({ baseline: 60, acute: 66 }),
      checkin: {
        energy: 4,
        sleep_quality: 4,
        sleep_duration: 8,
        stress: 1,
        muscle_soreness: 1,
      },
    })
    const signals = buildDerivedSignals(raw)
    const result = computePhaseOptimization(signals)
    const decision = buildCoachDecision(result, signals, raw, 'fr', [
      {
        recordedOn: '2026-05-28',
        directionScore: result.currentState.directionScore - 0.2,
        adaptiveScore: result.currentState.adaptiveScore + 0.2,
        direction: result.currentState.direction,
        adaptiveState: result.currentState.adaptiveState,
      },
    ])

    expect(decision.baselines.rhr).toEqual({
      current: 66,
      baseline: 60,
      deviationPct: 10,
      sampleCount: 24,
      status: 'overload',
    })
    expect(decision.primaryDrivers.some((driver) => driver.includes('RHR'))).toBe(true)
    expect(decision.watchouts.some((watchout) => watchout.includes('SNC'))).toBe(true)
    expect(decision.matrix.rule).toBe('recovery_overload')
    expect(decision.matrix.status).toBe('not_adapted')
    expect(decision.matrix.matchedConditions).toContain('RHR aigu au-dessus de la baseline personnelle')
    expect(decision.confidenceModel.factors.rhrBaselinePct).toBe(100)
    expect(decision.confidenceModel.limitations).not.toContain('Baseline RHR encore en construction')
    expect(decision.sevenDayTrajectory.strategy).toBe('deload')
    expect(decision.sevenDayTrajectory.days).toHaveLength(7)
    expect(decision.sevenDayTrajectory.days[0].intensityPct).toBeLessThanOrEqual(45)
    expect(decision.temporal.previousPoint?.recordedOn).toBe('2026-05-28')
    expect(decision.temporal.changes.length).toBeGreaterThan(0)
    expect(decision.temporal.rhr.sevenDayAvg).toBeGreaterThan(decision.temporal.rhr.thirtyDayAvg ?? 0)
  })

  it('keeps the decision transparent when RHR data is insufficient', () => {
    const raw = makeRawInput({
      anchorDate: ANCHOR_DATE,
      rhrSeries: [
        { date: daysAgo(1), value: 72 },
        { date: daysAgo(0), value: 73 },
      ],
    })
    const signals = buildDerivedSignals(raw)
    const result = computePhaseOptimization(signals)
    const decision = buildCoachDecision(result, signals, raw, 'fr')

    expect(decision.baselines.rhr.status).toBe('insufficient')
    expect(decision.baselines.rhr.sampleCount).toBe(2)
    expect(decision.baselines.rhr.baseline).toBeNull()
    expect(decision.matrix.rule).toBeDefined()
    expect(decision.watchouts).toContain('Confiance limitée par la couverture de données')
    expect(decision.confidenceModel.level).toBe('low')
    expect(decision.confidenceModel.factors.rhrBaselinePct).toBeLessThan(100)
    expect(decision.confidenceModel.limitations).toContain('Baseline RHR encore en construction')
    expect(decision.temporal.previousPoint).toBeNull()
    expect(decision.temporal.summary).toContain('Pas encore de snapshot')
  })

  it('builds a strict 7-day maintenance trajectory when signals are stable', () => {
    const raw = makeRawInput({
      anchorDate: ANCHOR_DATE,
      rhrSeries: rhrSeries({ baseline: 60, acute: 60 }),
      checkin: {
        energy: 4,
        sleep_quality: 4,
        sleep_duration: 8,
        stress: 1,
        muscle_soreness: 1,
      },
      checkinResponseRate: 100,
    })
    const signals = buildDerivedSignals(raw)
    const result = computePhaseOptimization(signals)
    const decision = buildCoachDecision(result, signals, raw, 'fr')

    expect(['optimal_alignment', 'stable_alignment', 'fragile_workable']).toContain(decision.matrix.rule)
    expect(['adapted', 'partially_adapted']).toContain(decision.matrix.status)
    expect(decision.sevenDayTrajectory.strategy).toBe('maintain')
    expect(decision.sevenDayTrajectory.days).toHaveLength(7)
    expect(decision.sevenDayTrajectory.days.every((day) => day.day >= 1 && day.day <= 7)).toBe(true)
  })

  it('flags adherence mismatch explicitly when nutrition execution is too low', () => {
    const raw = makeRawInput({
      anchorDate: ANCHOR_DATE,
      checkin: {
        energy: 3,
        sleep_quality: 3,
        sleep_duration: 7,
        stress: 2,
        muscle_soreness: 2,
      },
      checkinResponseRate: 100,
      nutrition: {
        target: { calories: 2400, protein_g: 180 },
        actual: { avgCalories: 1200, avgProteinG: 70 },
        adherence: {
          loggedDays: 6,
          expectedDays: 7,
          calorieDeltaAvg: -50,
          proteinDeltaAvg: -61.1,
        },
        source: 'meal_logs',
      },
    })
    const signals = buildDerivedSignals(raw)
    const result = computePhaseOptimization(signals)
    const decision = buildCoachDecision(result, signals, raw, 'fr')

    expect(decision.matrix.rule).toBe('adherence_mismatch')
    expect(decision.matrix.status).toBe('not_adapted')
    expect(decision.headline).toBe('Phase non adaptée: adhérence trop faible')
  })

  it('turns a fat-gain verdict into a concrete composition-control plan', () => {
    const raw = makeRawInput({ anchorDate: ANCHOR_DATE })
    const signals = buildDerivedSignals(raw)
    const result = computePhaseOptimization(signals)
    result.phaseMatrix = {
      rule: 'fat_gain_mismatch',
      status: 'not_adapted',
      priority: 'high',
      matchedConditions: ['high_fat_gain_risk', 'body_response_off_target'],
    }

    const decision = buildCoachDecision(result, signals, raw, 'fr')

    expect(decision.recommendation).toContain('Resserrer la phase')
    expect(decision.sevenDayTrajectory.title).toBe('Contrôle compositionnel 7 jours')
    expect(decision.sevenDayTrajectory.summary).toContain('vérifier l’exécution calorique')
    expect(decision.sevenDayTrajectory.days[0].exitCriteria).toContain(
      'Une mesure BF ou du tour de taille confirme la tendance',
    )
  })
})
