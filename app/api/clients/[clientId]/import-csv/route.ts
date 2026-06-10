import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient, SupabaseClient } from '@supabase/supabase-js'
import { parseCsvText, buildPreview, ColMapping } from '@/lib/csv-import/detect'

const IMPORT_TEMPLATE_NAME = '__csv_import__'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreateImportTemplate(db: SupabaseClient<any>, coachId: string): Promise<string> {
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
      description: 'Template système — import CSV',
      template_type: 'custom',
      blocks: [{ id: 'csv_import_block', module: 'biometrics', title: 'Import CSV', fields: [] }],
      is_default: false,
    })
    .select('id')
    .single()

  if (error || !created) throw new Error('Failed to create import template')
  return created.id
}

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify client belongs to coach
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const mappingsRaw = formData.get('mappings') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!mappingsRaw) return NextResponse.json({ error: 'No mappings provided' }, { status: 400 })

  let mappings: ColMapping[]
  try {
    mappings = JSON.parse(mappingsRaw)
  } catch {
    return NextResponse.json({ error: 'Invalid mappings JSON' }, { status: 400 })
  }

  const text = await file.text()
  const parsed = parseCsvText(text)
  const rows = buildPreview(parsed, mappings)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne valide trouvée dans le CSV' }, { status: 400 })
  }

  const templateId = await getOrCreateImportTemplate(db, user.id)

  let inserted = 0
  let skipped = 0

  for (const row of rows) {
    if (!row.parsedDate) continue

    const submittedAt = row.parsedDate.toISOString()

    // Idempotency check
    const { data: existing } = await db
      .from('assessment_submissions')
      .select('id')
      .eq('client_id', params.clientId)
      .eq('template_id', templateId)
      .eq('submitted_at', submittedAt)
      .maybeSingle()

    if (existing) { skipped++; continue }

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
        bilan_date: row.parsedDate.toISOString().split('T')[0],
      })
      .select('id')
      .single()

    if (subError || !submission) {
      console.error('[import-csv] submission insert error:', subError)
      continue
    }

    const responses = Object.entries(row.values)
      .filter(([, v]) => v !== null)
      .map(([fieldKey, value]) => ({
        submission_id: submission.id,
        block_id: 'csv_import_block',
        field_key: fieldKey,
        value_number: value,
      }))

    if (responses.length > 0) {
      const { error: respError } = await db
        .from('assessment_responses')
        .insert(responses)
      if (respError) {
        console.error('[import-csv] responses insert error:', respError)
      } else {
        inserted++
      }
    }
  }

  return NextResponse.json({
    inserted,
    skipped,
    total: rows.length,
    message: `${inserted} mesure${inserted !== 1 ? 's' : ''} importée${inserted !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} doublon${skipped !== 1 ? 's' : ''} ignoré${skipped !== 1 ? 's' : ''}` : ''}`,
  })
}
