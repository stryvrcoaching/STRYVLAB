"use client";

import type { ReactNode } from "react";
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors";
import NutritionMetricSpotlight from "./NutritionMetricSpotlight";

type TrendPoint = {
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
  points: TrendPoint[];
  energy?: {
    protocolTdee: number | null;
    protocolTdeeAt: string | null;
    tdeeDataSource: string | null;
    tdeeHistory: TdeePoint[];
  } | null;
};

const W = 320;
const H = 120;
const PAD = { top: 12, right: 8, bottom: 20, left: 36 };

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function svgPath(points: Array<[number, number]>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

  const d = [`M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`];
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const cpx = (x0 + x1) / 2;
    d.push(
      `C ${cpx.toFixed(1)} ${y0.toFixed(1)}, ${cpx.toFixed(1)} ${y1.toFixed(
        1,
      )}, ${x1.toFixed(1)} ${y1.toFixed(1)}`,
    );
  }
  return d.join(" ");
}

function Legend({
  items,
}: {
  items: Array<{ label: string; color: string; dashed?: boolean }>;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.dashed ? (
            <svg width="20" height="4" aria-hidden="true">
              <line
                x1="0"
                y1="2"
                x2="20"
                y2="2"
                stroke={item.color}
                strokeWidth="1.4"
                strokeDasharray="3 3"
              />
            </svg>
          ) : (
            <div className="h-[2px] w-6 rounded" style={{ backgroundColor: item.color }} />
          )}
          <span className="text-[9px] text-white/40">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function TdeeAdaptiveCard({
  history,
  protocolTdee,
}: {
  history: TdeePoint[];
  protocolTdee: number | null;
}) {
  const latest = history[history.length - 1] ?? null;
  const values = history.flatMap((point) => [point.tdee_adaptive, point.tdee_formula]);
  const baseY = protocolTdee ?? latest?.tdee_adaptive ?? 0;
  const minY = (values.length ? Math.min(baseY, ...values) : baseY) - 100;
  const maxY = (values.length ? Math.max(baseY, ...values) : baseY) + 100;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const toX = (index: number) =>
    PAD.left + (history.length <= 1 ? innerW / 2 : (index / (history.length - 1)) * innerW);
  const toY = (value: number) =>
    PAD.top + innerH - ((value - minY) / (maxY - minY || 1)) * innerH;

  const adaptivePts: Array<[number, number]> = history.map((point, index) => [
    toX(index),
    toY(point.tdee_adaptive),
  ]);
  const formulaPts: Array<[number, number]> = history.map((point, index) => [
    toX(index),
    toY(point.tdee_formula),
  ]);
  const bandMin = history.length > 0 ? Math.min(...history.map((point) => point.tdee_adaptive)) : protocolTdee ?? 0;
  const bandMax = history.length > 0 ? Math.max(...history.map((point) => point.tdee_adaptive)) : protocolTdee ?? 0;
  const bandTopPts: Array<[number, number]> = history.map((_, index) => [
    toX(index),
    toY(bandMax),
  ]);
  const bandBotPts: Array<[number, number]> = history
    .map((_, index) => [toX(index), toY(bandMin)] as [number, number])
    .reverse();
  const bandPath = bandTopPts.length
    ? `${svgPath(bandTopPts)} L ${bandBotPts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ")} Z`
    : "";

  return (
    <NutritionMetricSpotlight
      label="Dépense énergétique"
      value="TDEE adaptatif"
      detail="Lecture de la dépense de maintien observée sur la fenêtre active, avec sa plage de flux."
    >
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[22px] font-black tabular-nums text-white">
          {latest
            ? latest.tdee_adaptive.toLocaleString("fr-FR")
            : protocolTdee?.toLocaleString("fr-FR") ?? "N/A"}
        </span>
        <span className="text-[10px] text-white/40">kcal/jour</span>
      </div>

      <div className="mt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[120px] w-full"
          preserveAspectRatio="none"
        >
          {bandPath ? <path d={bandPath} fill="rgba(255,224,30,0.08)" stroke="none" /> : null}
          <path
            d={svgPath(formulaPts)}
            fill="none"
            stroke="rgba(255,255,255,0.26)"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <path
            d={svgPath(adaptivePts)}
            fill="none"
            stroke="#f2f2f2"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {adaptivePts.map(([x, y], index) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={index === adaptivePts.length - 1 ? 3 : 1.8}
              fill={index === adaptivePts.length - 1 ? "#f2f2f2" : "rgba(255,224,30,0.65)"}
            />
          ))}
          {history.length >= 2 ? (
            <>
              <text x={PAD.left} y={H - 2} textAnchor="start" fontSize="7" fill="rgba(255,255,255,0.25)">
                {formatDate(history[0].calculated_at)}
              </text>
              <text x={W - PAD.right} y={H - 2} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.25)">
                {formatDate(history[history.length - 1].calculated_at)}
              </text>
            </>
          ) : null}
        </svg>
      </div>

      <Legend
        items={[
          { label: "Adaptatif", color: "#f2f2f2" },
          { label: "Formule", color: "rgba(255,255,255,0.28)", dashed: true },
          { label: "Plage flux", color: "rgba(255,224,30,0.2)" },
        ]}
      />
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">Vs formule</p>
          <p className="text-[12px] font-black tabular-nums text-white">
            {latest
              ? `${latest.tdee_adaptive - latest.tdee_formula >= 0 ? "+" : ""}${Math.round(
                  latest.tdee_adaptive - latest.tdee_formula,
                )} kcal`
              : "N/A"}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">Flux min</p>
          <p className="text-[12px] font-black tabular-nums text-white">
            {history.length ? Math.round(bandMin) : Math.round(protocolTdee ?? 0)} kcal
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">Flux max</p>
          <p className="text-[12px] font-black tabular-nums text-white">
            {history.length ? Math.round(bandMax) : Math.round(protocolTdee ?? 0)} kcal
          </p>
        </div>
      </div>
    </NutritionMetricSpotlight>
  );
}

