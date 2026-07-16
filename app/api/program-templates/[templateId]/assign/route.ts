import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClientAppNotification } from "@/lib/notifications/create-client-app-notification";
import { parseRepsRange } from "@/lib/progression/double-progression";
import { VALID_MOVEMENT_PATTERN_SET } from "@/lib/programs/movementPatterns";
import { activateWorkoutProgramAssignment } from "@/lib/assignments/clientAssignments";
import { resolveStoredFrequency } from "@/lib/programs/frequency";

// Déduit le palier de charge depuis le type d'équipement si non configuré par le coach
// Câbles/poulies : 1kg (stacks magnétiques fins) — 5kg serait absurde sur extension triceps
// Machines à stack classiques : 2.5kg (plaque standard)
// Haltères : 2kg (paires standard)
// Barres : 2.5kg (microcharges)
function inferWeightIncrement(equipment: string[]): number {
  const eq = (equipment ?? []).map(e => e.toLowerCase())
  if (eq.some(e => e.includes('cable') || e.includes('poulie'))) return 1
  if (eq.some(e => e.includes('machine') || e.includes('pec') || e.includes('leg'))) return 2.5
  if (eq.some(e => e.includes('haltere') || e.includes('dumbbell') || e.includes('kettlebell'))) return 2
  if (eq.some(e => e.includes('barre') || e.includes('barbell') || e.includes('smith'))) return 2.5
  if (eq.some(e => e.includes('bodyweight') || e.includes('poids de corps') || e.includes('elastique'))) return 0
  return 2.5 // défaut universel
}

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// POST /api/program-templates/[templateId]/assign
// Crée un coach_program pour un client depuis un template
export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string } },
) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { client_id, name_override } = await req.json();
  if (!client_id)
    return NextResponse.json({ error: "client_id requis" }, { status: 400 });

  const db = service();

  // Vérifier ownership template
  const { data: template } = await db
    .from("coach_program_templates")
    .select(
      `
      id, name, weeks, goal, level, frequency, session_mode, volume_focus, equipment_archetype, muscle_tags,
      coach_program_template_sessions (
        id, name, day_of_week, days_of_week, position, notes,
        coach_program_template_exercises (
          name, sets, reps, rest_sec, rir, notes, position, image_url,
          primary_muscles, secondary_muscles, movement_pattern, equipment_required, group_id,
          weight_increment_kg, is_compound, is_unilateral, target_rir, tempo, set_prescriptions, superset_rest_mode, execution_type, target_hr_zone
        )
      )
    `,
    )
    .eq("id", params.templateId)
    .or(`coach_id.eq.${user.id},is_system.eq.true`)
    .single();

  if (!template)
    return NextResponse.json(
      { error: "Template introuvable" },
      { status: 404 },
    );

  // Vérifier ownership client
  const { data: client } = await db
    .from("coach_clients")
    .select("id, first_name, last_name")
    .eq("id", client_id)
    .eq("coach_id", user.id)
    .single();

  if (!client)
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const programName =
    name_override ||
    `${template.name} — ${client.first_name} ${client.last_name}`;

  const templateSessions = (template.coach_program_template_sessions as any[]) ?? [];
  const computedFrequency = resolveStoredFrequency(templateSessions, template.frequency ?? null);

  // Créer le programme
  const { data: program, error: programError } = await db
    .from("programs")
    .insert({
      coach_id: user.id,
      client_id,
      name: programName,
      weeks: template.weeks,
      goal: template.goal ?? null,
      level: template.level ?? null,
      frequency: computedFrequency || template.frequency || null,
      session_mode: template.session_mode ?? "day",
      volume_focus: template.volume_focus ?? {},
      equipment_archetype: template.equipment_archetype ?? null,
      muscle_tags: template.muscle_tags ?? [],
      description: `Basé sur le template "${template.name}"`,
    })
    .select("id")
    .single();

  if (programError || !program) {
    console.error("[assign] program insert error:", programError);
    return NextResponse.json(
      { error: programError?.message ?? "Erreur création programme" },
      { status: 500 },
    );
  }

  // Copier les sessions + exercices
  const sessions = (template.coach_program_template_sessions ?? []).sort(
    (a: any, b: any) => a.position - b.position,
  );

  for (const s of sessions) {
    const { data: session, error: sessionError } = await db
      .from("program_sessions")
      .insert({
        program_id: program.id,
        name: s.name,
        days_of_week: (s as any).days_of_week ?? [],
        day_of_week: ((s as any).days_of_week ?? [])[0] ?? s.day_of_week ?? null,
        position: s.position,
        notes: s.notes,
      })
      .select("id")
      .single();

    if (sessionError)
      console.error("[assign] session insert error:", sessionError);

    if (session && s.coach_program_template_exercises?.length) {
      const { error: exError } = await db.from("program_exercises").insert(
        (s.coach_program_template_exercises as any[])
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((e, ei) => {
            const parsed = parseRepsRange(e.reps ?? "");
            return {
              session_id: session.id,
              name: e.name,
              sets: e.sets,
              reps: e.reps,
              rest_sec: e.rest_sec,
              rir: e.rir,
              notes: e.notes,
              position: ei,
              image_url: e.image_url ?? null,
              primary_muscles: e.primary_muscles ?? [],
              secondary_muscles: e.secondary_muscles ?? [],
              movement_pattern: e.movement_pattern && VALID_MOVEMENT_PATTERN_SET.has(e.movement_pattern)
                ? e.movement_pattern
                : null,
              equipment_required: e.equipment_required ?? [],
              group_id: e.group_id ?? null,
              rep_min: parsed?.rep_min ?? null,
              rep_max: parsed?.rep_max ?? null,
              is_unilateral: e.is_unilateral ?? false,
              target_rir: e.target_rir ?? e.rir ?? null,
              weight_increment_kg: e.weight_increment_kg != null
                ? Number(e.weight_increment_kg)
                : inferWeightIncrement(e.equipment_required ?? []),
              is_compound: e.is_compound ?? undefined,
              tempo: e.tempo ?? null,
              set_prescriptions: e.set_prescriptions ?? null,
              superset_rest_mode: e.superset_rest_mode ?? 'after_round',
              execution_type: e.execution_type ?? 'reps_rir',
              target_hr_zone: e.target_hr_zone ?? null,
            };
          }),
      );
      if (exError) console.error("[assign] exercises insert error:", exError);
    }
  }

  // Notif client — programme assigné depuis template
  await createClientAppNotification(db, {
    coachId: user.id,
    clientId: client_id,
    type: "program_assigned",
    copyKey: "workout.available",
    actionUrl: "/client/programme",
    pushKind: "program",
  });

  // Metric annotation — programme assigné (source_id = program.id pour nettoyage à la suppression)
  const today = new Date().toISOString().split("T")[0];
  const { data: annotation } = await db.from("metric_annotations").insert({
    client_id: client_id,
    coach_id: user.id,
    event_type: "program_change",
    event_date: today,
    label: `Nouveau programme : ${programName}`,
    body: `Programme assigné depuis le template "${template.name}"`,
    source_id: program.id,
  }).select('id').single();

  await activateWorkoutProgramAssignment(db, {
    clientId: client_id,
    coachId: user.id,
    programId: program.id,
    startedBy: user.id,
    sourceAnnotationId: (annotation as any)?.id ?? null,
  });

  return NextResponse.json(
    { program_id: program.id, client_id },
    { status: 201 },
  );
}
