import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSalesAccess } from '@/lib/sales/access'

export async function GET(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  const { leadId } = await params
  const { data: lead, error: leadError } = await access.db
    .from('sales_leads')
    .select('id, contact_name, email, company_name, phone, source, status, notes, next_follow_up_at, demo_scheduled_at, sales_partner_id, closing_partner_id, created_at')
    .eq('id', leadId)
    .maybeSingle()

  if (leadError) {
    console.error('[sales/leads] GET lead failed:', leadError)
    return NextResponse.json({ error: 'Chargement impossible' }, { status: 500 })
  }
  if (!lead) return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })

  if (lead.sales_partner_id !== access.partner.id && lead.closing_partner_id !== access.partner.id) {
    return NextResponse.json({ error: 'Vous n’avez pas accès à ce prospect.' }, { status: 403 })
  }

  const { data: activities, error: activitiesError } = await access.db
    .from('sales_activities')
    .select('id, kind, title, details, due_at, completed_at, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (activitiesError) {
    console.error('[sales/leads] GET lead activities failed:', activitiesError)
    return NextResponse.json({ error: 'Chargement des activités impossible' }, { status: 500 })
  }

  return NextResponse.json({ lead, activities: activities ?? [] })
}

const updateLeadSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'demo_scheduled', 'trialing', 'active', 'lost', 'archived']).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  demoScheduledAt: z.string().datetime().nullable().optional(),
  claimClosing: z.literal(true).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Aucune mise à jour' })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  const parsed = updateLeadSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Mise à jour invalide' }, { status: 400 })

  const { leadId } = await params
  const values = parsed.data
  const { data: currentLead, error: currentLeadError } = await access.db
    .from('sales_leads')
    .select('sales_partner_id, closing_partner_id')
    .eq('id', leadId)
    .maybeSingle()

  if (currentLeadError) {
    console.error('[sales/leads] unable to load lead before update:', currentLeadError)
    return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
  }
  if (!currentLead) return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })
  if (currentLead.sales_partner_id !== access.partner.id && currentLead.closing_partner_id !== access.partner.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas modifier ce prospect.' }, { status: 403 })
  }

  if (
    values.claimClosing
    && currentLead.sales_partner_id !== access.partner.id
  ) {
    return NextResponse.json({ error: 'Seul l’apporteur peut déclarer cette vente complète.' }, { status: 403 })
  }

  if (
    values.claimClosing
    && currentLead.closing_partner_id
    && currentLead.closing_partner_id !== access.partner.id
  ) {
    return NextResponse.json({ error: 'Un closer est déjà attribué à cette vente.' }, { status: 409 })
  }

  const update = {
    ...(values.status ? { status: values.status } : {}),
    ...(values.notes !== undefined ? { notes: values.notes } : {}),
    ...(values.nextFollowUpAt !== undefined ? { next_follow_up_at: values.nextFollowUpAt } : {}),
    ...(values.demoScheduledAt !== undefined ? { demo_scheduled_at: values.demoScheduledAt } : {}),
    ...(values.claimClosing ? { closing_partner_id: access.partner.id } : {}),
  }

  const { data, error } = await access.db
    .from('sales_leads')
    .update(update)
    .eq('id', leadId)
    .select('id, contact_name, email, company_name, phone, source, status, notes, next_follow_up_at, demo_scheduled_at, closing_partner_id, created_at')
    .maybeSingle()

  if (error) {
    console.error('[sales/leads] update failed:', error)
    return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })
  return NextResponse.json({ lead: data })
}
