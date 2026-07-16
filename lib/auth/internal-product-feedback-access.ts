export interface InternalProductFeedbackAccessResult {
  allowed: boolean
  mode: 'ops_allowlist' | 'legacy_uuid_allowlist' | 'unset'
}

function parseCsvEnv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function resolveInternalProductFeedbackAccess(params: {
  userId: string
  email?: string | null
}): InternalProductFeedbackAccessResult {
  const { userId, email } = params
  const opsUserIds = parseCsvEnv(process.env.INTERNAL_OPS_USER_IDS)
  const opsEmails = parseCsvEnv(process.env.INTERNAL_OPS_EMAILS).map((value) => value.toLowerCase())
  const legacyUserIds = parseCsvEnv(process.env.INTERNAL_PRODUCT_FEEDBACK_USER_IDS)
  const normalizedEmail = String(email ?? '').trim().toLowerCase()

  // INTERNAL_OPS is the source of truth for every internal dashboard.
  // The legacy variable remains supported so existing production access is never
  // widened or interrupted during the migration.
  if (opsUserIds.length > 0 || opsEmails.length > 0) {
    return {
      allowed: opsUserIds.includes(userId) || (normalizedEmail ? opsEmails.includes(normalizedEmail) : false),
      mode: 'ops_allowlist',
    }
  }

  if (legacyUserIds.length === 0) {
    return { allowed: false, mode: 'unset' }
  }

  return {
    allowed: legacyUserIds.includes(userId),
    mode: 'legacy_uuid_allowlist',
  }
}
