"use client";

import { Fragment } from "react";
import type { DayDraft } from "@/lib/nutrition/types";
import type { TrainingWeekSchedule, WeekdayKind } from "@/lib/nutrition/training-week-schedule";
import type { ScheduleSlotDraft } from "./useNutritionStudio";

type Props = {
  days: DayDraft[];
  activeDayIndex: number;
  scheduleSlots: ScheduleSlotDraft[];
  onScheduleSlotsChange: (slots: ScheduleSlotDraft[]) => void;
  trainingWeekSchedule?: TrainingWeekSchedule | null;
};

const DOW_LABELS = ["L", "M", "M", "J", "V", "S", "D"] as const;

function slotKey(week_index: number, dow: number) {
  return `${week_index}-${dow}`;
}

function findDefaultDayIndex(days: DayDraft[], kind: WeekdayKind): number | null {
  const names = days.map((d) => d.name.toLowerCase());
  const trainingIdx = names.findIndex((n) =>
    ["entrainement", "entraînement", "training", "sport", "muscu"].some((x) => n.includes(x)),
  );
  const restIdx = names.findIndex((n) =>
    ["repos", "rest", "recovery", "off", "recup", "récup"].some((x) => n.includes(x)),
  );
  if (kind === "training" && trainingIdx >= 0) return trainingIdx;
  if ((kind === "rest" || kind === "rest_with_activity") && restIdx >= 0) return restIdx;
  return null;
}

export default function ProtocolScheduleHeatmap({
  days,
  activeDayIndex,
  scheduleSlots,
  onScheduleSlotsChange,
  trainingWeekSchedule = null,
}: Props) {
  const byCell = new Map(scheduleSlots.map((s) => [slotKey(s.week_index, s.dow), s.protocol_day_position]));

  const setCell = (week_index: number, dow: number, protocol_day_position: number) => {
    const filtered = scheduleSlots.filter((s) => !(s.week_index === week_index && s.dow === dow));
    filtered.push({ week_index, dow, protocol_day_position });
    onScheduleSlotsChange(filtered.sort((a, b) => a.week_index - b.week_index || a.dow - b.dow));
  };

  const clearAll = () => onScheduleSlotsChange([]);

  const duplicateWeek1 = () => {
    const week1 = scheduleSlots.filter((s) => s.week_index === 1);
    const duplicated: ScheduleSlotDraft[] = [];
    for (let w = 2; w <= 4; w++) {
      for (const s of week1) duplicated.push({ ...s, week_index: w });
    }
    const merged = [...week1, ...duplicated];
    onScheduleSlotsChange(merged.sort((a, b) => a.week_index - b.week_index || a.dow - b.dow));
  };

  const autofillFromTraining = () => {
    if (!trainingWeekSchedule) return;
    const next: ScheduleSlotDraft[] = [];
    for (let w = 1; w <= 4; w++) {
      for (const day of trainingWeekSchedule.days) {
        const idx = findDefaultDayIndex(days, day.kind);
        if (idx == null) continue;
        next.push({ week_index: w, dow: day.dow, protocol_day_position: idx });
      }
    }
    onScheduleSlotsChange(next);
  };

  return (
    <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">Planning nutrition 4 semaines</p>
          <p className="text-[10px] text-white/45 mt-0.5">Clique une case pour y affecter le jour protocole actif.</p>
        </div>
        <div className="flex gap-1">
          <button onClick={duplicateWeek1} className="px-2 py-1 rounded-md text-[9px] bg-white/[0.04] text-white/65 hover:bg-white/[0.08]">Dupliquer S1</button>
          <button onClick={autofillFromTraining} className="px-2 py-1 rounded-md text-[9px] bg-[#1f8a65]/15 text-[#6ee7b7] hover:bg-[#1f8a65]/25">Auto training</button>
          <button onClick={clearAll} className="px-2 py-1 rounded-md text-[9px] bg-red-500/10 text-red-300 hover:bg-red-500/20">Vider</button>
        </div>
      </div>

      <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1">
        <div />
        {DOW_LABELS.map((label, i) => (
          <div key={`${label}-${i}`} className="text-center text-[9px] text-white/35 font-semibold">{label}</div>
        ))}
        {Array.from({ length: 4 }).map((_, wIdx) => {
          const week = wIdx + 1;
          return (
            <Fragment key={`week-${week}`}>
              <div key={`w-label-${week}`} className="text-[9px] text-white/35 font-semibold pt-2">S{week}</div>
              {Array.from({ length: 7 }).map((__, dIdx) => {
                const dow = dIdx + 1;
                const assignedPos = byCell.get(slotKey(week, dow));
                const assignedDay = assignedPos != null ? days[assignedPos] : null;
                const isActive = assignedPos === activeDayIndex;
                return (
                  <button
                    key={`w${week}-d${dow}`}
                    type="button"
                    onClick={() => setCell(week, dow, activeDayIndex)}
                    className={`h-12 rounded-lg border-[0.3px] px-1 transition-all text-left ${
                      isActive
                        ? "border-[#1f8a65]/45 bg-[#1f8a65]/15"
                        : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                    title={assignedDay ? `${assignedDay.name}` : "Non assigné"}
                  >
                    <div className="text-[8px] text-white/35 leading-none">{dow}</div>
                    <div className="mt-1 text-[8px] font-semibold text-white/80 leading-tight line-clamp-2">
                      {assignedDay ? assignedDay.name : "—"}
                    </div>
                  </button>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
