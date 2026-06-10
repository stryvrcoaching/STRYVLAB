// app/api/morpho/photos/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bodySchema = z.object({ clientId: z.string().uuid() })
const querySchema = z.object({ clientId: z.string().uuid() })

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: 'clientId requis' }, { status: 400 })
  }

  const db = service()
  const { clientId } = body.data

  // Vérifier ownership coach
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Récupérer toutes les submissions complétées du client
  const { data: submissions } = await db
    .from('assessment_submissions')
    .select('id, bilan_date')
    .eq('client_id', clientId)
    .eq('status', 'completed')

  if (!submissions || submissions.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  const submissionIds = (submissions as Array<{ id: string; bilan_date: string }>).map(s => s.id)

  // Récupérer les assessment_responses avec photos
  const { data: responses } = await db
    .from('assessment_responses')
    .select('id, submission_id, storage_path, field_key')
    .in('submission_id', submissionIds)
    .like('field_key', 'photo_%')
    .not('storage_path', 'is', null)

  if (!responses || responses.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  const submissionMap = new Map(
    (submissions as Array<{ id: string; bilan_date: string }>).map(s => [s.id, s.bilan_date])
  )

  const POSITION_MAP: Record<string, string> = {
    front: 'front', back: 'back', left: 'left', right: 'right',
    three_quarter_front_left: 'three_quarter_front_left',
    three_quarter_front_right: 'three_quarter_front_right',
    // bilan module field keys (lib/assessments/modules.ts)
    side_right: 'right', side_left: 'left',
    relaxed: 'relaxed', contracted: 'contracted',
    // anciens bilans — variantes FR
    face: 'front', dos: 'back', profil_g: 'left', profil_d: 'right',
    profil_gauche: 'left', profil_droit: 'right',
    trois_quarts_gauche: 'three_quarter_front_left',
    trois_quarts_droit: 'three_quarter_front_right',
  }

  function positionFromFieldKey(fieldKey: string): string | null {
    const key = fieldKey.replace('photo_', '')
    return POSITION_MAP[key] ?? null
  }

  const toInsert = (responses as Array<{ id: string; submission_id: string; storage_path: string; field_key: string }>)
    .filter(r => r.storage_path && positionFromFieldKey(r.field_key) !== null)
    .map(r => ({
      client_id: clientId,
      coach_id: user.id,
      storage_path: r.storage_path,
      position: positionFromFieldKey(r.field_key) as string,
      taken_at: submissionMap.get(r.submission_id) ?? new Date().toISOString().split('T')[0],
      source: 'assessment',
      assessment_response_id: r.id,
    }))

  if (toInsert.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  // Upsert batch. Si le batch échoue (ex: contrainte sur une ligne), on retombe
  // sur un upsert ligne-par-ligne pour ne pas perdre toutes les photos valides.
  const { data: inserted, error: insertError } = await db
    .from('morpho_photos')
    .upsert(toInsert, { onConflict: 'assessment_response_id', ignoreDuplicates: false })
    .select('id')

  if (insertError) {
    let okCount = 0
    const errors: string[] = []
    for (const row of toInsert) {
      const { error: rowErr } = await db
        .from('morpho_photos')
        .upsert(row, { onConflict: 'assessment_response_id', ignoreDuplicates: false })
      if (rowErr) errors.push(`${row.position}: ${rowErr.message}`)
      else okCount++
    }
    return NextResponse.json({ synced: okCount, skipped: errors })
  }

  return NextResponse.json({ synced: inserted?.length ?? 0 })
}

// GET: debug — returns all field_keys and current morpho_photos positions for a client
// Usage: /api/morpho/photos/sync?clientId=xxx
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const params = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!params.success) return NextResponse.json({ error: 'clientId requis' }, { status: 400 })

  const db = service()
  const { clientId } = params.data

  const { data: clientRow } = await db
    .from('coach_clients').select('id').eq('id', clientId).eq('coach_id', user.id).single()
  if (!clientRow) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data: submissions } = await db
    .from('assessment_submissions').select('id').eq('client_id', clientId).eq('status', 'completed')

  const submissionIds = (submissions ?? []).map((s: { id: string }) => s.id)

  const { data: responses } = submissionIds.length > 0
    ? await db.from('assessment_responses')
        .select('id, field_key, storage_path')
        .in('submission_id', submissionIds)
        .like('field_key', 'photo_%')
        .not('storage_path', 'is', null)
    : { data: [] }

  const { data: morphoPhotos } = await db
    .from('morpho_photos')
    .select('id, position, assessment_response_id, storage_path')
    .eq('client_id', clientId)

  const fieldKeys = Array.from(new Set((responses ?? []).map((r: { field_key: string }) => r.field_key)))

  return NextResponse.json({
    field_keys_found: fieldKeys,
    morpho_positions: (morphoPhotos ?? []).map((p: { id: string; position: string; assessment_response_id: string | null }) => ({
      id: p.id, position: p.position, has_response_id: !!p.assessment_response_id
    }))
  })
}
