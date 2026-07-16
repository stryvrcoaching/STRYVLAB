import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { coachOwnsClient } from '@/lib/security/client-resource-access'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function normalizeAnnotations(rows: any[]) {
  const sorted = [...rows].sort((a, b) =>
    a.event_date.localeCompare(b.event_date) || String(a.id).localeCompare(String(b.id))
  )

  const seenKeys = new Set<string>()
  const firstNutritionDateByProtocol = new Map<string, string>()

  const normalized: any[] = []
  for (let row of sorted) {
    const dedupeKey = `${row.source_id ?? row.id}:${row.event_type}:${row.event_date}:${row.label}:${row.body ?? ''}`
    if (seenKeys.has(dedupeKey)) continue
    seenKeys.add(dedupeKey)

    if (row.event_type === 'nutrition' && row.source_id && typeof row.label === 'string') {
      const firstDate = firstNutritionDateByProtocol.get(row.source_id)
      if (!firstDate) {
        firstNutritionDateByProtocol.set(row.source_id, row.event_date)
      } else if (row.label.startsWith('Protocole nutritionnel : ')) {
        row = {
          ...row,
          label: row.label.replace(
            'Protocole nutritionnel : ',
            'Mise a jour du protocole nutritionnel : ',
          ),
          body: row.body ?? 'Protocole partage mis a jour',
        }
      }
    }

    normalized.push(row)
  }

  return normalized
}

const createSchema = z.object({
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1).max(200),
  body: z.string().max(5000).nullable().optional(),
  event_type: z.enum(['program_change', 'injury', 'travel', 'nutrition', 'note', 'lab_protocol']),
  body_part: z.string().max(50).optional().nullable(),
  severity: z.enum(['avoid', 'limit', 'monitor']).optional().nullable(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const owns = await coachOwnsClient({ db, clientId, coachUserId: user.id })
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db
    .from('metric_annotations')
    .select('*')
    .eq('client_id', clientId)
    .order('event_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(normalizeAnnotations(data ?? []))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const owns = await coachOwnsClient({ db, clientId, coachUserId: user.id })
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = createSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.issues.map((i) => i.message).join(', ') }, { status: 400 })

  const { data, error } = await db
    .from('metric_annotations')
    .insert({
      client_id: clientId,
      coach_id: user.id,
      ...body.data,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
