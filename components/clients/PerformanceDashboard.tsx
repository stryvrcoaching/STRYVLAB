"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import {
  Dumbbell,
  TrendingUp,
  Zap,
  Clock,
  Target,
  Activity,
  ChevronDown,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
type Period = 7 | 30 | 90 | 0;
type Metric = "volume" | "reps" | "sets";

interface KPIs {
  totalSessions: number;
  completedSessions: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  avgDuration: number;
}

interface TimelinePoint {
  date: string;
  volume: number;
  reps: number;
  sets: number;
  sessions: number;
}

interface MuscleGroup {
  name: string;
  volume: number;
  sets: number;
  reps: number;
}

interface ExerciseSession {
  date: string;
  maxWeight: number;
  totalVolume: number;
  totalReps: number;
  sets: number;
}

interface Exercise {
  name: string;
  sessions: ExerciseSession[];
}

interface RpeTrend {
  date: string;
  avgRpe: number;
}

interface PerformanceData {
  kpis: KPIs;
  timeline: TimelinePoint[];
  muscleGroups: MuscleGroup[];
  exercises: Exercise[];
  rpeTrend: RpeTrend[];
}

// ── Helpers ────────────────────────────────────────────────────
const PERIOD_LABELS: Record<Period, string> = {
  7: "7 jours",
  30: "30 jours",
  90: "90 jours",
  0: "Tout",
};
const METRIC_LABELS: Record<Metric, string> = {
  volume: "Volume (kg)",
  reps: "Répétitions",
  sets: "Séries",
};

// Chart-specific color palette (visual distinction for data representation)
// Mapped to STRYVR design tokens where possible
const CHART_TEXT_COLOR = "rgba(255,255,255,0.40)"; // muted text (from design system)
const METRIC_COLOR: Record<Metric, string> = {
  volume: "#1f8a65",
  reps: "#6366f1",
  sets: "#f59e0b",
};

