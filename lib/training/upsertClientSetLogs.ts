import type { SupabaseClient } from '@supabase/supabase-js'
import { dedupeSetLogsForUpsert, type SetLogUpsertRow } from '@/lib/training/dedupeSetLogsForUpsert'

export type ClientSetLogRow = SetLogUpsertRow & {
  session_log_id: string
  planned_reps?: string | number | null
  actual_reps?: number | null
  actual_weight_kg?: number | null
  completed?: boolean
  rir_actual?: number | null
  notes?: string | null
  rest_sec_actual?: number | null
  primary_muscles?: string[]
  secondary_muscles?: string[]
  tempo_used?: string | null
  rpe?: number | null
}

const UPSERT_ON_CONFLICT = 'session_log_id,exercise_id,set_number,side'

async function deleteStaleSetLogRows(
  db: SupabaseClient,
  sessionLogId: string,
  rows: ClientSetLogRow[],
) {
  await db
    .from('client_set_logs')
    .delete()
    .eq('session_log_id', sessionLogId)
    .is('exercise_id', null)

  for (const row of rows) {
    if (!row.exercise_id) continue
    await db
      .from('client_set_logs')
      .delete()
      .eq('session_log_id', sessionLogId)
      .eq('exercise_name', row.exercise_name)
      .eq('set_number', row.set_number)
      .eq('side', row.side)
      .or(`exercise_id.is.null,exercise_id.neq.${row.exercise_id}`)
  }
}

/** exercise_id absent de program_exercises → FK 23503 ; on sauve sans FK. */
async function splitRowsByValidExerciseFk(
  db: SupabaseClient,
  rows: ClientSetLogRow[],
): Promise<{ withFk: ClientSetLogRow[]; withoutFk: ClientSetLogRow[] }> {
  const ids = [...new Set(rows.map(r => r.exercise_id).filter(Boolean))] as string[]
  if (ids.length === 0) {
    return { withFk: [], withoutFk: rows.map(r => ({ ...r, exercise_id: null })) }
  }

  const { data: found } = await db.from('program_exercises').select('id').in('id', ids)
  const valid = new Set((found ?? []).map(r => r.id))

  const withFk: ClientSetLogRow[] = []
  const withoutFk: ClientSetLogRow[] = []

  for (const row of rows) {
    if (row.exercise_id && valid.has(row.exercise_id)) {
      withFk.push(row)
    } else {
      withoutFk.push({ ...row, exercise_id: null })
    }
  }
  return { withFk, withoutFk }
}

async function replaceSetsByNameKey(
  db: SupabaseClient,
  sessionLogId: string,
  rows: ClientSetLogRow[],
): Promise<{ code?: string; message: string } | null> {
  for (const row of rows) {
    await db
      .from('client_set_logs')
      .delete()
      .eq('session_log_id', sessionLogId)
      .eq('exercise_name', row.exercise_name)
      .eq('set_number', row.set_number)
      .eq('side', row.side)
  }

  if (rows.length === 0) return null

  const { error } = await db.from('client_set_logs').insert(
    rows.map(r => ({ ...r, session_log_id: sessionLogId, exercise_id: null })),
  )
  return error ? { code: error.code, message: error.message } : null
}

async function upsertSetsWithExerciseFk(
  db: SupabaseClient,
  rows: ClientSetLogRow[],
): Promise<{ code?: string; message: string } | null> {
  if (rows.length === 0) return null
  const { error } = await db.from('client_set_logs').upsert(rows, { onConflict: UPSERT_ON_CONFLICT })
  return error ? { code: error.code, message: error.message } : null
}

export async function upsertClientSetLogs(
  db: SupabaseClient,
  sessionLogId: string,
  rawRows: ClientSetLogRow[],
): Promise<{ error: { code?: string; message: string } | null }> {
  const rows = dedupeSetLogsForUpsert(rawRows)
  if (rows.length === 0) return { error: null }

  const { data: sessionLog } = await db
    .from('client_session_logs')
    .select('id')
    .eq('id', sessionLogId)
    .maybeSingle()

  if (!sessionLog) {
    return { error: { code: 'SESSION_NOT_FOUND', message: 'Session log introuvable' } }
  }

  await deleteStaleSetLogRows(db, sessionLogId, rows)

  const { withFk, withoutFk } = await splitRowsByValidExerciseFk(db, rows)

  let error = await upsertSetsWithExerciseFk(db, withFk)

  if (error?.code === '23505') {
    await deleteStaleSetLogRows(db, sessionLogId, withFk)
    error = await upsertSetsWithExerciseFk(db, withFk)
  }

  if (!error && withoutFk.length > 0) {
    error = await replaceSetsByNameKey(db, sessionLogId, withoutFk)
  }

  if (error?.code === '23503') {
    const allWithoutFk = rows.map(r => ({ ...r, exercise_id: null }))
    await deleteStaleSetLogRows(db, sessionLogId, rows)
    error = await replaceSetsByNameKey(db, sessionLogId, allWithoutFk)
  }

  return { error }
}
