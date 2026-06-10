# FAB RadialActionMenu — Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the FAB RadialActionMenu from cheap square buttons in an uneven arc to premium rounded circles in a mathematically uniform 120° arc, and convert the "Repas" action from a page navigation to an inline MealLogSheet bottom sheet.

**Architecture:** Refactor in-place on `RadialActionMenu.tsx` — no new top-level component hierarchy. Extract `NutritionLogInner` logic into a reusable `NutritionLogContent` component so both the existing page route and the new `MealLogSheet` can share it. `MealLogSheet` is a standalone bottom sheet component that embeds `NutritionLogContent`.

**Tech Stack:** React, Next.js App Router, Framer Motion (AnimatePresence + motion), Phosphor Icons, Tailwind CSS, DS v3.0 tokens.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/client/nutrition/log/NutritionLogContent.tsx` | **Create** | All logic + UI from `NutritionLogInner`, accepts `onSuccess?: () => void` |
| `app/client/nutrition/log/page.tsx` | **Modify** | Thin wrapper — renders `NutritionLogContent` with `router.push` as `onSuccess` |
| `components/client/smart/MealLogSheet.tsx` | **Create** | Bottom sheet, header, backdrop, embeds `NutritionLogContent` |
| `components/client/smart/RadialActionMenu.tsx` | **Modify** | Arc 120°, rounded circles, spring premium, `mealSheetOpen` state, renders `MealLogSheet` |

---

## Task 1 — Extract NutritionLogContent

**Files:**
- Create: `app/client/nutrition/log/NutritionLogContent.tsx`
- Modify: `app/client/nutrition/log/page.tsx`

- [ ] **Step 1: Create NutritionLogContent.tsx**

Move everything from `NutritionLogInner` (lines 116–731 of `page.tsx`) into a new file. Add `onSuccess` prop. Replace the `router.push("/client/nutrition/journal")` call on successful save with `onSuccess?.()` then fall back to router push when no callback provided.

```tsx
// app/client/nutrition/log/NutritionLogContent.tsx
"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, Search, Plus, Minus, Check, Trash2, X, Pencil } from "lucide-react"
import type { CategoryL1, EntryDraft, FoodItem } from "@/lib/nutrition/food-items"
import {
  PORTION_SIZES,
  PORTION_MULTIPLIERS,
  calcEntryMacros,
  getScaledPortionG,
  isHandOverrideSet,
  sumDraftMacros,
  type PortionScalingProfile,
} from "@/lib/nutrition/food-items"
import { useClientT } from "@/components/client/ClientI18nProvider"
import type { ClientDictKey } from "@/lib/i18n/clientTranslations"

// ─── Icônes catégories ───────────────────────────────────────
const CATEGORY_ICONS: Record<CategoryL1, string> = {
  proteins: "🥩", carbs: "🌾", vegetables: "🥦", fruits: "🍎",
  fats: "🥑", drinks: "💧", extras: "🍿",
}

const SUBCATEGORY_ICONS: Record<string, string> = {
  viandes: "🥩", poissons: "🐟", oeufs: "🥚", laitiers: "🥛",
  vegetales: "🌿", complements: "💪", cereales: "🌾", fecules: "🥔",
  pain: "🍞", legumineuses: "🫘", feuilles: "🥬", cruciferes: "🥦",
  "autres-legumes": "🥕", frais: "🍓", secs: "🍇", huiles: "🫒",
  "noix-graines": "🌰", "autres-lipides": "🥑", sauces: "🫙",
  boissons: "🥤", eau: "💧", chauds: "☕", "jus-smoothies": "🍹",
  "laits-vegetaux": "🥛", "sports-drinks": "⚡", alcools: "🍷",
  "snacks-sales": "🍿", "snacks-sucres": "🍫", "fast-food": "🍔", divers: "🧀",
}

const PORTION_ICON_BY_KEY: Record<string, string> = {
  palm: "🤚", "half-palm": "✋", fist: "✊", "fist-dry": "👊",
  thumb: "👍", pinch: "🤏", "cupped-hands": "🙌", "bowl-hands": "🥣",
  tbsp: "🥄", "tbsp-heaped": "🥄", tsp: "☕", plate: "🍽️",
  "bread-slice": "🍞", "egg-medium": "🥚", glass: "🥛",
}

const SUBCATEGORIES: Record<CategoryL1, string[]> = {
  proteins: ["viandes", "poissons", "oeufs", "laitiers", "vegetales", "complements"],
  carbs: ["cereales", "fecules", "pain", "legumineuses"],
  vegetables: ["feuilles", "cruciferes", "autres-legumes"],
  fruits: ["frais", "secs"],
  fats: ["huiles", "noix-graines", "autres-lipides"],
  drinks: ["eau", "chauds", "jus-smoothies", "laits-vegetaux", "sports-drinks", "alcools"],
  extras: ["sauces", "boissons", "snacks-sales", "snacks-sucres", "fast-food", "divers"],
}

