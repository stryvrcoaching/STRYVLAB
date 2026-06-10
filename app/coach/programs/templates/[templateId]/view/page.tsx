import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Dumbbell,
  Calendar,
  Zap,
  Target,
  Lock,
  Copy,
  Edit2,
  Tag,
  BarChart2,
} from "lucide-react";
import ProgramTemplateViewTopBar from "@/components/programs/ProgramTemplateViewTopBar";

const GOALS: Record<string, string> = {
  hypertrophy: "Hypertrophie",
  strength: "Force",
  endurance: "Endurance",
  fat_loss: "Perte de gras",
  recomp: "Recomposition",
  maintenance: "Maintenance",
  athletic: "Athletic",
};
const LEVELS: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
  elite: "Élite",
};
const ARCHETYPES: Record<string, string> = {
  bodyweight: "Poids du corps",
  home_dumbbells: "Domicile — Haltères",
  home_full: "Domicile — Complet",
  home_rack: "Rack à domicile",
  functional_box: "Box / Fonctionnel",
  commercial_gym: "Salle de sport",
};
const MOVEMENT_LABELS: Record<string, string> = {
  horizontal_push: "Poussée horiz.",
  vertical_push: "Poussée vert.",
  horizontal_pull: "Tirage horiz.",
  vertical_pull: "Tirage vert.",
  squat_pattern: "Squat",
  hip_hinge: "Charnière hanche",
  knee_flexion: "Flexion genou",
  knee_extension: "Extension genou",
  calf_raise: "Mollets",
  elbow_flexion: "Biceps",
  elbow_extension: "Triceps",
  lateral_raise: "Élévation lat.",
  carry: "Porté",
  core_anti_flex: "Gainage",
  core_flex: "Core flex",
  core_rotation: "Rotation core",
  scapular_elevation: "Élév. scapulaire",
  hip_abduction: "Abduction hanche",
  hip_adduction: "Adduction hanche",
  shoulder_rotation: "Rotation épaule",
  scapular_retraction: "Rétraction scap.",
  scapular_protraction: "Protraction scap.",
};
const EQUIPMENT_LABELS: Record<string, string> = {
  bodyweight: "Poids du corps",
  band: "Élastique",
  dumbbell: "Haltère",
  barbell: "Barre",
  kettlebell: "Kettlebell",
  machine: "Machine",
  cable: "Poulie",
  smith: "Smith",
  trx: "TRX",
  ez_bar: "Barre EZ",
  trap_bar: "Trap bar",
  landmine: "Landmine",
  medicine_ball: "Med ball",
  swiss_ball: "Swiss ball",
  rings: "Anneaux",
  sled: "Sled",
};
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default async function ViewProgramTemplatePage({
  params,
}: {
  params: { templateId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: template } = await db
    .from("coach_program_templates")
    .select(
      `
      id, name, description, goal, level, frequency, weeks, muscle_tags, notes, is_system, coach_id,
      equipment_archetype, created_at,
      coach_program_template_sessions (
        id, name, day_of_week, position, notes,
        coach_program_template_exercises (
          id, name, sets, reps, rest_sec, rir, notes, position, image_url, movement_pattern, equipment_required,
          rep_min, rep_max, target_rir, weight_increment_kg
        )
      )
    `,
    )
    .eq("id", params.templateId)
    .or(`coach_id.eq.${user.id},is_system.eq.true`)
    .single();

  if (!template) notFound();

  const isSystem = (template as any).is_system === true;
  const isOwner = (template as any).coach_id === user.id;

  const sessions = ((template as any).coach_program_template_sessions ?? [])
    .sort((a: any, b: any) => a.position - b.position)
    .map((s: any) => ({
      ...s,
      coach_program_template_exercises: (
        s.coach_program_template_exercises ?? []
      ).sort((a: any, b: any) => a.position - b.position),
    }));

  // Volume totals
  const totalSets = sessions.reduce(
    (acc: number, s: any) =>
      acc +
      s.coach_program_template_exercises.reduce(
        (a: number, e: any) => a + (e.sets ?? 0),
        0,
      ),
    0,
  );
  const totalExercises = sessions.reduce(
    (acc: number, s: any) => acc + s.coach_program_template_exercises.length,
    0,
  );

  // Volume par groupe musculaire (basé sur muscle_tags du template)
  const muscleTags: string[] = (template as any).muscle_tags ?? [];

  return (
    <div className="min-h-screen bg-[#121212] font-sans">
      <ProgramTemplateViewTopBar templateName={(template as any).name} />
      <main className="max-w-3xl mx-auto px-8 py-6 flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          {isSystem && (
            <Link
              href={`/coach/programs/templates/${params.templateId}/assign`}
              className="flex items-center gap-1.5 bg-[#1f8a65] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#217356] transition-colors"
            >
              Assigner à un client
            </Link>
          )}
          {isOwner && (
            <Link
              href={`/coach/programs/templates/${params.templateId}/edit`}
              className="flex items-center gap-1.5 bg-[#0a0a0a] text-white/70 text-xs font-bold px-4 py-2 rounded-xl hover:text-white transition-colors"
            >
              <Edit2 size={13} />
              Modifier
            </Link>
          )}
        </div>

        {/* Meta card */}
        <div className="bg-[#181818] border-subtle rounded-2xl p-6 flex flex-col gap-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {(template as any).goal && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/[0.04] text-white/70">
                {GOALS[(template as any).goal] ?? (template as any).goal}
              </span>
            )}
            {(template as any).level && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/[0.04] text-white/70">
                {LEVELS[(template as any).level] ?? (template as any).level}
              </span>
            )}
            {(template as any).equipment_archetype && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/[0.04] text-white/70">
                {ARCHETYPES[(template as any).equipment_archetype] ??
                  (template as any).equipment_archetype}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-white/70">
            <span className="flex items-center gap-1.5 text-[#1f8a65]">
              <Calendar size={14} />
              {(template as any).frequency} jours/semaine
            </span>
            <span className="flex items-center gap-1.5 text-[#1f8a65]">
              <Zap size={14} />
              {(template as any).weeks} semaines
            </span>
            <span className="flex items-center gap-1.5 text-[#1f8a65]">
              <Dumbbell size={14} />
              {sessions.length} séances
            </span>
            <span className="flex items-center gap-1.5 text-[#1f8a65]">
              <BarChart2 size={14} />
              {totalSets} séries tot. · {totalExercises} exercices
            </span>
          </div>

          {/* Description */}
          {(template as any).description && (
            <p className="text-sm text-white/70 leading-relaxed">
              {(template as any).description}
            </p>
          )}

          {/* Muscle tags */}
          {muscleTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider mr-1">
                Muscles :
              </span>
              {muscleTags.map((tag: string) => (
                <span
                  key={tag}
                  className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#0a0a0a] text-white/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Notes coach */}
          {(template as any).notes && (
            <div className="border-t border-white/40 pt-3">
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">
                Notes du programme
              </p>
              <p className="text-sm text-white/70 italic leading-relaxed">
                {(template as any).notes}
              </p>
            </div>
          )}
        </div>

        {/* Sessions */}
        {sessions.map((s: any, si: number) => {
          const sessionSets = s.coach_program_template_exercises.reduce(
            (a: number, e: any) => a + (e.sets ?? 0),
            0,
          );
          return (
            <div
              key={s.id}
              className="bg-[#181818] border-subtle rounded-2xl overflow-hidden"
            >
              {/* Session header */}
              <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#1f8a65] uppercase tracking-widest">
                      Séance {si + 1}
                    </span>
                    {s.day_of_week != null && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1f8a65]/10 text-[#1f8a65]">
                        {DAYS[s.day_of_week]}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-white mt-0.5">{s.name}</h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/70">
                    {s.coach_program_template_exercises.length} ex. ·{" "}
                    {sessionSets} séries
                  </p>
                </div>
              </div>

              {s.notes && (
                <div className="px-5 py-2 bg-[#0a0a0a] border-b border-white/10">
                  <p className="text-xs text-white/70 italic">{s.notes}</p>
                </div>
              )}

              {/* Exercises */}
              <div className="divide-y divide-white/30">
                {s.coach_program_template_exercises.map(
                  (e: any, ei: number) => (
                    <div
                      key={e.id ?? ei}
                      className="px-5 py-4 flex gap-4 items-start"
                    >
                      {/* GIF */}
                      {e.image_url ? (
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#0a0a0a] flex-shrink-0">
                          <Image
                            src={e.image_url}
                            alt={e.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                            unoptimized={e.image_url?.endsWith(".gif")}
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-[#0a0a0a] flex-shrink-0 flex items-center justify-center">
                          <Dumbbell size={20} className="text-white/30" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm">
                          {e.name}
                        </p>

                        {/* Prescription */}
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-white/70 font-mono">
                          <span>
                            {e.sets} × {e.reps}
                          </span>
                          {e.rest_sec && <span>{e.rest_sec}s repos</span>}
                          {e.rir != null && <span>RIR {e.rir}</span>}
                          {e.rep_min != null && e.rep_max != null && (
                            <span className="text-[#1f8a65] font-sans">
                              ↑ {e.rep_min}–{e.rep_max} reps · +
                              {e.weight_increment_kg ?? 2.5}kg
                            </span>
                          )}
                        </div>

                        {/* Pattern + équipement */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {e.movement_pattern && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.04] text-white/70">
                              {MOVEMENT_LABELS[e.movement_pattern] ??
                                e.movement_pattern}
                            </span>
                          )}
                          {(e.equipment_required ?? []).map((eq: string) => (
                            <span
                              key={eq}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.04] text-white/70"
                            >
                              {EQUIPMENT_LABELS[eq] ?? eq}
                            </span>
                          ))}
                        </div>

                        {/* Notes exercice */}
                        {e.notes && (
                          <p className="text-xs text-white/60 italic mt-1.5">
                            {e.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
