"use client";

type NutritionHeroPanelProps = {
  summary: {
    adherenceCalories: number | null;
    adherenceProtein: number | null;
    adherenceCarbs: number | null;
    adherenceFat: number | null;
    adherenceHydration: number | null;
    nutritionScore: number | null;
    validDays: number;
  };
  status: {
    label: string;
    tone: "green" | "amber" | "red";
    detail: string;
  };
  heroSummary: string;
  coachAction: string;
  latestDayLabel: string;
  windowLabel: string;
};

const toneClassMap = {
  green: "border-[#1f8a65]/30 bg-[#1f8a65]/12 text-[#8ef0c7]",
  amber: "border-[#ffd15e]/30 bg-[#ffd15e]/12 text-[#ffd15e]",
  red: "border-[#ff8660]/30 bg-[#ff8660]/12 text-[#ff9c7e]",
};

const metricConfig = [
  {
    key: "adherenceCalories",
    label: "Calories",
    detail: "Adhérence calorique sur la fenêtre active.",
  },
  {
    key: "adherenceProtein",
    label: "Protéines",
    detail: "Repère clé pour la qualité d’exécution du protocole.",
  },
  {
    key: "adherenceCarbs",
    label: "Glucides",
    detail: "Mesure la précision énergétique autour des journées.",
  },
  {
    key: "adherenceFat",
    label: "Lipides",
    detail: "Aide à suivre l’équilibre global de la structure alimentaire.",
  },
  {
    key: "adherenceHydration",
    label: "Hydratation",
    detail: "Lecture rapide de la constance hydrique quotidienne.",
  },
] as const;

function formatPercent(value: number | null) {
  return value == null ? "N/A" : `${Math.round(value * 100)}%`;
}

export default function NutritionHeroPanel({
  summary,
  status,
  heroSummary,
  coachAction,
  latestDayLabel,
  windowLabel,
}: NutritionHeroPanelProps) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,_rgba(31,138,101,0.22),_rgba(104,159,250,0.08)_28%,_rgba(24,24,24,1)_62%)] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.32)] md:p-6 xl:p-7">
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/38">
              Score global nutrition
            </p>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${toneClassMap[status.tone]}`}
            >
              {status.label}
            </span>
            <span className="text-[11px] text-white/42">Fenêtre analysée {windowLabel}</span>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h1 className="text-[46px] font-semibold leading-none text-white md:text-[64px]">
                {formatPercent(summary.nutritionScore)}
              </h1>
              <p className="mt-4 max-w-xl text-sm text-white/78">{status.detail}</p>
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/58">
                {heroSummary}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-[22px] border border-white/[0.08] bg-black/18 p-4 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
                  Action coach
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/84">{coachAction}</p>
              </article>

              <article className="rounded-[22px] border border-white/[0.08] bg-black/18 p-4 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
                  Dernière journée suivie
                </p>
                <p className="mt-3 text-sm font-semibold text-white">{latestDayLabel}</p>
              </article>

              <article className="rounded-[22px] border border-white/[0.08] bg-black/18 p-4 backdrop-blur-sm sm:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
                  Lecture coach
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/74">
                  Le score central donne le niveau d’adhérence global, tandis que les
                  cartes latérales détaillent les nutriments à surveiller en priorité.
                </p>
              </article>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
          {metricConfig.map((item) => (
            <article
              key={item.key}
              className="rounded-[22px] border border-white/[0.07] bg-white/[0.05] p-4"
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                {item.label}
              </p>
              <p className="mt-3 text-[30px] font-semibold text-white">
                {formatPercent(summary[item.key])}
              </p>
              <p className="mt-2 text-[12px] text-white/48">{item.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
