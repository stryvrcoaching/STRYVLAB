import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import {
  buildProgramPdfFilename,
  goalLabel,
  levelLabel,
  type PdfClientInfo,
  type PdfCoachInfo,
  type PdfProgramDocumentData,
} from '@/lib/program-pdf/model'
import { resolvePdfImageSource } from '@/lib/program-pdf/assets'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const PROGRAM_SELECT = `
  id, client_id, name, description, goal, level, frequency, weeks, muscle_tags, session_mode, created_at,
  program_sessions (
    id, name, position, notes,
    program_exercises (
      id, name, sets, reps, rest_sec, rir, notes, position, image_url, tempo
    )
  )
`

const TEMPLATE_SELECT = `
  id, name, description, goal, level, frequency, weeks, muscle_tags, notes, session_mode, created_at,
  coach_program_template_sessions (
    id, name, position, notes,
    coach_program_template_exercises (
      id, name, sets, reps, rest_sec, rir, notes, position, image_url, tempo
    )
  )
`

export async function resolveCoachInfo(user: User): Promise<PdfCoachInfo> {
  const db = serviceClient()
  const { data: coachProfile } = await db
    .from('coach_profiles')
    .select('full_name, brand_name, pro_email, phone, logo_url')
    .eq('coach_id', user.id)
    .maybeSingle()

  const meta = user.user_metadata ?? {}
  const firstName = String(meta.first_name ?? '').trim()
  const lastName = String(meta.last_name ?? '').trim()
  const fallbackName = [firstName, lastName].filter(Boolean).join(' ').trim()

  return {
    id: user.id,
    name:
      coachProfile?.full_name?.trim() ||
      String(meta.full_name ?? '').trim() ||
      fallbackName ||
      coachProfile?.brand_name?.trim() ||
      user.email ||
      'Votre coach',
    email: coachProfile?.pro_email ?? user.email ?? null,
    phone: coachProfile?.phone ?? null,
    brandName: coachProfile?.brand_name ?? null,
    logoUrl: resolvePdfImageSource(coachProfile?.logo_url ?? null),
  }
}

export async function resolveClientsForCoach(coachId: string) {
  const db = serviceClient()
  const { data, error } = await db
    .from('coach_clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', coachId)
    .order('first_name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email ?? null,
  })) as PdfClientInfo[]
}

export async function getProgramPdfData(programId: string, user: User): Promise<PdfProgramDocumentData> {
  const db = serviceClient()
  const { data: program, error } = await db
    .from('programs')
    .select(PROGRAM_SELECT)
    .eq('id', programId)
    .eq('coach_id', user.id)
    .single()

  if (error || !program) throw new Error('Programme introuvable')

  const clientId = (program as any).client_id as string | null
  const { data: client } = clientId
    ? await db
        .from('coach_clients')
        .select('id, first_name, last_name, email')
        .eq('id', clientId)
        .eq('coach_id', user.id)
        .single()
    : { data: null }

  const coach = await resolveCoachInfo(user)

  return {
    sourceType: 'program',
    title: (program as any).name,
    description: (program as any).description ?? null,
    weeks: (program as any).weeks ?? null,
    frequency: (program as any).frequency ?? null,
    goalLabel: goalLabel((program as any).goal),
    levelLabel: levelLabel((program as any).level),
    muscleTags: ((program as any).muscle_tags ?? []) as string[],
    notes: null,
    sessionMode: (program as any).session_mode ?? null,
    generatedAt: new Date().toISOString(),
    coach,
    client: client
      ? {
          id: client.id,
          firstName: client.first_name ?? '',
          lastName: client.last_name ?? '',
          email: client.email ?? null,
        }
      : null,
    sessions: (((program as any).program_sessions ?? []) as any[])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((session) => ({
        id: session.id,
        name: session.name,
        notes: session.notes ?? null,
        position: session.position ?? 0,
        exercises: ((session.program_exercises ?? []) as any[])
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            sets: typeof exercise.sets === 'number' ? exercise.sets : null,
            reps: exercise.reps ?? null,
            restSec: typeof exercise.rest_sec === 'number' ? exercise.rest_sec : null,
            rir: typeof exercise.rir === 'number' ? exercise.rir : null,
            tempo: exercise.tempo ?? null,
            notes: exercise.notes ?? null,
            imageUrl: resolvePdfImageSource(exercise.image_url ?? null),
            position: exercise.position ?? 0,
          })),
      })),
  }
}

export async function getTemplatePdfData(templateId: string, user: User): Promise<PdfProgramDocumentData> {
  const db = serviceClient()
  const { data: template, error } = await db
    .from('coach_program_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', templateId)
    .or(`coach_id.eq.${user.id},is_system.eq.true`)
    .single()

  if (error || !template) throw new Error('Template introuvable')

  const coach = await resolveCoachInfo(user)

  return {
    sourceType: 'template',
    title: (template as any).name,
    description: (template as any).description ?? null,
    weeks: (template as any).weeks ?? null,
    frequency: (template as any).frequency ?? null,
    goalLabel: goalLabel((template as any).goal),
    levelLabel: levelLabel((template as any).level),
    muscleTags: ((template as any).muscle_tags ?? []) as string[],
    notes: (template as any).notes ?? null,
    sessionMode: (template as any).session_mode ?? null,
    generatedAt: new Date().toISOString(),
    coach,
    client: null,
    sessions: (((template as any).coach_program_template_sessions ?? []) as any[])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((session) => ({
        id: session.id,
        name: session.name,
        notes: session.notes ?? null,
        position: session.position ?? 0,
        exercises: ((session.coach_program_template_exercises ?? []) as any[])
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            sets: typeof exercise.sets === 'number' ? exercise.sets : null,
            reps: exercise.reps ?? null,
            restSec: typeof exercise.rest_sec === 'number' ? exercise.rest_sec : null,
            rir: typeof exercise.rir === 'number' ? exercise.rir : null,
            tempo: exercise.tempo ?? null,
            notes: exercise.notes ?? null,
            imageUrl: resolvePdfImageSource(exercise.image_url ?? null),
            position: exercise.position ?? 0,
          })),
      })),
  }
}

export async function getShareableTemplateRecipients(user: User, clientIds: string[]) {
  const uniqueIds = Array.from(new Set(clientIds.filter(Boolean)))
  if (uniqueIds.length === 0) return []

  const db = serviceClient()
  const { data, error } = await db
    .from('coach_clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .in('id', uniqueIds)

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((client) => ({
    id: client.id as string,
    firstName: client.first_name ?? '',
    lastName: client.last_name ?? '',
    email: client.email ?? null,
  })) as PdfClientInfo[]
}

export { buildProgramPdfFilename }
