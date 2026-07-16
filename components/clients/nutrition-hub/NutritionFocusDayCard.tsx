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
  return value == null ? `— ${unit}` : `${value} ${unit}`;
}

function metricGap(consumed: number, target: number | null, unit: string) {
  if (target == null) return "Sans cible";
  const delta = consumed - target;
  if (delta === 0) return `À la cible (${target} ${unit})`;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta} ${unit} vs cible`;
}

function completionRate(consumed: number, target: number | null) {
  if (target == null || target <= 0) return null;
  return Math.round((consumed / target) * 100);
}

function hydrationHint(consumed: number, target: number | null) {
  const rate = completionRate(consumed, target);
  if (rate == null) return "Cible hydrique non disponible";
  return `${rate}% de la cible`;
}

function FocusMetricCard({
  label,
  value,
  hint,
  color,
  tone,
  span,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
  tone: string;
  span?: string;
}) {
  return (
    <article
      className={`min-w-0 rounded-[22px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 ${span ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p>
        <span
          className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
          style={{ color, backgroundColor: tone }}
        >
          live
        </span>
      </div>
      <p className="mt-3 text-[16px] font-semibold sm:text-[18px]" style={{ color }}>
        {value}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-white/54">{hint}</p>
    </article>
  );
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
    <section className="rounded-[28px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
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

      <div className="mt-5 grid grid-cols-2 gap-3">
        <FocusMetricCard
          label="Calories"
          value={`${row.consumed.calories} kcal`}
          hint={metricGap(row.consumed.calories, row.target.calories, "kcal")}
          color={NUTRITION_UI_COLORS.calories}
          tone="rgba(104,159,250,0.12)"
        />
        <FocusMetricCard
          label="Protéines"
          value={`${row.consumed.protein_g} g`}
          hint={`Cible ${renderTarget(row.target.protein_g, "g")}`}
          color={NUTRITION_UI_COLORS.protein}
          tone="rgba(93,186,135,0.12)"
        />
        <FocusMetricCard
          label="Hydratation"
          value={`${row.consumed.hydration_ml} ml`}
          hint={hydrationHint(row.consumed.hydration_ml, row.target.hydration_ml)}
          color={NUTRITION_UI_COLORS.water}
          tone="rgba(35,115,200,0.12)"
          span="col-span-2"
        />
        <FocusMetricCard
          label="Glucides"
          value={`${row.consumed.carbs_g} g`}
          hint={`Cible ${renderTarget(row.target.carbs_g, "g")}`}
          color={NUTRITION_UI_COLORS.carbs}
          tone="rgba(255,209,94,0.12)"
        />
        <FocusMetricCard
          label="Lipides"
          value={`${row.consumed.fat_g} g`}
          hint={`Cible ${renderTarget(row.target.fat_g, "g")}`}
          color={NUTRITION_UI_COLORS.fat}
          tone="rgba(255,134,96,0.12)"
        />
      </div>
    </section>
  );
}
