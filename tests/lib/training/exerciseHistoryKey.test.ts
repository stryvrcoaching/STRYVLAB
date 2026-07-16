import { describe, expect, it } from 'vitest'
import {
  getExerciseHistoryEntries,
  getExerciseHistoryKeys,
  indexExerciseHistoryEntry,
  resolveCanonicalExerciseKey,
  resolveCanonicalExerciseName,
} from '@/lib/training/exerciseHistoryKey'

describe('exerciseHistoryKey', () => {
  it('keeps a shared catalog key for equivalent exercise labels', () => {
    const canonicalKeys = getExerciseHistoryKeys('Face pull')
    const aliasKeys = getExerciseHistoryKeys('Tirage visage')

    expect(canonicalKeys.some((key) => key.startsWith('catalog:'))).toBe(true)
    expect(aliasKeys.some((key) => canonicalKeys.includes(key))).toBe(true)
  })

  it('retrieves history indexed under an equivalent label', () => {
    const index: Record<string, Array<{ weight: number; reps: number }>> = {}
    const entry = { weight: 42, reps: 13 }

    indexExerciseHistoryEntry(index, 'Tirage visage', entry)

    expect(getExerciseHistoryEntries(index, 'Face pull')).toEqual([entry])
  })

  it('deduplicates entries stored under multiple keys', () => {
    const index: Record<string, Array<{ weight: number; reps: number }>> = {}
    const entry = { weight: 18, reps: 20 }

    indexExerciseHistoryEntry(index, 'Face pull', entry)

    expect(getExerciseHistoryEntries(index, 'Face pull')).toEqual([entry])
  })

  it('resolves the same canonical key across equivalent labels', () => {
    expect(resolveCanonicalExerciseKey('Tirage visage')).toBe(resolveCanonicalExerciseKey('Face pull'))
  })

  it('prefers the catalog display name when available', () => {
    expect(resolveCanonicalExerciseName('Tirage visage')).toBe('Face pull')
  })
})
