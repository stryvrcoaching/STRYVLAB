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

async function verifySubmissionOwnership(
  db: ReturnType<typeof serviceClient>,
  submissionId: string,
  clientId: string,
  userId: string
): Promise<boolean> {
  const { data } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('id', submissionId)
    .eq('client_id', clientId)
    .eq('coach_id', userId)
    .maybeSingle()
  return !!data
}

// ─── PATCH /api/clients/[clientId]/metrics/[submissionId] ─────────────────────
// Update values on an existing submission row.
// Body: { date?: string (YYYY-MM-DD), values: { [fieldKey]: number | null } }
// Setting a value to null removes that response row.
const patchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  values: z.record(z.string(), z.number().nullable()),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { clientId: string; submissionId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  if (!(await verifySubmissionOwnership(db, params.submissionId, params.clientId, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = patchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const { date, values } = body.data

  // Update submission date if provided
  if (date) {
    const submittedAt = new Date(`${date}T12:00:00Z`).toISOString()
    const { error: updErr } = await db
      .from('assessment_submissions')
      .update({ bilan_date: date, submitted_at: submittedAt })
      .eq('id', params.submissionId)
    if (updErr) {
      console.error('[metrics PATCH] date update error:', updErr)
      return NextResponse.json({ error: 'Erreur mise à jour date' }, { status: 500 })
    }
  }

  // Load existing responses to know which block_id each field lives in.
  // This is critical for bilan submissions that use a real block UUID — writing
  // to 'csv_import_block' would create cross-block duplicates.
  const { data: existingResponses } = await db
    .from('assessment_responses')
    .select('field_key, block_id')
    .eq('submission_id', params.submissionId)

  // Map field_key → existing block_id (first occurrence wins)
  const existingBlockId: Record<string, string> = {}
  for (const r of existingResponses ?? []) {
    if (!(r.field_key in existingBlockId)) {
      existingBlockId[r.field_key] = r.block_id
    }
  }

  // Canonical block_id for new fields: prefer the block that holds weight_kg,
  // otherwise the most common block in this submission, otherwise csv_import_block.
  const canonicalBlockId = existingBlockId['weight_kg']
    ?? (existingResponses?.length
      ? Object.values(existingBlockId).sort((a, b) =>
          Object.values(existingBlockId).filter(v => v === b).length -
          Object.values(existingBlockId).filter(v => v === a).length
        )[0]
      : 'csv_import_block')

  // Upsert or delete each field value
  for (const [fieldKey, value] of Object.entries(values)) {
    if (value === null) {
      // Remove this field from the submission across ALL block_ids
      await db
        .from('assessment_responses')
        .delete()
        .eq('submission_id', params.submissionId)
        .eq('field_key', fieldKey)
    } else {
      const blockId = existingBlockId[fieldKey] ?? canonicalBlockId
      const { error: upsertErr } = await db
        .from('assessment_responses')
        .upsert(
          {
            submission_id: params.submissionId,
            block_id: blockId,
            field_key: fieldKey,
            value_number: value,
          },
          { onConflict: 'submission_id,block_id,field_key' }
        )
      if (upsertErr) {
        console.error('[metrics PATCH] upsert error:', upsertErr)
        return NextResponse.json({ error: 'Erreur mise à jour valeur' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

// ─── DELETE /api/clients/[clientId]/metrics/[submissionId] ────────────────────
// Deletes the submission row + all its responses (CASCADE handles responses).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clientId: string; submissionId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  if (!(await verifySubmissionOwnership(db, params.submissionId, params.clientId, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await db
    .from('assessment_submissions')
    .delete()
    .eq('id', params.submissionId)

  if (error) {
    console.error('[metrics DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
