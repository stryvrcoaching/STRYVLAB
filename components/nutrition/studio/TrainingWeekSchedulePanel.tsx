"use client";

import { useMemo } from "react";
import { Dumbbell, Moon, Activity, HelpCircle } from "lucide-react";
import type { TrainingWeekSchedule, WeekdayKind } from "@/lib/nutrition/training-week-schedule";
import {
  WEEKDAY_KIND_LABELS,
  suggestNutritionDayName,
} from "@/lib/nutrition/training-week-schedule";

interface Props {
  schedule: TrainingWeekSchedule | null;
  loading?: boolean;
  protocolDayNames: string[];
  activeDow?: number | null;
  onSelectDow?: (dow: number) => void;
}

const KIND_STYLES: Record<
  WeekdayKind,
  { pill: string; dot: string; Icon: typeof Dumbbell }
> = {
  training: {
    pill: "bg-[#1f8a65]/15 text-[#6ee7b7] border-[#1f8a65]/25",
    dot: "bg-[#1f8a65]",
    Icon: Dumbbell,
  },
  rest: {
    pill: "bg-white/[0.04] text-white/45 border-white/[0.08]",
    dot: "bg-white/25",
    Icon: Moon,
  },
  rest_with_activity: {
    pill: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    dot: "bg-blue-400",
    Icon: Activity,
  },
  undefined: {
    pill: "bg-white/[0.02] text-white/30 border-white/[0.06]",
    dot: "bg-white/15",
    Icon: HelpCircle,
  },
};

export default function TrainingWeekSchedulePanel({
  schedule,
  loading = false,
  protocolDayNames,
  activeDow = null,
  onSelectDow,
}: Props) {
  const suggestion = useMemo(() => {
    if (!schedule || activeDow == null) return null;
    const entry = schedule.days.find((d) => d.dow === activeDow);
    if (!entry) return null;
    const name = suggestNutritionDayName(entry.kind, protocolDayNames);
    if (!name) return null;
    return { entry, name };
  }, [schedule, activeDow, protocolDayNames]);

  if (loading) {
    return (
      <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-3 animate-pulse space-y-2">
        <div className="h-2.5 w-40 rounded bg-white/[0.06]" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  if (!schedule) return null;

  const noProgram = !schedule.programId;

  return (
    <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Calendrier entraînement
          </p>
          {noProgram ? (
            <p className="text-[10px] text-white/40 mt-0.5">
              Aucun programme actif — jours affichés comme non définis.
            </p>
          ) : (
            <p className="text-[10px] text-white/50 mt-0.5">
              {schedule.programName}
              {schedule.sessionMode === "cycle"
                ? " · mode cycle (pas de jours fixes)"
                : ""}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {schedule.days.map((day) => {
          const style = KIND_STYLES[day.kind];
          const Icon = style.Icon;
          const isSelected = activeDow === day.dow;
          return (
            <button
              key={day.dow}
              type="button"
              disabled={!onSelectDow}
              onClick={() => onSelectDow?.(day.dow)}
              className={`rounded-lg border-[0.3px] px-1 py-1.5 text-center transition-all ${
                isSelected
                  ? "border-[#1f8a65]/40 bg-[#1f8a65]/10"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
              } ${onSelectDow ? "cursor-pointer" : "cursor-default"}`}
            >
              <p className="text-[9px] font-semibold text-white/70">{day.label}</p>
              <span
                className={`mt-1 inline-flex items-center gap-0.5 rounded-full border px-1 py-0.5 text-[7px] font-semibold leading-none ${style.pill}`}
              >
                <Icon size={8} />
              </span>
              <p className="text-[7px] text-white/35 mt-0.5 leading-tight line-clamp-2">
                {WEEKDAY_KIND_LABELS[day.kind]}
              </p>
            </button>
          );
        })}
      </div>

      {suggestion && (
        <p className="text-[10px] text-white/45 leading-snug">
          {suggestion.entry.label} : {WEEKDAY_KIND_LABELS[suggestion.entry.kind]}
          {suggestion.entry.sessionNames.length > 0 && (
            <> ({suggestion.entry.sessionNames.join(", ")})</>
          )}
          . Suggestion nutrition :{" "}
          <span className="text-[#6ee7b7] font-medium">{suggestion.name}</span>
        </p>
      )}
    </div>
  );
}
