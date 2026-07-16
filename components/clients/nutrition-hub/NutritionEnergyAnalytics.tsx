"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors";

export type NutritionEnergyTrendPoint = {
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
};

type TdeePoint = {
  calculated_at: string;
  tdee_adaptive: number;
  tdee_formula: number;
  delta_kcal: number;
  avg_intake_kcal: number;
  weight_delta_kg: number;
  weight_samples: number;
};

type Props = {
  points: NutritionEnergyTrendPoint[];
  energy?: {
    clientTdee: number | null;
    clientTdeeAt: string | null;
    tdeeDataSource: string | null;
    tdeeHistory: TdeePoint[];
  } | null;
};

type TooltipRow = {
  label: string;
  value: string;
  color: string;
};

const MIN_LOGGED_KCAL = 800;

function isoDate(ts: string) {
  return ts.slice(0, 10);
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatFullDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatSignedKcal(value: number) {
  return `${value > 0 ? "+" : ""}${Math.round(value)} kcal`;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function ChartTooltip({
  active,
  payload,
  label,
  buildRows,
  delta,
}: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
  label?: string;
  buildRows: (point: Record<string, unknown>) => TooltipRow[];
  delta?: (point: Record<string, unknown>) => { value: string; tone: "positive" | "negative" };
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const rows = buildRows(point);
  const pill = delta?.(point) ?? null;

  return (
    <div className="min-w-[228px] max-w-[260px] rounded-[22px] border border-white/[0.1] bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(16,16,16,0.96))] p-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.48)] backdrop-blur-xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
        {typeof point.rawDate === "string" ? formatFullDate(point.rawDate) : label}
      </p>
      <div className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.04] bg-white/[0.03] px-2.5 py-2 text-[12px]"
          >
            <div className="flex items-center gap-2 text-white/62">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
              <span>{row.label}</span>
            </div>
            <span className="font-medium text-white">{row.value}</span>
          </div>
        ))}
      </div>
      {pill ? (
        <div
          className="mt-3 rounded-full px-3 py-1 text-center text-[11px] font-bold"
          style={{
            color: pill.tone === "positive" ? "#ffd15e" : "#5dba87",
            backgroundColor:
              pill.tone === "positive" ? "rgba(255,209,94,0.14)" : "rgba(93,186,135,0.14)",
          }}
        >
          {pill.value}
        </div>
      ) : null}
    </div>
  );
}

function ChartShell({
  label,
  title,
  detail,
  summary,
  chart,
  footer,
}: {
  label: string;
  title: string;
  detail: string;
  summary: React.ReactNode;
  chart: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <article className="rounded-[28px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(26,26,26,0.98),rgba(18,18,18,0.98))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)] md:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <h3 className="mt-1 text-[24px] font-semibold text-white">{title}</h3>
      <p className="mt-2 text-[12px] leading-relaxed text-white/50">{detail}</p>
      <div className="mt-3">{summary}</div>
      <div className="mt-4 h-[240px]">{chart}</div>
      <div className="mt-3 border-t border-white/[0.06] pt-3">{footer}</div>
    </article>
  );
}

