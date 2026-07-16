import { NextResponse } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { getCoachDataAccessMode } from '@/lib/privacy/retention'

const PAGE_SIZE = 1000

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function fetchAllRows(
  db: SupabaseClient,
  table: string,
  filterColumn: string,
  filterValue: string | string[],
) {
  if (Array.isArray(filterValue) && filterValue.length === 0) return []

  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db.from(table).select('*')
    query = Array.isArray(filterValue)
      ? query.in(filterColumn, filterValue)
      : query.eq(filterColumn, filterValue)

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)

    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows as Record<string, unknown>[]
}

function withoutKeys(row: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)))
}

export async function GET() {
  const auth = createServerClient()
  const { data: { user }, error: authError } = await auth.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Non authentifié' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const db = serviceClient()
  const { data: coachProfile, error: profileError } = await db
    .from('coach_profiles')
    .select('*')
    .eq('coach_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[privacy-export] profile unavailable:', profileError.message)
    return NextResponse.json(
      { error: 'Export indisponible' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const accessMode = getCoachDataAccessMode(
    coachProfile?.billing_status,
    coachProfile?.data_export_available_until,
  )
  if (accessMode === 'expired') {
    return NextResponse.json(
      { error: 'La fenêtre d’export après résiliation est terminée.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    const [clients, assessmentTemplates, assessmentSubmissions, programs, nutritionProtocols] =
      await Promise.all([
        fetchAllRows(db, 'coach_clients', 'coach_id', user.id),
        fetchAllRows(db, 'assessment_templates', 'coach_id', user.id),
        fetchAllRows(db, 'assessment_submissions', 'coach_id', user.id),
        fetchAllRows(db, 'programs', 'coach_id', user.id),
        fetchAllRows(db, 'nutrition_protocols', 'coach_id', user.id),
      ])

    const clientIds = clients.map((row) => String(row.id))
    const submissionIds = assessmentSubmissions.map((row) => String(row.id))
    const programIds = programs.map((row) => String(row.id))
    const protocolIds = nutritionProtocols.map((row) => String(row.id))

    const [
      assessmentResponses,
      programSessions,
      nutritionProtocolDays,
      formulas,
      subscriptions,
      payments,
      invoices,
      tags,
      clientTags,
    ] = await Promise.all([
      fetchAllRows(db, 'assessment_responses', 'submission_id', submissionIds),
      fetchAllRows(db, 'program_sessions', 'program_id', programIds),
      fetchAllRows(db, 'nutrition_protocol_days', 'protocol_id', protocolIds),
      fetchAllRows(db, 'coach_formulas', 'coach_id', user.id),
      fetchAllRows(db, 'client_subscriptions', 'coach_id', user.id),
      fetchAllRows(db, 'subscription_payments', 'coach_id', user.id),
      fetchAllRows(db, 'coach_invoices', 'coach_id', user.id),
      fetchAllRows(db, 'coach_tags', 'coach_id', user.id),
      fetchAllRows(db, 'client_tags', 'client_id', clientIds),
    ])

    const sessionIds = programSessions.map((row) => String(row.id))
    const programExercises = await fetchAllRows(db, 'program_exercises', 'session_id', sessionIds)

    const exportedAt = new Date().toISOString()
    const payload = {
      format: 'stryv-coach-data-export',
      formatVersion: 1,
      exportedAt,
      accessMode,
      account: {
        id: user.id,
        email: user.email ?? null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        metadata: user.user_metadata ?? {},
        profile: coachProfile ? withoutKeys(coachProfile, []) : null,
      },
      crm: {
        clients,
        formulas,
        subscriptions,
        payments,
        invoices: invoices.map((row) => withoutKeys(row, ['secure_link_token_hash'])),
        tags,
        clientTags,
      },
      assessments: {
        templates: assessmentTemplates,
        submissions: assessmentSubmissions.map((row) => withoutKeys(row, ['token'])),
        responses: assessmentResponses,
      },
      training: {
        programs,
        sessions: programSessions,
        exercises: programExercises,
      },
      nutrition: {
        protocols: nutritionProtocols,
        days: nutritionProtocolDays,
      },
    }

    const date = exportedAt.slice(0, 10)
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, private',
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="stryv-export-${date}.json"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[privacy-export] export failed:', error)
    return NextResponse.json(
      { error: 'Export incomplet, aucune archive n’a été générée.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
