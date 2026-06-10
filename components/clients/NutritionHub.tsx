"use client";

import { useEffect, useMemo, useState } from "react";
import NutritionAgendaPremium from "@/components/clients/nutrition-hub/NutritionAgendaPremium";
import NutritionCoachSignalPanel from "@/components/clients/nutrition-hub/NutritionCoachSignalPanel";
import NutritionFocusDayCard from "@/components/clients/nutrition-hub/NutritionFocusDayCard";
import NutritionKpiStrip from "@/components/clients/nutrition-hub/NutritionKpiStrip";
import NutritionQualityPanel from "@/components/clients/nutrition-hub/NutritionQualityPanel";
import NutritionHubSkeleton from "@/components/clients/nutrition-hub/NutritionHubSkeleton";
import ClientNutritionPrepsWidget from "@/components/coach/ClientNutritionPrepsWidget";
import NutritionTrendGrid from "@/components/clients/nutrition-hub/NutritionTrendGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type Segment = "summary" | "macros" | "hydration" | "days";

const WINDOWS = [3, 7, 14, 30] as const;

function getFocusDay(data: NutritionHubResponse | null) {
  if (!data?.agenda.length) return { row: null, rationale: "" };

  // Exclude today — it's always partial by definition, not worth auditing yet
  const pastDays = data.agenda.filter((row) => !row.isToday);
  if (!pastDays.length) return { row: null, rationale: "" };

  const latestFirst = [...pastDays].sort((a, b) => b.date.localeCompare(a.date));

  const priorityRow =
    latestFirst.find((row) => row.status === "over" || row.status === "under") ??
    latestFirst.find((row) => row.status === "partial") ??
    latestFirst[0];

  if (!priorityRow) {
    return { row: null, rationale: "" };
  }

  if (priorityRow.status === "over" || priorityRow.status === "under") {
    return {
      row: priorityRow,
      rationale:
        "C’est la journée récente qui présente l’écart nutritionnel le plus clair par rapport à la cible. Elle mérite donc un audit prioritaire.",
    };
  }

  if (priorityRow.status === "partial") {
    return {
      row: priorityRow,
      rationale:
        "Cette journée reste partielle. Elle est utile à revoir avant de tirer des conclusions trop fermes sur la tendance.",
    };
  }

  return {
    row: priorityRow,
    rationale:
      "Cette journée est la plus récente disponible. Elle sert de point de contrôle rapide pour relire l’exécution actuelle.",
  };
}

export default function NutritionHub({ clientId }: { clientId: string }) {
  const [windowDays, setWindowDays] = useState<3 | 7 | 14 | 30>(7);
  const [segment, setSegment] = useState<Segment>("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NutritionHubResponse | null>(null);

  useEffect(() => {
    let isActive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/clients/${clientId}/nutrition-hub?window=${windowDays}`,
        );
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
        if (isActive) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isActive = false;
    };
  }, [clientId, windowDays]);

  const focusDay = useMemo(() => getFocusDay(data), [data]);

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
          Les journées nutritionnelles du client apparaîtront ici dès que des repas
          et des logs d&apos;hydratation seront enregistrés.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <ClientNutritionPrepsWidget clientId={clientId} />
      <section className="rounded-[28px] border border-white/[0.07] bg-[#181818] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Vue nutritionnelle
            </p>
            <h2 className="mt-2 text-[18px] font-semibold text-white">
              Vue coach temps réel
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/52">
              Lecture essentielle par défaut, puis profondeur analytique selon le
              nutriment ou la période à auditer.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-1">
            {WINDOWS.map((windowValue) => (
              <button
                key={windowValue}
                type="button"
                onClick={() => setWindowDays(windowValue)}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${
                  windowDays === windowValue
                    ? "bg-[#1f8a65] text-white"
                    : "text-white/45 hover:text-white"
                }`}
              >
                {windowValue} j
              </button>
            ))}
          </div>
        </div>

        <Tabs value={segment} onValueChange={(value) => setSegment(value as Segment)} className="mt-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-1">
              <TabsList className="flex-wrap gap-2">
                <TabsTrigger value="summary">Synthèse</TabsTrigger>
                <TabsTrigger value="macros">Macros</TabsTrigger>
                <TabsTrigger value="hydration">Hydratation</TabsTrigger>
                <TabsTrigger value="days">Jours</TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="summary" className="mt-5 space-y-4">
            <NutritionTrendGrid
              points={data.trend.points}
              variant="summary"
              rightRail={
                <>
                  <NutritionCoachSignalPanel insights={data.insights} />
                  <NutritionFocusDayCard
                    row={focusDay.row}
                    rationale={focusDay.rationale}
                  />
                </>
              }
            />
            <NutritionAgendaPremium rows={data.agenda} />
            <NutritionQualityPanel dataQuality={data.dataQuality} />
          </TabsContent>

          <TabsContent value="macros" className="mt-5 space-y-4">
            <NutritionKpiStrip summary={data.summary} />
            <NutritionTrendGrid points={data.trend.points} variant="macros" />
          </TabsContent>

          <TabsContent value="hydration" className="mt-5">
            <NutritionTrendGrid points={data.trend.points} variant="hydration" />
          </TabsContent>

          <TabsContent value="days" className="mt-5">
            <NutritionAgendaPremium rows={data.agenda} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
