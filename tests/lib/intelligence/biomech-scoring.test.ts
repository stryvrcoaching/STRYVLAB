import { describe, it, expect } from 'vitest'
import { buildIntelligenceResult } from '@/lib/programs/intelligence/scoring'
import { scoreAlternatives } from '@/lib/programs/intelligence/alternatives'
import type { BuilderSession, TemplateMeta, IntelligenceProfile } from '@/lib/programs/intelligence/types'

const meta: TemplateMeta = {
  goal: 'hypertrophy', level: 'intermediate', weeks: 8, frequency: 3, equipment_archetype: 'full_gym'
}

function makeExercise(name: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    sets: 3, reps: '8-12', rest_sec: 90, rir: 2, notes: '',
    movement_pattern: 'hip_hinge',
    equipment_required: ['barbell'],
    primary_muscles: ['dos', 'fessiers'],
    secondary_muscles: [],
    is_compound: true,
    ...overrides,
  }
}

describe('scoreJointLoad', () => {
  it('emits JOINT_OVERLOAD critical when spine stress high on spine injury', () => {
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [
        makeExercise('Deadlift', { jointStressSpine: 8, sets: 4 }),
        makeExercise('Good Morning', { jointStressSpine: 7, sets: 3 }),
        makeExercise('Romanian DL', { jointStressSpine: 6, sets: 3 }),
      ],
    }
    const profile: IntelligenceProfile = {
      injuries: [{ bodyPart: 'lower_back', severity: 'avoid' }],
      equipment: [],
    }
    const result = buildIntelligenceResult([session], meta, profile)
    const alert = result.alerts.find(a => a.code === 'JOINT_OVERLOAD')
    expect(alert).toBeDefined()
    expect(alert?.severity).toBe('critical')
  })

  it('does not emit JOINT_OVERLOAD when no injury profile', () => {
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [makeExercise('Deadlift', { jointStressSpine: 8 })],
    }
    const result = buildIntelligenceResult([session], meta, undefined)
    expect(result.alerts.find(a => a.code === 'JOINT_OVERLOAD')).toBeUndefined()
  })

  it('emits JOINT_OVERLOAD warning when shoulder stress moderate on shoulder injury', () => {
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [
        makeExercise('Overhead Press', { jointStressShoulder: 5, sets: 3 }),
        makeExercise('Lateral Raise', { jointStressShoulder: 4, sets: 3 }),
      ],
    }
    const profile: IntelligenceProfile = {
      injuries: [{ bodyPart: 'shoulder_right', severity: 'limit' }],
      equipment: [],
    }
    const result = buildIntelligenceResult([session], meta, profile)
    const alert = result.alerts.find(a => a.code === 'JOINT_OVERLOAD')
    expect(alert?.severity).toBe('warning')
  })
})

describe('scoreAlternatives biomech criteria', () => {
  const altContext = {
    equipmentArchetype: 'full_gym', goal: 'hypertrophy',
    level: 'intermediate', sessionExercises: [] as never[],
  }

  it('runs without crash when biomech fields present', () => {
    const original = {
      name: 'Curl barre', movement_pattern: 'elbow_flexion',
      equipment_required: ['barbell'], primary_muscles: ['biceps'],
      secondary_muscles: [], is_compound: false,
      constraintProfile: 'free_weight', unilateral: false, primaryActivation: 0.85,
    }
    expect(() => scoreAlternatives(original as never, altContext)).not.toThrow()
  })

  it('runs without crash with activation delta', () => {
    const original = {
      name: 'Deadlift', movement_pattern: 'hip_hinge',
      equipment_required: ['barbell'], primary_muscles: ['dos', 'fessiers'],
      secondary_muscles: [], is_compound: true, primaryActivation: 0.9,
    }
    expect(() => scoreAlternatives(original as never, altContext)).not.toThrow()
  })
})

describe('scoreCoordination', () => {
  it('emits COORDINATION_MISMATCH warning for beginner with high coordination exercises', () => {
    const beginnerMeta: TemplateMeta = { ...meta, level: 'beginner' }
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [
        makeExercise('Snatch', { coordinationDemand: 9, globalInstability: 8 }),
        makeExercise('Pistol Squat', { coordinationDemand: 8, globalInstability: 7 }),
      ],
    }
    const result = buildIntelligenceResult([session], beginnerMeta, undefined)
    expect(result.alerts.find(a => a.code === 'COORDINATION_MISMATCH')).toBeDefined()
  })

  it('does not emit COORDINATION_MISMATCH for intermediate with high coordination', () => {
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [makeExercise('Snatch', { coordinationDemand: 9 })],
    }
    const result = buildIntelligenceResult([session], meta, undefined)
    expect(result.alerts.find(a => a.code === 'COORDINATION_MISMATCH')).toBeUndefined()
  })

  it('emits COORDINATION_MISMATCH critical for beginner avg > 7.5', () => {
    const beginnerMeta: TemplateMeta = { ...meta, level: 'beginner' }
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [
        makeExercise('Ex1', { coordinationDemand: 9, globalInstability: 9 }),
        makeExercise('Ex2', { coordinationDemand: 8, globalInstability: 8 }),
      ],
    }
    const result = buildIntelligenceResult([session], beginnerMeta, undefined)
    const alert = result.alerts.find(a => a.code === 'COORDINATION_MISMATCH')
    expect(alert?.severity).toBe('critical')
  })
})
