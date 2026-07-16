import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { VALID_MOVEMENT_PATTERN_SET } from '@/lib/programs/movementPatterns'
import { resolveStoredFrequency } from '@/lib/programs/frequency'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/programs/[programId]/save-as-template
// Copie un programme client vers coach_program_templates (programme intact)
export async function POST(
  req: NextRequest,
  { params }: { params: { programId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { name, description } = body

  const db = service()

  // Fetch programme avec sessions + exercices + vérification ownership
  const { data: program } = await db
    .from('programs')
    .select(`
      id, name, description, goal, level, frequency, weeks, muscle_tags,
      equipment_archetype, session_mode, volume_focus, coach_id,
      program_sessions (
        id, name, day_of_week, days_of_week, position, notes,
        program_exercises (
          name, sets, reps, rest_sec, rir, notes, position, image_url,
          movement_pattern, equipment_required, primary_muscles, secondary_muscles,
          group_id, is_compound, is_unilateral, target_rir, set_prescriptions, superset_rest_mode, tempo, execution_type, target_hr_zone
        )
      )
    `)
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .single()

  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  const templateName = name?.trim() || program.name
  const computedFrequency = resolveStoredFrequency((program.program_sessions as any[]) ?? [], program.frequency ?? null)

  // Créer le template
  const { data: template, error: tErr } = await db
    .from('coach_program_templates')
    .insert({
      coach_id: user.id,
      name: templateName,
      description: description?.trim() || program.description || null,
      goal: program.goal,
      level: program.level,
      frequency: computedFrequency || program.frequency || null,
      weeks: program.weeks,
      muscle_tags: program.muscle_tags ?? [],
      equipment_archetype: program.equipment_archetype ?? null,
      session_mode: program.session_mode ?? 'day',
      volume_focus: program.volume_focus ?? {},
    })
    .select('id')
    .single()

  if (tErr || !template) return NextResponse.json({ error: tErr?.message ?? 'Erreur création template' }, { status: 500 })

  // Copier sessions + exercices
  const sessions = ((program.program_sessions as any[]) ?? []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  for (const s of sessions) {
    const sessionInsert: Record<string, any> = {
      template_id: template.id,
      name: s.name,
      day_of_week: (s.days_of_week ?? [])[0] ?? s.day_of_week ?? null,
      position: s.position ?? 0,
      notes: s.notes ?? null,
    }
    // days_of_week may not exist yet if migration not applied — only include if non-empty
    if (Array.isArray(s.days_of_week) && s.days_of_week.length > 0) {
      sessionInsert.days_of_week = s.days_of_week
    }

    const { data: session, error: sessionErr } = await db
      .from('coach_program_template_sessions')
      .insert(sessionInsert)
      .select('id')
      .single()

    if (sessionErr || !session) {
      console.error('[save-as-template] session insert error:', sessionErr?.message, 'session:', s.name)
      // Clean up the template we just created to avoid a half-baked record
      await db.from('coach_program_templates').delete().eq('id', template.id)
      return NextResponse.json(
        { error: `Erreur lors de la copie de la séance "${s.name}": ${sessionErr?.message ?? 'inconnu'}` },
        { status: 500 }
      )
    }

    const exercises: any[] = (s.program_exercises ?? []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    if (exercises.length > 0) {
      const { error: exErr } = await db.from('coach_program_template_exercises').insert(
        exercises.map((e, ei) => ({
          session_id: session.id,
          name: e.name,
          sets: e.sets ?? 3,
          reps: e.reps ?? '8-12',
          rest_sec: e.rest_sec ?? null,
          rir: e.rir ?? null,
          notes: e.notes ?? null,
          position: ei,
          image_url: e.image_url ?? null,
          movement_pattern: e.movement_pattern && VALID_MOVEMENT_PATTERN_SET.has(e.movement_pattern)
            ? e.movement_pattern
            : null,
          equipment_required: e.equipment_required ?? [],
          primary_muscles: e.primary_muscles ?? [],
          secondary_muscles: e.secondary_muscles ?? [],
          group_id: e.group_id ?? null,
          is_compound: e.is_compound ?? undefined,
          is_unilateral: e.is_unilateral ?? false,
          target_rir: e.target_rir ?? null,
          set_prescriptions: e.set_prescriptions ?? null,
          superset_rest_mode: e.superset_rest_mode ?? 'after_round',
          tempo: e.tempo ?? null,
          execution_type: e.execution_type ?? 'reps_rir',
          target_hr_zone: e.target_hr_zone ?? null,
        }))
      )
      if (exErr) {
        console.error('[save-as-template] exercises insert error:', exErr.message, 'session:', s.name)
        await db.from('coach_program_templates').delete().eq('id', template.id)
        return NextResponse.json(
          { error: `Erreur lors de la copie des exercices de "${s.name}": ${exErr.message}` },
          { status: 500 }
        )
      }
    }
  }

  return NextResponse.json({ template_id: template.id }, { status: 201 })
}
