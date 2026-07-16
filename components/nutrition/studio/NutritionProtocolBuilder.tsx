"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { Check, ChevronDown, ChevronRight, Copy, GripVertical, Lock, Plus, Search, SlidersHorizontal, Sparkles, Trash2, Unlock } from "lucide-react"
import { FoodIcon } from "@/components/nutrition/FoodIcon"
import CoachSmoothingStudioPanel from "@/components/nutrition/studio/CoachSmoothingStudioPanel"
import { CATEGORY_LABELS, SUBCATEGORY_LABELS, type CategoryL1 } from "@/lib/nutrition/food-items"
import type { DayDraft } from "@/lib/nutrition/types"
import {
  computeEquivalentQuantity,
  computePlanMealsTotals,
  getBuilderDraftStorageKey,
  normalizePlanMeals,
  roundPlanTotals,
  type NutritionPlanFood,
  type NutritionPlanItem,
  type NutritionPlanMeal,
  type NutritionProtocolBuilderDraft,
} from "@/lib/nutrition/protocol-builder"
import { adjustPlanMealsForCycle } from "@/lib/nutrition/cycle-meal-plan-adjustment"
import type { CycleSyncAdjustment } from "@/lib/nutrition/engine/cycleSync"

type BuilderLayoutCase = "case_1" | "case_2" | "case_3" | "case_4"

type Props = {
  clientId: string
  protocolId?: string | null
  protocolStatus?: "draft" | "shared"
  sourceDate?: string | null
  protocolName: string
  layoutCase: BuilderLayoutCase
  days: DayDraft[]
  activeDayIndex: number
  onStartMealPlanDuplication?: (sourceDayIndex: number) => void
  onActiveDayChange: (index: number) => void
  onUpdateDay: (index: number, patch: Partial<DayDraft>) => void
  cycleAdjustment?: Pick<CycleSyncAdjustment, "proteinDelta" | "carbsDelta" | "fatDelta"> | null
}

type FoodCategoryFilter = CategoryL1 | "all" | "supplements"
type FoodSort =
  | "name"
  | "name_desc"
  | "protein"
  | "protein_asc"
  | "carbs"
  | "carbs_asc"
  | "fat"
  | "fat_asc"
  | "calories"
  | "calories_asc"
  | "recent"
  | "frequent"
type BuilderMenu = "category" | "subcategory" | "sort" | null
type CustomFoodDraft = {
  name_fr: string
  category_l1: CategoryL1
  category_l2: string | null
  kcal_per_100g: string
  protein_per_100g: string
  carbs_per_100g: string
  fat_per_100g: string
  fiber_per_100g: string
}

const CATEGORY_FILTERS: Array<{ id: FoodCategoryFilter; label: string }> = [
  { id: "all", label: "Tous les aliments" },
  { id: "proteins", label: "Protéines" },
  { id: "carbs", label: "Glucides" },
  { id: "fats", label: "Lipides" },
  { id: "vegetables", label: "Légumes" },
  { id: "supplements", label: "Compléments" },
]

const CUSTOM_MEAL_TITLES = ["Repas 5", "Repas 6", "Repas 7", "Repas 8"]

const SUBCATEGORY_FILTERS: Record<string, string[]> = {
  proteins: ["viandes", "poissons", "oeufs", "laitiers", "vegetales", "complements"],
  carbs: ["cereales", "fecules", "pain", "legumineuses"],
  fats: ["huiles", "noix-graines", "autres-lipides"],
  vegetables: ["feuilles", "cruciferes", "autres-legumes"],
  drinks: ["eau", "chauds", "jus-smoothies", "laits-vegetaux", "sports-drinks"],
  supplements: ["complements"],
}

const SORT_SECTIONS: Array<{
  label: string
  options: Array<{ id: FoodSort; label: string }>
}> = [
  {
    label: "Alphabétique",
    options: [
      { id: "name", label: "A → Z" },
      { id: "name_desc", label: "Z → A" },
    ],
  },
  {
    label: "Nutritionnel",
    options: [
      { id: "protein", label: "Protéines +" },
      { id: "protein_asc", label: "Protéines -" },
      { id: "carbs", label: "Glucides +" },
      { id: "carbs_asc", label: "Glucides -" },
      { id: "fat", label: "Lipides +" },
      { id: "fat_asc", label: "Lipides -" },
      { id: "calories", label: "Kcal +" },
      { id: "calories_asc", label: "Kcal -" },
    ],
  },
  {
    label: "Usage",
    options: [
      { id: "recent", label: "Récents" },
      { id: "frequent", label: "Fréquents" },
    ],
  },
]

const CUSTOM_FOOD_MACRO_FIELDS: Array<{ key: keyof Pick<CustomFoodDraft, "kcal_per_100g" | "protein_per_100g" | "carbs_per_100g" | "fat_per_100g" | "fiber_per_100g">; label: string }> = [
  { key: "kcal_per_100g", label: "Kcal" },
  { key: "protein_per_100g", label: "Prot." },
  { key: "carbs_per_100g", label: "Gluc." },
  { key: "fat_per_100g", label: "Lip." },
  { key: "fiber_per_100g", label: "Fib." },
]

const EMPTY_CUSTOM_FOOD: CustomFoodDraft = {
  name_fr: "",
  category_l1: "proteins",
  category_l2: "complements",
  kcal_per_100g: "",
  protein_per_100g: "",
  carbs_per_100g: "",
  fat_per_100g: "",
  fiber_per_100g: "0",
}

const BUILDER_FOOD_COLUMN_MIN_PX = 280
const BUILDER_MEALS_COLUMN_MIN_PX = 560
const BUILDER_LAYOUT_STORAGE_PREFIX = "nutrition-builder-layout"

function makeLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`
}

function targetForDay(day: DayDraft | undefined) {
  return {
    calories: Number(day?.calories) || 0,
    protein: Number(day?.protein_g) || 0,
    carbs: Number(day?.carbs_g) || 0,
    fat: Number(day?.fat_g) || 0,
  }
}

function ratioLabel(value: number, target: number) {
  if (!target) return "0%"
  return `${Math.round((value / target) * 100)}%`
}

function mealTotals(meal: NutritionPlanMeal) {
  return roundPlanTotals(computePlanMealsTotals([meal]))
}

function MacroProgress({
  label,
  value,
  target,
  tone,
  labelTone,
}: {
  label: string
  value: number
  target: number
  tone: string
  labelTone: string
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${labelTone}`}>{label}</span>
        <span className="text-[11px] font-semibold text-white/75">{Math.round(value)} / {Math.round(target)} · {ratioLabel(value, target)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/[0.075] overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function HeaderMacroGauge({
  label,
  value,
  target,
  toneClass,
  accentColor,
}: {
  label: string
  value: number
  target: number
  toneClass: string
  accentColor: string
}) {
  const patternId = `macro-overflow-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  const safeTarget = Math.max(0, target)
  const mainProgress = safeTarget > 0 ? Math.max(0, Math.min(100, (value / safeTarget) * 100)) : 0
  const overflowProgress = safeTarget > 0 && value > safeTarget
    ? Math.min(100, ((value - safeTarget) / safeTarget) * 100)
    : 0
  const remainingValue = safeTarget > value ? Math.round(safeTarget - value) : Math.round(value - safeTarget)
  const hasOverflow = safeTarget > 0 && value > safeTarget
  const pathDefinition = "M42 8 H52 C65.255 8 76 18.745 76 32 V52 C76 65.255 65.255 76 52 76 H32 C18.745 76 8 65.255 8 52 V32 C8 18.745 18.745 8 32 8 H42"
  const targetSuffix = label === "Calories" ? "Kcal" : "G"
  const overflowBaseColor = `color-mix(in srgb, ${accentColor} 62%, black)`

  return (
    <div className="flex min-w-0 flex-col items-center">
      <p className={`mb-1 text-center text-[10px] font-black uppercase tracking-[0.18em] ${toneClass}`}>{label}</p>
      <div className="relative flex h-[78px] w-[78px] items-center justify-center">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 84 84" aria-hidden="true">
          <defs>
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="5" height="5">
              <rect width="5" height="5" fill={overflowBaseColor} />
              <path d="M-1 4 L4 -1 M1 6 L6 1" stroke={accentColor} strokeWidth="0.9" strokeOpacity="0.82" />
            </pattern>
          </defs>
          <path
            d={pathDefinition}
            fill="none"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
          />
          {mainProgress > 0 ? (
            <path
              d={pathDefinition}
              fill="none"
              stroke={accentColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={100}
              strokeDasharray={`${mainProgress} 100`}
            />
          ) : null}
          {overflowProgress > 0 ? (
            <>
              <path
                d={pathDefinition}
                fill="none"
                stroke={overflowBaseColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={100}
                strokeDasharray={`${overflowProgress} 100`}
              />
              <path
                d={pathDefinition}
                fill="none"
                stroke={`url(#${patternId})`}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={100}
                strokeDasharray={`${overflowProgress} 100`}
              />
            </>
          ) : null}
        </svg>
        <div className="relative flex flex-col items-center justify-center">
          <p className={`text-[14px] font-black leading-none ${toneClass}`}>{Math.round(value)}</p>
          <p className="mt-0.5 text-[14px] font-medium leading-none text-white/92">
            {hasOverflow ? `+${remainingValue}` : remainingValue}
          </p>
        </div>
      </div>
      <p className={`mt-1 text-center text-[12px] font-medium uppercase tracking-[0.04em] ${toneClass}`}>
        {Math.round(safeTarget)} {targetSuffix}
      </p>
    </div>
  )
}

