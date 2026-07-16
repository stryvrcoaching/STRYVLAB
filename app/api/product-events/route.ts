import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createDashboardServiceClient } from '@/lib/dashboard/service'

export const dynamic = 'force-dynamic'

const ALLOWED_EVENT_NAMES = new Set(['page_view', 'cta_clicked', 'form_started', 'lead_submitted'])

function trimString(value: unknown, max = 255) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function sanitizeProperties(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).slice(0, 20).map(([key, item]) => {
      if (typeof item === 'string') return [key, item.slice(0, 500)]
      if (typeof item === 'number' || typeof item === 'boolean' || item === null) return [key, item]
      return [key, JSON.stringify(item).slice(0, 500)]
    }),
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const eventName = trimString(body?.event_name, 64)
    if (!eventName || !ALLOWED_EVENT_NAMES.has(eventName)) {
      return NextResponse.json({ error: 'Événement invalide' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const db = createDashboardServiceClient()

    const payload = {
      user_id: auth.user?.id ?? null,
      anonymous_id: trimString(body?.anonymous_id, 120),
      session_id: trimString(body?.session_id, 120),
      event_name: eventName,
      page_path: trimString(body?.page_path, 240),
      route_group: trimString(body?.route_group, 32),
      source: trimString(body?.source, 80),
      feature_key: trimString(body?.feature_key, 120),
      user_type: trimString(body?.user_type, 32),
      referrer_domain: trimString(body?.referrer_domain, 160),
      utm_source: trimString(body?.utmSource, 120),
      utm_medium: trimString(body?.utmMedium, 120),
      utm_campaign: trimString(body?.utmCampaign, 160),
      utm_content: trimString(body?.utmContent, 160),
      utm_term: trimString(body?.utmTerm, 160),
      first_utm_source: trimString(body?.firstUtmSource, 120),
      first_utm_medium: trimString(body?.firstUtmMedium, 120),
      first_utm_campaign: trimString(body?.firstUtmCampaign, 160),
      first_utm_content: trimString(body?.firstUtmContent, 160),
      first_utm_term: trimString(body?.firstUtmTerm, 160),
      last_utm_source: trimString(body?.lastUtmSource, 120),
      last_utm_medium: trimString(body?.lastUtmMedium, 120),
      last_utm_campaign: trimString(body?.lastUtmCampaign, 160),
      last_utm_content: trimString(body?.lastUtmContent, 160),
      last_utm_term: trimString(body?.lastUtmTerm, 160),
      consent_status: trimString(body?.consent_status, 32),
      properties: sanitizeProperties(body?.properties),
    }

    const { error } = await db.from('product_events').insert(payload)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur tracking'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
