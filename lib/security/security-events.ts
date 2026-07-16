import { headers } from 'next/headers'
import { Resend } from 'resend'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderStryvEmail } from '@/lib/email/template'

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical'
export type SecurityActorType = 'anonymous' | 'client' | 'coach' | 'internal' | 'system'
export type SecurityOutcome = 'success' | 'failure' | 'blocked' | 'info'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

function parseCsvEnv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function getIpFromRequest(req?: NextRequest | null) {
  if (!req) return null
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')?.trim() ?? null
}

export function getIpFromHeaders() {
  try {
    const requestHeaders = headers()
    const forwardedFor = requestHeaders.get('x-forwarded-for')
    if (forwardedFor) {
      const first = forwardedFor.split(',')[0]?.trim()
      if (first) return first
    }
    return requestHeaders.get('x-real-ip')?.trim() ?? null
  } catch {
    return null
  }
}

export function getUserAgentFromHeaders() {
  try {
    return headers().get('user-agent')
  } catch {
    return null
  }
}

export async function recordSecurityEvent(params: {
  db: SupabaseClient
  eventType: string
  severity: SecuritySeverity
  actorType: SecurityActorType
  actorUserId?: string | null
  actorEmail?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  requestPath?: string | null
  requestMethod?: string | null
  resourceType?: string | null
  resourceId?: string | null
  outcome: SecurityOutcome
  reason?: string | null
  meta?: Record<string, unknown> | null
}) {
  const { error } = await params.db.from('security_events').insert({
    event_type: params.eventType,
    severity: params.severity,
    actor_type: params.actorType,
    actor_user_id: params.actorUserId ?? null,
    actor_email: params.actorEmail ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    request_path: params.requestPath ?? null,
    request_method: params.requestMethod ?? null,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    outcome: params.outcome,
    reason: params.reason ?? null,
    meta: params.meta ?? {},
  })

  if (error) {
    console.error('[security-events] insert failed:', error.message)
  }
}

export async function upsertSecurityIncident(params: {
  db: SupabaseClient
  source: 'auth' | 'api' | 'frontend' | 'llm' | 'cron' | 'security' | 'manual'
  severity: SecuritySeverity
  title: string
  description?: string | null
  dedupeKey?: string | null
  actorUserId?: string | null
  actorEmail?: string | null
  ipAddress?: string | null
  route?: string | null
  meta?: Record<string, unknown> | null
}) {
  if (params.dedupeKey) {
    const { data: existing } = await params.db
      .from('security_incidents')
      .select('id, status')
      .eq('dedupe_key', params.dedupeKey)
      .in('status', ['open', 'investigating'])
      .maybeSingle()

    if (existing?.id) {
      await params.db
        .from('security_incidents')
        .update({
          last_seen_at: new Date().toISOString(),
          meta: params.meta ?? {},
          actor_user_id: params.actorUserId ?? null,
          actor_email: params.actorEmail ?? null,
          ip_address: params.ipAddress ?? null,
          route: params.route ?? null,
        })
        .eq('id', existing.id)
      return existing.id
    }
  }

  const { data, error } = await params.db
    .from('security_incidents')
    .insert({
      source: params.source,
      severity: params.severity,
      title: params.title,
      description: params.description ?? null,
      dedupe_key: params.dedupeKey ?? null,
      actor_user_id: params.actorUserId ?? null,
      actor_email: params.actorEmail ?? null,
      ip_address: params.ipAddress ?? null,
      route: params.route ?? null,
      meta: params.meta ?? {},
    })
    .select('id')
    .single()

  if (error) {
    console.error('[security-events] incident insert failed:', error.message)
    return null
  }

  return data?.id ?? null
}

export async function maybeSendSecurityEventAlert(params: {
  db: SupabaseClient
  eventType: string
  severity: SecuritySeverity
  actorEmail?: string | null
  actorUserId?: string | null
  ipAddress?: string | null
  requestPath?: string | null
  requestMethod?: string | null
  reason?: string | null
  meta?: Record<string, unknown> | null
}) {
  const recipients = parseCsvEnv(process.env.INTERNAL_SECURITY_ALERT_TO)
  if (!resend || recipients.length === 0) return false

  const cooldownSince = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count } = await params.db
    .from('security_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', params.eventType)
    .eq('ip_address', params.ipAddress ?? '')
    .gte('created_at', cooldownSince)

  if ((count ?? 0) > 0) return false

  await resend.emails.send({
    from: `STRYVR Security <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
    to: recipients,
    subject: `[SECURITY] ${params.eventType} — ${params.severity.toUpperCase()}`,
    html: renderStryvEmail({
      productLabel: 'Sécurité',
      body: `
        <h2 style="margin:0 0 16px">Événement sécurité</h2>
        <p><strong>Type :</strong> ${params.eventType}</p>
        <p><strong>Sévérité :</strong> ${params.severity}</p>
        <p><strong>Utilisateur :</strong> ${params.actorEmail ?? '—'}</p>
        <p><strong>User ID :</strong> ${params.actorUserId ?? '—'}</p>
        <p><strong>IP :</strong> ${params.ipAddress ?? '—'}</p>
        <p><strong>Route :</strong> ${params.requestPath ?? '—'}</p>
        <p><strong>Méthode :</strong> ${params.requestMethod ?? '—'}</p>
        <p><strong>Raison :</strong> ${params.reason ?? '—'}</p>
        <pre style="white-space:pre-wrap;background:#141414;padding:12px;border-radius:8px;color:#bdbdbd">${JSON.stringify(params.meta ?? {}, null, 2)}</pre>
      `,
    }),
  })

  return true
}
