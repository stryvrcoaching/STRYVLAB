"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ScanLine } from "lucide-react";
import { useClientT } from "@/components/client/ClientI18nProvider";
import {
  NutritionLogContent,
  type NutritionLogContentHandle,
} from "@/app/client/nutrition/log/NutritionLogContent";
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget";
import type { SmartNutritionPrep } from "@/components/client/smart/SmartNutritionPrepList";
import type { SmartPrepSlot } from "@/lib/nutrition/simulation-state";
import type { NutritionLogLayer } from "@/app/client/nutrition/log/NutritionLogContent";
import NutritionEntryHeader from "@/components/client/nutrition/NutritionEntryHeader";

function getDefaultSlot(): SmartPrepSlot {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_MACROS: NutritionMacros = {
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  water_ml: 0,
};

// ─── Main component ───────────────────────────────────────────────────────────

interface MealLogSheetProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mealId?: string | null;
  prep?: SmartNutritionPrep | null;
  composerMode?: "standard" | "guide" | "simulation";
  entryMode?: "default" | "search" | "favorites" | "categories";
  intent?: "track" | "compose";
  /** Date active de la page nutrition (YYYY-MM-DD). En mode guide, les preps sont créés pour cette date. */
  activeDate?: string;
  balanceContext?: {
    consumed: NutritionMacros;
    target: NutritionMacros;
    profile?: {
      gender?: string | null;
      weightKg?: number | null;
    };
  };
}

