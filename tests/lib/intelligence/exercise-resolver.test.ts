import { describe, it, expect } from 'vitest'
import {
  resolveExerciseMuscleCoverage,
  resolveExercisesMusclesCoverage,
} from '@/lib/programs/intelligence/exercise-resolver'

describe('Exercise Resolver', () => {
  it('resolves exercise with valid primary_muscles', () => {
    const resolved = resolveExerciseMuscleCoverage({
      id: '1',
      name: 'Barbell Bench Press',
      primary_muscles: ['grand_pectoral'],
      secondary_muscles: ['triceps', 'deltoide_anterieur'],
    })

    expect(resolved.primary_muscles).toEqual(['grand_pectoral'])
    expect(resolved.secondary_muscles).toEqual(['triceps', 'deltoide_anterieur'])
  })

  it('normalizes legacy primary_muscles', () => {
    const resolved = resolveExerciseMuscleCoverage({
      id: '2',
      name: 'Chest Press',
      primary_muscles: ['chest'],
      secondary_muscles: [],
    })

    expect(resolved.primary_muscles).toEqual(['grand_pectoral'])
  })

  it('throws if primary_muscles is empty', () => {
    expect(() =>
      resolveExerciseMuscleCoverage({
        id: '3',
        name: 'Unknown Exercise',
        primary_muscles: [],
        secondary_muscles: [],
      })
    ).toThrow('has no primary_muscles')
  })

  it('throws if all primary_muscles are invalid (none survive normalization)', () => {
    expect(() =>
      resolveExerciseMuscleCoverage({
        id: '4',
        name: 'Bad Exercise',
        primary_muscles: ['fake_muscle'],
        secondary_muscles: [],
      })
    ).toThrow('has no recognized primary_muscles after normalization')
  })

  it('dedupes secondary_muscles', () => {
    const resolved = resolveExerciseMuscleCoverage({
      id: '5',
      name: 'Squat',
      primary_muscles: ['quadriceps'],
      secondary_muscles: ['quadriceps', 'grand_fessier', 'QUADRICEPS'],
    })

    expect(resolved.secondary_muscles).toEqual(['quadriceps', 'grand_fessier'])
  })

  it('allows null movement_pattern', () => {
    const resolved = resolveExerciseMuscleCoverage({
      id: '6',
      name: 'Custom',
      primary_muscles: ['grand_pectoral'],
      secondary_muscles: [],
      movement_pattern: null,
    })

    expect(resolved.movement_pattern).toBe(null)
  })

  describe('Batch resolve', () => {
    it('separates valid from invalid exercises', () => {
      const result = resolveExercisesMusclesCoverage([
        {
          id: '1',
          name: 'Valid Exercise',
          primary_muscles: ['grand_pectoral'],
          secondary_muscles: [],
        },
        {
          id: '2',
          name: 'Invalid Exercise',
          primary_muscles: [],
          secondary_muscles: [],
        },
      ])

      expect(result.valid).toHaveLength(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('has no primary_muscles')
    })

    it('collects all errors without stopping', () => {
      const result = resolveExercisesMusclesCoverage([
        { id: '1', name: 'Ex1', primary_muscles: [], secondary_muscles: [] },
        { id: '2', name: 'Ex2', primary_muscles: ['fake'], secondary_muscles: [] },
        { id: '3', name: 'Ex3', primary_muscles: [], secondary_muscles: [] },
      ])

      expect(result.valid).toHaveLength(0)
      expect(result.errors).toHaveLength(3)
    })
  })
})
