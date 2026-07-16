import type { SupabaseClient } from '@supabase/supabase-js'
import { feedbackPriorityScore } from '@/lib/dashboard/feedback-priority'

export async function getOverviewData(db: SupabaseClient) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    feedbackResult,
    eventResult,
    llmResult,
    incidentResult,
    securityResult,
  ] = await Promise.all([
    db
      .from('product_feedback')
      .select('id, page_path, feature_key, category, priority_user, status, updated_at, created_at')
      .order('created_at', { ascending: false })
      .limit(300),
    db
      .from('product_events')
      .select('user_id, event_name, feature_key, created_at')
      .gte('created_at', weekAgo)
      .limit(5000),
    db
      .from('llm_traces')
      .select('id, error_type, latency_ms, created_at')
      .gte('created_at', dayAgo)
      .limit(500),
    db
      .from('system_incidents')
      .select('id, severity, status, title, source, route, opened_at')
      .order('opened_at', { ascending: false })
      .limit(100),
    db
      .from('internal_dashboard_access_audit')
      .select('id, outcome, created_at')
      .eq('dashboard_key', 'product_feedback')
      .gte('created_at', weekAgo)
      .limit(500),
  ])

  if (feedbackResult.error) throw feedbackResult.error
  if (eventResult.error) throw eventResult.error
  if (llmResult.error) throw llmResult.error
  if (incidentResult.error) throw incidentResult.error
  if (securityResult.error) throw securityResult.error

  const feedbacks = feedbackResult.data ?? []
  const events = eventResult.data ?? []
  const llmTraces = llmResult.data ?? []
  const incidents = incidentResult.data ?? []
  const securityAudits = securityResult.data ?? []

  const pageCounts = new Map<string, number>()
  const priorityGroups = new Map<string, { count: number; score: number }>()

  for (const item of feedbacks) {
    const pageKey = String(item.page_path ?? '').trim() || '—'
    pageCounts.set(pageKey, (pageCounts.get(pageKey) ?? 0) + 1)
  }

  for (const [page, count] of pageCounts.entries()) {
    const sample = feedbacks.find((item) => (String(item.page_path ?? '').trim() || '—') === page)
    priorityGroups.set(page, {
      count,
      score: feedbackPriorityScore({
        priorityUser: sample?.priority_user as 'low' | 'medium' | 'critical' | null,
        status: sample?.status ?? null,
        occurrences: count,
        updatedAt: sample?.updated_at ?? sample?.created_at ?? null,
      }),
    })
  }

  const uniqueUsers = new Set(events.map((item) => item.user_id).filter(Boolean))
  const llmErrorRows = llmTraces.filter((item) => item.error_type)
  const latencyValues = llmTraces
    .map((item) => Number(item.latency_ms))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)
  const p95LatencyMs = latencyValues.length
    ? latencyValues[Math.min(latencyValues.length - 1, Math.floor(latencyValues.length * 0.95))]
    : null

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      openFeedback: feedbacks.filter((item) => ['new', 'reviewed', 'planned'].includes(item.status ?? '')).length,
      criticalFeedback: feedbacks.filter((item) => item.priority_user === 'critical').length,
      prodErrors24h: incidents.filter((item) => ['open', 'investigating'].includes(item.status ?? '')).length,
      llmErrors24h: llmErrorRows.length,
      p95LatencyMs,
      deniedAccess7d: securityAudits.filter((item) => item.outcome === 'denied').length,
      dau7d: uniqueUsers.size,
      activationCount7d: events.filter((item) => item.event_name === 'onboarding_completed').length,
    },
    priorities: Array.from(priorityGroups.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5)
      .map(([label, item]) => ({
        label,
        count: item.count,
        severity: item.score >= 24 ? 'critical' : item.score >= 18 ? 'high' : item.score >= 12 ? 'medium' : 'low',
      })),
    topPages: Array.from(pageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([page, count]) => ({ page, count })),
    incidents: incidents.slice(0, 8),
  }
}
