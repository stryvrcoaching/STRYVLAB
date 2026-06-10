import { describe, it, expect } from 'vitest'
import { computeDailyFacts, computeDayKind, type DailyFactsInput } from '@/lib/client/ai-coach/dailyFacts'

const base: DailyFactsInput = {
  dayKind: 'training',
  sessionStatus: 'none',
  plannedSessionName: 'Push A',
  kcalLogged: 2000,
  kcalTarget: 2000,
  proteinLogged: 150,
  proteinTarget: 150,
  hydrationMl: 2500,
  hydrationTargetMl: 2500,
  steps: 9000,
  checkin: {},
}

describe('computeDailyFacts', () => {
  it('marks nutrition over when delta exceeds +200 kcal', () => {
    const f = computeDailyFacts({ ...base, kcalLogged: 2350 })
    expect(f.nutrition.deltaKcal).toBe(350)
    expect(f.nutrition.status).toBe('over')
  })

  it('marks nutrition under when delta below -300 kcal', () => {
    const f = computeDailyFacts({ ...base, kcalLogged: 1600 })
    expect(f.nutrition.status).toBe('under')
  })

  it('marks on_track within band', () => {
    expect(computeDailyFacts({ ...base, kcalLogged: 2100 }).nutrition.status).toBe('on_track')
  })

  it('does NOT report nutrition as complete on a cancelled training day that overshot', () => {
    const f = computeDailyFacts({ ...base, dayKind: 'cancelled', sessionStatus: 'cancelled', kcalLogged: 2300, kcalTarget: 2000 })
    expect(f.session.status).toBe('cancelled')
    expect(f.nutrition.status).toBe('over')
  })

  it('flags protein short below 80% of target', () => {
    const f = computeDailyFacts({ ...base, proteinLogged: 100, proteinTarget: 150 })
    expect(f.nutrition.proteinShort).toBe(true)
  })

  it('computes hydration pct', () => {
    expect(computeDailyFacts({ ...base, hydrationMl: 1250, hydrationTargetMl: 2500 }).hydration.pct).toBe(50)
  })

  it('passes checkin signals through', () => {
    const f = computeDailyFacts({ ...base, checkin: { sleepHours: 5.7, rhr: 55, energy: 3 } })
    expect(f.checkin.sleepHours).toBe(5.7)
    expect(f.checkin.rhr).toBe(55)
  })
})

describe('computeDayKind', () => {
  it('training when a session is planned and not skipped/overridden', () => {
    expect(computeDayKind({ plannedSessionName: 'Push A', completed: false, skipped: false, overrideOff: false }))
      .toEqual({ dayKind: 'training', sessionStatus: 'none' })
  })

  it('completed when the session was logged', () => {
    expect(computeDayKind({ plannedSessionName: 'Push A', completed: true, skipped: false, overrideOff: false }))
      .toEqual({ dayKind: 'training', sessionStatus: 'completed' })
  })

  it('cancelled when a planned training day is overridden off', () => {
    expect(computeDayKind({ plannedSessionName: 'Push A', completed: false, skipped: false, overrideOff: true }))
      .toEqual({ dayKind: 'cancelled', sessionStatus: 'cancelled' })
  })

  it('skipped when an explicit skip row exists', () => {
    expect(computeDayKind({ plannedSessionName: 'Push A', completed: false, skipped: true, overrideOff: false }))
      .toEqual({ dayKind: 'cancelled', sessionStatus: 'skipped' })
  })

  it('rest when nothing was planned', () => {
    expect(computeDayKind({ plannedSessionName: null, completed: false, skipped: false, overrideOff: false }))
      .toEqual({ dayKind: 'rest', sessionStatus: 'rest' })
  })
})
