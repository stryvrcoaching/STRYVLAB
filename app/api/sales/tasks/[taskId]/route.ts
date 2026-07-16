import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSalesAccess } from '@/lib/sales/access'

const taskUpdateSchema = z.object({ completed: z.boolean() })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  const parsed = taskUpdateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Mise à jour invalide' }, { status: 400 })

  const { taskId } = await params
  const { data, error } = await access.db
    .from('sales_activities')
    .update({ completed_at: parsed.data.completed ? new Date().toISOString() : null })
    .eq('id', taskId)
    .eq('sales_partner_id', access.partner.id)
    .eq('kind', 'task')
    .select('id, title, details, due_at, completed_at, lead_id, created_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
  return NextResponse.json({ task: data })
}
