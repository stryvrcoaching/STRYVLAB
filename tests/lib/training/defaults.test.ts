import { describe, expect, it } from 'vitest'
import { getDefaultTempo, normalizeTempoPreset } from '@/lib/training/tempo'
import { normalizeSetPrescriptions } from '@/lib/programs/setPrescriptions'
import { getDefaultReps } from '@/lib/training/setRecommendation'

describe('workout studio defaults', () => {
  it('uses the standard hypertrophy tempo when no movement pattern is known yet', () => {
    expect(getDefaultTempo(null, 'hypertrophy')).toBe('2-1-3-1')
  })

  it.each([
    ['strength', '3-6', 'X-0-2-0'],
    ['hypertrophy', '8-15', '2-1-3-1'],
    ['endurance', '12-20', '2-0-2-0'],
    ['fat_loss', '10-15', '2-0-2-0'],
    ['recomp', '8-15', '2-1-3-1'],
    ['maintenance', '8-12', '2-0-2-0'],
    ['athletic', '4-8', 'X-0-X-0'],
  ])('defines objective-specific defaults for %s', (goal, reps, tempo) => {
    expect(getDefaultReps(goal)).toBe(reps)
    expect(getDefaultTempo(null, goal)).toBe(tempo)
  })

  it('retains a valid French set-type value when prescriptions are normalized', () => {
    const [set] = normalizeSetPrescriptions(
      [{ set_type: 'warmup' }],
      { sets: 1, reps: '8-12', rest_sec: 90, rir: 2, tempo: '2-1-3-1' },
    )

    expect(set.set_type).toBe('warmup')
  })

  it('replaces a legacy custom tempo with the approved default when saving', () => {
    expect(normalizeTempoPreset('2-1-2-1-2', null, 'hypertrophy')).toBe('2-1-3-1')
  })
})
