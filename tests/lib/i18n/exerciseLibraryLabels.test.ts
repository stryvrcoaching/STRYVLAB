import { describe, expect, it } from 'vitest'
import {
  getExerciseLibraryMetadataLabel,
  getExerciseLibraryMovementLabel,
  getExerciseLibraryMuscleGroupLabel,
} from '@/lib/i18n/exerciseLibraryLabels'

describe('exercise library labels', () => {
  it('localizes muscle groups with a readable capitalized label', () => {
    expect(getExerciseLibraryMuscleGroupLabel('dos', 'fr')).toBe('Dos')
    expect(getExerciseLibraryMuscleGroupLabel('dos', 'en')).toBe('Back')
    expect(getExerciseLibraryMuscleGroupLabel('dos', 'es')).toBe('Espalda')
  })

  it('localizes movement patterns instead of showing their technical identifier', () => {
    expect(getExerciseLibraryMovementLabel('horizontal_pull', 'fr')).toBe('Tirage horizontal')
    expect(getExerciseLibraryMovementLabel('horizontal_pull', 'en')).toBe('Horizontal pull')
    expect(getExerciseLibraryMovementLabel('horizontal_pull', 'es')).toBe('Tirón horizontal')
  })

  it('keeps exercise cards concise and meaningful', () => {
    expect(getExerciseLibraryMetadataLabel({
      muscleGroup: 'dos',
      primaryMuscle: 'lats',
      lang: 'fr',
    })).toBe('Dos · Grands dorsaux')
  })
})
