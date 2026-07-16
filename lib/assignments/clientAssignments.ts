import type { SupabaseClient } from '@supabase/supabase-js'

type AssignmentDb = SupabaseClient

function isMissingAssignmentTableError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    error?.code === '42P01' ||
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  )
}

export async function activateNutritionProtocolAssignment(
  db: AssignmentDb,
  {
    clientId,
    coachId,
    protocolId,
    startedBy,
    sourceAnnotationId = null,
  }: {
    clientId: string
    coachId: string
    protocolId: string
    startedBy: string
    sourceAnnotationId?: string | null
  },
) {
  const now = new Date().toISOString()
  const closeExistingResult = await db
    .from('client_nutrition_protocol_assignments')
    .update({
      ended_at: now,
      ended_reason: 'replace',
      ended_by: startedBy,
      updated_at: now,
    })
    .eq('client_id', clientId)
    .is('ended_at', null)
    .neq('protocol_id', protocolId)
  if (isMissingAssignmentTableError(closeExistingResult.error)) return null

  const { data: existing, error: existingError } = await db
    .from('client_nutrition_protocol_assignments')
    .select('id')
    .eq('client_id', clientId)
    .eq('protocol_id', protocolId)
    .is('ended_at', null)
    .maybeSingle()
  if (isMissingAssignmentTableError(existingError)) return null

  if ((existing as any)?.id) {
    return (existing as any).id as string
  }

  const { data, error } = await db
    .from('client_nutrition_protocol_assignments')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      protocol_id: protocolId,
      started_reason: 'share',
      started_by: startedBy,
      source_annotation_id: sourceAnnotationId,
    })
    .select('id')
    .single()

  if (isMissingAssignmentTableError(error)) return null
  if (error || !data) throw new Error(error?.message ?? 'Failed to open nutrition assignment')
  return data.id as string
}

export async function closeNutritionProtocolAssignment(
  db: AssignmentDb,
  {
    clientId,
    protocolId,
    endedBy,
    reason,
  }: {
    clientId: string
    protocolId: string
    endedBy: string
    reason: 'unshare' | 'replace' | 'delete'
  },
) {
  const now = new Date().toISOString()
  const result = await db
    .from('client_nutrition_protocol_assignments')
    .update({
      ended_at: now,
      ended_reason: reason,
      ended_by: endedBy,
      updated_at: now,
    })
    .eq('client_id', clientId)
    .eq('protocol_id', protocolId)
    .is('ended_at', null)
  if (isMissingAssignmentTableError(result.error)) return
}

export async function activateWorkoutProgramAssignment(
  db: AssignmentDb,
  {
    clientId,
    coachId,
    programId,
    startedBy,
    sourceAnnotationId = null,
  }: {
    clientId: string
    coachId: string
    programId: string
    startedBy: string
    sourceAnnotationId?: string | null
  },
) {
  const now = new Date().toISOString()
  await db
    .from('client_workout_program_assignments')
    .update({
      ended_at: now,
      ended_reason: 'replace',
      ended_by: startedBy,
      updated_at: now,
    })
    .eq('client_id', clientId)
    .is('ended_at', null)
    .neq('program_id', programId)

  const { data: existing } = await db
    .from('client_workout_program_assignments')
    .select('id')
    .eq('client_id', clientId)
    .eq('program_id', programId)
    .is('ended_at', null)
    .maybeSingle()

  if ((existing as any)?.id) {
    return (existing as any).id as string
  }

  const { data, error } = await db
    .from('client_workout_program_assignments')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      program_id: programId,
      started_reason: 'publish',
      started_by: startedBy,
      source_annotation_id: sourceAnnotationId,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to open workout assignment')
  return data.id as string
}

export async function closeWorkoutProgramAssignment(
  db: AssignmentDb,
  {
    clientId,
    programId,
    endedBy,
    reason,
  }: {
    clientId: string
    programId: string
    endedBy: string
    reason: 'unpublish' | 'replace' | 'delete'
  },
) {
  const now = new Date().toISOString()
  await db
    .from('client_workout_program_assignments')
    .update({
      ended_at: now,
      ended_reason: reason,
      ended_by: endedBy,
      updated_at: now,
    })
    .eq('client_id', clientId)
    .eq('program_id', programId)
    .is('ended_at', null)
}
