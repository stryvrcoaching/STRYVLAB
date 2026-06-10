"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors";
import NutritionRealityMiniDay from "./NutritionRealityMiniDay";
import type { NutritionRealityView } from "./useNutritionReality";

type NutritionAnalysisPanelProps = {
  loading: boolean;
  error: string | null;
  activeWindow: 3 | 7;
  onWindowChange: (window: 3 | 7) => void;
  onOpenHub: () => void;
  view: NutritionRealityView | null;
};

function formatPercent(value: number | null) {
  return value == null ? "N/A" : `${Math.round(value * 100)}%`;
}

function getMetricTone(value: number | null) {
  if (value == null) return "text-white";
  if (value > 1.05) return "text-[#ff8660]";
  if (value < 0.9) return "text-[#ffd15e]";
  return "text-[#8ef0c7]";
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | null;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: accent }}>
        {label}
      </p>
      <p className={`mt-2 text-[22px] font-semibold ${getMetricTone(value)}`}>
        {formatPercent(value)}
      </p>
    </div>
  );
}

type TrendPoint = NutritionRealityView["trendPoints"][number];

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function MiniTooltip({
  active,
  payload,
  label,
  unit,
  targetLabel,
  consumedLabel,
  accent,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; payload?: any }>;
  label?: string;
  unit: string;
  targetLabel: string;
  consumedLabel: string;
  accent: string;
}) {
  if (!active || !payload?.length) return null;

  const consumed = payload.find((entry) => entry.dataKey === "consumed");
  const target = payload.find((entry) => entry.dataKey === "target");

  return (
    <div className="min-w-[180px] rounded-2xl border border-white/[0.08] bg-[#121212]/96 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <p className="text-[11px] font-semibold text-white/85">{label}</p>
      <div className="mt-3 space-y-2 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-white/55">{consumedLabel}</span>
          <span className="font-medium text-white">
            {Math.round(consumed?.value ?? 0)}
            {unit}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-white/55">{targetLabel}</span>
          <span className="font-medium" style={{ color: accent }}>
            {Math.round(target?.value ?? 0)}
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

function buildTrendRows(points: TrendPoint[], metric: keyof TrendPoint["consumed"]) {
  return points.map((point) => ({
    date: formatShortDate(point.date),
    rawDate: point.date,
    consumed: point.consumed[metric] ?? 0,
    target: point.target[metric] ?? 0,
  }));
}

function TrendMiniCard({
  label,
  accent,
  unit,
  targetLabel,
  consumedLabel,
  points,
  metric,
  tall = false,
}: {
  label: string;
  accent: string;
  unit: string;
  targetLabel: string;
  consumedLabel: string;
  points: TrendPoint[];
  metric: keyof TrendPoint["consumed"];
  tall?: boolean;
}) {
  const data = buildTrendRows(points, metric);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
        Consommé vs réel
      </p>
      <p className="mt-1 text-[18px] font-semibold text-white">{label}</p>
      <div className={tall ? "mt-3 h-44" : "mt-3 h-28"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#ffffff10" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#ffffff45"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              stroke="#ffffff45"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              width={34}
            />
            <Tooltip
              content={
                <MiniTooltip
                  unit={unit}
                  targetLabel={targetLabel}
                  consumedLabel={consumedLabel}
                  accent={accent}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="consumed"
              stroke={accent}
              strokeWidth={2.4}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke="#d9f3e5"
              strokeWidth={1.8}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function NutritionAnalysisPanel({
  loading,
  error,
  activeWindow,
  onWindowChange,
  onOpenHub,
  view,
}: NutritionAnalysisPanelProps) {
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4 animate-pulse">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="h-3 w-28 rounded bg-white/[0.06]" />
            <div className="mt-4 h-10 w-24 rounded bg-white/[0.06]" />
            <div className="mt-3 h-3 w-full rounded bg-white/[0.05]" />
            <div className="mt-2 h-3 w-4/5 rounded bg-white/[0.05]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
              >
                <div className="h-3 w-16 rounded bg-white/[0.06]" />
                <div className="mt-3 h-7 w-16 rounded bg-white/[0.06]" />
                <div className="mt-2 h-3 w-full rounded bg-white/[0.05]" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="h-3 w-24 rounded bg-white/[0.06]" />
            <div className="mt-4 space-y-3">
              <div className="h-16 rounded-xl bg-white/[0.05]" />
              <div className="h-16 rounded-xl bg-white/[0.05]" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="h-3 w-32 rounded bg-white/[0.06]" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-xl bg-white/[0.04] p-3">
                  <div className="h-3 w-24 rounded bg-white/[0.06]" />
                  <div className="mt-2 h-5 w-20 rounded bg-white/[0.06]" />
                  <div className="mt-3 h-24 rounded bg-white/[0.05]" />
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-white/[0.04] p-3">
              <div className="h-3 w-24 rounded bg-white/[0.06]" />
              <div className="mt-2 h-5 w-20 rounded bg-white/[0.06]" />
              <div className="mt-3 h-36 rounded bg-white/[0.05]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
          <p className="text-sm font-semibold text-white">Analyse indisponible</p>
          <p className="mt-2 text-[11px] leading-relaxed text-red-200/80">{error}</p>
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[11px] font-semibold text-white">
            Pas encore assez de données nutritionnelles
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-white/50">
            Les journées réelles apparaîtront ici dès que le client loguera repas et
            hydratation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
      <div className="space-y-4">
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Analyse nutritionnelle
              </p>
              <p className="mt-1 text-[11px] text-white/45">
                Lecture de la réalité observée pendant la construction du protocole.
              </p>
            </div>
            <button
              onClick={onOpenHub}
              className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60 transition-colors hover:text-white/80"
            >
              Ouvrir le hub
            </button>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                Score global nutrition
              </p>
              <p className="mt-1 text-[30px] font-semibold text-white">
                {formatPercent(view.summary.nutritionScore)}
              </p>
            </div>
            <div className="flex gap-2">
              {view.availableWindows.map((windowValue) => (
                <button
                  key={windowValue}
                  onClick={() => onWindowChange(windowValue)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    activeWindow === windowValue
                      ? "bg-[#1f8a65] text-white"
                      : "bg-white/[0.04] text-white/55"
                  }`}
                >
                  {windowValue}j
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricCard
              label="Calories"
              value={view.summary.achievedCalories}
              accent={NUTRITION_UI_COLORS.calories}
            />
            <MetricCard
              label="Protéines"
              value={view.summary.achievedProtein}
              accent={NUTRITION_UI_COLORS.protein}
            />
            <MetricCard
              label="Glucides"
              value={view.summary.achievedCarbs}
              accent={NUTRITION_UI_COLORS.carbs}
            />
            <MetricCard
              label="Lipides"
              value={view.summary.achievedFat}
              accent={NUTRITION_UI_COLORS.fat}
            />
            <div className="col-span-2">
              <MetricCard
                label="Hydratation"
                value={view.summary.achievedHydration}
                accent={NUTRITION_UI_COLORS.water}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            Signaux clés
          </p>
          <div className="mt-4 space-y-2">
            {view.topInsights.length > 0 ? (
              view.topInsights.map((insight) => (
                <div key={insight.id} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-white">{insight.title}</p>
                  <p className="mt-1 text-[10px] text-white/50">{insight.message}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.03] px-3 py-3">
                <p className="text-[11px] font-semibold text-white">
                  Aucun signal prioritaire sur la fenêtre active.
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-white/50">
                  Les données observées ne montrent pas d’alerte nutritionnelle majeure à
                  ce stade.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            Consommé vs réel
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <TrendMiniCard
              label="Calories"
              accent={NUTRITION_UI_COLORS.calories}
              unit=" kcal"
              targetLabel="Cible"
              consumedLabel="Consommé"
              points={view.trendPoints}
              metric="calories"
            />
            <TrendMiniCard
              label="Protéines"
              accent={NUTRITION_UI_COLORS.protein}
              unit=" g"
              targetLabel="Cible"
              consumedLabel="Consommé"
              points={view.trendPoints}
              metric="protein_g"
            />
            <TrendMiniCard
              label="Glucides"
              accent={NUTRITION_UI_COLORS.carbs}
              unit=" g"
              targetLabel="Cible"
              consumedLabel="Consommé"
              points={view.trendPoints}
              metric="carbs_g"
            />
            <TrendMiniCard
              label="Lipides"
              accent={NUTRITION_UI_COLORS.fat}
              unit=" g"
              targetLabel="Cible"
              consumedLabel="Consommé"
              points={view.trendPoints}
              metric="fat_g"
            />
          </div>
          <div className="mt-3">
            <TrendMiniCard
              label="Hydratation"
              accent={NUTRITION_UI_COLORS.water}
              unit=" ml"
              targetLabel="Cible"
              consumedLabel="Consommé"
              points={view.trendPoints}
              metric="hydration_ml"
              tall
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            Dernières journées observées
          </p>
          <div className="mt-4 space-y-2">
            {view.recentDays.map((day) => (
              <NutritionRealityMiniDay key={day.date} day={day} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
