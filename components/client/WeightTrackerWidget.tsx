"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { SurfaceCard } from "@/components/client/smart/SurfaceCard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useClientT } from "@/components/client/ClientI18nProvider";

type HistoryPoint = {
  date: string;
  weight: number;
  bodyFat: number | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

export default function WeightTrackerWidget() {
  const { t } = useClientT();
  const { data, error, isLoading } = useSWR<{ history: HistoryPoint[] }>(
    "/api/client/weight-history",
    fetcher
  );
  
  const [activeTab, setActiveTab] = useState<"weight" | "bodyFat">("weight");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("30d");

  // Filter history points based on range
  const filteredData = useMemo(() => {
    if (!data?.history || data.history.length === 0) return [];
    
    let list = [...data.history];
    if (timeRange === "7d") {
      list = list.slice(-7);
    } else if (timeRange === "30d") {
      list = list.slice(-30);
    }
    return list;
  }, [data, timeRange]);

  // Compute metrics (latest weight, weight delta)
  const stats = useMemo(() => {
    if (!data?.history || data.history.length === 0) return null;
    const history = data.history;
    const latest = history[history.length - 1];
    
    let delta7d = 0;
    if (history.length > 1) {
      const prevIndex = Math.max(0, history.length - 8);
      const prev = history[prevIndex];
      delta7d = latest.weight - prev.weight;
    }

    const latestBodyFat = latest.bodyFat;

    return {
      currentWeight: latest.weight,
      currentBodyFat: latestBodyFat,
      delta: delta7d,
    };
  }, [data]);

  if (isLoading) {
    return (
      <SurfaceCard className="bg-[#09090a] border border-white/[0.04] p-6 flex flex-col items-center justify-center min-h-[220px] shadow-sm">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent border-white/20" />
      </SurfaceCard>
    );
  }

  if (error || !data?.history || data.history.length === 0) {
    return null; // Don't render anything if no data is available
  }

  return (
    <SurfaceCard className="bg-[#09090a] border border-white/[0.04] p-5 flex flex-col gap-3 shadow-sm">
      {/* Header and Metrics */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.03]">
            <Scale size={14} style={{ color: "#5dba87" }} />
          </div>
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              {t("metrics.weightTracker.title")}
            </h3>
          </div>
        </div>

        {/* Time filters */}
        <div className="flex items-center bg-black/30 rounded-lg p-0.5 border border-white/5">
          {(["7d", "30d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${
                timeRange === r
                  ? "bg-white/10 text-white border border-white/5"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {r === "7d" ? "7D" : r === "30d" ? "30D" : t("common.all")}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Row */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          {/* Weight KPI */}
          <button
            onClick={() => setActiveTab("weight")}
            className={`p-3 rounded-xl border text-left transition-all duration-300 ${
              activeTab === "weight"
                ? "bg-[#5dba87]/5 border-[#5dba87]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                : "bg-white/[0.01] border-white/[0.03] hover:border-white/[0.08]"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 block">
              {t("metrics.weight")}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-[24px] font-bold leading-none tracking-tight text-white tabular-nums">
                {stats.currentWeight}
              </span>
              <span className="text-xs font-semibold text-white/50">kg</span>
            </div>
            
            {/* Delta indicator */}
            <div className="flex items-center gap-1 mt-2 text-[9px] font-bold leading-none">
              {stats.delta < 0 ? (
                <>
                  <TrendingDown size={11} className="text-[#5dba87]" />
                  <span className="text-[#5dba87]">{stats.delta.toFixed(1)} kg</span>
                  <span className="text-white/20">7d</span>
                </>
              ) : stats.delta > 0 ? (
                <>
                  <TrendingUp size={11} className="text-amber-500" />
                  <span className="text-amber-500">+{stats.delta.toFixed(1)} kg</span>
                  <span className="text-white/20">7d</span>
                </>
              ) : (
                <>
                  <Minus size={11} className="text-white/30" />
                  <span className="text-white/40">Stable</span>
                  <span className="text-white/20">7d</span>
                </>
              )}
            </div>
          </button>

          {/* Body Fat KPI */}
          <button
            onClick={() => setActiveTab("bodyFat")}
            disabled={stats.currentBodyFat == null}
            className={`p-3 rounded-xl border text-left transition-all duration-300 disabled:opacity-40 ${
              activeTab === "bodyFat"
                ? "bg-[#818cf8]/5 border-[#818cf8]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                : "bg-white/[0.01] border-white/[0.03] hover:border-white/[0.08]"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 block">
              {t("metrics.bodyFat")}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-[24px] font-bold leading-none tracking-tight text-white tabular-nums">
                {stats.currentBodyFat != null ? `${stats.currentBodyFat}` : "--"}
              </span>
              <span className="text-xs font-semibold text-white/50">%</span>
            </div>
            
            <div className="flex items-center gap-1 mt-2 text-[9px] font-semibold leading-none text-white/30">
              {stats.currentBodyFat != null ? t("metrics.estimatedOrAnalyzed") : t("metrics.missingData")}
            </div>
          </button>
        </div>
      )}

      {/* Chart container */}
      <div className="w-full h-[140px] mt-1 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredData}
            margin={{ top: 5, right: 4, left: -24, bottom: 0 }}
          >
            <defs>
              <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5dba87" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#5dba87" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
              axisLine={false}
              tickLine={false}
              domain={["auto", "auto"]}
              dx={-8}
            />

            <Tooltip
              contentStyle={{
                background: "#0f1012",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                fontSize: 11,
                color: "#fff",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
              labelFormatter={(label) => `Date : ${formatDateLabel(label as string)}`}
              formatter={(value: any) => [
                `${Number(value).toFixed(1)} ${activeTab === "weight" ? "kg" : "%"}`,
                activeTab === "weight" ? t("metrics.weight") : t("metrics.bodyFat"),
              ]}
            />

            <Area
              type="monotone"
              dataKey={activeTab === "weight" ? "weight" : "bodyFat"}
              stroke={activeTab === "weight" ? "#5dba87" : "#818cf8"}
              strokeWidth={2}
              fill={`url(#${activeTab === "weight" ? "weightGrad" : "bfGrad"})`}
              dot={false}
              activeDot={{
                r: 4.5,
                strokeWidth: 2,
                stroke: activeTab === "weight" ? "#5dba87" : "#818cf8",
                fill: "#fff",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SurfaceCard>
  );
}
