"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
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
    clientTdee: number | null;
    clientTdeeAt: string | null;
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
    smoothing: null | {
      planId: string;
      sourceDate: string;
      direction: "surplus" | "deficit";
      kcalDelta: number;
      remainingKcal: number;
      dayStatus: string;
      coachNote: string | null;
      coachLastAction: string | null;
    };
  }>;
  activeSmoothingPlan: null | {
    id: string;
    sourceDate: string;
    sourceTargetKcal: number;
    sourceConsumedKcal: number;
    direction: "surplus" | "deficit";
    durationDays: number;
    smoothableDeltaKcal: number;
    strategy: "recommended" | "manual";
    status: string;
    createdBy: "client" | "coach";
    coachNote: string | null;
    coachNoteUpdatedAt: string | null;
    coachLastAction: string | null;
    days: Array<{
      date: string;
      kcalDelta: number;
      status: string;
      remainingKcal: number;
    }>;
  };
  smoothingRecommendation: null | {
    date: string;
    protocolId: string | null;
    protocolName: string | null;
    actionUrl: string;
    proposal: {
      eligible: boolean;
      thresholdKcal: number;
      rawDeltaKcal: number;
      smoothableDeltaKcal: number;
      direction: "surplus" | "deficit" | null;
      recommendedDurationDays: 3 | 4 | 5 | 7 | 10 | null;
    };
    previewDays: Array<{
      date: string;
      label: string;
      baseTargetKcal: number;
      adjustedTargetKcal: number;
      kcalDelta: number;
      scalingRatio: number;
      hasCoachPlan: boolean;
      meals: Array<{
        mealId: string;
        title: string;
        baseCalories: number;
        adjustedCalories: number;
        scalingRatio: number;
        itemCount: number;
      }>;
    }>;
  };
  dataQuality: {
    validDays: number;
    partialDays: number;
    missingMealDays: number;
    missingHydrationDays: number;
  };
};

