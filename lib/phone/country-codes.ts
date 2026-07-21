/**
 * Common dial codes for coach phone / WhatsApp fields.
 * dial: E.164 country calling code without + or 00.
 */

export type PhoneCountry = {
  iso: string
  name: string
  dial: string
  /** Optional national trunk prefix to strip (e.g. FR/BE "0") */
  trunk?: string
  /** Rough expected national length after trunk strip */
  nationalLength?: number
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'BE', name: 'Belgique', dial: '32', trunk: '0', nationalLength: 9 },
  { iso: 'FR', name: 'France', dial: '33', trunk: '0', nationalLength: 9 },
  { iso: 'CH', name: 'Suisse', dial: '41', trunk: '0', nationalLength: 9 },
  { iso: 'LU', name: 'Luxembourg', dial: '352', nationalLength: 9 },
  { iso: 'CA', name: 'Canada', dial: '1', nationalLength: 10 },
  { iso: 'US', name: 'États-Unis', dial: '1', nationalLength: 10 },
  { iso: 'GB', name: 'Royaume-Uni', dial: '44', trunk: '0', nationalLength: 10 },
  { iso: 'DE', name: 'Allemagne', dial: '49', trunk: '0', nationalLength: 11 },
  { iso: 'ES', name: 'Espagne', dial: '34', nationalLength: 9 },
  { iso: 'IT', name: 'Italie', dial: '39', nationalLength: 10 },
  { iso: 'PT', name: 'Portugal', dial: '351', nationalLength: 9 },
  { iso: 'NL', name: 'Pays-Bas', dial: '31', trunk: '0', nationalLength: 9 },
  { iso: 'MA', name: 'Maroc', dial: '212', trunk: '0', nationalLength: 9 },
  { iso: 'TN', name: 'Tunisie', dial: '216', nationalLength: 8 },
  { iso: 'DZ', name: 'Algérie', dial: '213', trunk: '0', nationalLength: 9 },
  { iso: 'SN', name: 'Sénégal', dial: '221', nationalLength: 9 },
  { iso: 'CI', name: 'Côte d’Ivoire', dial: '225', nationalLength: 10 },
  { iso: 'RE', name: 'La Réunion', dial: '262', trunk: '0', nationalLength: 9 },
  { iso: 'GP', name: 'Guadeloupe', dial: '590', trunk: '0', nationalLength: 9 },
  { iso: 'MQ', name: 'Martinique', dial: '596', trunk: '0', nationalLength: 9 },
]

export const DEFAULT_PHONE_COUNTRY_ISO = 'BE'

export function findPhoneCountry(iso: string): PhoneCountry {
  return (
    PHONE_COUNTRIES.find((c) => c.iso === iso) ??
    PHONE_COUNTRIES.find((c) => c.iso === DEFAULT_PHONE_COUNTRY_ISO)!
  )
}

export function findCountryByDial(dial: string): PhoneCountry | undefined {
  // Longest match first (352 before 32, 262 before 26…)
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)
  return sorted.find((c) => dial.startsWith(c.dial))
}
