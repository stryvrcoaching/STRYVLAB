import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const IMPORT_TEMPLATE_NAME = '__csv_import__'

async function verifyOwnership(db: ReturnType<typeof serviceClient>, clientId: string, userId: string) {
  const { data } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', userId)
    .maybeSingle()
  return !!data
}

async function getOrCreateManualTemplate(db: ReturnType<typeof serviceClient>, coachId: string): Promise<string> {
  const { data: existing } = await db
    .from('assessment_templates')
    .select('id')
    .eq('coach_id', coachId)
    .eq('name', IMPORT_TEMPLATE_NAME)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: created, error } = await db
    .from('assessment_templates')
    .insert({
      coach_id: coachId,
      name: IMPORT_TEMPLATE_NAME,
      description: 'Template système — import CSV / saisie manuelle',
      template_type: 'custom',
      blocks: [{ id: 'csv_import_block', module: 'biometrics', title: 'Mesures', fields: [] }],
      is_default: false,
    })
    .select('id')
    .single()

  if (error || !created) throw new Error('Failed to create import template')
  return created.id
}

// ─── GET /api/clients/[clientId]/metrics ──────────────────────────────────────
// Returns:
//   series: { [fieldKey]: { date, value }[] }          — for charts
//   rows:   { submissionId, date, values: { [fieldKey]: number } }[]  — for table
export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  if (!(await verifyOwnership(db, params.clientId, user.id))) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data: submissions, error } = await db
    .from('assessment_submissions')
    .select(`id, submitted_at, bilan_date, created_at, assessment_responses(field_key, value_number)`)
    .eq('client_id', params.clientId)
    .eq('coach_id', user.id)
    .eq('status', 'completed')
    .order('submitted_at', { ascending: true })

  if (error) {
    console.error('[metrics GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type RespRow = { field_key: string; value_number: number | null }
  const series: Record<string, { date: string; value: number }[]> = {}
  const rows: { submissionId: string; date: string; values: Record<string, number> }[] = []

  for (const sub of submissions ?? []) {
    const rawDate: string = sub.bilan_date ?? sub.submitted_at ?? sub.created_at
    const date: string = rawDate.split('T')[0]
    const values: Record<string, number> = {}
    for (const resp of (sub.assessment_responses ?? []) as RespRow[]) {
      if (resp.value_number == null) continue
      values[resp.field_key] = resp.value_number
      if (!series[resp.field_key]) series[resp.field_key] = []
      series[resp.field_key].push({ date, value: resp.value_number })
    }
    if (Object.keys(values).length > 0) {
      rows.push({ submissionId: sub.id, date, values })
    }
  }

  // rows are already ASC by submitted_at; reverse for table (most recent first)
  rows.reverse()

  return NextResponse.json({ series, rows })
}

// ─── POST /api/clients/[clientId]/metrics ─────────────────────────────────────
// Manual entry: create one measurement row for a given date
const manualEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  values: z.record(z.string(), z.number()),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  if (!(await verifyOwnership(db, params.clientId, user.id))) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const body = manualEntrySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const { date, values } = body.data
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: 'At least one value required' }, { status: 400 })
  }

  const templateId = await getOrCreateManualTemplate(db, user.id)

  const submittedAt = new Date(`${date}T12:00:00Z`).toISOString()

  // Idempotency: check if a manual/csv entry already exists for this date
  const { data: existing } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', params.clientId)
    .eq('template_id', templateId)
    .eq('submitted_at', submittedAt)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Une mesure existe déjà pour cette date' }, { status: 409 })
  }

  const { data: submission, error: subError } = await db
    .from('assessment_submissions')
    .insert({
      coach_id: user.id,
      client_id: params.clientId,
      template_id: templateId,
      template_snapshot: { blocks: [{ id: 'csv_import_block', module: 'biometrics' }] },
      status: 'completed',
      filled_by: 'coach',
      submitted_at: submittedAt,
      bilan_date: date,
    })
    .select('id')
    .single()

  if (subError || !submission) {
    console.error('[metrics POST] submission error:', subError)
    return NextResponse.json({ error: 'Erreur création' }, { status: 500 })
  }

  const responses = Object.entries(values).map(([fieldKey, value]) => ({
    submission_id: submission.id,
    block_id: 'csv_import_block',
    field_key: fieldKey,
    value_number: value,
  }))

  const { error: respError } = await db.from('assessment_responses').insert(responses)
  if (respError) {
    console.error('[metrics POST] responses error:', respError)
    return NextResponse.json({ error: 'Erreur insertion réponses' }, { status: 500 })
  }

  return NextResponse.json({ submissionId: submission.id }, { status: 201 })
}
