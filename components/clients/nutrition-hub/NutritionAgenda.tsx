"use client";

import { useState } from "react";
import NutritionDayDrawer from "./NutritionDayDrawer";

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

export default function NutritionAgenda({
  rows,
}: {
  rows: NutritionAgendaRow[];
}) {
  const [selectedRow, setSelectedRow] = useState<NutritionAgendaRow | null>(null);

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4 md:p-5">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Agenda Nutritionnel
        </p>
        <h2 className="mt-1 text-[15px] font-semibold text-white">
          Journées observées
        </h2>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <button
            key={row.date}
            onClick={() => setSelectedRow(row)}
            className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{row.date}</p>
                <p className="mt-1 text-[11px] text-white/45">
                  {STATUS_LABELS[row.status] ?? row.status} · {row.mealCount} repas
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">
                  {row.consumed.calories} / {row.target.calories ?? "—"} kcal
                </p>
                <p className="mt-1 text-[11px] text-white/45">
                  Eau {row.consumed.hydration_ml} / {row.target.hydration_ml ?? "—"} ml
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <NutritionDayDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </section>
  );
}
