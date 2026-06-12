"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Flame, Target, Droplets, Salad, CircleAlert } from "lucide-react";
import NutritionAgendaPremium from "@/components/clients/nutrition-hub/NutritionAgendaPremium";
import NutritionCoachSignalPanel from "@/components/clients/nutrition-hub/NutritionCoachSignalPanel";
import NutritionFocusDayCard from "@/components/clients/nutrition-hub/NutritionFocusDayCard";
import NutritionKpiStrip from "@/components/clients/nutrition-hub/NutritionKpiStrip";
import NutritionQualityPanel from "@/components/clients/nutrition-hub/NutritionQualityPanel";
import NutritionHubSkeleton from "@/components/clients/nutrition-hub/NutritionHubSkeleton";
import ClientNutritionPrepsWidget from "@/components/coach/ClientNutritionPrepsWidget";
import NutritionTrendGrid from "@/components/clients/nutrition-hub/NutritionTrendGrid";

type NutritionHubResponse = {
  summary: {
    adherenceCalories: number | null;
    adherenceProtein: number | null;
    adherenceCarbs: number | null;
    adherenceFat: number | null;
    adherenceHydration: number | null;
    nutritionScore: number | null;
    validDays: number;
  };
  trend: {
    window: 3 | 7 | 14 | 30;
    points: Array<{
      date: string;
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
    }>;
  };
  energy: {
    protocolTdee: number | null;
    protocolTdeeAt: string | null;
    tdeeDataSource: string | null;
    tdeeHistory: Array<{
      calculated_at: string;
      tdee_adaptive: number;
      tdee_formula: number;
      delta_kcal: number;
      avg_intake_kcal: number;
      weight_delta_kg: number;
      weight_samples: number;
    }>;
  } | null;
  insights: Array<{
    id: string;
    severity: "good" | "watch" | "alert";
    title: string;
    message: string;
  }>;
  agenda: Array<{
    date: string;
    isToday: boolean;
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
  }>;
  dataQuality: {
    validDays: number;
    partialDays: number;
    missingMealDays: number;
    missingHydrationDays: number;
  };
};

const WINDOWS = [3, 7, 14, 30] as const;

function formatPercent(value: number | null) {
  if (value == null) return "N/A";
  return `${Math.round(value * 100)}%`;
}

function formatScore(value: number | null) {
  if (value == null) return "N/A";
  return `${Math.round(value * 100)}/100`;
}

function getHeroTone(score: number | null, insights: NutritionHubResponse["insights"]) {
  if (insights.some((item) => item.severity === "alert") || (score ?? 1) < 0.7) {
    return {
      label: "À corriger",
      tone: "amber",
      accent: "from-[#ff8660]/24 via-[#ffd15e]/12 to-transparent",
      border: "border-[#ffd15e]/20",
    };
  }

  if ((score ?? 1) < 0.85) {
    return {
      label: "Lecture fragile",
      tone: "amber",
      accent: "from-[#ffd15e]/18 via-white/5 to-transparent",
      border: "border-white/[0.08]",
    };
  }

  return {
    label: "Sous contrôle",
    tone: "green",
    accent: "from-[#1f8a65]/26 via-[#8ef0c7]/10 to-transparent",
    border: "border-[#1f8a65]/20",
  };
}

function getHeroSummary(summary: NutritionHubResponse["summary"], dataQuality: NutritionHubResponse["dataQuality"]) {
  const weak = [
    { label: "protéines", value: summary.adherenceProtein },
    { label: "hydratation", value: summary.adherenceHydration },
    { label: "glucides", value: summary.adherenceCarbs },
    { label: "calories", value: summary.adherenceCalories },
    { label: "lipides", value: summary.adherenceFat },
  ]
    .filter((item) => item.value != null)
    .sort((a, b) => (a.value ?? 1) - (b.value ?? 1))
    .slice(0, 2)
    .map((item) => item.label);

  if (dataQuality.partialDays > 0) {
    return "Lecture exploitable, mais plusieurs journées restent incomplètes.";
  }
  if (weak.length === 0) {
    return "Données encore trop faibles pour conclure de façon fiable.";
  }
  if (weak.length === 1) {
    return `Le point faible principal reste ${weak[0]}.`;
  }
  return `Les écarts se concentrent surtout sur ${weak[0]} et ${weak[1]}.`;
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-2 text-white/45">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-2 text-[18px] font-semibold text-white">{value}</p>
    </div>
  );
}

