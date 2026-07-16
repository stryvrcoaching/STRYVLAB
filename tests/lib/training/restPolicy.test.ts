import { describe, expect, it } from 'vitest'
import { getDefaultRestSec, shouldStartPrescribedRest } from '@/lib/training/restPolicy'

describe('prescribed rest policy', () => {
  it('only starts a rest timer for a positive prescription', () => {
    expect(shouldStartPrescribedRest(null)).toBe(false)
    expect(shouldStartPrescribedRest(0)).toBe(false)
    expect(shouldStartPrescribedRest(15)).toBe(true)
  })

  it.each([
    ['strength', 180],
    ['hypertrophy', 90],
    ['endurance', 45],
    ['fat_loss', 45],
    ['recomp', 75],
    ['maintenance', 90],
    ['athletic', 120],
  ])('uses %is as the objective default for %s', (goal, restSec) => {
    expect(getDefaultRestSec(goal)).toBe(restSec)
  })
})