function EnergyLineCard({
  label,
  value,
  detail,
  points,
  lineKey,
  referenceKey,
  lineColor,
  referenceColor,
  footer,
}: {
  label: string;
  value: string;
  detail: string;
  points: Array<Record<string, number | string>>;
  lineKey: string;
  referenceKey?: string;
  lineColor: string;
  referenceColor?: string;
  footer: Array<{ label: string; value: string; tone?: string }>;
}) {
  if (points.length === 0) {
    return (
      <NutritionMetricSpotlight label={label} value={value} detail={detail}>
        <div className="mt-4 rounded-[18px] border border-dashed border-white/[0.10] bg-white/[0.03] p-4 text-sm text-white/45">
          Données insuffisantes sur la fenêtre active.
        </div>
      </NutritionMetricSpotlight>
    );
  }

  const values = points.flatMap((point) => {
    const main = Number(point[lineKey] ?? 0);
    const ref =
      referenceKey && point[referenceKey] != null ? Number(point[referenceKey]) : null;
    return ref == null ? [main] : [main, ref];
  });
  const minY = Math.min(...values) - 80;
  const maxY = Math.max(...values) + 80;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const toX = (index: number) =>
    PAD.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const toY = (value: number) =>
    PAD.top + innerH - ((value - minY) / (maxY - minY || 1)) * innerH;
  const mainPts: Array<[number, number]> = points.map((point, index) => [
    toX(index),
    toY(Number(point[lineKey] ?? 0)),
  ]);
  const refPts: Array<[number, number]> = referenceKey
    ? points.map((point, index) => [toX(index), toY(Number(point[referenceKey] ?? 0))])
    : [];
  const latest = points[points.length - 1] ?? null;

  return (
    <NutritionMetricSpotlight label={label} value={value} detail={detail}>
      <div className="mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full" preserveAspectRatio="none">
          {referenceKey ? (
            <path
              d={svgPath(refPts)}
              fill="none"
              stroke={referenceColor ?? "rgba(255,255,255,0.28)"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          <path
            d={svgPath(mainPts)}
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {mainPts.map(([x, y], index) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={index === mainPts.length - 1 ? 3 : 1.8}
              fill={lineColor}
            />
          ))}
          {points.length >= 2 ? (
            <>
              <text x={PAD.left} y={H - 2} textAnchor="start" fontSize="7" fill="rgba(255,255,255,0.25)">
                {formatDate(String(points[0].date))}
              </text>
              <text x={W - PAD.right} y={H - 2} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.25)">
                {formatDate(String(points[points.length - 1].date))}
              </text>
            </>
          ) : null}
        </svg>
      </div>

      <Legend
        items={[
          { label: "Mesure", color: lineColor },
          ...(referenceKey && referenceColor ? [{ label: "Référence", color: referenceColor }] : []),
        ]}
      />
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
        {footer.map((item) => (
          <div key={item.label}>
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">
              {item.label}
            </p>
            <p className={`text-[12px] font-black tabular-nums ${item.tone ?? "text-white"}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
      {latest ? null : null}
    </NutritionMetricSpotlight>
  );
}

export default function NutritionEnergyAnalytics({ points, energy }: Props) {
  const intakePoints = points
    .filter((point) => point.consumed.calories > 0)
    .map((point) => ({
      date: point.date,
      consumed: point.consumed.calories,
      target: point.target.calories ?? 0,
    }));

  const variationPoints = intakePoints
    .map((point, index) => {
      if (index === 0) return null;
      return { date: point.date, delta: point.consumed - intakePoints[index - 1].consumed };
    })
    .filter((point): point is { date: string; delta: number } => point !== null);

  const tdeePoints =
    energy?.protocolTdee != null
      ? intakePoints.map((point) => {
          const sameDay = energy.tdeeHistory.find((entry) => entry.calculated_at.slice(0, 10) === point.date);
          const fallback = [...(energy.tdeeHistory ?? [])]
            .filter((entry) => entry.calculated_at.slice(0, 10) <= point.date)
            .pop();
          const reference = sameDay?.tdee_adaptive ?? fallback?.tdee_adaptive ?? energy.protocolTdee ?? 0;
          return {
            date: point.date,
            intake: point.consumed,
            reference,
            gap: point.consumed - reference,
          };
        })
      : [];

  const targetPoints = intakePoints.map((point) => ({
    date: point.date,
    intake: point.consumed,
    reference: point.target,
    gap: point.consumed - point.target,
  }));

  const avgVariation =
    variationPoints.length > 0
      ? Math.round(
          variationPoints.reduce((sum, point) => sum + Math.abs(point.delta), 0) /
            variationPoints.length,
        )
      : 0;

  const meanGapVsTdee =
    tdeePoints.length > 0
      ? Math.round(tdeePoints.reduce((sum, point) => sum + point.gap, 0) / tdeePoints.length)
      : null;
  const meanGapVsTarget =
    targetPoints.length > 0
      ? Math.round(targetPoints.reduce((sum, point) => sum + point.gap, 0) / targetPoints.length)
      : null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <TdeeAdaptiveCard
        history={energy?.tdeeHistory ?? []}
        protocolTdee={energy?.protocolTdee ?? null}
      />

      <EnergyLineCard
        label="Énergie"
        value="Variation kcal/jour"
        detail="Mesure la volatilité quotidienne de l’apport calorique."
        points={variationPoints.map((point) => ({
          date: point.date,
          delta: point.delta,
        }))}
        lineKey="delta"
        lineColor={NUTRITION_UI_COLORS.calories}
        footer={[
          { label: "Amplitude moy.", value: `${avgVariation} kcal` },
          {
            label: "Max",
            value:
              variationPoints.length > 0
                ? `${Math.max(...variationPoints.map((point) => point.delta)) >= 0 ? "+" : ""}${Math.max(...variationPoints.map((point) => point.delta))} kcal`
                : "N/A",
          },
          {
            label: "Min",
            value:
              variationPoints.length > 0
                ? `${Math.min(...variationPoints.map((point) => point.delta))} kcal`
                : "N/A",
          },
        ]}
      />

      <EnergyLineCard
        label="Énergie"
        value="TDEE vs apport réel"
        detail="Compare l’apport réel à la dépense de maintien observée."
        points={tdeePoints}
        lineKey="intake"
        referenceKey="reference"
        lineColor="#f2f2f2"
        referenceColor={NUTRITION_UI_COLORS.calories}
        footer={[
          {
            label: "Écart moy.",
            value:
              meanGapVsTdee != null
                ? `${meanGapVsTdee >= 0 ? "+" : ""}${meanGapVsTdee} kcal`
                : "N/A",
            tone:
              meanGapVsTdee != null
                ? meanGapVsTdee > 0
                  ? "text-[#ffd15e]"
                  : "text-[#8ef0c7]"
                : "text-white",
          },
          { label: "Déficit", value: `${tdeePoints.filter((point) => point.gap < -50).length}j` },
          { label: "Surplus", value: `${tdeePoints.filter((point) => point.gap > 50).length}j` },
        ]}
      />

      <EnergyLineCard
        label="Énergie"
        value="Consommé vs cible"
        detail="Version coach du suivi calorique, avec la cible du protocole."
        points={targetPoints}
        lineKey="intake"
        referenceKey="reference"
        lineColor="#f2f2f2"
        referenceColor={NUTRITION_UI_COLORS.calories}
        footer={[
          {
            label: "Écart moy.",
            value:
              meanGapVsTarget != null
                ? `${meanGapVsTarget >= 0 ? "+" : ""}${meanGapVsTarget} kcal`
                : "N/A",
            tone:
              meanGapVsTarget != null
                ? meanGapVsTarget > 0
                  ? "text-[#ffd15e]"
                  : "text-[#8ef0c7]"
                : "text-white",
          },
          { label: "Sous cible", value: `${targetPoints.filter((point) => point.gap < -50).length}j` },
          { label: "Conforme", value: `${targetPoints.filter((point) => Math.abs(point.gap) <= 50).length}j` },
        ]}
      />
    </div>
  );
}
