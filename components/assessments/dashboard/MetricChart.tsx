"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  label: string;
  unit?: string;
  color?: string;
}

export default function MetricChart({
  data,
  label,
  unit = "",
  color = "#1f8a65",
}: Props) {
  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-[12px] text-white/60">
        Aucune donnée
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.16em] mb-3">
        {label}
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
          <XAxis
            dataKey="date"
            tick={{
              fontSize: 10,
              fill: "#ffffff99",
              fontFamily: "Lufga, sans-serif",
            }}
            tickFormatter={(d) =>
              new Date(d).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
              })
            }
          />
          <YAxis
            tick={{
              fontSize: 10,
              fill: "#ffffff99",
              fontFamily: "Lufga, sans-serif",
            }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "none",
              backgroundColor: "#0f0f0f",
              fontSize: 12,
              fontFamily: "Lufga, sans-serif",
              color: "#ffffff",
            }}
            formatter={(v) => `${v} ${unit}`}
            labelFormatter={(d) => new Date(d).toLocaleDateString("fr-FR")}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
