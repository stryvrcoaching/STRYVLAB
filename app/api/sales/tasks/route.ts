import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSalesAccess } from '@/lib/sales/access'

const taskSchema = z.object({
  title: z.string().trim().min(2).max(240),
  details: z.string().trim().max(4000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
})

export async function GET() {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  const { data, error } = await access.db
    .from('sales_activities')
    .select('id, title, details, due_at, completed_at, lead_id, created_at')
    .eq('sales_partner_id', access.partner.id)
    .eq('kind', 'task')
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_at', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: 'Chargement impossible' }, { status: 500 })
  return NextResponse.json({ tasks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  const parsed = taskSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Tâche invalide' }, { status: 400 })

  const input = parsed.data
  if (input.leadId) {
    const { data: lead } = await access.db
      .from('sales_leads')
      .select('id')
      .eq('id', input.leadId)
      .or(`sales_partner_id.eq.${access.partner.id},closing_partner_id.eq.${access.partner.id}`)
      .maybeSingle()
    if (!lead) return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })
  }

  const { data, error } = await access.db
    .from('sales_activities')
    .insert({
      sales_partner_id: access.partner.id,
      lead_id: input.leadId || null,
      title: input.title,
      details: input.details || null,
      due_at: input.dueAt || null,
    })
    .select('id, title, details, due_at, completed_at, lead_id, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Création impossible' }, { status: 500 })
  return NextResponse.json({ task: data }, { status: 201 })
}
