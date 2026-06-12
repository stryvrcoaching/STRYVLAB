import { describe, expect, it } from 'vitest'
import { estimateCaffeineMg, inferDrinkTypeFromFoodItem } from '@/lib/client/nutrition/drinks'

describe('drink presets', () => {
  it('scales caffeine for an espresso preset', () => {
    expect(estimateCaffeineMg('espresso', 40)).toBe(80)
  })

  it('detects tea from drink names', () => {
    expect(inferDrinkTypeFromFoodItem({
      name_fr: 'Thé vert',
      category_l1: 'drinks',
      category_l2: 'chauds',
    })).toBe('tea')
  })

  it('detects coffee from generic hot drinks', () => {
    expect(inferDrinkTypeFromFoodItem({
      name_fr: 'Café filtre',
      category_l1: 'drinks',
      category_l2: 'chauds',
    })).toBe('coffee')
  })
})

