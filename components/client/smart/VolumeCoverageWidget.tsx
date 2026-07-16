"use client";

import { useState } from "react";
import { useClientT } from "@/components/client/ClientI18nProvider";
import {
  TRAINING_ACCENT,
  VOLUME_OVERFLOW_COLOR,
} from "@/lib/nutrition/ui-colors";

type Group = {
  group: string;
  label: string;
  actual: number;
  mev: number;
  mav: number;
  mrv: number;
};
type WindowKey = "current_week" | "7d" | "14d" | "30d";
type WindowData = {
  range_start: string;
  sessions_count: number;
  groups: Group[];
};

export default function VolumeCoverageWidget({
  weekStart,
  sessionsCount,
  groups,
  windows,
}: {
  weekStart: string;
  sessionsCount: number;
  groups: Group[];
  windows?: Record<WindowKey, WindowData>;
}) {
  const { t } = useClientT();
  const [windowKey, setWindowKey] = useState<WindowKey>("current_week");
  const activeWindow = windows?.[windowKey] ?? {
    range_start: weekStart,
    sessions_count: sessionsCount,
    groups,
  };
  const activeGroups = activeWindow.groups.filter((g) => g.actual > 0);

  const FILTERS: Array<{ key: WindowKey; label: string }> = [
    { key: "current_week", label: t("smart.workout.window.currentWeek") },
    { key: "7d", label: t("smart.workout.window.7d") },
    { key: "14d", label: t("smart.workout.window.14d") },
    { key: "30d", label: t("smart.workout.window.30d") },
  ];

  const emptyLabel =
    windowKey === "current_week"
      ? t("msg.no.series.completed")
      : t("smart.workout.noSetsWindow", {
          label: FILTERS.find((f) => f.key === windowKey)?.label.toLowerCase() ?? "",
        });

  return (
    <div className="bg-[#111111] rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white">
          {t("smart.workout.volumeCoverage")}
        </span>
        <span className="text-[10px] text-white/40 tabular-nums">
          {activeWindow.sessions_count > 0
            ? (t("smart.workout.sessionsShort", {
                n: activeWindow.sessions_count,
              }).split("|")[activeWindow.sessions_count > 1 ? 1 : 0] ?? "")
                .replace("{n}", String(activeWindow.sessions_count))
            : t("msg.no.session")}
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setWindowKey(filter.key)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              windowKey === filter.key
                ? "bg-[#f2f2f2] text-[#080808]"
                : "bg-white/[0.05] text-white/45 hover:bg-white/[0.08] hover:text-white/70"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {activeGroups.length === 0 && (
        <p className="text-[11px] text-white/25 py-2">{emptyLabel}</p>
      )}
      <div className="space-y-2.5">
        {activeGroups
          .sort((a, b) => b.actual - a.actual)
          .map((g) => {
            const span = (g.mrv || g.mev) * 1.2;
            let color = TRAINING_ACCENT;
            if (g.actual > (g.mrv || Infinity)) color = "#ef4444";
            else if (g.actual > (g.mav || Infinity))
              color = VOLUME_OVERFLOW_COLOR;
            const w = span > 0 ? Math.min(100, (g.actual / span) * 100) : 0;
            const mevPct = span > 0 ? (g.mev / span) * 100 : 0;
            const mavPct = span > 0 ? (g.mav / span) * 100 : 0;
            return (
              <div key={g.group}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-white/55">{g.label}</span>
                  <span className="text-white tabular-nums">
                    {g.actual}{" "}
                    <span className="text-white/40">/ MEV {g.mev}</span>
                  </span>
                </div>
                <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-visible">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${w}%`, background: color }}
                  />
                  {mevPct > 0 && mevPct < 100 && (
                    <div
                      className="absolute top-[-2px] bottom-[-2px] w-px bg-white/40"
                      style={{ left: `${mevPct}%` }}
                    />
                  )}
                  {mavPct > 0 && mavPct < 100 && (
                    <div
                      className="absolute top-[-2px] bottom-[-2px] w-px bg-white/25"
                      style={{ left: `${mavPct}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
