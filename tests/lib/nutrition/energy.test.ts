import { describe, expect, it } from 'vitest'
import { computeMacroEnergy } from '@/lib/nutrition/energy'

describe('computeMacroEnergy', () => {
  it('calculates calories from macros with 4/4/9 rule', () => {
    expect(
      computeMacroEnergy({
        protein_g: 149,
        carbs_g: 179,
        fat_g: 103,
      }),
    ).toBe(2239)
  })

  it('returns 0 for empty input', () => {
    expect(
      computeMacroEnergy({
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      }),
    ).toBe(0)
  })
})
