"use client";

type NutritionHubSummary = {
  adherenceCalories: number | null;
  adherenceProtein: number | null;
  adherenceCarbs: number | null;
  adherenceFat: number | null;
  adherenceHydration: number | null;
  achievedCalories?: number | null;
  achievedProtein?: number | null;
  achievedCarbs?: number | null;
  achievedFat?: number | null;
  achievedHydration?: number | null;
  nutritionScore: number | null;
  validDays: number;
};

const KPI_CONFIG: Array<{
  key: keyof NutritionHubSummary;
  displayKey?: keyof NutritionHubSummary;
  label: string;
}> = [
  { key: "nutritionScore", label: "Score global nutrition" },
  { key: "adherenceCalories", displayKey: "achievedCalories", label: "Calories" },
  { key: "adherenceProtein", displayKey: "achievedProtein", label: "Protéines" },
  { key: "adherenceCarbs", displayKey: "achievedCarbs", label: "Glucides" },
  { key: "adherenceFat", displayKey: "achievedFat", label: "Lipides" },
  { key: "adherenceHydration", displayKey: "achievedHydration", label: "Hydratation" },
];

function formatPercent(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function getValueTone(value: number | null) {
  if (value == null) return "text-white";
  if (value > 1.05) return "text-[#ff8660]";
  if (value < 0.9) return "text-[#ffd15e]";
  return "text-[#8ef0c7]";
}

export default function NutritionKpiStrip({
  summary,
}: {
  summary: NutritionHubSummary;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {KPI_CONFIG.map((item) => {
        const value = (item.displayKey
          ? summary[item.displayKey]
          : summary[item.key]) as number | null;

        return (
          <article
            key={item.key}
            className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              {item.label}
            </p>
            <p className={`mt-2 text-[28px] font-semibold ${getValueTone(value)}`}>
              {formatPercent(value)}
            </p>
            <p className="mt-2 text-[11px] text-white/45">
              {summary.validDays} jour{summary.validDays > 1 ? "s" : ""} valide
              {summary.validDays > 1 ? "s" : ""}
            </p>
          </article>
        );
      })}
    </section>
  );
}
