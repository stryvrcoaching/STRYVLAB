"use client";

import { BarChart3, Sparkles } from "lucide-react";
import ProtocolCanvas from "./ProtocolCanvas";
import NutritionAnalysisPanel from "./NutritionAnalysisPanel";
import type { NutritionRealityView } from "./useNutritionReality";
import type { DayDraft } from "@/lib/nutrition/types";
import type { TrainingWeekSchedule } from "@/lib/nutrition/training-week-schedule";
import type { CoherenceScoreData, ScheduleSlotDraft, StudioShareIssue } from "./useNutritionStudio";

export type NutritionStudioRightTab = "smartnutrition" | "analysis";

type Props = {
  activeTab: NutritionStudioRightTab;
  onTabChange: (tab: NutritionStudioRightTab) => void;
  analysis: {
    loading: boolean;
    error: string | null;
    activeWindow: 3 | 7;
    onWindowChange: (window: 3 | 7) => void;
    onOpenHub: () => void;
    view: NutritionRealityView | null;
  };
  protocol: {
    loading: boolean;
    protocolName: string;
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
    onSelectScheduleDow?: (dow: number) => void;
    scheduleSlots: ScheduleSlotDraft[];
    onScheduleSlotsChange: (slots: ScheduleSlotDraft[]) => void;
  };
};

export default function NutritionStudioRightPanel({
  activeTab,
  onTabChange,
  analysis,
  protocol,
}: Props) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b-[0.3px] border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {activeTab === "analysis" ? (
              <BarChart3 size={12} className="text-[#1f8a65]" />
            ) : (
              <Sparkles size={12} className="text-[#1f8a65]" />
            )}
            <span className="text-[11px] font-semibold text-white/52">Insights</span>
          </div>
          <div className="flex items-center rounded-lg border-[0.3px] border-white/[0.06] bg-white/[0.03] p-0.5">
            <button
              onClick={() => onTabChange("smartnutrition")}
              className={`h-6 rounded-md px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
                activeTab === "smartnutrition"
                  ? "bg-[#1f8a65] text-white"
                  : "text-white/35 hover:text-white/65"
              }`}
            >
              Smart Nutrition
            </button>
            <button
              onClick={() => onTabChange("analysis")}
              className={`h-6 rounded-md px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
                activeTab === "analysis"
                  ? "bg-[#1f8a65] text-white"
                  : "text-white/35 hover:text-white/65"
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
        />
      )}
    </div>
  );
}
