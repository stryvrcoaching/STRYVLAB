import { describe, it, expect } from 'vitest'
import { scoreSRA, scoreSuperset } from '@/lib/programs/intelligence/scoring'
import type { BuilderSession, TemplateMeta, BuilderExercise } from '@/lib/programs/intelligence/types'

const GROUP_A = 'group-aaa'

const pushEx: BuilderExercise = {
  name: 'Développé couché', sets: 3, reps: '8-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_push', equipment_required: ['barbell'],
  primary_muscles: ['pectoraux', 'triceps'], secondary_muscles: ['epaules'],
  group_id: GROUP_A,
}

const pullEx: BuilderExercise = {
  name: 'Rowing barre', sets: 3, reps: '8-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_pull', equipment_required: ['barbell'],
  primary_muscles: ['dos', 'biceps'], secondary_muscles: [],
  group_id: GROUP_A,
}

const meta: TemplateMeta = {
  goal: 'hypertrophy', level: 'intermediate', weeks: 8, frequency: 4,
  equipment_archetype: 'commercial_gym',
}

const sessionA: BuilderSession = { name: 'Day A', day_of_week: 1, exercises: [pushEx, pullEx] }

describe('scoreSRA with group_id', () => {
  it('accepts BuilderExercise with group_id without TypeScript error', () => {
    const result = scoreSRA([sessionA], meta)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('treats grouped exercises as one slot — no intra-group SRA violation', () => {
    const result = scoreSRA([sessionA], meta)
    const violations = result.alerts.filter(a => a.code === 'SRA_VIOLATION')
    expect(violations).toHaveLength(0)
  })
})

const agonistA: BuilderExercise = {
  name: 'Développé couché', sets: 3, reps: '8-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_push', equipment_required: ['barbell'],
  primary_muscles: ['pectoraux', 'triceps'], secondary_muscles: [],
  group_id: 'group-chest',
}
const agonistB: BuilderExercise = {
  name: 'Développé incliné', sets: 3, reps: '10-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_push', equipment_required: ['barbell'],
  primary_muscles: ['pectoraux', 'epaules'], secondary_muscles: [],
  group_id: 'group-chest',
}
const antagonist: BuilderExercise = {
  name: 'Rowing barre', sets: 3, reps: '8-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_pull', equipment_required: ['barbell'],
  primary_muscles: ['dos', 'biceps'], secondary_muscles: [],
  group_id: 'group-chest',
}

const sessionWithAntagonist: BuilderSession = {
  name: 'Push Pull', day_of_week: 1,
  exercises: [agonistA, antagonist],
}

const sessionWithAgonist: BuilderSession = {
  name: 'Chest Blast', day_of_week: 1,
  exercises: [agonistA, agonistB],
}

describe('scoreSuperset', () => {
  it('emits SUPERSET_IMBALANCE warning when two grouped exercises share primary muscles', () => {
    const result = scoreSuperset([sessionWithAgonist])
    expect(result.alerts).toHaveLength(1)
    expect(result.alerts[0].code).toBe('SUPERSET_IMBALANCE')
    expect(result.alerts[0].severity).toBe('warning')
    expect(result.alerts[0].sessionIndex).toBe(0)
  })

  it('emits no alert when grouped exercises are antagonist pairs', () => {
    const result = scoreSuperset([sessionWithAntagonist])
    expect(result.alerts).toHaveLength(0)
  })

  it('emits no alert when no exercises have group_id', () => {
    const standaloneEx: BuilderExercise = {
      name: 'Squat', sets: 4, reps: '6-8', rest_sec: 120, rir: 1,
      notes: '', movement_pattern: 'squat_pattern', equipment_required: ['barbell'],
      primary_muscles: ['quadriceps', 'fessiers'], secondary_muscles: [],
    }
    const result = scoreSuperset([{ name: 'Leg Day', day_of_week: 1, exercises: [standaloneEx] }])
    expect(result.alerts).toHaveLength(0)
  })
})
