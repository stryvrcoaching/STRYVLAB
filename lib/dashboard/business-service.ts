import type { SupabaseClient } from '@supabase/supabase-js'
import { computeMeasurementReadiness } from '@/lib/dashboard/measurement-readiness'

type QueryError = { message?: string } | null

type OptionalRowsResult<T> = {
  available: boolean
  rows: T[]
  warning?: string
}

type WaitlistRow = {
  id?: string | null
  email?: string | null
  source?: string | null
  created_at?: string | null
  lead_kind?: string | null
  lead_status?: string | null
  owner_email?: string | null
  company_name?: string | null
  notes?: string | null
  last_contacted_at?: string | null
  next_follow_up_at?: string | null
  demo_scheduled_at?: string | null
  converted_at?: string | null
  converted_coach_id?: string | null
  priority?: string | null
}

const BILLING_TO_MONTHLY: Record<string, number> = {
  weekly: 4.33,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  one_time: 0,
}

const LLM_PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
}

function parseAmount(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function toModelKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function estimateLlmCostEur(model: unknown, tokensIn: unknown, tokensOut: unknown) {
  const pricing = LLM_PRICING_PER_1M[toModelKey(model)]
  if (!pricing) return 0
  return (parseAmount(tokensIn) / 1_000_000) * pricing.input + (parseAmount(tokensOut) / 1_000_000) * pricing.output
}

function formatOptionalWarning(table: string, error: QueryError) {
  return `Source optionnelle indisponible: ${table}${error?.message ? ` — ${error.message}` : ''}`
}

async function readOptionalRows<T>(
  table: string,
  query: PromiseLike<{ data: T[] | null; error: QueryError }>,
): Promise<OptionalRowsResult<T>> {
  const result = await query
  if (result.error) {
    return {
      available: false,
      rows: [],
      warning: formatOptionalWarning(table, result.error),
    }
  }

  return {
    available: true,
    rows: result.data ?? [],
  }
}

async function readWaitlistRows(db: SupabaseClient): Promise<OptionalRowsResult<WaitlistRow>> {
  const richResult = await db
    .from('beta_waitlist')
    .select('id, email, source, created_at, lead_kind, lead_status, owner_email, company_name, notes, last_contacted_at, next_follow_up_at, demo_scheduled_at, converted_at, converted_coach_id, priority')

  if (!richResult.error) {
    return {
      available: true,
      rows: (richResult.data ?? []) as WaitlistRow[],
    }
  }

  const basicResult = await db
    .from('beta_waitlist')
    .select('id, email, source, created_at')

  if (basicResult.error) {
    return {
      available: false,
      rows: [],
      warning: formatOptionalWarning('beta_waitlist', richResult.error),
    }
  }

  return {
    available: true,
    rows: (basicResult.data ?? []).map((row) => ({
      ...row,
      lead_kind:
        row.source === 'coaches-demo-request'
          ? 'coach_demo'
          : row.source === 'coaches-landing'
            ? 'coach_lead'
            : row.source === 'stryvr-landing'
              ? 'client_beta'
              : 'other',
      lead_status: row.source === 'coaches-demo-request' ? 'demo_requested' : 'new',
      owner_email: null,
      company_name: null,
      notes: null,
      last_contacted_at: null,
      next_follow_up_at: null,
      demo_scheduled_at: null,
      converted_at: null,
      converted_coach_id: null,
      priority: 'medium',
    })),
    warning: 'CRM leads partiellement disponibles: migration beta_waitlist CRM non appliquée en production.',
  }
}

function deriveLlmSurface(row: { chat_message_id?: string | null; context_summary?: Record<string, unknown> | null }) {
  const meta = row.context_summary ?? null
  const routeLabel = typeof meta?.route_label === 'string' ? meta.route_label.trim() : ''
  const featureKey = typeof meta?.feature_key === 'string' ? meta.feature_key.trim() : ''

  if (featureKey) return featureKey
  if (routeLabel) return routeLabel
  if (row.chat_message_id) return 'client_ai_chat'
  return 'unknown'
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function pct(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 1 : 0
  return (current - previous) / previous
}

function inRange(value: string | null | undefined, startIso: string, endIso: string) {
  const normalized = String(value ?? '')
  return normalized >= startIso && normalized < endIso
}

function normalizeLeadStatus(row: { lead_status?: string | null; source?: string | null }) {
  const status = String(row.lead_status ?? '').trim()
  if (status) return status
  if (row.source === 'coaches-demo-request') return 'demo_requested'
  return 'new'
}

export async function getBusinessDashboardData(db: SupabaseClient) {
  const now = new Date()
  const today = isoDate(now)
  const monthStart = isoDate(startOfMonth(now))
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const monthAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const twoMonthsAgoIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgoDate = isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))

  const [
    coachProfilesResult,
    clientsResult,
    subscriptionsResult,
    paymentsResult,
    waitlistResult,
    llmResult,
    productEventsResult,
    purchasesResult,
    iptSessionsResult,
  ] = await Promise.all([
    db
      .from('coach_profiles')
      .select('coach_id, full_name, brand_name, created_at, plan, billing_status, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id'),
    db
      .from('coach_clients')
      .select('id, coach_id, status, created_at, acquisition_source'),
    db
      .from('client_subscriptions')
      .select('id, coach_id, client_id, status, start_date, next_billing_date, price_override_eur, coach_formulas(name, price_eur, billing_cycle)'),
    db
      .from('subscription_payments')
      .select('id, coach_id, client_id, amount_eur, status, payment_date, due_date, payment_method'),
    readWaitlistRows(db),
    db
      .from('llm_traces')
      .select('id, created_at, model, tokens_in, tokens_out, latency_ms, error_type, chat_message_id, context_summary')
      .gte('created_at', monthAgoIso)
      .order('created_at', { ascending: false })
      .limit(5000),
    readOptionalRows(
      'product_events',
      db
        .from('product_events')
        .select('id, user_id, anonymous_id, source, event_name, feature_key, properties, created_at, first_utm_source, first_utm_medium, first_utm_campaign, last_utm_source, last_utm_medium, last_utm_campaign, consent_status')
        .gte('created_at', monthAgoIso)
        .order('created_at', { ascending: false })
        .limit(5000),
    ),
    readOptionalRows(
      'user_purchases',
      db
        .from('user_purchases')
        .select('id, status, amount, currency, purchased_at, product_type')
        .gte('purchased_at', monthAgoIso)
        .order('purchased_at', { ascending: false })
        .limit(2000),
    ),
    readOptionalRows(
      'ipt_sessions',
      db
        .from('ipt_sessions')
        .select('id, status, started_at, last_activity_at, payment_amount, payment_currency')
        .order('started_at', { ascending: false })
        .limit(5000),
    ),
  ])

  if (coachProfilesResult.error) throw coachProfilesResult.error
  if (clientsResult.error) throw clientsResult.error
  if (subscriptionsResult.error) throw subscriptionsResult.error
  if (paymentsResult.error) throw paymentsResult.error
  if (llmResult.error) throw llmResult.error

  const coachProfiles = coachProfilesResult.data ?? []
  const clients = clientsResult.data ?? []
  const subscriptions = subscriptionsResult.data ?? []
  const payments = paymentsResult.data ?? []
  const waitlist = waitlistResult.rows
  const llmTraces = llmResult.data ?? []
  const productEvents = productEventsResult.rows
  const purchases = purchasesResult.rows
  const iptSessions = iptSessionsResult.rows

  const warnings = [waitlistResult.warning, productEventsResult.warning, purchasesResult.warning, iptSessionsResult.warning].filter(Boolean) as string[]

  const coachMap = new Map<string, {
    coachId: string
    name: string
    clientsTotal: number
    clientsActive: number
    activeSubscriptions: number
    trialSubscriptions: number
    mrr: number
    revenueMonth: number
    revenue30d: number
  }>()

  for (const coach of coachProfiles) {
    const coachId = String(coach.coach_id)
    coachMap.set(coachId, {
      coachId,
      name: String(coach.full_name ?? coach.brand_name ?? 'Coach').trim() || 'Coach',
      clientsTotal: 0,
      clientsActive: 0,
      activeSubscriptions: 0,
      trialSubscriptions: 0,
      mrr: 0,
      revenueMonth: 0,
      revenue30d: 0,
    })
  }

  for (const client of clients) {
    const coachId = String(client.coach_id ?? '')
    if (!coachMap.has(coachId)) {
      coachMap.set(coachId, {
        coachId,
        name: 'Coach',
        clientsTotal: 0,
        clientsActive: 0,
        activeSubscriptions: 0,
        trialSubscriptions: 0,
        mrr: 0,
        revenueMonth: 0,
        revenue30d: 0,
      })
    }
    const current = coachMap.get(coachId)!
    current.clientsTotal += 1
    if (client.status === 'active') current.clientsActive += 1
  }

  for (const subscription of subscriptions) {
    const coachId = String(subscription.coach_id ?? '')
    if (!coachMap.has(coachId)) continue
    const current = coachMap.get(coachId)!
    const formula = subscription.coach_formulas as { name?: string | null; price_eur?: number | null; billing_cycle?: string | null } | null
    const basePrice = subscription.price_override_eur != null ? parseAmount(subscription.price_override_eur) : parseAmount(formula?.price_eur)
    const monthlyFactor = BILLING_TO_MONTHLY[String(formula?.billing_cycle ?? 'monthly')] ?? 0

    if (subscription.status === 'active') {
      current.activeSubscriptions += 1
      current.mrr += basePrice * monthlyFactor
    }
    if (subscription.status === 'trial') {
      current.trialSubscriptions += 1
      current.mrr += basePrice * monthlyFactor
    }
  }

  for (const payment of payments) {
    const coachId = String(payment.coach_id ?? '')
    if (!coachMap.has(coachId)) continue
    const current = coachMap.get(coachId)!
    if (payment.status !== 'paid') continue

    const paymentDate = String(payment.payment_date ?? '')
    const amount = parseAmount(payment.amount_eur)

    if (paymentDate >= monthStart && paymentDate <= today) {
      current.revenueMonth += amount
    }
    if (paymentDate >= monthAgoDate && paymentDate <= today) {
      current.revenue30d += amount
    }
  }

  const coachRows = Array.from(coachMap.values())
  const coachSignups30d = coachProfiles.filter((row) => String(row.created_at ?? '') >= monthAgoIso).length
  const coachTrialing = coachProfiles.filter((row) => row.billing_status === 'trialing').length
  const coachActivePaid = coachProfiles.filter((row) => row.billing_status === 'active').length
  const coachPastDue = coachProfiles.filter((row) => row.billing_status === 'past_due').length
  const coachWithStripeCheckout = coachProfiles.filter((row) => Boolean(row.stripe_checkout_session_id)).length
  const coachWithStripeCustomer = coachProfiles.filter((row) => Boolean(row.stripe_customer_id)).length
  const payingCoachCount = coachProfiles.filter((row) => ['active', 'past_due'].includes(String(row.billing_status ?? ''))).length
  const totalCoaches = coachRows.length
  const activeCoaches = coachRows.filter((row) => row.clientsTotal > 0 || row.activeSubscriptions > 0 || row.revenue30d > 0).length
  const totalClients = clients.length
  const activeClients = clients.filter((row) => row.status === 'active').length
  const activeSubscriptions = subscriptions.filter((row) => row.status === 'active').length
  const trialSubscriptions = subscriptions.filter((row) => row.status === 'trial').length
  const pendingPayments = payments.filter((row) => row.status === 'pending').length
  const failedPayments = payments.filter((row) => row.status === 'failed').length
  const paidRevenueMonth = payments
    .filter((row) => row.status === 'paid' && String(row.payment_date ?? '') >= monthStart)
    .reduce((sum, row) => sum + parseAmount(row.amount_eur), 0)
  const paidRevenue30d = payments
    .filter((row) => row.status === 'paid' && String(row.payment_date ?? '') >= monthAgoDate)
    .reduce((sum, row) => sum + parseAmount(row.amount_eur), 0)
  const paidRevenuePrev30d = payments
    .filter((row) => row.status === 'paid' && inRange(String(row.payment_date ?? ''), twoMonthsAgoIso.slice(0, 10), monthAgoDate))
    .reduce((sum, row) => sum + parseAmount(row.amount_eur), 0)
  const mrr = coachRows.reduce((sum, row) => sum + row.mrr, 0)
  const avgClientsPerCoach = totalCoaches > 0 ? totalClients / totalCoaches : 0
  const avgRevenuePerCoachMonth = totalCoaches > 0 ? paidRevenueMonth / totalCoaches : 0

  const waitlist30d = waitlist.filter((row) => String(row.created_at ?? '') >= monthAgoIso)
  const waitlistPrev30d = waitlist.filter((row) => inRange(String(row.created_at ?? ''), twoMonthsAgoIso, monthAgoIso))
  const waitlistBySource = new Map<string, number>()
  const salesStageMap = new Map<string, number>()
  const recentCoachLeads: Array<{
    id: string
    email: string
    source: string
    leadStatus: string
    ownerEmail: string | null
    priority: string
    createdAt: string
    nextFollowUpAt: string | null
    notes: string | null
  }> = []
  const coachLeadsBoard: Array<{
    id: string
    email: string
    source: string
    leadStatus: string
    ownerEmail: string | null
    priority: string
    createdAt: string
    nextFollowUpAt: string | null
    notes: string | null
  }> = []
  let unassignedLeads = 0
  let followUpsDue = 0
  let staleLeads = 0
  for (const row of waitlist) {
    const source = String(row.source ?? 'unknown').trim() || 'unknown'
    waitlistBySource.set(source, (waitlistBySource.get(source) ?? 0) + 1)
    const leadStatus = normalizeLeadStatus(row)
    salesStageMap.set(leadStatus, (salesStageMap.get(leadStatus) ?? 0) + 1)

    const createdAt = String(row.created_at ?? '')
    const ownerEmail = row.owner_email ? String(row.owner_email) : null
    const nextFollowUpAt = row.next_follow_up_at ? String(row.next_follow_up_at) : ''

    if (!ownerEmail && ['coach_lead', 'coach_demo'].includes(String(row.lead_kind ?? ''))) unassignedLeads += 1
    if (nextFollowUpAt && nextFollowUpAt <= new Date().toISOString()) followUpsDue += 1
    if (
      ['new', 'qualified', 'contacted', 'demo_requested'].includes(leadStatus) &&
      createdAt &&
      createdAt < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    ) {
      staleLeads += 1
    }

    if (['coach_lead', 'coach_demo'].includes(String(row.lead_kind ?? ''))) {
      const leadEntry = {
        id: String(row.id ?? ''),
        email: String(row.email ?? '—'),
        source,
        leadStatus,
        ownerEmail,
        priority: String(row.priority ?? 'medium'),
        createdAt,
        nextFollowUpAt: row.next_follow_up_at ? String(row.next_follow_up_at) : null,
        notes: row.notes ? String(row.notes) : null,
      }
      recentCoachLeads.push(leadEntry)
      coachLeadsBoard.push(leadEntry)
    }
  }

  const llm24h = llmTraces.filter((row) => String(row.created_at ?? '') >= dayAgoIso)
  const llm30d = llmTraces
  const llmSurfaceMap = new Map<string, {
    surface: string
    requests: number
    tokensIn: number
    tokensOut: number
    costEur: number
    errors: number
    latencyTotal: number
    latencyCount: number
  }>()

  for (const row of llm30d) {
    const surface = deriveLlmSurface(row as { chat_message_id?: string | null; context_summary?: Record<string, unknown> | null })
    const tokensIn = parseAmount(row.tokens_in)
    const tokensOut = parseAmount(row.tokens_out)
    const latency = parseAmount(row.latency_ms)
    const cost = estimateLlmCostEur(row.model, row.tokens_in, row.tokens_out)
    const current = llmSurfaceMap.get(surface) ?? {
      surface,
      requests: 0,
      tokensIn: 0,
      tokensOut: 0,
      costEur: 0,
      errors: 0,
      latencyTotal: 0,
      latencyCount: 0,
    }

    current.requests += 1
    current.tokensIn += tokensIn
    current.tokensOut += tokensOut
    current.costEur += cost
    current.errors += row.error_type ? 1 : 0
    if (latency > 0) {
      current.latencyTotal += latency
      current.latencyCount += 1
    }

    llmSurfaceMap.set(surface, current)
  }

  const llmCost24h = llm24h.reduce((sum, row) => sum + estimateLlmCostEur(row.model, row.tokens_in, row.tokens_out), 0)
  const llmCost30d = llm30d.reduce((sum, row) => sum + estimateLlmCostEur(row.model, row.tokens_in, row.tokens_out), 0)
  const llmPrev30d = llmTraces.filter((row) => inRange(String(row.created_at ?? ''), twoMonthsAgoIso, monthAgoIso))
  const llmCostPrev30d = llmPrev30d.reduce((sum, row) => sum + estimateLlmCostEur(row.model, row.tokens_in, row.tokens_out), 0)
  const llmTokensIn30d = llm30d.reduce((sum, row) => sum + parseAmount(row.tokens_in), 0)
  const llmTokensOut30d = llm30d.reduce((sum, row) => sum + parseAmount(row.tokens_out), 0)
  const llmErrors24h = llm24h.filter((row) => row.error_type).length
  const llmAvgCostPerRequest30d = llm30d.length > 0 ? llmCost30d / llm30d.length : 0

  const productEventsByName = new Map<string, number>()
  const productEventsByFeature = new Map<string, number>()
  const productEventUsers = new Set<string>()
  const attributionByCampaign = new Map<string, { label: string; leads: number; visitors: Set<string> }>()
  let consentedVisitors = 0
  const funnelBySource = new Map<string, {
    source: string
    landingVisitors: Set<string>
    ctaClicks: number
    formStarts: number
    leadsSubmitted: number
  }>()
  for (const event of productEvents) {
    const eventName = String((event as { event_name?: string | null }).event_name ?? 'unknown').trim() || 'unknown'
    const featureKey = String((event as { feature_key?: string | null }).feature_key ?? 'unknown').trim() || 'unknown'
    const userId = String((event as { user_id?: string | null }).user_id ?? '').trim()
    const source = String((event as { source?: string | null }).source ?? 'unknown').trim() || 'unknown'
    const properties = (event as { properties?: Record<string, unknown> | null }).properties ?? null
    const anonymousId = String((event as { anonymous_id?: string | null }).anonymous_id ?? '').trim()
    const visitorKey = userId || anonymousId || `${source}:${eventName}:${Math.random()}`
    const firstCampaign = String((event as { first_utm_campaign?: string | null }).first_utm_campaign ?? '').trim()
    const firstSource = String((event as { first_utm_source?: string | null }).first_utm_source ?? '').trim()
    const consentStatus = String((event as { consent_status?: string | null }).consent_status ?? '').trim()

    productEventsByName.set(eventName, (productEventsByName.get(eventName) ?? 0) + 1)
    productEventsByFeature.set(featureKey, (productEventsByFeature.get(featureKey) ?? 0) + 1)
    if (userId) productEventUsers.add(userId)
    if (consentStatus === 'granted' && eventName === 'page_view') consentedVisitors += 1

    const currentFunnel = funnelBySource.get(source) ?? {
      source,
      landingVisitors: new Set<string>(),
      ctaClicks: 0,
      formStarts: 0,
      leadsSubmitted: 0,
    }

    if (eventName === 'page_view') currentFunnel.landingVisitors.add(visitorKey)
    if (eventName === 'cta_clicked') currentFunnel.ctaClicks += 1
    if (eventName === 'form_started') currentFunnel.formStarts += 1
    if (eventName === 'lead_submitted' && properties?.already_exists !== true) currentFunnel.leadsSubmitted += 1

    funnelBySource.set(source, currentFunnel)

    const campaignLabel = firstCampaign || firstSource || 'direct_or_unknown'
    const currentCampaign = attributionByCampaign.get(campaignLabel) ?? {
      label: campaignLabel,
      leads: 0,
      visitors: new Set<string>(),
    }
    if (eventName === 'page_view') currentCampaign.visitors.add(visitorKey)
    if (eventName === 'lead_submitted' && properties?.already_exists !== true) currentCampaign.leads += 1
    attributionByCampaign.set(campaignLabel, currentCampaign)
  }

  const waitlist30dBySource = new Map<string, number>()
  for (const row of waitlist30d) {
    const source = String(row.source ?? 'unknown').trim() || 'unknown'
    waitlist30dBySource.set(source, (waitlist30dBySource.get(source) ?? 0) + 1)
  }
  const demoRequests30d = waitlist30dBySource.get('coaches-demo-request') ?? 0
  const coachLeads30d = (waitlist30dBySource.get('coaches-landing') ?? 0) + demoRequests30d
  const coachLeadToSignupRate = coachLeads30d > 0 ? coachSignups30d / coachLeads30d : 0
  const coachSignupsPrev30d = coachProfiles.filter((row) => inRange(String(row.created_at ?? ''), twoMonthsAgoIso, monthAgoIso)).length
  const clients30d = clients.filter((row) => String(row.created_at ?? '') >= monthAgoIso).length
  const clientsPrev30d = clients.filter((row) => inRange(String(row.created_at ?? ''), twoMonthsAgoIso, monthAgoIso)).length
  const wonLeadCount = salesStageMap.get('won') ?? 0
  const demoScheduledCount = salesStageMap.get('demo_scheduled') ?? 0
  const proposalSentCount = salesStageMap.get('proposal_sent') ?? 0

  const purchases30d = purchases.filter((row) => String((row as { purchased_at?: string | null }).purchased_at ?? '') >= monthAgoIso)
  const purchaseRevenue30d = purchases30d
    .filter((row) => String((row as { status?: string | null }).status ?? '') === 'succeeded')
    .reduce((sum, row) => sum + parseAmount((row as { amount?: number | null }).amount), 0)

  const iptCompleted = iptSessions.filter((row) => String((row as { status?: string | null }).status ?? '') === 'completed').length
  const unitRevenuePerActiveClient30d = activeClients > 0 ? paidRevenue30d / activeClients : 0
  const unitRevenuePerActiveCoach30d = activeCoaches > 0 ? paidRevenue30d / activeCoaches : 0
  const unitLlmCostPerActiveClient30d = activeClients > 0 ? llmCost30d / activeClients : 0
  const unitLlmCostPerCoach30d = totalCoaches > 0 ? llmCost30d / totalCoaches : 0
  const unitAvgRevenuePerSubscription30d = activeSubscriptions > 0 ? paidRevenue30d / activeSubscriptions : 0
  const llmCostToRevenueRatio30d = paidRevenue30d > 0 ? llmCost30d / paidRevenue30d : 0
  const readiness = computeMeasurementReadiness({
    productEventsTracked: productEventsResult.available,
    trackedEvents30d: productEvents.length,
    uniqueTrackedUsers30d: productEventUsers.size,
    consentedVisitors30d: consentedVisitors,
    hasLeadSignals: waitlist.length > 0,
    hasRevenueSignals: payments.length > 0,
    hasAttributionSignals: attributionByCampaign.size > 0,
    warnings,
  })

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      totalClients,
      activeClients,
      totalCoaches,
      activeCoaches,
      avgClientsPerCoach,
      activeSubscriptions,
      trialSubscriptions,
      paidRevenueMonth,
      paidRevenue30d,
      mrr,
      avgRevenuePerCoachMonth,
      pendingPayments,
      failedPayments,
    },
    coachEconomics: coachRows
      .sort((a, b) => b.revenue30d - a.revenue30d || b.mrr - a.mrr || b.clientsTotal - a.clientsTotal)
      .slice(0, 8)
      .map((row) => ({
        coachId: row.coachId,
        name: row.name,
        clientsTotal: row.clientsTotal,
        clientsActive: row.clientsActive,
        activeSubscriptions: row.activeSubscriptions,
        trialSubscriptions: row.trialSubscriptions,
        revenueMonth: Math.round(row.revenueMonth * 100) / 100,
        revenue30d: Math.round(row.revenue30d * 100) / 100,
        mrr: Math.round(row.mrr * 100) / 100,
      })),
    acquisition: {
      waitlistTotal: waitlist.length,
      waitlist30d: waitlist30d.length,
      demoRequests30d,
      sources: Array.from(waitlistBySource.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([source, count]) => ({ source, count })),
      productEventsTracked: productEventsResult.available,
      trackedEvents30d: productEvents.length,
      uniqueTrackedUsers30d: productEventUsers.size,
      consentedVisitors30d: consentedVisitors,
      topEvents: Array.from(productEventsByName.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, count]) => ({ label, count })),
      topFeatures: Array.from(productEventsByFeature.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, count]) => ({ label, count })),
      funnels: Array.from(
        new Set([
          ...Array.from(funnelBySource.keys()),
          ...Array.from(waitlist30dBySource.keys()),
        ]),
      )
        .map((source) => {
          const funnel = funnelBySource.get(source)
          const landingViews = funnel?.landingVisitors.size ?? 0
          const leadsSubmitted = waitlist30dBySource.get(source) ?? funnel?.leadsSubmitted ?? 0
          return {
            source,
            landingViews,
            ctaClicks: funnel?.ctaClicks ?? 0,
            formStarts: funnel?.formStarts ?? 0,
            leadsSubmitted,
            leadRate: landingViews > 0 ? leadsSubmitted / landingViews : 0,
          }
        })
        .sort((a, b) => b.leadsSubmitted - a.leadsSubmitted || b.landingViews - a.landingViews),
      topAttribution: Array.from(attributionByCampaign.values())
        .map((item) => ({
          label: item.label,
          visitors: item.visitors.size,
          leads: item.leads,
          leadRate: item.visitors.size > 0 ? item.leads / item.visitors.size : 0,
        }))
        .sort((a, b) => b.leads - a.leads || b.visitors - a.visitors)
        .slice(0, 6),
    },
    sales: {
      coachLeads30d,
      demoRequests30d,
      coachSignups30d,
      coachSignupsPrev30d,
      coachTrialing,
      coachActivePaid,
      coachPastDue,
      coachWithStripeCheckout,
      coachWithStripeCustomer,
      payingCoachCount,
      leadToSignupRate: coachLeadToSignupRate,
      signupToPaidRate: coachSignups30d > 0 ? coachActivePaid / coachSignups30d : 0,
      demoToWonRate: demoRequests30d > 0 ? wonLeadCount / demoRequests30d : 0,
      followUpsDue,
      unassignedLeads,
      staleLeads,
      pipelineStages: [
        { label: 'new', count: salesStageMap.get('new') ?? 0 },
        { label: 'qualified', count: salesStageMap.get('qualified') ?? 0 },
        { label: 'contacted', count: salesStageMap.get('contacted') ?? 0 },
        { label: 'demo_requested', count: salesStageMap.get('demo_requested') ?? 0 },
        { label: 'demo_scheduled', count: demoScheduledCount },
        { label: 'proposal_sent', count: proposalSentCount },
        { label: 'won', count: wonLeadCount },
        { label: 'lost', count: salesStageMap.get('lost') ?? 0 },
      ],
      recentCoachLeads: recentCoachLeads
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 6),
      crmLeads: coachLeadsBoard
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 100),
      planMix: ['solo', 'pro', 'studio'].map((plan) => ({
        plan,
        count: coachProfiles.filter((row) => row.plan === plan).length,
      })),
    },
    growth: {
      leads30d: waitlist30d.length,
      leadsPrev30d: waitlistPrev30d.length,
      coachSignups30d,
      coachSignupsPrev30d,
      clients30d,
      clientsPrev30d,
      revenue30d: round(paidRevenue30d),
      revenuePrev30d: round(paidRevenuePrev30d),
      llmCost30d: round(llmCost30d, 4),
      llmCostPrev30d: round(llmCostPrev30d, 4),
      leadsDelta: pct(waitlist30d.length, waitlistPrev30d.length),
      coachSignupsDelta: pct(coachSignups30d, coachSignupsPrev30d),
      clientsDelta: pct(clients30d, clientsPrev30d),
      revenueDelta: pct(paidRevenue30d, paidRevenuePrev30d),
      llmCostDelta: pct(llmCost30d, llmCostPrev30d),
    },
    unitEconomics: {
      revenuePerActiveClient30d: round(unitRevenuePerActiveClient30d),
      revenuePerActiveCoach30d: round(unitRevenuePerActiveCoach30d),
      llmCostPerActiveClient30d: round(unitLlmCostPerActiveClient30d, 4),
      llmCostPerCoach30d: round(unitLlmCostPerCoach30d, 4),
      avgRevenuePerSubscription30d: round(unitAvgRevenuePerSubscription30d),
      llmCostToRevenueRatio30d: round(llmCostToRevenueRatio30d, 4),
    },
    llm: {
      requests24h: llm24h.length,
      requests30d: llm30d.length,
      tokensIn30d: llmTokensIn30d,
      tokensOut30d: llmTokensOut30d,
      cost24hEur: Math.round(llmCost24h * 10000) / 10000,
      cost30dEur: Math.round(llmCost30d * 10000) / 10000,
      avgCostPerRequest30dEur: Math.round(llmAvgCostPerRequest30d * 100000) / 100000,
      errors24h: llmErrors24h,
      errorRate24h: llm24h.length > 0 ? llmErrors24h / llm24h.length : 0,
      bySurface: Array.from(llmSurfaceMap.values())
        .sort((a, b) => b.costEur - a.costEur || b.requests - a.requests)
        .slice(0, 8)
        .map((row) => ({
          surface: row.surface,
          requests: row.requests,
          tokensIn: row.tokensIn,
          tokensOut: row.tokensOut,
          costEur: Math.round(row.costEur * 10000) / 10000,
          errors: row.errors,
          avgLatencyMs: row.latencyCount > 0 ? Math.round(row.latencyTotal / row.latencyCount) : null,
        })),
    },
    ipt: {
      tracked: iptSessionsResult.available,
      totalSessions: iptSessions.length,
      completedSessions: iptCompleted,
      purchasesTracked: purchasesResult.available,
      purchases30d: purchases30d.length,
      purchaseRevenue30d: Math.round(purchaseRevenue30d * 100) / 100,
    },
    instrumentation: {
      landingTrafficTracked: productEventsResult.available,
      demoRequestsTracked: waitlistBySource.has('coaches-demo-request'),
      llmCostingMode: 'estimated_from_tokens',
      notes: [
        productEventsResult.available
          ? 'Events produit disponibles côté runtime.'
          : 'Trafic landing non fiabilisé côté runtime: aucun flux analytics exploitable n’a été trouvé pour les visites/pages.',
        'Le consentement analytics conditionne la remontée des événements publics. Sans consentement, les formulaires métier restent actifs mais le funnel de tracking ne remonte pas.',
        'Le coût LLM est estimé à partir des tokens persistés et du pricing modèle courant, pas depuis une facture brute fournisseur.',
        'Le pipeline sales est actuellement porté par beta_waitlist enrichi de statuts CRM, pas par un CRM externe synchronisé.',
      ],
      warnings,
    },
    measurement: readiness,
  }
}

