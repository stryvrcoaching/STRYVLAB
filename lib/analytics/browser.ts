'use client'

type EventName = 'page_view' | 'cta_clicked' | 'form_started' | 'lead_submitted'

type TrackPayload = {
  eventName: EventName
  pagePath?: string
  source?: string
  featureKey?: string
  properties?: Record<string, unknown>
}

const ANON_KEY = 'stryv.analytics.anonymous_id'
const SESSION_KEY = 'stryv.analytics.session_id'
const CONSENT_KEY = 'stryv.analytics.consent'
const ATTRIBUTION_KEY = 'stryv.analytics.attribution'
const CONSENT_MAX_AGE_MS = 183 * 24 * 60 * 60 * 1000
const sentPageViews = new Set<string>()

type UTMContext = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
}

type AttributionState = {
  firstTouch: UTMContext | null
  lastTouch: UTMContext | null
}

function clearAnalyticsTrackingStorage() {
  window.localStorage.removeItem(ANON_KEY)
  window.localStorage.removeItem(ATTRIBUTION_KEY)
  window.sessionStorage.removeItem(SESSION_KEY)
}

function readOrCreateStorageKey(key: string) {
  try {
    const storage = key === SESSION_KEY ? window.sessionStorage : window.localStorage
    const existing = storage.getItem(key)
    if (existing) return existing
  } catch {}

  const created =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  try {
    const storage = key === SESSION_KEY ? window.sessionStorage : window.localStorage
    storage.setItem(key, created)
  } catch {}

  return created
}

function getRouteGroup(pathname: string) {
  if (pathname.startsWith('/coach')) return 'coach'
  if (pathname.startsWith('/client')) return 'client'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/api')) return 'api'
  return 'public'
}

function getUserType(pathname: string) {
  if (pathname.startsWith('/coach')) return 'coach'
  if (pathname.startsWith('/client')) return 'client'
  return 'visitor'
}

function getUtmContext() {
  const params = new URLSearchParams(window.location.search)
  return {
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
    utmContent: params.get('utm_content'),
    utmTerm: params.get('utm_term'),
  }
}

function hasUtmValues(utm: UTMContext) {
  return Boolean(utm.utmSource || utm.utmMedium || utm.utmCampaign || utm.utmContent || utm.utmTerm)
}

export function readAnalyticsConsent(): 'granted' | 'denied' | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as { status?: unknown; updatedAt?: unknown }
    if (
      (parsed.status !== 'granted' && parsed.status !== 'denied') ||
      typeof parsed.updatedAt !== 'number' ||
      Date.now() - parsed.updatedAt > CONSENT_MAX_AGE_MS
    ) {
      window.localStorage.removeItem(CONSENT_KEY)
      clearAnalyticsTrackingStorage()
      return null
    }

    return parsed.status
  } catch {
    try {
      window.localStorage.removeItem(CONSENT_KEY)
      clearAnalyticsTrackingStorage()
    } catch {}
    return null
  }
}

export function hasAnalyticsConsent() {
  return readAnalyticsConsent() === 'granted'
}

export function setAnalyticsConsent(status: 'granted' | 'denied') {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ status, updatedAt: Date.now() }))
  } catch {}
}

export function resetAnalyticsConsent() {
  try {
    window.localStorage.removeItem(CONSENT_KEY)
    clearAnalyticsTrackingStorage()
  } catch {}
}

function readAttributionState(): AttributionState {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY)
    if (!raw) return { firstTouch: null, lastTouch: null }
    const parsed = JSON.parse(raw) as AttributionState
    return {
      firstTouch: parsed.firstTouch ?? null,
      lastTouch: parsed.lastTouch ?? null,
    }
  } catch {
    return { firstTouch: null, lastTouch: null }
  }
}

function writeAttributionState(state: AttributionState) {
  try {
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(state))
  } catch {}
}

export function syncAttributionFromLocation() {
  if (typeof window === 'undefined') return
  const current = getUtmContext()
  if (!hasUtmValues(current)) return

  const state = readAttributionState()
  const nextState: AttributionState = {
    firstTouch: state.firstTouch && hasUtmValues(state.firstTouch) ? state.firstTouch : current,
    lastTouch: current,
  }
  writeAttributionState(nextState)
}

function getAttributionContext() {
  const state = readAttributionState()
  return {
    firstUtmSource: state.firstTouch?.utmSource ?? null,
    firstUtmMedium: state.firstTouch?.utmMedium ?? null,
    firstUtmCampaign: state.firstTouch?.utmCampaign ?? null,
    firstUtmContent: state.firstTouch?.utmContent ?? null,
    firstUtmTerm: state.firstTouch?.utmTerm ?? null,
    lastUtmSource: state.lastTouch?.utmSource ?? null,
    lastUtmMedium: state.lastTouch?.utmMedium ?? null,
    lastUtmCampaign: state.lastTouch?.utmCampaign ?? null,
    lastUtmContent: state.lastTouch?.utmContent ?? null,
    lastUtmTerm: state.lastTouch?.utmTerm ?? null,
  }
}

export async function trackProductEvent(payload: TrackPayload) {
  if (typeof window === 'undefined') return
  if (navigator.doNotTrack === '1') return
  if (!hasAnalyticsConsent()) return

  const pagePath = payload.pagePath ?? window.location.pathname
  const body = {
    event_name: payload.eventName,
    page_path: pagePath,
    route_group: getRouteGroup(pagePath),
    source: payload.source ?? 'unknown',
    feature_key: payload.featureKey ?? null,
    user_type: getUserType(pagePath),
    anonymous_id: readOrCreateStorageKey(ANON_KEY),
    session_id: readOrCreateStorageKey(SESSION_KEY),
    referrer_domain: document.referrer ? new URL(document.referrer).hostname : null,
    properties: payload.properties ?? {},
    consent_status: 'granted',
    ...getUtmContext(),
    ...getAttributionContext(),
  }

  try {
    await fetch('/api/product-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
  } catch {}
}

export function trackPageView(input: Omit<TrackPayload, 'eventName'>) {
  syncAttributionFromLocation()
  const pagePath = input.pagePath ?? (typeof window !== 'undefined' ? window.location.pathname : '')
  const dedupeKey = `${input.source ?? 'unknown'}:${pagePath}:${typeof window !== 'undefined' ? window.location.search : ''}`
  if (sentPageViews.has(dedupeKey)) return
  sentPageViews.add(dedupeKey)
  void trackProductEvent({ ...input, pagePath, eventName: 'page_view' })
}
