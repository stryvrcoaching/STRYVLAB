"use client";

import type { ElementType } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Gauge,
  Moon,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PerformanceFeedbackPanel from "@/components/clients/PerformanceFeedbackPanel";
import type { PerformanceAnalysis } from "@/lib/performance/analyzer";
import type { PerformanceRecommendation } from "@/lib/performance/recommendations";

type Period = 7 | 30 | 90 | 0;
type Segment = "summary" | "volume" | "intensity" | "exercises";
type Mode = "essential" | "analyst";

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

interface LatestSession {
  id: string;
  sessionName: string;
  date: string;
  durationMin: number | null;
  volume: number;
  avgRpe: number | null;
  isCompleted: boolean;
}

interface PerformanceData {
  kpis: KPIs;
  timeline: TimelinePoint[];
  muscleGroups: MuscleGroup[];
  exercises: Exercise[];
  rpeTrend: RpeTrend[];
  draftSessions: number;
  latestSession: LatestSession | null;
  dataQuality: {
    hasPartialData: boolean;
    hasDrafts: boolean;
  };
}

interface PerformanceSummaryResponse {
  analysis: PerformanceAnalysis;
  recommendations: PerformanceRecommendation[];
}

interface MetricPoint {
  date: string;
  value: number;
}

interface MetricSeries {
  [fieldKey: string]: MetricPoint[];
}

const PERIOD_LABELS: Record<Period, string> = {
  7: "7 j",
  30: "30 j",
  90: "90 j",
  0: "Tout",
};

const SEGMENT_LABELS: Record<Segment, string> = {
  summary: "Synthèse",
  volume: "Volume",
  intensity: "Intensité",
  exercises: "Exercices",
};

const RECOMMENDATION_LABELS: Record<PerformanceRecommendation["type"], string> =
  {
    increase_volume: "Augmenter le volume",
    decrease_volume: "Réduire le volume",
    increase_weight: "Augmenter la charge",
    swap_exercise: "Changer d'exercice",
    add_rest_day: "Ajouter du repos",
  };

