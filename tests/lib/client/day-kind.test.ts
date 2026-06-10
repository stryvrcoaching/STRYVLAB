import { describe, expect, it } from 'vitest'
import { resolveEffectiveDayKind, toNutritionWeekdayKind } from '@/lib/client/day-kind'

describe('day kind resolution', () => {
  it('prefers off override over training schedule', () => {
    const kind = resolveEffectiveDayKind({
      weekdayKind: 'training',
      overrideKind: 'off',
    })
    expect(kind).toBe('off_override')
    expect(toNutritionWeekdayKind(kind)).toBe('rest')
  })

  it('keeps schedule kind when no override exists', () => {
    const kind = resolveEffectiveDayKind({
      weekdayKind: 'rest_with_activity',
      overrideKind: null,
    })
    expect(kind).toBe('rest_with_activity')
    expect(toNutritionWeekdayKind(kind)).toBe('rest_with_activity')
  })
})
