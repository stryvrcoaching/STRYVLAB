import { describe, expect, it } from 'vitest'

import { selectHistoryReference } from '@/lib/training/historyReference'

describe('selectHistoryReference', () => {
  it('hypertrophy favors the closest RIR and reps match over a stronger but non-comparable set', () => {
    const result = selectHistoryReference({
      entries: [
        { weight: 47, reps: 12, rir: 0, set_number: 2, side: 'bilateral', completed_at: '2026-06-18T10:00:00.000Z' },
        { weight: 34.5, reps: 12, rir: 3, set_number: 2, side: 'bilateral', completed_at: '2026-06-20T10:00:00.000Z' },
      ],
      side: 'bilateral',
      setNumber: 2,
      plannedReps: 12,
      targetRir: 3,
      goal: 'hypertrophy',
    })

    expect(result).not.toBeNull()
    expect(result!.weight).toBe(34.5)
    expect(result!.reps).toBe(12)
    expect(result!.rir).toBe(3)
    expect(result!.quality).toBe('ideal')
  })

  it('hypertrophy rejects references that are too far from the target RIR', () => {
    const result = selectHistoryReference({
      entries: [
        { weight: 32, reps: 20, rir: 5, set_number: 1, side: 'bilateral', completed_at: '2026-06-20T10:00:00.000Z' },
      ],
      side: 'bilateral',
      setNumber: 1,
      plannedReps: 20,
      targetRir: 3,
      goal: 'hypertrophy',
    })

    expect(result).toBeNull()
  })

  it('strength allows a slightly wider RIR band but still prefers exact reps matching', () => {
    const result = selectHistoryReference({
      entries: [
        { weight: 120, reps: 4, rir: 2, set_number: 1, side: 'bilateral', completed_at: '2026-06-20T10:00:00.000Z' },
        { weight: 122.5, reps: 6, rir: 1, set_number: 1, side: 'bilateral', completed_at: '2026-06-20T10:00:00.000Z' },
      ],
      side: 'bilateral',
      setNumber: 1,
      plannedReps: 4,
      targetRir: 1,
      goal: 'strength',
    })

    expect(result).not.toBeNull()
    expect(result!.weight).toBe(120)
    expect(result!.reps).toBe(4)
  })

  it('returns an acceptable reference when the set is close but not ideal', () => {
    const result = selectHistoryReference({
      entries: [
        { weight: 35, reps: 13, rir: 2, set_number: 1, side: 'bilateral', completed_at: '2026-06-20T10:00:00.000Z' },
      ],
      side: 'bilateral',
      setNumber: 1,
      plannedReps: 10,
      targetRir: 1,
      goal: 'hypertrophy',
    })

    expect(result).not.toBeNull()
    expect(result!.quality).toBe('acceptable')
  })
})
