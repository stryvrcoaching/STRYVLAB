"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrendPoint = {
  date: string;
  consumed: { calories: number };
  target: { calories: number | null };
};

const WINDOWS = [3, 7, 14, 30] as const;

function buildChartData(points: TrendPoint[]) {
  return points.map((point) => ({
    date: point.date.slice(5),
    consumedCalories: point.consumed.calories,
    targetCalories: point.target.calories ?? 0,
  }));
}

export default function NutritionTrendPanel({
  activeWindow,
  points,
  onWindowChange,
}: {
  activeWindow: 3 | 7 | 14 | 30;
  points: TrendPoint[];
  onWindowChange: (window: 3 | 7 | 14 | 30) => void;
}) {
  const chartData = buildChartData(points);

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            Tendances
          </p>
          <h2 className="mt-1 text-[15px] font-semibold text-white">
            Consommé vs cible
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {WINDOWS.map((windowValue) => (
            <button
              key={windowValue}
              onClick={() => onWindowChange(windowValue)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                activeWindow === windowValue
                  ? "bg-[#1f8a65] text-white"
                  : "bg-white/[0.04] text-white/60 hover:text-white/80"
              }`}
            >
              {windowValue} j
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="date" stroke="#ffffff55" />
            <YAxis stroke="#ffffff55" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="consumedCalories"
              stroke="#ffd15e"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="targetCalories"
              stroke="#1f8a65"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
