export type MinorAuthorizationStatus =
  | 'not_required'
  | 'authorization_required'
  | 'authorized'
  | 'revoked'

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeDateOfBirth(value: unknown, referenceDate = new Date()) {
  if (value === null || value === undefined || value === '') {
    return { valid: true as const, value: null }
  }

  if (typeof value !== 'string') {
    return { valid: false as const, error: 'Date de naissance invalide' }
  }

  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) return { valid: false as const, error: 'Date de naissance invalide' }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { valid: false as const, error: 'Date de naissance invalide' }
  }

  const today = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  ))
  const oldestAccepted = new Date(Date.UTC(today.getUTCFullYear() - 120, today.getUTCMonth(), today.getUTCDate()))

  if (date > today || date < oldestAccepted) {
    return { valid: false as const, error: 'Date de naissance invalide' }
  }

  return { valid: true as const, value }
}

export function isMinor(dateOfBirth: string | null | undefined, referenceDate = new Date()) {
  if (!dateOfBirth) return false

  const parsed = normalizeDateOfBirth(dateOfBirth, referenceDate)
  if (!parsed.valid || !parsed.value) return false

  const [year, month, day] = parsed.value.split('-').map(Number)
  let age = referenceDate.getUTCFullYear() - year
  const currentMonth = referenceDate.getUTCMonth() + 1
  const currentDay = referenceDate.getUTCDate()

  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1
  return age < 18
}

export function validateGuardianDetails(name: unknown, email: unknown) {
  const normalizedName = typeof name === 'string' ? name.trim() : ''
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

  if (normalizedName.length < 2 || normalizedName.length > 120) {
    return { valid: false as const, error: 'Le nom du représentant légal est requis' }
  }

  if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    return { valid: false as const, error: 'L’adresse e-mail du représentant légal est invalide' }
  }

  return {
    valid: true as const,
    name: normalizedName,
    email: normalizedEmail,
  }
}

export function hasValidMinorAuthorization(record: {
  date_of_birth?: string | null
  minor_authorization_status?: string | null
  minor_guardian_name?: string | null
  minor_guardian_email?: string | null
  minor_authorization_confirmed_at?: string | null
}) {
  if (!isMinor(record.date_of_birth)) return true

  return Boolean(
    record.minor_authorization_status === 'authorized' &&
    record.minor_guardian_name?.trim() &&
    record.minor_guardian_email?.trim() &&
    record.minor_authorization_confirmed_at,
  )
}
