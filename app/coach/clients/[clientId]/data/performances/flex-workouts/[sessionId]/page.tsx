"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  Layers,
  Dumbbell,
  Gauge,
} from "lucide-react";
import { useClientTopBar } from "@/components/clients/useClientTopBar";
import { useClient } from "@/lib/client-context";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderIconButton from "@/components/layout/HeaderIconButton";

type FlexWorkoutDetail = {
  session: {
    id: string;
    started_at: string;
    ended_at: string | null;
    type: string;
    relation_to_planned_workout: string | null;
    notes: string | null;
  };
  exercises: Array<{
    id: string;
    display_name?: string;
    custom_exercise_name?: string | null;
    exercise_id?: string | null;
    notes?: string | null;
    muscle_groups?: string[] | null;
    sets: Array<{
      id: string;
      set_number: number;
      weight: number | string | null;
      reps: number | null;
      rir: number | null;
      rpe: number | null;
      rest_seconds: number | null;
      notes: string | null;
      completed: boolean;
    }>;
  }>;
  summary: {
    total_sets: number;
    hard_sets: number;
    tonnage: number;
    duration_seconds: number | null;
    muscle_group_volume: Record<string, number>;
  };
};

function formatDuration(seconds: number | null) {
  if (seconds == null) return "0 min";
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r > 0 ? `${h} h ${r} min` : `${h} h`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function resolveTitle(type: string, relation: string | null) {
  if (relation === "replace" || type === "replacement") return "Séance libre à la place d'une séance prévue";
  if (relation === "bonus" || type === "bonus") return "Séance bonus hors programme";
  return "Séance libre réalisée";
}

export default function CoachFlexWorkoutDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { clientId } = useClient();
  const sessionId = params.sessionId as string;

  const [data, setData] = useState<FlexWorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topBarRight = useMemo(
    () => (
      <HeaderIconButton
        onClick={() => router.push(`/coach/clients/${clientId}/data/performances`)}
        icon={<ChevronLeft size={14} />}
        label="Retour aux performances"
      />
    ),
    [clientId, router],
  );

  useClientTopBar("Détail séance libre", topBarRight);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/coach/clients/${clientId}/flex-workouts/${sessionId}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "Impossible de charger la séance libre");
        return body as FlexWorkoutDetail;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur de chargement");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, sessionId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] px-6 pb-24">
        <div className="space-y-4 pt-5">
          <Skeleton className="h-20 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#121212] px-6 pb-24 pt-10">
        <p className="text-[14px] text-white/50">{error ?? "Séance introuvable"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#121212] px-6 pb-24">
      <div className="space-y-4 pt-5">
        <div className="rounded-2xl border border-white/[0.06] bg-[#181818] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
              <CheckCircle2 size={18} className="text-white/80" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Flex Workout
              </p>
              <p className="mt-1 text-[14px] font-semibold text-white">
                {resolveTitle(data.session.type, data.session.relation_to_planned_workout)}
              </p>
              <p className="mt-1 text-[11px] text-white/40">
                {formatDate(data.session.ended_at ?? data.session.started_at)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DetailStat label="Durée" value={formatDuration(data.summary.duration_seconds)} icon={<Clock size={12} />} />
          <DetailStat label="Exercices" value={String(data.exercises.length)} icon={<Dumbbell size={12} />} />
          <DetailStat label="Séries" value={String(data.summary.total_sets)} icon={<Layers size={12} />} />
          <DetailStat label="Hard sets" value={String(data.summary.hard_sets)} icon={<Gauge size={12} />} />
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#181818] px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            Volume
          </p>
          <p className="mt-2 text-[24px] font-black text-white font-mono">
            {new Intl.NumberFormat("fr-FR").format(data.summary.tonnage)} kg
          </p>
          {Object.keys(data.summary.muscle_group_volume).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(data.summary.muscle_group_volume).map(([group, value]) => (
                <span
                  key={group}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-white/65"
                >
                  {group} · {value}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#181818] overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Exercices
            </p>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {data.exercises.map((exercise) => (
              <div key={exercise.id} className="px-5 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-white">
                      {exercise.display_name ?? exercise.custom_exercise_name ?? "Exercice"}
                    </p>
                    <p className="mt-1 text-[10px] text-white/35">
                      {exercise.sets.length} série{exercise.sets.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  {exercise.muscle_groups?.length ? (
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/55">
                      {exercise.muscle_groups[0]}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {exercise.sets.map((set) => (
                    <div
                      key={set.id}
                      className="rounded-xl bg-white/[0.03] px-3 py-2 text-[12px] text-white/70"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-white/35">#{set.set_number}</span>
                        <span className="font-mono text-white">
                          {set.reps ?? "—"} reps{set.weight != null ? ` × ${set.weight} kg` : ""}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-white/35">
                        {set.rir != null ? <span>RIR {set.rir}</span> : null}
                        {set.rpe != null ? <span>RPE {set.rpe}</span> : null}
                        {set.rest_seconds != null ? <span>Repos {set.rest_seconds}s</span> : null}
                      </div>
                      {set.notes ? <p className="mt-2 text-[11px] italic text-white/40">{set.notes}</p> : null}
                    </div>
                  ))}
                </div>

                {exercise.notes ? (
                  <p className="text-[11px] italic text-white/40">{exercise.notes}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#181818] px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            Note client
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-white/65">
            {data.session.notes?.trim() ? data.session.notes : "Aucune note client."}
          </p>
        </div>
      </div>
    </main>
  );
}

function DetailStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#181818] px-4 py-3">
      <div className="mb-1.5 flex items-center gap-1 text-white/30">
        {icon}
        <p className="text-[9px] font-bold uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className="font-mono text-[1.35rem] font-black leading-none text-white">{value}</p>
    </div>
  );
}
