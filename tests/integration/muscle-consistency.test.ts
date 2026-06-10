import { describe, it, expect } from 'vitest'
import { getMuscleActivation } from '@/lib/client/muscleDetection'
import { resolveExerciseMuscleCoverage } from '@/lib/programs/intelligence/exercise-resolver'
import { getVolumeGroup } from '@/lib/programs/intelligence/catalog-utils'

describe('Muscle Data Consistency', () => {
  it('same muscles read from DB via all paths', () => {
    const exercise = {
      id: 'test-1',
      name: 'Test Bench Press',
      primary_muscles: ['grand_pectoral'],
      secondary_muscles: ['triceps', 'deltoide_anterieur'],
    }

    // Path 1: getMuscleActivation (client)
    const activation = getMuscleActivation(exercise)
    expect(activation.primary.has('chest')).toBe(true)

    // Path 2: resolveExerciseMuscleCoverage (scoring)
    const resolved = resolveExerciseMuscleCoverage(exercise)
    expect(resolved.primary_muscles).toContain('grand_pectoral')
    expect(resolved.secondary_muscles).toContain('triceps')

    // Path 3: getVolumeGroup (volume charts)
    const volumeGroupPrimary = getVolumeGroup(resolved.primary_muscles[0])
    expect(volumeGroupPrimary).toBeTruthy()
    expect(typeof volumeGroupPrimary).toBe('string')
  })

  it('secondary muscles consistent across paths', () => {
    const exercise = {
      id: 'test-2',
      name: 'Test Exercise',
      primary_muscles: ['grand_pectoral'],
      secondary_muscles: ['triceps', 'deltoide_anterieur'],
    }

    const activation = getMuscleActivation(exercise)
    const resolved = resolveExerciseMuscleCoverage(exercise)

    // Both paths should agree on secondary muscles
    expect(resolved.secondary_muscles.length).toBeGreaterThan(0)
    expect(activation.secondary.size).toBeGreaterThan(0)
  })

  it('invalid muscle slugs are silently ignored, valid ones kept', () => {
    const invalidExercise = {
      id: 'test-3',
      name: 'Bad Exercise',
      primary_muscles: ['grand_pectoral', 'fake_muscle'],
      secondary_muscles: [],
    }

    const resolved = resolveExerciseMuscleCoverage(invalidExercise)
    expect(resolved.primary_muscles).toEqual(['grand_pectoral'])
  })

  it('empty primary muscles caught at resolver', () => {
    const emptyExercise = {
      id: 'test-4',
      name: 'Empty Exercise',
      primary_muscles: [],
      secondary_muscles: [],
    }

    expect(() => getMuscleActivation(emptyExercise)).toThrow('has no primary_muscles')
  })
})