export function getBusinessDashboardFallback(error?: unknown) {
  const message = error instanceof Error ? error.message : 'Source business indisponible'

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      totalClients: 0,
      activeClients: 0,
      totalCoaches: 0,
      activeCoaches: 0,
      avgClientsPerCoach: 0,
      activeSubscriptions: 0,
      trialSubscriptions: 0,
      paidRevenueMonth: 0,
      paidRevenue30d: 0,
      mrr: 0,
      avgRevenuePerCoachMonth: 0,
      pendingPayments: 0,
      failedPayments: 0,
    },
    coachEconomics: [],
    acquisition: {
      waitlistTotal: 0,
      waitlist30d: 0,
      demoRequests30d: 0,
      productEventsTracked: false,
      trackedEvents30d: 0,
      uniqueTrackedUsers30d: 0,
      consentedVisitors30d: 0,
      sources: [],
      topEvents: [],
      topFeatures: [],
      funnels: [],
      topAttribution: [],
    },
    sales: {
      coachLeads30d: 0,
      demoRequests30d: 0,
      coachSignups30d: 0,
      coachSignupsPrev30d: 0,
      coachTrialing: 0,
      coachActivePaid: 0,
      coachPastDue: 0,
      coachWithStripeCheckout: 0,
      coachWithStripeCustomer: 0,
      payingCoachCount: 0,
      leadToSignupRate: 0,
      signupToPaidRate: 0,
      demoToWonRate: 0,
      followUpsDue: 0,
      unassignedLeads: 0,
      staleLeads: 0,
      pipelineStages: [],
      recentCoachLeads: [],
      crmLeads: [],
      planMix: [],
    },
    growth: {
      leads30d: 0,
      leadsPrev30d: 0,
      coachSignups30d: 0,
      coachSignupsPrev30d: 0,
      clients30d: 0,
      clientsPrev30d: 0,
      revenue30d: 0,
      revenuePrev30d: 0,
      llmCost30d: 0,
      llmCostPrev30d: 0,
      leadsDelta: 0,
      coachSignupsDelta: 0,
      clientsDelta: 0,
      revenueDelta: 0,
      llmCostDelta: 0,
    },
    unitEconomics: {
      revenuePerActiveClient30d: 0,
      revenuePerActiveCoach30d: 0,
      llmCostPerActiveClient30d: 0,
      llmCostPerCoach30d: 0,
      avgRevenuePerSubscription30d: 0,
      llmCostToRevenueRatio30d: 0,
    },
    llm: {
      requests24h: 0,
      requests30d: 0,
      tokensIn30d: 0,
      tokensOut30d: 0,
      cost24hEur: 0,
      cost30dEur: 0,
      avgCostPerRequest30dEur: 0,
      errors24h: 0,
      errorRate24h: 0,
      bySurface: [],
    },
    ipt: {
      tracked: false,
      totalSessions: 0,
      completedSessions: 0,
      purchasesTracked: false,
      purchases30d: 0,
      purchaseRevenue30d: 0,
    },
    instrumentation: {
      landingTrafficTracked: false,
      demoRequestsTracked: false,
      llmCostingMode: 'unavailable',
      notes: [],
      warnings: [`Cockpit business en mode dégradé: ${message}`],
    },
    measurement: {
      score: 0,
      verdict: 'Broken',
      categories: [],
    },
  }
}
