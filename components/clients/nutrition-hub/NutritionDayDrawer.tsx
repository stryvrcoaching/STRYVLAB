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

export default function NutritionDayDrawer({
  row,
  onClose,
}: {
  row: NutritionAgendaRow | null;
  onClose: () => void;
}) {
  if (!row) return null;

  const formattedDate = new Date(row.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
      <aside className="h-full w-full max-w-md border-l border-white/[0.06] bg-[#181818] p-5">
        <button
          onClick={onClose}
          className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/60"
        >
          Fermer
        </button>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Détail journée
        </p>
        <h3 className="mt-2 text-lg font-semibold capitalize text-white">{formattedDate}</h3>
        <div className="mt-5 space-y-4 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Calories
            </p>
            <p className="mt-2 text-sm" style={{ color: NUTRITION_UI_COLORS.calories }}>
              {row.consumed.calories} / {row.target.calories ?? "—"} kcal
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Macronutriments
            </p>
            <p className="mt-2 text-sm text-white/75">
              <span style={{ color: NUTRITION_UI_COLORS.protein }}>
                Protéines {row.consumed.protein_g} g
              </span>{" "}
              ·{" "}
              <span style={{ color: NUTRITION_UI_COLORS.carbs }}>
                Glucides {row.consumed.carbs_g} g
              </span>{" "}
              ·{" "}
              <span style={{ color: NUTRITION_UI_COLORS.fat }}>
                Lipides {row.consumed.fat_g} g
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Hydratation
            </p>
            <p className="mt-2 text-sm" style={{ color: NUTRITION_UI_COLORS.water }}>
              {row.consumed.hydration_ml} / {row.target.hydration_ml ?? "—"} ml
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
