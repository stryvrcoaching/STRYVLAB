"use client";

import type { ElementType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Gauge,
  Moon,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformanceAnalysis } from "@/lib/performance/analyzer";
import type { PerformanceRecommendation } from "@/lib/performance/recommendations";
import { resolveCanonicalExerciseName } from "@/lib/training/exerciseHistoryKey";

type Period = 7 | 30 | 90 | 0;
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

interface NutritionTrendPoint {
  date: string;
  consumed: {
    protein_g: number;
  };
}

interface NutritionHubResponse {
  trend?: {
    points?: NutritionTrendPoint[];
  };
}

interface FatiguePoint {
  date: string;
  fatigue: number;
  toleranceLow: number;
  toleranceHigh: number;
  toleranceRange: number;
  recovery: number;
  sleep: number | null;
  energy: number | null;
  volume: number;
  rpe: number | null;
}

const RECOMMENDATION_LABELS: Record<PerformanceRecommendation["type"], string> =
  {
    increase_volume: "Augmenter le volume",
    decrease_volume: "Réduire le volume",
    increase_weight: "Augmenter la charge",
    swap_exercise: "Changer d'exercice",
    add_rest_day: "Ajouter du repos",
  };

const MUSCLE_GROUP_LABELS: Record<string, string> = {
  // Abdominaux / Core
  rectus_abdominis: "Grand droit",
  lower_abs: "Abdominaux inférieurs",
  abs: "Abdominaux",
  abdominals: "Abdominaux",
  obliques: "Obliques",
  transverse_abdominis: "Transverse",
  core: "Sangle abdominale",
  core_global: "Sangle abdominale",

  // Fessiers
  gluteus_maximus: "Grand fessier",
  gluteus_medius: "Moyen fessier",
  gluteus_minimus: "Petit fessier",
  glutes: "Fessiers",
  fessiers: "Fessiers",

  // Dos
  erector_spinae: "Érecteurs du rachis",
  spine_erector: "Érecteurs du rachis",
  spinal_erectors: "Érecteurs du rachis",
  spine_erectors: "Érecteurs du rachis",
  erecteurs_rachis: "Érecteurs du rachis",
  lats: "Grand dorsal",
  latissimus_dorsi: "Grand dorsal",
  grand_dorsal: "Grand dorsal",
  upper_back: "Dos supérieur",
  dos_superieur: "Dos supérieur",
  rhomboids: "Rhomboïdes",
  rhomboides: "Rhomboïdes",
  traps: "Trapèzes",
  trapezius: "Trapèzes",
  trapeze: "Trapèzes",
  trapezius_upper: "Trapèze supérieur",
  trapezius_middle: "Trapèze moyen",
  trapezius_lower: "Trapèze inférieur",
  upper_traps: "Trapèze supérieur",
  dos: "Dos",

  // Ischio-jambiers
  hamstrings: "Ischio-jambiers",
  "ischio-jambiers": "Ischio-jambiers",
  ischio_jambiers: "Ischio-jambiers",
  biceps_femoris: "Biceps fémoral",
  biceps_femoral: "Biceps fémoral",
  semimembranosus: "Semi-membraneux",
  semitendinosus: "Semi-tendineux",

  // Quadriceps
  quadriceps: "Quadriceps",
  rectus_femoris: "Droit fémoral",
  droit_femoral: "Droit fémoral",
  vastus_lateralis: "Vaste latéral",
  vaste_lateral: "Vaste latéral",
  vastus_medialis: "Vaste médial",
  vaste_medial: "Vaste médial",

  // Mollets
  calves: "Mollets",
  mollets: "Mollets",
  gastrocnemius: "Gastrocnémien",
  gastrocnemien: "Gastrocnémien",
  soleus: "Soléaire",
  soleaire: "Soléaire",

  // Pectoraux
  chest: "Pectoraux",
  pectorals: "Pectoraux",
  pectoraux: "Pectoraux",
  pectoralis_major: "Grand pectoral",
  grand_pectoral: "Grand pectoral",
  pectoralis_major_upper: "Grand pectoral (chef sup.)",
  grand_pectoral_sup: "Grand pectoral (chef sup.)",
  pectoralis_major_lower: "Grand pectoral (chef inf.)",
  grand_pectoral_inf: "Grand pectoral (chef inf.)",
  pectoralis_minor: "Petit pectoral",
  petit_pectoral: "Petit pectoral",

  // Épaules
  shoulders: "Épaules",
  deltoids: "Deltoïdes",
  epaules: "Épaules",
  deltoid_anterior: "Deltoïde antérieur",
  deltoid_lateral: "Deltoïde latéral",
  deltoid_posterior: "Deltoïde postérieur",
  anterior_deltoid: "Deltoïde antérieur",
  medial_deltoid: "Deltoïde latéral",
  posterior_deltoid: "Deltoïde postérieur",
  deltoide_anterieur: "Deltoïde antérieur",
  deltoide_lateral: "Deltoïde latéral",
  deltoide_posterieur: "Deltoïde postérieur",
  rotator_cuff: "Coiffe des rotateurs",
  coiffe_rotateurs: "Coiffe des rotateurs",
  subscapularis: "Subscapulaire",
  subscapulaire: "Subscapulaire",

  // Bras
  biceps: "Biceps",
  biceps_brachii: "Biceps",
  triceps: "Triceps",
  triceps_brachii: "Triceps",
  brachialis: "Brachial antérieur",
  brachial_anterieur: "Brachial antérieur",
  brachioradialis: "Brachio-radial",
  brachio_radial: "Brachio-radial",
  forearms: "Avant-bras",
  "avant-bras": "Avant-bras",
  avant_bras: "Avant-bras",

  // Adducteurs / Abducteurs
  adductors: "Adducteurs",
  adducteurs: "Adducteurs",
  abductors: "Abducteurs",
  abducteurs: "Abducteurs",
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

function formatDeltaPercent(value: number | null) {
  if (value == null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatSignedNumber(value: number | null, suffix = "") {
  if (value == null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}${suffix}`;
}

function formatMuscleGroupLabel(name: string) {
  const normalized = name.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (MUSCLE_GROUP_LABELS[normalized]) {
    return MUSCLE_GROUP_LABELS[normalized];
  }

  return name
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (MUSCLE_GROUP_LABELS[lower]) return MUSCLE_GROUP_LABELS[lower];
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function getSeriesLatest(series: MetricSeries | null, key: string) {
  const values = series?.[key];
  if (!values?.length) return null;
  return values[values.length - 1].value;
}

function getSeriesAverage(series: MetricSeries | null, key: string) {
  const values = series?.[key] ?? [];
  if (!values.length) return null;
  return values.reduce((sum, point) => sum + point.value, 0) / values.length;
}

function getSeriesValueAtOrBefore(
  series: MetricSeries | null,
  key: string,
  date: string,
) {
  const values = series?.[key] ?? [];
  if (!values.length) return null;

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const point = values[index];
    if (point.date <= date) return point.value;
  }

  return values[values.length - 1]?.value ?? null;
}

function getSeriesLatestAny(series: MetricSeries | null, keys: string[]) {
  for (const key of keys) {
    const value = getSeriesLatest(series, key);
    if (value != null) return value;
  }
  return null;
}

function getSeriesAverageAny(series: MetricSeries | null, keys: string[]) {
  for (const key of keys) {
    const value = getSeriesAverage(series, key);
    if (value != null) return value;
  }
  return null;
}

function getDeltaPercent(points: TimelinePoint[]) {
  if (points.length < 2) return null;
  const first = points[0].volume;
  const last = points[points.length - 1].volume;
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}

function getVolumeStats(points: TimelinePoint[]) {
  if (!points.length) {
    return { average: null, peak: null, total: 0, consistency: null };
  }
  const volumes = points.map((item) => item.volume);
  const total = volumes.reduce((sum, item) => sum + item, 0);
  const average = total / volumes.length;
  const peak = Math.max(...volumes);
  const positiveDays = volumes.filter((item) => item > 0).length;
  const consistency = positiveDays / volumes.length;
  return { average, peak, total, consistency };
}

function getIntensityStats(points: RpeTrend[]) {
  if (!points.length) return { average: null, peak: null };
  const avg =
    points.reduce((sum, item) => sum + item.avgRpe, 0) / points.length;
  return { average: avg, peak: Math.max(...points.map((item) => item.avgRpe)) };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function buildDailyMetricMap(
  series: MetricSeries | null,
  keys: string[],
) {
  const map = new Map<string, number>();
  for (const key of keys) {
    for (const point of series?.[key] ?? []) {
      if (!map.has(point.date)) {
        map.set(point.date, point.value);
      }
    }
  }
  return map;
}

function buildFatigueSeries(
  timeline: TimelinePoint[],
  rpeTrend: RpeTrend[],
  metricsSeries: MetricSeries | null,
) {
  if (!timeline.length) {
    return {
      points: [] as FatiguePoint[],
      average: null as number | null,
      inZoneRate: null as number | null,
      alertCount: 0,
      regularityLabel: "—",
    };
  }

  const sleepByDate = buildDailyMetricMap(metricsSeries, [
    "sleep_duration_h",
    "sleep_hours",
  ]);
  const energyByDate = buildDailyMetricMap(metricsSeries, ["energy_level"]);
  const rpeByDate = new Map(rpeTrend.map((point) => [point.date, point.avgRpe]));

  const volumes = timeline.map((point) => point.volume);
  const maxVolume = Math.max(...volumes, 1);
  const positiveVolumes = volumes.filter((value) => value > 0);
  const avgVolume =
    positiveVolumes.length > 0
      ? positiveVolumes.reduce((sum, value) => sum + value, 0) /
        positiveVolumes.length
      : 1;

  const rollingPositiveAverage = (index: number) => {
    const window = timeline
      .slice(Math.max(0, index - 3), index + 1)
      .map((item) => item.volume)
      .filter((value) => value > 0);

    if (!window.length) return avgVolume;
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  };

  const points: FatiguePoint[] = [];

  for (const [index, point] of timeline.entries()) {
    const sleep = sleepByDate.get(point.date) ?? null;
    const energy = energyByDate.get(point.date) ?? null;
    const rpe = rpeByDate.get(point.date) ?? null;
    const localVolumeBaseline = rollingPositiveAverage(index);
    const loadRatio =
      localVolumeBaseline > 0 ? point.volume / localVolumeBaseline : 1;
    const volumeDeviation = avgVolume > 0 ? point.volume / avgVolume : 1;

    const volumeScore = normalize(point.volume, 0, maxVolume);
    const loadScore = normalize(loadRatio, 0.75, 1.45);
    const deviationScore = normalize(volumeDeviation, 0.65, 1.55);
    const rpeScore = rpe != null ? normalize(rpe, 6, 9.8) : 0.46;
    const sleepPenalty =
      sleep != null ? 1 - normalize(sleep, 5.5, 9) : 0.32;
    const energyPenalty =
      energy != null ? 1 - normalize(energy, 1, 5) : 0.34;

    const fatigue = Math.round(
      (volumeScore * 0.22 +
        loadScore * 0.28 +
        deviationScore * 0.16 +
        rpeScore * 0.2 +
        sleepPenalty * 0.08 +
        energyPenalty * 0.06) *
        100,
    );

    const recovery =
      sleep != null || energy != null
        ? ((sleep != null ? normalize(sleep, 5.5, 9) : 0.5) +
            (energy != null ? normalize(energy, 1, 5) : 0.5)) /
          (sleep != null && energy != null ? 2 : 1)
        : 0.5;

    const previousFatigue =
      index > 0 ? points[index - 1]?.fatigue ?? fatigue : fatigue;
    const toleranceMid = clamp(previousFatigue * 0.45 + recovery * 42 + 18, 38, 74);
    const toleranceSpread = clamp(14 - recovery * 5, 8, 14);

    const toleranceLow = Math.round(clamp(toleranceMid - toleranceSpread, 22, 72));
    const toleranceHigh = Math.round(
      clamp(toleranceMid + toleranceSpread, 34, 88),
    );

    points.push({
      date: point.date,
      fatigue,
      toleranceLow,
      toleranceHigh,
      toleranceRange: toleranceHigh - toleranceLow,
      recovery: Math.round(recovery * 100),
      sleep,
      energy,
      volume: point.volume,
      rpe,
    });
  }

  const average =
    points.reduce((sum, point) => sum + point.fatigue, 0) / points.length;
  const inZoneCount = points.filter(
    (point) =>
      point.fatigue >= point.toleranceLow &&
      point.fatigue <= point.toleranceHigh,
  ).length;
  const alertCount = points.filter(
    (point) => point.fatigue > point.toleranceHigh,
  ).length;

  const variance =
    points.reduce((sum, point) => sum + (point.fatigue - average) ** 2, 0) /
    points.length;
  const deviation = Math.sqrt(variance);
  const regularityLabel =
    deviation <= 8
      ? "Stable"
      : deviation <= 14
        ? "Variable"
        : "Irrégulier";

  return {
    points,
    average,
    inZoneRate: points.length ? inZoneCount / points.length : null,
    alertCount,
    regularityLabel,
  };
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
      badge: "border-red-500/20 bg-red-500/12 text-red-300",
      ring: "from-red-500/12 via-red-500/4 to-transparent",
      accent: "text-red-300",
      soft: "bg-red-500/10 text-red-200",
    };
  }
  if (tone === "amber") {
    return {
      badge: "border-amber-500/20 bg-amber-500/12 text-amber-300",
      ring: "from-amber-500/12 via-amber-500/4 to-transparent",
      accent: "text-amber-300",
      soft: "bg-amber-500/10 text-amber-100",
    };
  }
  return {
    badge: "border-[#1f8a65]/25 bg-[#1f8a65]/12 text-[#8ef0c7]",
    ring: "from-[#1f8a65]/14 via-[#1f8a65]/5 to-transparent",
    accent: "text-[#8ef0c7]",
    soft: "bg-[#1f8a65]/10 text-[#c9f7e6]",
  };
}

function chartLabel(value: string | number) {
  return formatLongDate(String(value));
}

function SharedTooltip({
  active,
  payload,
  label,
  footer,
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    name?: string;
    value?: number | string;
    dataKey?: string;
  }>;
  label?: string | number;
  footer?: string | null;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[220px] rounded-[20px] border border-white/[0.08] bg-[#141414]/95 px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.32)] backdrop-blur-md">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
        {label != null ? chartLabel(label) : ""}
      </p>
      <div className="mt-3 space-y-2">
        {payload.map((item) => (
          <div
            key={`${item.dataKey}-${item.name}`}
            className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.03] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color ?? "#fff" }}
              />
              <span className="text-[12px] text-white/72">{item.name}</span>
            </div>
            <span className="text-[12px] font-semibold text-white">
              {item.value}
            </span>
          </div>
        ))}
      </div>
      {footer ? (
        <div className="mt-3 rounded-full bg-white/[0.05] px-3 py-1.5 text-center text-[11px] font-semibold text-white/72">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  detail,
  right,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/38">
          {eyebrow}
        </p>
        <h2 className="text-[17px] font-semibold text-white">{title}</h2>
        {detail ? <p className="text-[12px] text-white/48">{detail}</p> : null}
      </div>
      {right}
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
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
          {label}
        </p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
          <Icon size={13} className="text-white/55" />
        </div>
      </div>
      <p className="text-[20px] font-semibold leading-none text-white">{value}</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-white/48">{detail}</p>
    </div>
  );
}

function InsightRow({
  icon: Icon,
  label,
}: {
  icon: ElementType;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] px-3 py-3">
      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.04]">
        <Icon size={13} className="text-white/60" />
      </div>
      <p className="text-[12px] leading-relaxed text-white/68">{label}</p>
    </div>
  );
}

function AnalystChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${
        active ? "bg-white text-black" : "text-white/50 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SurfaceCard({
  eyebrow,
  title,
  metric,
  detail,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  metric?: string;
  detail?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-[20px] font-semibold text-white">{title}</h3>
          {detail ? (
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/50">
              {detail}
            </p>
          ) : null}
        </div>
        {metric ? (
          <div className="rounded-full bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-white/78">
            {metric}
          </div>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
      {footer ? (
        <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function FooterMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber" | "default";
}) {
  const textClass =
    tone === "green"
      ? "text-[#8ef0c7]"
      : tone === "amber"
        ? "text-amber-300"
        : "text-white";

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/32">
        {label}
      </p>
      <p className={`text-[22px] font-semibold ${textClass}`}>{value}</p>
    </div>
  );
}

export default function PerformanceHub({
  clientId,
  period,
  refreshKey = 0,
  onFocusSessionDate,
}: {
  clientId: string;
  period: Period;
  refreshKey?: number;
  onFocusSessionDate?: (date: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("essential");
  const [data, setData] = useState<PerformanceData | null>(null);
  const [metricsSeries, setMetricsSeries] = useState<MetricSeries | null>(null);
  const [nutritionTrend, setNutritionTrend] = useState<NutritionTrendPoint[]>([]);
  const [summary, setSummary] = useState<PerformanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllMuscles, setShowAllMuscles] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("stryvr-coach-performance-mode");
    if (stored === "analyst" || stored === "essential") {
      setMode(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("stryvr-coach-performance-mode", mode);
  }, [mode]);

  const nutritionWindow = useMemo(() => {
    if (period === 7) return 7;
    if (period === 30) return 30;
    return 30;
  }, [period]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perfRes, metricsRes, summaryRes, nutritionRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/performance?days=${period}`),
        fetch(`/api/clients/${clientId}/metrics`),
        fetch(`/api/clients/${clientId}/performance-summary?weeks=8`),
        fetch(`/api/clients/${clientId}/nutrition-hub?window=${nutritionWindow}`),
      ]);

      if (!perfRes.ok) throw new Error(`Erreur performance (${perfRes.status})`);
      const perfData: PerformanceData = await perfRes.json();
      const metricsData = await metricsRes.json().catch(() => ({ series: {} }));
      const summaryData: PerformanceSummaryResponse | null = summaryRes.ok
        ? await summaryRes.json()
        : null;
      const nutritionData: NutritionHubResponse = nutritionRes.ok
        ? await nutritionRes.json()
        : {};

      setData(perfData);
      setMetricsSeries(metricsData.series ?? {});
      setNutritionTrend(nutritionData.trend?.points ?? []);
      setSummary(summaryData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setData(null);
      setSummary(null);
      setMetricsSeries(null);
      setNutritionTrend([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, nutritionWindow, period]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshKey]);

  const volumeDelta = useMemo(
    () => (data ? getDeltaPercent(data.timeline) : null),
    [data],
  );

  const volumeStats = useMemo(
    () => getVolumeStats(data?.timeline ?? []),
    [data],
  );

  const intensityStats = useMemo(
    () => getIntensityStats(data?.rpeTrend ?? []),
    [data],
  );

  const fatigueStats = useMemo(
    () =>
      buildFatigueSeries(
        data?.timeline ?? [],
        data?.rpeTrend ?? [],
        metricsSeries,
      ),
    [data, metricsSeries],
  );

  const status = useMemo(() => {
    if (!data) return null;
    return getStatusTone(data, summary, volumeDelta);
  }, [data, summary, volumeDelta]);

  const tone = toneClasses(status?.tone ?? "green");
  const topAction = summary?.recommendations[0] ?? null;

  const topSignals = useMemo(() => {
    if (!data || !summary) return [];
    const signals: string[] = [];

    if (data.draftSessions > 0) {
      signals.push(
        `${data.draftSessions} brouillon${data.draftSessions > 1 ? "s" : ""} à nettoyer avant lecture ferme.`,
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
      else if (avg <= 6.5) {
        signals.push("Marge d'effort encore large sur plusieurs séances.");
      }
    }
    if (signals.length === 0) {
      signals.push("Programme cohérent, aucun signal critique détecté.");
    }
    return signals.slice(0, 3);
  }, [data, summary]);

  const latestProteinEntry = useMemo(
    () =>
      [...nutritionTrend]
        .reverse()
        .find((point) => Number(point.consumed?.protein_g ?? 0) > 0) ?? null,
    [nutritionTrend],
  );

  const proteinPerKg = useMemo(() => {
    const protein = latestProteinEntry?.consumed?.protein_g ?? null;
    const weight =
      latestProteinEntry != null
        ? getSeriesValueAtOrBefore(
            metricsSeries,
            "weight_kg",
            latestProteinEntry.date,
          )
        : getSeriesLatestAny(metricsSeries, ["weight_kg"]);
    if (!protein || !weight) return null;
    return protein / weight;
  }, [latestProteinEntry, metricsSeries]);

  const latestSleep = getSeriesLatestAny(metricsSeries, [
    "sleep_duration_h",
    "sleep_hours",
  ]);
  const latestEnergy = getSeriesLatestAny(metricsSeries, ["energy_level"]);
  const avgSleep = getSeriesAverageAny(metricsSeries, [
    "sleep_duration_h",
    "sleep_hours",
  ]);
  const avgEnergy = getSeriesAverageAny(metricsSeries, ["energy_level"]);

  const recoveryCoachNotes = useMemo(() => {
    const notes: string[] = [];

    if (intensityStats.average != null) {
      if (intensityStats.average >= 8.8) {
        notes.push("L'intensité moyenne est haute sur la fenêtre. Priorité à la qualité de récupération entre les grosses séances.");
      } else if (intensityStats.average <= 7) {
        notes.push("L'effort moyen reste modéré. Il reste probablement de la marge de charge ou de densité sur plusieurs mouvements.");
      } else {
        notes.push("L'intensité moyenne reste dans une zone productive, sans dérive nette à ce stade.");
      }
    }

    if (fatigueStats.inZoneRate != null) {
      if (fatigueStats.inZoneRate < 0.5) {
        notes.push("La fatigue sort souvent de la zone de tolérance. La semaine mérite une lecture plus prudente sur les exercices clés.");
      } else if (fatigueStats.alertCount === 0) {
        notes.push("La contrainte observée reste bien absorbée sur la majorité de la fenêtre.");
      }
    }

    if (avgSleep != null && avgSleep < 6.5) {
      notes.push("Le sommeil moyen est bas sur la fenêtre. Toute hausse de charge doit rester ciblée.");
    }

    if (avgEnergy != null && avgEnergy <= 2.5) {
      notes.push("L'énergie reportée est basse. Il faut privilégier l'exécution propre avant d'ajouter du stress d'entraînement.");
    }

    if (proteinPerKg != null && proteinPerKg < 1.6) {
      notes.push("L'apport protéique ramené au poids reste bas pour soutenir pleinement l'adaptation.");
    } else if (proteinPerKg != null && proteinPerKg >= 1.8) {
      notes.push("Le ratio protéines/poids soutient correctement la récupération sur cette fenêtre.");
    }

    if (notes.length === 0) {
      notes.push("Lecture croisée stable: ni signal de surcharge net, ni déficit évident de récupération sur la fenêtre.");
    }

    return notes.slice(0, 3);
  }, [avgEnergy, avgSleep, fatigueStats.alertCount, fatigueStats.inZoneRate, intensityStats.average, proteinPerKg]);

  const sortedMuscleGroups = useMemo(() => {
    return [...(data?.muscleGroups ?? [])].sort((a, b) => b.volume - a.volume);
  }, [data]);

  const visibleMuscleGroups = useMemo(() => {
    if (showAllMuscles) return sortedMuscleGroups;
    return sortedMuscleGroups.slice(0, 8);
  }, [showAllMuscles, sortedMuscleGroups]);

  const maxMuscleVolume = sortedMuscleGroups[0]?.volume ?? 1;

  const watchedExercises = useMemo(() => {
    if (!data) return [];

    return [...data.exercises]
      .map((exercise) => {
        const latest = exercise.sessions[exercise.sessions.length - 1] ?? null;
        const first = exercise.sessions[0] ?? null;
        const trend = buildExerciseTrend(exercise);
        const weightDelta =
          latest && first ? latest.maxWeight - first.maxWeight : 0;
        const canonicalExerciseName = resolveCanonicalExerciseName(exercise.name);
        const relatedRecommendation = summary?.recommendations.find(
          (item) => resolveCanonicalExerciseName(item.exercise_name) === canonicalExerciseName,
        );

        return {
          exercise,
          latest,
          trend,
          weightDelta,
          recommendation: relatedRecommendation,
          priorityScore:
            (relatedRecommendation?.priority === "high"
              ? 30
              : relatedRecommendation?.priority === "medium"
                ? 20
                : 0) +
            (trend === "down" ? 12 : trend === "stable" ? 4 : 0) +
            exercise.sessions.length,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 4);
  }, [data, summary]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 w-full rounded-[28px]" />
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-[360px] rounded-[28px]" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-[320px] rounded-[28px]" />
          <Skeleton className="h-[320px] rounded-[28px]" />
        </div>
      </div>
    );
  }

  if (error || !data || !status) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-950/10 px-5 py-5">
        <p className="text-sm font-semibold text-white">Performance indisponible</p>
        <p className="mt-1 text-[12px] text-red-200/75">
          {error ?? "Impossible de charger les données de performance."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        className={`relative overflow-hidden rounded-[30px] border border-white/[0.06] bg-[#181818] shadow-[0_18px_48px_rgba(0,0,0,0.22)]`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${tone.ring}`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_38%)]" />
        <div className="relative p-5 md:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${tone.badge}`}
                >
                  {status.label}
                </span>
                {data.dataQuality.hasPartialData ? (
                  <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/52">
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
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                  Performance
                </p>
                <h1 className="mt-2 text-[24px] font-semibold leading-[1.12] text-white sm:text-[28px] md:text-[32px]">
                  {status.detail}
                </h1>
                <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/58">
                  {volumeDelta != null
                    ? `${formatDeltaPercent(volumeDelta)} de charge utile sur la fenêtre active. `
                    : "La période reste encore trop courte pour établir une vraie tendance. "}
                  {summary?.analysis.global_overreaching
                    ? "Le moteur détecte aussi des signes de surcharge sur plusieurs mouvements."
                    : "Le client reste globalement dans une zone de travail cohérente."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-black/20 p-1">
              <AnalystChip
                active={mode === "essential"}
                onClick={() => setMode("essential")}
              >
                Essentiel
              </AnalystChip>
              <AnalystChip
                active={mode === "analyst"}
                onClick={() => setMode("analyst")}
              >
                Analyste
              </AnalystChip>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-3 md:grid-cols-3">
              <StatTile
                label="Séances validées"
                value={`${data.kpis.completedSessions}`}
                detail={`${data.kpis.totalSets} séries effectives · ${data.draftSessions} brouillon${data.draftSessions > 1 ? "s" : ""}`}
                icon={CheckCircle2}
              />
              <StatTile
                label="Volume utile"
                value={formatVolume(volumeStats.total)}
                detail={`Moyenne ${volumeStats.average != null ? formatVolume(volumeStats.average) : "—"} par séance`}
                icon={Activity}
              />
              <StatTile
                label="Intensité moyenne"
                value={
                  intensityStats.average != null
                    ? `RPE ${intensityStats.average.toFixed(1)}`
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

            <div className="rounded-[24px] border border-white/[0.06] bg-black/18 p-4 backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                Prochaine action
              </p>
              {topAction ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[16px] font-semibold text-white">
                      {RECOMMENDATION_LABELS[topAction.type]}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/55">
                      {topAction.exercise_name !== "Programme global"
                        ? `${topAction.exercise_name} · ${topAction.reason}`
                        : topAction.reason}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {topSignals.map((signal, index) => (
                      <InsightRow
                        key={`${signal}-${index}`}
                        icon={
                          index === 0
                            ? Sparkles
                            : index === 1
                              ? Target
                              : AlertTriangle
                        }
                        label={signal}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {topSignals.map((signal, index) => (
                    <InsightRow
                      key={`${signal}-${index}`}
                      icon={index === 0 ? Sparkles : Target}
                      label={signal}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Zone analytique"
          title="Analyse de la période"
          detail="Charge, répartition et intensité sur la fenêtre active."
        />

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <SurfaceCard
            eyebrow="Charge"
            title="Surcharge et fatigue"
            metric={
              fatigueStats.average != null
                ? `${Math.round(fatigueStats.average)}/100`
                : "—"
            }
            detail="Croise volume utile, intensité terrain, sommeil et énergie pour montrer la contrainte réellement absorbée."
            footer={
              <>
                <FooterMetric
                  label="Tolérance"
                  value={
                    fatigueStats.inZoneRate != null
                      ? `${Math.round(fatigueStats.inZoneRate * 100)}%`
                      : "—"
                  }
                />
                <FooterMetric
                  label="Alertes"
                  value={`${fatigueStats.alertCount}`}
                  tone={fatigueStats.alertCount > 0 ? "amber" : "green"}
                />
                <FooterMetric
                  label="Régularité"
                  value={fatigueStats.regularityLabel}
                />
              </>
            }
          >
            <div className="h-[220px] sm:h-[250px] lg:h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={fatigueStats.points}
                  onClick={(state: { activeLabel?: string }) => {
                    if (state?.activeLabel) onFocusSessionDate?.(state.activeLabel);
                  }}
                >
                  <defs>
                    <linearGradient id="fatigueToleranceBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f3c74d" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#f3c74d" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="fatigueObservedArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6ea8ff" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#6ea8ff" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.14)", strokeDasharray: "4 4" }}
                    content={({ active, label }) => {
                      const point = fatigueStats.points.find(
                        (item) => item.date === label,
                      );
                      if (!point) return null;

                      return (
                        <SharedTooltip
                          active={active}
                          label={label}
                          payload={[
                            {
                              color: "#6ea8ff",
                              name: "Fatigue observée",
                              value: `${point.fatigue}/100`,
                              dataKey: "fatigue",
                            },
                            {
                              color: "#f3c74d",
                              name: "Zone haute",
                              value: `${point.toleranceHigh}/100`,
                              dataKey: "toleranceHigh",
                            },
                            {
                              color: "#9ae6b4",
                              name: "Sommeil",
                              value:
                                point.sleep != null
                                  ? `${point.sleep.toFixed(1)} h`
                                  : "Non renseigné",
                              dataKey: "sleep",
                            },
                            {
                              color: "#7dd3fc",
                              name: "Énergie",
                              value:
                                point.energy != null
                                  ? `${point.energy.toFixed(1)}/5`
                                  : "Non renseignée",
                              dataKey: "energy",
                            },
                            {
                              color: "#c4b5fd",
                              name: "Récupération",
                              value: `${point.recovery}/100`,
                              dataKey: "recovery",
                            },
                            {
                              color: "#f9fafb",
                              name: "RPE moyen",
                              value:
                                point.rpe != null
                                  ? `${point.rpe.toFixed(1)}`
                                  : "Non renseigné",
                              dataKey: "rpe",
                            },
                            {
                              color: "#34d399",
                              name: "Volume utile",
                              value: formatVolume(point.volume),
                              dataKey: "volume",
                            },
                          ]}
                          footer="Lecture croisée de la contrainte réelle"
                        />
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="toleranceLow"
                    stackId="tolerance"
                    stroke="transparent"
                    fill="transparent"
                    activeDot={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="toleranceRange"
                    stackId="tolerance"
                    stroke="transparent"
                    fill="url(#fatigueToleranceBand)"
                    activeDot={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="fatigue"
                    stroke="#6ea8ff"
                    strokeWidth={2.4}
                    fill="url(#fatigueObservedArea)"
                    activeDot={{ r: 4, fill: "#6ea8ff", stroke: "#0f1112", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Volume"
            title="Volume par séance"
            metric={
              volumeStats.average != null
                ? `${Math.round(volumeStats.average / 100) / 10} t moy.`
                : "—"
            }
            detail="Répartition du volume séance par séance."
            footer={
              <>
                <FooterMetric
                  label="Séances"
                  value={`${data.timeline.length}`}
                />
                <FooterMetric
                  label="Total séries"
                  value={`${data.kpis.totalSets}`}
                />
                <FooterMetric
                  label="Total reps"
                  value={`${data.kpis.totalReps}`}
                  tone="amber"
                />
              </>
            }
          >
            <div className="h-[220px] sm:h-[250px] lg:h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.timeline}
                  barCategoryGap={14}
                  onClick={(state: { activeLabel?: string }) => {
                    if (state?.activeLabel) onFocusSessionDate?.(state.activeLabel);
                  }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.02)" }}
                    content={({ active, payload, label }) => {
                      const point = data.timeline.find((item) => item.date === label);
                      return (
                        <SharedTooltip
                          active={active}
                          payload={[
                            {
                              color: "#d8b557",
                              name: "Volume",
                              value:
                                payload?.[0]?.value != null
                                  ? formatVolume(Number(payload[0].value))
                                  : "—",
                              dataKey: "volume",
                            },
                            {
                              color: "#72d3af",
                              name: "Séries",
                              value: point ? `${point.sets}` : "—",
                              dataKey: "sets",
                            },
                          ]}
                          label={label}
                          footer={point ? `${point.reps} répétitions` : null}
                        />
                      );
                    }}
                  />
                  <Bar
                    dataKey="volume"
                    fill="#d8b557"
                    radius={[10, 10, 4, 4]}
                    maxBarSize={32}
                    activeBar={{
                      fill: "#e3c56f",
                      radius: [10, 10, 4, 4],
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Répartition"
            title="Répartition musculaire"
            metric={`${sortedMuscleGroups.length} zones suivies`}
            detail="Lecture hiérarchisée des groupes les plus sollicités sur la période."
            footer={
              <>
                <FooterMetric
                  label="Groupe dominant"
                  value={
                    sortedMuscleGroups[0]
                      ? formatMuscleGroupLabel(sortedMuscleGroups[0].name)
                      : "—"
                  }
                />
                <FooterMetric
                  label="Volume max"
                  value={
                    sortedMuscleGroups[0]
                      ? formatVolume(sortedMuscleGroups[0].volume)
                      : "—"
                  }
                  tone="green"
                />
                <FooterMetric
                  label="Couverture"
                  value={`${sortedMuscleGroups.length} groupes`}
                />
              </>
            }
          >
            <div className="space-y-2.5">
              {visibleMuscleGroups.map((group) => {
                const width = Math.max(
                  10,
                  Math.round((group.volume / maxMuscleVolume) * 100),
                );

                return (
                  <div
                    key={group.name}
                    className="rounded-[20px] border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-white">
                          {formatMuscleGroupLabel(group.name)}
                        </p>
                        <p className="mt-1 text-[11px] text-white/45">
                          {group.sets} séries · {group.reps} reps
                        </p>
                      </div>
                      <p className="text-[13px] font-semibold text-white">
                        {formatVolume(group.volume)}
                      </p>
                    </div>
                    <div className="mt-2.5 h-2 rounded-full bg-white/[0.04]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#72d3af] via-[#1f8a65] to-[#0f5a42]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    {mode === "analyst" ? (
                      <div className="mt-2.5 flex flex-wrap gap-2 text-[10px] text-white/58">
                        <span className="rounded-full bg-white/[0.04] px-2.5 py-1">
                          {formatVolume(group.volume)}
                        </span>
                        <span className="rounded-full bg-white/[0.04] px-2.5 py-1">
                          {group.sets} séries
                        </span>
                        <span className="rounded-full bg-white/[0.04] px-2.5 py-1">
                          {group.reps} reps
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {sortedMuscleGroups.length > 8 ? (
                <button
                  type="button"
                  onClick={() => setShowAllMuscles((value) => !value)}
                  className="w-full rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[12px] font-semibold text-white/72 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  {showAllMuscles
                    ? "Réduire la liste"
                    : `Afficher les ${sortedMuscleGroups.length - 8} zones restantes`}
                </button>
              ) : null}
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Intensité"
            title="Intensité et fatigue"
            metric={
              intensityStats.average != null
                ? `RPE ${intensityStats.average.toFixed(1)}`
                : "Lecture incomplète"
            }
            detail="Intensité observée et indicateurs de récupération associés."
          >
            <div className="space-y-4">
              <div className="h-[220px] sm:h-[250px] lg:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.rpeTrend}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReferenceLine
                      y={7}
                      stroke="rgba(255,255,255,0.18)"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={9}
                      stroke="rgba(245,158,11,0.28)"
                      strokeDasharray="4 4"
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(255,255,255,0.14)", strokeDasharray: "4 4" }}
                      content={({ active, payload, label }) => (
                        <SharedTooltip
                          active={active}
                          payload={payload?.map((item) => ({
                            color: "#f0b44d",
                            name: "RPE moyen",
                            value:
                              item.value != null
                                ? `RPE ${Number(item.value).toFixed(1)}`
                                : "—",
                            dataKey: String(item.dataKey),
                          }))}
                          label={label}
                          footer="Zone cible hypertrophie : RPE 7 à 9"
                        />
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgRpe"
                      stroke="#f0b44d"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 4,
                        fill: "#f0b44d",
                        stroke: "#141414",
                        strokeWidth: 2,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[22px] border border-white/[0.05] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/32">
                    Pont récupération
                  </p>
                  <div className="mt-3 space-y-2">
                    <InsightRow
                      icon={Moon}
                      label={
                        avgSleep != null
                          ? `Sommeil moyen observé : ${avgSleep.toFixed(1)} h`
                          : latestSleep != null
                            ? `Dernier sommeil renseigné : ${latestSleep.toFixed(1)} h`
                            : "Sommeil indisponible sur cette fenêtre."
                      }
                    />
                    <InsightRow
                      icon={Brain}
                      label={
                        avgEnergy != null
                          ? `Énergie moyenne observée : ${avgEnergy.toFixed(1)} / 5`
                          : latestEnergy != null
                            ? `Dernière énergie renseignée : ${latestEnergy.toFixed(1)} / 5`
                          : "Énergie indisponible sur cette fenêtre."
                      }
                    />
                    <InsightRow
                      icon={Activity}
                      label={
                        proteinPerKg != null
                          ? `Apport protéique estimé : ${proteinPerKg.toFixed(1)} g/kg${latestProteinEntry ? ` sur ${formatDate(latestProteinEntry.date)}` : ""}`
                          : "Prot./kg indisponible sur cette fenêtre."
                      }
                    />
                    <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3">
                      <FooterMetric
                        label="Sommeil"
                        value={avgSleep != null ? `${avgSleep.toFixed(1)} h` : latestSleep != null ? `${latestSleep.toFixed(1)} h` : "—"}
                      />
                      <FooterMetric
                        label="Énergie"
                        value={avgEnergy != null ? `${avgEnergy.toFixed(1)} / 5` : latestEnergy != null ? `${latestEnergy.toFixed(1)} / 5` : "—"}
                      />
                      <FooterMetric
                        label="Prot./kg"
                        value={proteinPerKg != null ? proteinPerKg.toFixed(1) : "—"}
                        tone="green"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/[0.05] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/32">
                    Lecture coach
                  </p>
                  <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-white/58">
                    {recoveryCoachNotes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                    {mode === "analyst" ? (
                      <p className={tone.accent}>
                        Pic observé :{" "}
                        {intensityStats.peak != null
                          ? `RPE ${intensityStats.peak.toFixed(1)}`
                          : "—"}
                        {fatigueStats.average != null
                          ? ` · fatigue moyenne ${Math.round(fatigueStats.average)}/100`
                          : ""}
                        .
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Focus coach"
          title="Actions et mouvements sous surveillance"
          detail="Priorités de lecture et d'ajustement."
        />

        <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)] sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                Exercices sous surveillance
              </p>
              <h3 className="mt-2 text-[20px] font-semibold text-white">
                Mouvements à ouvrir en priorité
              </h3>
            </div>
            <div className="rounded-full bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-white/72">
              {watchedExercises.length} focus
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {watchedExercises.map((item) => {
              const trendTone =
                item.trend === "up"
                  ? "bg-[#1f8a65]/12 text-[#8ef0c7]"
                  : item.trend === "down"
                    ? "bg-red-500/12 text-red-300"
                    : "bg-white/[0.06] text-white/52";

              const TrendIcon =
                item.trend === "up"
                  ? TrendingUp
                  : item.trend === "down"
                    ? TrendingDown
                    : ArrowRight;

              return (
                <button
                  key={item.exercise.name}
                  type="button"
                  onClick={() =>
                    item.latest?.date
                      ? onFocusSessionDate?.(item.latest.date)
                      : undefined
                  }
                  className="w-full rounded-[20px] border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-left transition-colors hover:bg-white/[0.04] sm:px-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[15px] font-semibold text-white">
                        {item.exercise.name}
                      </p>
                      <p className="mt-1 text-[12px] text-white/45">
                        {item.latest
                          ? `${formatLongDate(item.latest.date)} · ${item.latest.sets} séries · ${item.latest.totalReps} reps`
                          : "Pas assez d'expositions récentes"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${trendTone}`}
                    >
                      <TrendIcon size={11} />
                      {item.trend === "up"
                        ? "Hausse"
                        : item.trend === "down"
                          ? "Baisse"
                          : "Stable"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/64">
                    <span className="rounded-full bg-white/[0.04] px-2.5 py-1">
                      Charge max {item.latest ? `${item.latest.maxWeight} kg` : "—"}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-2.5 py-1">
                      Volume {item.latest ? formatVolume(item.latest.totalVolume) : "—"}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-2.5 py-1">
                      Delta {formatSignedNumber(item.weightDelta, " kg")}
                    </span>
                  </div>

                  {item.recommendation ? (
                    <div className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-[12px] text-white/62">
                      {RECOMMENDATION_LABELS[item.recommendation.type]} ·{" "}
                      {item.recommendation.reason}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      </section>
    </div>
  );
}