function formatSmoothingDirection(direction: "surplus" | "deficit") {
  return direction === "surplus" ? "Réduction" : "Réinjection";
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

export default function NutritionHub({
  clientId,
  windowDays,
  focusDate,
}: {
  clientId: string;
  windowDays: 3 | 7 | 14 | 30;
  focusDate?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NutritionHubResponse | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [coachNoteDraft, setCoachNoteDraft] = useState("");
  const [coachDuration, setCoachDuration] = useState<3 | 4 | 5 | 7 | 10>(3);
  const [coachActionBusy, setCoachActionBusy] = useState<"cancel" | "modify" | "note" | null>(null);

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
  }, [clientId, windowDays, refreshTick]);

  useEffect(() => {
    if (!data?.activeSmoothingPlan) return;
    setCoachNoteDraft(data.activeSmoothingPlan.coachNote ?? "");
    setCoachDuration(
      (data.activeSmoothingPlan.durationDays as 3 | 4 | 5 | 7 | 10) ?? 3,
    );
  }, [data?.activeSmoothingPlan]);

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

  async function submitCoachAction(action: "cancel" | "modify" | "note") {
    if (!data?.activeSmoothingPlan) return;
    setCoachActionBusy(action);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/nutrition-smoothing/${data.activeSmoothingPlan.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: coachNoteDraft.trim() || undefined,
            durationDays: action === "modify" ? coachDuration : undefined,
          }),
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Erreur serveur");
        return;
      }

      setRefreshTick((current) => current + 1);
    } catch {
      setError("Erreur réseau");
    } finally {
      setCoachActionBusy(null);
    }
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

      {data.smoothingRecommendation && (
        <section className="rounded-[28px] border border-[#ffd15e]/18 bg-[#181818] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                  Recommandation système
                </p>
                <h2 className="mt-2 text-[18px] font-semibold text-white">
                  {formatSmoothingDirection(data.smoothingRecommendation.proposal.direction === "surplus" ? "surplus" : "deficit")} de{" "}
                  {Math.abs(data.smoothingRecommendation.proposal.smoothableDeltaKcal)} kcal
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                  Détecté sur le {new Date(data.smoothingRecommendation.date).toLocaleDateString("fr-FR")} · recommandé sur{" "}
                  {data.smoothingRecommendation.proposal.recommendedDurationDays} jours · le client ne voit rien tant que le coach n&apos;applique pas l&apos;ajustement.
                </p>
              </div>
              <button
                onClick={() => router.push(data.smoothingRecommendation!.actionUrl)}
                className="rounded-2xl bg-[#ffd15e] px-4 py-3 text-[12px] font-bold text-[#121212]"
              >
                Ouvrir dans Nutrition Studio
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {data.smoothingRecommendation.previewDays.map((day) => (
                <div key={day.date} className="rounded-[22px] border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                        {new Date(day.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </p>
                      <p className="mt-1 text-[14px] font-semibold text-white">{day.label}</p>
                    </div>
                    <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-bold text-white/70">
                      {day.kcalDelta > 0 ? "+" : ""}
                      {day.kcalDelta} kcal
                    </span>
                  </div>
                  <p className="mt-3 text-[12px] text-white/60">
                    {day.baseTargetKcal} kcal → {day.adjustedTargetKcal} kcal
                  </p>
                  <p className="mt-1 text-[12px] text-white/45">
                    {day.hasCoachPlan
                      ? `Plan coach ajusté à ${(day.scalingRatio * 100).toFixed(0)}% sur ${day.meals.length} repas.`
                      : "Aucun repas coach préparé sur ce jour."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {data.activeSmoothingPlan && (
        <section className="rounded-[28px] border border-[#1f8a65]/18 bg-[#181818] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                  Lissage actif
                </p>
                <h2 className="mt-2 text-[18px] font-semibold text-white">
                  {formatSmoothingDirection(data.activeSmoothingPlan.direction)} de{" "}
                  {Math.abs(data.activeSmoothingPlan.smoothableDeltaKcal)} kcal sur{" "}
                  {data.activeSmoothingPlan.durationDays} jours
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                  Source du {new Date(data.activeSmoothingPlan.sourceDate).toLocaleDateString("fr-FR")} ·{" "}
                  cible {data.activeSmoothingPlan.sourceTargetKcal} kcal · consommé{" "}
                  {data.activeSmoothingPlan.sourceConsumedKcal} kcal
                </p>
                {data.activeSmoothingPlan.coachNote && (
                  <p className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-white/72">
                    Note coach : {data.activeSmoothingPlan.coachNote}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[#1f8a65]/30 bg-[#1f8a65]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8ef0c7]">
                  {data.activeSmoothingPlan.strategy === "recommended" ? "Auto accepté" : "Ajusté"}
                </span>
                {data.activeSmoothingPlan.coachLastAction && (
                  <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/58">
                    Coach {data.activeSmoothingPlan.coachLastAction}
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-4 rounded-[24px] border border-white/[0.06] bg-white/[0.03] p-4 lg:grid-cols-[160px_minmax(0,1fr)_auto]">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                  Répartir sur
                </label>
                <select
                  value={coachDuration}
                  onChange={(event) => setCoachDuration(Number(event.target.value) as 3 | 4 | 5 | 7 | 10)}
                  className="mt-2 h-11 w-full rounded-2xl border border-white/[0.08] bg-[#101010] px-3 text-[13px] text-white outline-none"
                >
                  {[3, 4, 5, 7, 10].map((value) => (
                    <option key={value} value={value}>
                      {value} jours
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                  Note visible client
                </label>
                <textarea
                  value={coachNoteDraft}
                  onChange={(event) => setCoachNoteDraft(event.target.value)}
                  rows={3}
                  placeholder="Consigne ou précision coach…"
                  className="mt-2 w-full rounded-2xl border border-white/[0.08] bg-[#101010] px-3 py-3 text-[13px] text-white outline-none placeholder:text-white/28"
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => submitCoachAction("modify")}
                  disabled={coachActionBusy !== null}
                  className="rounded-2xl bg-[#1f8a65] px-4 py-3 text-[12px] font-bold text-white disabled:opacity-50"
                >
                  {coachActionBusy === "modify" ? "Mise à jour…" : "Modifier"}
                </button>
                <button
                  onClick={() => submitCoachAction("note")}
                  disabled={coachActionBusy !== null}
                  className="rounded-2xl bg-white/[0.06] px-4 py-3 text-[12px] font-semibold text-white/72 disabled:opacity-50"
                >
                  {coachActionBusy === "note" ? "Envoi…" : "Envoyer note"}
                </button>
                <button
                  onClick={() => submitCoachAction("cancel")}
                  disabled={coachActionBusy !== null}
                  className="rounded-2xl bg-[#ff8660]/12 px-4 py-3 text-[12px] font-semibold text-[#ffb39d] disabled:opacity-50"
                >
                  {coachActionBusy === "cancel" ? "Annulation…" : "Annuler"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className={`overflow-hidden rounded-[30px] border ${heroTone.border} bg-[#181818] shadow-[0_18px_50px_rgba(0,0,0,0.18)]`}>
        <div className={`bg-gradient-to-br ${heroTone.accent} p-5 md:p-6`}>
          <div className="flex flex-col gap-5">
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
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_400px] 2xl:grid-cols-[minmax(0,1.62fr)_430px]">
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

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
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
            <div className="mt-3 max-w-[28rem] text-[13px] leading-relaxed text-white/52">
              Un poste de contrôle compact pour repérer immédiatement les trous de saisie qui peuvent fausser la lecture coach.
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[22px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Qualité</p>
                <p className="mt-2 text-2xl font-semibold text-white">{data.dataQuality.partialDays}</p>
                <p className="mt-1 text-[12px] text-white/48">Jours partiels sur la fenêtre</p>
              </div>
              <div className="rounded-[22px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Repas</p>
                <p className="mt-2 text-2xl font-semibold text-white">{data.dataQuality.missingMealDays}</p>
                <p className="mt-1 text-[12px] text-white/48">Jours sans repas loggés</p>
              </div>
              <div className="rounded-[22px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4">
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

      <NutritionAgendaPremium rows={data.agenda} focusDate={focusDate ?? null} />
    </div>
  );
}
