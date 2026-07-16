"use client";

import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { detectCurrentPhase, getCycleSyncAdjustment } from "@/lib/nutrition/engine/cycleSync";
import { getEffectiveCycleSyncAdjustment } from "@/lib/nutrition/cycle-sync-profile";
import {
  duplicateMealPlanToDays,
  type MealPlanDuplicationMode,
} from "@/lib/nutrition/meal-plan-duplication";
import { Save, Send, Loader2, ArrowLeft, PanelLeftClose, PanelLeftOpen, RotateCcw } from "lucide-react";
import { useNutritionStudio } from "./useNutritionStudio";
import ClientIntelligencePanel from "./ClientIntelligencePanel";
import CalculationEngine from "./CalculationEngine";
import ProtocolCanvas from "./ProtocolCanvas";
import NutritionStudioRightPanel, {
  type NutritionStudioRightTab,
} from "./NutritionStudioRightPanel";
import ClientPreviewModal from "./ClientPreviewModal";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import ClientTopBarLeft from "@/components/clients/ClientTopBarLeft";
import { useClient } from "@/lib/client-context";
import type { NutritionProtocol } from "@/lib/nutrition/types";
import { useRouter, useSearchParams } from "next/navigation";
import type { MissingDataKey } from "./missingData";
import { useNutritionReality } from "./useNutritionReality";
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/lib/client/browserStorage";
import ActionFeedbackBadge from "@/components/ui/ActionFeedbackBadge";
import useTimedActionFeedback from "@/components/ui/useTimedActionFeedback";
import { publishClientImpact } from "@/lib/coach/client-impact-events";

interface Props {
  clientId: string;
  existingProtocol?: NutritionProtocol;
}

type BuilderLayoutCase = "case_1" | "case_2" | "case_3" | "case_4";

type MealPlanDuplicationSession = {
  sourceDayIndex: number;
  selectedTargetDayIndexes: number[];
  mode: MealPlanDuplicationMode;
  replaceExisting: boolean;
};

const BUILDER_LAYOUT_STORAGE_PREFIX = "nutrition-studio-layout";
const WORKSPACE_PREFS_STORAGE_PREFIX = "nutrition-studio-workspace";

const BUILDER_CASE_PRESETS: Record<
  BuilderLayoutCase,
  {
    clientCollapsed: boolean;
    calculationCollapsed: boolean;
    smartCollapsed: boolean;
    clientWidth: number;
    calculationWidth: number;
    contextWidth: number;
  }
> = {
  case_1: {
    clientCollapsed: false,
    calculationCollapsed: false,
    smartCollapsed: false,
    clientWidth: 16,
    calculationWidth: 27,
    contextWidth: 29,
  },
  case_2: {
    clientCollapsed: true,
    calculationCollapsed: false,
    smartCollapsed: false,
    clientWidth: 4,
    calculationWidth: 24,
    contextWidth: 26,
  },
  case_3: {
    clientCollapsed: true,
    calculationCollapsed: true,
    smartCollapsed: false,
    clientWidth: 4,
    calculationWidth: 4,
    contextWidth: 38,
  },
  case_4: {
    clientCollapsed: true,
    calculationCollapsed: true,
    smartCollapsed: true,
    clientWidth: 4,
    calculationWidth: 4,
    contextWidth: 4,
  },
};

function deriveProtocolLayoutCase(input: {
  clientCollapsed: boolean;
  calculationCollapsed: boolean;
  smartCollapsed: boolean;
}): BuilderLayoutCase {
  if (input.smartCollapsed) return "case_4";
  if (input.calculationCollapsed && input.clientCollapsed) return "case_3";
  if (input.clientCollapsed) return "case_2";
  return "case_1";
}

