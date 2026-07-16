import type { SupabaseClient } from '@supabase/supabase-js'

export async function getSystemHealthData(db: SupabaseClient) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [traceResult, incidentResult] = await Promise.all([
    db
      .from('llm_traces')
      .select('id, model, latency_ms, error_type, error, created_at')
      .gte('created_at', dayAgo)
      .order('created_at', { ascending: false })
      .limit(500),
    db
      .from('system_incidents')
      .select('id, source, severity, title, description, status, route, meta, opened_at, resolved_at')
      .order('opened_at', { ascending: false })
      .limit(200),
  ])

  if (traceResult.error) throw traceResult.error
  if (incidentResult.error) throw incidentResult.error

  const traces = traceResult.data ?? []
  const incidents = incidentResult.data ?? []

  const latencyValues = traces
    .map((item) => Number(item.latency_ms))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)

  const avgLatencyMs = latencyValues.length
    ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : null
  const p95LatencyMs = latencyValues.length
    ? latencyValues[Math.min(latencyValues.length - 1, Math.floor(latencyValues.length * 0.95))]
    : null

  const topErrorTypes = new Map<string, number>()
  for (const row of traces) {
    const key = String(row.error_type ?? '').trim()
    if (!key) continue
    topErrorTypes.set(key, (topErrorTypes.get(key) ?? 0) + 1)
  }

  const routeMap = new Map<string, { count: number; latencies: number[] }>()
  for (const incident of incidents) {
    const route = String(incident.route ?? incident.meta?.route ?? '').trim()
    if (!route) continue
    const existing = routeMap.get(route) ?? { count: 0, latencies: [] }
    existing.count += 1
    const latency = Number(incident.meta?.latency_ms ?? incident.meta?.duration_ms ?? 0)
    if (Number.isFinite(latency) && latency > 0) {
      existing.latencies.push(latency)
    }
    routeMap.set(route, existing)
  }

  const topSlowRoutes = Array.from(routeMap.entries())
    .map(([route, data]) => ({
      route,
      avgMs: data.latencies.length
        ? Math.round(data.latencies.reduce((sum, value) => sum + value, 0) / data.latencies.length)
        : 0,
      p95Ms: data.latencies.length
        ? [...data.latencies].sort((a, b) => a - b)[Math.min(data.latencies.length - 1, Math.floor(data.latencies.length * 0.95))]
        : 0,
      errors: data.count,
    }))
    .sort((a, b) => b.avgMs - a.avgMs || b.errors - a.errors)
    .slice(0, 6)

  const topErrorRoutes = Array.from(routeMap.entries())
    .map(([route, data]) => ({ route, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  return {
    api: {
      topSlowRoutes,
      topErrorRoutes,
    },
    llm: {
      total: traces.length,
      errors: traces.filter((item) => item.error_type).length,
      avgLatencyMs,
      p95LatencyMs,
      topErrorTypes: Array.from(topErrorTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([key, count]) => ({ key, count })),
      recentErrors: traces
        .filter((item) => item.error_type)
        .slice(0, 10),
    },
    incidents: incidents.slice(0, 20),
  }
}