export default function MealLogSheet({
  open,
  onClose,
  onSuccess,
  mealId,
  prep,
  composerMode = "standard",
  entryMode = "default",
  intent: _intent,
  activeDate,
  balanceContext,
}: MealLogSheetProps) {
  const { t } = useClientT();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedSlot, setSelectedSlot] =
    useState<SmartPrepSlot>(getDefaultSlot);
  const [saving, setSaving] = useState<"prep" | "meal" | null>(null);
  const [contentLayer, setContentLayer] =
    useState<NutritionLogLayer>("category");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const collapseSentinelRef = useRef<HTMLDivElement>(null);
  const [, setDrafts] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    count: 0,
  });
  const [livePreview, setLivePreview] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    count: 0,
    pendingItemName: null as string | null,
    pendingQuantityG: null as number | null,
  });
  const logRef = useRef<NutritionLogContentHandle>(null);
  const headerIsCompact = headerCollapsed || contentLayer !== "category";

  const isGuideMode = composerMode === "guide";
  // Date du prep : si on édite un prep existant → sa date ; sinon la date active de la page (ou today)
  const resolvedSlot = prep ? (prep.meal_slot ?? selectedSlot) : selectedSlot;
  const resolvedDate = prep
    ? (prep.planned_for?.slice(0, 10) ?? getTodayDate())
    : (activeDate ?? getTodayDate());
  const slotLocked = !!prep || !!mealId;
  const headerConsumed = useMemo<NutritionMacros>(
    () => ({
      kcal: (balanceContext?.consumed.kcal ?? 0) + livePreview.calories,
      protein_g:
        (balanceContext?.consumed.protein_g ?? 0) + livePreview.protein,
      carbs_g: (balanceContext?.consumed.carbs_g ?? 0) + livePreview.carbs,
      fat_g: (balanceContext?.consumed.fat_g ?? 0) + livePreview.fat,
      water_ml: balanceContext?.consumed.water_ml ?? 0,
    }),
    [balanceContext, livePreview],
  );
  const headerTarget = balanceContext?.target ?? EMPTY_MACROS;

  async function handleSavePrep() {
    setSaving("prep");
    await logRef.current?.savePrep();
    setSaving(null);
    onSuccess?.();
  }

  async function handleSaveMeal() {
    setSaving("meal");
    await logRef.current?.saveMeal();
    setSaving(null);
    onSuccess?.();
  }

  const openPhotoRoute = () => {
    const params = new URLSearchParams({ date: resolvedDate });
    const returnTab = searchParams.get("return_tab");
    if (returnTab && returnTab !== "suivi") params.set("return_tab", returnTab);
    router.push(`/client/nutrition/log/photo?${params.toString()}`);
  };

  useEffect(() => {
    const sentinel = collapseSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setHeaderCollapsed(!entry.isIntersecting),
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Plein écran — monte depuis le bas */}
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ background: "#0d0d0d" }}
            initial={false}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { duration: 0.22, ease: "easeIn" } }}
          >
            {/* Safe-area background fill — makes iOS status bar match the sheet bg */}
            <div
              className="shrink-0"
              style={{
                height: "env(safe-area-inset-top, 0px)",
                background: "#0d0d0d",
              }}
            />
            <NutritionEntryHeader
              title={
                isGuideMode ? t("compose.title") : t("nutrition.track.title")
              }
              contextLabel={
                isGuideMode
                  ? t("compose.header.planification")
                  : t("nutrition.tab.suivi")
              }
              date={resolvedDate}
              consumed={headerConsumed}
              target={headerTarget}
              gender={balanceContext?.profile?.gender}
              bodyWeightKg={balanceContext?.profile?.weightKg}
              action={{
                icon: ScanLine,
                label: t("nutrition.photo.quickScan"),
                onClick: openPhotoRoute,
              }}
              onClose={onClose}
              closeLabel={t("compose.cancel")}
              showSlots={contentLayer === "category" && !headerIsCompact}
              selectedSlot={resolvedSlot}
              slotsLocked={slotLocked}
              onSlotChange={setSelectedSlot}
            />
            {/* ── NutritionLogContent ── */}
            <div className="flex-1 overflow-hidden relative min-h-0">
              <Suspense
                fallback={
                  <div className="h-full" style={{ background: "#0d0d0d" }} />
                }
              >
                <NutritionLogContent
                  ref={isGuideMode ? logRef : undefined}
                  embedded
                  mealId={mealId}
                  prepId={prep?.id ?? null}
                  initialPrepEntries={prep?.entries}
                  composerMode={isGuideMode ? "guide" : composerMode}
                  entryMode={entryMode}
                  onSuccess={isGuideMode ? undefined : (onSuccess ?? onClose)}
                  balanceContext={balanceContext}
                  prepMealSlot={!mealId ? resolvedSlot : null}
                  prepDate={resolvedDate}
                  hideActions={isGuideMode}
                  onDraftsChange={setDrafts}
                  onLiveTotalsChange={setLivePreview}
                  onLayerChange={setContentLayer}
                  onHeaderCollapseChange={setHeaderCollapsed}
                  onPhotoScanOpen={!isGuideMode ? openPhotoRoute : undefined}
                />
              </Suspense>
            </div>

            {/* ── Footer guide mode ── */}
            {isGuideMode && (
              <div
                className="px-4 pt-3 shrink-0 flex gap-2"
                style={{
                  paddingBottom: "16px",
                  borderTop: "0.3px solid rgba(255,255,255,0.08)",
                }}
              >
                <button
                  onClick={onClose}
                  className="h-11 px-4 rounded-xl text-[12px] font-barlow-condensed font-bold uppercase tracking-wide active:scale-[0.97] transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.40)",
                  }}
                >
                  {t("compose.cancel")}
                </button>
                <button
                  onClick={handleSavePrep}
                  disabled={saving !== null}
                  className="flex-1 h-11 rounded-xl text-[12px] font-barlow-condensed font-bold uppercase tracking-wide active:scale-[0.97] transition-all disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color: "#f3f4f6",
                  }}
                >
                  {saving === "prep"
                    ? t("compose.saving")
                    : t("nutrition.prep.plan")}
                </button>
                <button
                  onClick={handleSaveMeal}
                  disabled={saving !== null}
                  className="flex-1 h-11 rounded-xl text-[12px] font-barlow-condensed font-bold uppercase tracking-wide active:scale-[0.97] transition-all disabled:opacity-50"
                  style={{ background: "#f2f2f2", color: "#080808" }}
                >
                  {saving === "meal"
                    ? t("compose.saving")
                    : t("compose.validate")}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
