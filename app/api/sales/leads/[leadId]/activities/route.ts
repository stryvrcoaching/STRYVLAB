import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSalesAccess } from '@/lib/sales/access'

const activitySchema = z.object({
  kind: z.enum(['task', 'note', 'meeting', 'call']),
  title: z.string().trim().min(2).max(240),
  details: z.string().trim().max(4000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  const { leadId } = await params

  // Verify lead exists and belongs to the partner
  const { data: lead, error: leadError } = await access.db
    .from('sales_leads')
    .select('sales_partner_id, closing_partner_id')
    .eq('id', leadId)
    .maybeSingle()

  if (leadError) {
    console.error('[sales/leads/activities] lead lookup failed:', leadError)
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 })
  }
  if (!lead) return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })

  if (lead.sales_partner_id !== access.partner.id && lead.closing_partner_id !== access.partner.id) {
    return NextResponse.json({ error: 'Vous n’avez pas accès à ce prospect.' }, { status: 403 })
  }

  const parsed = activitySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Activité invalide' }, { status: 400 })

  const input = parsed.data

  // Default completed_at for notes to now() if not specified.
  // For calls and meetings, if no dueAt is provided, we can assume it is a logged event and default to now().
  let completedAt = input.completedAt
  if (!completedAt && input.kind === 'note') {
    completedAt = new Date().toISOString()
  } else if (!completedAt && (input.kind === 'call' || input.kind === 'meeting') && !input.dueAt) {
    completedAt = new Date().toISOString()
  }

  const { data, error } = await access.db
    .from('sales_activities')
    .insert({
      sales_partner_id: access.partner.id,
      lead_id: leadId,
      kind: input.kind,
      title: input.title,
      details: input.details || null,
      due_at: input.dueAt || null,
      completed_at: completedAt || null,
    })
    .select('id, kind, title, details, due_at, completed_at, created_at')
    .single()

  if (error) {
    console.error('[sales/leads/activities] create failed:', error)
    return NextResponse.json({ error: 'Création impossible' }, { status: 500 })
  }

  return NextResponse.json({ activity: data }, { status: 201 })
}
