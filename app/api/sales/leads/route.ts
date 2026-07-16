import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSalesAccess } from '@/lib/sales/access'

const leadSchema = z.object({
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  companyName: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  source: z.enum(['manual', 'referral_link', 'event', 'network', 'other']).default('manual'),
  notes: z.string().trim().max(4000).optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
})

export async function GET() {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  const { data, error } = await access.db
    .from('sales_leads')
    .select('id, contact_name, email, company_name, phone, source, status, notes, next_follow_up_at, demo_scheduled_at, closing_partner_id, created_at')
    .or(`sales_partner_id.eq.${access.partner.id},closing_partner_id.eq.${access.partner.id}`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Chargement impossible' }, { status: 500 })
  return NextResponse.json({ leads: data ?? [] })
}

export async function POST(req: NextRequest) {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  const parsed = leadSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Informations prospect invalides' }, { status: 400 })

  const input = parsed.data
  const email = input.email.toLowerCase()
  const { data, error } = await access.db
    .from('sales_leads')
    .insert({
      sales_partner_id: access.partner.id,
      contact_name: input.contactName,
      email,
      normalized_email: email,
      company_name: input.companyName || null,
      phone: input.phone || null,
      source: input.source,
      notes: input.notes || null,
      next_follow_up_at: input.nextFollowUpAt || null,
    })
    .select('id, contact_name, email, company_name, phone, source, status, notes, next_follow_up_at, demo_scheduled_at, closing_partner_id, created_at')
    .single()

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Ce prospect est déjà attribué dans STRYV.' }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: 'Création impossible' }, { status: 500 })

  return NextResponse.json({ lead: data }, { status: 201 })
}
