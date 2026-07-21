import {
  DEFAULT_PHONE_COUNTRY_ISO,
  findCountryByDial,
  findPhoneCountry,
  type PhoneCountry,
} from '@/lib/phone/country-codes'

export type ParsedPhone = {
  countryIso: string
  /** Digits only, country code + national (no +) */
  e164Digits: string
  /** National significant number (no trunk 0) */
  national: string
  /** Display for input: usually national as user types */
  nationalDisplay: string
}

/** Strip to digits only; convert leading 00 → international. */
export function digitsOnly(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  return d
}

/**
 * Parse free-form phone into country + national parts.
 * Defaults to BE when ambiguous / empty.
 */
export function parsePhone(
  raw: string | null | undefined,
  fallbackIso: string = DEFAULT_PHONE_COUNTRY_ISO,
): ParsedPhone {
  const fallback = findPhoneCountry(fallbackIso)
  if (!raw?.trim()) {
    return {
      countryIso: fallback.iso,
      e164Digits: '',
      national: '',
      nationalDisplay: '',
    }
  }

  let digits = digitsOnly(raw)
  if (!digits) {
    return {
      countryIso: fallback.iso,
      e164Digits: '',
      national: '',
      nationalDisplay: '',
    }
  }

  // Already international with known dial code
  const byDial = findCountryByDial(digits)
  if (byDial && digits.length >= byDial.dial.length + 8) {
    const national = digits.slice(byDial.dial.length).replace(/^0+/, '')
    return {
      countryIso: byDial.iso,
      e164Digits: `${byDial.dial}${national}`,
      national,
      nationalDisplay: national,
    }
  }

  // Local 10-digit with trunk 0 — disambiguate BE vs FR
  // BE mobiles: 04xx… · FR mobiles: 06/07… · FR landline: 01–05, 09
  if (digits.length === 10 && digits.startsWith('0')) {
    const isBeMobile = digits.startsWith('04')
    const country = findPhoneCountry(isBeMobile ? 'BE' : 'FR')
    const national = digits.slice(1)
    return {
      countryIso: country.iso,
      e164Digits: `${country.dial}${national}`,
      national,
      nationalDisplay: national,
    }
  }

  // Local with trunk zero under default country
  const country = fallback
  let national = digits
  if (country.trunk && national.startsWith(country.trunk)) {
    national = national.slice(country.trunk.length)
  }

  return {
    countryIso: country.iso,
    e164Digits: national ? `${country.dial}${national}` : '',
    national,
    nationalDisplay: national,
  }
}

/**
 * Build E.164 digits from country + national input (user may type leading 0).
 */
export function composeE164(
  countryIso: string,
  nationalRaw: string,
): string {
  const country = findPhoneCountry(countryIso)
  let national = digitsOnly(nationalRaw)
  if (country.trunk && national.startsWith(country.trunk)) {
    national = national.slice(country.trunk.length)
  }
  // Avoid double country code if user pastes full number in national field
  if (national.startsWith(country.dial) && national.length > country.dial.length + 6) {
    national = national.slice(country.dial.length)
  }
  if (!national) return ''
  return `${country.dial}${national}`
}

/** Format for storage / WhatsApp: +3247… */
export function formatE164Plus(e164Digits: string): string {
  const d = digitsOnly(e164Digits)
  if (!d) return ''
  return `+${d}`
}

export function countryLabel(country: PhoneCountry): string {
  return `${country.iso} +${country.dial}`
}
