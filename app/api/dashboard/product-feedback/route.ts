import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { FEEDBACK_STATUSES } from '@/lib/feedback/types'
import { resolveInternalProductFeedbackAccess } from '@/lib/auth/internal-product-feedback-access'
import {
  isDashboardRateLimited,
  maybeSendDashboardSecurityAlert,
  writeDashboardAccessAudit,
} from '@/lib/security/internal-dashboard-guard'
import { getRequestIp } from '@/lib/security/internal-dashboard-guard'
import { recordSensitiveOperation } from '@/lib/security/sensitive-operations'

export const dynamic = 'force-dynamic'
const DASHBOARD_KEY = 'product_feedback'

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(FEEDBACK_STATUSES),
})

type NutritionParseFeedbackRow = {
  id: string
  client_id: string
  source: 'voice' | 'text'
  notes: string | null
  status: 'pending' | 'reviewed' | 'exported'
  created_at: string
  meal_type: string | null
  transcript: string
  parsed_payload: any
  corrected_payload: any
  coach_clients: {
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
}

type SecurityEventRow = {
  id: string
  event_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  actor_email: string | null
  ip_address: string | null
  outcome: 'success' | 'failure' | 'blocked' | 'info'
  reason: string | null
  created_at: string
}

type SecurityIncidentRow = {
  id: string
  source: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'investigating' | 'resolved' | 'ignored'
  title: string
  actor_email: string | null
  ip_address: string | null
  last_seen_at: string
}

type SensitiveOperationRow = {
  id: string
  operation_key: string
  dashboard_key: string | null
  actor_email: string | null
  ip_address: string | null
  outcome: 'success' | 'failure' | 'blocked'
  reason: string | null
  target_type: string | null
  target_id: string | null
  created_at: string
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function normalizeName(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function inferIssueKeys(row: NutritionParseFeedbackRow): string[] {
  const parsed = row.parsed_payload ?? {}
  const corrected = row.corrected_payload ?? {}
  const parsedItems = Array.isArray(parsed.items) ? parsed.items : []
  const correctedItems = Array.isArray(corrected.items) ? corrected.items : []
  const issueKeys = new Set<string>()

  if ((parsed.meal_type ?? null) !== (corrected.meal_type ?? null)) {
    issueKeys.add('meal_type')
  }
  if (parsedItems.length !== correctedItems.length) {
    issueKeys.add('item_count')
  }

  const pairCount = Math.min(parsedItems.length, correctedItems.length)
  for (let index = 0; index < pairCount; index += 1) {
    const before = parsedItems[index] ?? {}
    const after = correctedItems[index] ?? {}
    const beforeName = normalizeName(before.name)
    const afterName = normalizeName(after.name)
    const beforeFoodId = before.food_item_id ?? null
    const afterFoodId = after.food_item_id ?? null
    const beforeQty = Number(before.quantity_g) || 0
    const afterQty = Number(after.quantity_g) || 0

    if ((beforeFoodId && afterFoodId && beforeFoodId !== afterFoodId) || beforeName !== afterName) {
      issueKeys.add('food_match')
    }
    if (Math.abs(beforeQty - afterQty) >= 5) {
      issueKeys.add('quantity')
    }
    if ((before.category_l1 ?? null) !== (after.category_l1 ?? null)) {
      issueKeys.add('category')
    }
  }

  if (issueKeys.size === 0) {
    issueKeys.add('minor_edit')
  }

  return Array.from(issueKeys)
}

function issueLabel(key: string): string {
  switch (key) {
    case 'food_match':
      return 'Aliment mal résolu'
    case 'quantity':
      return 'Quantité incorrecte'
    case 'meal_type':
      return 'Type de repas incorrect'
    case 'category':
      return 'Catégorie corrigée'
    case 'item_count':
      return "Nombre d'aliments incorrect"
    default:
      return 'Édition mineure'
  }
}

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

async function requireInternalAccess(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  const db = serviceClient()

  if (await isDashboardRateLimited({ db, dashboardKey: DASHBOARD_KEY, req })) {
    await writeDashboardAccessAudit({
      db,
      dashboardKey: DASHBOARD_KEY,
      req,
      outcome: 'rate_limited',
      reason: 'too_many_requests',
      userId: user?.id,
      userEmail: user?.email,
    })
    await maybeSendDashboardSecurityAlert({
      db,
      dashboardKey: DASHBOARD_KEY,
      req,
      reason: 'too_many_requests',
      userId: user?.id,
      userEmail: user?.email,
    })
    return { error: NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 }) }
  }

  if (authError || !user) {
    await writeDashboardAccessAudit({
      db,
      dashboardKey: DASHBOARD_KEY,
      req,
      outcome: 'unauthenticated',
      reason: 'missing_session',
    })
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }

  const access = resolveInternalProductFeedbackAccess({
    userId: user.id,
    email: user.email,
  })

  if (!access.allowed) {
    const alertSent = await maybeSendDashboardSecurityAlert({
      db,
      dashboardKey: DASHBOARD_KEY,
      req,
      reason: access.mode === 'unset' ? 'allowlist_not_configured' : 'uuid_not_allowlisted',
      userId: user.id,
      userEmail: user.email,
    })
    await writeDashboardAccessAudit({
      db,
      dashboardKey: DASHBOARD_KEY,
      req,
      outcome: 'denied',
      reason: access.mode === 'unset' ? 'allowlist_not_configured' : 'uuid_not_allowlisted',
      userId: user.id,
      userEmail: user.email,
      alertSent,
    })
    return {
      error: NextResponse.json(
        { error: access.mode === 'unset' ? 'Allowlist interne non configurée' : 'Accès refusé' },
        { status: 403 },
      ),
    }
  }

  await writeDashboardAccessAudit({
    db,
    dashboardKey: DASHBOARD_KEY,
    req,
    outcome: 'allowed',
    reason: 'uuid_allowlisted',
    userId: user.id,
    userEmail: user.email,
  })

  return { db, user }
}

export async function GET(req: NextRequest) {
  const access = await requireInternalAccess(req)
  if ('error' in access) return access.error

  const { db } = access
  const traceSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const auditSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const eventSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaySeries = buildDaySeries(7)

  const [
    feedbackResult,
    nutritionFeedbackResult,
    llmTraceResult,
    auditResult,
    securityEventResult,
    securityIncidentResult,
    sensitiveOperationResult,
  ] = await Promise.all([
    db
      .from('product_feedback')
      .select(`
        id,
        workspace,
        source_role,
        source_user_id,
        source_name,
        source_email,
        page_path,
        page_title,
        category,
        priority_user,
        message,
        status,
        meta,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
      .limit(300),
    db
      .from('nutrition_parse_feedback')
      .select(`
        id,
        client_id,
        source,
        notes,
        status,
        created_at,
        meal_type,
        transcript,
        parsed_payload,
        corrected_payload,
        coach_clients(first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('llm_traces')
      .select('id, created_at, model, latency_ms, error_type, error')
      .gte('created_at', traceSince)
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('internal_dashboard_access_audit')
      .select('id, dashboard_key, user_email, ip_address, outcome, reason, alert_sent, created_at')
      .eq('dashboard_key', DASHBOARD_KEY)
      .gte('created_at', auditSince)
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('security_events')
      .select('id, event_type, severity, actor_email, ip_address, outcome, reason, created_at')
      .gte('created_at', eventSince)
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('security_incidents')
      .select('id, source, severity, status, title, actor_email, ip_address, last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(100),
    db
      .from('sensitive_operation_audit')
      .select('id, operation_key, dashboard_key, actor_email, ip_address, outcome, reason, target_type, target_id, created_at')
      .gte('created_at', eventSince)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (feedbackResult.error) {
    return NextResponse.json({ error: feedbackResult.error.message }, { status: 500 })
  }
  if (nutritionFeedbackResult.error) {
    return NextResponse.json({ error: nutritionFeedbackResult.error.message }, { status: 500 })
  }
  if (llmTraceResult.error) {
    return NextResponse.json({ error: llmTraceResult.error.message }, { status: 500 })
  }
  if (auditResult.error) {
    return NextResponse.json({ error: auditResult.error.message }, { status: 500 })
  }
  if (securityEventResult.error) {
    return NextResponse.json({ error: securityEventResult.error.message }, { status: 500 })
  }
  if (securityIncidentResult.error) {
    return NextResponse.json({ error: securityIncidentResult.error.message }, { status: 500 })
  }
  if (sensitiveOperationResult.error) {
    return NextResponse.json({ error: sensitiveOperationResult.error.message }, { status: 500 })
  }

  const feedbacks = feedbackResult.data ?? []
  const nutritionRows = (nutritionFeedbackResult.data ?? []) as NutritionParseFeedbackRow[]
  const llmTraceRows = llmTraceResult.data ?? []
  const auditRows = auditResult.data ?? []
  const securityEvents = (securityEventResult.data ?? []) as SecurityEventRow[]
  const securityIncidents = (securityIncidentResult.data ?? []) as SecurityIncidentRow[]
  const sensitiveOperations = (sensitiveOperationResult.data ?? []) as SensitiveOperationRow[]

  const pageCounts = new Map<string, number>()
  const categoryCounts = new Map<string, number>()
  const pageCriticalCounts = new Map<string, number>()
  const pageOpenCounts = new Map<string, number>()
  for (const row of feedbacks) {
    const pageKey = String(row.page_path ?? '').trim() || '—'
    pageCounts.set(pageKey, (pageCounts.get(pageKey) ?? 0) + 1)
    if (row.priority_user === 'critical') {
      pageCriticalCounts.set(pageKey, (pageCriticalCounts.get(pageKey) ?? 0) + 1)
    }
    if (['new', 'reviewed', 'planned'].includes(row.status)) {
      pageOpenCounts.set(pageKey, (pageOpenCounts.get(pageKey) ?? 0) + 1)
    }
    const categoryKey = String(row.category ?? '').trim() || 'other'
    categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) ?? 0) + 1)
  }

  const feedbackDailyMap = new Map<string, { total: number; open: number; critical: number }>()
  for (const row of feedbacks) {
    const dayKey = startOfDayIso(row.created_at)
    const current = feedbackDailyMap.get(dayKey) ?? { total: 0, open: 0, critical: 0 }
    current.total += 1
    if (['new', 'reviewed', 'planned'].includes(row.status)) current.open += 1
    if (row.priority_user === 'critical') current.critical += 1
    feedbackDailyMap.set(dayKey, current)
  }

  const llmDailyMap = new Map<string, { traces: number; errors: number }>()
  for (const row of llmTraceRows) {
    const dayKey = startOfDayIso(row.created_at)
    const current = llmDailyMap.get(dayKey) ?? { traces: 0, errors: 0 }
    current.traces += 1
    if (row.error_type) current.errors += 1
    llmDailyMap.set(dayKey, current)
  }

  const securityDailyMap = new Map<string, { denied: number; alerts: number; sensitive: number }>()
  for (const row of auditRows) {
    const dayKey = startOfDayIso(row.created_at)
    const current = securityDailyMap.get(dayKey) ?? { denied: 0, alerts: 0, sensitive: 0 }
    if (row.outcome === 'denied') current.denied += 1
    if (row.alert_sent) current.alerts += 1
    securityDailyMap.set(dayKey, current)
  }
  for (const row of sensitiveOperations) {
    const dayKey = startOfDayIso(row.created_at)
    const current = securityDailyMap.get(dayKey) ?? { denied: 0, alerts: 0, sensitive: 0 }
    current.sensitive += 1
    securityDailyMap.set(dayKey, current)
  }

  const nutritionIssueCounts = new Map<string, number>()
  const nutritionRecent = nutritionRows.slice(0, 12).map((row) => {
    const issues = inferIssueKeys(row)
    for (const issue of issues) {
      nutritionIssueCounts.set(issue, (nutritionIssueCounts.get(issue) ?? 0) + 1)
    }

    return {
      id: row.id,
      created_at: row.created_at,
      status: row.status,
      source: row.source,
      meal_type: row.meal_type,
      notes: row.notes,
      transcript: row.transcript,
      issues,
      client_name: [row.coach_clients?.first_name, row.coach_clients?.last_name].filter(Boolean).join(' ') || 'Client',
      client_email: row.coach_clients?.email ?? null,
    }
  })

  const traceErrors = llmTraceRows.filter((row) => row.error_type)
  const latencyValues = llmTraceRows
    .map((row) => Number(row.latency_ms))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)

  const averageLatency = latencyValues.length
    ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : null
  const p95Latency = latencyValues.length
    ? latencyValues[Math.min(latencyValues.length - 1, Math.floor(latencyValues.length * 0.95))]
    : null

  const errorTypeCounts = new Map<string, number>()
  for (const row of traceErrors) {
    const key = String(row.error_type ?? '').trim()
    if (!key) continue
    errorTypeCounts.set(key, (errorTypeCounts.get(key) ?? 0) + 1)
  }

  const deniedAudits = auditRows.filter((row) => row.outcome === 'denied')
  const rateLimitedAudits = auditRows.filter((row) => row.outcome === 'rate_limited')
  const alertAudits = auditRows.filter((row) => row.alert_sent)
  const criticalIncidents = securityIncidents.filter((row) => row.severity === 'critical' && ['open', 'investigating'].includes(row.status))
  const openIncidents = securityIncidents.filter((row) => ['open', 'investigating'].includes(row.status))
  const sensitiveBlocked = sensitiveOperations.filter((row) => row.outcome === 'blocked')

  const hotspotPages = Array.from(pageCounts.entries())
    .map(([page, count]) => {
      const critical = pageCriticalCounts.get(page) ?? 0
      const open = pageOpenCounts.get(page) ?? 0
      return {
        page,
        count,
        critical,
        open,
        score: count * 3 + critical * 5 + open * 2,
      }
    })
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 8)

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    feedbacks,
    stats: {
      total: feedbacks.length,
      newCount: feedbacks.filter((row) => row.status === 'new').length,
      criticalCount: feedbacks.filter((row) => row.priority_user === 'critical').length,
      clientCount: feedbacks.filter((row) => row.workspace === 'client_pwa').length,
      platformCount: feedbacks.filter((row) => row.workspace === 'platform_web').length,
      topPages: Array.from(pageCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([page, count]) => ({ page, count })),
    },
    backlog: {
      statuses: {
        new: feedbacks.filter((row) => row.status === 'new').length,
        reviewed: feedbacks.filter((row) => row.status === 'reviewed').length,
        planned: feedbacks.filter((row) => row.status === 'planned').length,
        done: feedbacks.filter((row) => row.status === 'done').length,
        dismissed: feedbacks.filter((row) => row.status === 'dismissed').length,
      },
      hotspots: hotspotPages,
    },
    overview: {
      openHumanFeedback: feedbacks.filter((row) => ['new', 'reviewed'].includes(row.status)).length,
      plannedHumanFeedback: feedbacks.filter((row) => row.status === 'planned').length,
      criticalHumanFeedback: feedbacks.filter((row) => row.priority_user === 'critical').length,
      categoryBreakdown: Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({ key, count })),
    },
    ops: {
      nutritionParse: {
        total: nutritionRows.length,
        pending: nutritionRows.filter((row) => row.status === 'pending').length,
        reviewed: nutritionRows.filter((row) => row.status === 'reviewed').length,
        exported: nutritionRows.filter((row) => row.status === 'exported').length,
        voice: nutritionRows.filter((row) => row.source === 'voice').length,
        text: nutritionRows.filter((row) => row.source === 'text').length,
        topIssues: Array.from(nutritionIssueCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([key, count]) => ({ key, label: issueLabel(key), count })),
        recent: nutritionRecent,
      },
      llm: {
        windowHours: 24,
        totalTraces: llmTraceRows.length,
        totalErrors: traceErrors.length,
        averageLatencyMs: averageLatency,
        p95LatencyMs: p95Latency,
        topErrorTypes: Array.from(errorTypeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([key, count]) => ({ key, count })),
        recentErrors: traceErrors.slice(0, 10).map((row) => ({
          id: row.id,
          created_at: row.created_at,
          model: row.model,
          latency_ms: row.latency_ms,
          error_type: row.error_type,
          error: row.error,
        })),
      },
      system: {
        criticalIncidents: criticalIncidents.length,
        openIncidents: openIncidents.length,
        recentIncidents: securityIncidents.slice(0, 8),
      },
    },
    security: {
      windowDays: 7,
      totalAccessLogs: auditRows.length,
      deniedCount: deniedAudits.length,
      rateLimitedCount: rateLimitedAudits.length,
      alertCount: alertAudits.length,
      blockedSensitiveCount: sensitiveBlocked.length,
      sensitiveOperationCount: sensitiveOperations.length,
      criticalEventCount: securityEvents.filter((row) => row.severity === 'critical').length,
      openIncidentCount: openIncidents.length,
      recentEvents: securityEvents.slice(0, 8),
      recentIncidents: securityIncidents.slice(0, 8),
      recentSensitiveOperations: sensitiveOperations.slice(0, 8),
      recent: auditRows.slice(0, 20),
    },
    trends: {
      feedbackDaily: sevenDaySeries.map((day) => ({
        label: day.label,
        total: feedbackDailyMap.get(day.key)?.total ?? 0,
        open: feedbackDailyMap.get(day.key)?.open ?? 0,
        critical: feedbackDailyMap.get(day.key)?.critical ?? 0,
      })),
      llmDaily: sevenDaySeries.map((day) => ({
        label: day.label,
        traces: llmDailyMap.get(day.key)?.traces ?? 0,
        errors: llmDailyMap.get(day.key)?.errors ?? 0,
      })),
      securityDaily: sevenDaySeries.map((day) => ({
        label: day.label,
        denied: securityDailyMap.get(day.key)?.denied ?? 0,
        alerts: securityDailyMap.get(day.key)?.alerts ?? 0,
        sensitive: securityDailyMap.get(day.key)?.sensitive ?? 0,
      })),
    },
  })
}

