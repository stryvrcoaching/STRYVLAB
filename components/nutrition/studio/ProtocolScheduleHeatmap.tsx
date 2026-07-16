"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  NUTRITION_DAY_ROLE_LABELS,
  getNutritionDayIndexesByRole,
} from "@/lib/nutrition/day-role";
import type { DayDraft } from "@/lib/nutrition/types";
import type { TrainingWeekSchedule, WeekdayKind } from "@/lib/nutrition/training-week-schedule";
import type { MealPlanDuplicationMode } from "@/lib/nutrition/meal-plan-duplication";
import type { ScheduleSlotDraft } from "./useNutritionStudio";

type Props = {
  days: DayDraft[];
  activeDayIndex: number;
  scheduleSlots: ScheduleSlotDraft[];
  onScheduleSlotsChange: (slots: ScheduleSlotDraft[]) => void;
  trainingWeekSchedule?: TrainingWeekSchedule | null;
  mealPlanDuplication?: {
    sourceDayIndex: number;
    selectedTargetDayIndexes: number[];
    mode: MealPlanDuplicationMode;
    replaceExisting: boolean;
    onToggleTargetDay: (dayIndex: number) => void;
    onModeChange: (mode: MealPlanDuplicationMode) => void;
    onReplaceExistingChange: (value: boolean) => void;
    onApply: () => void;
    onCancel: () => void;
  } | null;
};

const DOW_LABELS = ["L", "M", "M", "J", "V", "S", "D"] as const;

function slotKey(week_index: number, dow: number) {
  return `${week_index}-${dow}`;
}

export function findDefaultDayIndex(days: DayDraft[], kind: WeekdayKind): number | null {
  if (kind === "training") return getNutritionDayIndexesByRole(days, "training")[0] ?? null;
  if (kind === "rest" || kind === "rest_with_activity") {
    return getNutritionDayIndexesByRole(days, "rest")[0] ?? null;
  }
  return null;
}

type PendingRoleResolution = {
  selectedTraining: number | null;
  selectedRest: number | null;
  trainingOptions: number[];
  restOptions: number[];
};

type DragMode = "assign" | "clear";

function requiresRestRole(kind: WeekdayKind) {
  return kind === "rest" || kind === "rest_with_activity";
}

function hasMealPlanContent(day: DayDraft) {
  return day.meal_plan.some((meal) => meal.items.length > 0);
}