function TdeeAdaptiveCard({
  history,
  clientTdee,
}: {
  history: TdeePoint[];
  clientTdee: number | null;
}) {
  const points =
    history.length > 0
      ? history
      : clientTdee != null
        ? [
            {
              calculated_at: new Date().toISOString(),
              tdee_adaptive: clientTdee,
              tdee_formula: clientTdee,
              delta_kcal: 0,
              avg_intake_kcal: clientTdee,
              weight_delta_kg: 0,
              weight_samples: 0,
            },
          ]
        : [];

  if (points.length === 0) return null;

  const rows = points.map((point) => ({
    rawDate: point.calculated_at,
    date: formatShortDate(point.calculated_at),
    adaptatif: point.tdee_adaptive,
    formule: point.tdee_formula,
    fluxMin: Math.min(...points.map((item) => item.tdee_adaptive)),
    fluxMax: Math.max(...points.map((item) => item.tdee_adaptive)),
    gap: point.tdee_adaptive - point.tdee_formula,
  }));

  const latest = rows[rows.length - 1];

  return (
    <ChartShell
      label="Dépense énergétique"
      title="TDEE client stable"
      detail="Lecture de la dépense de maintien client observée puis stabilisée sur la fenêtre active."
      summary={
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-black tabular-nums text-white">
            {latest.adaptatif.toLocaleString("fr-FR")}
          </span>
          <span className="text-[10px] text-white/40">kcal/jour</span>
        </div>
      }
      chart={
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#ffffff12" vertical={false} />
            <XAxis dataKey="date" stroke="#ffffff55" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis stroke="#ffffff55" tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.18)", strokeDasharray: "4 4" }}
              wrapperStyle={{ outline: "none" }}
              content={
                <ChartTooltip
                  buildRows={(point) => [
                    {
                      label: "TDEE client",
                      value: `${Math.round(Number(point.adaptatif ?? 0)).toLocaleString("fr-FR")} kcal`,
                      color: NUTRITION_UI_COLORS.calories,
                    },
                    {
                      label: "Référence formule",
                      value: `${Math.round(Number(point.formule ?? 0)).toLocaleString("fr-FR")} kcal`,
                      color: "#f2f2f2",
                    },
                  ]}
                  delta={(point) => ({
                    value: formatSignedKcal(Number(point.gap ?? 0)),
                    tone: Number(point.gap ?? 0) > 0 ? "positive" : "negative",
                  })}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="fluxMax"
              stroke="transparent"
              fill="rgba(104,159,250,0.10)"
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="fluxMin"
              stroke="transparent"
              fill="rgba(18,18,18,1)"
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="formule"
              stroke="rgba(255,255,255,0.24)"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "rgba(255,255,255,0.65)", stroke: "#181818", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="adaptatif"
              stroke={NUTRITION_UI_COLORS.calories}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: NUTRITION_UI_COLORS.calories, stroke: "#181818", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      }
      footer={
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">Vs formule</p>
            <p className="text-[12px] font-black tabular-nums text-white">{formatSignedKcal(latest.gap)}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">Flux min</p>
            <p className="text-[12px] font-black tabular-nums text-white">
              {Math.round(latest.fluxMin)} kcal
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">Flux max</p>
            <p className="text-[12px] font-black tabular-nums text-white">
              {Math.round(latest.fluxMax)} kcal
            </p>
          </div>
        </div>
      }
    />
  );
}

