import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSalesAccess } from '@/lib/sales/access'

const bodySchema = z.object({
  pushToken: z.string().min(1).max(10000),
})

export async function POST(req: NextRequest) {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Inscription push invalide' }, { status: 400 })
  }

  const { error } = await access.db
    .from('sales_partners')
    .update({ push_token: parsed.data.pushToken })
    .eq('id', access.partner.id)

  if (error) {
    console.error('[sales/push/subscribe] Failed to save push token:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