export default function ProtocolScheduleHeatmap({
  days,
  activeDayIndex,
  scheduleSlots,
  onScheduleSlotsChange,
  trainingWeekSchedule = null,
  mealPlanDuplication = null,
}: Props) {
  const [pendingRoleResolution, setPendingRoleResolution] = useState<PendingRoleResolution | null>(null);
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [dragVisited, setDragVisited] = useState<Set<string>>(new Set());
  const dragTriggeredRef = useRef(false);
  const byCell = new Map(scheduleSlots.map((s) => [slotKey(s.week_index, s.dow), s.protocol_day_position]));
  const trainingOptions = useMemo(() => getNutritionDayIndexesByRole(days, "training"), [days]);
  const restOptions = useMemo(() => getNutritionDayIndexesByRole(days, "rest"), [days]);
  const isMealPlanDuplicationMode = mealPlanDuplication !== null;
  const selectedTargetDayIndexes = new Set(mealPlanDuplication?.selectedTargetDayIndexes ?? []);
  const selectedTargetDays = (mealPlanDuplication?.selectedTargetDayIndexes ?? [])
    .map((index) => days[index])
    .filter((day): day is DayDraft => Boolean(day));
  const selectedExistingPlans = selectedTargetDays.filter(hasMealPlanContent).length;

  const setCell = (week_index: number, dow: number, protocol_day_position: number) => {
    const current = scheduleSlots.find((s) => s.week_index === week_index && s.dow === dow);
    const filtered = scheduleSlots.filter((s) => !(s.week_index === week_index && s.dow === dow));

    if (current?.protocol_day_position === protocol_day_position) {
      onScheduleSlotsChange(filtered.sort((a, b) => a.week_index - b.week_index || a.dow - b.dow));
      return;
    }

    filtered.push({ week_index, dow, protocol_day_position });
    onScheduleSlotsChange(filtered.sort((a, b) => a.week_index - b.week_index || a.dow - b.dow));
  };

  const clearAll = () => onScheduleSlotsChange([]);

  useEffect(() => {
    if (!dragMode) return;

    const stopDragging = () => {
      setDragMode(null);
      setDragVisited(new Set());
      window.setTimeout(() => {
        dragTriggeredRef.current = false;
      }, 0);
    };

    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("dragend", stopDragging);
    return () => {
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("dragend", stopDragging);
    };
  }, [dragMode]);

  const applyDragToCell = (week_index: number, dow: number, mode: DragMode) => {
    const key = slotKey(week_index, dow);
    if (dragVisited.has(key)) return;

    setDragVisited((prev) => new Set(prev).add(key));

    const current = byCell.get(key);
    if (mode === "clear") {
      if (current === activeDayIndex) {
        const filtered = scheduleSlots.filter((s) => !(s.week_index === week_index && s.dow === dow));
        onScheduleSlotsChange(filtered.sort((a, b) => a.week_index - b.week_index || a.dow - b.dow));
      }
      return;
    }

    if (current !== activeDayIndex) {
      setCell(week_index, dow, activeDayIndex);
    }
  };

  const startDrag = (week_index: number, dow: number) => {
    const current = byCell.get(slotKey(week_index, dow));
    const nextMode: DragMode = current === activeDayIndex ? "clear" : "assign";
    dragTriggeredRef.current = true;
    setDragVisited(new Set());
    setDragMode(nextMode);
    applyDragToCell(week_index, dow, nextMode);
  };

  const duplicateWeek1 = () => {
    const week1 = scheduleSlots.filter((s) => s.week_index === 1);
    const duplicated: ScheduleSlotDraft[] = [];
    for (let w = 2; w <= 4; w++) {
      for (const s of week1) duplicated.push({ ...s, week_index: w });
    }
    const merged = [...week1, ...duplicated];
    onScheduleSlotsChange(merged.sort((a, b) => a.week_index - b.week_index || a.dow - b.dow));
  };

  const applyAutofill = (selectedTraining: number | null, selectedRest: number | null) => {
    if (!trainingWeekSchedule) return;
    const next: ScheduleSlotDraft[] = [];
    for (let w = 1; w <= 4; w++) {
      for (const day of trainingWeekSchedule.days) {
        const idx =
          day.kind === "training"
            ? selectedTraining
            : requiresRestRole(day.kind)
              ? selectedRest
              : null;
        if (idx == null) continue;
        next.push({ week_index: w, dow: day.dow, protocol_day_position: idx });
      }
    }
    setPendingRoleResolution(null);
    setAutoFillMessage(null);
    onScheduleSlotsChange(next);
  };

  const autofillFromTraining = () => {
    if (!trainingWeekSchedule) return;

    const needsTraining = trainingWeekSchedule.days.some((day) => day.kind === "training");
    const needsRest = trainingWeekSchedule.days.some((day) => requiresRestRole(day.kind));

    if (needsTraining && trainingOptions.length === 0) {
      setPendingRoleResolution(null);
      setAutoFillMessage("Aucun jour du protocole n'est marqué comme Entraînement.");
      return;
    }

    if (needsRest && restOptions.length === 0) {
      setPendingRoleResolution(null);
      setAutoFillMessage("Aucun jour du protocole n'est marqué comme Repos.");
      return;
    }

    const trainingAmbiguous = needsTraining && trainingOptions.length > 1;
    const restAmbiguous = needsRest && restOptions.length > 1;

    if (trainingAmbiguous || restAmbiguous) {
      setAutoFillMessage(null);
      setPendingRoleResolution({
        selectedTraining: !trainingAmbiguous ? (trainingOptions[0] ?? null) : null,
        selectedRest: !restAmbiguous ? (restOptions[0] ?? null) : null,
        trainingOptions,
        restOptions,
      });
      return;
    }

    applyAutofill(trainingOptions[0] ?? null, restOptions[0] ?? null);
  };

  return (
    <div className={`rounded-xl border-[0.3px] p-3 space-y-3 transition-colors ${
      isMealPlanDuplicationMode
        ? "border-[#1f8a65]/45 bg-[#1f8a65]/[0.07] ring-1 ring-[#1f8a65]/20"
        : "border-white/[0.06] bg-white/[0.02]"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">Planning nutrition 4 semaines</p>
          <p className="text-[10px] text-white/45 mt-0.5">
            {isMealPlanDuplicationMode
              ? "Mode duplication : sélectionne les journées types qui doivent recevoir ce plan."
              : "Clique ou glisse pour affecter le jour actif. Re-clique ou re-glisse pour retirer."}
          </p>
        </div>
        {!isMealPlanDuplicationMode && (
          <div className="flex gap-1">
            <button onClick={duplicateWeek1} className="px-2 py-1 rounded-md text-[9px] bg-white/[0.04] text-white/65 hover:bg-white/[0.08]">Dupliquer S1</button>
            <button onClick={autofillFromTraining} className="px-2 py-1 rounded-md text-[9px] bg-[#1f8a65]/15 text-[#6ee7b7] hover:bg-[#1f8a65]/25">Auto entraînement</button>
            <button onClick={clearAll} className="px-2 py-1 rounded-md text-[9px] bg-red-500/10 text-red-300 hover:bg-red-500/20">Vider</button>
          </div>
        )}
      </div>

      {mealPlanDuplication && (
        <div className="space-y-2 rounded-lg border border-[#1f8a65]/25 bg-black/15 p-3">
          <p className="text-[10px] font-semibold text-[#a8e7c8]">
            Plan source : {days[mealPlanDuplication.sourceDayIndex]?.name ?? "Jour actif"}
          </p>
          <p className="text-[9px] leading-relaxed text-white/55">
            Une journée type peut apparaître plusieurs fois dans le calendrier : une seule sélection suffit pour appliquer le plan à toutes ses occurrences.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => mealPlanDuplication.onModeChange('adapt_to_target')}
              className={`rounded-md border px-2 py-1.5 text-left text-[9px] font-semibold transition-colors ${
                mealPlanDuplication.mode === 'adapt_to_target'
                  ? "border-[#86aeb8]/45 bg-[#86aeb8]/15 text-[#c6dce2]"
                  : "border-white/[0.08] bg-white/[0.03] text-white/50"
              }`}
            >
              Adapter aux objectifs
            </button>
            <button
              type="button"
              onClick={() => mealPlanDuplication.onModeChange('exact_copy')}
              className={`rounded-md border px-2 py-1.5 text-left text-[9px] font-semibold transition-colors ${
                mealPlanDuplication.mode === 'exact_copy'
                  ? "border-[#86aeb8]/45 bg-[#86aeb8]/15 text-[#c6dce2]"
                  : "border-white/[0.08] bg-white/[0.03] text-white/50"
              }`}
            >
              Copie identique
            </button>
          </div>
          {selectedExistingPlans > 0 && (
            <button
              type="button"
              role="switch"
              aria-checked={mealPlanDuplication.replaceExisting}
              onClick={() => mealPlanDuplication.onReplaceExistingChange(!mealPlanDuplication.replaceExisting)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-left"
            >
              <span className="text-[9px] text-white/60">
                {mealPlanDuplication.replaceExisting
                  ? `Remplacer ${selectedExistingPlans} plan${selectedExistingPlans > 1 ? 's' : ''} existant${selectedExistingPlans > 1 ? 's' : ''}`
                  : `${selectedExistingPlans} plan${selectedExistingPlans > 1 ? 's' : ''} existant${selectedExistingPlans > 1 ? 's' : ''} protégé${selectedExistingPlans > 1 ? 's' : ''}`}
              </span>
              <span className={`relative h-3.5 w-7 rounded-full transition-colors ${mealPlanDuplication.replaceExisting ? 'bg-red-500/80' : 'bg-white/[0.12]'}`}>
                <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${mealPlanDuplication.replaceExisting ? 'left-4' : 'left-0.5'}`} />
              </span>
            </button>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[9px] text-white/45">
              {selectedTargetDays.length} journée{selectedTargetDays.length > 1 ? 's' : ''} sélectionnée{selectedTargetDays.length > 1 ? 's' : ''}
            </span>
            <div className="flex gap-1.5">
              <button type="button" onClick={mealPlanDuplication.onCancel} className="rounded-md px-2 py-1.5 text-[9px] font-semibold text-white/55 hover:bg-white/[0.06]">
                Annuler
              </button>
              <button
                type="button"
                onClick={mealPlanDuplication.onApply}
                disabled={selectedTargetDays.length === 0}
                className="rounded-md bg-[#1f8a65] px-2.5 py-1.5 text-[9px] font-bold text-white hover:bg-[#217356] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Dupliquer le plan
              </button>
            </div>
          </div>
        </div>
      )}

      {autoFillMessage && (
        <div className="rounded-lg border-[0.3px] border-amber-500/20 bg-amber-500/[0.08] px-3 py-2 text-[10px] text-amber-200/85">
          {autoFillMessage}
        </div>
      )}

      {pendingRoleResolution && (
        <div className="space-y-2 rounded-lg border-[0.3px] border-[#1f8a65]/20 bg-[#1f8a65]/[0.06] px-3 py-3">
          <p className="text-[10px] font-semibold text-white/80">
            Plusieurs jours correspondent au même rôle. Choisis lesquels utiliser pour l'auto-remplissage.
          </p>

          {pendingRoleResolution.trainingOptions.length > 1 && (
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-[0.12em] text-white/35">
                {NUTRITION_DAY_ROLE_LABELS.training}
              </p>
              <div className="flex flex-wrap gap-1">
                {pendingRoleResolution.trainingOptions.map((index) => (
                  <button
                    key={`training-${days[index]?.localId ?? index}`}
                    type="button"
                    onClick={() => setPendingRoleResolution((prev) => prev ? { ...prev, selectedTraining: index } : prev)}
                    className={`rounded-md border-[0.3px] px-2 py-1 text-[10px] font-semibold transition-all ${
                      pendingRoleResolution.selectedTraining === index
                        ? "border-[#1f8a65]/45 bg-[#1f8a65]/15 text-[#6ee7b7]"
                        : "border-white/[0.08] bg-white/[0.03] text-white/55 hover:bg-white/[0.05]"
                    }`}
                  >
                    {days[index]?.name ?? `Jour ${index + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pendingRoleResolution.restOptions.length > 1 && (
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-[0.12em] text-white/35">
                {NUTRITION_DAY_ROLE_LABELS.rest}
              </p>
              <div className="flex flex-wrap gap-1">
                {pendingRoleResolution.restOptions.map((index) => (
                  <button
                    key={`rest-${days[index]?.localId ?? index}`}
                    type="button"
                    onClick={() => setPendingRoleResolution((prev) => prev ? { ...prev, selectedRest: index } : prev)}
                    className={`rounded-md border-[0.3px] px-2 py-1 text-[10px] font-semibold transition-all ${
                      pendingRoleResolution.selectedRest === index
                        ? "border-[#1f8a65]/45 bg-[#1f8a65]/15 text-[#6ee7b7]"
                        : "border-white/[0.08] bg-white/[0.03] text-white/55 hover:bg-white/[0.05]"
                    }`}
                  >
                    {days[index]?.name ?? `Jour ${index + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                applyAutofill(
                  pendingRoleResolution.selectedTraining,
                  pendingRoleResolution.selectedRest,
                )
              }
              disabled={
                (pendingRoleResolution.trainingOptions.length > 1 && pendingRoleResolution.selectedTraining == null)
                || (pendingRoleResolution.restOptions.length > 1 && pendingRoleResolution.selectedRest == null)
              }
              className="rounded-md bg-[#1f8a65] px-3 py-1.5 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Appliquer
            </button>
            <button
              type="button"
              onClick={() => setPendingRoleResolution(null)}
              className="rounded-md border-[0.3px] border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-white/60"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1 select-none">
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
                const cellKey = slotKey(week, dow);
                const assignedPos = byCell.get(cellKey);
                const assignedDay = assignedPos != null ? days[assignedPos] : null;
                const isActive = assignedPos === activeDayIndex;
                const isVisitedInDrag = dragVisited.has(cellKey);
                const isPreviewAssign = dragMode === "assign" && isVisitedInDrag;
                const isPreviewClear = dragMode === "clear" && isVisitedInDrag;
                const isDuplicationSource = isMealPlanDuplicationMode && assignedPos === mealPlanDuplication?.sourceDayIndex;
                const isDuplicationTarget = isMealPlanDuplicationMode && assignedPos != null && selectedTargetDayIndexes.has(assignedPos);
                return (
                  <button
                    key={`w${week}-d${dow}`}
                    type="button"
                    onClick={() => {
                      if (mealPlanDuplication) {
                        if (assignedPos != null && assignedPos !== mealPlanDuplication.sourceDayIndex) {
                          mealPlanDuplication.onToggleTargetDay(assignedPos);
                        }
                        return;
                      }
                      if (dragTriggeredRef.current) return;
                      setCell(week, dow, activeDayIndex);
                    }}
                    onMouseDown={() => {
                      if (!mealPlanDuplication) startDrag(week, dow);
                    }}
                    onMouseEnter={() => {
                      if (!mealPlanDuplication && dragMode) applyDragToCell(week, dow, dragMode);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (mealPlanDuplication) {
                          if (assignedPos != null && assignedPos !== mealPlanDuplication.sourceDayIndex) {
                            mealPlanDuplication.onToggleTargetDay(assignedPos);
                          }
                          return;
                        }
                        setCell(week, dow, activeDayIndex);
                      }
                    }}
                    className={`h-12 rounded-lg border-[0.3px] px-1 transition-all text-left ${
                      isDuplicationSource
                        ? "border-[#1f8a65]/70 bg-[#1f8a65]/20"
                        : isDuplicationTarget
                          ? "border-[#86aeb8]/70 bg-[#86aeb8]/20"
                        : isMealPlanDuplicationMode && assignedPos == null
                          ? "border-white/[0.05] bg-white/[0.015] opacity-45"
                          : isPreviewClear
                        ? "border-red-400/45 bg-red-500/10"
                        : isPreviewAssign
                          ? "border-[#6ee7b7]/55 bg-[#1f8a65]/22"
                          : isActive
                            ? "border-[#1f8a65]/45 bg-[#1f8a65]/15"
                            : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                    title={
                      isDuplicationSource
                        ? `${assignedDay?.name ?? "Jour"} — plan source`
                        : isDuplicationTarget
                          ? `${assignedDay?.name ?? "Jour"} — sélectionné`
                          : assignedDay
                            ? `${assignedDay.name}`
                            : "Non assigné"
                    }
                  >
                    <div className="text-[8px] text-white/35 leading-none">{dow}</div>
                    <div className="mt-1 text-[8px] font-semibold text-white/80 leading-tight line-clamp-2">
                      {isDuplicationSource
                        ? "Plan source"
                        : isDuplicationTarget
                          ? "Sélectionné"
                          : isPreviewClear
                            ? "Retirer"
                            : assignedDay
                              ? assignedDay.name
                              : isPreviewAssign
                                ? days[activeDayIndex]?.name ?? "—"
                                : "—"}
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
