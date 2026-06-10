"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ProgressionEvent {
  id: string;
  exercise_id: string;
  session_log_id: string;
  sets_completed: number;
  reps_per_set: number[];
  weight_kg: number;
  rir_values: number[];
  trigger_type: "overload" | "maintain";
  previous_weight_kg: number | null;
  new_weight_kg: number | null;
  increment_applied: number | null;
  created_at: string;
  // joint depuis program_exercises
  exercise_name?: string;
}

interface GroupedByExercise {
  exercise_id: string;
  exercise_name: string;
  events: ProgressionEvent[];
  latest_weight: number | null;
  total_overloads: number;
}

interface Props {
  clientId: string;
}

export default function ProgressionHistory({ clientId }: Props) {
  const [groups, setGroups] = useState<GroupedByExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/progression/history?client_id=${clientId}`)
      .then((r) => r.json())
      .then((d) => {
        setGroups(d.groups ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <div className="bg-[#181818] rounded-xl p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl"
          >
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-[#181818] border-subtle rounded-xl p-8 text-center">
        <TrendingUp
          size={32}
          className="text-white/45 mx-auto mb-3 opacity-20"
        />
        <p className="text-sm text-white/45 font-medium">
          Aucune donnée de progression.
        </p>
        <p className="text-xs text-white/45/60 mt-1">
          Active la double progression sur un programme et attends la première
          séance complétée.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={14} className="text-accent" />
        <h3 className="text-sm font-bold text-white">
          Historique de progression
        </h3>
        <span className="text-[10px] text-white/45 bg-white/[0.04] px-2 py-0.5 rounded-full">
          {groups.length} exercice{groups.length > 1 ? "s" : ""}
        </span>
      </div>

      {groups.map((g) => {
        const isOpen = expanded === g.exercise_id;
        const overloadCount = g.total_overloads;

        return (
          <div
            key={g.exercise_id}
            className="bg-[#181818] border-subtle rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isOpen ? null : g.exercise_id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                    overloadCount > 0 ? "bg-accent/10" : "bg-white/[0.04]"
                  }`}
                >
                  {overloadCount > 0 ? (
                    <TrendingUp size={13} className="text-accent" />
                  ) : (
                    <Minus size={13} className="text-white/45" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">
                    {g.exercise_name}
                  </p>
                  <p className="text-[10px] text-white/45 mt-0.5">
                    {overloadCount > 0
                      ? `${overloadCount} surcharge${overloadCount > 1 ? "s" : ""} déclenchée${overloadCount > 1 ? "s" : ""}`
                      : "En progression"}
                    {g.latest_weight !== null
                      ? ` · Charge actuelle : ${g.latest_weight}kg`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {g.latest_weight !== null && (
                  <span className="text-xs font-mono font-bold text-white">
                    {g.latest_weight}kg
                  </span>
                )}
                {isOpen ? (
                  <ChevronUp size={14} className="text-white/45" />
                ) : (
                  <ChevronDown size={14} className="text-white/45" />
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-white/40">
                {/* Column headers */}
                <div className="grid grid-cols-5 gap-2 px-4 py-2 text-[9px] font-bold text-white/45 uppercase tracking-wider">
                  <div className="col-span-2">Date</div>
                  <div>Charge</div>
                  <div>Reps</div>
                  <div>Résultat</div>
                </div>

                {g.events.map((ev) => {
                  const date = new Date(ev.created_at).toLocaleDateString(
                    "fr-FR",
                    { day: "2-digit", month: "short" },
                  );
                  const repsDisplay =
                    ev.reps_per_set.length > 0
                      ? ev.reps_per_set.join("-")
                      : "—";
                  const isOverload = ev.trigger_type === "overload";

                  return (
                    <div
                      key={ev.id}
                      className={`grid grid-cols-5 gap-2 items-center px-4 py-2.5 border-t border-white/20 text-xs ${
                        isOverload ? "bg-accent/5" : ""
                      }`}
                    >
                      <div className="col-span-2 text-white/45 font-mono">
                        {date}
                      </div>
                      <div className="font-mono font-bold text-white">
                        {ev.weight_kg}kg
                      </div>
                      <div className="font-mono text-white/45">
                        {repsDisplay}
                      </div>
                      <div className="flex items-center gap-1">
                        {isOverload ? (
                          <>
                            <TrendingUp
                              size={11}
                              className="text-accent shrink-0"
                            />
                            <span className="text-accent font-bold text-[10px]">
                              +{ev.increment_applied}kg
                            </span>
                          </>
                        ) : (
                          <>
                            <Minus
                              size={11}
                              className="text-white/45 shrink-0"
                            />
                            <span className="text-white/45 text-[10px]">
                              Maintien
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
