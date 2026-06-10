import { describe, expect, it } from 'vitest'
import { buildCoachDecision } from '@/lib/coach/phaseEngine/coachDecision'
import { computePhaseOptimization } from '@/lib/coach/phaseEngine/engine'
import { buildDerivedSignals } from '@/lib/coach/phaseEngine/signals'
import type { RawSignalInput } from '@/lib/coach/phaseEngine/types'
import { makeExerciseRow, makeRawInput } from './testFixtures'

const ANCHOR_DATE = '2026-05-29'

function daysAgo(n: number): string {
  const d = new Date(`${ANCHOR_DATE}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function rhrSeries(baseline: number, acute: number) {
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

function runScenario(raw: RawSignalInput) {
  const signals = buildDerivedSignals(raw)
  const result = computePhaseOptimization(signals)
  const decision = buildCoachDecision(result, signals, raw, 'fr')

  return {
    signals,
    result,
    decision,
    report: {
      direction: result.currentState.direction,
      adaptive: result.currentState.adaptiveState,
      urgency: result.recommendedAdjustment.urgency,
      confidence: decision.confidenceModel.scorePct,
      rhrStatus: decision.baselines.rhr.status,
      trajectory: decision.sevenDayTrajectory.strategy,
      days: decision.sevenDayTrajectory.days.length,
      headline: decision.headline,
    },
  }
}

const scenarios: {
  name: string
  raw: RawSignalInput
  expect: {
    trajectory: 'deload' | 'progressive_reload' | 'maintain'
    rhrStatus?: 'overload' | 'stable' | 'insufficient'
    minDays?: number
    maxDays?: number
  }
}[] = [
  {
    name: 'RHR surcharge aiguë',
    raw: makeRawInput({
      anchorDate: ANCHOR_DATE,
      rhrSeries: rhrSeries(60, 66),
      checkin: {
        energy: 3,
        sleep_quality: 3,
        sleep_duration: 7,
        stress: 2,
        muscle_soreness: 2,
      },
      checkinResponseRate: 90,
    }),
    expect: { trajectory: 'deload', rhrStatus: 'overload', minDays: 7, maxDays: 7 },
  },
  {
    name: 'Données RHR insuffisantes',
    raw: makeRawInput({
      anchorDate: ANCHOR_DATE,
      rhrSeries: [
        { date: daysAgo(1), value: 72 },
        { date: daysAgo(0), value: 73 },
      ],
      checkin: { energy: 3, sleep_quality: 3, sleep_duration: 7 },
      checkinResponseRate: 30,
    }),
    expect: { trajectory: 'maintain', rhrStatus: 'insufficient', minDays: 7, maxDays: 7 },
  },
  {
    name: 'Stable avec récupération correcte',
    raw: makeRawInput({
      anchorDate: ANCHOR_DATE,
      rhrSeries: rhrSeries(60, 60),
      checkin: {
        energy: 4,
        sleep_quality: 4,
        sleep_duration: 8,
        stress: 1,
        muscle_soreness: 1,
      },
      checkinResponseRate: 100,
    }),
    expect: { trajectory: 'maintain', rhrStatus: 'stable', minDays: 7, maxDays: 7 },
  },
  {
    name: 'Fatigue subjective forte malgré RHR stable',
    raw: makeRawInput({
      anchorDate: ANCHOR_DATE,
      rhrSeries: rhrSeries(60, 60),
      checkin: {
        energy: 1,
        sleep_quality: 1,
        sleep_duration: 4,
        stress: 5,
        muscle_soreness: 4,
      },
      checkinResponseRate: 90,
    }),
    expect: { trajectory: 'deload', rhrStatus: 'stable', minDays: 7, maxDays: 7 },
  },
  {
    name: 'Performance en hausse, récupération bonne',
    raw: makeRawInput({
      anchorDate: ANCHOR_DATE,
      rhrSeries: rhrSeries(60, 59),
      checkin: {
        energy: 5,
        sleep_quality: 4,
        sleep_duration: 8.5,
        stress: 1,
        muscle_soreness: 1,
      },
      checkinResponseRate: 100,
      performance: {
        exercises: [
          makeExerciseRow({
            completion_rate: 0.98,
            avg_rir: 2,
            prescribed_rir: 2,
            overloads_last_4_weeks: 3,
            load_progressing: true,
          }),
        ],
        global_overreaching: false,
        sessionsCount: 10,
        weeklyFrequency: 3,
      },
    }),
    expect: { trajectory: 'maintain', rhrStatus: 'stable', minDays: 7, maxDays: 7 },
  },
]

describe('phase engine scenario runner', () => {
  it.each(scenarios)('$name', ({ raw, expect: expected }) => {
    const { decision, report } = runScenario(raw)

    console.table([report])

    expect(decision.sevenDayTrajectory.strategy).toBe(expected.trajectory)
    expect(decision.sevenDayTrajectory.days.length).toBeGreaterThanOrEqual(expected.minDays ?? 7)
    expect(decision.sevenDayTrajectory.days.length).toBeLessThanOrEqual(expected.maxDays ?? 7)

    if (expected.rhrStatus) {
      expect(decision.baselines.rhr.status).toBe(expected.rhrStatus)
    }
  })
})
