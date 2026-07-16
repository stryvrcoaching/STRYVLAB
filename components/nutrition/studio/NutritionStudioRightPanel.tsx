"use client";

import ProtocolCanvas from "./ProtocolCanvas";
import NutritionAnalysisPanel from "./NutritionAnalysisPanel";
import NutritionProtocolBuilder from "./NutritionProtocolBuilder";
import type { NutritionRealityView } from "./useNutritionReality";
import type { DayDraft } from "@/lib/nutrition/types";
import type { TrainingWeekSchedule } from "@/lib/nutrition/training-week-schedule";
import type { MealPlanDuplicationMode } from "@/lib/nutrition/meal-plan-duplication";
import type { CoherenceScoreData, ScheduleSlotDraft, StudioShareIssue } from "./useNutritionStudio";
import type { CycleSyncAdjustment } from "@/lib/nutrition/engine/cycleSync";

export type NutritionStudioRightTab = "smartnutrition" | "builder" | "analysis";

type Props = {
  activeTab: NutritionStudioRightTab;
  onTabChange: (tab: NutritionStudioRightTab) => void;
  isSmartNutritionOpen?: boolean;
  analysis: {
    loading: boolean;
    error: string | null;
    activeWindow: 3 | 7;
    onWindowChange: (window: 3 | 7) => void;
    onOpenHub: () => void;
    view: NutritionRealityView | null;
  };
  protocol: {
    clientId: string;
    protocolId?: string | null;
    protocolStatus?: "draft" | "shared";
    smoothingDate?: string | null;
    loading: boolean;
    protocolName: string;
    layoutCase: "case_1" | "case_2" | "case_3" | "case_4";
    onProtocolNameChange: (v: string) => void;
    days: DayDraft[];
    activeDayIndex: number;
    onActiveDayChange: (i: number) => void;
    onUpdateDay: (index: number, patch: Partial<DayDraft>) => void;
    onAddDay: (name?: string) => void;
    onRemoveDay: (index: number) => void;
    onInjectMacros: (i: number) => void;
    onInjectHydration: (i: number) => void;
    onInjectAll: (i: number) => void;
    hasMacroResult: boolean;
    hasHydration: boolean;
    coherenceScore: CoherenceScoreData;
    shareIssues: StudioShareIssue[];
    trainingWeekSchedule: TrainingWeekSchedule | null;
    selectedScheduleDow: number | null;
    onSelectScheduleDow?: (dow: number | null) => void;
    scheduleSlots: ScheduleSlotDraft[];
    onScheduleSlotsChange: (slots: ScheduleSlotDraft[]) => void;
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
    onStartMealPlanDuplication?: (sourceDayIndex: number) => void;
    cycleAdjustment?: Pick<CycleSyncAdjustment, "proteinDelta" | "carbsDelta" | "fatDelta"> | null;
  };
};

export default function NutritionStudioRightPanel({
  activeTab,
  onTabChange,
  isSmartNutritionOpen = false,
  analysis,
  protocol,
}: Props) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b-[0.3px] border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-3 gap-1 rounded-lg border-[0.3px] border-white/[0.06] bg-white/[0.03] p-1">
            <button
              onClick={() => onTabChange("smartnutrition")}
              className={`h-8 rounded-md px-2.5 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors ${
                activeTab === "smartnutrition"
                  ? "bg-[#1f8a65] text-white"
                  : isSmartNutritionOpen && activeTab === "builder"
                    ? "bg-[#1f8a65]/[0.12] text-[#b8efd9]"
                  : "text-white/55 hover:bg-white/[0.05] hover:text-white/80"
              }`}
            >
              Pilotage nutritionnel
            </button>
            <button
              onClick={() => onTabChange("builder")}
              className={`h-8 rounded-md px-2.5 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors ${
                activeTab === "builder"
                  ? "bg-[#1f8a65] text-white"
                  : "text-white/55 hover:bg-white/[0.05] hover:text-white/80"
              }`}
            >
              Plan alimentaire
            </button>
            <button
              onClick={() => onTabChange("analysis")}
              className={`h-8 rounded-md px-2.5 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors ${
                activeTab === "analysis"
                  ? "bg-[#1f8a65] text-white"
                  : "text-white/55 hover:bg-white/[0.05] hover:text-white/80"
              }`}
            >
              Analyse nutritionnelle
            </button>
          </div>
        </div>
      </div>

      {activeTab === "analysis" ? (
        <NutritionAnalysisPanel
          loading={analysis.loading}
          error={analysis.error}
          activeWindow={analysis.activeWindow}
          onWindowChange={analysis.onWindowChange}
          onOpenHub={analysis.onOpenHub}
          view={analysis.view}
        />
      ) : activeTab === "builder" ? (
        <NutritionProtocolBuilder
          clientId={protocol.clientId}
          protocolId={protocol.protocolId}
          protocolStatus={protocol.protocolStatus}
          sourceDate={protocol.smoothingDate ?? null}
          protocolName={protocol.protocolName}
          layoutCase={protocol.layoutCase}
          days={protocol.days}
          activeDayIndex={protocol.activeDayIndex}
          onStartMealPlanDuplication={protocol.onStartMealPlanDuplication}
          onActiveDayChange={protocol.onActiveDayChange}
          onUpdateDay={protocol.onUpdateDay}
          cycleAdjustment={protocol.cycleAdjustment}
        />
      ) : (
        <ProtocolCanvas
          loading={protocol.loading}
          protocolName={protocol.protocolName}
          onProtocolNameChange={protocol.onProtocolNameChange}
          days={protocol.days}
          activeDayIndex={protocol.activeDayIndex}
          onActiveDayChange={protocol.onActiveDayChange}
          onUpdateDay={protocol.onUpdateDay}
          onAddDay={protocol.onAddDay}
          onRemoveDay={protocol.onRemoveDay}
          onInjectMacros={protocol.onInjectMacros}
          onInjectHydration={protocol.onInjectHydration}
          onInjectAll={protocol.onInjectAll}
          hasMacroResult={protocol.hasMacroResult}
          hasHydration={protocol.hasHydration}
          coherenceScore={protocol.coherenceScore}
          shareIssues={protocol.shareIssues}
          trainingWeekSchedule={protocol.trainingWeekSchedule}
          selectedScheduleDow={protocol.selectedScheduleDow}
          onSelectScheduleDow={protocol.onSelectScheduleDow}
          scheduleSlots={protocol.scheduleSlots}
          onScheduleSlotsChange={protocol.onScheduleSlotsChange}
          mealPlanDuplication={protocol.mealPlanDuplication}
        />
      )}
    </div>
  );
}