function VariationCard({
  points,
}: {
  points: Array<{ date: string; delta: number; consumed: number }>;
}) {
  if (points.length === 0) return null;

  const rows = points.map((point) => ({
    rawDate: point.date,
    date: formatShortDate(point.date),
    delta: point.delta,
    consumed: point.consumed,
    positive: point.delta > 0 ? point.delta : 0,
    negative: point.delta < 0 ? point.delta : 0,
  }));

  const avgDelta = average(rows.map((point) => point.delta));
  const positives = rows.filter((point) => point.delta > 0).length;
  const negatives = rows.filter((point) => point.delta < 0).length;
  const maxGap = Math.max(...rows.map((point) => Math.abs(point.delta)));

  return (
    <ChartShell
      label="Énergie"
      title="Variation kcal/jour"
      detail="Mesure la volatilité quotidienne de l’apport calorique."
      summary={
        <div className="flex items-baseline gap-2">
          <span
            className={`text-[22px] font-black tabular-nums leading-none ${
              avgDelta >= 0 ? "text-[#ffd15e]" : "text-[#5dba87]"
            }`}
          >
            {avgDelta >= 0 ? "+" : ""}
            {avgDelta}
          </span>
          <span className="text-[10px] text-white/40">kcal moy. J vs J-1</span>
        </div>
      }
      chart={
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke="#ffffff12" vertical={false} />
            <XAxis dataKey="date" stroke="#ffffff55" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis stroke="#ffffff55" tickLine={false} axisLine={false} fontSize={11} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.02)" }}
              wrapperStyle={{ outline: "none" }}
              content={
                <ChartTooltip
                  buildRows={(point) => [
                    {
                      label: "Calories consommées",
                      value: `${Math.round(Number(point.consumed ?? 0)).toLocaleString("fr-FR")} kcal`,
                      color: Number(point.delta ?? 0) >= 0 ? "#ffd15e" : "#5dba87",
                    },
                    {
                      label: "Variation",
                      value: formatSignedKcal(Number(point.delta ?? 0)),
                      color: "#f2f2f2",
                    },
                  ]}
                  delta={(point) => ({
                    value: formatSignedKcal(Number(point.delta ?? 0)),
                    tone: Number(point.delta ?? 0) >= 0 ? "positive" : "negative",
                  })}
                />
              }
            />
            <Bar dataKey="positive" fill="#caa74a">
              {rows.map((entry) => (
                <Cell
                  key={`positive-${entry.rawDate}`}
                  radius={(entry.positive > 0 ? [4, 4, 0, 0] : [0, 0, 0, 0]) as any}
                />
              ))}
            </Bar>
            <Bar dataKey="negative" fill="#5dba87">
              {rows.map((entry) => (
                <Cell
                  key={`negative-${entry.rawDate}`}
                  radius={(entry.negative < 0 ? [0, 0, 4, 4] : [0, 0, 0, 0]) as any}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      }
      footer={
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">Hausses</p>
            <p className="text-[12px] font-black text-[#ffd15e] tabular-nums">{positives}j</p>
          </div>
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">Baisses</p>
            <p className="text-[12px] font-black text-[#5dba87] tabular-nums">{negatives}j</p>
          </div>
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">Max écart</p>
            <p className="text-[12px] font-black text-white tabular-nums">{Math.round(maxGap)} kcal</p>
          </div>
        </div>
      }
    />
  );
}

function ComparisonCard({
  title,
  detail,
  points,
  referenceLabel,
  targetLabel,
  consumedLabel,
  referenceColor,
}: {
  title: string;
  detail: string;
  points: Array<{ rawDate: string; consumed: number; reference: number; gap: number }>;
  referenceLabel: string;
  targetLabel: string;
  consumedLabel: string;
  referenceColor: string;
}) {
  if (points.length === 0) return null;

  const rows = points.map((point) => ({
    rawDate: point.rawDate,
    date: formatShortDate(point.rawDate),
    consumed: point.consumed,
    reference: point.reference,
    gap: point.gap,
    aboveBandTop: Math.max(point.consumed, point.reference),
    aboveBandBottom: point.reference,
    belowBandTop: point.reference,
    belowBandBottom: Math.min(point.consumed, point.reference),
  }));

  const avgGap = average(rows.map((point) => point.gap));
  const deficitDays = rows.filter((point) => point.gap < -50).length;
  const surplusDays = rows.filter((point) => point.gap > 50).length;

  return (
    <ChartShell
      label="Énergie"
      title={title}
      detail={detail}
      summary={
        <div className="flex items-baseline gap-2">
          <span
            className={`text-[22px] font-black tabular-nums leading-none ${
              avgGap > 0 ? "text-[#ffd15e]" : "text-[#5dba87]"
            }`}
          >
            {avgGap > 0 ? "+" : ""}
            {avgGap}
          </span>
          <span className="text-[10px] text-white/40">
            kcal moy. {avgGap > 0 ? "surplus" : "déficit"}
          </span>
        </div>
      }
      chart={
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#ffffff12" vertical={false} />
            <XAxis dataKey="date" stroke="#ffffff55" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis stroke="#ffffff55" tickLine={false} axisLine={false} fontSize={11} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.18)", strokeDasharray: "4 4" }}
              wrapperStyle={{ outline: "none" }}
              content={
                <ChartTooltip
                  buildRows={(point) => [
                    {
                      label: targetLabel,
                      value: `${Math.round(Number(point.reference ?? 0)).toLocaleString("fr-FR")} kcal`,
                      color: referenceColor,
                    },
                    {
                      label: consumedLabel,
                      value: `${Math.round(Number(point.consumed ?? 0)).toLocaleString("fr-FR")} kcal`,
                      color: "#f2f2f2",
                    },
                  ]}
                  delta={(point) => ({
                    value: formatSignedKcal(Number(point.gap ?? 0)),
                    tone: Number(point.gap ?? 0) > 0 ? "positive" : "negative",
                  })}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="aboveBandTop"
              stroke="transparent"
              fill="rgba(255,209,94,0.12)"
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="aboveBandBottom"
              stroke="transparent"
              fill="rgba(18,18,18,1)"
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="belowBandTop"
              stroke="transparent"
              fill="rgba(93,186,135,0.12)"
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="belowBandBottom"
              stroke="transparent"
              fill="rgba(18,18,18,1)"
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="reference"
              stroke={referenceColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: referenceColor, stroke: "#181818", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="consumed"
              stroke="rgba(255,255,255,0.78)"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 5, fill: "#e7efe9", stroke: "#181818", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      }
      footer={
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">
              {referenceLabel === "TDEE" ? "Déficit" : "Sous cible"}
            </p>
            <p className="text-[12px] font-black text-[#5dba87] tabular-nums">{deficitDays}j</p>
          </div>
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">
              {referenceLabel === "TDEE" ? "Surplus" : "Sur cible"}
            </p>
            <p className="text-[12px] font-black text-[#ffd15e] tabular-nums">{surplusDays}j</p>
          </div>
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-bold mb-0.5">Équilibre</p>
            <p className="text-[12px] font-black text-white tabular-nums">
              {rows.length - deficitDays - surplusDays}j
            </p>
          </div>
        </div>
      }
    />
  );
}

export default function NutritionEnergyAnalytics({ points, energy }: Props) {
  const consumedPoints = points.filter((point) => point.consumed.calories >= MIN_LOGGED_KCAL);

  const tdeePoints =
    energy?.clientTdee != null
      ? consumedPoints.map((point) => {
          const sameDay = energy.tdeeHistory.find((entry) => isoDate(entry.calculated_at) === point.date);
          const fallback = [...(energy.tdeeHistory ?? [])]
            .filter((entry) => isoDate(entry.calculated_at) <= point.date)
            .pop();
          const reference = sameDay?.tdee_adaptive ?? fallback?.tdee_adaptive ?? energy.clientTdee ?? 0;

          return {
            rawDate: point.date,
            consumed: point.consumed.calories,
            reference,
            gap: point.consumed.calories - reference,
          };
        })
      : [];

  const targetPoints = consumedPoints.map((point) => ({
    rawDate: point.date,
    consumed: point.consumed.calories,
    reference: point.target.calories ?? 0,
    gap: point.consumed.calories - (point.target.calories ?? 0),
  }));

  const variationPoints = consumedPoints
    .map((point, index) => {
      if (index === 0) return null;
      return {
        date: point.date,
        delta: point.consumed.calories - consumedPoints[index - 1].consumed.calories,
        consumed: point.consumed.calories,
      };
    })
    .filter((point): point is { date: string; delta: number; consumed: number } => point !== null);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <TdeeAdaptiveCard history={energy?.tdeeHistory ?? []} clientTdee={energy?.clientTdee ?? null} />
      <ComparisonCard
        title="TDEE vs calories consommées"
        detail="Compare les calories consommées à la dépense de maintien observée."
        points={tdeePoints}
        referenceLabel="TDEE"
        targetLabel="TDEE"
        consumedLabel="Consommé"
        referenceColor={NUTRITION_UI_COLORS.calories}
      />
      <VariationCard points={variationPoints} />
      <ComparisonCard
        title="Consommé vs cible"
        detail="Version coach du suivi calorique, avec la cible du protocole."
        points={targetPoints}
        referenceLabel="Cible"
        targetLabel="Cible"
        consumedLabel="Consommé"
        referenceColor={NUTRITION_UI_COLORS.calories}
      />
    </div>
  );
}