export default function NutritionHub({ clientId }: { clientId: string }) {
  const [windowDays, setWindowDays] = useState<3 | 7 | 14 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NutritionHubResponse | null>(null);

  useEffect(() => {
    let isActive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/clients/${clientId}/nutrition-hub?window=${windowDays}`);
        const json = await response.json();

        if (!isActive) return;

        if (!response.ok) {
          setError(json?.error ?? "Erreur serveur");
          setData(null);
          return;
        }

        setData(json);
      } catch {
        if (!isActive) return;
        setError("Erreur réseau");
        setData(null);
      } finally {
        if (isActive) setLoading(false);
      }
    }

    load();

    return () => {
      isActive = false;
    };
  }, [clientId, windowDays]);

  const heroTone = useMemo(
    () => getHeroTone(data?.summary.nutritionScore ?? null, data?.insights ?? []),
    [data],
  );

  const heroSummary = useMemo(
    () => (data ? getHeroSummary(data.summary, data.dataQuality) : ""),
    [data],
  );

  const focusDayRow = useMemo(() => {
    if (!data?.agenda?.length) return null;
    const pastDays = data.agenda.filter((row) => !row.isToday);
    if (!pastDays.length) return null;
    return [...pastDays].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }, [data]);

  if (loading) {
    return <NutritionHubSkeleton />;
  }

  if (error) {
    return <p className="text-sm text-red-400/70">{error}</p>;
  }

  if (!data) {
    return null;
  }

  if (data.agenda.length === 0) {
    return (
      <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Nutrition
        </p>
        <h2 className="mt-2 text-base font-semibold text-white">
          Pas encore assez de données nutritionnelles
        </h2>
        <p className="mt-2 text-sm text-white/55">
          Les journées nutritionnelles du client apparaîtront ici dès que des repas et des logs d&apos;hydratation seront enregistrés.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <ClientNutritionPrepsWidget clientId={clientId} />

      <section className={`overflow-hidden rounded-[30px] border ${heroTone.border} bg-[#181818] shadow-[0_18px_50px_rgba(0,0,0,0.18)]`}>
        <div className={`bg-gradient-to-br ${heroTone.accent} p-5 md:p-6`}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                Nutrition coach hub
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="text-[26px] font-semibold text-white md:text-[30px]">
                  Score global nutrition
                </h2>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${heroTone.tone === "green" ? "border-[#1f8a65]/30 bg-[#1f8a65]/12 text-[#8ef0c7]" : "border-[#ffd15e]/30 bg-[#ffd15e]/12 text-[#ffd15e]"}`}>
                  {heroTone.label}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/60">
                {heroSummary}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/68">
                  Fenêtre active {windowDays}j
                </div>
                <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/68">
                  {data.summary.validDays} journées valides
                </div>
                <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/68">
                  {data.dataQuality.partialDays} partielle{data.dataQuality.partialDays > 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div className="flex gap-2 rounded-2xl border border-white/[0.06] bg-black/20 p-1">
              {WINDOWS.map((windowValue) => (
                <button
                  key={windowValue}
                  type="button"
                  onClick={() => setWindowDays(windowValue)}
                  className={`rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${
                    windowDays === windowValue
                      ? "bg-white text-black"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  {windowValue} j
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatPill icon={<Flame className="h-4 w-4" />} label="Score" value={formatScore(data.summary.nutritionScore)} />
            <StatPill icon={<Target className="h-4 w-4" />} label="Calories" value={formatPercent(data.summary.adherenceCalories)} />
            <StatPill icon={<Salad className="h-4 w-4" />} label="Protéines" value={formatPercent(data.summary.adherenceProtein)} />
            <StatPill icon={<Droplets className="h-4 w-4" />} label="Hydratation" value={formatPercent(data.summary.adherenceHydration)} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-[28px] border border-white/[0.07] bg-[#181818] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                  Zone analytique
                </p>
                <h3 className="mt-2 text-[18px] font-semibold text-white">
                  Consommé vs cible sur la fenêtre active
                </h3>
              </div>
              <p className="max-w-md text-[13px] leading-relaxed text-white/52">
                La lecture privilégie l’écart entre protocole et exécution réelle, pas seulement les valeurs brutes.
              </p>
            </div>

            <div className="mt-5">
              <NutritionKpiStrip summary={data.summary} />
            </div>
            <div className="mt-5">
              <NutritionTrendGrid points={data.trend.points} energy={data.energy} variant="summary" />
            </div>
          </section>

          <section className="rounded-[28px] border border-white/[0.07] bg-[#181818] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                  Coach insights
                </p>
                <h3 className="mt-2 text-[18px] font-semibold text-white">
                  Priorités d&apos;intervention
                </h3>
              </div>
              <p className="max-w-md text-[13px] leading-relaxed text-white/52">
                Les signaux sont rule-based et priorisés pour aider une décision rapide, sans surcharger la lecture.
              </p>
            </div>
            <div className="mt-5">
              <NutritionCoachSignalPanel insights={data.insights} />
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[28px] border border-white/[0.07] bg-[#181818] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                  Densité de lecture
                </p>
                <h3 className="mt-2 text-[18px] font-semibold text-white">
                  Points de contrôle
                </h3>
              </div>
              <CircleAlert className="h-5 w-5 text-white/35" />
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Qualité</p>
                <p className="mt-2 text-2xl font-semibold text-white">{data.dataQuality.partialDays}</p>
                <p className="mt-1 text-[12px] text-white/48">Jours partiels sur la fenêtre</p>
              </div>
              <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Repas</p>
                <p className="mt-2 text-2xl font-semibold text-white">{data.dataQuality.missingMealDays}</p>
                <p className="mt-1 text-[12px] text-white/48">Jours sans repas loggés</p>
              </div>
              <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Hydratation</p>
                <p className="mt-2 text-2xl font-semibold text-white">{data.dataQuality.missingHydrationDays}</p>
                <p className="mt-1 text-[12px] text-white/48">Jours sans eau enregistrée</p>
              </div>
            </div>
          </section>

          <NutritionFocusDayCard
              row={focusDayRow}
            rationale="La journée la plus récente hors aujourd’hui sert de point d’audit rapide."
          />

          <NutritionQualityPanel dataQuality={data.dataQuality} />
        </aside>
      </section>

      <NutritionAgendaPremium rows={data.agenda} />
    </div>
  );
}
