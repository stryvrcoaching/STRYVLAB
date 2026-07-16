import type { SupabaseClient } from '@supabase/supabase-js'

type ProgramAnnotationDb = SupabaseClient

interface ProgramAnnotationInput {
  clientId: string
  coachId: string
  programId: string
  programName: string
  eventDate?: string
}

const SHARED_BODY = 'Programme partagé avec le client'
const UPDATED_BODY = 'Programme partagé mis à jour'

function resolveEventDate(eventDate?: string) {
  return eventDate ?? new Date().toISOString().split('T')[0]
}

export async function ensureProgramSharedAnnotation(
  db: ProgramAnnotationDb,
  input: ProgramAnnotationInput,
) {
  const { data: existing } = await db
    .from('metric_annotations')
    .select('id')
    .eq('client_id', input.clientId)
    .eq('event_type', 'program_change')
    .eq('source_id', input.programId)
    .limit(1)
    .maybeSingle()

  if ((existing as { id?: string } | null)?.id) return existing?.id

  const { data } = await db
    .from('metric_annotations')
    .insert({
      client_id: input.clientId,
      coach_id: input.coachId,
      event_type: 'program_change',
      event_date: resolveEventDate(input.eventDate),
      label: `Nouveau programme : ${input.programName}`,
      body: SHARED_BODY,
      source_id: input.programId,
    })
    .select('id')
    .single()

  return (data as { id?: string } | null)?.id
}

export async function upsertProgramUpdatedAnnotation(
  db: ProgramAnnotationDb,
  input: ProgramAnnotationInput,
) {
  const eventDate = resolveEventDate(input.eventDate)
  const label = `Mise à jour du programme : ${input.programName}`
  const { data: existing } = await db
    .from('metric_annotations')
    .select('id')
    .eq('client_id', input.clientId)
    .eq('event_type', 'program_change')
    .eq('source_id', input.programId)
    .eq('event_date', eventDate)
    .eq('body', UPDATED_BODY)
    .limit(1)
    .maybeSingle()

  if ((existing as { id?: string } | null)?.id) {
    await db
      .from('metric_annotations')
      .update({ label })
      .eq('id', existing?.id)
    return existing?.id
  }

  const { data } = await db
    .from('metric_annotations')
    .insert({
      client_id: input.clientId,
      coach_id: input.coachId,
      event_type: 'program_change',
      event_date: eventDate,
      label,
      body: UPDATED_BODY,
      source_id: input.programId,
    })
    .select('id')
    .single()

  return (data as { id?: string } | null)?.id
}
