"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Coffee,
  Sun,
  Moon,
  Apple,
  Droplets,
  Pencil,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NutritionMeal, NutritionEntry } from "@/lib/nutrition/food-items";
import { FoodIcon } from "@/components/nutrition/FoodIcon";
import type { SmartNutritionPrep } from "@/components/client/smart/SmartNutritionPrepList";
import { useClientT } from "@/components/client/ClientI18nProvider";
import {
  clientLocale,
  type ClientDictKey,
} from "@/lib/i18n/clientTranslations";
import type { NutritionMacros } from "./SmartNutritionWidget";
import type { SmartPrepSlot } from "@/lib/nutrition/simulation-state";
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors";
import { computeActionableRemaining } from "@/lib/nutrition/actionable-remaining";
import { queueNutritionLiveRefresh } from "@/lib/client/nutrition-live";
import { sendClientMutation } from "@/lib/client/offline-mutations";

const MC = {
  prot: NUTRITION_UI_COLORS.protein,
  carb: NUTRITION_UI_COLORS.carbs,
  fat: NUTRITION_UI_COLORS.fat,
};

const MEAL_TYPE_KEYS: Record<string, ClientDictKey> = {
  breakfast: "meal.type.breakfast",
  lunch: "meal.type.lunch",
  dinner: "meal.type.dinner",
  snack: "meal.type.snack",
};

const MEAL_TYPE_ICON: Record<string, LucideIcon> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Apple,
  drinks: Droplets,
};

function MacroStrip({ p, g, f }: { p: number; g: number; f: number }) {
  const pK = p * 4,
    gK = g * 4,
    fK = f * 9;
  const total = pK + gK + fK || 1;
  return (
    <div className="flex h-[4px] rounded-full overflow-hidden gap-[2px]">
      <div
        className="rounded-full"
        style={{ width: `${(pK / total) * 100}%`, backgroundColor: MC.prot }}
      />
      <div
        className="rounded-full"
        style={{ width: `${(gK / total) * 100}%`, backgroundColor: MC.carb }}
      />
      <div
        className="rounded-full"
        style={{ width: `${(fK / total) * 100}%`, backgroundColor: MC.fat }}
      />
    </div>
  );
}

// ─── Meal components ──────────────────────────────────────────────────────────