function BuilderMenuButton({
  value,
  placeholder,
  active,
  disabled = false,
  onClick,
}: {
  value: string
  placeholder: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 min-w-0 w-full items-center justify-between gap-2 overflow-hidden rounded-xl border px-3 text-left transition-colors ${
        active
          ? "border-[#1f8a65]/35 bg-[#151d19]"
          : "border-white/[0.06] bg-[#181818]"
      } ${disabled ? "cursor-not-allowed border-white/[0.05] bg-[#161616] text-white/38" : "hover:border-white/[0.09] hover:bg-[#1b1b1b]"}`}
    >
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-white/78">{value || placeholder}</p>
      </div>
      <ChevronDown size={14} className="shrink-0 text-white/35" />
    </button>
  )
}

function isFoodPayload(value: string | null): value is string {
  return Boolean(value && value.startsWith("{"))
}

export default function NutritionProtocolBuilder({
  clientId,
  protocolId,
  protocolStatus,
  sourceDate,
  layoutCase,
  days,
  activeDayIndex,
  onStartMealPlanDuplication,
  onUpdateDay,
  cycleAdjustment = null,
}: Props) {
  const storageKey = useMemo(() => getBuilderDraftStorageKey(clientId, protocolId), [clientId, protocolId])
  const layoutStorageKey = useMemo(
    () => `${BUILDER_LAYOUT_STORAGE_PREFIX}:${clientId}:${protocolId ?? "draft"}`,
    [clientId, protocolId],
  )
  const [draft, setDraft] = useState<NutritionProtocolBuilderDraft>({})
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<FoodCategoryFilter>("all")
  const [subcategory, setSubcategory] = useState<string | null>(null)
  const [sort, setSort] = useState<FoodSort>("name")
  const [openMenu, setOpenMenu] = useState<BuilderMenu>(null)
  const [foods, setFoods] = useState<NutritionPlanFood[]>([])
  const [loadingFoods, setLoadingFoods] = useState(false)
  const [draggedFood, setDraggedFood] = useState<NutritionPlanFood | null>(null)
  const [showCustomFoodForm, setShowCustomFoodForm] = useState(false)
  const [customFood, setCustomFood] = useState<CustomFoodDraft>(EMPTY_CUSTOM_FOOD)
  const [creatingFood, setCreatingFood] = useState(false)
  const [foodColumnWidth, setFoodColumnWidth] = useState(46)
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({})
  const [showPortionProtections, setShowPortionProtections] = useState(false)
  const builderGridRef = useRef<HTMLDivElement>(null)
  const filterBarRef = useRef<HTMLDivElement>(null)
  const resizingBuilderGridRef = useRef(false)
  const startResizeXRef = useRef(0)
  const startFoodColumnWidthRef = useRef(46)
  const isFoodColumnResizable = layoutCase === "case_3" || layoutCase === "case_4"

  const activeDay = days[activeDayIndex]
  const activeDayKey = activeDay?.localId ?? `day-${activeDayIndex}`
  const activeMeals = normalizePlanMeals(draft[activeDayKey])
  const totals = roundPlanTotals(computePlanMealsTotals(activeMeals))
  const target = targetForDay(activeDay)
  const showCoachSmoothingPanel = Boolean(protocolId)
  const cyclePreview = useMemo(
    () => cycleAdjustment ? adjustPlanMealsForCycle({ meals: activeMeals, adjustment: cycleAdjustment }) : null,
    [activeMeals, cycleAdjustment],
  )

  const recommendedCategory = useMemo<CategoryL1>(() => {
    const missingProtein = target.protein - totals.protein
    const missingCarbs = target.carbs - totals.carbs
    const missingFat = target.fat - totals.fat
    if (missingProtein >= Math.max(missingCarbs, missingFat, 10)) return "proteins"
    if (missingCarbs >= Math.max(missingProtein, missingFat, 15)) return "carbs"
    if (missingFat >= Math.max(missingProtein, missingCarbs, 8)) return "fats"
    return "vegetables"
  }, [target, totals])

  const activeSubcategories = useMemo(() => SUBCATEGORY_FILTERS[category] ?? [], [category])
  const selectedCategoryLabel = category === "all"
    ? "Catégories d’aliments"
    : CATEGORY_FILTERS.find((filter) => filter.id === category)?.label ?? "Catégories d’aliments"
  const selectedSubcategoryLabel = category === "all"
    ? "Sous-catégories"
    : subcategory
      ? (SUBCATEGORY_LABELS[subcategory] ?? subcategory)
      : "Sous-catégories"
  const selectedSortLabel = useMemo(() => {
    if (sort === "name") return "Tri"
    return SORT_SECTIONS.flatMap((section) => section.options).find((option) => option.id === sort)?.label ?? "Tri"
  }, [sort])

  const onMouseDownBuilderGrid = useCallback((event: React.MouseEvent) => {
    if (!isFoodColumnResizable) return
    resizingBuilderGridRef.current = true
    startResizeXRef.current = event.clientX
    startFoodColumnWidthRef.current = foodColumnWidth
    event.preventDefault()
  }, [foodColumnWidth, isFoodColumnResizable])

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (!resizingBuilderGridRef.current || !builderGridRef.current) return
      const totalWidth = builderGridRef.current.offsetWidth
      if (!totalWidth) return
      const deltaPct = ((event.clientX - startResizeXRef.current) / totalWidth) * 100
      const minFoodWidthPct = (BUILDER_FOOD_COLUMN_MIN_PX / totalWidth) * 100
      const maxFoodWidthPct = Math.min(62, 100 - (BUILDER_MEALS_COLUMN_MIN_PX / totalWidth) * 100)
      const layoutMinPct = layoutCase === "case_4" ? 25 : 25
      const layoutMaxPct = layoutCase === "case_4" ? 75 : 55
      const safeMaxFoodWidthPct = Math.max(minFoodWidthPct, Math.min(maxFoodWidthPct, layoutMaxPct))
      const safeMinFoodWidthPct = Math.max(minFoodWidthPct, layoutMinPct)
      setFoodColumnWidth(
        Math.min(
          Math.max(startFoodColumnWidthRef.current + deltaPct, safeMinFoodWidthPct),
          safeMaxFoodWidthPct,
        ),
      )
    }

    function onMouseUp() {
      resizingBuilderGridRef.current = false
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [layoutCase])

  useEffect(() => {
    if (category === "all") {
      if (subcategory !== null) setSubcategory(null)
      return
    }
    if (activeSubcategories.length === 0) return
    if (!subcategory || !activeSubcategories.includes(subcategory)) {
      setSubcategory(activeSubcategories[0] ?? null)
    }
  }, [activeSubcategories, category, subcategory])

  useEffect(() => {
    const nextDraft: NutritionProtocolBuilderDraft = {}
    days.forEach((day, index) => {
      const dayKey = day.localId ?? `day-${index}`
      if (Array.isArray(day.meal_plan) && day.meal_plan.length > 0) {
        nextDraft[dayKey] = normalizePlanMeals(day.meal_plan)
      }
    })

    if (Object.keys(nextDraft).length > 0) {
      setDraft(nextDraft)
      return
    }

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const localDraft = JSON.parse(raw) as NutritionProtocolBuilderDraft
      setDraft(localDraft)
      days.forEach((day, index) => {
        const dayKey = day.localId ?? `day-${index}`
        const meals = localDraft[dayKey]
        if (Array.isArray(meals) && meals.length > 0) {
          onUpdateDay(index, { meal_plan: normalizePlanMeals(meals) })
        }
      })
    } catch {}
  }, [days, onUpdateDay, storageKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft))
    } catch {}
  }, [draft, storageKey])

  useEffect(() => {
    const defaultWidth = layoutCase === "case_4" ? 50 : 40
    if (layoutCase === "case_1" || layoutCase === "case_2") {
      setFoodColumnWidth(defaultWidth)
      return
    }

    try {
      const raw = window.localStorage.getItem(layoutStorageKey)
      if (!raw) {
        setFoodColumnWidth(defaultWidth)
        return
      }
      const parsed = JSON.parse(raw) as Record<string, { foodColumnWidth?: number }>
      const savedWidth = parsed[layoutCase]?.foodColumnWidth
      if (typeof savedWidth === "number") {
        setFoodColumnWidth(savedWidth)
        return
      }
    } catch {}

    setFoodColumnWidth(defaultWidth)
  }, [layoutCase, layoutStorageKey])

  useEffect(() => {
    if (!isFoodColumnResizable) return
    try {
      const raw = window.localStorage.getItem(layoutStorageKey)
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      window.localStorage.setItem(
        layoutStorageKey,
        JSON.stringify({
          ...parsed,
          [layoutCase]: {
            foodColumnWidth,
          },
        }),
      )
    } catch {}
  }, [foodColumnWidth, isFoodColumnResizable, layoutCase, layoutStorageKey])

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node
      const insideFilterBar = !!filterBarRef.current?.contains(target)
      if (!insideFilterBar) {
        setOpenMenu(null)
      }
    }

    window.addEventListener("mousedown", onMouseDown)
    return () => window.removeEventListener("mousedown", onMouseDown)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoadingFoods(true)
      const params = new URLSearchParams()
      params.set("limit", "120")
      if (query.trim()) params.set("q", query.trim())
      if (category === "supplements") {
        params.set("category", "proteins")
        params.set("subcategory", "complements")
      } else if (category !== "all") {
        params.set("category", category)
      }
      if (subcategory) params.set("subcategory", subcategory)
      params.set("sort", sort)
      if (sort === "frequent") params.set("frequent", "true")

      try {
        const res = await fetch(`/api/clients/${clientId}/food-items?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        })
        if (!res.ok) return
        const data = await res.json()
        setFoods(Array.isArray(data.data) ? data.data : [])
      } catch {
        if (!controller.signal.aborted) setFoods([])
      } finally {
        if (!controller.signal.aborted) setLoadingFoods(false)
      }
    }, 220)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [category, clientId, query, sort, subcategory])

  const persistPlanForDay = useCallback((dayKey: string, meals: NutritionPlanMeal[]) => {
    const dayIndex = days.findIndex((day, index) => (day.localId ?? `day-${index}`) === dayKey)
    if (dayIndex >= 0) {
      onUpdateDay(dayIndex, { meal_plan: normalizePlanMeals(meals) })
    }
  }, [days, onUpdateDay])

  const updateMealsForDay = useCallback((dayKey: string, updater: (meals: NutritionPlanMeal[]) => NutritionPlanMeal[]) => {
    setDraft((prev) => {
      const nextMeals = updater(normalizePlanMeals(prev[dayKey]))
      persistPlanForDay(dayKey, nextMeals)
      return {
        ...prev,
        [dayKey]: nextMeals,
      }
    })
  }, [persistPlanForDay])

  const addMeal = useCallback(() => {
    updateMealsForDay(activeDayKey, (meals) => {
      const title = CUSTOM_MEAL_TITLES.find((candidate) => !meals.some((meal) => meal.title === candidate)) ?? `Repas ${meals.length + 1}`
      return [
        ...meals,
        {
          id: `custom-${makeLocalId("meal")}` as NutritionPlanMeal["id"],
          title,
          items: [],
        },
      ]
    })
  }, [activeDayKey, updateMealsForDay])

  const renameMeal = useCallback((mealId: NutritionPlanMeal["id"], title: string) => {
    updateMealsForDay(activeDayKey, (meals) =>
      meals.map((meal) => (meal.id === mealId ? { ...meal, title } : meal)),
    )
  }, [activeDayKey, updateMealsForDay])

  const removeMeal = useCallback((mealId: NutritionPlanMeal["id"]) => {
    updateMealsForDay(activeDayKey, (meals) => meals.filter((meal) => meal.id !== mealId))
  }, [activeDayKey, updateMealsForDay])

  const addFoodToMeal = useCallback((mealId: NutritionPlanMeal["id"], food: NutritionPlanFood) => {
    setDraft((prev) => {
      const next = { ...prev }
      const dayIndex = activeDayIndex
      const dayKey = days[dayIndex]?.localId ?? `day-${dayIndex}`
      const nextMeals = normalizePlanMeals(next[dayKey]).map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              items: [
                ...meal.items,
                {
                  id: makeLocalId("item"),
                  food,
                  quantity_g: food.category_l1 === "fats" ? 15 : food.category_l1 === "drinks" ? 250 : 100,
                  alternatives: [],
                },
              ],
            }
          : meal,
      )
      next[dayKey] = nextMeals
      onUpdateDay(dayIndex, { meal_plan: nextMeals })
      return next
    })
  }, [activeDayIndex, days, onUpdateDay])

  const addAlternative = useCallback((item: NutritionPlanItem, food: NutritionPlanFood) => {
    updateMealsForDay(activeDayKey, (meals) =>
      meals.map((meal) => ({
        ...meal,
        items: meal.items.map((mealItem) =>
          mealItem.id === item.id
            ? {
                ...mealItem,
                alternatives: [
                  ...mealItem.alternatives,
                  {
                    id: makeLocalId("alt"),
                    food,
                    quantity_g: computeEquivalentQuantity(mealItem, food),
                  },
                ],
              }
            : mealItem,
        ),
      })),
    )
  }, [activeDayKey, updateMealsForDay])

  const removeAlternative = useCallback((itemId: string, alternativeId: string) => {
    updateMealsForDay(activeDayKey, (meals) =>
      meals.map((meal) => ({
        ...meal,
        items: meal.items.map((mealItem) =>
          mealItem.id === itemId
            ? {
                ...mealItem,
                alternatives: mealItem.alternatives.filter((alternative) => alternative.id !== alternativeId),
              }
            : mealItem,
        ),
      })),
    )
  }, [activeDayKey, updateMealsForDay])

  const onFoodDragStart = (event: DragEvent<HTMLButtonElement>, food: NutritionPlanFood) => {
    setDraggedFood(food)
    event.dataTransfer.effectAllowed = "copy"
    event.dataTransfer.setData("application/json", JSON.stringify(food))
  }

  const readDraggedFood = (event: DragEvent) => {
    if (draggedFood) return draggedFood
    const payload = event.dataTransfer.getData("application/json")
    if (!isFoodPayload(payload)) return null
    try {
      return JSON.parse(payload) as NutritionPlanFood
    } catch {
      return null
    }
  }

  const createCustomFood = useCallback(async () => {
    if (!customFood.name_fr.trim() || creatingFood) return
    setCreatingFood(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/food-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_fr: customFood.name_fr.trim(),
          category_l1: customFood.category_l1,
          category_l2: customFood.category_l2,
          kcal_per_100g: Number(customFood.kcal_per_100g) || 0,
          protein_per_100g: Number(customFood.protein_per_100g) || 0,
          carbs_per_100g: Number(customFood.carbs_per_100g) || 0,
          fat_per_100g: Number(customFood.fat_per_100g) || 0,
          fiber_per_100g: Number(customFood.fiber_per_100g) || 0,
        }),
      })
      if (!res.ok) return
      const payload = await res.json()
      if (payload.data) setFoods((prev) => [payload.data, ...prev])
      setCategory(customFood.category_l1)
      setSubcategory(customFood.category_l2)
      setCustomFood(EMPTY_CUSTOM_FOOD)
      setShowCustomFoodForm(false)
    } finally {
      setCreatingFood(false)
    }
  }, [clientId, creatingFood, customFood])

  const updateItemQuantity = useCallback((itemId: string, nextValue: string) => {
    setQuantityInputs((prev) => ({ ...prev, [itemId]: nextValue }))

    if (nextValue.trim() === "") return
    const parsed = Number(nextValue)
    if (!Number.isFinite(parsed) || parsed <= 0) return

    updateMealsForDay(activeDayKey, (meals) =>
      meals.map((mealDraft) => ({
        ...mealDraft,
        items: mealDraft.items.map((mealItem) =>
          mealItem.id === itemId ? { ...mealItem, quantity_g: parsed } : mealItem,
        ),
      })),
    )
  }, [activeDayKey, updateMealsForDay])

  const commitItemQuantity = useCallback((itemId: string, fallbackValue: number) => {
    setQuantityInputs((prev) => {
      const current = prev[itemId]
      if (current == null) return prev
      if (current.trim() === "") {
        return { ...prev, [itemId]: String(fallbackValue) }
      }
      const parsed = Number(current)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ...prev, [itemId]: String(fallbackValue) }
      }
      return { ...prev, [itemId]: String(parsed) }
    })
  }, [])

  const updateItemCycleAdjustment = useCallback((
    itemId: string,
    patch: Partial<NonNullable<NutritionPlanItem["cycle_adjustment"]>>,
  ) => {
    updateMealsForDay(activeDayKey, (meals) =>
      meals.map((mealDraft) => ({
        ...mealDraft,
        items: mealDraft.items.map((mealItem) => (
          mealItem.id === itemId
            ? {
                ...mealItem,
                cycle_adjustment: {
                  ...mealItem.cycle_adjustment,
                  ...patch,
                },
              }
            : mealItem
        )),
      })),
    )
  }, [activeDayKey, updateMealsForDay])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div ref={builderGridRef} className="flex min-h-0 flex-1 overflow-hidden">
        <section
          className="flex min-h-0 flex-col"
          style={{ flex: `0 0 ${foodColumnWidth}%`, minWidth: 280 }}
        >
          <div className="shrink-0 border-b-[0.3px] border-white/[0.06] bg-[#121212] px-4 pb-3 pt-4">
            <div className="mb-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">Aliments</p>
              <button
                type="button"
                onClick={() => setShowCustomFoodForm((prev) => !prev)}
                className="flex h-7 items-center gap-1.5 rounded-lg bg-white px-2 text-[9px] font-bold uppercase tracking-[0.08em] text-black transition-opacity hover:opacity-90"
              >
                <Plus size={11} />
                Ajouter
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.035] px-3 py-2">
              <Search size={13} className="text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un aliment"
                className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/25"
              />
            </div>
            </div>
          {showCustomFoodForm && (
            <div className="mb-2 rounded-xl border-[0.3px] border-[#1f8a65]/25 bg-[#1f8a65]/[0.06] p-2">
              <input
                value={customFood.name_fr}
                onChange={(event) => setCustomFood((prev) => ({ ...prev, name_fr: event.target.value }))}
                placeholder="Nom de l’aliment"
                className="h-8 w-full rounded-lg border-[0.3px] border-white/[0.08] bg-black/20 px-2 text-[10px] text-white outline-none placeholder:text-white/30"
              />
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <select
                  value={customFood.category_l1}
                  onChange={(event) => {
                    const nextCategory = event.target.value as CategoryL1
                    const nextSubcategory = SUBCATEGORY_FILTERS[nextCategory]?.[0] ?? null
                    setCustomFood((prev) => ({ ...prev, category_l1: nextCategory, category_l2: nextSubcategory }))
                  }}
                  className="h-8 rounded-lg border-[0.3px] border-white/[0.08] bg-[#151515] px-2 text-[10px] text-white outline-none"
                >
                  {CATEGORY_FILTERS.filter((item) => item.id !== "all" && item.id !== "supplements").map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <select
                  value={customFood.category_l2 ?? ""}
                  onChange={(event) => setCustomFood((prev) => ({ ...prev, category_l2: event.target.value || null }))}
                  className="h-8 rounded-lg border-[0.3px] border-white/[0.08] bg-[#151515] px-2 text-[10px] text-white outline-none"
                >
                  {(SUBCATEGORY_FILTERS[customFood.category_l1] ?? []).map((sub) => (
                    <option key={sub} value={sub}>{SUBCATEGORY_LABELS[sub] ?? sub}</option>
                  ))}
                </select>
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {CUSTOM_FOOD_MACRO_FIELDS.map(({ key, label }) => (
                  <input
                    key={key}
                    type="number"
                    value={customFood[key]}
                    onChange={(event) => setCustomFood((prev) => ({ ...prev, [key]: event.target.value }))}
                    placeholder={label}
                    className="h-8 min-w-0 rounded-lg border-[0.3px] border-white/[0.08] bg-black/20 px-1.5 text-[10px] text-white outline-none placeholder:text-white/25"
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={createCustomFood}
                disabled={creatingFood || !customFood.name_fr.trim()}
                className="mt-2 h-8 w-full rounded-lg bg-[#1f8a65] text-[10px] font-bold uppercase tracking-[0.1em] text-white disabled:opacity-45"
              >
                {creatingFood ? "Création..." : "Enregistrer"}
              </button>
            </div>
          )}
          <div ref={filterBarRef} className="rounded-2xl border-[0.3px] border-white/[0.055] bg-white/[0.018] p-2.5">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[148px] flex-[1.2_1_148px]">
                <BuilderMenuButton
                  value={selectedCategoryLabel}
                  placeholder="Catégories"
                  active={openMenu === "category"}
                  onClick={() => setOpenMenu((prev) => (prev === "category" ? null : "category"))}
                />
                {openMenu === "category" && (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-full min-w-[220px] rounded-2xl border-[0.3px] border-white/[0.08] bg-[#111111] p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                    {CATEGORY_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => {
                          setCategory(filter.id)
                          setSubcategory(filter.id === "all" ? null : (SUBCATEGORY_FILTERS[filter.id]?.[0] ?? null))
                          setOpenMenu(null)
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] font-medium text-white/72 transition-colors hover:bg-white/[0.05] hover:text-white"
                      >
                        <span>{filter.label}</span>
                        {category === filter.id && <Check size={13} className="text-[#1f8a65]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative min-w-[132px] flex-[1_1_132px]">
                <BuilderMenuButton
                  value={selectedSubcategoryLabel}
                  placeholder="Sous-catégories"
                  active={openMenu === "subcategory"}
                  disabled={category === "all" || activeSubcategories.length === 0}
                  onClick={() => setOpenMenu((prev) => (prev === "subcategory" ? null : "subcategory"))}
                />
                {openMenu === "subcategory" && category !== "all" && activeSubcategories.length > 0 && (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-full min-w-[240px] rounded-2xl border-[0.3px] border-white/[0.08] bg-[#111111] p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                    {activeSubcategories.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setSubcategory(sub)
                          setOpenMenu(null)
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] font-medium text-white/72 transition-colors hover:bg-white/[0.05] hover:text-white"
                      >
                        <span>{SUBCATEGORY_LABELS[sub] ?? sub}</span>
                        {subcategory === sub && <Check size={13} className="text-[#1f8a65]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative min-w-[92px] flex-[0.7_1_92px]">
                <BuilderMenuButton
                  value={selectedSortLabel}
                  placeholder="Tri"
                  active={openMenu === "sort"}
                  onClick={() => setOpenMenu((prev) => (prev === "sort" ? null : "sort"))}
                />
                {openMenu === "sort" && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[280px] rounded-2xl border-[0.3px] border-white/[0.08] bg-[#111111] p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                    {SORT_SECTIONS.map((section) => (
                      <div key={section.label} className="py-1">
                        <p className="px-3 pb-1 text-[8px] font-bold uppercase tracking-[0.16em] text-white/28">
                          {section.label}
                        </p>
                        {section.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setSort(option.id)
                              setOpenMenu(null)
                            }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] font-medium text-white/72 transition-colors hover:bg-white/[0.05] hover:text-white"
                          >
                            <span>{option.label}</span>
                            {sort === option.id && <Check size={13} className="text-[#1f8a65]" />}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-36 pt-3 scrollbar-hide">
            <button
              type="button"
              onClick={() => {
                setCategory(recommendedCategory)
                setSubcategory(null)
              }}
              className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border-[0.3px] border-[#1f8a65]/20 bg-[#1f8a65]/[0.08] px-3 py-2.5 text-left"
            >
              <span className="flex items-center gap-2 text-[10px] font-medium text-[#b8efd9]">
                <Sparkles size={12} />
                Suggestion rapide : {CATEGORY_LABELS[recommendedCategory]}
              </span>
              <ChevronRight size={12} className="text-[#b8efd9]/60" />
            </button>
          <div className="mt-3 grid grid-cols-1 gap-1.5">
            {loadingFoods && foods.length === 0 ? (
              <p className="rounded-xl bg-white/[0.02] px-3 py-4 text-center text-[10px] text-white/35">Chargement...</p>
            ) : foods.map((food) => (
              <button
                key={food.id}
                type="button"
                draggable
                onDragStart={(event) => onFoodDragStart(event, food)}
                onDragEnd={() => setDraggedFood(null)}
                  className="flex items-center gap-2 rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.025] px-3 py-2 text-left transition-colors hover:bg-white/[0.045]"
              >
                <GripVertical size={12} className="shrink-0 text-white/25" />
                <FoodIcon food={food} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-medium text-white/75">{food.name_fr}</p>
                  <p className="text-[9px] text-white/35">{Math.round(food.kcal_per_100g)} kcal · P {food.protein_per_100g} · G {food.carbs_per_100g} · L {food.fat_per_100g}</p>
                </div>
              </button>
            ))}
          </div>
          </div>
        </section>

        <div
          onMouseDown={onMouseDownBuilderGrid}
          className={`w-1 flex-none bg-white/[0.06] transition-colors ${
            isFoodColumnResizable
              ? "cursor-col-resize hover:bg-[#1f8a65]/50 active:bg-[#1f8a65]"
              : "cursor-default opacity-35"
          }`}
        />

        <section
          className="flex min-h-0 flex-col"
          style={{ flex: "1 1 0", minWidth: 340 }}
        >
          <div className="shrink-0 border-b-[0.3px] border-white/[0.06] bg-[#121212] px-4 pb-3 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">Repas</p>
                <p className="mt-0.5 text-[11px] font-semibold text-white/75">
                  {activeMeals.length} repas · {activeDay?.name ?? "Jour actif"}
                </p>
                <p className="mt-1 text-[9px] leading-relaxed text-white/35">
                  Toutes les portions sont ajustables par défaut lors d&apos;une synchronisation.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPortionProtections((value) => !value)}
                  aria-expanded={showPortionProtections}
                  className={`flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[9px] font-semibold transition-colors ${
                    showPortionProtections
                      ? "border-[#1f8a65]/35 bg-[#1f8a65]/10 text-[#7fe2bf]"
                      : "border-white/[0.08] bg-white/[0.04] text-white/55 hover:bg-white/[0.07]"
                  }`}
                >
                  <SlidersHorizontal size={11} />
                  Protections
                </button>
                <button
                  type="button"
                  onClick={() => onStartMealPlanDuplication?.(activeDayIndex)}
                  disabled={!activeMeals.some((meal) => meal.items.length > 0)}
                  title={activeMeals.some((meal) => meal.items.length > 0) ? "Dupliquer ce plan sur d’autres journées" : "Ajoute d’abord au moins un aliment au plan"}
                  className="flex h-7 items-center gap-1.5 rounded-lg border border-[#86aeb8]/25 bg-[#86aeb8]/10 px-2 text-[9px] font-semibold text-[#c6dce2] transition-colors hover:bg-[#86aeb8]/20 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Copy size={11} />
                  Dupliquer
                </button>
                <button
                  type="button"
                  onClick={addMeal}
                  className="flex h-7 items-center gap-1.5 rounded-lg bg-white px-2 text-[9px] font-bold uppercase tracking-[0.1em] text-black transition-opacity hover:opacity-90"
                >
                  <Plus size={11} />
                  Repas
                </button>
              </div>
            </div>
          {showPortionProtections && (
            <p className="mb-2 rounded-lg border border-[#1f8a65]/20 bg-[#1f8a65]/[0.06] px-2.5 py-2 text-[9px] leading-relaxed text-[#7fe2bf]/80">
              À utiliser seulement si le coach veut fixer une portion, la limiter ou lui donner une priorité. Sinon, le système ajuste automatiquement les aliments concernés.
            </p>
          )}
          <div className="grid w-full grid-cols-2 gap-x-2 gap-y-3 rounded-2xl border-[0.3px] border-white/[0.05] bg-white/[0.02] px-3 py-3 min-[520px]:grid-cols-4">
            <HeaderMacroGauge label="Calories" value={totals.calories} target={target.calories} toneClass="text-[#4aa3ff]" accentColor="#4aa3ff" />
            <HeaderMacroGauge label="Protéines" value={totals.protein} target={target.protein} toneClass="text-[#68c389]" accentColor="#68c389" />
            <HeaderMacroGauge label="Glucides" value={totals.carbs} target={target.carbs} toneClass="text-[#f5c85b]" accentColor="#f5c85b" />
            <HeaderMacroGauge label="Lipides" value={totals.fat} target={target.fat} toneClass="text-[#ff875c]" accentColor="#ff875c" />
          </div>
          {cyclePreview && (
            <div className="mt-2 rounded-xl border-[0.3px] border-[#1f8a65]/20 bg-[#1f8a65]/[0.06] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-semibold text-[#7fe2bf]">Simulation Cycle Sync</p>
                <p className="text-[8px] text-white/40">Version cliente calculée à partir de ces règles.</p>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-2 text-[8px] text-white/55">
                {([
                  ["P", cyclePreview.requestedDelta.protein, cyclePreview.appliedDelta.protein],
                  ["G", cyclePreview.requestedDelta.carbs, cyclePreview.appliedDelta.carbs],
                  ["L", cyclePreview.requestedDelta.fat, cyclePreview.appliedDelta.fat],
                ] as const).map(([label, requested, applied]) => (
                  <span key={label}>{label} : {applied > 0 ? "+" : ""}{applied} g / {requested > 0 ? "+" : ""}{requested} g</span>
                ))}
              </div>
              {cyclePreview.warnings.length > 0 && (
                <p className="mt-1.5 text-[8px] text-amber-200/80">{cyclePreview.warnings[0]}</p>
              )}
            </div>
          )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-36 pt-3 scrollbar-hide">
          {showCoachSmoothingPanel ? (
            <div className="mb-3">
              <CoachSmoothingStudioPanel
                clientId={clientId}
                protocolId={protocolId}
                protocolStatus={protocolStatus}
                sourceDate={sourceDate ?? null}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            {activeMeals.map((meal, mealIndex) => {
              const totals = mealTotals(meal)
              return (
              <div
                key={meal.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const food = readDraggedFood(event)
                  if (food) addFoodToMeal(meal.id, food)
                }}
                className="rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={meal.title}
                    onChange={(event) => renameMeal(meal.id, event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold text-white outline-none placeholder:text-white/30"
                  />
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2 text-[9px] font-semibold">
                      <span className="text-[#4da3ff]">{Math.round(totals.calories)} kcal</span>
                      <span className="text-[#6ee7a8]">{Math.round(totals.protein)} P</span>
                      <span className="text-[#f7d154]">{Math.round(totals.carbs)} G</span>
                      <span className="text-[#ff8a5b]">{Math.round(totals.fat)} L</span>
                    </div>
                    {mealIndex >= 4 && (
                      <button
                        type="button"
                        onClick={() => removeMeal(meal.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-white/25 hover:bg-white/[0.05] hover:text-red-300"
                        aria-label="Supprimer le repas"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 space-y-2">
                  {meal.items.map((item) => (
                    <div key={item.id} className="rounded-lg bg-black/20 p-2">
                      <div className="flex items-start gap-2">
                        <FoodIcon food={item.food} size={34} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-medium text-white/80">{item.food.name_fr}</p>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={quantityInputs[item.id] ?? String(item.quantity_g)}
                            onChange={(event) => updateItemQuantity(item.id, event.target.value)}
                            onBlur={() => commitItemQuantity(item.id, item.quantity_g)}
                            className="mt-1 h-7 w-20 rounded-md border-[0.3px] border-white/[0.06] bg-white/[0.04] px-2 text-[10px] text-white outline-none focus:border-[#1f8a65]/40"
                          />
                          {item.cycle_adjustment?.locked && !showPortionProtections && (
                            <p className="mt-1.5 inline-flex items-center gap-1 text-[8px] font-semibold text-amber-200">
                              <Lock size={9} /> Portion fixe
                            </p>
                          )}
                          {showPortionProtections && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateItemCycleAdjustment(item.id, { locked: !item.cycle_adjustment?.locked })}
                                className={`flex h-6 items-center gap-1 rounded-md px-1.5 text-[8px] font-semibold transition-colors ${
                                  item.cycle_adjustment?.locked
                                    ? "bg-amber-300/10 text-amber-200"
                                    : "bg-[#1f8a65]/10 text-[#a8e7c8]"
                                }`}
                                aria-label={item.cycle_adjustment?.locked ? "Autoriser l’ajustement" : "Fixer cette portion"}
                              >
                                {item.cycle_adjustment?.locked ? <Lock size={9} /> : <Unlock size={9} />}
                                {item.cycle_adjustment?.locked ? "Portion fixe" : "Ajustable"}
                              </button>
                              {!item.cycle_adjustment?.locked && (
                                <>
                                  <select
                                    value={item.cycle_adjustment?.priority ?? 1}
                                    onChange={(event) => updateItemCycleAdjustment(item.id, { priority: Number(event.target.value) as 1 | 2 | 3 })}
                                    className="h-6 rounded-md border-[0.3px] border-white/[0.06] bg-white/[0.04] px-1 text-[8px] text-white/60 outline-none"
                                    aria-label={`Priorité d’ajustement pour ${item.food.name_fr}`}
                                  >
                                    <option value={1}>Standard</option>
                                    <option value={2}>Prioritaire</option>
                                    <option value={3}>Très prioritaire</option>
                                  </select>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.cycle_adjustment?.min_quantity_g ?? ""}
                                    onChange={(event) => updateItemCycleAdjustment(item.id, {
                                      min_quantity_g: event.target.value === "" ? undefined : Math.max(1, Number(event.target.value)),
                                    })}
                                    placeholder="Min. g"
                                    className="h-6 w-12 rounded-md border-[0.3px] border-white/[0.06] bg-white/[0.04] px-1 text-[8px] text-white/60 outline-none placeholder:text-white/25"
                                    aria-label={`Portion minimale pour ${item.food.name_fr}`}
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.cycle_adjustment?.max_quantity_g ?? ""}
                                    onChange={(event) => updateItemCycleAdjustment(item.id, {
                                      max_quantity_g: event.target.value === "" ? undefined : Math.max(1, Number(event.target.value)),
                                    })}
                                    placeholder="Max. g"
                                    className="h-6 w-12 rounded-md border-[0.3px] border-white/[0.06] bg-white/[0.04] px-1 text-[8px] text-white/60 outline-none placeholder:text-white/25"
                                    aria-label={`Portion maximale pour ${item.food.name_fr}`}
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => updateMealsForDay(activeDayKey, (meals) =>
                            meals.map((mealDraft) => ({
                              ...mealDraft,
                              items: mealDraft.items.filter((mealItem) => mealItem.id !== item.id),
                            })),
                          )}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-white/25 hover:bg-white/[0.05] hover:text-red-300"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          const food = readDraggedFood(event)
                          if (food) addAlternative(item, food)
                        }}
                        className="mt-2 rounded-md border-[0.3px] border-dashed border-white/[0.08] px-2 py-1.5"
                      >
                        <div className="flex items-center gap-1.5 text-[9px] text-white/35">
                          <Plus size={10} />
                          Alternative avec prorata kcal
                        </div>
                        {item.alternatives.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {item.alternatives.map((alternative) => (
                              <div key={alternative.id} className="flex items-center justify-between gap-2 text-[9px] text-white/55">
                                <FoodIcon food={alternative.food} size={26} />
                                <span className="truncate">{alternative.food.name_fr}</span>
                                <span className="shrink-0">{alternative.quantity_g} g</span>
                                <button
                                  type="button"
                                  onClick={() => removeAlternative(item.id, alternative.id)}
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/25 hover:bg-white/[0.05] hover:text-red-300"
                                  aria-label="Supprimer l’alternative"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const food = readDraggedFood(event)
                      if (food) addFoodToMeal(meal.id, food)
                    }}
                    className="rounded-lg border-[0.3px] border-dashed border-white/[0.1] bg-white/[0.015] py-3 text-center text-[10px] text-white/30 transition-colors hover:border-[#1f8a65]/35 hover:text-white/50"
                  >
                    Glisser un aliment ici
                  </div>
                </div>
              </div>
              )
            })}
          </div>
          </div>
        </section>
      </div>
    </div>
  )
}