const RADAR_COLORS = {
  volume: "#1f8a65",
  sets: "#5cc9a8",
  reps: "#8ae4c8",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatVolume(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} t`;
  return `${Math.round(value)} kg`;
}

function formatPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function getSeriesLatest(series: MetricSeries | null, key: string) {
  const values = series?.[key];
  if (!values?.length) return null;
  return values[values.length - 1].value;
}

function getDeltaPercent(points: TimelinePoint[]) {
  if (points.length < 2) return null;
  const first = points[0].volume;
  const last = points[points.length - 1].volume;
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}

function buildExerciseTrend(exercise: Exercise) {
  if (exercise.sessions.length < 2) return "stable" as const;
  const first = exercise.sessions[0].maxWeight;
  const last = exercise.sessions[exercise.sessions.length - 1].maxWeight;
  if (last > first) return "up" as const;
  if (last < first) return "down" as const;
  return "stable" as const;
}

function getStatusTone(
  perf: PerformanceData,
  summary: PerformanceSummaryResponse | null,
  volumeDelta: number | null,
) {
  const highPriority = summary?.recommendations.some(
    (rec) => rec.priority === "high",
  );
  if (highPriority) {
    return {
      label: "Intervention requise",
      tone: "red",
      detail: "Un ajustement prioritaire est recommandé.",
    } as const;
  }
  if (perf.dataQuality.hasDrafts) {
    return {
      label: "Données à fiabiliser",
      tone: "amber",
      detail: "Des brouillons faussent encore la lecture terrain.",
    } as const;
  }
  if (perf.dataQuality.hasPartialData) {
    return {
      label: "Tendance émergente",
      tone: "amber",
      detail: "Il manque encore assez de séances pour conclure fermement.",
    } as const;
  }
  if (volumeDelta != null && volumeDelta < -8) {
    return {
      label: "Stagnation à investiguer",
      tone: "amber",
      detail: "La charge utile ralentit sur la période.",
    } as const;
  }
  if (volumeDelta != null && volumeDelta > 5) {
    return {
      label: "Progression en hausse",
      tone: "green",
      detail: "Le volume utile progresse avec des données propres.",
    } as const;
  }
  return {
    label: "Progression stable",
    tone: "green",
    detail: "Le client reste globalement dans sa zone de travail.",
  } as const;
}

function toneClasses(tone: "green" | "amber" | "red") {
  if (tone === "red") {
    return {
      badge: "bg-red-500/15 text-red-300 border-red-500/20",
      ring: "from-red-500/14 via-red-500/6 to-transparent",
      accent: "text-red-300",
    };
  }
  if (tone === "amber") {
    return {
      badge: "bg-amber-500/15 text-amber-300 border-amber-500/20",
      ring: "from-amber-500/14 via-amber-500/6 to-transparent",
      accent: "text-amber-300",
    };
  }
  return {
    badge: "bg-[#1f8a65]/14 text-[#7fe2bf] border-[#1f8a65]/25",
    ring: "from-[#1f8a65]/16 via-[#1f8a65]/6 to-transparent",
    accent: "text-[#7fe2bf]",
  };
}

function SectionHeader({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
        {eyebrow}
      </p>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        {detail ? <p className="text-[11px] text-white/40">{detail}</p> : null}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
          {label}
        </p>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04]">
          <Icon size={14} className="text-white/55" />
        </div>
      </div>
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/45">{detail}</p>
    </div>
  );
}

export default function PerformanceHub({
  clientId,
  refreshKey = 0,
  onFocusSessionDate,
}: {
  clientId: string;
  refreshKey?: number;
  onFocusSessionDate?: (date: string) => void;
}) {
  const [period, setPeriod] = useState<Period>(30);
  const [segment, setSegment] = useState<Segment>("summary");
  const [mode, setMode] = useState<Mode>("essential");
  const [data, setData] = useState<PerformanceData | null>(null);
  const [metricsSeries, setMetricsSeries] = useState<MetricSeries | null>(null);
  const [summary, setSummary] = useState<PerformanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("stryvr-coach-performance-mode");
    if (stored === "analyst" || stored === "essential") {
      setMode(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("stryvr-coach-performance-mode", mode);
  }, [mode]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perfRes, metricsRes, summaryRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/performance?days=${period}`),
        fetch(`/api/clients/${clientId}/metrics`),
        fetch(`/api/clients/${clientId}/performance-summary?weeks=8`),
      ]);

      if (!perfRes.ok) throw new Error(`Erreur performance (${perfRes.status})`);
      if (!summaryRes.ok) {
        throw new Error(`Erreur synthèse (${summaryRes.status})`);
      }

      const perfData: PerformanceData = await perfRes.json();
      const metricsData = await metricsRes.json().catch(() => ({ series: {} }));
      const summaryData: PerformanceSummaryResponse = await summaryRes.json();

      setData(perfData);
      setMetricsSeries(metricsData.series ?? {});
      setSummary(summaryData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setData(null);
      setSummary(null);
      setMetricsSeries(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, period, refreshKey]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const volumeDelta = useMemo(
    () => (data ? getDeltaPercent(data.timeline) : null),
    [data],
  );

  const status = useMemo(() => {
    if (!data) return null;
    return getStatusTone(data, summary, volumeDelta);
  }, [data, summary, volumeDelta]);

  const topAction = summary?.recommendations[0] ?? null;

  const topSignals = useMemo(() => {
    if (!data || !summary) return [];
    const signals: string[] = [];
    if (data.draftSessions > 0) {
      signals.push(
        `${data.draftSessions} brouillon${data.draftSessions > 1 ? "s" : ""} à nettoyer`,
      );
    }
    if (summary.recommendations[0]) {
      signals.push(summary.recommendations[0].reason);
    }
    if (data.rpeTrend.length > 0) {
      const avg =
        data.rpeTrend.reduce((sum, item) => sum + item.avgRpe, 0) /
        data.rpeTrend.length;
      if (avg >= 8.5) signals.push("Intensité élevée sur la période.");
      else if (avg <= 6.5) signals.push("Marge d'effort encore large sur plusieurs séances.");
    }
    if (signals.length === 0) {
      signals.push("Programme OK, aucune recommandation urgente.");
    }
    return signals.slice(0, 3);
  }, [data, summary]);

  const proteinPerKg = useMemo(() => {
    const protein = getSeriesLatest(metricsSeries, "protein_g");
    const weight = getSeriesLatest(metricsSeries, "weight_kg");
    if (!protein || !weight) return null;
    return protein / weight;
  }, [metricsSeries]);

  const latestSleep = getSeriesLatest(metricsSeries, "sleep_hours");
  const latestEnergy = getSeriesLatest(metricsSeries, "energy_level");

  const chartMetric =
    segment === "volume" && mode === "analyst"
      ? {
          key: "sets" as const,
          label: "Séries",
          color: "#5cc9a8",
        }
      : {
          key: "volume" as const,
          label: "Volume",
          color: "#1f8a65",
        };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-52 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data || !status) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-950/10 px-5 py-5">
        <p className="text-sm font-semibold text-white">Performance indisponible</p>
        <p className="mt-1 text-[12px] text-red-200/75">
          {error ?? "Impossible de charger les données de performance."}
        </p>
      </div>
    );
  }

  const tone = toneClasses(status.tone);
  const radarData = data.muscleGroups.map((group) => ({
    name: group.name,
    volume:
      Math.round(
        (group.volume / Math.max(...data.muscleGroups.map((item) => item.volume), 1)) *
          100,
      ) || 0,
    sets:
      Math.round(
        (group.sets / Math.max(...data.muscleGroups.map((item) => item.sets), 1)) *
          100,
      ) || 0,
    reps:
      Math.round(
        (group.reps / Math.max(...data.muscleGroups.map((item) => item.reps), 1)) *
          100,
      ) || 0,
  }));

  return (
    <div className="space-y-6">
      <section
        className={`relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-gradient-to-br ${tone.ring} bg-[#181818] p-5 md:p-6`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_40%)]" />
        <div className="relative space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-3 max-w-3xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${tone.badge}`}
                >
                  {status.label}
                </span>
                {data.dataQuality.hasPartialData ? (
                  <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                    Données partielles
                  </span>
                ) : null}
                {data.draftSessions > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-amber-500/15 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                    Brouillons détectés
                  </span>
                ) : null}
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/35">
                  Pulse
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-white md:text-[30px] md:leading-[1.15]">
                  {status.detail}
                </h1>
                <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-white/55">
                  {volumeDelta != null
                    ? `${formatPercent(volumeDelta)} de volume utile sur la période sélectionnée. `
                    : "Pas encore assez de recul pour quantifier une tendance robuste. "}
                  {summary?.analysis.global_overreaching
                    ? "Le moteur détecte des signes de surcharge sur plusieurs mouvements."
                    : "La lecture priorise d'abord le verdict, puis les preuves si vous creusez."}
                </p>
              </div>
            </div>

            <div className="min-w-[260px] rounded-2xl border border-white/[0.06] bg-black/15 p-4 backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                Prochaine action
              </p>
              {topAction ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-semibold text-white">
                    {RECOMMENDATION_LABELS[topAction.type]}
                  </p>
                  <p className="text-[12px] leading-relaxed text-white/55">
                    {topAction.exercise_name !== "Programme global"
                      ? `${topAction.exercise_name} · ${topAction.reason}`
                      : topAction.reason}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-[12px] leading-relaxed text-white/55">
                  Aucun ajustement urgent. Le programme reste cohérent sur les signaux disponibles.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatTile
              label="Dernière séance"
              value={
                data.latestSession
                  ? `${data.latestSession.sessionName}`
                  : "Aucune séance"
              }
              detail={
                data.latestSession
                  ? `${formatLongDate(data.latestSession.date)} · ${data.latestSession.durationMin ?? "—"} min · ${formatVolume(data.latestSession.volume)}`
                  : "Le client doit commencer à enregistrer ses séances."
              }
              icon={Dumbbell}
            />
            <StatTile
              label="Séances validées"
              value={`${data.kpis.completedSessions}`}
              detail={`${data.draftSessions} brouillon${data.draftSessions > 1 ? "s" : ""} · ${data.kpis.totalSets} séries effectives sur la période`}
              icon={CheckCircle2}
            />
            <StatTile
              label="Intensité moyenne"
              value={
                data.rpeTrend.length > 0
                  ? `RPE ${(
                      data.rpeTrend.reduce((sum, item) => sum + item.avgRpe, 0) /
                      data.rpeTrend.length
                    ).toFixed(1)}`
                  : "—"
              }
              detail={
                data.latestSession?.avgRpe != null
                  ? `Dernière séance à RPE ${data.latestSession.avgRpe.toFixed(1)}`
                  : "RIR/RPE encore insuffisants pour une lecture fine."
              }
              icon={Gauge}
            />
          </div>

          {summary?.recommendations.length ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <PerformanceFeedbackPanel clientId={clientId} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4 md:p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SectionHeader
            eyebrow="Entraînement"
            title="Lecture coach"
            detail="Vue essentielle par défaut, profondeur analytique à la demande."
          />
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setMode("essential")}
              className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${
                mode === "essential"
                  ? "bg-accent text-white"
                  : "text-white/45 hover:text-white"
              }`}
            >
              Essentiel
            </button>
            <button
              type="button"
              onClick={() => setMode("analyst")}
              className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${
                mode === "analyst"
                  ? "bg-accent text-white"
                  : "text-white/45 hover:text-white"
              }`}
            >
              Analyste
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-1">
            {([7, 30, 90, 0] as Period[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${
                  period === value
                    ? "bg-accent text-white"
                    : "text-white/45 hover:text-white"
                }`}
              >
                {PERIOD_LABELS[value]}
              </button>
            ))}
          </div>

          <Tabs value={segment} onValueChange={(value) => setSegment(value as Segment)}>
            <TabsList className="flex-wrap gap-2">
              {(Object.keys(SEGMENT_LABELS) as Segment[]).map((value) => (
                <TabsTrigger key={value} value={value}>
                  {SEGMENT_LABELS[value]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <Tabs value={segment} onValueChange={(value) => setSegment(value as Segment)} className="mt-5">
          <TabsContent value="summary" className="!mt-0">
            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Tendance volume
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-white">
                      Charge utile sur la période
                    </h3>
                  </div>
                  <p className={`text-sm font-semibold ${tone.accent}`}>
                    {volumeDelta != null ? formatPercent(volumeDelta) : "—"}
                  </p>
                </div>
                <div className="mt-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.timeline}
                      onClick={(state: any) => {
                        const date = state?.activeLabel;
                        if (date) onFocusSessionDate?.(date);
                      }}
                    >
                      <defs>
                        <linearGradient id="summaryVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1f8a65" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#1f8a65" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#181818",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 12,
                        }}
                        labelFormatter={(value) => formatLongDate(String(value))}
                        formatter={(value: number) => [formatVolume(value), "Volume"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="volume"
                        stroke="#1f8a65"
                        strokeWidth={2}
                        fill="url(#summaryVolume)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    Signaux prioritaires
                  </p>
                  <div className="mt-3 space-y-3">
                    {topSignals.map((signal, index) => (
                      <div
                        key={`${signal}-${index}`}
                        className="flex items-start gap-3 rounded-xl bg-white/[0.03] px-3 py-3"
                      >
                        <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.05]">
                          {index === 0 ? (
                            <Sparkles size={12} className="text-accent" />
                          ) : index === 1 ? (
                            <Target size={12} className="text-white/60" />
                          ) : (
                            <AlertTriangle size={12} className="text-white/60" />
                          )}
                        </div>
                        <p className="text-[12px] leading-relaxed text-white/65">
                          {signal}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    Focus séance
                  </p>
                  {data.latestSession ? (
                    <button
                      type="button"
                      onClick={() => onFocusSessionDate?.(data.latestSession!.date)}
                      className="mt-3 flex w-full items-center justify-between rounded-xl bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.05]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {data.latestSession.sessionName}
                        </p>
                        <p className="mt-1 text-[11px] text-white/45">
                          {formatLongDate(data.latestSession.date)}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-white/35" />
                    </button>
                  ) : (
                    <p className="mt-3 text-[12px] text-white/45">
                      Aucune séance récente à ouvrir.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="volume" className="!mt-0">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Timeline
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-white">
                      {chartMetric.label} par séance
                    </h3>
                  </div>
                  <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
                    Clic graphique → historique
                  </span>
                </div>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.timeline}
                      onClick={(state: any) => {
                        const date = state?.activeLabel;
                        if (date) onFocusSessionDate?.(date);
                      }}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#181818",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 12,
                        }}
                        labelFormatter={(value) => formatLongDate(String(value))}
                      />
                      <Bar
                        dataKey={chartMetric.key}
                        fill={chartMetric.color}
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    Répartition
                  </p>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.muscleGroups} layout="vertical">
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={72}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#181818",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 12,
                          }}
                        />
                        <Bar dataKey="volume" fill="#1f8a65" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {mode === "analyst" ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Radar analyste
                    </p>
                    <div className="mt-3 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="rgba(255,255,255,0.08)" />
                          <PolarAngleAxis
                            dataKey="name"
                            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                          />
                          <PolarRadiusAxis
                            tick={false}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Radar
                            dataKey="volume"
                            stroke={RADAR_COLORS.volume}
                            fill={RADAR_COLORS.volume}
                            fillOpacity={0.18}
                          />
                          <Radar
                            dataKey="sets"
                            stroke={RADAR_COLORS.sets}
                            fill={RADAR_COLORS.sets}
                            fillOpacity={0.1}
                          />
                          <Radar
                            dataKey="reps"
                            stroke={RADAR_COLORS.reps}
                            fill={RADAR_COLORS.reps}
                            fillOpacity={0.08}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="intensity" className="!mt-0">
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      RPE / RIR
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-white">
                      Intensité par séance
                    </h3>
                  </div>
                  <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
                    Zone cible hypertrophie: RPE 7–9
                  </span>
                </div>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.rpeTrend}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 10]}
                        tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#181818",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 12,
                        }}
                        labelFormatter={(value) => formatLongDate(String(value))}
                        formatter={(value: number) => [`RPE ${value.toFixed(1)}`, "Intensité"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgRpe"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#f59e0b" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    Pont récupération
                  </p>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Moon size={14} className="text-white/55" />
                        <span className="text-[12px] text-white/60">Sommeil</span>
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {latestSleep != null ? `${latestSleep.toFixed(1)} h` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Brain size={14} className="text-white/55" />
                        <span className="text-[12px] text-white/60">Énergie</span>
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {latestEnergy != null ? latestEnergy.toFixed(1) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-white/55" />
                        <span className="text-[12px] text-white/60">Protéines/kg</span>
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {proteinPerKg != null ? proteinPerKg.toFixed(1) : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    Lecture coach
                  </p>
                  <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-white/60">
                    <p>
                      Une intensité qui reste durablement sous RPE 7 suggère souvent un
                      besoin d'augmenter la charge ou la densité.
                    </p>
                    <p>
                      Une intensité au-dessus de RPE 9 avec baisse du sommeil ou de l'énergie
                      mérite plutôt de réduire le stress d'entraînement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="exercises" className="!mt-0">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.exercises.map((exercise) => {
                const latest = exercise.sessions[exercise.sessions.length - 1];
                const trend = buildExerciseTrend(exercise);
                return (
                  <div
                    key={exercise.name}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{exercise.name}</p>
                        <p className="mt-1 text-[11px] text-white/45">
                          {exercise.sessions.length} séance
                          {exercise.sessions.length > 1 ? "s" : ""} suivie
                          {exercise.sessions.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                          trend === "up"
                            ? "bg-[#1f8a65]/14 text-[#7fe2bf]"
                            : trend === "down"
                              ? "bg-red-500/14 text-red-300"
                              : "bg-white/[0.06] text-white/45"
                        }`}
                      >
                        {trend === "up" ? (
                          <TrendingUp size={11} />
                        ) : trend === "down" ? (
                          <TrendingDown size={11} />
                        ) : (
                          <ArrowRight size={11} />
                        )}
                        {trend === "up"
                          ? "Hausse"
                          : trend === "down"
                            ? "Baisse"
                            : "Stable"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/[0.03] px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                          Charge max
                        </p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {latest ? `${latest.maxWeight} kg` : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/[0.03] px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                          Volume
                        </p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {latest ? formatVolume(latest.totalVolume) : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={exercise.sessions}>
                          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={formatDate}
                            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{
                              background: "#181818",
                              border: "1px solid rgba(255,255,255,0.06)",
                              borderRadius: 12,
                            }}
                            labelFormatter={(value) => formatLongDate(String(value))}
                          />
                          <Line
                            type="monotone"
                            dataKey="maxWeight"
                            stroke="#1f8a65"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {mode === "analyst" ? (
                      <div className="mt-3 rounded-xl bg-white/[0.03] px-3 py-3 text-[11px] text-white/55">
                        {latest
                          ? `${latest.sets} sets · ${latest.totalReps} reps sur la dernière exposition`
                          : "Pas encore assez de données pour ce mouvement."}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
