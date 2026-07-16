import type { SupabaseClient } from '@supabase/supabase-js'
import { maybeSendSecurityEventAlert, recordSecurityEvent, upsertSecurityIncident } from '@/lib/security/security-events'

type SensitiveOutcome = 'success' | 'failure' | 'blocked'

export async function recordSensitiveOperation(params: {
  db: SupabaseClient
  operationKey: string
  dashboardKey?: string | null
  actorUserId?: string | null
  actorEmail?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  requestPath?: string | null
  requestMethod?: string | null
  targetType?: string | null
  targetId?: string | null
  outcome: SensitiveOutcome
  reason?: string | null
  payload?: Record<string, unknown> | null
}) {
  const severity =
    params.outcome === 'blocked'
      ? 'critical'
      : params.outcome === 'failure'
        ? 'high'
        : 'medium'

  await params.db.from('sensitive_operation_audit').insert({
    operation_key: params.operationKey,
    dashboard_key: params.dashboardKey ?? null,
    actor_user_id: params.actorUserId ?? null,
    actor_email: params.actorEmail ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    request_path: params.requestPath ?? null,
    request_method: params.requestMethod ?? null,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    outcome: params.outcome,
    reason: params.reason ?? null,
    payload: params.payload ?? {},
  })

  await recordSecurityEvent({
    db: params.db,
    eventType: `sensitive_operation_${params.operationKey}_${params.outcome}`,
    severity,
    actorType: params.actorUserId ? 'internal' : 'system',
    actorUserId: params.actorUserId ?? null,
    actorEmail: params.actorEmail ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    requestPath: params.requestPath ?? null,
    requestMethod: params.requestMethod ?? null,
    resourceType: params.targetType ?? 'sensitive_operation',
    resourceId: params.targetId ?? params.operationKey,
    outcome:
      params.outcome === 'success'
        ? 'success'
        : params.outcome === 'failure'
          ? 'failure'
          : 'blocked',
    reason: params.reason ?? null,
    meta: {
      operationKey: params.operationKey,
      dashboardKey: params.dashboardKey ?? null,
      payload: params.payload ?? {},
    },
  })

  if (params.outcome !== 'success') {
    await upsertSecurityIncident({
      db: params.db,
      source: 'security',
      severity,
      title: `Action sensible ${params.outcome === 'blocked' ? 'bloquée' : 'en échec'}`,
      description: `${params.operationKey} — ${params.reason ?? 'sans raison précisée'}`,
      dedupeKey: `${params.operationKey}:${params.targetId ?? 'na'}:${params.actorUserId ?? params.ipAddress ?? 'na'}:${params.outcome}`,
      actorUserId: params.actorUserId ?? null,
      actorEmail: params.actorEmail ?? null,
      ipAddress: params.ipAddress ?? null,
      route: params.requestPath ?? null,
      meta: {
        dashboardKey: params.dashboardKey ?? null,
        targetType: params.targetType ?? null,
      },
    })

    await maybeSendSecurityEventAlert({
      db: params.db,
      eventType: `sensitive_operation_${params.operationKey}_${params.outcome}`,
      severity,
      actorEmail: params.actorEmail ?? null,
      actorUserId: params.actorUserId ?? null,
      ipAddress: params.ipAddress ?? null,
      requestPath: params.requestPath ?? null,
      requestMethod: params.requestMethod ?? null,
      reason: params.reason ?? null,
      meta: {
        dashboardKey: params.dashboardKey ?? null,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
      },
    })
  }
}
