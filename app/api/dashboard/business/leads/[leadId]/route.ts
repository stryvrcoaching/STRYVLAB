import { NextRequest, NextResponse } from 'next/server'
import { requireInternalDashboardAccess } from '@/lib/dashboard/internal-access'

const ALLOWED_STATUSES = new Set([
  'new',
  'qualified',
  'contacted',
  'demo_requested',
  'demo_scheduled',
  'proposal_sent',
  'won',
  'lost',
  'archived',
])

const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high'])

function optionalText(value: unknown) {
  const normalized = String(value ?? '').trim()
  return normalized.length > 0 ? normalized : null
}

function optionalDateTime(value: unknown) {
  const normalized = optionalText(value)
  if (!normalized) return null
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { leadId: string } },
) {
  const access = await requireInternalDashboardAccess(req, 'business')
  if ('error' in access) return access.error

  const leadId = String(params.leadId ?? '').trim()
  if (!leadId) {
    return NextResponse.json({ error: 'Lead invalide' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
  }

  const leadStatus = String((body as { leadStatus?: string }).leadStatus ?? '').trim()
  const priority = String((body as { priority?: string }).priority ?? '').trim()

  if (!ALLOWED_STATUSES.has(leadStatus)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  if (!ALLOWED_PRIORITIES.has(priority)) {
    return NextResponse.json({ error: 'Priorité invalide' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {
    lead_status: leadStatus,
    priority,
    owner_email: optionalText((body as { ownerEmail?: string }).ownerEmail),
    next_follow_up_at: optionalDateTime((body as { nextFollowUpAt?: string }).nextFollowUpAt),
    notes: optionalText((body as { notes?: string }).notes),
  }

  if (leadStatus === 'demo_scheduled') {
    patch.demo_scheduled_at = new Date().toISOString()
  }

  if (leadStatus === 'won') {
    patch.converted_at = new Date().toISOString()
  }

  const { data, error } = await access.db
    .from('beta_waitlist')
    .update(patch)
    .eq('id', leadId)
    .select('id, lead_status, priority, owner_email, next_follow_up_at, notes')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message ?? 'Mise à jour impossible' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, lead: data })
}
