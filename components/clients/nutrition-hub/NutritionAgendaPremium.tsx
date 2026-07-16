"use client";

import { useEffect, useRef } from "react";
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors";

type NutritionAgendaRow = {
  date: string;
  isToday?: boolean;
  dayKind: "training" | "off" | "unknown";
  status: string;
  mealCount: number;
  consumed: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    hydration_ml: number;
  };
  target: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    hydration_ml: number | null;
  };
  smoothing?: null | {
    planId: string;
    sourceDate: string;
    direction: "surplus" | "deficit";
    kcalDelta: number;
    remainingKcal: number;
    dayStatus: string;
    coachNote: string | null;
    coachLastAction: string | null;
  };
};

const STATUS_LABELS: Record<string, string> = {
  on_target: "Conforme",
  under: "Sous cible",
  over: "Dépassement",
  partial: "Partiel",
  missing: "Aucune donnée",
  no_target: "Sans cible",
};

const STATUS_STYLES: Record<string, string> = {
  on_target: "text-[#8ef0c7] border-[#1f8a65]/30 bg-[#1f8a65]/10",
  under: "text-[#ffd15e] border-[#ffd15e]/30 bg-[#ffd15e]/10",
  over: "text-[#ff9c7e] border-[#ff8660]/30 bg-[#ff8660]/10",
  partial: "text-white/65 border-white/[0.08] bg-white/[0.05]",
  missing: "text-white/55 border-white/[0.08] bg-white/[0.05]",
  no_target: "text-white/55 border-white/[0.08] bg-white/[0.05]",
};

const BAR_COLORS = {
  calories: NUTRITION_UI_COLORS.calories,
  protein: NUTRITION_UI_COLORS.protein,
  carbs: NUTRITION_UI_COLORS.carbs,
  fat: NUTRITION_UI_COLORS.fat,
  hydration: NUTRITION_UI_COLORS.water,
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function toRatio(consumed: number, target: number | null) {
  if (target == null || target <= 0) return 0;
  return Math.max(0, Math.min(consumed / target, 1));
}

function formatRemaining(row: NutritionAgendaRow["smoothing"]) {
  if (!row) return null;
  const abs = Math.abs(row.remainingKcal);
  return row.direction === "surplus"
    ? `reste ${abs} kcal à retirer`
    : `reste ${abs} kcal à réinjecter`;
}

function RatioBar({
  label,
  consumed,
  target,
  unit,
  color,
}: {
  label: string;
  consumed: number;
  target: number | null;
  unit: string;
  color: string;
}) {
  const ratio = toRatio(consumed, target);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/32">{label}</p>
        <p className="truncate text-[11px] font-medium text-white/76">
          {consumed} / {target ?? "—"} {unit}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(ratio * 100, target == null ? 20 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export default function NutritionAgendaPremium({
  rows,
  focusDate,
}: {
  rows: NutritionAgendaRow[];
  focusDate?: string | null;
}) {
  const focusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focusDate || !focusRef.current) return;
    focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusDate]);

  return (
    <section className="rounded-[28px] border border-white/[0.07] bg-[#181818] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
            Agenda nutritionnel
          </p>
          <h2 className="mt-2 text-[18px] font-semibold text-white">
            Journées observées
          </h2>
        </div>
        <p className="max-w-md text-[13px] leading-relaxed text-white/52">
          Chaque ligne résume les nutriments clés de la journée pour une lecture rapide
          et directement exploitable par le coach.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {[...rows].reverse().map((row) => (
          <div
            key={row.date}
            ref={row.date === focusDate ? focusRef : null}
            className={`rounded-[22px] border px-4 py-4 ${
              row.date === focusDate
                ? "border-[#ffd15e]/42 bg-[#ffd15e]/[0.08]"
                : row.isToday
                  ? "border-[#1f8a65]/50 bg-[#1f8a65]/[0.04]"
                  : "border-white/[0.06] bg-white/[0.03]"
            }`}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                  <div className="min-w-[96px]">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{formatDate(row.date)}</p>
                      {row.date === focusDate ? (
                        <span className="rounded-full border border-[#ffd15e]/35 bg-[#ffd15e]/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#ffe7a3]">
                          Détection
                        </span>
                      ) : null}
                      {row.isToday && (
                        <span className="rounded-full border border-[#1f8a65]/40 bg-[#1f8a65]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8ef0c7]">
                          Aujourd&apos;hui
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-white/42">{row.mealCount} repas</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${STATUS_STYLES[row.status] ?? STATUS_STYLES.no_target}`}
                    >
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                    {row.smoothing && (
                      <>
                        <span className="rounded-full border border-[#7fe0b8]/18 bg-[#1f8a65]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8ef0c7]">
                          {row.smoothing.kcalDelta > 0 ? "+" : ""}
                          {row.smoothing.kcalDelta} kcal
                        </span>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold text-white/58">
                          {formatRemaining(row.smoothing)}
                        </span>
                        {row.smoothing.coachLastAction && (
                          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold text-white/58">
                            Coach {row.smoothing.coachLastAction}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:min-w-[760px]">
                  <RatioBar
                    label="Calories"
                    consumed={row.consumed.calories}
                    target={row.target.calories}
                    unit="kcal"
                    color={BAR_COLORS.calories}
                  />
                  <RatioBar
                    label="Protéines"
                    consumed={row.consumed.protein_g}
                    target={row.target.protein_g}
                    unit="g"
                    color={BAR_COLORS.protein}
                  />
                  <RatioBar
                    label="Glucides"
                    consumed={row.consumed.carbs_g}
                    target={row.target.carbs_g}
                    unit="g"
                    color={BAR_COLORS.carbs}
                  />
                  <RatioBar
                    label="Lipides"
                    consumed={row.consumed.fat_g}
                    target={row.target.fat_g}
                    unit="g"
                    color={BAR_COLORS.fat}
                  />
                  <RatioBar
                    label="Hydratation"
                    consumed={row.consumed.hydration_ml}
                    target={row.target.hydration_ml}
                    unit="ml"
                    color={BAR_COLORS.hydration}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