type Layer = "category" | "subcategory" | "item" | "quantity"

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
}

export interface NutritionLogContentProps {
  onSuccess?: () => void
  /** When true, renders without the fixed TopBar (used inside MealLogSheet which has its own header) */
  embedded?: boolean
}

export function NutritionLogContent({ onSuccess, embedded = false }: NutritionLogContentProps) {
  const { t } = useClientT()
  const router = useRouter()
  const searchParams = useSearchParams()

  const CATEGORY_LABELS_T: Record<CategoryL1, string> = {
    proteins: t('food.cat.proteins'), carbs: t('food.cat.carbs'),
    vegetables: t('food.cat.vegetables'), fruits: t('food.cat.fruits'),
    fats: t('food.cat.fats'), drinks: t('food.cat.drinks'), extras: t('food.cat.extras'),
  }

  const SUBCATEGORY_LABELS_T: Record<string, string> = {
    viandes: t('food.sub.viandes'), poissons: t('food.sub.poissons'),
    oeufs: t('food.sub.oeufs'), laitiers: t('food.sub.laitiers'),
    vegetales: t('food.sub.vegetales'), complements: t('food.sub.complements'),
    cereales: t('food.sub.cereales'), fecules: t('food.sub.fecules'),
    pain: t('food.sub.pain'), legumineuses: t('food.sub.legumineuses'),
    feuilles: t('food.sub.feuilles'), cruciferes: t('food.sub.cruciferes'),
    'autres-legumes': t('food.sub.autres-legumes'), frais: t('food.sub.frais'),
    secs: t('food.sub.secs'), huiles: t('food.sub.huiles'),
    'noix-graines': t('food.sub.noix-graines'), 'autres-lipides': t('food.sub.autres-lipides'),
    sauces: t('food.sub.sauces'), boissons: t('food.sub.boissons'),
    divers: t('food.sub.divers'), 'snacks-sales': t('food.sub.snacks-sales'),
    'snacks-sucres': t('food.sub.snacks-sucres'), 'fast-food': t('food.sub.fast-food'),
    eau: t('food.sub.eau'), chauds: t('food.sub.chauds'),
    'jus-smoothies': t('food.sub.jus-smoothies'), 'laits-vegetaux': t('food.sub.laits-vegetaux'),
    'sports-drinks': t('food.sub.sports-drinks'), alcools: t('food.sub.alcools'),
  }

  const existingMealId = searchParams.get("meal_id")

  const [layer, setLayer] = useState<Layer>("category")
  const [direction, setDirection] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<CategoryL1 | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null)
  const [items, setItems] = useState<FoodItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [searchQ, setSearchQ] = useState("")
  const [qMode, setQMode] = useState<"grams" | "portion">("grams")
  const [quantityG, setQuantityG] = useState<number>(100)
  const [selectedPortion, setSelectedPortion] = useState<number>(0)
  const [portionMult, setPortionMult] = useState<number>(1)
  const [scalingProfile, setScalingProfile] = useState<PortionScalingProfile | null>(null)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [drafts, setDrafts] = useState<EntryDraft[]>([])
  const [saving, setSaving] = useState(false)
  const footerRef = useRef<HTMLDivElement>(null)
  const [footerH, setFooterH] = useState(120)

  useEffect(() => {
    let cancelled = false
    fetch('/api/client/profile-scaling')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setScalingProfile(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!footerRef.current) return
    const ro = new ResizeObserver(() => {
      setFooterH(footerRef.current?.offsetHeight ?? 120)
    })
    ro.observe(footerRef.current)
    return () => ro.disconnect()
  }, [])

  function goTo(next: Layer, dir: number) { setDirection(dir); setLayer(next) }
  function selectCategory(cat: CategoryL1) { setSelectedCategory(cat); setSelectedSubcategory(null); goTo("subcategory", 1) }
  function selectSubcategory(sub: string) { setSelectedSubcategory(sub); setSearchQ(""); goTo("item", 1) }
  function selectItem(item: FoodItem) { setSelectedItem(item); setQuantityG(100); setSelectedPortion(0); setPortionMult(1); setQMode("grams"); goTo("quantity", 1) }

  function goBack() {
    if (layer === "quantity") { goTo("item", -1); setSelectedItem(null) }
    else if (layer === "item") { goTo("subcategory", -1); setSelectedSubcategory(null) }
    else if (layer === "subcategory") { goTo("category", -1); setSelectedCategory(null) }
    else if (!embedded) router.back()
  }

  const fetchItems = useCallback(async (sub: string | null, q: string) => {
    if (!selectedCategory) return
    setLoadingItems(true)
    const params = new URLSearchParams({ category: selectedCategory, limit: "80" })
    if (sub) params.set("subcategory", sub)
    if (q) params.set("q", q)
    const res = await fetch(`/api/client/food-items?${params}`)
    const json = await res.json()
    setItems(json.data ?? [])
    setLoadingItems(false)
  }, [selectedCategory])

  useEffect(() => {
    if (layer === "item") {
      const timer = setTimeout(() => fetchItems(selectedSubcategory, searchQ), searchQ ? 300 : 0)
      return () => clearTimeout(timer)
    }
  }, [layer, selectedSubcategory, searchQ, fetchItems])

  function applyPortion(idx: number, mult: number = portionMult) {
    setSelectedPortion(idx)
    setQuantityG(getScaledPortionG(PORTION_SIZES[idx], scalingProfile, mult))
  }

  function applyMultiplier(mult: number) {
    setPortionMult(mult)
    if (qMode === "portion") setQuantityG(getScaledPortionG(PORTION_SIZES[selectedPortion], scalingProfile, mult))
  }

  function addToMeal() {
    if (!selectedItem || quantityG <= 0) return
    setDrafts(prev => [...prev, { food_item: selectedItem, quantity_g: quantityG, input_mode: qMode === "portion" ? "portion" : "composer" }])
    setSelectedCategory(null); setSelectedSubcategory(null); setSelectedItem(null)
    setDirection(-1); setLayer("category")
  }

  function removeDraft(idx: number) { setDrafts(prev => prev.filter((_, i) => i !== idx)) }

  async function saveMeal() {
    if (!drafts.length) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        entries: drafts.map(d => ({ food_item_id: d.food_item.id, quantity_g: d.quantity_g, input_mode: d.input_mode })),
      }
      if (existingMealId) body.meal_id = existingMealId
      const res = await fetch("/api/client/nutrition/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        if (onSuccess) {
          onSuccess()
        } else {
          router.push("/client/nutrition/journal")
        }
      } else {
        setSaving(false)
      }
    } catch {
      setSaving(false)
    }
  }

  const totals = sumDraftMacros(drafts)
  const selectedMacros = selectedItem ? calcEntryMacros(selectedItem, quantityG) : null
  const layerTitle =
    layer === "category" ? t('log.title') :
    layer === "subcategory" ? (CATEGORY_LABELS_T[selectedCategory!] ?? "") :
    layer === "item" ? (SUBCATEGORY_LABELS_T[selectedSubcategory ?? ""] ?? "") :
    selectedItem?.name_fr ?? ""

  const topBarH = embedded ? 0 : 56 // px — only shown when not embedded

  return (
    <div className={embedded ? "flex flex-col h-full" : "min-h-screen bg-[#0a0a0a] flex flex-col"}>
      {/* TopBar — hidden in embedded mode (MealLogSheet has its own header) */}
      {!embedded && (
        <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 bg-[#0a0a0a] border-b border-white/[0.08]">
          <button onClick={goBack} className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/50 hover:text-white active:scale-95 transition-all mr-3">
            <ChevronLeft size={16} />
          </button>
          <p className="text-[13px] font-semibold text-white truncate flex-1">{layerTitle}</p>
          {layer !== "category" && (
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
              {layer === "subcategory" ? "1/3" : layer === "item" ? "2/3" : "3/3"}
            </p>
          )}
        </div>
      )}

      {/* Embedded sub-header (layer title + back button) */}
      {embedded && layer !== "category" && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] shrink-0">
          <button onClick={goBack} className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-white/50 active:scale-95 transition-all">
            <ChevronLeft size={14} />
          </button>
          <p className="text-[12px] font-semibold text-white truncate flex-1">{layerTitle}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
            {layer === "subcategory" ? "1/3" : layer === "item" ? "2/3" : "3/3"}
          </p>
        </div>
      )}

      {/* Layers content */}
      <div className="flex-1 overflow-hidden" style={{ paddingTop: embedded ? 0 : topBarH }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={layer + (selectedCategory ?? "") + (selectedSubcategory ?? "")}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={embedded ? "absolute inset-0 overflow-y-auto" : "absolute inset-0 overflow-y-auto"}
            style={{ paddingBottom: footerH + 16, paddingTop: embedded ? 0 : topBarH }}
          >
            {/* Layer 1: Categories */}
            {layer === "category" && (
              <div className="p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold mb-4">{t('log.chooseCategory')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(CATEGORY_LABELS_T) as [CategoryL1, string][]).map(([cat, label]) => (
                    <button key={cat} onClick={() => selectCategory(cat)} className="flex flex-col items-center gap-2 bg-[#161616] border border-white/[0.08] rounded-xl p-4 active:scale-95 transition-all hover:bg-white/[0.06]">
                      <span className="text-2xl">{CATEGORY_ICONS[cat]}</span>
                      <span className="text-[11px] font-semibold text-white/80">{label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold mt-6 mb-3">{t('log.quickSearch')}</p>
                <QuickSearch onSelect={selectItem} />
                <button onClick={() => setShowCustomForm(v => !v)} className="mt-4 w-full flex items-center justify-center gap-2 h-10 bg-white/[0.04] border border-white/[0.07] rounded-xl text-[12px] text-white/50 hover:text-white/80 hover:bg-white/[0.07] active:scale-[0.98] transition-all">
                  <Pencil size={13} />
                  {t('log.createCustom')}
                </button>
                {showCustomForm && <CustomFoodForm onCreated={item => { setShowCustomForm(false); selectItem(item) }} onClose={() => setShowCustomForm(false)} />}
              </div>
            )}

            {/* Layer 2: Subcategories */}
            {layer === "subcategory" && selectedCategory && (
              <div className="p-4 space-y-2">
                {SUBCATEGORIES[selectedCategory].map(sub => (
                  <button key={sub} onClick={() => selectSubcategory(sub)} className="w-full flex items-center justify-between bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-3 active:scale-[0.98] transition-all hover:bg-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{SUBCATEGORY_ICONS[sub] ?? "•"}</span>
                      <span className="text-[13px] font-medium text-white">{SUBCATEGORY_LABELS_T[sub] ?? sub}</span>
                    </div>
                    <ChevronLeft size={14} className="text-white/30 rotate-180" />
                  </button>
                ))}
              </div>
            )}

            {/* Layer 3: Items */}
            {layer === "item" && (
              <div className="p-4">
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input type="text" placeholder={t('log.searchPlaceholder2')} value={searchQ} onChange={e => setSearchQ(e.target.value)} className="w-full h-10 pl-9 pr-3 bg-[#161616] border border-white/[0.08] rounded-xl text-[13px] text-white placeholder:text-white/20 outline-none focus:border-[#ffe01e]/40" />
                </div>
                {loadingItems ? (
                  <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />)}</div>
                ) : items.length === 0 ? (
                  <p className="text-[12px] text-white/30 text-center py-8">{t('log.noResults')}</p>
                ) : (
                  <div className="space-y-1">
                    {items.map(item => {
                      const kcal = item.kcal_per_100g || 1
                      const pPct = Math.round((item.protein_per_100g * 4 / kcal) * 100)
                      const gPct = Math.round((item.carbs_per_100g * 4 / kcal) * 100)
                      const lPct = Math.round((item.fat_per_100g * 9 / kcal) * 100)
                      return (
                        <button key={item.id} onClick={() => selectItem(item)} className="w-full flex items-center justify-between bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-3 active:scale-[0.98] transition-all hover:bg-white/[0.06] text-left">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-white">{item.name_fr}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-white/40">{item.kcal_per_100g} kcal</span>
                              <div className="flex h-[4px] w-[64px] rounded-full overflow-hidden gap-[1px]">
                                <div style={{ width: `${pPct}%`, backgroundColor: '#e85d04' }} />
                                <div style={{ width: `${gPct}%`, backgroundColor: '#2d9a4e' }} />
                                <div style={{ width: `${lPct}%`, backgroundColor: '#d4a017' }} />
                              </div>
                              <span className="text-[10px] text-white/25">P·G·L</span>
                            </div>
                          </div>
                          <span className="text-white/20 text-[11px] shrink-0 ml-2">/ 100g</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Layer 4: Quantity */}
            {layer === "quantity" && selectedItem && (
              <div className="p-4 space-y-5">
                <div className="flex gap-1 bg-white/[0.04] rounded-xl p-0.5">
                  {(["grams", "portion"] as const).map(m => (
                    <button key={m} onClick={() => setQMode(m)} className={`flex-1 h-8 text-[11px] font-semibold rounded-xl transition-all ${qMode === m ? "bg-[#161616] text-white border border-white/[0.08]" : "text-white/40"}`}>
                      {m === "grams" ? t('log.gramsMode') : t('log.portionMode')}
                    </button>
                  ))}
                </div>
                {qMode === "grams" ? (
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">{t('log.quantityLabel')}</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setQuantityG(q => Math.max(5, q - 10))} className="h-10 w-10 flex items-center justify-center bg-white/[0.06] rounded-xl text-white active:scale-95"><Minus size={16} /></button>
                      <input type="number" min="1" max="2000" value={quantityG} onChange={e => setQuantityG(Math.max(1, parseInt(e.target.value) || 1))} className="flex-1 h-10 text-center bg-[#161616] border border-white/[0.08] rounded-xl text-[18px] font-bold text-white outline-none focus:border-[#ffe01e]/40 min-w-0" />
                      <button onClick={() => setQuantityG(q => Math.min(2000, q + 10))} className="h-10 w-10 flex items-center justify-center bg-white/[0.06] rounded-xl text-white active:scale-95"><Plus size={16} /></button>
                    </div>
                    <div className="flex gap-2">
                      {[50, 100, 150, 200].map(g => (
                        <button key={g} onClick={() => setQuantityG(g)} className={`flex-1 h-8 text-[11px] font-semibold rounded-xl transition-all border ${quantityG === g ? "bg-[#ffe01e]/10 border-[#ffe01e]/40 text-[#ffe01e]" : "bg-white/[0.03] border-white/[0.06] text-white/50"}`}>{g}g</button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">{t('log.choosePortion')}</p>
                      {isHandOverrideSet(scalingProfile) && <span className="text-[9px] uppercase tracking-[0.12em] text-[#ffe01e]/70 font-bold">ajusté à ta main</span>}
                    </div>
                    <div className="flex gap-1 overflow-x-auto pb-1">
                      {PORTION_MULTIPLIERS.map(m => (
                        <button key={m} onClick={() => applyMultiplier(m)} className={`shrink-0 h-8 px-3 rounded-xl text-[11px] font-bold transition-all border ${portionMult === m ? "bg-[#ffe01e] text-[#0d0d0d] border-[#ffe01e]" : "bg-white/[0.03] border-white/[0.06] text-white/50"}`}>×{m}</button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {PORTION_SIZES.map((p, i) => {
                        const scaledG = getScaledPortionG(p, scalingProfile, portionMult)
                        const isActive = selectedPortion === i && qMode === "portion"
                        return (
                          <button key={p.key} onClick={() => applyPortion(i)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isActive ? "bg-[#ffe01e]/[0.06] border-[#ffe01e]/30" : "bg-[#161616] border-white/[0.08]"}`}>
                            <span className="text-xl shrink-0">{PORTION_ICON_BY_KEY[p.key] ?? "📏"}</span>
                            <div className="text-left flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-white">{p.label}</p>
                              <p className="text-[11px] text-white/35 truncate">{p.description}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-[12px] font-bold ${isActive ? "text-[#ffe01e]" : "text-white/60"}`}>{scaledG}g</span>
                              {portionMult !== 1 && <p className="text-[9px] text-white/30 mt-0.5">{p.baseG}g × {portionMult}</p>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {selectedMacros && (
                  <div className="bg-[#161616] border border-white/[0.08] rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold mb-2">{t('log.for', { n: quantityG })}</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div><p className="text-[16px] font-black text-white">{Math.round(selectedMacros.calories_kcal)}</p><p className="text-[9px] text-white/30 uppercase tracking-wide">kcal</p></div>
                      <div><p className="text-[16px] font-black" style={{ color: '#e85d04' }}>{selectedMacros.protein_g}</p><p className="text-[9px] text-white/30 uppercase tracking-wide">Prot.</p></div>
                      <div><p className="text-[16px] font-black" style={{ color: '#2d9a4e' }}>{selectedMacros.carbs_g}</p><p className="text-[9px] text-white/30 uppercase tracking-wide">Gluc.</p></div>
                      <div><p className="text-[16px] font-black" style={{ color: '#d4a017' }}>{selectedMacros.fat_g}</p><p className="text-[9px] text-white/30 uppercase tracking-wide">Lip.</p></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky footer */}
      <div ref={footerRef} className={`${embedded ? "relative" : "fixed bottom-0 left-0 right-0"} z-[60] bg-[#0a0a0a] border-t border-white/[0.08]`}>
        {drafts.length > 0 && (
          <div className="px-4 pt-3 pb-1 max-h-[120px] overflow-y-auto">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
                {drafts.length > 1 ? t('log.itemsInMealPlural', { n: drafts.length }) : t('log.itemsInMeal', { n: drafts.length })}
              </p>
              <div className="flex gap-2 text-[11px]">
                <span className="text-white font-bold">{Math.round(totals.calories)} kcal</span>
                <span style={{ color: '#e85d04' }}>P{totals.protein}g</span>
                <span style={{ color: '#2d9a4e' }}>G{totals.carbs}g</span>
                <span style={{ color: '#d4a017' }}>L{totals.fat}g</span>
              </div>
            </div>
            <div className="space-y-1">
              {drafts.map((d, i) => (
                <div key={i} className="flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-1.5">
                  <span className="text-[12px] text-white/80 flex-1 truncate">{d.food_item.name_fr}</span>
                  <span className="text-[11px] text-white/40 mx-2">{d.quantity_g}g</span>
                  <button onClick={() => removeDraft(i)} className="text-white/20 hover:text-white/60 active:scale-90 transition-all"><X size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="px-4 pt-2 space-y-2" style={{ paddingBottom: embedded ? '0.75rem' : 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          {layer === "quantity" && selectedItem && (
            <button onClick={addToMeal} disabled={quantityG <= 0} className="w-full h-11 flex items-center justify-center gap-2 bg-[#ffe01e] disabled:opacity-40 text-black text-[12px] font-bold uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-all">
              <Plus size={16} />
              {t('log.addToMeal')}
            </button>
          )}
          <button onClick={saveMeal} disabled={drafts.length === 0 || saving} className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl text-[12px] font-bold uppercase tracking-[0.1em] active:scale-[0.98] transition-all ${layer === "quantity" && selectedItem ? "bg-white/[0.06] text-white/60 disabled:opacity-30" : "bg-[#ffe01e] text-black disabled:bg-[#ffe01e]/25 disabled:text-black/30"}`}>
            <Check size={16} />
            {saving ? t('log.saving') : existingMealId ? t('log.appendMeal') : t('log.finishMeal')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Recherche rapide ─────────────────────────────────────────
function QuickSearch({ onSelect }: { onSelect: (item: FoodItem) => void }) {
  const { t } = useClientT()
  const [q, setQ] = useState("")
  const [results, setResults] = useState<FoodItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/client/food-items?q=${encodeURIComponent(q)}&limit=8`)
      const json = await res.json()
      setResults(json.data ?? [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  return (
    <div>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input type="text" placeholder={t('log.searchPlaceholder')} value={q} onChange={e => setQ(e.target.value)} className="w-full h-10 pl-9 pr-3 bg-[#161616] border border-white/[0.08] rounded-xl text-[13px] text-white placeholder:text-white/20 outline-none focus:border-[#ffe01e]/40" />
      </div>
      {loading && <div className="h-10 bg-white/[0.04] rounded-xl animate-pulse" />}
      {results.map(item => (
        <button key={item.id} onClick={() => { setQ(""); setResults([]); onSelect(item) }} className="w-full flex items-center justify-between bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-2.5 mb-1 active:scale-[0.98] transition-all hover:bg-white/[0.06] text-left">
          <span className="text-[13px] text-white">{item.name_fr}</span>
          <span className="text-[11px] text-white/35">{item.kcal_per_100g} kcal/100g</span>
        </button>
      ))}
    </div>
  )
}

// ── Formulaire aliment personnalisé ─────────────────────────
function CustomFoodForm({ onCreated, onClose }: { onCreated: (item: FoodItem) => void; onClose: () => void }) {
  const { t } = useClientT()
  const [name, setName] = useState("")
  const [kcal, setKcal] = useState("")
  const [prot, setProt] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    if (!name.trim() || !kcal) { setError(t('log.custom.requiredError')); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/client/food-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_fr: name.trim(), category_l1: "extras", category_l2: "divers", kcal_per_100g: parseFloat(kcal) || 0, protein_per_100g: parseFloat(prot) || 0, carbs_per_100g: parseFloat(carbs) || 0, fat_per_100g: parseFloat(fat) || 0, fiber_per_100g: 0 }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? t('log.custom.error')); return }
      onCreated(json.data)
    } catch {
      setError(t('log.custom.networkError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 bg-[#161616] border border-white/[0.08] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">{t('log.custom.title')}</p>
        <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors"><X size={14} /></button>
      </div>
      <input type="text" placeholder={t('log.custom.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} className="w-full h-10 px-3 bg-white/[0.05] border border-white/[0.08] rounded-xl text-[13px] text-white placeholder:text-white/20 outline-none focus:border-[#ffe01e]/40" />
      <p className="text-[9px] uppercase tracking-[0.16em] text-white/25">{t('log.custom.per100')}</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: t('log.custom.calories'), value: kcal, set: setKcal, required: true },
          { label: t('log.custom.protein'), value: prot, set: setProt, required: false },
          { label: t('log.custom.carbs'), value: carbs, set: setCarbs, required: false },
          { label: t('log.custom.fat'), value: fat, set: setFat, required: false },
        ].map(({ label, value, set, required }) => (
          <div key={label} className="space-y-1">
            <p className="text-[10px] text-white/30">{label}{required && " *"}</p>
            <input type="number" min="0" step="0.1" value={value} onChange={e => set(e.target.value)} className="w-full h-9 px-3 min-w-0 bg-white/[0.05] border border-white/[0.08] rounded-xl text-[13px] text-white outline-none focus:border-[#ffe01e]/40" />
          </div>
        ))}
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <button onClick={submit} disabled={saving || !name.trim() || !kcal} className="w-full h-10 flex items-center justify-center gap-2 bg-[#ffe01e] disabled:opacity-40 text-[#0d0d0d] text-[12px] font-bold uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-all">
        <Check size={14} />
        {saving ? t('log.custom.creating') : t('log.custom.createCta')}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Slim down page.tsx to a thin wrapper**

Replace the entire content of `app/client/nutrition/log/page.tsx` with:

```tsx
// app/client/nutrition/log/page.tsx
"use client"

import { Suspense } from "react"
import { useRouter } from "next/navigation"
import { NutritionLogContent } from "./NutritionLogContent"

function NutritionLogPageInner() {
  const router = useRouter()
  return (
    <NutritionLogContent
      onSuccess={() => router.push("/client/nutrition/journal")}
    />
  )
}

export default function NutritionLogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <NutritionLogPageInner />
    </Suspense>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -E "NutritionLog|nutrition/log" | head -20
```

Expected: no errors on these files. Pre-existing errors elsewhere are out of scope.

- [ ] **Step 4: Commit**

```bash
git add app/client/nutrition/log/NutritionLogContent.tsx app/client/nutrition/log/page.tsx
git commit -m "refactor(nutrition): extract NutritionLogContent for reuse in MealLogSheet"
```

---

## Task 2 — Create MealLogSheet

**Files:**
- Create: `components/client/smart/MealLogSheet.tsx`

- [ ] **Step 1: Create MealLogSheet.tsx**

```tsx
// components/client/smart/MealLogSheet.tsx
"use client"

import { Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { NutritionLogContent } from "@/app/client/nutrition/log/NutritionLogContent"

interface MealLogSheetProps {
  open: boolean
  onClose: () => void
}

export default function MealLogSheet({ open, onClose }: MealLogSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[60] flex flex-col bg-[#161616] rounded-t-2xl border-t border-white/[0.08]"
            style={{ maxHeight: "88vh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }}
            exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
              {/* Drag handle */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />
              <p className="text-[13px] font-bold text-white">Ajouter un repas</p>
              <button
                onClick={onClose}
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
              <Suspense fallback={<div className="h-full bg-[#161616]" />}>
                <NutritionLogContent embedded onSuccess={onClose} />
              </Suspense>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -E "MealLogSheet|NutritionLogContent" | head -20
```

Expected: no errors on these files.

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/MealLogSheet.tsx
git commit -m "feat(fab): add MealLogSheet bottom sheet embedding NutritionLogContent"
```

---

## Task 3 — Refactor RadialActionMenu

**Files:**
- Modify: `components/client/smart/RadialActionMenu.tsx`

- [ ] **Step 1: Rewrite RadialActionMenu.tsx**

Replace the entire file with:

```tsx
// components/client/smart/RadialActionMenu.tsx
'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ForkKnife, Drop, PersonSimpleRun, Moon } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useClientT } from '../ClientI18nProvider'
import MealLogSheet from './MealLogSheet'

type ActionId = 'meal' | 'water' | 'activity' | 'checkin'

type Action = {
  id: ActionId
  Icon: React.ElementType
  angleDeg: number
}

// Arc 120° centré en haut, espacement uniforme 40° entre 4 boutons
// De -150° à -30° (axe X positif, sens trigonométrique)
const ACTIONS: Action[] = [
  { id: 'meal',     Icon: ForkKnife,       angleDeg: -150 },
  { id: 'water',    Icon: Drop,            angleDeg: -110 },
  { id: 'activity', Icon: PersonSimpleRun, angleDeg:  -70 },
  { id: 'checkin',  Icon: Moon,            angleDeg:  -30 },
]

const RADIUS = 96

const LABEL_KEYS: Record<ActionId, string> = {
  meal:     'smart.radial.meal',
  water:    'smart.radial.water',
  activity: 'smart.radial.activity',
  checkin:  'smart.radial.checkin',
}

export type RadialActionMenuProps = {
  open: boolean
  onClose: () => void
  onOpenWater: () => void
  onOpenActivity: () => void
}

export default function RadialActionMenu({ open, onClose, onOpenWater, onOpenActivity }: RadialActionMenuProps) {
  const router = useRouter()
  const { t } = useClientT()
  const [mealSheetOpen, setMealSheetOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleAction = (id: ActionId) => {
    onClose()
    switch (id) {
      case 'meal':
        setMealSheetOpen(true)
        break
      case 'water':
        onOpenWater()
        break
      case 'activity':
        onOpenActivity()
        break
      case 'checkin':
        router.push('/client/checkin/onboarding')
        break
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Button anchor: centred horizontally, just above the BottomNav */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{ bottom: 'calc(max(20px, env(safe-area-inset-bottom)) + 62px + 16px)' }}
            >
              {ACTIONS.map((a, i) => {
                const rad = (a.angleDeg * Math.PI) / 180
                const x = Math.cos(rad) * RADIUS
                const y = Math.sin(rad) * RADIUS

                return (
                  <motion.button
                    key={a.id}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                    animate={{
                      opacity: 1, x, y, scale: 1,
                      transition: {
                        delay: i * 0.035,
                        type: 'spring',
                        stiffness: 420,
                        damping: 26,
                        mass: 0.8,
                      },
                    }}
                    exit={{
                      opacity: 0, x: 0, y: 0, scale: 0.5,
                      transition: { duration: 0.15, ease: 'easeIn' },
                    }}
                    onClick={(e) => { e.stopPropagation(); handleAction(a.id) }}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    aria-label={String(t(LABEL_KEYS[a.id] as any))}
                  >
                    <div className="w-14 h-14 rounded-full bg-[#161616] border border-white/[0.08] flex items-center justify-center active:scale-95 transition-transform">
                      <a.Icon size={24} weight="regular" className="text-white" />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MealLogSheet open={mealSheetOpen} onClose={() => setMealSheetOpen(false)} />
    </>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -E "RadialActionMenu|MealLogSheet" | head -20
```

Expected: no errors on these files.

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/RadialActionMenu.tsx
git commit -m "feat(fab): refactor RadialActionMenu — 120° arc, rounded circles, spring premium, MealLogSheet"
```

---

## Task 4 — Final TypeScript Check & CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -40
```

Expected: zero new errors introduced by this work. Pre-existing errors (Stripe, BodyFatCalculator) are out of scope — confirm they were already present before this change.

- [ ] **Step 2: Update CHANGELOG.md**

Add at the top of `CHANGELOG.md` under today's date:

```
## 2026-05-18

FEATURE: FAB RadialActionMenu — 120° uniform arc, rounded circles, premium spring motion
FEATURE: MealLogSheet — bottom sheet embeds NutritionLogContent inline (no page navigation)
REFACTOR: Extract NutritionLogContent from nutrition/log/page.tsx for sheet reuse
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "chore: update CHANGELOG for FAB radial menu premium redesign"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Arc 120° (-150° to -30°, 40° spacing) | Task 3 Step 1 — ACTIONS array |
| Radius 96px | Task 3 Step 1 — RADIUS constant |
| Rounded circles `w-14 h-14 rounded-full` | Task 3 Step 1 — button className |
| Spring `stiffness 420 / damping 26 / mass 0.8` | Task 3 Step 1 — animate transition |
| Exit `duration 0.15` | Task 3 Step 1 — exit transition |
| Backdrop `bg-black/50 backdrop-blur-[2px]` | Task 3 Step 1 — motion.div className |
| MealLogSheet bottom sheet | Task 2 |
| MealLogSheet `max-h-[88vh]` | Task 2 Step 1 — style prop |
| MealLogSheet spring `stiffness 300 damping 30` | Task 2 Step 1 — animate transition |
| MealLogSheet exit `duration 0.2` | Task 2 Step 1 — exit transition |
| MealLogSheet z-index: backdrop 55, panel 60 | Task 2 Step 1 — className |
| NutritionLogContent `onSuccess` callback | Task 1 Step 1 — props interface |
| NutritionLogContent `embedded` prop suppresses TopBar | Task 1 Step 1 — conditional render |
| Page route still functional | Task 1 Step 2 — thin wrapper |
| BottomNav unchanged | not in plan (correct — no changes needed) |
| CHANGELOG updated | Task 4 Step 2 |
| TypeScript 0 errors | Task 1 Step 3, Task 2 Step 2, Task 3 Step 2, Task 4 Step 1 |

All spec requirements covered. No placeholders. Types consistent across tasks (`NutritionLogContentProps`, `MealLogSheetProps`, `RadialActionMenuProps` all match their usage).
