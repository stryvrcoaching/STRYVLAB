import { describe, expect, it } from 'vitest'
import {
  hasValidMinorAuthorization,
  isMinor,
  normalizeDateOfBirth,
  validateGuardianDetails,
} from '@/lib/privacy/minor-authorization'

const referenceDate = new Date('2026-07-15T12:00:00.000Z')

describe('minor authorization', () => {
  it('uses the eighteenth birthday as the boundary', () => {
    expect(isMinor('2008-07-16', referenceDate)).toBe(true)
    expect(isMinor('2008-07-15', referenceDate)).toBe(false)
  })

  it('rejects impossible, future and implausibly old birth dates', () => {
    expect(normalizeDateOfBirth('2026-02-30', referenceDate).valid).toBe(false)
    expect(normalizeDateOfBirth('2026-07-16', referenceDate).valid).toBe(false)
    expect(normalizeDateOfBirth('1900-01-01', referenceDate).valid).toBe(false)
  })

  it('normalizes and validates guardian evidence', () => {
    expect(validateGuardianDetails(' Marie Dupont ', ' Parent@Example.com ')).toEqual({
      valid: true,
      name: 'Marie Dupont',
      email: 'parent@example.com',
    })
    expect(validateGuardianDetails('', 'invalid')).toMatchObject({ valid: false })
  })

  it('requires complete evidence only for minors', () => {
    expect(hasValidMinorAuthorization({ date_of_birth: '1990-01-01' })).toBe(true)
    expect(hasValidMinorAuthorization({ date_of_birth: '2012-01-01' })).toBe(false)
    expect(hasValidMinorAuthorization({
      date_of_birth: '2012-01-01',
      minor_authorization_status: 'authorized',
      minor_guardian_name: 'Marie Dupont',
      minor_guardian_email: 'parent@example.com',
      minor_authorization_confirmed_at: '2026-07-15T12:00:00.000Z',
    })).toBe(true)
  })
})
