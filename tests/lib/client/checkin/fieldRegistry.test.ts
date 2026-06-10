import { describe, it, expect } from 'vitest'
import {
  CHECKIN_FIELDS,
  getFieldsForFlow,
  orderedByWaking,
  getFieldDef,
} from '@/lib/client/checkin/fieldRegistry'

describe('fieldRegistry', () => {
  it('exposes a def per canonical key with a DB column', () => {
    expect(getFieldDef('rhr_morning')?.dbColumn).toBe('rhr_morning')
    expect(getFieldDef('sleep_hours')?.dbColumn).toBe('sleep_hours')
    expect(getFieldDef('weight_kg')?.dbColumn).toBe('weight_kg')
  })

  it('morning flow includes BPM and weight (regression: config used to omit them)', () => {
    const keys = getFieldsForFlow('morning').map((f) => f.key)
    expect(keys).toContain('rhr_morning')
    expect(keys).toContain('weight_kg')
    expect(keys).toContain('sleep_hours')
  })

  it('orders morning waking actions BPM -> sleep_hours -> sleep_quality -> energy -> weight (D6)', () => {
    const ordered = orderedByWaking(['weight_kg', 'energy_level', 'rhr_morning', 'sleep_hours', 'sleep_quality'])
    expect(ordered.map((f) => f.key)).toEqual([
      'rhr_morning',
      'sleep_hours',
      'sleep_quality',
      'energy_level',
      'weight_kg',
    ])
  })

  it('evening flow excludes morning-only fields', () => {
    const keys = getFieldsForFlow('evening').map((f) => f.key)
    expect(keys).toContain('stress_level')
    expect(keys).toContain('daily_steps')
    expect(keys).not.toContain('rhr_morning')
    expect(keys).not.toContain('weight_kg')
  })

  it('every field has a French label', () => {
    for (const f of CHECKIN_FIELDS) {
      expect(f.label.length).toBeGreaterThan(0)
    }
  })
})