export default function NutritionStudio({ clientId, existingProtocol }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { client } = useClient();
  const studio = useNutritionStudio(clientId, existingProtocol);

  useEffect(() => {
    if (!studio.macroResult) return;
    publishClientImpact({
      clientId,
      kind: "nutrition-draft",
      nutrition: {
        calories: studio.macroResult.calories,
        protein: studio.macroResult.macros.p,
        carbs: studio.macroResult.macros.c,
        fat: studio.macroResult.macros.f,
        tdee: studio.macroResult.tdee,
      },
    });
  }, [clientId, studio.macroResult]);

  useEffect(() => () => publishClientImpact({ clientId, kind: "clear-nutrition-draft" }), [clientId]);
  const workspacePrefsStorageKey = useMemo(
    () => `${WORKSPACE_PREFS_STORAGE_PREFIX}:${clientId}`,
    [clientId],
  );
  const readWorkspacePrefs = useCallback(() => {
    const raw = readLocalStorage(workspacePrefsStorageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as {
        realityWindow?: 3 | 7;
        rightTab?: NutritionStudioRightTab;
        col1Width?: number;
        col3Width?: number;
        clientPanelCollapsed?: boolean;
        calculationPanelCollapsed?: boolean;
        smartNutritionPanelCollapsed?: boolean;
      };
    } catch {
      return null;
    }
  }, [workspacePrefsStorageKey]);
  const [realityWindow, setRealityWindow] = useState<3 | 7>(() => {
    const prefs = readWorkspacePrefs();
    return prefs?.realityWindow === 3 ? 3 : 7;
  });
  const [rightTab, setRightTab] = useState<NutritionStudioRightTab>(() => {
    const prefs = readWorkspacePrefs();
    return prefs?.rightTab === "analysis" || prefs?.rightTab === "builder" || prefs?.rightTab === "smartnutrition"
      ? prefs.rightTab
      : "smartnutrition";
  });
  const [focusMissingDataKey, setFocusMissingDataKey] =
    useState<MissingDataKey | null>(null);
  const { feedback: headerFeedback, pushFeedback: pushHeaderFeedback } =
    useTimedActionFeedback<null>();
  const nutritionReality = useNutritionReality(clientId, realityWindow);
  const searchKey = searchParams.toString();
  const requestedTab = searchParams.get("tab");
  const smoothingDate = searchParams.get("smoothingDate")?.trim() || null;

  useEffect(() => {
    if (requestedTab === "builder" || smoothingDate) {
      setRightTab("builder");
      return;
    }
    if (requestedTab === "analysis") {
      setRightTab("analysis");
      return;
    }
    if (requestedTab === "smartnutrition") {
      setRightTab("smartnutrition");
    }
  }, [requestedTab, searchKey, smoothingDate]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ─── Resizable columns ────────────────────────────────────────────────────
  const [col1Width, setCol1Width] = useState(() => readWorkspacePrefs()?.col1Width ?? 22); // % of total
  const [col3Width, setCol3Width] = useState(() => readWorkspacePrefs()?.col3Width ?? 38); // % of total
  const [clientPanelCollapsed, setClientPanelCollapsed] = useState(() => readWorkspacePrefs()?.clientPanelCollapsed ?? false);
  const [calculationPanelCollapsed, setCalculationPanelCollapsed] = useState(() => readWorkspacePrefs()?.calculationPanelCollapsed ?? false);
  const [smartNutritionPanelCollapsed, setSmartNutritionPanelCollapsed] = useState(() => readWorkspacePrefs()?.smartNutritionPanelCollapsed ?? false);
  const [builderCalculationWidth, setBuilderCalculationWidth] = useState(26);
  const [builderContextWidth, setBuilderContextWidth] = useState(35);
  const [mealPlanDuplication, setMealPlanDuplication] = useState<MealPlanDuplicationSession | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"left" | "right" | "builderCalculation" | "builderContext" | null>(null);
  const startXRef = useRef(0);
  const startCol1Ref = useRef(22);
  const startCol3Ref = useRef(38);
  const startBuilderCalculationWidthRef = useRef(26);
  const startBuilderContextWidthRef = useRef(35);
  const builderLayoutStorageKey = useMemo(
    () => `${BUILDER_LAYOUT_STORAGE_PREFIX}:${clientId}:${existingProtocol?.id ?? "draft"}`,
    [clientId, existingProtocol?.id],
  );
  const activeBuilderLayoutCase = useMemo(
    () =>
      deriveProtocolLayoutCase({
        clientCollapsed: clientPanelCollapsed,
        calculationCollapsed: calculationPanelCollapsed,
        smartCollapsed: smartNutritionPanelCollapsed,
      }),
    [calculationPanelCollapsed, clientPanelCollapsed, smartNutritionPanelCollapsed],
  );
  const previousRightTabRef = useRef<NutritionStudioRightTab>(rightTab);
  const isBuilderContextResizeEnabled =
    rightTab === "builder" &&
    calculationPanelCollapsed &&
    !smartNutritionPanelCollapsed;
  const isBuilderCalculationResizeEnabled =
    rightTab === "builder" &&
    !calculationPanelCollapsed &&
    !smartNutritionPanelCollapsed;
  const isBuilderClientResizeEnabled =
    rightTab === "builder" &&
    !clientPanelCollapsed &&
    calculationPanelCollapsed &&
    !smartNutritionPanelCollapsed;

  const startMealPlanDuplication = useCallback((sourceDayIndex: number) => {
    const sourceDay = studio.days[sourceDayIndex];
    if (!sourceDay?.meal_plan.some((meal) => meal.items.length > 0)) return;
    setSmartNutritionPanelCollapsed(false);
    setMealPlanDuplication({
      sourceDayIndex,
      selectedTargetDayIndexes: [],
      mode: 'adapt_to_target',
      replaceExisting: false,
    });
  }, [studio.days]);

  const toggleMealPlanDuplicationTarget = useCallback((dayIndex: number) => {
    setMealPlanDuplication((current) => {
      if (!current || dayIndex === current.sourceDayIndex) return current;
      const selectedTargetDayIndexes = current.selectedTargetDayIndexes.includes(dayIndex)
        ? current.selectedTargetDayIndexes.filter((index) => index !== dayIndex)
        : [...current.selectedTargetDayIndexes, dayIndex];
      return { ...current, selectedTargetDayIndexes };
    });
  }, []);

  const applyMealPlanDuplication = useCallback(() => {
    if (!mealPlanDuplication) return;
    const sourceDay = studio.days[mealPlanDuplication.sourceDayIndex];
    if (!sourceDay) return;
    const selectedTargets = mealPlanDuplication.selectedTargetDayIndexes
      .filter((dayIndex) => dayIndex !== mealPlanDuplication.sourceDayIndex)
      .map((dayIndex) => ({ dayIndex, day: studio.days[dayIndex] }))
      .filter((target): target is { dayIndex: number; day: typeof sourceDay } => Boolean(target.day));
    const targets = mealPlanDuplication.replaceExisting
      ? selectedTargets
      : selectedTargets.filter(({ day }) => !day.meal_plan.some((meal) => meal.items.length > 0));

    if (targets.length === 0) {
      pushHeaderFeedback(null, 'error', 'Aucune journée vide sélectionnée. Active le remplacement pour écraser un plan existant.');
      return;
    }

    const results = duplicateMealPlanToDays({
      sourceDay,
      targets,
      mode: mealPlanDuplication.mode,
    });
    results.forEach(({ dayIndex, mealPlan }) => studio.updateDay(dayIndex, { meal_plan: mealPlan }));
    const firstWarning = results.flatMap((result) => result.warnings)[0];
    setMealPlanDuplication(null);
    pushHeaderFeedback(
      null,
      firstWarning ? 'error' : 'success',
      firstWarning
        ? `Plan dupliqué sur ${results.length} journée${results.length > 1 ? 's' : ''} : ${firstWarning}`
        : `Plan dupliqué sur ${results.length} journée${results.length > 1 ? 's' : ''}.`,
    );
  }, [mealPlanDuplication, pushHeaderFeedback, studio.days, studio.updateDay]);

  const mealPlanDuplicationControls = mealPlanDuplication ? {
    ...mealPlanDuplication,
    onToggleTargetDay: toggleMealPlanDuplicationTarget,
    onModeChange: (mode: MealPlanDuplicationMode) => setMealPlanDuplication((current) => current ? { ...current, mode } : null),
    onReplaceExistingChange: (replaceExisting: boolean) => setMealPlanDuplication((current) => current ? { ...current, replaceExisting } : null),
    onApply: applyMealPlanDuplication,
    onCancel: () => setMealPlanDuplication(null),
  } : null;

  useEffect(() => {
    const previousRightTab = previousRightTabRef.current;

    if (rightTab === "builder" && previousRightTab !== "builder") {
      setClientPanelCollapsed(true);
      setCalculationPanelCollapsed(true);
      setSmartNutritionPanelCollapsed(false);
      setCol1Width(BUILDER_CASE_PRESETS.case_3.clientWidth);
      setBuilderCalculationWidth(BUILDER_CASE_PRESETS.case_3.calculationWidth);

      try {
        const raw = window.localStorage.getItem(builderLayoutStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            case_3?: { contextWidth?: number };
          };
          const savedContextWidth = parsed.case_3?.contextWidth;
          if (typeof savedContextWidth === "number") {
            setBuilderContextWidth(savedContextWidth);
          } else {
            setBuilderContextWidth(BUILDER_CASE_PRESETS.case_3.contextWidth);
          }
        } else {
          setBuilderContextWidth(BUILDER_CASE_PRESETS.case_3.contextWidth);
        }
      } catch {
        setBuilderContextWidth(BUILDER_CASE_PRESETS.case_3.contextWidth);
      }
    } else if (rightTab === "smartnutrition") {
      setClientPanelCollapsed(false);
      setCalculationPanelCollapsed(false);
      setSmartNutritionPanelCollapsed(false);
      setCol1Width(22);
      setCol3Width(38);
      setBuilderCalculationWidth(26);
      setBuilderContextWidth(35);
    } else if (rightTab === "analysis") {
      setClientPanelCollapsed(false);
      setCalculationPanelCollapsed(false);
      setSmartNutritionPanelCollapsed(false);
      setCol1Width(22);
      setCol3Width(38);
      setBuilderCalculationWidth(26);
      setBuilderContextWidth(35);
    }

    previousRightTabRef.current = rightTab;
  }, [builderLayoutStorageKey, rightTab]);

  useEffect(() => {
    writeLocalStorage(
      workspacePrefsStorageKey,
      JSON.stringify({
        realityWindow,
        rightTab,
        col1Width,
        col3Width,
        clientPanelCollapsed,
        calculationPanelCollapsed,
        smartNutritionPanelCollapsed,
      }),
    );
  }, [
    calculationPanelCollapsed,
    clientPanelCollapsed,
    col1Width,
    col3Width,
    realityWindow,
    rightTab,
    smartNutritionPanelCollapsed,
    workspacePrefsStorageKey,
  ]);

  useEffect(() => {
    if (rightTab !== "builder" || !isBuilderContextResizeEnabled) return;
    try {
      const raw = window.localStorage.getItem(builderLayoutStorageKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      window.localStorage.setItem(
        builderLayoutStorageKey,
        JSON.stringify({
          ...parsed,
          case_3: {
            contextWidth: builderContextWidth,
          },
        }),
      );
    } catch {}
  }, [builderContextWidth, builderLayoutStorageKey, isBuilderContextResizeEnabled, rightTab]);

  const onMouseDownLeft = useCallback((e: React.MouseEvent) => {
    if (rightTab === "builder" && !isBuilderClientResizeEnabled) return;
    draggingRef.current = "left";
    startXRef.current = e.clientX;
    startCol1Ref.current = col1Width;
    e.preventDefault();
  }, [col1Width, isBuilderClientResizeEnabled, rightTab]);

  const onMouseDownRight = useCallback((e: React.MouseEvent) => {
    draggingRef.current = "right";
    startXRef.current = e.clientX;
    startCol3Ref.current = col3Width;
    e.preventDefault();
  }, [col3Width]);

  const onMouseDownBuilderContext = useCallback((e: React.MouseEvent) => {
    if (!isBuilderContextResizeEnabled) return;
    draggingRef.current = "builderContext";
    startXRef.current = e.clientX;
    startBuilderContextWidthRef.current = builderContextWidth;
    e.preventDefault();
  }, [builderContextWidth, isBuilderContextResizeEnabled]);

  const onMouseDownBuilderCalculation = useCallback((e: React.MouseEvent) => {
    if (!isBuilderCalculationResizeEnabled) return;
    draggingRef.current = "builderCalculation";
    startXRef.current = e.clientX;
    startBuilderCalculationWidthRef.current = builderCalculationWidth;
    e.preventDefault();
  }, [builderCalculationWidth, isBuilderCalculationResizeEnabled]);

  useEffect(() => {
    const BUILDER_TOTAL = 100;
    const BUILDER_COLLAPSED_WIDTH = 4;
    const SMART_RIGHT_MIN_PX = 620;
    const ANALYSIS_RIGHT_MIN_PX = 520;
    const CENTER_MIN_PX = 640;
    const LEFT_MIN_PX = 260;
    const BUILDER_CALC_MIN_PX = 440;
    const BUILDER_SMART_MIN_PX = 420;
    const BUILDER_MAIN_MIN_PX = 720;

    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const totalW = containerRef.current.offsetWidth;
      const dx = e.clientX - startXRef.current;
      const dPct = (dx / totalW) * 100;
      const toPct = (px: number) => (px / totalW) * 100;
      const leftMin = toPct(LEFT_MIN_PX);
      const centerMin = toPct(CENTER_MIN_PX);
      const smartRightMin = toPct(SMART_RIGHT_MIN_PX);
      const analysisRightMin = toPct(ANALYSIS_RIGHT_MIN_PX);
      const builderMainMinOverall = toPct(BUILDER_MAIN_MIN_PX);
      const currentClientWidth = clientPanelCollapsed ? 4 : col1Width;
      const builderGroupWidth = totalW * (100 / (100 + currentClientWidth));
      const toBuilderPct = (px: number) => (px / builderGroupWidth) * 100;
      const dBuilderPct = (dx / builderGroupWidth) * 100;
      const builderCalcMin = toBuilderPct(BUILDER_CALC_MIN_PX);
      const builderSmartMin = toBuilderPct(BUILDER_SMART_MIN_PX);
      const builderMainMin = toBuilderPct(BUILDER_MAIN_MIN_PX);
      if (draggingRef.current === "left") {
        setClientPanelCollapsed(false);
        if (rightTab === "builder") {
          const builderLeftMin = toPct(280);
          const builderLeftMax = 32;
          setCol1Width(
            Math.min(
              Math.max(startCol1Ref.current + dPct, builderLeftMin),
              builderLeftMax,
            ),
          );
        } else {
          const rightMin = rightTab === "smartnutrition" ? smartRightMin : analysisRightMin;
          const maxLeft = Math.max(leftMin, BUILDER_TOTAL - centerMin - col3Width);
          setCol1Width(Math.min(Math.max(startCol1Ref.current + dPct, leftMin), maxLeft));
        }
      } else if (draggingRef.current === "right") {
        const rightMin = rightTab === "smartnutrition" ? smartRightMin : analysisRightMin;
        const maxRight = BUILDER_TOTAL - col1Width - centerMin;
        setCol3Width(Math.min(Math.max(startCol3Ref.current - dPct, rightMin), maxRight));
      } else if (draggingRef.current === "builderCalculation") {
        setCalculationPanelCollapsed(false);
        const smartWidth = smartNutritionPanelCollapsed ? BUILDER_COLLAPSED_WIDTH : builderContextWidth;
        const currentMainWidth = BUILDER_TOTAL - builderCalculationWidth - smartWidth;
        const currentRightCompositeWidth = smartWidth + currentMainWidth;
        const smartShare = currentRightCompositeWidth > 0 ? smartWidth / currentRightCompositeWidth : 0.4;
        const maxCalculationWidth = BUILDER_TOTAL - builderSmartMin - builderMainMin;
        const nextCalculationWidth = Math.min(
          Math.max(startBuilderCalculationWidthRef.current + dBuilderPct, builderCalcMin),
          maxCalculationWidth,
        );
        const remainingCompositeWidth = BUILDER_TOTAL - nextCalculationWidth;
        let nextSmartWidth = remainingCompositeWidth * smartShare;
        const maxSmartWidth = remainingCompositeWidth - builderMainMin;
        nextSmartWidth = Math.min(Math.max(nextSmartWidth, builderSmartMin), maxSmartWidth);

        setBuilderContextWidth(nextSmartWidth);
        setBuilderCalculationWidth(
          nextCalculationWidth,
        );
      } else if (draggingRef.current === "builderContext") {
        if (!isBuilderContextResizeEnabled) return;
        setSmartNutritionPanelCollapsed(false);
        const calculationWidth = calculationPanelCollapsed ? BUILDER_COLLAPSED_WIDTH : builderCalculationWidth;
        const casePreset = BUILDER_CASE_PRESETS.case_3.contextWidth;
        const extraRange = clientPanelCollapsed ? 20 : 12;
        const reductionFromClient = clientPanelCollapsed ? 0 : Math.max(0, col1Width - 16);
        const maxContextWidth = Math.min(
          BUILDER_TOTAL - calculationWidth - builderMainMinOverall,
          casePreset + extraRange - reductionFromClient,
        );
        const minContextWidth = Math.max(builderSmartMin, casePreset - 15);
        setBuilderContextWidth(
          Math.min(
            Math.max(startBuilderContextWidthRef.current + dPct, minContextWidth),
            maxContextWidth,
          ),
        );
      }
    }
    function onMouseUp() { draggingRef.current = null; }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    builderCalculationWidth,
    builderContextWidth,
    calculationPanelCollapsed,
    clientPanelCollapsed,
    col1Width,
    col3Width,
    isBuilderCalculationResizeEnabled,
    isBuilderClientResizeEnabled,
    isBuilderContextResizeEnabled,
    rightTab,
    smartNutritionPanelCollapsed,
  ]);

  const clientName = studio.clientData?.name ?? "Client";
  const isFemale = studio.clientData?.gender === "female";
  const leanMass =
    studio.biometricsConfig.lean_mass_kg
    ?? studio.clientData?.lean_mass_kg
    ?? studio.macroResult?.leanMass
    ?? null;

  // Compute current cycle day from menstrual_cycle field (ISO date or numeric)
  const currentCycleDay = useMemo(() => {
    if (!isFemale) return null
    const raw = studio.clientData?.menstrual_cycle ?? null
    if (!raw) return null
    const num = Number(raw)
    if (!isNaN(num) && num >= 1) return num
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const lastPeriod = new Date(raw)
      const diffMs = Date.now() - lastPeriod.getTime()
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
      return diffDays >= 0 ? (diffDays % 28) + 1 : null
    }
    return null
  }, [isFemale, studio.clientData?.menstrual_cycle])

  // Build NutritionMacros shape for CycleSyncPhaseGrid base display
  const baseMacrosForCycleSync = useMemo(() => {
    if (!studio.macroResult) return null
    return {
      kcal:      studio.macroResult.calories,
      protein_g: studio.macroResult.macros.p,
      carbs_g:   studio.macroResult.macros.c,
      fat_g:     studio.macroResult.macros.f,
      water_ml:  0,
    }
  }, [studio.macroResult])
  // Refs so TopBar closures always call the latest save/share even after memoization
  const saveRef = useRef(studio.save);
  const shareRef = useRef(studio.share);
  saveRef.current = studio.save;
  shareRef.current = studio.share;

  const handleResetLayout = useCallback(() => {
    if (rightTab === "builder") {
      removeLocalStorage(builderLayoutStorageKey);
      setClientPanelCollapsed(true);
      setCalculationPanelCollapsed(true);
      setSmartNutritionPanelCollapsed(false);
      setCol1Width(BUILDER_CASE_PRESETS.case_3.clientWidth);
      setBuilderCalculationWidth(BUILDER_CASE_PRESETS.case_3.calculationWidth);
      setBuilderContextWidth(BUILDER_CASE_PRESETS.case_3.contextWidth);
    } else {
      setClientPanelCollapsed(false);
      setCalculationPanelCollapsed(false);
      setSmartNutritionPanelCollapsed(false);
      setCol1Width(22);
      setCol3Width(38);
      setBuilderCalculationWidth(26);
      setBuilderContextWidth(35);
    }
    pushHeaderFeedback(null, "success", "Disposition réinitialisée");
  }, [builderLayoutStorageKey, pushHeaderFeedback, rightTab]);

  const handleSaveAction = useCallback(async () => {
    try {
      pushHeaderFeedback(null, "loading", "Enregistrement...");
      await saveRef.current();
      pushHeaderFeedback(null, "success", "Protocole enregistré");
    } catch (error) {
      pushHeaderFeedback(
        null,
        "error",
        error instanceof Error ? error.message : "La sauvegarde a échoué.",
      );
    }
  }, [pushHeaderFeedback]);

  const handleShareAction = useCallback(async () => {
    try {
      pushHeaderFeedback(null, "loading", "Partage en cours...");
      await shareRef.current();
      pushHeaderFeedback(null, "success", "Protocole partagé");
      await new Promise((resolve) => setTimeout(resolve, 650));
      router.push(`/coach/clients/${clientId}/protocoles/nutrition`);
    } catch (error) {
      pushHeaderFeedback(
        null,
        "error",
        error instanceof Error
          ? error.message
          : "Le protocole ne peut pas encore être partagé.",
      );
    }
  }, [clientId, pushHeaderFeedback, router]);

  const rightContent = useMemo(
    () => (
      <div className="flex items-center gap-2">
        {headerFeedback ? (
          <ActionFeedbackBadge
            tone={headerFeedback.tone}
            message={headerFeedback.message}
            size="md"
          />
        ) : null}
        <button
          onClick={handleResetLayout}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-all"
          title="Réinitialiser la disposition"
          aria-label="Réinitialiser la disposition"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={handleSaveAction}
          disabled={studio.saving || studio.sharing}
          className="flex h-8 items-center gap-1.5 rounded-lg border-[0.3px] border-white/[0.06] bg-white/[0.04] px-2.5 text-white/70 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
          title={studio.saving ? "Enregistrement..." : "Enregistrer le protocole"}
          aria-label="Enregistrer le protocole"
        >
          {studio.saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          <span className="text-[10px] font-semibold">{studio.saving ? "Enregistrement..." : "Enregistrer"}</span>
        </button>
        <button
          onClick={handleShareAction}
          disabled={!studio.canShare || studio.sharing || studio.saving}
          title={
            studio.sharing
              ? "Partage..."
              : !studio.canShare
              ? studio.shareIssues
                  .filter((issue) => issue.severity === "blocking")
                  .map((issue) => issue.message)
                  .join(" | ")
              : studio.shareIssues
                  .filter((issue) => issue.severity === "warning")
                  .map((issue) => issue.message)
                  .join(" | ")
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f8a65] text-white hover:bg-[#217356] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:bg-[#1f8a65] disabled:active:scale-100"
          aria-label="Partager le protocole"
        >
          {studio.sharing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    ),
    [
      handleResetLayout,
      handleSaveAction,
      handleShareAction,
      headerFeedback,
      studio.canShare,
      studio.saving,
      studio.shareIssues,
      studio.sharing,
    ],
  );

  const leftContent = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/80 transition-all shrink-0"
          aria-label="Retour"
        >
          <ArrowLeft size={15} />
        </button>
        <ClientTopBarLeft pageLabel="Nutrition Studio" client={client} />
      </div>
    ),
    [client, router],
  );
  useSetTopBar(leftContent, rightContent);

  const effectiveCol1Width = clientPanelCollapsed ? 4 : col1Width;
  const col2Width = Math.max(18, 100 - effectiveCol1Width - col3Width);
  const isBuilderMode = rightTab === "builder";
  const builderCalculationEffectiveWidth = calculationPanelCollapsed ? 4 : builderCalculationWidth;
  const builderContextEffectiveWidth = smartNutritionPanelCollapsed ? 4 : builderContextWidth;
  const builderMainWidth = Math.max(
    28,
    100 - builderCalculationEffectiveWidth - builderContextEffectiveWidth,
  );

  const calculationEngine = (
    <CalculationEngine
      goal={studio.goal}
      transformationPhase={studio.transformationPhase}
      onTransformationPhaseChange={studio.setTransformationPhaseWithPreset}
      phaseProtocolPreview={studio.phaseProtocolPreview}
      onApplyPhaseProtocolPreview={studio.applyPhaseProtocolPreview}
      onDismissPhaseProtocolPreview={studio.dismissPhaseProtocolPreview}
      calorieAdjustPct={studio.calorieAdjustPct}
      onCalorieAdjustChange={studio.setCalorieAdjustPctWithProtocolSync}
      proteinOverride={studio.proteinOverride}
      onProteinOverrideChange={studio.setProteinOverride}
      macroOverrides={studio.macroOverrides}
      onMacroOverridesChange={studio.setMacroOverridesWithProtocolSync}
      macroResult={studio.macroResult}
      goalCalories={studio.goalCalories}
      hydrationClimate={studio.hydrationClimate}
      onHydrationClimateChange={studio.setHydrationClimate}
      hydrationPhase={studio.hydrationPhase}
      onHydrationPhaseChange={studio.setHydrationPhase}
      hydrationLiters={studio.hydrationLiters}
      leanMass={leanMass}
      bodyWeight={studio.biometricsConfig.weight_kg ?? studio.clientData?.weight_kg ?? null}
      dataMode={studio.dataMode}
      anchorDate={studio.anchorDate}
      realtimeWindowDays={studio.realtimeWindowDays}
      tdeeAdaptive={studio.tdeeAdaptive}
      tdeeAdaptiveAt={studio.tdeeAdaptiveAt}
      tdeeAdaptiveLower={studio.tdeeAdaptiveLower}
      tdeeAdaptiveUpper={studio.tdeeAdaptiveUpper}
      tdeeObserved={studio.tdeeObserved}
      tdeeObservedLower={studio.tdeeObservedLower}
      tdeeObservedUpper={studio.tdeeObservedUpper}
      tdeeActionableStreak={studio.tdeeActionableStreak}
      tdeeDataSource={studio.tdeeDataSource}
      tdeeHistory={studio.tdeeHistory}
      tdeeStabilityStatus={studio.tdeeStabilityStatus}
      tdeeLastSkipReason={studio.tdeeLastSkipReason}
      tdeeLastSuccessAt={studio.tdeeLastSuccessAt}
      tdeeProtocolStartDate={studio.tdeeProtocolStartDate}
      tdeeEstimationStatus={studio.tdeeEstimationStatus}
      tdeeDataQualityScore={studio.tdeeDataQualityScore}
      tdeeDataQualityReasons={studio.tdeeDataQualityReasons}
      tdeeError={studio.tdeeError}
      applyAdaptiveTdee={studio.applyAdaptiveTdee}
      applyingAdaptive={studio.applyingAdaptive}
      tdeeAdaptiveActive={studio.tdeeAdaptiveActive}
      onTdeeAdaptiveActiveToggle={studio.onTdeeAdaptiveActiveToggle}
      tdeeAutoEnabled={studio.tdeeAutoEnabled}
      onTdeeAutoToggle={studio.onTdeeAutoToggle}
      isFemale={isFemale}
      currentCycleDay={currentCycleDay}
      baseMacrosForCycleSync={baseMacrosForCycleSync}
      cycleState={studio.cycleState}
      cycleSyncEnabled={studio.cycleSyncEnabled}
      onCycleSyncEnabledChange={studio.setCycleSyncEnabled}
      cycleSyncProfile={studio.cycleSyncProfile}
      onCycleSyncProfileChange={studio.setCycleSyncProfile}
      cyclePhaseObservations={studio.cyclePhaseObservations}
      onResolveSignal={(missingKey) => setFocusMissingDataKey(missingKey)}
    />
  );

  const smartNutritionCanvas = (
    <ProtocolCanvas
      loading={studio.clientLoading}
      protocolName={studio.protocolName}
      onProtocolNameChange={studio.setProtocolName}
      days={studio.days}
      activeDayIndex={studio.activeDayIndex}
      onActiveDayChange={studio.setActiveDayIndex}
      onUpdateDay={studio.updateDay}
      onAddDay={studio.addDay}
      onRemoveDay={studio.removeDay}
      onInjectMacros={studio.injectMacrosToDay}
      onInjectHydration={studio.injectHydrationToDay}
      onInjectAll={studio.injectAllToDay}
      hasMacroResult={studio.macroResult !== null}
      hasHydration={studio.hydrationLiters !== null}
      coherenceScore={studio.coherenceScore}
      shareIssues={studio.shareIssues}
      trainingWeekSchedule={studio.trainingWeekSchedule}
      selectedScheduleDow={studio.selectedScheduleDow}
      onSelectScheduleDow={studio.setSelectedScheduleDow}
      scheduleSlots={studio.scheduleSlots}
      onScheduleSlotsChange={studio.setScheduleSlots}
      mealPlanDuplication={mealPlanDuplicationControls}
    />
  );

  const studioRightPanel = (
    <NutritionStudioRightPanel
      activeTab={rightTab}
      onTabChange={setRightTab}
      isSmartNutritionOpen={rightTab === "builder" && !smartNutritionPanelCollapsed}
      analysis={{
        loading: nutritionReality.loading,
        error: nutritionReality.error,
        activeWindow: realityWindow,
        onWindowChange: setRealityWindow,
        onOpenHub: () => router.push(`/coach/clients/${clientId}/data/nutrition`),
        view: nutritionReality.view,
      }}
      protocol={{
        clientId,
        protocolId: existingProtocol?.id ?? null,
        protocolStatus: existingProtocol?.status ?? undefined,
        smoothingDate,
        loading: studio.clientLoading,
        protocolName: studio.protocolName,
        layoutCase: activeBuilderLayoutCase,
        onProtocolNameChange: studio.setProtocolName,
        days: studio.days,
        activeDayIndex: studio.activeDayIndex,
        onActiveDayChange: studio.setActiveDayIndex,
        onUpdateDay: studio.updateDay,
        onAddDay: studio.addDay,
        onRemoveDay: studio.removeDay,
        onInjectMacros: studio.injectMacrosToDay,
        onInjectHydration: studio.injectHydrationToDay,
        onInjectAll: studio.injectAllToDay,
        hasMacroResult: studio.macroResult !== null,
        hasHydration: studio.hydrationLiters !== null,
        coherenceScore: studio.coherenceScore,
        shareIssues: studio.shareIssues,
        trainingWeekSchedule: studio.trainingWeekSchedule,
        selectedScheduleDow: studio.selectedScheduleDow,
        onSelectScheduleDow: studio.setSelectedScheduleDow,
        scheduleSlots: studio.scheduleSlots,
        onScheduleSlotsChange: studio.setScheduleSlots,
        mealPlanDuplication: mealPlanDuplicationControls,
        onStartMealPlanDuplication: startMealPlanDuplication,
        cycleAdjustment:
          studio.cycleSyncEnabled && studio.cycleState?.currentPhase
            ? getEffectiveCycleSyncAdjustment({
                adjustment: getCycleSyncAdjustment(studio.cycleState.currentPhase),
                cycleState: studio.cycleState,
                profile: studio.cycleSyncProfile,
              }).adjustment
            : null,
      }}
    />
  );

  return (
    <main className="h-[calc(100vh-88px)] bg-[#121212] flex flex-col overflow-hidden">
      <div ref={containerRef} className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Col 1 — Client Intelligence */}
        <div style={{ flexGrow: effectiveCol1Width, flexShrink: 1, flexBasis: 0, minWidth: clientPanelCollapsed ? 46 : 200, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
          {clientPanelCollapsed ? (
            <div className="flex h-full flex-col items-center border-r-[0.3px] border-white/[0.06] bg-white/[0.015] py-3">
                <button
                  type="button"
                  onClick={() => {
                    setClientPanelCollapsed(false);
                    if (rightTab === "builder") {
                      setCol1Width(16);
                    } else {
                      setCol1Width(22);
                      setCol3Width((prev) => Math.max(prev - 12, 48));
                    }
                  }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border-[0.3px] border-white/[0.08] bg-white/[0.04] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/75"
                aria-label="Rouvrir les données client"
                title="Rouvrir les données client"
              >
                <PanelLeftOpen size={15} />
              </button>
              <div className="mt-3 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                Données client
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex flex-1 flex-col">
              {rightTab === "builder" && (
                <div className="flex h-12 flex-none items-center justify-end border-b-[0.3px] border-white/[0.06] bg-[#151515] px-3">
                  <button
                    type="button"
                    onClick={() => {
                      setClientPanelCollapsed(true);
                      if (rightTab !== "builder") {
                        setCol1Width(4);
                        setCol3Width((prev) => Math.max(prev, 60));
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border-[0.3px] border-white/[0.08] bg-[#171717] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/75"
                    aria-label="Refermer les données client"
                    title="Refermer les données client"
                  >
                    <PanelLeftClose size={15} />
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1">
                <ClientIntelligencePanel
                  clientId={clientId}
                  clientData={studio.clientData}
                  onClientDataChange={studio.setClientData}
                  loading={studio.clientLoading}
                  trainingConfig={studio.trainingConfig}
                  lifestyleConfig={studio.lifestyleConfig}
                  biometricsConfig={studio.biometricsConfig}
                  onTrainingChange={(patch) =>
                    studio.setTrainingConfig((prev) => ({ ...prev, ...patch }))
                  }
                  onLifestyleChange={(patch) =>
                    studio.setLifestyleConfig((prev) => ({ ...prev, ...patch }))
                  }
                  onBiometricsChange={(patch) =>
                    studio.setBiometricsConfig((prev) => ({ ...prev, ...patch }))
                  }
                  macroResult={studio.macroResult}
                  submissions={studio.allSubmissions}
                  dataMode={studio.dataMode}
                  anchorDate={studio.anchorDate}
                  realtimeWindowDays={studio.realtimeWindowDays}
                  onDataModeChange={studio.setDataMode}
                  selectedSubmissionId={studio.resolvedSubmissionId ?? studio.selectedSubmissionId}
                  onSubmissionChange={studio.setSelectedSubmissionId}
                  dataSource={studio.dataSource}
                  onDataSourceChange={studio.setDataSource}
                  focusMissingDataKey={focusMissingDataKey}
                  onFocusHandled={() => setFocusMissingDataKey(null)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Resize handle left */}
        <div
          onMouseDown={onMouseDownLeft}
          className={`w-1 flex-none bg-white/[0.06] transition-colors ${
            rightTab === "builder"
              ? isBuilderClientResizeEnabled
                ? "cursor-col-resize hover:bg-[#1f8a65]/50 active:bg-[#1f8a65]"
                : "cursor-default opacity-35"
              : "cursor-col-resize hover:bg-[#1f8a65]/50 active:bg-[#1f8a65]"
          }`}
        />

        {isBuilderMode ? (
          <>
            {/* Rail — Calculation Engine */}
            <div
              style={{
                flexGrow: builderCalculationEffectiveWidth,
                flexShrink: 0,
                flexBasis: 0,
                minWidth: calculationPanelCollapsed ? 46 : 280,
                overflow: "hidden",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {calculationPanelCollapsed ? (
                <div className="flex h-full flex-col items-center border-r-[0.3px] border-white/[0.06] bg-white/[0.015] py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCalculationPanelCollapsed(false);
                      if (rightTab === "builder") {
                        setBuilderCalculationWidth((prev) =>
                          Math.max(prev, BUILDER_CASE_PRESETS.case_2.calculationWidth),
                        );
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border-[0.3px] border-white/[0.08] bg-white/[0.04] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/75"
                    aria-label="Rouvrir le calcul nutritionnel"
                    title="Rouvrir le calcul nutritionnel"
                  >
                    <PanelLeftOpen size={15} />
                  </button>
                  <div className="mt-3 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                    Calcul nutritionnel
                  </div>
                </div>
              ) : (
                <div className="min-h-0 flex flex-1 flex-col border-r-[0.3px] border-white/[0.06]">
                  <div className="flex h-12 flex-none items-center justify-end border-b-[0.3px] border-white/[0.06] bg-[#151515] px-3">
                    <button
                      type="button"
                      onClick={() => setCalculationPanelCollapsed(true)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border-[0.3px] border-white/[0.08] bg-[#171717] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/75"
                      aria-label="Refermer le calcul nutritionnel"
                      title="Refermer le calcul nutritionnel"
                    >
                      <PanelLeftClose size={15} />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1">
                    {calculationEngine}
                  </div>
                </div>
              )}
            </div>

            {/* Resize handle — Calcul / Smart Nutrition */}
            <div
              onMouseDown={onMouseDownBuilderCalculation}
              className={`w-1 flex-none bg-white/[0.06] transition-colors ${
                isBuilderCalculationResizeEnabled
                  ? "cursor-col-resize hover:bg-[#1f8a65]/50 active:bg-[#1f8a65]"
                  : "cursor-default opacity-35"
              }`}
            />

            {/* Rail / colonne contexte — Smart Nutrition */}
            <div
              style={{
                flexGrow: builderContextEffectiveWidth,
                flexShrink: 0,
                flexBasis: 0,
                minWidth: smartNutritionPanelCollapsed ? 46 : 300,
                overflow: "hidden",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {smartNutritionPanelCollapsed ? (
                <div className="flex h-full flex-col items-center border-r-[0.3px] border-white/[0.06] bg-white/[0.015] py-3">
                  <button
                    type="button"
                    onClick={() => setSmartNutritionPanelCollapsed(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border-[0.3px] border-white/[0.08] bg-white/[0.04] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/75"
                    aria-label="Rouvrir le pilotage nutritionnel"
                    title="Rouvrir le pilotage nutritionnel"
                  >
                    <PanelLeftOpen size={15} />
                  </button>
                  <div className="mt-3 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                    Pilotage nutritionnel
                  </div>
                </div>
              ) : (
                <div className="min-h-0 flex flex-1 flex-col border-r-[0.3px] border-white/[0.06]">
                  <div className="flex h-12 flex-none items-center justify-end border-b-[0.3px] border-white/[0.06] bg-[#151515] px-3">
                    <button
                      type="button"
                      onClick={() => setSmartNutritionPanelCollapsed(true)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border-[0.3px] border-white/[0.08] bg-[#171717] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/75"
                      aria-label="Refermer le pilotage nutritionnel"
                      title="Refermer le pilotage nutritionnel"
                    >
                      <PanelLeftClose size={15} />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1">
                    {smartNutritionCanvas}
                  </div>
                </div>
              )}
            </div>

            {/* Resize handle — Smart Nutrition / Builder */}
            <div
              onMouseDown={onMouseDownBuilderContext}
              className={`w-1 flex-none bg-white/[0.06] transition-colors ${
                isBuilderContextResizeEnabled
                  ? "cursor-col-resize hover:bg-[#1f8a65]/50 active:bg-[#1f8a65]"
                  : "cursor-default opacity-35"
              }`}
            />

            {/* Colonne principale — Builder */}
            <div style={{ flexGrow: builderMainWidth, flexShrink: 1, flexBasis: 0, minWidth: 420, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
              {studioRightPanel}
            </div>
          </>
        ) : (
          <>
            {/* Col 2 — Calculation Engine */}
            <div style={{ flexGrow: col2Width, flexShrink: 1, flexBasis: 0, minWidth: 0, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
              {calculationEngine}
            </div>

            {/* Resize handle right */}
            <div
              onMouseDown={onMouseDownRight}
              className="w-1 flex-none bg-white/[0.06] hover:bg-[#1f8a65]/50 cursor-col-resize transition-colors active:bg-[#1f8a65]"
            />

            {/* Col 3 — Protocol Canvas */}
            <div style={{ flexGrow: col3Width, flexShrink: 1, flexBasis: 0, minWidth: 240, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
              {studioRightPanel}
            </div>
          </>
        )}
      </div>

      {/* Client preview modal */}
      {studio.showPreview && (
        <ClientPreviewModal
          clientName={clientName}
          protocolName={studio.protocolName}
          days={studio.days}
          onClose={() => studio.setShowPreview(false)}
        />
      )}
    </main>
  );
}
