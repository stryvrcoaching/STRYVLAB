import { describe, expect, it } from 'vitest'
import { trainingPointsForCompletedSets } from '@/lib/rewards/progression'

describe('trainingPointsForCompletedSets', () => {
  it('awards the full session reward when every planned set is complete', () => {
    expect(trainingPointsForCompletedSets(6, 6)).toBe(15)
  })

  it('scales the reward down for a partially completed session', () => {
    expect(trainingPointsForCompletedSets(1, 6)).toBe(2)
  })

  it('does not award training points without a completed planned set', () => {
    expect(trainingPointsForCompletedSets(0, 6)).toBe(0)
    expect(trainingPointsForCompletedSets(1, 0)).toBe(0)
  })
})
