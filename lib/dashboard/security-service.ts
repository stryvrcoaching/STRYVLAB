import type { SupabaseClient } from '@supabase/supabase-js'

function startOfDayIso(value: string) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function buildDaySeries(days: number) {
  const items: Array<{ key: string; label: string }> = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - offset)
    items.push({
      key: date.toISOString(),
      label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    })
  }
  return items
}

export async function getSecurityData(db: SupabaseClient) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const days = buildDaySeries(7)
  const [auditResult, eventResult, incidentResult, sensitiveOpsResult] = await Promise.all([
    db
      .from('internal_dashboard_access_audit')
      .select('id, dashboard_key, user_email, ip_address, outcome, reason, alert_sent, created_at')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(300),
    db
      .from('security_events')
      .select('id, event_type, severity, actor_type, actor_user_id, actor_email, ip_address, request_path, request_method, outcome, reason, meta, created_at')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(300),
    db
      .from('security_incidents')
      .select('id, source, severity, status, title, description, actor_email, ip_address, route, meta, first_seen_at, last_seen_at, resolved_at')
      .order('last_seen_at', { ascending: false })
      .limit(100),
    db
      .from('sensitive_operation_audit')
      .select('id, operation_key, dashboard_key, actor_email, ip_address, outcome, reason, target_type, target_id, created_at')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (auditResult.error) throw auditResult.error
  if (eventResult.error) throw eventResult.error
  if (incidentResult.error) throw incidentResult.error
  if (sensitiveOpsResult.error) throw sensitiveOpsResult.error

  const rows = auditResult.data ?? []
  const events = eventResult.data ?? []
  const incidents = incidentResult.data ?? []
  const sensitiveOps = sensitiveOpsResult.data ?? []
  const repeatedIps = new Map<string, number>()
  const trendMap = new Map<string, { denied: number; alerts: number; critical: number; sensitive: number }>()

  for (const row of [...rows, ...events]) {
    const ip = String(row.ip_address ?? '').trim()
    if (!ip || ip === 'unknown') continue
    repeatedIps.set(ip, (repeatedIps.get(ip) ?? 0) + 1)
  }

  for (const row of rows) {
    const key = startOfDayIso(row.created_at)
    const current = trendMap.get(key) ?? { denied: 0, alerts: 0, critical: 0, sensitive: 0 }
    if (row.outcome === 'denied') current.denied += 1
    if (row.alert_sent) current.alerts += 1
    trendMap.set(key, current)
  }

  const eventTypes = new Map<string, number>()
  for (const event of events) {
    const key = String(event.event_type ?? '').trim()
    if (!key) continue
    eventTypes.set(key, (eventTypes.get(key) ?? 0) + 1)
    const dayKey = startOfDayIso(event.created_at)
    const current = trendMap.get(dayKey) ?? { denied: 0, alerts: 0, critical: 0, sensitive: 0 }
    if (event.severity === 'critical') current.critical += 1
    trendMap.set(dayKey, current)
  }

  for (const row of sensitiveOps) {
    const dayKey = startOfDayIso(row.created_at)
    const current = trendMap.get(dayKey) ?? { denied: 0, alerts: 0, critical: 0, sensitive: 0 }
    current.sensitive += 1
    trendMap.set(dayKey, current)
  }

  return {
    generatedAt: new Date().toISOString(),
    windowDays: 7,
    totalAccessLogs: rows.length,
    totalSecurityEvents: events.length,
    deniedCount: rows.filter((row) => row.outcome === 'denied').length,
    rateLimitedCount: rows.filter((row) => row.outcome === 'rate_limited').length,
    unauthenticatedCount: rows.filter((row) => row.outcome === 'unauthenticated').length,
    alertCount: rows.filter((row) => row.alert_sent).length,
    criticalEvents: events.filter((row) => row.severity === 'critical').length,
    openIncidents: incidents.filter((row) => ['open', 'investigating'].includes(row.status)).length,
    unresolvedCriticalIncidents: incidents.filter((row) => row.severity === 'critical' && ['open', 'investigating'].includes(row.status)).length,
    posturePolicy: {
      requireAal2: String(process.env.INTERNAL_REQUIRE_AAL2 ?? '').toLowerCase() === 'true',
      requireRecentAuthMinutes: (() => {
        const value = Number(process.env.INTERNAL_REQUIRE_RECENT_AUTH_MINUTES)
        return Number.isFinite(value) && value > 0 ? value : null
      })(),
      trustedIpsConfigured: String(process.env.INTERNAL_TRUSTED_IPS ?? '').trim().length > 0,
    },
    sensitiveOperationStats: {
      total: sensitiveOps.length,
      blocked: sensitiveOps.filter((row) => row.outcome === 'blocked').length,
      failed: sensitiveOps.filter((row) => row.outcome === 'failure').length,
      successful: sensitiveOps.filter((row) => row.outcome === 'success').length,
    },
    repeatedIps: Array.from(repeatedIps.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count })),
    topEventTypes: Array.from(eventTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([eventType, count]) => ({ eventType, count })),
    trends: {
      daily: days.map((day) => ({
        label: day.label,
        denied: trendMap.get(day.key)?.denied ?? 0,
        alerts: trendMap.get(day.key)?.alerts ?? 0,
        critical: trendMap.get(day.key)?.critical ?? 0,
        sensitive: trendMap.get(day.key)?.sensitive ?? 0,
      })),
    },
    recent: rows.slice(0, 30),
    recentEvents: events.slice(0, 30),
    incidents: incidents.slice(0, 30),
    recentSensitiveOperations: sensitiveOps.slice(0, 30),
  }
}