function MealTypeChooser({
  mealId,
  current,
  onChange,
}: {
  mealId: string;
  current: string;
  onChange: (t: string) => void;
}) {
  const { t } = useClientT();
  const [open, setOpen] = useState(false);
  const types = ["breakfast", "lunch", "dinner", "snack"] as const;

  async function pick(type: string) {
    setOpen(false);
    onChange(type);
    await fetch(`/api/client/nutrition/meals/${mealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal_type: type }),
    });
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex items-center gap-1.5 group"
      >
        {(() => {
          const Icon = MEAL_TYPE_ICON[current] ?? Coffee;
          return (
            <Icon
              size={11}
              className="text-white/50 group-hover:text-white/80 transition-colors"
            />
          );
        })()}
        <span className="text-[11px] font-bold text-white/70 group-hover:text-white transition-colors">
          {MEAL_TYPE_KEYS[current] ? t(MEAL_TYPE_KEYS[current]) : current}
        </span>
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          className="text-white/20 group-hover:text-white/50 transition-colors"
          fill="currentColor"
        >
          <path d="M4 5L1 2h6L4 5z" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-6 z-50 bg-[#111111] rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.7)] min-w-[140px]"
            >
              {types.map((type) => (
                <button
                  key={type}
                  onClick={() => pick(type)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-[12px] transition-colors hover:bg-white/[0.06] ${
                    type === current
                      ? "text-[#f2f2f2] font-bold"
                      : "text-white/70"
                  }`}
                >
                  {(() => {
                    const Icon = MEAL_TYPE_ICON[type] ?? Coffee;
                    return <Icon size={12} className="text-white/40" />;
                  })()}
                  {MEAL_TYPE_KEYS[type] ? t(MEAL_TYPE_KEYS[type]) : type}
                  {type === current && (
                    <Check size={10} className="ml-auto text-[#f2f2f2]" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function TimeEditor({
  mealId,
  loggedAt,
  onUpdated,
}: {
  mealId: string;
  loggedAt: string;
  onUpdated: (iso: string) => void;
}) {
  const { lang, t } = useClientT();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const locale = clientLocale(lang);
  const d = new Date(loggedAt);
  const currentVal = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const timeStr = d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const timeVal = e.target.value;
    if (!timeVal) return;
    setSaving(true);
    setOpen(false);
    const base = new Date(loggedAt);
    const [h, m] = timeVal.split(":").map(Number);
    base.setHours(h, m, 0, 0);
    const iso = base.toISOString();
    await fetch(`/api/client/nutrition/meals/${mealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logged_at: iso }),
    });
    onUpdated(iso);
    setSaving(false);
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 group mt-0.5"
      >
        <span
          className={`text-[10px] text-white/25 group-hover:text-white/50 transition-colors ${saving ? "opacity-40" : ""}`}
        >
          {saving ? "…" : timeStr}
        </span>
        <Pencil
          size={8}
          className="text-white/15 group-hover:text-white/40 transition-colors"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -3, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute left-0 top-6 z-50 bg-[#1a1a1a] border border-white/[0.08] rounded-xl px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.7)]"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/30 mb-2">
                {t("nutrition.time.label")}
              </p>
              <input
                type="time"
                defaultValue={currentVal}
                onChange={handleChange}
                className="bg-transparent text-white border-none outline-none"
                style={{ fontSize: 16, colorScheme: "dark" }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function EntryRow({
  entry,
  mealId,
  onDeleted,
  onUpdated,
}: {
  entry: NutritionEntry & {
    food_items?: {
      name_fr?: string;
      category_l1?: string | null;
      category_l2?: string | null;
      icon_key?: string | null;
    };
  };
  mealId: string;
  onDeleted: (entryId: string) => void;
  onUpdated: (
    entryId: string,
    quantity_g: number,
    newMealTotals: Record<string, number>,
  ) => void;
}) {
  const name =
    entry.food_items?.name_fr ?? (entry as any).food_item?.name_fr ?? "—";
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(entry.quantity_g));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveQty(e: React.FormEvent) {
    e.preventDefault();
    const q = parseFloat(qty);
    if (!q || q <= 0 || q === entry.quantity_g) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/client/nutrition/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity_g: q }),
    });
    if (res.ok) {
      const json = await res.json();
      onUpdated(entry.id, q, json.meal?.totals ?? {});
    }
    setSaving(false);
    setEditing(false);
  }

  async function deleteEntry(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    const res = await fetch(`/api/client/nutrition/entries/${entry.id}`, {
      method: "DELETE",
    });
    if (res.ok) onDeleted(entry.id);
    else setDeleting(false);
  }

  return (
    <div
      className={`flex items-center gap-2 transition-opacity ${deleting ? "opacity-30" : ""}`}
    >
      <FoodIcon food={entry.food_items ?? (entry as any).food_item} size={34} />
      <span className="text-[12px] text-white/65 truncate flex-1 min-w-0">
        {name}
      </span>
      {editing ? (
        <form
          onSubmit={saveQty}
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            type="number"
            min={1}
            max={5000}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-14 h-6 bg-white/[0.08] border border-white/[0.12] rounded-lg text-[11px] text-white text-center tabular-nums outline-none focus:border-white/30"
          />
          <span className="text-[10px] text-white/30">g</span>
          <button
            type="submit"
            disabled={saving}
            className="h-6 px-2 bg-white/[0.1] rounded-lg text-[10px] text-white/70 hover:text-white active:scale-95 transition-all disabled:opacity-40"
          >
            {saving ? "…" : "✓"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(false);
            }}
            className="h-6 px-2 bg-white/[0.05] rounded-lg text-[10px] text-white/40 hover:text-white/70"
          >
            ✕
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="flex items-center gap-1 group"
          >
            <span className="text-[11px] text-white/30 group-hover:text-white/60 transition-colors tabular-nums">
              {entry.quantity_g}g
            </span>
            <Pencil
              size={8}
              className="text-white/15 group-hover:text-white/40 transition-colors"
            />
          </button>
          <span className="text-[11px] text-white/40 font-semibold w-14 text-right tabular-nums">
            {Math.round(entry.calories_kcal)} kcal
          </span>
          <button
            onClick={deleteEntry}
            disabled={deleting}
            className="h-6 w-6 flex items-center justify-center rounded-lg bg-red-500/0 hover:bg-red-500/15 text-white/20 hover:text-red-400 active:scale-95 transition-all disabled:opacity-40"
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

function MealCard({
  meal,
  expanded,
  onToggle,
  onDelete,
  onTypeChange,
  onAddMore,
  onRefinePhotoMeal,
  isDeleting,
}: {
  meal: NutritionMeal;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onTypeChange: (t: string) => void;
  onAddMore: () => void;
  onRefinePhotoMeal?: () => void;
  isDeleting: boolean;
}) {
  const { t } = useClientT();
  const [entries, setEntries] = useState<NutritionMeal["entries"]>(
    meal.entries,
  );
  const [loggedAt, setLoggedAt] = useState(meal.logged_at);
  const [totals, setTotals] = useState({
    total_calories: meal.total_calories,
    total_protein_g: meal.total_protein_g,
    total_carbs_g: meal.total_carbs_g,
    total_fat_g: meal.total_fat_g,
  });

  useEffect(() => {
    setEntries(meal.entries);
    setLoggedAt(meal.logged_at);
    setTotals({
      total_calories: meal.total_calories,
      total_protein_g: meal.total_protein_g,
      total_carbs_g: meal.total_carbs_g,
      total_fat_g: meal.total_fat_g,
    });
  }, [meal]);

  const photoBadge =
    meal.meal_source === "photo_guided"
      ? meal.photo_log_status === "refined"
        ? {
            label: t("nutrition.photo.badgeRefined"),
            className: "border-white/[0.12] bg-white/[0.08] text-white/78",
          }
        : {
            label: t("nutrition.photo.badgeGuided"),
            className: "border-white/[0.08] bg-white/[0.04] text-white/55",
          }
      : null;

  function handleEntryDeleted(entryId: string) {
    setEntries((prev) => prev?.filter((e) => e.id !== entryId));
  }

  function handleEntryUpdated(
    entryId: string,
    quantity_g: number,
    newTotals: Record<string, number>,
  ) {
    setEntries((prev) =>
      prev?.map((e) => (e.id === entryId ? { ...e, quantity_g } : e)),
    );
    if (newTotals.total_calories !== undefined) {
      setTotals({
        total_calories: newTotals.total_calories,
        total_protein_g: newTotals.total_protein_g ?? totals.total_protein_g,
        total_carbs_g: newTotals.total_carbs_g ?? totals.total_carbs_g,
        total_fat_g: newTotals.total_fat_g ?? totals.total_fat_g,
      });
    }
  }

  return (
    <motion.div
      layout
      animate={{ opacity: isDeleting ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      className="bg-[#111111] rounded-2xl"
    >
      <div
        className="flex items-center px-4 pt-4 pb-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <MealTypeChooser
              mealId={meal.id}
              current={meal.meal_type}
              onChange={onTypeChange}
            />
            {photoBadge && (
              <span
                className={`inline-flex h-5 items-center rounded-full border px-2 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.12em] ${photoBadge.className}`}
              >
                {photoBadge.label}
              </span>
            )}
          </div>
          <TimeEditor
            mealId={meal.id}
            loggedAt={loggedAt}
            onUpdated={setLoggedAt}
          />
        </div>
        <div className="text-right mr-3">
          <p className="text-[22px] font-black text-white leading-none">
            {Math.round(totals.total_calories)}
          </p>
          <p className="text-[9px] uppercase tracking-[0.12em] text-white/25">
            kcal
          </p>
        </div>
        <div className="text-white/20 shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex gap-3 mb-2">
          <span
            className="text-[11px] font-semibold"
            style={{ color: MC.prot }}
          >
            P {totals.total_protein_g}g
          </span>
          <span
            className="text-[11px] font-semibold"
            style={{ color: MC.carb }}
          >
            G {totals.total_carbs_g}g
          </span>
          <span className="text-[11px] font-semibold" style={{ color: MC.fat }}>
            L {totals.total_fat_g}g
          </span>
        </div>
        <MacroStrip
          p={totals.total_protein_g}
          g={totals.total_carbs_g}
          f={totals.total_fat_g}
        />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/20 pt-3 pb-2">
                {t("journal.ingredients")}
              </p>
              {entries && entries.length > 0 ? (
                <div className="space-y-2">
                  {entries.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e as any}
                      mealId={meal.id}
                      onDeleted={handleEntryDeleted}
                      onUpdated={handleEntryUpdated}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-white/20 pb-1">—</p>
              )}
            </div>
            <div className="px-4 pb-4 pt-2 flex gap-2">
              <button
                onClick={onAddMore}
                className="flex-1 h-8 flex items-center justify-center gap-1.5 bg-white/[0.05] rounded-xl text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.08] active:scale-[0.98] transition-all"
              >
                {t("journal.addIngredients")}
              </button>
              {meal.meal_source === "photo_guided" && onRefinePhotoMeal && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefinePhotoMeal();
                  }}
                  className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-[11px] text-white/70 active:scale-[0.98] transition-all"
                >
                  {t("nutrition.prep.refineLeftovers")}
                </button>
              )}
              <button
                onClick={onDelete}
                className="h-8 w-8 flex items-center justify-center bg-red-500/10 border border-red-500/15 rounded-xl text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Prep entry row (Planning view) — inline quantity edit, delete ────────────

type PrepEntry = SmartNutritionPrep["entries"][number];

async function materializeCoachPrep(
  prep: SmartNutritionPrep,
  entries: PrepEntry[] = prep.entries,
  isActive: boolean = prep.is_active,
) {
  if (!prep.is_virtual) return prep;
  const res = await fetch("/api/client/nutrition/planning-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      physiological_date: prep.physiological_date,
      title: prep.title,
      meal_type: prep.meal_type ?? prep.meal_slot,
      meal_slot: prep.meal_slot,
      variant_group_id: prep.variant_group_id,
      scenario_key: prep.scenario_key,
      scenario_label: prep.scenario_label,
      is_active: isActive,
      planned_for: prep.planned_for,
      source_protocol_id: prep.source_protocol_id,
      source_day_position: prep.source_day_position,
      source_meal_id: prep.source_meal_id,
      source_snapshot: prep.source_snapshot,
      entries: entries.map((entry) => ({
        food_item_id: entry.food_item_id,
        quantity_g: entry.quantity_g,
      })),
    }),
  });
  if (res.status === 409) {
    return { ...prep, status: "logged" as const, is_virtual: false };
  }
  if (!res.ok) return null;
  const json = await res.json();
  return json.data as SmartNutritionPrep;
}

function PrepEntryRow({
  entry,
  prepId,
  prep,
  readOnly = false,
  allEntries,
  onEntriesUpdated,
}: {
  entry: PrepEntry;
  prepId: string;
  prep: SmartNutritionPrep;
  readOnly?: boolean;
  allEntries: PrepEntry[];
  onEntriesUpdated: (
    entries: PrepEntry[],
    totals: {
      total_calories: number;
      total_protein_g: number;
      total_carbs_g: number;
      total_fat_g: number;
    },
    updatedPrep?: SmartNutritionPrep,
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(Math.round(entry.quantity_g)));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function patchEntries(nextEntries: PrepEntry[]) {
    const materialized = prep.is_virtual
      ? await materializeCoachPrep(prep, nextEntries)
      : null;
    const targetPrep = materialized ?? prep;
    if (prep.is_virtual && !materialized) return;

    const res = prep.is_virtual
      ? null
      : await fetch(`/api/client/nutrition/preps/${prepId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: nextEntries.map((e) => ({
              food_item_id: e.food_item_id,
              quantity_g: e.quantity_g,
            })),
          }),
        });
    if (res && !res.ok) return;

    const updated: SmartNutritionPrep = res
      ? (await res.json()).data
      : targetPrep;
    onEntriesUpdated(
      updated.entries,
      {
        total_calories: updated.total_calories,
        total_protein_g: updated.total_protein_g,
        total_carbs_g: updated.total_carbs_g,
        total_fat_g: updated.total_fat_g,
      },
      updated,
    );
  }

  async function saveQty(e: React.FormEvent) {
    e.preventDefault();
    const q = parseFloat(qty);
    if (!q || q <= 0 || q === entry.quantity_g) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const next = allEntries.map((en) =>
      en.food_item_id === entry.food_item_id ? { ...en, quantity_g: q } : en,
    );
    await patchEntries(next);
    setSaving(false);
    setEditing(false);
  }

  async function deleteEntry(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    const next = allEntries.filter(
      (en) => en.food_item_id !== entry.food_item_id,
    );
    await patchEntries(next);
    // onEntriesUpdated will remove this entry from parent state
  }

  return (
    <div
      className={`flex items-center gap-2 transition-opacity ${deleting ? "opacity-30" : ""}`}
    >
      <FoodIcon food={entry} size={34} />
      <span className="text-[12px] text-white/65 truncate flex-1 min-w-0">
        {entry.name_fr}
      </span>
      {editing && !readOnly ? (
        <form
          onSubmit={saveQty}
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            type="number"
            min={1}
            max={5000}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-14 h-6 bg-white/[0.08] border border-white/[0.12] rounded-lg text-[11px] text-white text-center tabular-nums outline-none focus:border-white/30"
          />
          <span className="text-[10px] text-white/30">g</span>
          <button
            type="submit"
            disabled={saving}
            className="h-6 px-2 bg-white/[0.1] rounded-lg text-[10px] text-white/70 active:scale-95 transition-all disabled:opacity-40"
          >
            {saving ? "…" : "✓"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(false);
            }}
            className="h-6 px-2 bg-white/[0.05] rounded-lg text-[10px] text-white/40"
          >
            ✕
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!readOnly) setEditing(true);
            }}
            className="flex items-center gap-1 group"
          >
            <span className="text-[11px] text-white/30 group-hover:text-white/60 transition-colors tabular-nums">
              {Math.round(entry.quantity_g)}g
            </span>
            {!readOnly && (
              <Pencil
                size={8}
                className="text-white/15 group-hover:text-white/40 transition-colors"
              />
            )}
          </button>
          <span className="text-[11px] text-white/40 font-semibold w-14 text-right tabular-nums">
            {Math.round(entry.calories_kcal)} kcal
          </span>
          {!readOnly && (
            <button
              onClick={deleteEntry}
              disabled={deleting}
              className="h-6 w-6 flex items-center justify-center rounded-lg bg-red-500/0 hover:bg-red-500/15 text-white/20 hover:text-red-400 active:scale-95 transition-all disabled:opacity-40"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Prep card (Planning view) — miroir de MealCard ──────────────────────────

function PrepCard({
  prep,
  expanded,
  onToggle,
  onAddMore,
  onValidated,
  onDeleted,
  isValidating,
  onUpdated,
  onToggleActive,
}: {
  prep: SmartNutritionPrep;
  expanded: boolean;
  onToggle: () => void;
  onAddMore: (prep: SmartNutritionPrep) => void;
  onValidated: (
    prep: SmartNutritionPrep,
    options?: { originalPrepId?: string; applyConsumedDelta?: boolean },
  ) => void;
  onDeleted: (id: string) => void;
  isValidating: boolean;
  onUpdated: (
    entries: PrepEntry[],
    totals: {
      total_calories: number;
      total_protein_g: number;
      total_carbs_g: number;
      total_fat_g: number;
    },
    updatedPrep?: SmartNutritionPrep,
  ) => void;
  onToggleActive?: (next: boolean) => void;
}) {
  const { t } = useClientT();
  const [entries, setEntries] = useState<PrepEntry[]>(prep.entries);
  const [totals, setTotals] = useState({
    total_calories: prep.total_calories,
    total_protein_g: prep.total_protein_g,
    total_carbs_g: prep.total_carbs_g,
    total_fat_g: prep.total_fat_g,
  });
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(prep.entries);
    setTotals({
      total_calories: prep.total_calories,
      total_protein_g: prep.total_protein_g,
      total_carbs_g: prep.total_carbs_g,
      total_fat_g: prep.total_fat_g,
    });
  }, [prep]);
  const Icon = MEAL_TYPE_ICON[prep.meal_slot] ?? Apple;

  // Toggle activation handled by parent via custom event on header

  function handleEntriesUpdated(
    nextEntries: PrepEntry[],
    newTotals: {
      total_calories: number;
      total_protein_g: number;
      total_carbs_g: number;
      total_fat_g: number;
    },
    updatedPrep?: SmartNutritionPrep,
  ) {
    setEntries(nextEntries);
    setTotals(newTotals);
    onUpdated(nextEntries, newTotals, updatedPrep);
  }

  async function handleValidate(e: React.MouseEvent) {
    e.stopPropagation();
    setError(null);
    const originalPrepId = prep.id;
    const materialized = await materializeCoachPrep(prep);
    if (!materialized) {
      setError(t("nutrition.prep.retryError"));
      return;
    }
    if (materialized.status === "logged") {
      onValidated(materialized, {
        originalPrepId,
        applyConsumedDelta: false,
      });
      return;
    }
    const result = await sendClientMutation({
      kind: "meal",
      url: `/api/client/nutrition/preps/${materialized.id}/log`,
      method: "POST",
    });
    if (result.queued || result.response?.ok) {
      onValidated(materialized, { originalPrepId });
    } else {
      setError(t("nutrition.prep.retryError"));
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    const res = await fetch(`/api/client/nutrition/preps/${prep.id}`, {
      method: "DELETE",
    });
    if (res.ok) onDeleted(prep.id);
    else {
      setError(t("nutrition.prep.deleteError"));
      setDeleting(false);
    }
  }

  const slotLabel = t(`compose.slot.${prep.meal_slot}` as const);
  const sourceBadge =
    prep.source_type === "coach_plan"
      ? prep.is_virtual
        ? t("nutrition.prep.coachPlan")
        : t("nutrition.prep.coachAdjusted")
      : null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const canValidateToday =
    prep.physiological_date === todayIso && prep.status === "planned";
  const isReadOnly = prep.status === "logged";
  const validationLabel =
    prep.status === "logged"
      ? t("nutrition.prep.validated")
      : canValidateToday
        ? t("nutrition.prep.validateAndLog")
        : t("nutrition.prep.validationDayOf");
  return (
    <motion.div
      layout
      animate={{ opacity: deleting || isValidating ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl overflow-hidden bg-[#111111] ${
        prep.is_active
          ? "border-[0.3px] border-[#1f8a65]/20 bg-[#1f8a65]/[0.03]"
          : "border border-transparent"
      }`}
    >
      {/* Header — tap to expand */}
      <div
        className="cursor-pointer select-none px-4 pt-4 pb-3"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-1.5">
              <Icon size={11} className="text-white/38" />
              <span className="text-[11px] font-bold text-white/48">
                {slotLabel}
              </span>
              {sourceBadge && (
                <span className="rounded-full border-[0.3px] border-[#1f8a65]/25 bg-[#1f8a65]/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#7ed8ba]">
                  {sourceBadge}
                </span>
              )}
            </div>
            <p className="truncate text-[13px] font-semibold leading-tight text-white/80">
              {prep.title || t("journal.ingredients")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[22px] font-black leading-none text-white">
              {Math.round(totals.total_calories)}
            </p>
            <p className="text-[9px] uppercase tracking-[0.12em] text-white/25">
              {t("prep.plannedCalories")}
            </p>
          </div>
          <div className="shrink-0 text-white/20">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
              {t("prep.includeInPreview")}
            </p>
            <p className="mt-0.5 text-[11px] text-white/38">
              {prep.is_active
                ? t("prep.includedInPreview")
                : t("prep.excludedFromPreview")}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (typeof onToggleActive === "function") {
                onToggleActive(!prep.is_active);
              }
            }}
            aria-pressed={prep.is_active}
            aria-label={t("prep.includeInPreview")}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              prep.is_active ? "bg-[#1f8a65]/25" : "bg-white/[0.04]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-transform ${
                prep.is_active
                  ? "translate-x-5 bg-[#7ed8ba]"
                  : "translate-x-0 bg-white"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Macros + strip */}
      <div className="px-4 pb-3">
        <div className="flex gap-3 mb-2">
          <span
            className="text-[11px] font-semibold"
            style={{ color: MC.prot }}
          >
            P {Math.round(totals.total_protein_g)}g
          </span>
          <span
            className="text-[11px] font-semibold"
            style={{ color: MC.carb }}
          >
            G {Math.round(totals.total_carbs_g)}g
          </span>
          <span className="text-[11px] font-semibold" style={{ color: MC.fat }}>
            L {Math.round(totals.total_fat_g)}g
          </span>
        </div>
        <MacroStrip
          p={totals.total_protein_g}
          g={totals.total_carbs_g}
          f={totals.total_fat_g}
        />
      </div>

      {/* Expanded section */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/20 pt-3 pb-2">
                {t("journal.ingredients")}
              </p>
              {entries.length > 0 ? (
                <div className="space-y-2">
                  {entries.map((e) => (
                    <PrepEntryRow
                      key={e.food_item_id}
                      entry={e}
                      prepId={prep.id}
                      prep={prep}
                      readOnly={isReadOnly}
                      allEntries={entries}
                      onEntriesUpdated={handleEntriesUpdated}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-white/20 pb-1">—</p>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 pt-2 flex gap-2">
              {/* Ajouter des aliments */}
              {!isReadOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddMore(prep);
                  }}
                  className="flex-1 h-8 flex items-center justify-center gap-1.5 bg-white/[0.04] rounded-xl text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.07] active:scale-[0.98] transition-all"
                >
                  {t("journal.addIngredients")}
                </button>
              )}
              {/* Supprimer le prep */}
              {!isReadOnly && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-8 w-8 flex items-center justify-center bg-red-500/10 border border-red-500/15 rounded-xl text-red-400 hover:bg-red-500/20 active:scale-95 transition-all disabled:opacity-40"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {/* Valider → bouton pleine largeur en bas, très visible */}
            <div className="px-4 pb-4">
              <button
                onClick={handleValidate}
                disabled={isValidating || !canValidateToday}
                className="w-full h-10 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.12em] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  "…"
                ) : (
                  <>
                    <Check size={13} />
                    {validationLabel}
                  </>
                )}
              </button>
            </div>

            {error && (
              <p className="px-4 pb-3 text-[10px] text-red-400">{error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type BilanView = "bilan" | "planning";

interface Props {
  initialMeals: NutritionMeal[];
  initialPreps: SmartNutritionPrep[];
  date: string;
  target: NutritionMacros;
  consumed: NutritionMacros;
  initialView?: BilanView;
  onAddMeal?: () => void;
  onRefinePhotoMeal?: (mealId: string) => void;
  onAddMore?: (mealId: string) => void;
  onEditPrep?: (prep: SmartNutritionPrep) => void;
  onNewPrep?: () => void;
  onPrepValidated?: () => void;
  gender?: string | null;
  bodyWeightKg?: number | null;
}

export default function NutritionMealsList({
  initialMeals,
  initialPreps,
  date,
  target,
  consumed,
  initialView = "bilan",
  onAddMeal,
  onRefinePhotoMeal,
  onAddMore,
  onEditPrep,
  onNewPrep,
  onPrepValidated,
  gender,
  bodyWeightKg,
}: Props) {
  const { t } = useClientT();
  const router = useRouter();
  const [view, setView] = useState<BilanView>(initialView);
  const [meals, setMeals] = useState<NutritionMeal[]>(initialMeals);
  const [preps, setPreps] = useState<SmartNutritionPrep[]>(initialPreps);
  const [localConsumed, setLocalConsumed] = useState(consumed);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    setMeals(initialMeals);
  }, [initialMeals]);

  useEffect(() => {
    setPreps(initialPreps);
  }, [initialPreps]);

  useEffect(() => {
    setLocalConsumed(consumed);
  }, [consumed]);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  // Preps du jour uniquement (planned + logged for past/day state)
  const todayPreps = preps.filter(
    (p) =>
      (p.status === "planned" || p.status === "logged") &&
      p.physiological_date === date,
  );

  const todayPlannedPreps = todayPreps.filter((p) => p.status === "planned");

  const simulationPreps = todayPlannedPreps.filter(
    (prep) => prep.status === "planned" && prep.is_active === true,
  );
  const prepKcal = simulationPreps.reduce(
    (acc, p) => acc + p.total_calories,
    0,
  );
  const prepProtein = simulationPreps.reduce(
    (acc, p) => acc + p.total_protein_g,
    0,
  );
  const prepCarbs = simulationPreps.reduce(
    (acc, p) => acc + p.total_carbs_g,
    0,
  );
  const prepFat = simulationPreps.reduce((acc, p) => acc + p.total_fat_g, 0);

  const totalKcal = (localConsumed?.kcal ?? 0) + prepKcal;
  const totalProtein = (localConsumed?.protein_g ?? 0) + prepProtein;
  const totalCarbs = (localConsumed?.carbs_g ?? 0) + prepCarbs;
  const totalFat = (localConsumed?.fat_g ?? 0) + prepFat;

  // Calcul du reste à consommer ajustable en prenant en compte le total simulé (consommé + préparé)
  const actionable = computeActionableRemaining({
    target: {
      kcal: target.kcal,
      protein_g: target.protein_g,
      carbs_g: target.carbs_g,
      fat_g: target.fat_g,
    },
    consumed: {
      kcal: totalKcal,
      protein_g: totalProtein,
      carbs_g: totalCarbs,
      fat_g: totalFat,
    },
    profile: { gender, weightKg: bodyWeightKg },
  });

  const adjustedProtein = Math.max(
    0,
    target.protein_g - actionable.compensation.proteinReducedG,
  );
  const adjustedCarbs = Math.max(
    0,
    target.carbs_g - actionable.compensation.carbsReducedG,
  );
  const adjustedFat = Math.max(
    0,
    target.fat_g - actionable.compensation.fatReducedG,
  );

  const handlePrepUpdated = (
    prepId: string,
    nextEntries: PrepEntry[],
    newTotals: {
      total_calories: number;
      total_protein_g: number;
      total_carbs_g: number;
      total_fat_g: number;
    },
    updatedPrep?: SmartNutritionPrep,
  ) => {
    setPreps((prev) =>
      prev.map((p) => {
        if (p.id === prepId) {
          return {
            ...p,
            ...(updatedPrep ?? {}),
            entries: nextEntries,
            ...newTotals,
            is_virtual: false,
          };
        }
        return p;
      }),
    );
  };

  async function togglePrepActive(prepId: string, nextActive: boolean) {
    const currentPrep = preps.find((p) => p.id === prepId);
    if (!currentPrep) return;

    setPreps((prev) =>
      prev.map((p) => {
        if (p.id === prepId) return { ...p, is_active: nextActive };
        if (
          nextActive &&
          p.meal_slot === currentPrep.meal_slot &&
          p.variant_group_id === currentPrep.variant_group_id &&
          p.scenario_key === currentPrep.scenario_key
        ) {
          return { ...p, is_active: false };
        }
        return p;
      }),
    );

    const materializedPrep = currentPrep.is_virtual
      ? await materializeCoachPrep(currentPrep, currentPrep.entries, nextActive)
      : currentPrep;

    if (!materializedPrep) {
      setPreps((prev) =>
        prev.map((p) =>
          p.id === prepId ? { ...p, is_active: currentPrep.is_active } : p,
        ),
      );
      return;
    }

    if (currentPrep.is_virtual) {
      setPreps((prev) =>
        prev.map((p) => {
          if (p.id !== prepId) return p;
          return {
            ...materializedPrep,
            is_active: nextActive,
            is_virtual: false,
          };
        }),
      );
    }

    const targetPrepId = materializedPrep.id;
    const res = await fetch(`/api/client/nutrition/preps/${targetPrepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: nextActive }),
    });

    if (!res.ok) {
      setPreps((prev) =>
        prev.map((p) =>
          p.id === prepId
            ? { ...currentPrep, id: currentPrep.id }
            : p,
        ),
      );
      return;
    }

    const json = await res.json();
    const updatedPrep = json?.data as SmartNutritionPrep | undefined;
    if (!updatedPrep) return;

    setPreps((prev) =>
      prev.map((p) => {
        if (p.id === prepId || p.id === targetPrepId) {
          return {
            ...p,
            ...updatedPrep,
            is_virtual: false,
          };
        }
        if (
          updatedPrep.is_active &&
          p.id !== prepId &&
          p.id !== targetPrepId &&
          p.meal_slot === updatedPrep.meal_slot &&
          p.variant_group_id === updatedPrep.variant_group_id &&
          p.scenario_key === updatedPrep.scenario_key
        ) {
          return { ...p, is_active: false };
        }
        return p;
      }),
    );
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  async function executeDelete() {
    if (!confirmTarget) return;
    const { id } = confirmTarget;
    setConfirmTarget(null);
    setDeletingId(id);
    const res = await fetch(`/api/client/nutrition/meals/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMeals((prev) => prev.filter((m) => m.id !== id));
      router.refresh();
    }
    setDeletingId(null);
  }

  function updateMealType(id: string, mealType: string) {
    setMeals((prev) =>
      prev.map((m) => (m.id === id ? { ...m, meal_type: mealType as any } : m)),
    );
  }

  const [expandedPreps, setExpandedPreps] = useState<Set<string>>(new Set());
  const [validatingId, setValidatingId] = useState<string | null>(null);

  // Collapse expanded meal/prep cards when the user scrolls up (to mimic behavior on planning surface)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastY = window.scrollY;
    let raf = 0;
    function onScroll() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        // if scrolled up by more than 20px, collapse any open cards
        if (lastY - y > 20) {
          setExpanded(new Set());
          setExpandedPreps(new Set());
        }
        lastY = y;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  function toggleExpandPrep(id: string) {
    setExpandedPreps((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function handlePrepDeleted(id: string) {
    setPreps((prev) => prev.filter((p) => p.id !== id));
    router.refresh();
  }

  function handlePrepValidated(
    prep: SmartNutritionPrep,
    options: { originalPrepId?: string; applyConsumedDelta?: boolean } = {},
  ) {
    setValidatingId(prep.id);
    const applyConsumedDelta = options.applyConsumedDelta !== false;
    if (applyConsumedDelta) {
      setLocalConsumed((current) => ({
        ...current,
        kcal: current.kcal + prep.total_calories,
        protein_g: current.protein_g + prep.total_protein_g,
        carbs_g: current.carbs_g + prep.total_carbs_g,
        fat_g: current.fat_g + prep.total_fat_g,
      }));
    }
    setPreps((current) =>
      current.filter(
        (item) => item.id !== prep.id && item.id !== options.originalPrepId,
      ),
    );
    queueNutritionLiveRefresh(
      applyConsumedDelta
        ? {
            date,
            consumedDelta: {
              kcal: prep.total_calories,
              protein_g: prep.total_protein_g,
              carbs_g: prep.total_carbs_g,
              fat_g: prep.total_fat_g,
            },
            removePrepIds: [prep.id, options.originalPrepId].filter(
              Boolean,
            ) as string[],
          }
        : {
            date,
            removePrepIds: [prep.id, options.originalPrepId].filter(
              Boolean,
            ) as string[],
          },
    );
    // Petite animation avant de rafraîchir
    setTimeout(() => {
      if (navigator.onLine !== false) {
        onPrepValidated?.();
        router.refresh();
      }
    }, 350);
  }

  return (
    <>
      {/* ── Toggle Bilan / Planning — remplace le label "Bilan du jour" ── */}
      <div className="flex items-center justify-between w-full gap-2">
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 shrink-0">
          {(["bilan", "planning"] as BilanView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-barlow-condensed font-bold uppercase tracking-wide transition-all duration-200 ${
                view === v
                  ? "bg-[#f2f2f2] text-[#080808] shadow-sm"
                  : "text-white/40"
              }`}
            >
              {v === "bilan" ? t("journal.summary") : t("nutrition.planning.base")}
            </button>
          ))}
        </div>

        {view === "planning" && (
          <div className="flex items-end gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-2 py-2 pr-2.5">
            {/* Calories Gauge */}
            <div className="flex flex-col items-start gap-[3px] shrink-0">
              <span className="text-[9px] font-semibold leading-none">
                <span style={{ color: NUTRITION_UI_COLORS.calories }}>
                  {Math.round(totalKcal)}
                </span>
                <span className="text-white/50">
                  /{Math.round(target.kcal)}
                </span>
              </span>
              <div className="relative w-[48px] h-[13px] bg-white/[0.06] rounded-xl overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out rounded-xl"
                  style={{
                    width: `${Math.min(100, (totalKcal / (target.kcal || 1)) * 100)}%`,
                    backgroundColor: NUTRITION_UI_COLORS.calories,
                  }}
                />
              </div>
            </div>

            {/* Protein Gauge */}
            <div className="flex flex-col items-start gap-[3px] shrink-0">
              <span className="text-[9px] font-semibold leading-none">
                <span style={{ color: NUTRITION_UI_COLORS.protein }}>
                  {Math.round(totalProtein)}
                </span>
                <span className="text-white/50">
                  /{Math.round(adjustedProtein)}
                </span>
              </span>
              <div className="relative w-[48px] h-[13px] bg-white/[0.06] rounded-xl overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out rounded-xl"
                  style={{
                    width: `${Math.min(100, (totalProtein / (adjustedProtein || 1)) * 100)}%`,
                    backgroundColor: NUTRITION_UI_COLORS.protein,
                  }}
                />
              </div>
            </div>

            {/* Carbs Gauge */}
            <div className="flex flex-col items-start gap-[3px] shrink-0">
              <span className="text-[9px] font-semibold leading-none">
                <span style={{ color: NUTRITION_UI_COLORS.carbs }}>
                  {Math.round(totalCarbs)}
                </span>
                <span className="text-white/50">
                  /{Math.round(adjustedCarbs)}
                </span>
              </span>
              <div className="relative w-[48px] h-[13px] bg-white/[0.06] rounded-xl overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out rounded-xl"
                  style={{
                    width: `${Math.min(100, (totalCarbs / (adjustedCarbs || 1)) * 100)}%`,
                    backgroundColor: NUTRITION_UI_COLORS.carbs,
                  }}
                />
              </div>
            </div>

            {/* Fat Gauge */}
            <div className="flex flex-col items-start gap-[3px] shrink-0">
              <span className="text-[9px] font-semibold leading-none">
                <span style={{ color: NUTRITION_UI_COLORS.fat }}>
                  {Math.round(totalFat)}
                </span>
                <span className="text-white/50">
                  /{Math.round(adjustedFat)}
                </span>
              </span>
              <div className="relative w-[48px] h-[13px] bg-white/[0.06] rounded-xl overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out rounded-xl"
                  style={{
                    width: `${Math.min(100, (totalFat / (adjustedFat || 1)) * 100)}%`,
                    backgroundColor: NUTRITION_UI_COLORS.fat,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ VUE BILAN — repas loggés ══ */}
      {view === "bilan" && (
        <>
          {meals.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-[24px] border border-white/[0.08] bg-[#111114] px-4 py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
                <Coffee size={20} className="text-white/15" />
              </div>
              <p className="text-[13px] text-white/25">
                {t("journal.noMeals")}
              </p>
              <button
                onClick={() =>
                  onAddMeal ? onAddMeal() : router.push("/client/nutrition/log")
                }
                className="h-11 rounded-2xl bg-[#f2f2f2] px-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#080808] active:scale-95 transition-all"
              >
                {t("journal.addMeal")}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {meals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    expanded={expanded.has(meal.id)}
                    onToggle={() => toggleExpand(meal.id)}
                    onDelete={() =>
                      setConfirmTarget({
                        id: meal.id,
                        label: MEAL_TYPE_KEYS[meal.meal_type]
                          ? t(MEAL_TYPE_KEYS[meal.meal_type])
                          : meal.meal_type,
                      })
                    }
                    onTypeChange={(type) => updateMealType(meal.id, type)}
                    onAddMore={() =>
                      onAddMore
                        ? onAddMore(meal.id)
                        : router.push(
                            `/client/nutrition/log?meal_id=${meal.id}`,
                          )
                    }
                    onRefinePhotoMeal={
                      meal.meal_source === "photo_guided"
                        ? () => onRefinePhotoMeal?.(meal.id)
                        : undefined
                    }
                    isDeleting={deletingId === meal.id}
                  />
                ))}
              </AnimatePresence>

              <div className="grid gap-2 grid-cols-1">
                <button
                  onClick={() =>
                    onAddMeal
                      ? onAddMeal()
                      : router.push("/client/nutrition/log")
                  }
                  className="w-full h-11 rounded-2xl bg-[#f2f2f2] text-[#080808] text-[11px] font-bold uppercase tracking-[0.12em] active:scale-[0.98] transition-all"
                >
                  {t("journal.addMeal")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ VUE PLANNING — preps du jour ══ */}
      {view === "planning" && (
        <>
          {todayPlannedPreps.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-[24px] border border-white/[0.08] bg-[#111114] px-4 py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
                <Sparkles size={20} className="text-white/18" />
              </div>
              <p className="text-[13px] text-white/25">
                {t("nutrition.prep.nonePlannedToday")}
              </p>
              <button
                onClick={() => (onNewPrep ? onNewPrep() : undefined)}
                className="h-11 rounded-2xl bg-[#f2f2f2] px-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#080808] active:scale-95 transition-all"
              >
                {t("nutrition.prep.planMeal")}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {todayPlannedPreps.map((prep) => (
                  <PrepCard
                    key={prep.id}
                    prep={prep}
                    expanded={expandedPreps.has(prep.id)}
                    onToggle={() => toggleExpandPrep(prep.id)}
                    onAddMore={(p) => onEditPrep?.(p)}
                    onValidated={handlePrepValidated}
                    onDeleted={handlePrepDeleted}
                    onToggleActive={(next) => togglePrepActive(prep.id, next)}
                    isValidating={validatingId === prep.id}
                    onUpdated={(nextEntries, newTotals, updatedPrep) =>
                      handlePrepUpdated(
                        prep.id,
                        nextEntries,
                        newTotals,
                        updatedPrep,
                      )
                    }
                  />
                ))}
              </AnimatePresence>
              <button
                onClick={() => (onNewPrep ? onNewPrep() : undefined)}
                className="w-full h-11 rounded-2xl bg-[#f2f2f2] text-[#080808] text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.10em] active:scale-[0.98] transition-all"
              >
                {t("nutrition.prep.planMeal")}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Confirmation suppression repas ── */}
      <AnimatePresence>
        {confirmTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmTarget(null)}
              className="fixed inset-0 z-[80] bg-black/60"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="fixed bottom-[100px] left-4 right-4 z-[90] max-w-[400px] mx-auto bg-[#111111] rounded-2xl p-5 shadow-[0_16px_48px_rgba(0,0,0,0.8)]"
            >
              <p className="text-[14px] font-bold text-white mb-1">
                {t("journal.deleteTitle")}
              </p>
              <p className="text-[12px] text-white/40 mb-5">
                {t("journal.deleteDesc", { label: confirmTarget.label })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmTarget(null)}
                  className="flex-1 h-10 rounded-xl bg-white/[0.06] text-[12px] font-semibold text-white/60 hover:text-white active:scale-[0.98] transition-all"
                >
                  {t("journal.cancel")}
                </button>
                <button
                  onClick={executeDelete}
                  className="flex-1 h-10 rounded-xl bg-red-500 text-[12px] font-bold text-white hover:bg-red-600 active:scale-[0.98] transition-all"
                >
                  {t("journal.delete")}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
