import { Resend } from 'resend'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderStryvEmail } from '@/lib/email/template'
import {
  maybeSendSecurityEventAlert,
  recordSecurityEvent,
  upsertSecurityIncident,
} from '@/lib/security/security-events'

type AuditOutcome = 'allowed' | 'denied' | 'rate_limited' | 'unauthenticated'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

function parseCsvEnv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function getRequestIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return 'unknown'
}

export async function writeDashboardAccessAudit(params: {
  db: SupabaseClient
  dashboardKey: string
  req: NextRequest
  outcome: AuditOutcome
  reason?: string
  userId?: string | null
  userEmail?: string | null
  alertSent?: boolean
}) {
  const { db, dashboardKey, req, outcome, reason, userId, userEmail, alertSent } = params

  await db.from('internal_dashboard_access_audit').insert({
    dashboard_key: dashboardKey,
    user_id: userId ?? null,
    user_email: userEmail ?? null,
    ip_address: getRequestIp(req),
    user_agent: req.headers.get('user-agent'),
    request_method: req.method,
    request_path: req.nextUrl.pathname,
    outcome,
    reason: reason ?? null,
    alert_sent: alertSent ?? false,
  })

  const severity =
    outcome === 'denied' || outcome === 'rate_limited'
      ? 'high'
      : outcome === 'unauthenticated'
        ? 'medium'
        : 'low'

  await recordSecurityEvent({
    db,
    eventType: `internal_dashboard_${outcome}`,
    severity,
    actorType: userId ? 'internal' : 'anonymous',
    actorUserId: userId ?? null,
    actorEmail: userEmail ?? null,
    ipAddress: getRequestIp(req),
    userAgent: req.headers.get('user-agent'),
    requestPath: req.nextUrl.pathname,
    requestMethod: req.method,
    resourceType: 'dashboard',
    resourceId: dashboardKey,
    outcome:
      outcome === 'allowed'
        ? 'success'
        : outcome === 'unauthenticated'
          ? 'failure'
          : 'blocked',
    reason: reason ?? null,
    meta: {
      dashboardKey,
      alertSent: alertSent ?? false,
    },
  })

  if (outcome === 'denied' || outcome === 'rate_limited') {
    await upsertSecurityIncident({
      db,
      source: 'security',
      severity: outcome === 'rate_limited' ? 'high' : 'critical',
      title: outcome === 'rate_limited'
        ? 'Rate limit déclenché sur dashboard interne'
        : 'Tentative d’accès refusée sur dashboard interne',
      description: `Dashboard ${dashboardKey} — ${reason ?? 'sans raison précisée'}`,
      dedupeKey: `${dashboardKey}:${getRequestIp(req)}:${reason ?? outcome}`,
      actorUserId: userId ?? null,
      actorEmail: userEmail ?? null,
      ipAddress: getRequestIp(req),
      route: req.nextUrl.pathname,
      meta: {
        outcome,
        requestMethod: req.method,
      },
    })
  }
}

export async function isDashboardRateLimited(params: {
  db: SupabaseClient
  dashboardKey: string
  req: NextRequest
  windowMinutes?: number
  maxAttempts?: number
}) {
  const {
    db,
    dashboardKey,
    req,
    windowMinutes = 5,
    maxAttempts = 20,
  } = params

  const ipAddress = getRequestIp(req)
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  const { count } = await db
    .from('internal_dashboard_access_audit')
    .select('id', { count: 'exact', head: true })
    .eq('dashboard_key', dashboardKey)
    .eq('ip_address', ipAddress)
    .gte('created_at', since)

  return (count ?? 0) >= maxAttempts
}

export async function maybeSendDashboardSecurityAlert(params: {
  db: SupabaseClient
  dashboardKey: string
  req: NextRequest
  reason: string
  userId?: string | null
  userEmail?: string | null
}) {
  const alertRecipients = parseCsvEnv(
    process.env.INTERNAL_SECURITY_ALERT_TO ?? process.env.INTERNAL_PRODUCT_FEEDBACK_ALERT_TO,
  )

  if (!resend || alertRecipients.length === 0) {
    return false
  }

  const ipAddress = getRequestIp(params.req)
  const cooldownSince = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const { count } = await params.db
    .from('internal_dashboard_access_audit')
    .select('id', { count: 'exact', head: true })
    .eq('dashboard_key', params.dashboardKey)
    .eq('ip_address', ipAddress)
    .eq('reason', params.reason)
    .eq('alert_sent', true)
    .gte('created_at', cooldownSince)

  if ((count ?? 0) > 0) {
    return false
  }

  await resend.emails.send({
    from: `STRYVR Security <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
    to: alertRecipients,
    subject: `[SECURITY] Tentative d'accès refusée — ${params.dashboardKey}`,
    html: renderStryvEmail({
      productLabel: 'Sécurité',
      body: `
        <h2 style="margin:0 0 16px">Tentative d'accès refusée</h2>
        <p><strong>Dashboard :</strong> ${params.dashboardKey}</p>
        <p><strong>Raison :</strong> ${params.reason}</p>
        <p><strong>IP :</strong> ${ipAddress}</p>
        <p><strong>Utilisateur :</strong> ${params.userEmail ?? 'non authentifié'}</p>
        <p><strong>User ID :</strong> ${params.userId ?? '—'}</p>
        <p><strong>Route :</strong> ${params.req.nextUrl.pathname}</p>
        <p><strong>Méthode :</strong> ${params.req.method}</p>
        <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>
      `,
    }),
  })

  await maybeSendSecurityEventAlert({
    db: params.db,
    eventType: `dashboard_alert_${params.reason}`,
    severity: params.reason === 'too_many_requests' ? 'high' : 'critical',
    actorEmail: params.userEmail ?? null,
    actorUserId: params.userId ?? null,
    ipAddress,
    requestPath: params.req.nextUrl.pathname,
    requestMethod: params.req.method,
    reason: params.reason,
    meta: {
      dashboardKey: params.dashboardKey,
    },
  })

  return true
}
