"use client";

import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors";

type RealityMiniDayProps = {
  day: {
    date: string;
    status: string;
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
};

const STATUS_LABELS: Record<string, string> = {
  on_target: "Conforme",
  under: "Sous cible",
  over: "Dépassement",
  partial: "Partiel",
  missing: "Aucune donnée",
  no_target: "Sans cible",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function toRatio(consumed: number, target: number | null) {
  if (target == null || target <= 0) return 0;
  return Math.max(0, Math.min(consumed / target, 1));
}

function MiniBar({
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
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] uppercase tracking-[0.12em] text-white/35">{label}</p>
        <p className="text-[10px] text-white/68">
          {consumed} / {target ?? "N/A"} {unit}
        </p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(toRatio(consumed, target) * 100, target == null ? 20 : 0)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function NutritionRealityMiniDay({ day }: RealityMiniDayProps) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold text-white">{formatDate(day.date)}</p>
        <p className="text-[9px] uppercase tracking-[0.14em] text-white/40">
          {STATUS_LABELS[day.status] ?? day.status}
        </p>
      </div>

      <div className="mt-3 space-y-2.5">
        <MiniBar
          label="Calories"
          consumed={day.consumed.calories}
          target={day.target.calories}
          unit="kcal"
          color={NUTRITION_UI_COLORS.calories}
        />
        <MiniBar
          label="Protéines"
          consumed={day.consumed.protein_g}
          target={day.target.protein_g}
          unit="g"
          color={NUTRITION_UI_COLORS.protein}
        />
        <MiniBar
          label="Glucides"
          consumed={day.consumed.carbs_g}
          target={day.target.carbs_g}
          unit="g"
          color={NUTRITION_UI_COLORS.carbs}
        />
        <MiniBar
          label="Lipides"
          consumed={day.consumed.fat_g}
          target={day.target.fat_g}
          unit="g"
          color={NUTRITION_UI_COLORS.fat}
        />
        <MiniBar
          label="Hydratation"
          consumed={day.consumed.hydration_ml}
          target={day.target.hydration_ml}
          unit="ml"
          color={NUTRITION_UI_COLORS.water}
        />
      </div>
    </div>
  );
}
