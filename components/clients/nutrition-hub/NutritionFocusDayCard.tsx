"use client";

import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors";

type NutritionAgendaRow = {
  date: string;
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
};

const STATUS_LABELS: Record<string, string> = {
  on_target: "Conforme",
  under: "Sous cible",
  over: "Dépassement",
  partial: "Partiel",
  missing: "Aucune donnée",
  no_target: "Sans cible",
};

const DAY_KIND_LABELS: Record<NutritionAgendaRow["dayKind"], string> = {
  training: "Jour d’entraînement",
  off: "Jour de repos",
  unknown: "Contexte inconnu",
};

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function renderTarget(value: number | null, unit: string) {
  return value == null ? `N/A ${unit}` : `${value} ${unit}`;
}

function metricGap(consumed: number, target: number | null, unit: string) {
  if (target == null) return "Sans cible";
  const delta = consumed - target;
  if (delta === 0) return `À la cible (${target} ${unit})`;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta} ${unit} vs cible`;
}

export default function NutritionFocusDayCard({
  row,
  rationale,
}: {
  row: NutritionAgendaRow | null;
  rationale: string;
}) {
  if (!row) {
    return null;
  }

  return (
    <section className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
            Journée à auditer
          </p>
          <h2 className="mt-2 text-[18px] font-semibold text-white">
            {formatShortDate(row.date)}
          </h2>
          <p className="mt-1 text-[12px] text-white/48">
            {DAY_KIND_LABELS[row.dayKind]} · {STATUS_LABELS[row.status] ?? row.status}
          </p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/42">
          {row.mealCount} repas
        </span>
      </div>

      <div className="mt-4 rounded-[20px] border border-white/[0.06] bg-white/[0.04] p-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
          Pourquoi cette journée
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/72">{rationale}</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <article className="rounded-[20px] border border-white/[0.06] bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Calories</p>
          <p
            className="mt-2 text-xl font-semibold"
            style={{ color: NUTRITION_UI_COLORS.calories }}
          >
            {row.consumed.calories} kcal
          </p>
          <p className="mt-2 text-[12px] text-white/48">
            {metricGap(row.consumed.calories, row.target.calories, "kcal")}
          </p>
        </article>

        <article className="rounded-[20px] border border-white/[0.06] bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Protéines</p>
          <p
            className="mt-2 text-xl font-semibold"
            style={{ color: NUTRITION_UI_COLORS.protein }}
          >
            {row.consumed.protein_g} g
          </p>
          <p className="mt-2 text-[12px] text-white/48">
            Cible {renderTarget(row.target.protein_g, "g")}
          </p>
        </article>

        <article className="rounded-[20px] border border-white/[0.06] bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Hydratation</p>
          <p
            className="mt-2 text-xl font-semibold"
            style={{ color: NUTRITION_UI_COLORS.water }}
          >
            {row.consumed.hydration_ml} ml
          </p>
          <p className="mt-2 text-[12px] text-white/48">
            Cible {renderTarget(row.target.hydration_ml, "ml")}
          </p>
        </article>

        <article className="rounded-[20px] border border-white/[0.06] bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Glucides</p>
          <p
            className="mt-2 text-xl font-semibold"
            style={{ color: NUTRITION_UI_COLORS.carbs }}
          >
            {row.consumed.carbs_g} g
          </p>
          <p className="mt-2 text-[12px] text-white/48">
            Cible {renderTarget(row.target.carbs_g, "g")}
          </p>
        </article>

        <article className="rounded-[20px] border border-white/[0.06] bg-white/[0.04] p-4 sm:col-span-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Lipides</p>
          <p
            className="mt-2 text-xl font-semibold"
            style={{ color: NUTRITION_UI_COLORS.fat }}
          >
            {row.consumed.fat_g} g
          </p>
          <p className="mt-2 text-[12px] text-white/48">
            Cible {renderTarget(row.target.fat_g, "g")}
          </p>
        </article>
      </div>
    </section>
  );
}