export async function PATCH(req: NextRequest) {
  const access = await requireInternalAccess(req)
  if ('error' in access) return access.error

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    await recordSensitiveOperation({
      db: access.db,
      operationKey: 'product_feedback_status_update',
      dashboardKey: DASHBOARD_KEY,
      actorUserId: access.user.id,
      actorEmail: access.user.email,
      ipAddress: getRequestIp(req),
      userAgent: req.headers.get('user-agent'),
      requestPath: req.nextUrl.pathname,
      requestMethod: req.method,
      targetType: 'product_feedback',
      outcome: 'failure',
      reason: 'invalid_payload',
    })
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
  }

  const { db, user } = access
  const { id, status } = parsed.data

  const { data, error } = await db
    .from('product_feedback')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, status, updated_at')
    .single()

  if (error || !data) {
    await recordSensitiveOperation({
      db,
      operationKey: 'product_feedback_status_update',
      dashboardKey: DASHBOARD_KEY,
      actorUserId: user.id,
      actorEmail: user.email,
      ipAddress: getRequestIp(req),
      userAgent: req.headers.get('user-agent'),
      requestPath: req.nextUrl.pathname,
      requestMethod: req.method,
      targetType: 'product_feedback',
      targetId: id,
      outcome: 'failure',
      reason: error?.message ?? 'update_failed',
      payload: { status },
    })
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  }

  await recordSensitiveOperation({
    db,
    operationKey: 'product_feedback_status_update',
    dashboardKey: DASHBOARD_KEY,
    actorUserId: user.id,
    actorEmail: user.email,
    ipAddress: getRequestIp(req),
    userAgent: req.headers.get('user-agent'),
    requestPath: req.nextUrl.pathname,
    requestMethod: req.method,
    targetType: 'product_feedback',
    targetId: id,
    outcome: 'success',
    payload: { status },
  })

  return NextResponse.json(data)
}
