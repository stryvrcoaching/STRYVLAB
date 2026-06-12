"use client";

import type { ReactNode } from "react";
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
import NutritionEnergyAnalytics from "./NutritionEnergyAnalytics";
import NutritionMetricSpotlight from "./NutritionMetricSpotlight";

type TrendPoint = {
  date: string;
  consumed: {
    calories: number;
    protein_g: number;
    hydration_ml: number;
    carbs_g?: number;
    fat_g?: number;
  };
  target: {
    calories: number | null;
    protein_g: number | null;
    hydration_ml: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
  };
  dayKind?: "training" | "off" | "unknown";
};

type TooltipRow = {
  label: string;
  value: string;
  color: string;
};

type NutritionTrendVariant = "summary" | "macros" | "hydration";

type EnergyData = {
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

const COLORS = {
  calories: NUTRITION_UI_COLORS.calories,
  protein: NUTRITION_UI_COLORS.protein,
  carbs: NUTRITION_UI_COLORS.carbs,
  fat: NUTRITION_UI_COLORS.fat,
  hydration: NUTRITION_UI_COLORS.water,
  target: "#d9f3e5",
};

function chartRows(points: TrendPoint[]) {
  return points.map((point) => ({
    rawDate: point.date,
    date: new Date(point.date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    }),
    consumedCalories: point.consumed.calories,
    targetCalories: point.target.calories ?? 0,
    consumedProtein: point.consumed.protein_g,
    targetProtein: point.target.protein_g ?? 0,
    consumedCarbs: point.consumed.carbs_g ?? 0,
    targetCarbs: point.target.carbs_g ?? 0,
    consumedFat: point.consumed.fat_g ?? 0,
    targetFat: point.target.fat_g ?? 0,
    consumedHydration: point.consumed.hydration_ml,
    targetHydration: point.target.hydration_ml ?? 0,
  }));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageCalories(points: TrendPoint[]) {
  return average(points.map((point) => point.consumed.calories));
}

function averageHydration(points: TrendPoint[]) {
  return average(points.map((point) => point.consumed.hydration_ml));
}

function averageHydrationAchievement(points: TrendPoint[]) {
  const ratios = points
    .map((point) => {
      if (!point.target.hydration_ml || point.target.hydration_ml <= 0) return null;
      return point.consumed.hydration_ml / point.target.hydration_ml;
    })
    .filter((value): value is number => value !== null);

  if (ratios.length === 0) return null;

  return Math.round(
    (ratios.reduce((sum, value) => sum + value, 0) / ratios.length) * 100,
  );
}

function countHydrationUnderTarget(points: TrendPoint[]) {
  return points.filter(
    (point) =>
      point.target.hydration_ml &&
      point.target.hydration_ml > 0 &&
      point.consumed.hydration_ml < point.target.hydration_ml * 0.9,
  ).length;
}

function countHydrationAndCarbsUnderTarget(points: TrendPoint[]) {
  return points.filter((point) => {
    const hydrationTarget = point.target.hydration_ml;
    const carbsTarget = point.target.carbs_g;

    if (!hydrationTarget || hydrationTarget <= 0 || !carbsTarget || carbsTarget <= 0) {
      return false;
    }

    return (
      point.consumed.hydration_ml < hydrationTarget * 0.9 &&
      (point.consumed.carbs_g ?? 0) < carbsTarget * 0.9
    );
  }).length;
}

function formatFullDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function PremiumTooltip({
  active,
  payload,
  label,
  buildRows,
}: {
  active?: boolean;
  payload?: Array<{ payload: any }>;
  label?: string;
  buildRows: (point: any) => TooltipRow[];
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const rows = buildRows(point);

  return (
    <div className="min-w-[220px] rounded-2xl border border-white/[0.08] bg-[#121212]/96 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <p className="text-[11px] font-semibold capitalize text-white/88">
        {point.rawDate ? formatFullDate(point.rawDate) : label}
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-[12px]">
            <div className="flex items-center gap-2 text-white/62">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span>{row.label}</span>
            </div>
            <span className="font-medium text-white">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({
  data,
  lines,
  tooltipRows,
}: {
  data: ReturnType<typeof chartRows>;
  lines: Array<{ key: string; color: string; width?: number }>;
  tooltipRows: (point: any) => TooltipRow[];
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#ffffff12" vertical={false} />
          <XAxis dataKey="date" stroke="#ffffff55" tickLine={false} axisLine={false} />
          <YAxis stroke="#ffffff55" tickLine={false} axisLine={false} />
          <Tooltip content={<PremiumTooltip buildRows={tooltipRows} />} />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={line.width ?? 2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComparisonCard({
  title,
  days,
  calories,
}: {
  title: string;
  days: number;
  calories: number;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.04] p-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white">{days} jours</p>
      <p className="mt-2 text-[12px] text-white/46">{calories} kcal moyennes consommées</p>
    </div>
  );
}

function HydrationComparisonCard({
  title,
  days,
  hydration,
  achievement,
}: {
  title: string;
  days: number;
  hydration: number;
  achievement: number | null;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.04] p-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white">{days} jours</p>
      <p className="mt-2 text-[12px] text-white/75">{hydration} ml moyens</p>
      <p className="mt-1 text-[12px] text-white/46">
        {achievement !== null
          ? `${achievement}% de la cible hydrique`
          : "Cible hydrique non disponible"}
      </p>
    </div>
  );
}

function ChartCard({
  label,
  value,
  detail,
  data,
  lines,
  tooltipRows,
}: {
  label: string;
  value: string;
  detail: string;
  data: ReturnType<typeof chartRows>;
  lines: Array<{ key: string; color: string; width?: number }>;
  tooltipRows: (point: any) => TooltipRow[];
}) {
  return (
    <NutritionMetricSpotlight label={label} value={value} detail={detail}>
      <TrendChart data={data} lines={lines} tooltipRows={tooltipRows} />
    </NutritionMetricSpotlight>
  );
}

function SummaryCards({
  data,
  trainingDays,
  offDays,
}: {
  data: ReturnType<typeof chartRows>;
  trainingDays: TrendPoint[];
  offDays: TrendPoint[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        label="Calories"
        value="Consommé vs cible"
        detail="Lecture des écarts caloriques, utile pour repérer dérive, sous-consommation ou instabilité."
        data={data}
        lines={[
          { key: "consumedCalories", color: COLORS.calories, width: 2.5 },
          { key: "targetCalories", color: COLORS.target, width: 2 },
        ]}
        tooltipRows={(point) => [
          {
            label: "Calories consommées",
            value: `${Math.round(point.consumedCalories)} kcal`,
            color: COLORS.calories,
          },
          {
            label: "Objectif calories",
            value: `${Math.round(point.targetCalories)} kcal`,
            color: COLORS.target,
          },
        ]}
      />

      <ChartCard
        label="Protéines"
        value="Adhérence protéique"
        detail="La stabilité protéique éclaire immédiatement la qualité d’exécution du protocole sur la période."
        data={data}
        lines={[
          { key: "consumedProtein", color: COLORS.protein, width: 2.5 },
          { key: "targetProtein", color: COLORS.target, width: 2 },
        ]}
        tooltipRows={(point) => [
          {
            label: "Protéines consommées",
            value: `${Math.round(point.consumedProtein)} g`,
            color: COLORS.protein,
          },
          {
            label: "Objectif protéines",
            value: `${Math.round(point.targetProtein)} g`,
            color: COLORS.target,
          },
        ]}
      />

      <ChartCard
        label="Hydratation"
        value="Conformité hydrique"
        detail="Lecture de la discipline d’hydratation par rapport à la cible définie dans le protocole."
        data={data}
        lines={[
          { key: "consumedHydration", color: COLORS.hydration, width: 2.5 },
          { key: "targetHydration", color: COLORS.target, width: 2 },
        ]}
        tooltipRows={(point) => [
          {
            label: "Hydratation consommée",
            value: `${Math.round(point.consumedHydration)} ml`,
            color: COLORS.hydration,
          },
          {
            label: "Objectif hydratation",
            value: `${Math.round(point.targetHydration)} ml`,
            color: COLORS.target,
          },
        ]}
      />

      <NutritionMetricSpotlight
        label="Entraînement vs repos"
        value={`${trainingDays.length} / ${offDays.length}`}
        detail="Comparer rapidement la réalité nutritionnelle entre jours d’entraînement et jours de repos."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ComparisonCard
            title="Jours d’entraînement"
            days={trainingDays.length}
            calories={averageCalories(trainingDays)}
          />
          <ComparisonCard
            title="Jours de repos"
            days={offDays.length}
            calories={averageCalories(offDays)}
          />
        </div>
      </NutritionMetricSpotlight>
    </div>
  );
}

function MacroCards({ data }: { data: ReturnType<typeof chartRows> }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        label="Consommé vs cible"
        value="Calories"
        detail="Comparer l’énergie consommée à la cible journalière."
        data={data}
        lines={[
          { key: "consumedCalories", color: COLORS.calories, width: 2.5 },
          { key: "targetCalories", color: COLORS.target, width: 2 },
        ]}
        tooltipRows={(point) => [
          {
            label: "Calories consommées",
            value: `${Math.round(point.consumedCalories)} kcal`,
            color: COLORS.calories,
          },
          {
            label: "Objectif calories",
            value: `${Math.round(point.targetCalories)} kcal`,
            color: COLORS.target,
          },
        ]}
      />

      <ChartCard
        label="Consommé vs cible"
        value="Protéines"
        detail="Vérifier la tenue de la cible protéique jour après jour."
        data={data}
        lines={[
          { key: "consumedProtein", color: COLORS.protein, width: 2.5 },
          { key: "targetProtein", color: COLORS.target, width: 2 },
        ]}
        tooltipRows={(point) => [
          {
            label: "Protéines consommées",
            value: `${Math.round(point.consumedProtein)} g`,
            color: COLORS.protein,
          },
          {
            label: "Objectif protéines",
            value: `${Math.round(point.targetProtein)} g`,
            color: COLORS.target,
          },
        ]}
      />

      <ChartCard
        label="Consommé vs cible"
        value="Glucides"
        detail="Mesurer la précision énergétique et la disponibilité en glycogène."
        data={data}
        lines={[
          { key: "consumedCarbs", color: COLORS.carbs, width: 2.5 },
          { key: "targetCarbs", color: COLORS.target, width: 2 },
        ]}
        tooltipRows={(point) => [
          {
            label: "Glucides consommés",
            value: `${Math.round(point.consumedCarbs)} g`,
            color: COLORS.carbs,
          },
          {
            label: "Objectif glucides",
            value: `${Math.round(point.targetCarbs)} g`,
            color: COLORS.target,
          },
        ]}
      />

      <ChartCard
        label="Consommé vs cible"
        value="Lipides"
        detail="Suivre l’équilibre lipidique et la constance sur la semaine."
        data={data}
        lines={[
          { key: "consumedFat", color: COLORS.fat, width: 2.5 },
          { key: "targetFat", color: COLORS.target, width: 2 },
        ]}
        tooltipRows={(point) => [
          {
            label: "Lipides consommés",
            value: `${Math.round(point.consumedFat)} g`,
            color: COLORS.fat,
          },
          {
            label: "Objectif lipides",
            value: `${Math.round(point.targetFat)} g`,
            color: COLORS.target,
          },
        ]}
      />
    </div>
  );
}

function HydrationCards({
  data,
  trainingDays,
  offDays,
}: {
  data: ReturnType<typeof chartRows>;
  trainingDays: TrendPoint[];
  offDays: TrendPoint[];
}) {
  const underHydrationDays = countHydrationUnderTarget(trainingDays.concat(offDays));
  const doubleUnderDays = countHydrationAndCarbsUnderTarget(
    trainingDays.concat(offDays),
  );

  return (
    <div className="space-y-4">
      <ChartCard
        label="Consommé vs cible"
        value="Hydratation"
        detail="Vue élargie pour auditer clairement le comportement hydrique sur la fenêtre active."
        data={data}
        lines={[
          { key: "consumedHydration", color: COLORS.hydration, width: 2.7 },
          { key: "targetHydration", color: COLORS.target, width: 2 },
        ]}
        tooltipRows={(point) => [
          {
            label: "Hydratation consommée",
            value: `${Math.round(point.consumedHydration)} ml`,
            color: COLORS.hydration,
          },
          {
            label: "Objectif hydratation",
            value: `${Math.round(point.targetHydration)} ml`,
            color: COLORS.target,
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <NutritionMetricSpotlight
          label="Entraînement vs repos"
          value={`${trainingDays.length} / ${offDays.length}`}
          detail="Cette lecture aide à voir si l’hydratation décroche surtout les jours d’entraînement, quand les besoins pratiques sont souvent plus élevés."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <HydrationComparisonCard
              title="Jours d’entraînement"
              days={trainingDays.length}
              hydration={averageHydration(trainingDays)}
              achievement={averageHydrationAchievement(trainingDays)}
            />
            <HydrationComparisonCard
              title="Jours de repos"
              days={offDays.length}
              hydration={averageHydration(offDays)}
              achievement={averageHydrationAchievement(offDays)}
            />
          </div>
        </NutritionMetricSpotlight>

        <NutritionMetricSpotlight
          label="Hydratation + glucides"
          value={`${doubleUnderDays} jours liés`}
          detail="Ici, on ne cherche pas une causalité automatique. On repère simplement les journées où l’hydratation et les glucides décrochent ensemble, car ce duo peut compliquer l’exécution autour des séances."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.04] p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                Hydratation sous cible
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {underHydrationDays} jours
              </p>
              <p className="mt-2 text-[12px] text-white/46">
                Fenêtre active avec au moins 10% d’écart sous la cible hydrique.
              </p>
            </div>
            <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.04] p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                Double sous-cible
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {doubleUnderDays} jours
              </p>
              <p className="mt-2 text-[12px] text-white/46">
                Jours où l’hydratation et les glucides passent ensemble sous la zone attendue.
              </p>
            </div>
          </div>
        </NutritionMetricSpotlight>
      </div>
    </div>
  );
}

export default function NutritionTrendGrid({
  points,
  energy,
  rightRail,
  variant = "summary",
}: {
  points: TrendPoint[];
  energy?: EnergyData;
  rightRail?: ReactNode;
  variant?: NutritionTrendVariant;
}) {
  const data = chartRows(points);
  const trainingDays = points.filter((point) => point.dayKind === "training");
  const offDays = points.filter((point) => point.dayKind === "off");

  if (variant === "hydration") {
    return (
      <section>
        <HydrationCards
          data={data}
          trainingDays={trainingDays}
          offDays={offDays}
        />
      </section>
    );
  }

  if (variant === "macros") {
    return <MacroCards data={data} />;
  }

  return (
    <section className="space-y-4">
      {energy ? <NutritionEnergyAnalytics points={points} energy={energy} /> : null}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <SummaryCards data={data} trainingDays={trainingDays} offDays={offDays} />
        {rightRail ? <div className="space-y-4">{rightRail}</div> : null}
      </div>
    </section>
  );
}