const MUSCLE_COLORS: Record<string, string> = {
  Jambes: "#6366f1",
  Pectoraux: "#10b981",
  Dos: "#3b82f6",
  Épaules: "#f59e0b",
  Biceps: "#ec4899",
  Triceps: "#8b5cf6",
  Abdos: "#14b8a6",
  Mollets: "#f97316",
  Autre: "#94a3b8",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatVolume(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}kg`;
}

interface MetricSeries {
  [fieldKey: string]: { date: string; value: number }[];
}

function getLatestSeriesValue(
  series: MetricSeries | null,
  key: string,
): number | null {
  const values = series?.[key];
  if (!values?.length) return null;
  return values[values.length - 1].value;
}

function getSeriesDelta(
  series: MetricSeries | null,
  key: string,
): number | null {
  const values = series?.[key];
  if (!values || values.length < 2) return null;
  return values[values.length - 1].value - values[0].value;
}

function estimateFatMass(series: MetricSeries | null): number | null {
  const fatMass = getLatestSeriesValue(series, "fat_mass_kg");
  if (fatMass != null) return fatMass;
  const weight = getLatestSeriesValue(series, "weight_kg");
  const bf = getLatestSeriesValue(series, "body_fat_pct");
  if (weight != null && bf != null) return (weight * bf) / 100;
  return null;
}

function estimateFatMassDelta(series: MetricSeries | null): number | null {
  const fatMassDelta = getSeriesDelta(series, "fat_mass_kg");
  if (fatMassDelta != null) return fatMassDelta;
  const weightValues = series?.["weight_kg"];
  const bfValues = series?.["body_fat_pct"];
  if (!weightValues?.length || !bfValues?.length) return null;
  const firstWeight = weightValues[0].value;
  const lastWeight = weightValues[weightValues.length - 1].value;
  const firstBf = bfValues[0].value;
  const lastBf = bfValues[bfValues.length - 1].value;
  return (lastWeight * lastBf) / 100 - (firstWeight * firstBf) / 100;
}

function safeDivide(value: number, divisor: number): number | null {
  if (!divisor || Number.isNaN(divisor)) return null;
  return value / divisor;
}

function formatSign(value: number | null): string {
  if (value == null) return "—";
  return value >= 0 ? `+${value.toFixed(1)}` : `${value.toFixed(1)}`;
}

function KpiStat({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon size={13} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider truncate">{label}</p>
        <p className="text-[13px] font-bold text-white font-mono leading-tight">{value}</p>
        {sub && <p className="text-[9px] text-white/35 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// Custom radar tooltip
function RadarTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#181818] border-tooltip rounded-lg px-3 py-2 text-xs">
      <p className="font-bold text-white mb-1">{payload[0]?.payload?.name}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <span className="font-mono font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// Custom line tooltip (dates)
function LineTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#181818] border-tooltip rounded-lg px-3 py-2 text-xs">
      <p className="font-bold text-white mb-1">{formatDate(label)}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <span className="font-mono font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// Custom bar tooltip (noms de groupes musculaires — pas de formatDate)
function BarTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#181818] border-tooltip rounded-lg px-3 py-2 text-xs">
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <span className="font-mono font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function PerformanceDashboard({
  clientId,
  refreshKey = 0,
}: {
  clientId: string;
  refreshKey?: number;
}) {
  const [period, setPeriod] = useState<Period>(30);
  const [metric, setMetric] = useState<Metric>("volume");
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [data, setData] = useState<PerformanceData | null>(null);
  const [metricsSeries, setMetricsSeries] = useState<MetricSeries | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [perfRes, metricsRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/performance?days=${period}`),
      fetch(`/api/clients/${clientId}/metrics`),
    ]);

    const perfData = await perfRes.json();
    const metricsData = await metricsRes.json().catch(() => ({ series: {} }));

    setData(perfData);
    setMetricsSeries(metricsData.series ?? {});

    if (!selectedExercise && perfData.exercises?.[0])
      setSelectedExercise(perfData.exercises[0].name);
    setLoading(false);
  }, [clientId, period, selectedExercise]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#181818] rounded-xl p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        {/* Chart */}
        <div className="bg-[#181818] rounded-xl p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        {/* Two cols */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#181818] rounded-xl p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <div className="bg-[#181818] rounded-xl p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, timeline, muscleGroups, exercises, rpeTrend } = data;
  const latestWeight = getLatestSeriesValue(metricsSeries, "weight_kg");
  const latestProtein = getLatestSeriesValue(metricsSeries, "protein_g");
  const latestCaloriesPlan = getLatestSeriesValue(
    metricsSeries,
    "calories_target",
  );
  const latestBmr = getLatestSeriesValue(metricsSeries, "bmr_kcal");
  const latestMuscleMass =
    getLatestSeriesValue(metricsSeries, "muscle_mass_kg") ??
    getLatestSeriesValue(metricsSeries, "skeletal_muscle_mass_kg");
  const latestFatMass = estimateFatMass(metricsSeries);
  const deltaMuscleMass =
    getSeriesDelta(metricsSeries, "muscle_mass_kg") ??
    getSeriesDelta(metricsSeries, "skeletal_muscle_mass_kg");
  const deltaFatMass = estimateFatMassDelta(metricsSeries);
  const deltaWeight = getSeriesDelta(metricsSeries, "weight_kg");
  const caloriesActual =
    [
      "calories_actual",
      "actual_calories",
      "calories_consumed",
      "consumed_calories",
      "kcal_real",
      "kcal_actual",
    ]
      .map((key) => getLatestSeriesValue(metricsSeries, key))
      .find((value) => value != null) ?? null;

  const firstTimelineWithReps =
    timeline.find((point) => point.reps > 0) ?? null;
  const lastTimelineWithReps =
    [...timeline].reverse().find((point) => point.reps > 0) ?? null;
  const firstAvgLoad = firstTimelineWithReps
    ? firstTimelineWithReps.volume / firstTimelineWithReps.reps
    : null;
  const lastAvgLoad = lastTimelineWithReps
    ? lastTimelineWithReps.volume / lastTimelineWithReps.reps
    : null;
  const deltaChargeMean =
    lastAvgLoad != null && firstAvgLoad != null
      ? lastAvgLoad - firstAvgLoad
      : null;
  const proteinPerKg =
    latestProtein != null && latestWeight ? latestProtein / latestWeight : null;
  const calorieDeficitPercent =
    latestCaloriesPlan && caloriesActual != null
      ? ((caloriesActual - latestCaloriesPlan) / latestCaloriesPlan) * 100
      : null;
  const weightStable =
    deltaWeight != null ? Math.abs(deltaWeight) <= 0.5 : false;
  const sleepDelta = getSeriesDelta(metricsSeries, "sleep_hours");
  const stressDelta = getSeriesDelta(metricsSeries, "stress_level");
  const energyDelta = getSeriesDelta(metricsSeries, "energy_level");

  const hasNutritionData = latestCaloriesPlan != null && caloriesActual != null;
  const adherenceLabel = hasNutritionData
    ? Math.abs(calorieDeficitPercent ?? 0) <= 5
      ? "Adhérence solide"
      : Math.abs(calorieDeficitPercent ?? 0) > 10
        ? "Adhérence compromise"
        : "Adhérence marginale"
    : "Données nutritionnelles incomplètes";

  const metabolicEfficiency =
    hasNutritionData && deltaMuscleMass != null
      ? safeDivide(caloriesActual - latestCaloriesPlan, deltaMuscleMass)
      : null;

  const prScore =
    deltaChargeMean != null && deltaFatMass != null
      ? safeDivide(deltaChargeMean, deltaFatMass)
      : null;

  const recoveryRisk =
    deltaChargeMean != null &&
    deltaChargeMean > 0 &&
    ((sleepDelta != null && sleepDelta < 0) ||
      (energyDelta != null && energyDelta < 0) ||
      (stressDelta != null && stressDelta > 0));

  const performanceOutcome = () => {
    if (!hasNutritionData) return "Indéterminée";
    if (
      calorieDeficitPercent != null &&
      calorieDeficitPercent <= -20 &&
      weightStable
    )
      return "Données invalides";
    if (
      prScore != null &&
      prScore < 1 &&
      deltaFatMass != null &&
      deltaFatMass > 0
    )
      return "Inefficace";
    if (recoveryRisk) return "À risque";
    if (proteinPerKg != null && proteinPerKg < 1.8) return "Inefficace";
    if (deltaChargeMean != null && deltaChargeMean > 0) return "Validée";
    return "Indéterminée";
  };

  const analysisAction = () => {
    if (!hasNutritionData) {
      return "Corriger immédiate de la capture des calories réelles. Le coaching est suspendu jusqu'à fiabilisation des données nutritionnelles.";
    }
    if (
      calorieDeficitPercent != null &&
      calorieDeficitPercent <= -20 &&
      weightStable
    ) {
      return "Données incohérentes : vérifier la saisie calorique ou mettre le coaching en pause. Le poids stable ne peut pas coexister avec un déficit réel > 20 %.";
    }
    if (recoveryRisk) {
      return "Réduire immédiatement le volume d'entraînement. Le sommeil/fatigue se dégradent tandis que la charge augmente.";
    }
    if (proteinPerKg != null && proteinPerKg < 1.8) {
      return "Augmenter les protéines à minimum 1.8 g/kg. Priorité sur la protéine, pas sur le cardio.";
    }
    if (
      prScore != null &&
      prScore < 1 &&
      deltaFatMass != null &&
      deltaFatMass > 0
    ) {
      return "Réviser la stratégie : la prise de poids est non fonctionnelle. Ajuster le nutritionnel avant d'augmenter le volume.";
    }
    if (deltaChargeMean != null && deltaChargeMean <= 0) {
      return "Stabiliser le volume et reprendre la fiabilisation des données avant d'augmenter l'intensité.";
    }
    return "Maintenir la stratégie actuelle, en gardant la priorité sur la cohérence des calories et du suivi de la récupération.";
  };

  const analysisConclusion = () => {
    const caloriesText =
      caloriesActual != null ? `${Math.round(caloriesActual)} kcal` : "X kcal";
    const proteinText =
      latestProtein != null
        ? `${Math.round(latestProtein)} g de protéines`
        : "Y g de protéines";
    const forceDeltaText =
      deltaChargeMean != null ? `${deltaChargeMean.toFixed(1)} kg` : "Z";

    if (!hasNutritionData) {
      return `L'apport de ${caloriesText} avec ${proteinText} ne peut pas être validé. Données nutritionnelles réelles manquantes.`;
    }

    if (performanceOutcome() === "Inefficace") {
      return `L'apport de ${caloriesText} avec ${proteinText} a produit ${forceDeltaText} de gain de charge moyenne. La stratégie est Inefficace.`;
    }
    if (performanceOutcome() === "À risque") {
      return `L'apport de ${caloriesText} avec ${proteinText} montre une hausse de charge de ${forceDeltaText} dans un contexte de récupération dégradée. La stratégie est À risque.`;
    }
    if (performanceOutcome() === "Validée") {
      return `L'apport de ${caloriesText} avec ${proteinText} a produit ${forceDeltaText} de gain de charge moyenne. La stratégie est Validée.`;
    }
    return `L'apport de ${caloriesText} avec ${proteinText} nécessite confirmation : l'issue reste Indéterminée.`;
  };

  // Normaliser les données radar (0–100)
  const maxValues = {
    volume: Math.max(...muscleGroups.map((m) => m.volume), 1),
    sets: Math.max(...muscleGroups.map((m) => m.sets), 1),
    reps: Math.max(...muscleGroups.map((m) => m.reps), 1),
  };
  const radarData = muscleGroups.map((m) => ({
    name: m.name,
    Volume: Math.round((m.volume / maxValues.volume) * 100),
    Séries: Math.round((m.sets / maxValues.sets) * 100),
    Reps: Math.round((m.reps / maxValues.reps) * 100),
    _raw: m,
  }));

  const selectedEx = exercises.find((e) => e.name === selectedExercise);

  const isEmpty = kpis.totalSessions === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filtres ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Période */}
        <div className="flex items-center bg-white/[0.04] rounded-lg p-1 gap-1">
          {([7, 30, 90, 0] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                period === p
                  ? "bg-accent text-white shadow"
                  : "text-white/45 hover:text-white"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Métrique */}
        <div className="flex items-center bg-white/[0.04] rounded-lg p-1 gap-1">
          {(["volume", "reps", "sets"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                metric === m
                  ? "text-white shadow"
                  : "text-white/45 hover:text-white"
              }`}
              style={metric === m ? { backgroundColor: METRIC_COLOR[m] } : {}}
            >
              {METRIC_LABELS[m].split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-[#181818] border-subtle rounded-xl p-16 text-center">
          <Dumbbell
            size={40}
            className="text-white/45 mx-auto mb-4 opacity-20"
          />
          <p className="text-sm text-white/45">
            Aucune séance sur cette période.
          </p>
          <p className="text-xs text-white/45/60 mt-1">
            Le client doit commencer à enregistrer ses séances.
          </p>
        </div>
      ) : (
        <>
          {/* ── KPIs strip ── */}
          <div className="bg-[#181818] border-subtle rounded-xl px-4 py-3 flex items-center gap-0 flex-wrap">
            {[
              { label: "Séances", value: String(kpis.totalSessions), sub: `${kpis.completedSessions} complétées`, icon: Dumbbell, color: "#6366f1" },
              { label: "Volume", value: formatVolume(kpis.totalVolume), sub: "kg soulevés", icon: TrendingUp, color: "#10b981" },
              { label: "Séries", value: String(kpis.totalSets), icon: Target, color: "#f59e0b" },
              { label: "Répétitions", value: kpis.totalReps.toLocaleString("fr-FR"), icon: Activity, color: "#3b82f6" },
              { label: "Durée moyenne", value: kpis.avgDuration ? `${kpis.avgDuration} min` : "—", icon: Clock, color: "#ec4899" },
              { label: "Intensité", value: rpeTrend.length ? `RPE ${(rpeTrend.reduce((a, r) => a + r.avgRpe, 0) / rpeTrend.length).toFixed(1)}` : "—", sub: "moyenne", icon: Zap, color: "#f97316" },
            ].map((stat, i, arr) => (
              <div key={stat.label} className="flex items-center">
                <KpiStat {...stat} />
                {i < arr.length - 1 && <div className="w-px h-8 bg-white/[0.06] mx-4 shrink-0" />}
              </div>
            ))}
          </div>

          {hasNutritionData && <div className="bg-[#181818] border-subtle rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">
                  Diagnostics automatisés
                </p>
                <h3 className="font-bold text-white text-sm mt-1">
                  Analyse nutrition & performance
                </h3>
              </div>
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/60">
                {performanceOutcome()}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-[11px] text-white/45 mb-2">
                  Synthèse du delta
                </p>
                <p className="text-sm text-white leading-snug">
                  {adherenceLabel} ·{" "}
                  {latestWeight != null
                    ? `${formatSign(deltaWeight)} kg`
                    : "Poids indisponible"}
                </p>
                <p className="text-[11px] text-white/45 mt-2">
                  {latestBmr != null ? `BMR ${Math.round(latestBmr)} kcal` : ""}
                  {latestBmr != null && latestMuscleMass != null ? " · " : ""}
                  {latestMuscleMass != null
                    ? `Muscle ${latestMuscleMass.toFixed(1)} kg`
                    : ""}
                  {(latestBmr != null || latestMuscleMass != null) &&
                  latestFatMass != null
                    ? " · "
                    : ""}
                  {latestFatMass != null
                    ? `Graisse ${latestFatMass.toFixed(1)} kg`
                    : ""}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-[11px] text-white/45 mb-2">Conclusion</p>
                <p className="text-sm text-white leading-snug">
                  {analysisConclusion()}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-[11px] text-white/45 mb-2">Action directe</p>
                <p className="text-sm text-white leading-snug">
                  {analysisAction()}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-[11px] text-white/45 mb-2">PR Score</p>
                <p className="text-sm text-white">
                  {prScore != null ? prScore.toFixed(2) : "Non calculable"}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-[11px] text-white/45 mb-2">Prot./kg</p>
                <p className="text-sm text-white">
                  {proteinPerKg != null
                    ? `${proteinPerKg.toFixed(2)} g/kg`
                    : "Indisponible"}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-[11px] text-white/45 mb-2">Δ graisse</p>
                <p className="text-sm text-white">
                  {deltaFatMass != null
                    ? `${formatSign(deltaFatMass)} kg`
                    : "Indisponible"}
                </p>
              </div>
            </div>
          </div>}

          {/* ── Volume / Reps / Sets Timeline ── */}
          <div className="bg-[#181818] border-subtle rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-white text-sm">
                  Évolution — {METRIC_LABELS[metric]}
                </h3>
                <p className="text-xs text-white/45 mt-0.5">
                  {timeline.length} jours d'activité
                </p>
              </div>
            </div>
            {timeline.length >= 2 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={timeline}
                  margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="metricGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={METRIC_COLOR[metric]}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={METRIC_COLOR[metric]}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.1)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 10, fill: CHART_TEXT_COLOR }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: CHART_TEXT_COLOR }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={
                      metric === "volume" ? formatVolume : undefined
                    }
                  />
                  <Tooltip content={<LineTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey={metric}
                    name={METRIC_LABELS[metric]}
                    stroke={METRIC_COLOR[metric]}
                    fill="url(#metricGradient)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: METRIC_COLOR[metric], strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <p className="text-xs text-white/45 text-center">Pas assez de données pour afficher la courbe</p>
                <p className="text-[10px] text-white/25 text-center">Minimum 2 séances sur la période sélectionnée</p>
              </div>
            )}
          </div>

          {/* ── Radar + RPE ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Radar groupes musculaires */}
            <div className="bg-[#181818] border-subtle rounded-xl p-5">
              <h3 className="font-bold text-white text-sm mb-1">
                Répartition musculaire
              </h3>
              <p className="text-xs text-white/45 mb-4">
                Score normalisé par groupe (0–100)
              </p>
              {radarData.length >= 3 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart
                    data={radarData}
                    margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                  >
                    <PolarGrid stroke="rgba(255,255,255,0.15)" />
                    <PolarAngleAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: CHART_TEXT_COLOR }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="Volume"
                      dataKey="Volume"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                    <Radar
                      name="Séries"
                      dataKey="Séries"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.15}
                      strokeWidth={1.5}
                    />
                    <Tooltip content={<RadarTooltipContent />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <p className="text-xs text-white/45 text-center">Pas assez de groupes musculaires</p>
                  <p className="text-[10px] text-white/25 text-center">Minimum 3 groupes requis pour le radar</p>
                </div>
              )}
            </div>

            {/* RPE trend */}
            <div className="bg-[#181818] border-subtle rounded-xl p-5">
              <h3 className="font-bold text-white text-sm mb-1">
                Intensité perçue (RPE)
              </h3>
              <p className="text-xs text-white/45 mb-4">
                Moyenne par séance · Zone cible 7–8
              </p>
              {rpeTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={rpeTrend}
                    margin={{ top: 10, right: 5, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.1)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 10, fill: CHART_TEXT_COLOR }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[1, 10]}
                      ticks={[1, 3, 5, 7, 8, 10]}
                      tick={{ fontSize: 10, fill: CHART_TEXT_COLOR }}
                      axisLine={false}
                      tickLine={false}
                      width={25}
                    />
                    <Tooltip content={<LineTooltipContent />} />
                    <ReferenceLine
                      y={7}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: "7",
                        position: "right",
                        fontSize: 9,
                        fill: "#10b981",
                      }}
                    />
                    <ReferenceLine
                      y={8}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: "8",
                        position: "right",
                        fontSize: 9,
                        fill: "#f59e0b",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgRpe"
                      name="RPE moy."
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-white/45 text-center py-10">
                  Aucune donnée RPE
                </p>
              )}
            </div>
          </div>

          {/* ── Volume par groupe musculaire (bar) ── */}
          <div className="bg-[#181818] border-subtle rounded-xl p-5">
            <h3 className="font-bold text-white text-sm mb-1">
              Volume par groupe musculaire
            </h3>
            <p className="text-xs text-white/45 mb-5">
              Total kg soulevés · cliquer sur une barre pour filtrer
            </p>
            {muscleGroups.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={[...muscleGroups].sort((a, b) => b[metric] - a[metric])}
                  margin={{ top: 0, right: 5, bottom: 0, left: 0 }}
                  barSize={28}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: CHART_TEXT_COLOR }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: CHART_TEXT_COLOR }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={
                      metric === "volume" ? formatVolume : undefined
                    }
                  />
                  <Tooltip content={<BarTooltipContent />} />
                  <Bar
                    dataKey={metric}
                    name={METRIC_LABELS[metric]}
                    radius={[4, 4, 0, 0]}
                    fill={METRIC_COLOR[metric]}
                    fillOpacity={0.85}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-white/45 text-center py-8">
                Pas assez de données
              </p>
            )}
          </div>

          {/* ── Progression par exercice ── */}
          <div className="bg-[#181818] border-subtle rounded-xl p-5">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-white text-sm">
                  Progression par exercice
                </h3>
                {(() => {
                  if (!selectedEx || selectedEx.sessions.length < 2) {
                    return <p className="text-xs text-white/45 mt-0.5">Évolution du poids max par séance</p>;
                  }
                  const first = selectedEx.sessions[0].maxWeight;
                  const last = selectedEx.sessions[selectedEx.sessions.length - 1].maxWeight;
                  const delta = last - first;
                  const sign = delta >= 0 ? "+" : "";
                  return (
                    <p className="text-xs mt-0.5">
                      <span className="text-white/45">{first} kg → {last} kg · </span>
                      <span className={delta >= 0 ? "text-accent font-bold" : "text-red-400 font-bold"}>
                        {sign}{delta.toFixed(1)} kg
                      </span>
                    </p>
                  );
                })()}
              </div>
              {exercises.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedExercise ?? ""}
                    onChange={(e) => setSelectedExercise(e.target.value)}
                    className="appearance-none bg-white/[0.04] rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-white outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
                  >
                    {exercises.map((ex) => (
                      <option key={ex.name} value={ex.name}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none"
                  />
                </div>
              )}
            </div>
            {selectedEx && selectedEx.sessions.length >= 2 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={selectedEx.sessions}
                  margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.1)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 10, fill: CHART_TEXT_COLOR }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: CHART_TEXT_COLOR }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<LineTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="maxWeight"
                    name="Poids max (kg)"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalVolume"
                    name="Volume total (kg)"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <p className="text-xs text-white/45 text-center">Pas assez de données de progression</p>
                <p className="text-[10px] text-white/25 text-center">Active la double progression sur un programme et attends la première séance complétée.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
