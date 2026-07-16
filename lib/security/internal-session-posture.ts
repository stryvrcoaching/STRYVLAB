import type { NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getRequestIp } from '@/lib/security/internal-dashboard-guard'

type AuthMethod = {
  method?: string
  timestamp?: number
}

export type InternalSessionPosture = {
  currentLevel: string | null
  nextLevel: string | null
  verifiedFactorsCount: number
  methods: AuthMethod[]
  sessionExpiresAt: string | null
  latestAuthAt: string | null
  authAgeMinutes: number | null
  requiresAal2: boolean
  requireRecentAuthMinutes: number | null
  requiresTrustedIp: boolean
  ipAllowed: boolean
}

function parseCsvEnv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function readBooleanEnv(value: string | undefined) {
  return String(value ?? '').trim().toLowerCase() === 'true'
}

function readPositiveIntegerEnv(value: string | undefined): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf8')
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
}

function getLatestAuthTimestamp(methods: AuthMethod[]) {
  const timestamps = methods
    .map((item) => Number(item?.timestamp))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (timestamps.length === 0) return null
  return Math.max(...timestamps)
}

function isIpAllowed(ipAddress: string, allowedIps: string[]) {
  if (allowedIps.length === 0) return true
  return allowedIps.includes(ipAddress)
}

export async function getInternalSessionPosture(params: {
  supabase: SupabaseClient
  req: NextRequest
  user: User
}) {
  const { supabase, req, user } = params
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session
  const claimsResult = await supabase.auth.getClaims(session?.access_token)
  const aalResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const claims = claimsResult.data?.claims ?? parseJwtPayload(session?.access_token) ?? {}
  const methods = Array.isArray(claims.amr) ? (claims.amr as AuthMethod[]) : []
  const latestAuthTimestamp = getLatestAuthTimestamp(methods)
  const authAgeMinutes =
    latestAuthTimestamp == null
      ? null
      : Math.max(0, Math.round((Date.now() - latestAuthTimestamp * 1000) / 60000))
  const sessionExpiresAt =
    typeof session?.expires_at === 'number'
      ? new Date(session.expires_at * 1000).toISOString()
      : null
  const latestAuthAt =
    latestAuthTimestamp == null ? null : new Date(latestAuthTimestamp * 1000).toISOString()
  const verifiedFactorsCount = (user.factors ?? []).filter((factor) => factor.status === 'verified').length
  const requireRecentAuthMinutes = readPositiveIntegerEnv(process.env.INTERNAL_REQUIRE_RECENT_AUTH_MINUTES)
  const allowedIps = parseCsvEnv(process.env.INTERNAL_TRUSTED_IPS)
  const currentIp = getRequestIp(req)

  return {
    posture: {
      currentLevel: aalResult.data?.currentLevel ?? null,
      nextLevel: aalResult.data?.nextLevel ?? null,
      verifiedFactorsCount,
      methods,
      sessionExpiresAt,
      latestAuthAt,
      authAgeMinutes,
      requiresAal2: readBooleanEnv(process.env.INTERNAL_REQUIRE_AAL2),
      requireRecentAuthMinutes,
      requiresTrustedIp: allowedIps.length > 0,
      ipAllowed: isIpAllowed(currentIp, allowedIps),
    } satisfies InternalSessionPosture,
    policy: {
      requireAal2: readBooleanEnv(process.env.INTERNAL_REQUIRE_AAL2),
      requireRecentAuthMinutes,
      trustedIpsConfigured: allowedIps.length > 0,
    },
  }
}

export function evaluateInternalSessionPosture(posture: InternalSessionPosture) {
  if (posture.requiresTrustedIp && !posture.ipAllowed) {
    return { ok: false, reason: 'ip_not_allowlisted' as const }
  }

  if (posture.requiresAal2 && posture.currentLevel !== 'aal2') {
    return { ok: false, reason: 'mfa_required' as const }
  }

  if (
    posture.requireRecentAuthMinutes != null &&
    (posture.authAgeMinutes == null || posture.authAgeMinutes > posture.requireRecentAuthMinutes)
  ) {
    return { ok: false, reason: 'reauth_required' as const }
  }

  return { ok: true as const }
}
