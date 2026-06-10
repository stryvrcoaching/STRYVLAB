import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Clock, RotateCcw, Eye } from "lucide-react";
import ProgressionToggle from "@/components/programs/ProgressionToggle";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type Params = { params: { clientId: string; programId: string } };

export default async function ProgramPreviewPage({ params }: Params) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: program } = await db
    .from("programs")
    .select(
      `
      id, name, description, weeks, status, progressive_overload_enabled,
      program_sessions (
        id, name, day_of_week, position, notes,
        program_exercises (
          id, name, sets, reps, rest_sec, rir, notes, position, image_url
        )
      )
    `,
    )
    .eq("id", params.programId)
    .eq("coach_id", user.id)
    .single();

  if (!program) notFound();

  const sessions = ((program.program_sessions ?? []) as any[]).sort(
    (a, b) => a.position - b.position,
  );

  const jsDay = new Date().getDay();
  const todayDow = jsDay === 0 ? 7 : jsDay;

  return (
    <div className="min-h-screen bg-[#121212] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#121212]/80 backdrop-blur-xl border-b border-white/[0.07] px-6 py-4">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/coach/clients/${params.clientId}`}
            className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary mb-3 font-medium transition-colors"
          >
            <ChevronLeft size={16} />
            Retour au dossier client
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-primary">{program.name}</h1>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                  <Eye size={10} />
                  Vue client
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                {program.weeks} semaine
                {(program.weeks as number) > 1 ? "s" : ""} · {sessions.length}{" "}
                séance{sessions.length !== 1 ? "s" : ""}
                {program.description && ` · ${program.description}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Double Progression toggle */}
      <div className="max-w-lg mx-auto px-6 pt-4">
        <ProgressionToggle
          programId={program.id}
          initialEnabled={
            (program as any).progressive_overload_enabled ?? false
          }
        />
      </div>

      {/* Day strip */}
      <div className="max-w-lg mx-auto px-6 pt-4">
        <div className="flex gap-1.5">
          {DAYS.map((d, i) => {
            const dow = i + 1;
            const hasSession = sessions.some((s: any) => s.day_of_week === dow);
            const isToday = dow === todayDow;
            return (
              <div
                key={d}
                className={`flex-1 flex flex-col items-center py-2 rounded-btn text-[10px] font-bold transition-colors ${
                  isToday
                    ? "bg-accent text-white"
                    : hasSession
                      ? "bg-surface-light text-primary shadow-soft-in"
                      : "text-secondary/40"
                }`}
              >
                <span>{d}</span>
                {hasSession && (
                  <span
                    className={`w-1 h-1 rounded-full mt-1 ${isToday ? "bg-white" : "bg-accent"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-6 py-5 flex flex-col gap-4">
        {sessions.map((session: any) => {
          const exercises = ((session.program_exercises ?? []) as any[]).sort(
            (a, b) => a.position - b.position,
          );
          const isToday = session.day_of_week === todayDow;

          return (
            <div
              key={session.id}
              className={`bg-surface rounded-card shadow-soft-out overflow-hidden ${isToday ? "ring-2 ring-accent/30" : ""}`}
            >
              {/* Session header */}
              <div
                className={`px-4 py-3 flex items-center justify-between ${isToday ? "bg-accent/5" : ""}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-primary text-sm">
                      {session.name}
                    </p>
                    {isToday && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent text-white">
                        Aujourd'hui
                      </span>
                    )}
                  </div>
                  {session.day_of_week && (
                    <p className="text-[10px] text-secondary mt-0.5">
                      {DAYS[session.day_of_week - 1]}
                    </p>
                  )}
                </div>
                <span className="flex items-center gap-1 text-[10px] text-secondary font-medium">
                  {exercises.length} exercice{exercises.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Exercises */}
              <div className="divide-y divide-white/30">
                {exercises.map((ex: any, i: number) => (
                  <div key={ex.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-surface-light text-secondary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary">
                        {ex.name}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-[10px] font-mono font-bold text-accent">
                          {ex.sets} × {ex.reps}
                        </span>
                        {ex.rest_sec && (
                          <span className="flex items-center gap-0.5 text-[10px] text-secondary">
                            <Clock size={9} />
                            {ex.rest_sec}s
                          </span>
                        )}
                        {ex.rir !== null && ex.rir !== undefined && (
                          <span className="flex items-center gap-0.5 text-[10px] text-secondary">
                            <RotateCcw size={9} />
                            RIR {ex.rir}
                          </span>
                        )}
                      </div>
                      {ex.notes && (
                        <p className="text-[10px] text-secondary/70 mt-1 italic">
                          {ex.notes}
                        </p>
                      )}
                      {ex.image_url && (
                        <div className="mt-2">
                          <Image
                            src={ex.image_url}
                            alt={ex.name}
                            width={0}
                            height={0}
                            sizes="(max-width: 640px) 100vw, 512px"
                            className="w-full h-auto rounded-btn"
                            unoptimized={ex.image_url.endsWith(".gif")}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {session.notes && (
                <div className="px-4 py-2 border-t border-white/30 bg-surface-light/40">
                  <p className="text-[10px] text-secondary italic">
                    {session.notes}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="bg-surface rounded-card shadow-soft-out p-10 text-center">
            <p className="text-sm text-secondary">
              Ce programme n'a pas encore de séances.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
