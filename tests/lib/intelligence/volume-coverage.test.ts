import { describe, it, expect } from 'vitest'
import { scoreVolumeCoverage } from '@/lib/programs/intelligence/scoring'
import type { BuilderSession, TemplateMeta } from '@/lib/programs/intelligence/types'

const META_HYPERTROPHY_INTERMEDIATE: TemplateMeta = {
  goal: 'hypertrophy',
  level: 'intermediate',
  weeks: 8,
  frequency: 4,
  equipment_archetype: 'full_gym',
}

const SQUAT: BuilderSession['exercises'][0] = {
  name: 'Squat barre',
  sets: 4,
  reps: '8',
  rest_sec: 120,
  rir: 2,
  notes: '',
  movement_pattern: 'squat_pattern',
  equipment_required: ['barbell'],
  primary_muscles: ['quadriceps'],
  secondary_muscles: ['fessiers', 'ischio-jambiers'],
  is_compound: true,
  primaryMuscle: 'rectus_femoris',
  primaryActivation: 0.82,
  secondaryMusclesDetail: ['gluteus_maximus', 'biceps_femoris'],
  secondaryActivations: [0.30, 0.15],
}

const EXERCISE_NO_BIOMECH: BuilderSession['exercises'][0] = {
  name: 'Exercice inconnu',
  sets: 3,
  reps: '10',
  rest_sec: 90,
  rir: 2,
  notes: '',
  movement_pattern: 'squat_pattern',
  equipment_required: [],
  primary_muscles: ['quadriceps'],
  secondary_muscles: [],
}

const sessionWith = (exercises: BuilderSession['exercises']): BuilderSession[] => [
  { name: 'Séance A', day_of_week: 1, exercises },
]

describe('scoreVolumeCoverage', () => {
  it('returns score 100 and no alerts when no exercises', () => {
    const result = scoreVolumeCoverage([], META_HYPERTROPHY_INTERMEDIATE)
    expect(result.score).toBe(100)
    expect(result.alerts).toHaveLength(0)
    expect(result.volumeByMuscle).toEqual({})
  })

  it('computes weighted volume using primaryActivation for primary muscle', () => {
    const result = scoreVolumeCoverage(sessionWith([SQUAT]), META_HYPERTROPHY_INTERMEDIATE)
    // quadriceps: 4 sets × 0.82 = 3.28
    expect(result.volumeByMuscle['quadriceps']).toBeCloseTo(3.28, 1)
  })

  it('computes weighted volume using secondaryActivations for secondary muscles', () => {
    const result = scoreVolumeCoverage(sessionWith([SQUAT]), META_HYPERTROPHY_INTERMEDIATE)
    // fessiers_grand: 4 sets × 0.30 = 1.20
    expect(result.volumeByMuscle['fessiers_grand']).toBeCloseTo(1.20, 1)
    // ischio: 4 sets × 0.15 = 0.60
    expect(result.volumeByMuscle['ischio']).toBeCloseTo(0.60, 1)
  })

  it('emits UNDER_MEV warning when volume below MEV', () => {
    const singleSet = { ...SQUAT, sets: 1 }
    const result = scoreVolumeCoverage(sessionWith([singleSet]), META_HYPERTROPHY_INTERMEDIATE)
    const underMev = result.alerts.filter(a => a.code === 'UNDER_MEV')
    expect(underMev.length).toBeGreaterThan(0)
    expect(underMev[0].severity).toBe('warning')
  })

  it('emits OVER_MRV critical alert when volume exceeds MRV', () => {
    // 30 sets × 0.82 = 24.6 weighted sets for quads — MRV for intermediate hypertrophy = 22
    const manySets = { ...SQUAT, sets: 30 }
    const result = scoreVolumeCoverage(sessionWith([manySets]), META_HYPERTROPHY_INTERMEDIATE)
    const overMrv = result.alerts.filter(a => a.code === 'OVER_MRV')
    expect(overMrv.length).toBeGreaterThan(0)
    expect(overMrv[0].severity).toBe('critical')
  })

  it('emits OVER_MAV info alert when volume between MAV and MRV', () => {
    // 22 sets × 0.82 = 18.04 weighted sets for quads — MAV=16, MRV=22
    const overMavSets = { ...SQUAT, sets: 22 }
    const result = scoreVolumeCoverage(sessionWith([overMavSets]), META_HYPERTROPHY_INTERMEDIATE)
    const overMav = result.alerts.filter(a => a.code === 'OVER_MAV')
    expect(overMav.length).toBeGreaterThan(0)
    expect(overMav[0].severity).toBe('info')
  })

  it('does not include exercises without biomech data in volume tracking', () => {
    const result = scoreVolumeCoverage(sessionWith([EXERCISE_NO_BIOMECH]), META_HYPERTROPHY_INTERMEDIATE)
    expect(result.volumeByMuscle).toEqual({})
  })

  it('accumulates volume across multiple sessions', () => {
    const sessions: BuilderSession[] = [
      { name: 'Séance A', day_of_week: 1, exercises: [SQUAT] },
      { name: 'Séance B', day_of_week: 3, exercises: [SQUAT] },
    ]
    const result = scoreVolumeCoverage(sessions, META_HYPERTROPHY_INTERMEDIATE)
    // quadriceps: 2 × (4 × 0.82) = 6.56
    expect(result.volumeByMuscle['quadriceps']).toBeCloseTo(6.56, 1)
  })

  it('scales targets by level — beginner has lower MEV', () => {
    const beginnerMeta: TemplateMeta = { ...META_HYPERTROPHY_INTERMEDIATE, level: 'beginner' }
    // beginner MEV for quads = round(8 × 0.65 × 1.0) = 5
    // 7 × 0.82 = 5.74 > 5 — should NOT emit UNDER_MEV for quadriceps
    const fewSets = { ...SQUAT, sets: 7 }
    const result = scoreVolumeCoverage(sessionWith([fewSets]), beginnerMeta)
    const underMev = result.alerts.filter(a => a.code === 'UNDER_MEV' && a.title.includes('quadriceps'))
    expect(underMev).toHaveLength(0)
  })

  it('scales targets by goal — strength has lower MRV', () => {
    const strengthMeta: TemplateMeta = { ...META_HYPERTROPHY_INTERMEDIATE, goal: 'strength' }
    // strength MRV for quads = round(22 × 0.65 × 1.0) = 14
    // 18 sets × 0.82 = 14.76 > 14 — should emit OVER_MRV
    const heavySets = { ...SQUAT, sets: 18 }
    const result = scoreVolumeCoverage(sessionWith([heavySets]), strengthMeta)
    const overMrv = result.alerts.filter(a => a.code === 'OVER_MRV')
    expect(overMrv.length).toBeGreaterThan(0)
  })

  it('score degrades proportionally to number of under-MEV muscles', () => {
    const minimalSession = { ...SQUAT, sets: 1 }
    const result = scoreVolumeCoverage(sessionWith([minimalSession]), META_HYPERTROPHY_INTERMEDIATE)
    expect(result.score).toBeLessThan(80)
  })
})
