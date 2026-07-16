"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Mic } from "lucide-react";
import SmartNutritionPrepList, {
  type SmartNutritionPrep,
} from "@/components/client/smart/SmartNutritionPrepList";
import {
  NutritionLogContent,
  type NutritionLogContentHandle,
  type NutritionLogLayer,
} from "@/app/client/nutrition/log/NutritionLogContent";
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget";
// simulation/state removed for compose: we only show one meal at a time
import { useClientT } from "@/components/client/ClientI18nProvider";
// no ui colors needed here
import { FlashMessage, useFlash } from "@/components/client/smart/FlashMessage";
import { queueNutritionLiveRefresh } from "@/lib/client/nutrition-live";
import NutritionEntryHeader from "@/components/client/nutrition/NutritionEntryHeader";

interface ComposeClientPageProps {
  consumed: NutritionMacros;
  target: NutritionMacros;
  date: string;
  todayDate: string;
  initialPreps: SmartNutritionPrep[];
  initialEditingPrep?: SmartNutritionPrep | null;
  gender?: string | null;
  bodyWeightKg?: number | null;
}

type DraftTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
};
type PrepSlot = "breakfast" | "lunch" | "dinner" | "snack";

const ZERO_DRAFTS: DraftTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  count: 0,
};

export default function ComposeClientPage({
  consumed,
  target,
  date,
  todayDate,
  initialPreps,
  initialEditingPrep = null,
  gender,
  bodyWeightKg,
}: ComposeClientPageProps) {
  const { t } = useClientT();
  const localizeScenarioLabel = useCallback(
    (label: string) => {
      if (label === "Scénario principal") return t("nutrition.scenario.main");
      const numbered = /^Scénario\s+(\d+)$/i.exec(label);
      if (numbered?.[1])
        return t("nutrition.scenario.named", { n: numbered[1] });
      return label;
    },
    [t],
  );
  const router = useRouter();
  const logRef = useRef<NutritionLogContentHandle>(null);
  const [draftTotals, setDraftTotals] = useState<DraftTotals>(ZERO_DRAFTS);
  const [saving, setSaving] = useState<"prep" | "meal" | null>(null);
  const [editingPrep, setEditingPrep] = useState<SmartNutritionPrep | null>(
    initialEditingPrep,
  );
  const [livePreview, setLivePreview] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    count: number;
    pendingItemName?: string | null;
    pendingQuantityG?: number | null;
  }>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    count: 0,
    pendingItemName: null,
    pendingQuantityG: null,
  });
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [contentLayer, setContentLayer] =
    useState<NutritionLogLayer>("category");
  const [selectedSlot, setSelectedSlot] = useState<PrepSlot>("lunch");
  const [prepTitle, setPrepTitle] = useState("");
  const { flash, showFlash, dismiss: dismissFlash } = useFlash();
  const collapseSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditingPrep(initialEditingPrep);
    if (initialEditingPrep) {
      setSelectedSlot((initialEditingPrep.meal_slot as PrepSlot) ?? "lunch");
    }
  }, [initialEditingPrep]);

  const isFutureDate = date > todayDate;
  const headerIsCompact = headerCollapsed || contentLayer !== "category";
  const hasDrafts = draftTotals.count > 0;

  const handleDraftsChange = useCallback((totals: DraftTotals) => {
    setDraftTotals(totals);
  }, []);
  const previewSource =
    livePreview && livePreview.count > 0 && livePreview.pendingQuantityG != null
      ? {
          kcal: livePreview.calories,
          protein_g: livePreview.protein,
          carbs_g: livePreview.carbs,
          fat_g: livePreview.fat,
        }
      : draftTotals.count > 0
        ? {
            kcal: draftTotals.calories,
            protein_g: draftTotals.protein,
            carbs_g: draftTotals.carbs,
            fat_g: draftTotals.fat,
          }
        : null;

  // Include planned & active preps for this date in the header (so Compose reflects Planning state)
  const plannedActivePreps = initialPreps.filter((p) => {
    if (p.status !== "planned" || p.is_active !== true) return false;
    if (p.physiological_date !== date) return false;
    if (editingPrep?.id && p.id === editingPrep.id) return false;
    return true;
  });
  const plannedTotals = plannedActivePreps.reduce(
    (acc, p) => {
      acc.kcal += p.total_calories || 0;
      acc.protein_g += p.total_protein_g || 0;
      acc.carbs_g += p.total_carbs_g || 0;
      acc.fat_g += p.total_fat_g || 0;
      return acc;
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  // Header should show already consumed + the live preview/draft only — no simulated preps
  const headerConsumed: NutritionMacros = {
    kcal: consumed.kcal + (previewSource?.kcal ?? 0) + (plannedTotals.kcal ?? 0),
    protein_g: consumed.protein_g + (previewSource?.protein_g ?? 0) + (plannedTotals.protein_g ?? 0),
    carbs_g: consumed.carbs_g + (previewSource?.carbs_g ?? 0) + (plannedTotals.carbs_g ?? 0),
    fat_g: consumed.fat_g + (previewSource?.fat_g ?? 0) + (plannedTotals.fat_g ?? 0),
    water_ml: consumed.water_ml,
  };
  const suppressInternalRedirect = useCallback(() => {}, []);

  async function handleSavePrep() {
    setSaving("prep");
    const ok = await logRef.current?.savePrep();
    if (ok) {
      logRef.current?.clearDrafts();
      setEditingPrep(null);
      setPrepTitle("");
      router.refresh();
    } else {
      showFlash(t("compose.error.save"), "error");
    }
    setSaving(null);
  }

  async function handleSaveMeal() {
    setSaving("meal");
    const mealOk = await logRef.current?.saveMeal();
    if (!mealOk) {
      showFlash(t("compose.error.validate"), "error");
      setSaving(null);
      return;
    }
    // Use current draft totals as the meal consumed delta (no simulated preps)
    queueNutritionLiveRefresh({
      date,
      consumedDelta: {
        kcal: draftTotals.calories,
        protein_g: draftTotals.protein,
        carbs_g: draftTotals.carbs,
        fat_g: draftTotals.fat,
      },
      removePrepIds: [],
    });
    setSaving(null);
    router.push("/client/nutrition");
  }

  const closeToPlanning = useCallback(() => {
    router.replace(`/client/nutrition?date=${date}&tab=planning`, { scroll: false });
  }, [date, router]);

  function handleCancel() {
    logRef.current?.clearDrafts();
    setEditingPrep(null);
    setPrepTitle("");
  }

  // no simulated preps in compose: user composes a single meal

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
    <main
      className="relative min-h-[100dvh] bg-[#0d0d0d]"
      style={{
        paddingBottom: "calc(var(--client-sheet-bottom-padding) + 112px)",
        overscrollBehavior: "contain",
      }}
    >
      <FlashMessage flash={flash} onDismiss={dismissFlash} />
      <div
        ref={collapseSentinelRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-[42px] h-px w-px"
      />

      <div
        className="sticky top-0 z-50 bg-[#0d0d0d]"
        style={{ height: "env(safe-area-inset-top, 0px)" }}
      />

      <section className="sticky top-0 z-40 bg-[#0d0d0d]">
        <NutritionEntryHeader
          title={t("compose.title")}
          contextLabel={t("compose.header.planification")}
          date={date}
          consumed={headerConsumed}
          target={target}
          gender={gender}
          bodyWeightKg={bodyWeightKg}
          action={{
            icon: Mic,
            label: t("compose.voiceInputAria"),
            onClick: () =>
              router.push(
                `/client/nutrition/log/voice?date=${date}&return_tab=planning`,
              ),
          }}
          onClose={closeToPlanning}
          closeLabel={t("compose.cancel")}
          notice={
            hasDrafts ? (
              <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-white/34">
                {t("compose.saveDayFirst")}
              </p>
            ) : null
          }
          betweenHeroAndSlots={headerIsCompact || !hasDrafts ? null : null}
          showSlots={contentLayer === "category" && !headerIsCompact}
          selectedSlot={selectedSlot}
          onSlotChange={setSelectedSlot}
        />

        {/* Prep title input — shown when there are drafts to save */}
        {hasDrafts && (
          <div className="px-4 py-3">
            <input
              type="text"
              value={prepTitle}
              onChange={(e) => setPrepTitle(e.target.value)}
              placeholder={t("compose.prepTitlePlaceholder")}
              maxLength={80}
              className="w-full h-9 px-3 rounded-xl bg-[#111114] text-white text-[12px] placeholder:text-white/20 outline-none border border-white/[0.06] focus:border-white/[0.14]"
            />
          </div>
        )}

        {/* Action buttons when drafts exist */}
        {hasDrafts && (
          <div
            className={`px-4 pb-3 grid gap-2 ${isFutureDate ? "grid-cols-2" : "grid-cols-3"}`}
            style={{ borderBottom: "0.3px solid rgba(255,255,255,0.06)" }}
          >
            <button
              onClick={handleCancel}
              disabled={saving !== null}
              className="h-11 rounded-xl bg-white/[0.04] text-white/40 text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {t("compose.cancel")}
            </button>
            <button
              onClick={handleSavePrep}
              disabled={saving !== null}
              className="h-11 rounded-xl bg-white/[0.10] text-white text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {saving === "prep" ? t("compose.saving") : t("compose.save")}
            </button>
            {/* Valider only makes sense for today — for future dates the user should use Sauver */}
            {!isFutureDate && (
              <button
                onClick={handleSaveMeal}
                disabled={saving !== null}
                className="h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {saving === "meal"
                  ? t("compose.saving")
                  : t("compose.validate")}
              </button>
            )}
          </div>
        )}

        {/* Scénarios supprimés — affichage simplifié des preps ci-dessous */}
      </section>

      <NutritionLogContent
        ref={logRef}
        onSuccess={suppressInternalRedirect}
        embedded
        externalScroll
        composerMode="guide"
        prepId={editingPrep?.id ?? null}
        initialPrepEntries={editingPrep?.entries}
        // no scenario/simulated mode: compose edits apply to a single meal only
        prepDate={date}
        prepMealSlot={selectedSlot}
        prepTitle={prepTitle || null}
        hideActions
        onDraftsChange={handleDraftsChange}
        onLiveTotalsChange={setLivePreview}
        onLayerChange={setContentLayer}
        balanceContext={{
          consumed,
          target,
          profile: { gender, weightKg: bodyWeightKg },
        }}
      />
      
    </main>
  );
}
