import { describe, it, expect } from 'vitest'
import { canonicalizeFieldKey, canonicalizeFields } from '@/lib/client/checkin/legacyFieldMap'

describe('legacyFieldMap', () => {
  it('maps each legacy key to a canonical key', () => {
    expect(canonicalizeFieldKey('sleep_duration')).toBe('sleep_hours')
    expect(canonicalizeFieldKey('energy')).toBe('energy_level')
    expect(canonicalizeFieldKey('energy_evening')).toBe('energy_level')
    expect(canonicalizeFieldKey('stress')).toBe('stress_level')
    expect(canonicalizeFieldKey('mood')).toBe('stress_level')
  })

  it('passes through already-canonical keys', () => {
    expect(canonicalizeFieldKey('sleep_quality')).toBe('sleep_quality')
    expect(canonicalizeFieldKey('rhr_morning')).toBe('rhr_morning')
  })

  it('dedupes after mapping (energy + energy_evening -> single energy_level)', () => {
    expect(canonicalizeFields(['energy', 'energy_evening', 'stress'])).toEqual(['energy_level', 'stress_level'])
  })

  it('drops unknown keys', () => {
    expect(canonicalizeFields(['sleep_duration', 'totally_unknown'])).toEqual(['sleep_hours'])
  })
})
