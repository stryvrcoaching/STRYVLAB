"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ForwardedRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronLeft, ChevronUp, Search, Plus, Minus, Check, X, Pencil, Trash2, Mic } from "lucide-react"
import dynamic from "next/dynamic"

const VoiceLogSheet = dynamic(() => import("@/components/client/smart/VoiceLogSheet"), { ssr: false })
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
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors"
import { evaluateFoodCompatibility, suggestQuantityForItem } from "@/lib/nutrition/compose-advisor"
import { computeActionableRemaining } from "@/lib/nutrition/actionable-remaining"
import { getRemainingNutritionTargets } from "@/lib/nutrition/remaining-targets"
import RemainingNutritionSummary from "@/components/client/nutrition/RemainingNutritionSummary"
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget"

// ─── Icônes catégories ───────────────────────────────────────
type VisibleCategoryKey = "proteins" | "carbs" | "fats" | "vegetables" | "drinks" | "supplements"
type VisibleLeafKey =
  | "chicken" | "beef" | "pork" | "turkey" | "fish" | "seafood" | "eggs" | "dairy-protein" | "plant-protein" | "charcuterie" | "other-proteins"
  | "rice" | "pasta" | "bread" | "cereals" | "potatoes" | "legumes" | "fresh-fruits" | "dried-fruits" | "sweet-products" | "sweet-sauces"
  | "oils" | "nuts-seeds" | "avocado-olives" | "butter-spreads" | "nut-butters" | "fatty-sauces"
  | "leafy" | "cruciferous" | "roots" | "mediterranean" | "other-vegetables"
  | "water" | "hot-drinks" | "juices-smoothies" | "sodas" | "plant-milks" | "sports-drinks" | "alcohol"
  | "whey" | "gainers-bars" | "performance" | "other-supplements"

const CATEGORY_ICONS: Record<VisibleCategoryKey, string> = {
  proteins: "🥩",
  carbs: "🌾",
  fats: "🥑",
  vegetables: "🥦",
  drinks: "💧",
  supplements: "💪",
}

const LEAF_ICONS: Record<VisibleLeafKey, string> = {
  chicken: "🐔", beef: "🐄", pork: "🐖", turkey: "🦃", fish: "🐟", seafood: "🦐", eggs: "🥚", "dairy-protein": "🥛", "plant-protein": "🌿", charcuterie: "🥓", "other-proteins": "🍖",
  rice: "🍚", pasta: "🍝", bread: "🍞", cereals: "🥣", potatoes: "🥔", legumes: "🫘", "fresh-fruits": "🍎", "dried-fruits": "🍇", "sweet-products": "🍯", "sweet-sauces": "🫙",
  oils: "🫒", "nuts-seeds": "🌰", "avocado-olives": "🥑", "butter-spreads": "🧈", "nut-butters": "🥜", "fatty-sauces": "🍶",
  leafy: "🥬", cruciferous: "🥦", roots: "🥕", mediterranean: "🍆", "other-vegetables": "🥗",
  water: "💧", "hot-drinks": "☕", "juices-smoothies": "🍹", sodas: "🥤", "plant-milks": "🥛", "sports-drinks": "⚡", alcohol: "🍷",
  whey: "🥤", "gainers-bars": "🍫", performance: "💥", "other-supplements": "💊",
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

const VISIBLE_LEAVES_BY_CATEGORY: Record<VisibleCategoryKey, VisibleLeafKey[]> = {
  proteins: ["chicken", "beef", "pork", "turkey", "fish", "seafood", "eggs", "dairy-protein", "plant-protein", "charcuterie", "other-proteins"],
  carbs: ["rice", "pasta", "bread", "cereals", "potatoes", "legumes", "fresh-fruits", "dried-fruits", "sweet-products", "sweet-sauces"],
  fats: ["oils", "nuts-seeds", "avocado-olives", "butter-spreads", "nut-butters", "fatty-sauces"],
  vegetables: ["leafy", "cruciferous", "roots", "mediterranean", "other-vegetables"],
  drinks: ["water", "hot-drinks", "juices-smoothies", "sodas", "plant-milks", "sports-drinks", "alcohol"],
  supplements: ["whey", "gainers-bars", "performance", "other-supplements"],
}

type Layer = "category" | "subcategory" | "item" | "quantity"
export type NutritionLogLayer = Layer
type MealSource = "manual" | "voice" | "text" | "composer" | "auto_adjusted" | "flash_estimate"
type SmartComposeSurface = "explore" | "library"

// Infer category from macro ratios — better than always "extras" for advisor accuracy
function inferCategoryFromMacros(entry: { protein_g?: number; carbs_g?: number; fat_g?: number }): CategoryL1 {
  const p = (entry.protein_g ?? 0) * 4
  const c = (entry.carbs_g ?? 0) * 4
  const f = (entry.fat_g ?? 0) * 9
  const total = p + c + f
  if (total === 0) return 'extras'
  if (p >= c && p >= f) return 'proteins'
  if (c >= p && c >= f) return 'carbs'
  return 'fats'
}

function normalizeFoodText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
}

function nameHasAny(item: FoodItem, keywords: string[]): boolean {
  const name = normalizeFoodText(item.name_fr)
  return keywords.some((keyword) => name.includes(keyword))
}

function matchesVisibleLeaf(item: FoodItem, leaf: VisibleLeafKey): boolean {
  switch (leaf) {
    case "chicken":
      return item.category_l1 === "proteins" && item.category_l2 === "viandes" && nameHasAny(item, ["poulet", "chicken"])
    case "beef":
      return item.category_l1 === "proteins" && item.category_l2 === "viandes" && nameHasAny(item, ["boeuf", "bœuf", "steak", "veau", "hach", "entrecote", "rumsteck"])
    case "pork":
      return item.category_l1 === "proteins" && item.category_l2 === "viandes" && nameHasAny(item, ["porc", "jambon", "lard", "bacon", "saucisse", "filet mignon"])
    case "turkey":
      return item.category_l1 === "proteins" && item.category_l2 === "viandes" && nameHasAny(item, ["dinde", "turkey"])
    case "fish":
      return item.category_l1 === "proteins" && item.category_l2 === "poissons"
    case "seafood":
      return item.category_l1 === "proteins" && (item.category_l2 === "poissons" || item.category_l2 === "viandes") && nameHasAny(item, ["crevette", "moule", "calamar", "seiche", "saint-jacques", "crabe", "homard", "langouste", "huitre", "huître"])
    case "eggs":
      return item.category_l1 === "proteins" && item.category_l2 === "oeufs"
    case "dairy-protein":
      return item.category_l1 === "proteins" && item.category_l2 === "laitiers"
    case "plant-protein":
      return item.category_l1 === "proteins" && item.category_l2 === "vegetales"
    case "charcuterie":
      return item.category_l1 === "proteins" && nameHasAny(item, ["jambon", "salami", "saucisson", "chorizo", "charcut", "bresaola", "pancetta"])
    case "other-proteins":
      return item.category_l1 === "proteins"
    case "rice":
      return item.category_l1 === "carbs" && nameHasAny(item, ["riz", "rice"])
    case "pasta":
      return item.category_l1 === "carbs" && nameHasAny(item, ["pate", "pâtes", "spaghetti", "penne", "macaroni", "tagliatelle", "gnocchi"])
    case "bread":
      return item.category_l1 === "carbs" && item.category_l2 === "pain"
    case "cereals":
      return item.category_l1 === "carbs" && item.category_l2 === "cereales"
    case "potatoes":
      return item.category_l1 === "carbs" && item.category_l2 === "fecules" && nameHasAny(item, ["pomme de terre", "patate", "frite", "puree", "purée"])
    case "legumes":
      return item.category_l1 === "carbs" && item.category_l2 === "legumineuses"
    case "fresh-fruits":
      return item.category_l1 === "fruits" && item.category_l2 === "frais"
    case "dried-fruits":
      return item.category_l1 === "fruits" && item.category_l2 === "secs"
    case "sweet-products":
      return (item.category_l1 === "carbs" || item.category_l1 === "extras") && nameHasAny(item, ["sucre", "miel", "confiture", "chocolat", "biscuit", "cookie", "gateau", "gâteau", "bonbon", "compote", "cereal", "granola"])
    case "sweet-sauces":
      return (item.category_l1 === "extras" || item.category_l1 === "carbs") && (item.category_l2 === "sauces" || nameHasAny(item, ["sirop", "coulis", "ketchup", "bbq", "barbecue", "sauce"]))
    case "oils":
      return item.category_l1 === "fats" && item.category_l2 === "huiles"
    case "nuts-seeds":
      return item.category_l1 === "fats" && item.category_l2 === "noix-graines"
    case "avocado-olives":
      return item.category_l1 === "fats" && nameHasAny(item, ["avocat", "olive"])
    case "butter-spreads":
      return item.category_l1 === "fats" && nameHasAny(item, ["beurre", "margarine"])
    case "nut-butters":
      return (item.category_l1 === "fats" || item.category_l1 === "extras") && nameHasAny(item, ["cacahuete", "amande", "noisette", "pistache", "beurre de", "puree", "purée"])
    case "fatty-sauces":
      return (item.category_l1 === "fats" || item.category_l1 === "extras") && (item.category_l2 === "sauces" || nameHasAny(item, ["mayonnaise", "pesto", "vinaigrette", "tahini", "sauce"]))
    case "leafy":
      return item.category_l1 === "vegetables" && item.category_l2 === "feuilles"
    case "cruciferous":
      return item.category_l1 === "vegetables" && item.category_l2 === "cruciferes"
    case "roots":
      return item.category_l1 === "vegetables" && nameHasAny(item, ["carotte", "betterave", "navet", "radis", "panais"])
    case "mediterranean":
      return item.category_l1 === "vegetables" && nameHasAny(item, ["courgette", "aubergine", "poivron", "tomate", "concombre"])
    case "other-vegetables":
      return item.category_l1 === "vegetables"
    case "water":
      return item.category_l1 === "drinks" && item.category_l2 === "eau"
    case "hot-drinks":
      return item.category_l1 === "drinks" && item.category_l2 === "chauds"
    case "juices-smoothies":
      return item.category_l1 === "drinks" && item.category_l2 === "jus-smoothies"
    case "sodas":
      return (item.category_l1 === "drinks" && item.category_l2 === "boissons") || nameHasAny(item, ["coca", "cola", "fanta", "sprite", "soda", "ice tea"])
    case "plant-milks":
      return item.category_l1 === "drinks" && item.category_l2 === "laits-vegetaux"
    case "sports-drinks":
      return item.category_l1 === "drinks" && item.category_l2 === "sports-drinks"
    case "alcohol":
      return item.category_l1 === "drinks" && item.category_l2 === "alcools"
    case "whey":
      return (item.category_l2 === "complements" || item.category_l1 === "proteins") && nameHasAny(item, ["whey", "isolate", "caseine", "caséine", "protein", "protéine"])
    case "gainers-bars":
      return (item.category_l2 === "complements" || item.category_l1 === "extras" || item.category_l1 === "proteins") && nameHasAny(item, ["gainer", "barre", "protein bar", "barre prote", "meal replacement"])
    case "performance":
      return item.category_l2 === "complements" && nameHasAny(item, ["creatine", "créatine", "bcaa", "eaa", "pre-workout", "maltodextrine", "electrolyte", "électrolyte"])
    case "other-supplements":
      return item.category_l2 === "complements"
    default:
      return false
  }
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
}

interface FavoriteMeal {
  id: string
  name: string
  entries: any[]
  total_calories: number | null
  total_protein_g: number | null
  total_carbs_g: number | null
  total_fat_g: number | null
  use_count: number
  last_used_at: string
}

interface CustomFoodCatalogItem extends FoodItem {
  client_id?: string | null
}

export interface NutritionLogContentHandle {
  saveMeal: () => Promise<boolean>
  savePrep: () => Promise<boolean>
  clearDrafts: () => void
  openVoice?: (mode?: 'voice' | 'text') => void
}

export interface NutritionLogContentProps {
  onSuccess?: () => void
  /** When true, renders without the fixed TopBar (used inside MealLogSheet which has its own header) */
  embedded?: boolean
  /** Pre-select a meal to add items to (overrides ?meal_id search param) */
  mealId?: string | null
  /** Existing Smart Nutrition Prep to update instead of creating a new one */
  prepId?: string | null
  prepScenario?: {
    key: string
    label: string
  }
  initialPrepEntries?: Array<{
    food_item_id: string
    name_fr: string
    quantity_g: number
    calories_kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g?: number
  }>
  /** Runtime behavior from meal method selector */
  composerMode?: "standard" | "guide" | "simulation"
  /** Preferred starting emphasis when tracking an already eaten meal */
  entryMode?: "default" | "search" | "favorites" | "categories"
  /** Current day balance used to propose an automatic quantity */
  balanceContext?: {
    consumed: NutritionMacros
    target: NutritionMacros
    profile?: {
      gender?: string | null
      weightKg?: number | null
    }
  }
  /** When true, suppresses internal save/log buttons — parent controls actions via ref */
  hideActions?: boolean
  /** Called whenever draft totals change — use to drive external simulation views */
  onDraftsChange?: (totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
    count: number
  }) => void
  /** When true, parent page owns scrolling and this component expands naturally */
  externalScroll?: boolean
  /** Exposes current navigation depth so parent containers can compact surrounding chrome */
  onLayerChange?: (layer: NutritionLogLayer) => void
  /** Compose date (ISO YYYY-MM-DD) — used when saving preps to set the correct physiological_date */
  prepDate?: string | null
  /** Meal slot for this prep (breakfast/lunch/dinner/snack) — parent sets via slot picker */
  prepMealSlot?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null
  /** Optional prep title — displayed in coach view and prep list */
  prepTitle?: string | null
  /** Called when the parent wants to open the voice/text log — used in embedded smart mode where mic lives in parent header */
  onVoiceOpen?: () => void
}

function NutritionLogContentImpl({
  onSuccess,
  embedded = false,
  mealId: mealIdProp,
  prepId,
  prepScenario,
  initialPrepEntries,
  composerMode = "standard",
  entryMode = "default",
  balanceContext,
  hideActions = false,
  onDraftsChange,
  externalScroll = false,
  onLayerChange,
  prepDate,
  prepMealSlot,
  prepTitle,
  onVoiceOpen,
}: NutritionLogContentProps, ref: ForwardedRef<NutritionLogContentHandle>) {
  const { t } = useClientT()
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceInputMode, setVoiceInputMode] = useState<"voice" | "text">("voice")
  const router = useRouter()
  const searchParams = useSearchParams()

  const CATEGORY_LABELS_T: Record<VisibleCategoryKey, string> = {
    proteins: t('food.cat.proteins'),
    carbs: t('food.cat.carbs'),
    fats: t('food.cat.fats'),
    vegetables: t('food.cat.vegetables'),
    drinks: t('food.cat.drinks'),
    supplements: t('food.sub.complements'),
  }

  const SUBCATEGORY_LABELS_T: Record<VisibleLeafKey, string> = {
    chicken: 'Poulet',
    beef: 'Boeuf',
    pork: 'Porc',
    turkey: 'Dinde',
    fish: t('food.sub.poissons'),
    seafood: 'Fruits de mer',
    eggs: t('food.sub.oeufs'),
    'dairy-protein': t('food.sub.laitiers'),
    'plant-protein': t('food.sub.vegetales'),
    charcuterie: 'Charcuterie',
    'other-proteins': 'Autres protéines',
    rice: 'Riz',
    pasta: 'Pâtes',
    bread: t('food.sub.pain'),
    cereals: t('food.sub.cereales'),
    potatoes: 'Pommes de terre',
    legumes: t('food.sub.legumineuses'),
    'fresh-fruits': t('food.sub.frais'),
    'dried-fruits': t('food.sub.secs'),
    'sweet-products': 'Produits sucrés',
    'sweet-sauces': 'Sauces sucrées',
    oils: t('food.sub.huiles'),
    'nuts-seeds': t('food.sub.noix-graines'),
    'avocado-olives': 'Avocat & olives',
    'butter-spreads': 'Beurres & tartinables',
    'nut-butters': "Purées d'oléagineux",
    'fatty-sauces': 'Sauces grasses',
    leafy: t('food.sub.feuilles'),
    cruciferous: t('food.sub.cruciferes'),
    roots: 'Légumes racines',
    mediterranean: 'Légumes méditerranéens',
    'other-vegetables': t('food.sub.autres-legumes'),
    water: t('food.sub.eau'),
    'hot-drinks': t('food.sub.chauds'),
    'juices-smoothies': t('food.sub.jus-smoothies'),
    sodas: 'Sodas',
    'plant-milks': t('food.sub.laits-vegetaux'),
    'sports-drinks': t('food.sub.sports-drinks'),
    alcohol: t('food.sub.alcools'),
    whey: 'Whey & protéines',
    'gainers-bars': 'Gainers & barres',
    performance: 'Créatine & performance',
    'other-supplements': 'Autres compléments',
  }

  const existingMealId = mealIdProp ?? searchParams.get("meal_id")

  const [favorites, setFavorites] = useState<FavoriteMeal[]>([])
  const [loadingFavorites, setLoadingFavorites] = useState(false)
  const [savingFavorite, setSavingFavorite] = useState(false)
  const [savingPrep, setSavingPrep] = useState(false)
  const [favoriteName, setFavoriteName] = useState("")
  const [showFavoriteSaveForm, setShowFavoriteSaveForm] = useState(false)

  const [layer, setLayer] = useState<Layer>("category")
  const [direction, setDirection] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<VisibleCategoryKey | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<VisibleLeafKey | null>(null)
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null)
  const [items, setItems] = useState<FoodItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [searchQ, setSearchQ] = useState("")
  const [qMode, setQMode] = useState<"grams" | "portion">("grams")
  const [quantityG, setQuantityG] = useState<number>(100)
  const [quantityInput, setQuantityInput] = useState("100")
  const [selectedPortion, setSelectedPortion] = useState<number>(0)
  const [portionMult, setPortionMult] = useState<number>(1)
  const [scalingProfile, setScalingProfile] = useState<PortionScalingProfile | null>(null)
  const [didAutoAdjust, setDidAutoAdjust] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [showMyFoods, setShowMyFoods] = useState(false)
  const [myFoods, setMyFoods] = useState<CustomFoodCatalogItem[]>([])
  const [loadingMyFoods, setLoadingMyFoods] = useState(false)
  const [myFoodsQuery, setMyFoodsQuery] = useState("")
  const [editingCustomFood, setEditingCustomFood] = useState<CustomFoodCatalogItem | null>(null)
  const [smartSurface, setSmartSurface] = useState<SmartComposeSurface>(
    entryMode === "favorites" ? "library" : "explore",
  )
  const [drafts, setDrafts] = useState<EntryDraft[]>([])
  const [draftExpanded, setDraftExpanded] = useState(false)
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
    if (!initialPrepEntries?.length) return
    setDrafts(initialPrepEntries.map((entry) => {
      const q = entry.quantity_g > 0 ? entry.quantity_g : 100
      const factor = 100 / q
      return {
        food_item: {
          id: entry.food_item_id,
          name_fr: entry.name_fr,
          category_l1: inferCategoryFromMacros(entry),
          category_l2: null,
          item_key: `prep-${entry.food_item_id}`,
          kcal_per_100g: Math.round(entry.calories_kcal * factor),
          protein_per_100g: Math.round(entry.protein_g * factor * 10) / 10,
          carbs_per_100g: Math.round(entry.carbs_g * factor * 10) / 10,
          fat_per_100g: Math.round(entry.fat_g * factor * 10) / 10,
          fiber_per_100g: Math.round((entry.fiber_g ?? 0) * factor * 10) / 10,
          source: "user",
          is_verified: false,
        },
        quantity_g: entry.quantity_g,
        input_mode: "composer" as const,
      }
    }))
  }, [initialPrepEntries])

  useEffect(() => {
    let cancelled = false
    setLoadingFavorites(true)
    fetch('/api/client/nutrition/favorites')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.data) setFavorites(d.data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingFavorites(false) })
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
  function selectCategory(cat: VisibleCategoryKey) { setSelectedCategory(cat); setSelectedSubcategory(null); goTo("subcategory", 1) }
  function selectSubcategory(sub: VisibleLeafKey) { setSelectedSubcategory(sub); setSearchQ(""); goTo("item", 1) }
  function applyQuantity(next: number) {
    const safe = Math.max(0, Math.round(next))
    setQuantityG(safe)
    setQuantityInput(String(safe))
  }

  function handleQuantityInputChange(value: string) {
    if (value === "") {
      setQuantityInput("")
      setQuantityG(0)
      return
    }
    if (!/^\d+$/.test(value)) return
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    setQuantityInput(value)
    setQuantityG(Math.max(0, parsed))
  }

  function handleQuantityInputBlur() {
    if (quantityInput.trim() === "") {
      setQuantityInput("0")
    }
  }

  function selectItem(item: FoodItem) {
    setSelectedItem(item)
    const suggested = advisorRemaining ? suggestQuantityForItem(item, advisorRemaining) : null
    if (composerMode === "guide" && suggested) {
      applyQuantity(suggested.grams)
      setDidAutoAdjust(true)
    } else {
      applyQuantity(100)
      setDidAutoAdjust(false)
    }
    setSelectedPortion(0)
    setPortionMult(1)
    setQMode("grams")
    goTo("quantity", 1)
  }

  function goBack() {
    if (layer === "quantity") { goTo("item", -1); setSelectedItem(null) }
    else if (layer === "item") { goTo("subcategory", -1); setSelectedSubcategory(null) }
    else if (layer === "subcategory") { goTo("category", -1); setSelectedCategory(null) }
    else if (!embedded) router.back()
  }

  const loadMyFoods = useCallback(async (query: string = "") => {
    setLoadingMyFoods(true)
    try {
      const params = new URLSearchParams({ mine: "true", limit: "300" })
      if (query.trim()) params.set("q", query.trim())
      const res = await fetch(`/api/client/food-items?${params.toString()}`)
      const json = await res.json()
      setMyFoods(json.data ?? [])
    } catch {
      setMyFoods([])
    } finally {
      setLoadingMyFoods(false)
    }
  }, [])

  const fetchItems = useCallback(async (sub: VisibleLeafKey | null, q: string) => {
    if (!selectedCategory || !sub) return
    setLoadingItems(true)
    const params = new URLSearchParams({ limit: "1000" })
    if (q) params.set("q", q)
    const res = await fetch(`/api/client/food-items?${params}`)
    const json = await res.json()
    const allItems = (json.data ?? []) as FoodItem[]
    setItems(allItems.filter((item) => matchesVisibleLeaf(item, sub)))
    setLoadingItems(false)
  }, [selectedCategory])

  useEffect(() => {
    if (layer === "item") {
      const timer = setTimeout(() => fetchItems(selectedSubcategory, searchQ), searchQ ? 300 : 0)
      return () => clearTimeout(timer)
    }
  }, [layer, selectedSubcategory, searchQ, fetchItems])

  useEffect(() => {
    if (!showMyFoods) return
    const timer = setTimeout(() => loadMyFoods(myFoodsQuery), myFoodsQuery ? 250 : 0)
    return () => clearTimeout(timer)
  }, [showMyFoods, myFoodsQuery, loadMyFoods])

  function applyPortion(idx: number, mult: number = portionMult) {
    setSelectedPortion(idx)
    applyQuantity(getScaledPortionG(PORTION_SIZES[idx], scalingProfile, mult))
  }

  function applyMultiplier(mult: number) {
    setPortionMult(mult)
    if (qMode === "portion") applyQuantity(getScaledPortionG(PORTION_SIZES[selectedPortion], scalingProfile, mult))
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
    return persistMeal(drafts, "composer")
  }

  function inferSlotFromTime(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
    const h = new Date().getHours()
    if (h < 10) return 'breakfast'
    if (h < 14) return 'lunch'
    if (h < 18) return 'snack'
    return 'dinner'
  }

  async function savePrep(): Promise<boolean> {
    if (!drafts.length) return false
    setSavingPrep(true)
    try {
      const plannedFor = prepDate
        ? new Date(`${prepDate}T12:00:00.000Z`).toISOString()
        : new Date().toISOString()
      const slot = prepMealSlot ?? inferSlotFromTime()
      const res = await fetch(prepId ? `/api/client/nutrition/preps/${prepId}` : "/api/client/nutrition/preps", {
        method: prepId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_key: prepScenario?.key,
          scenario_label: prepScenario?.label,
          planned_for: plannedFor,
          ...(prepTitle?.trim() ? { title: prepTitle.trim() } : {}),
          meal_slot: slot,
          meal_type: slot,
          entries: drafts.map(d => ({
            food_item_id: d.food_item.id,
            quantity_g: d.quantity_g,
          })),
        }),
      })
      if (res.ok) {
        if (onSuccess) onSuccess()
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setSavingPrep(false)
    }
  }

  async function persistMeal(entriesDraft: EntryDraft[], mealSource: MealSource): Promise<boolean> {
    if (!entriesDraft.length) return false
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        entries: entriesDraft.map(d => ({ food_item_id: d.food_item.id, quantity_g: d.quantity_g, input_mode: d.input_mode })),
        meal_source: mealSource,
      }
      if (existingMealId) body.meal_id = existingMealId
      // Pass logged_at as noon of the compose date so physiological_date is correct
      // regardless of server timezone — mirrors the pattern used in savePrep()
      if (prepDate) body.logged_at = `${prepDate}T12:00:00.000Z`
      if (prepMealSlot) body.meal_type = prepMealSlot
      const res = await fetch("/api/client/nutrition/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        if (onSuccess) onSuccess()
        return true
      }
      setSaving(false)
      return false
    } catch {
      setSaving(false)
      return false
    }
  }

  async function validateAutoAdjustedMeal() {
    if (!selectedItem || quantityG <= 0 || !didAutoAdjust) return
    const entry: EntryDraft = {
      food_item: selectedItem,
      quantity_g: quantityG,
      input_mode: "composer",
    }
    await persistMeal([entry], "auto_adjusted")
  }

  function quickLogFavorite(fav: FavoriteMeal) {
    if (isSmartPrepMode) {
      // In simulation mode, add entries to drafts instead of logging for real
      const newDrafts: EntryDraft[] = (fav.entries as any[]).map((entry) => {
        const q = entry.quantity_g > 0 ? entry.quantity_g : 100
        const factor = 100 / q
        return {
          food_item: {
            id: entry.food_item_id,
            name_fr: entry.name_fr,
            category_l1: inferCategoryFromMacros(entry) as CategoryL1,
            category_l2: null,
            item_key: `fav-${entry.food_item_id}`,
            kcal_per_100g: Math.round((entry.calories_kcal ?? 0) * factor),
            protein_per_100g: Math.round((entry.protein_g ?? 0) * factor * 10) / 10,
            carbs_per_100g: Math.round((entry.carbs_g ?? 0) * factor * 10) / 10,
            fat_per_100g: Math.round((entry.fat_g ?? 0) * factor * 10) / 10,
            fiber_per_100g: 0,
            source: 'user',
            is_verified: false,
          },
          quantity_g: entry.quantity_g,
          input_mode: 'composer' as const,
        }
      })
      setDrafts(prev => [...prev, ...newDrafts])
      return
    }
    setSaving(true)
    fetch(`/api/client/nutrition/favorites/${fav.id}/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(res => {
        if (res.ok) {
          if (onSuccess) onSuccess()
          else router.push("/client/nutrition")
        } else {
          setSaving(false)
        }
      })
      .catch(() => { setSaving(false) })
  }

  async function saveFavorite() {
    if (!favoriteName.trim() || !drafts.length) return
    setSavingFavorite(true)
    try {
      const totals = sumDraftMacros(drafts)
      const entries = drafts.map(d => ({
        food_item_id: d.food_item.id,
        name_fr: d.food_item.name_fr,
        quantity_g: d.quantity_g,
        calories_kcal: calcEntryMacros(d.food_item, d.quantity_g).calories_kcal,
        protein_g: calcEntryMacros(d.food_item, d.quantity_g).protein_g,
        carbs_g: calcEntryMacros(d.food_item, d.quantity_g).carbs_g,
        fat_g: calcEntryMacros(d.food_item, d.quantity_g).fat_g,
      }))

      const res = await fetch("/api/client/nutrition/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: favoriteName.trim(),
          entries,
          total_calories: totals.calories,
          total_protein_g: totals.protein,
          total_carbs_g: totals.carbs,
          total_fat_g: totals.fat,
        }),
      })

      if (res.ok) {
        // Refetch favorites
        const favRes = await fetch('/api/client/nutrition/favorites')
        if (favRes.ok) {
          const favData = await favRes.json()
          setFavorites(favData.data ?? [])
        }
        setFavoriteName("")
        setShowFavoriteSaveForm(false)
      }
    } catch {
      // silent fail
    } finally {
      setSavingFavorite(false)
    }
  }

  const totals = sumDraftMacros(drafts)

  useEffect(() => {
    onDraftsChange?.({
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      count: drafts.length,
    })
  }, [drafts]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onLayerChange?.(layer)
  }, [layer, onLayerChange])

  const effectiveConsumed = balanceContext
    ? {
        kcal: balanceContext.consumed.kcal + totals.calories,
        protein_g: balanceContext.consumed.protein_g + totals.protein,
        carbs_g: balanceContext.consumed.carbs_g + totals.carbs,
        fat_g: balanceContext.consumed.fat_g + totals.fat,
        water_ml: balanceContext.consumed.water_ml,
      }
    : null
  const selectedMacros = selectedItem ? calcEntryMacros(selectedItem, quantityG) : null
  const actionableRemaining = effectiveConsumed && balanceContext
    ? computeActionableRemaining({
        target: balanceContext.target,
        consumed: effectiveConsumed,
        profile: balanceContext.profile,
      })
    : null
  const remainingTargets = actionableRemaining?.actionableRemaining ?? null
  const informativeRemaining = effectiveConsumed && balanceContext
    ? getRemainingNutritionTargets({
        dailyTargets: balanceContext.target,
        consumedToday: effectiveConsumed,
      })
    : null
  const advisorRemaining = remainingTargets
    ? {
        protein_g: Math.max(0, remainingTargets.protein),
        carbs_g: Math.max(0, remainingTargets.carbs),
        fat_g: Math.max(0, remainingTargets.fat),
      }
    : null
  const quantitySuggestion = selectedItem && advisorRemaining
    ? suggestQuantityForItem(selectedItem, advisorRemaining)
    : null
  const compatibility = selectedItem && advisorRemaining
    ? evaluateFoodCompatibility({
        food: selectedItem,
        remainingTargets: advisorRemaining,
        alternativesPool: items,
      })
    : null
  const previewActionable = selectedMacros && effectiveConsumed && balanceContext
    ? computeActionableRemaining({
        target: balanceContext.target,
        consumed: {
          kcal: effectiveConsumed.kcal + selectedMacros.calories_kcal,
          protein_g: effectiveConsumed.protein_g + selectedMacros.protein_g,
          carbs_g: effectiveConsumed.carbs_g + selectedMacros.carbs_g,
          fat_g: effectiveConsumed.fat_g + selectedMacros.fat_g,
        },
        profile: balanceContext.profile,
      })
    : null
  const previewRemainingTargets = previewActionable?.actionableRemaining ?? null
  const layerTitle =
    layer === "category" ? t('log.title') :
    layer === "subcategory" ? (CATEGORY_LABELS_T[selectedCategory!] ?? "") :
    layer === "item" ? (selectedSubcategory ? (SUBCATEGORY_LABELS_T[selectedSubcategory] ?? "") : "") :
    selectedItem?.name_fr ?? ""

  const topBarH = 56
  const showSearchFirst = false
  const showCategoriesFirst = entryMode === "categories"
  const isTrackSearchOnly = composerMode === "standard" && entryMode === "search"
  const isTrackFavoritesOnly = composerMode === "standard" && entryMode === "favorites"
  const isTrackCategoriesOnly = composerMode === "standard" && entryMode === "categories"
  const isSmartPrepMode = composerMode !== "standard"
  const showFavoritesBlock = favorites.length > 0 && (entryMode === "default" || isTrackFavoritesOnly)
  const showSearchBlock = layer === "item" && !!selectedSubcategory
  const showCategoryBlock = !isTrackFavoritesOnly && !isTrackSearchOnly
  const showPersonalFoodTools = !isTrackFavoritesOnly && !isTrackSearchOnly
  const showSmartSearchBlock = false
  // In smart mode: always show both explore (categories) and library (favorites + personal tools)
  const showSmartExploreBlock = isSmartPrepMode ? true : showCategoryBlock
  const showSmartLibraryBlock = isSmartPrepMode ? true : showFavoritesBlock || showPersonalFoodTools
  const compactSmartQuantity = isSmartPrepMode && layer === "quantity"
  const useCompactDraftDock = embedded && isSmartPrepMode && hideActions

  useEffect(() => {
    if (drafts.length === 0) {
      setDraftExpanded(false)
    }
  }, [drafts.length])

  // Expose handle to parent (ComposeClientPage uses this to save/clear from outside)
  useImperativeHandle(ref, () => ({
    saveMeal: async () => persistMeal(drafts, "composer"),
    savePrep: async () => savePrep(),
    clearDrafts: () => {
      setDrafts([])
      setLayer("category")
      setSelectedCategory(null)
      setSelectedSubcategory(null)
      setSelectedItem(null)
    },
    openVoice: (mode: 'voice' | 'text' = 'voice') => {
      setVoiceInputMode(mode)
      setVoiceOpen(true)
    }
  }), [drafts, prepId, prepScenario?.key, prepScenario?.label, prepDate, prepMealSlot, prepTitle, onSuccess])

  return (
    <div className={embedded ? `flex flex-col bg-[#0d0d0d] ${externalScroll ? '' : 'h-full'}` : "min-h-screen bg-[#0d0d0d] flex flex-col"}>
      {/* TopBar — hidden in embedded mode */}
      {!embedded && (
        <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 bg-[#0a0a0a]">
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

      {/* Embedded sub-header (layer title + back) — shown only when navigated past category layer */}
      {embedded && layer !== "category" && (
        <div className={`flex items-center gap-2 px-4 py-2 shrink-0 ${isSmartPrepMode ? 'border-b border-[#818cf8]/10' : ''}`}>
          <button
            onClick={goBack}
            className={`h-7 w-7 flex items-center justify-center rounded-lg active:scale-95 transition-all ${
              isSmartPrepMode ? 'bg-[#818cf8]/12 text-[#818cf8]' : 'bg-white/[0.06] text-white/50'
            }`}
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-[12px] font-semibold text-white truncate flex-1">{layerTitle}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
            {layer === "subcategory" ? "1/3" : layer === "item" ? "2/3" : "3/3"}
          </p>
        </div>
      )}

      {/* Layers content — min-h-0 requis pour que flex-1 ait une hauteur réelle en embedded */}
      <div
        className={externalScroll ? "relative" : "flex-1 overflow-hidden relative min-h-0"}
        style={{ paddingTop: embedded ? 0 : topBarH }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={layer + (selectedCategory ?? "") + (selectedSubcategory ?? "")}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={externalScroll ? "relative" : "absolute inset-0 overflow-y-auto"}
            style={{ paddingBottom: footerH + 16 }}
          >
            {/* Layer 1: Categories */}
            {layer === "category" && (
              <div className="p-4">
                {composerMode !== "standard" && !externalScroll && (
                  <div
                    className="rounded-2xl p-4 mb-3"
                    style={{
                      background: isSmartPrepMode ? 'rgba(129,140,248,0.07)' : 'rgba(255,255,255,0.04)',
                      border: isSmartPrepMode ? '0.3px solid rgba(129,140,248,0.14)' : 'none',
                    }}
                  >
                    <p
                      className="text-[10px] uppercase tracking-[0.16em] font-bold"
                      style={{ color: isSmartPrepMode ? 'rgba(129,140,248,0.7)' : 'rgba(255,255,255,0.3)' }}
                    >
                      Composer maintenant
                    </p>
                    <p className="text-[12px] text-white/60 mt-1 leading-relaxed">
                      {composerMode === "guide"
                        ? "Choisis un aliment: la portion sera ajustée selon ce qu'il te reste aujourd'hui."
                        : "Teste un aliment et regarde son impact avant de valider."}
                    </p>
                  </div>
                )}
                {remainingTargets && !externalScroll && (
                  <RemainingNutritionSummary
                    remaining={remainingTargets}
                    variant={isSmartPrepMode ? "violet" : "neutral"}
                  />
                )}

                {/* In smart mode: section header for the food picker — voice button lives in parent header */}

                {/* Repas habituels / favoris */}
                {showFavoritesBlock && showSmartLibraryBlock && (
                  <div className="mb-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold mb-2">
                      {isSmartPrepMode ? "Bibliothèque rapide" : entryMode === "favorites" ? "Favoris rapides" : "Repas recents"}
                    </p>
                    <div className="bg-white/[0.04] rounded-2xl overflow-hidden">
                      {favorites.slice(0, 4).map((fav) => (
                        <button
                          key={fav.id}
                          onClick={() => quickLogFavorite(fav)}
                          disabled={saving}
                          className="w-full flex items-center justify-between px-4 py-3 active:scale-[0.98] transition-all hover:bg-white/[0.04] text-left disabled:opacity-50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-white truncate">{fav.name}</p>
                            <p className="text-[11px] text-white/40 mt-1">
                              {Math.round(fav.total_calories ?? 0)} kcal · P {Math.round(fav.total_protein_g ?? 0)} · G {Math.round(fav.total_carbs_g ?? 0)} · L {Math.round(fav.total_fat_g ?? 0)}
                            </p>
                          </div>
                          <span className="text-[10px] text-[#f2f2f2] font-bold ml-2">↗ Ajouter</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isTrackFavoritesOnly && favorites.length === 0 && !loadingFavorites && (
                  <div className="rounded-2xl bg-white/[0.04] px-4 py-8 text-center">
                    <p className="text-[13px] font-semibold text-white">Aucun favori pour le moment</p>
                    <p className="text-[12px] text-white/45 mt-1">Tes repas sauvegardes apparaitront ici.</p>
                  </div>
                )}

                {showSmartSearchBlock && (
                  isSmartPrepMode ? (
                    <div className="mb-2">
                      <QuickSearch onSelect={selectItem} autoFocus={showSearchFirst} smartMode={isSmartPrepMode} />
                    </div>
                  ) : (
                    <div className="rounded-2xl mb-3 bg-white/[0.04] p-4">
                      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold mb-3 text-white/30">
                        {showSearchFirst ? "Recherche d'aliment" : t('log.quickSearch')}
                      </p>
                      <QuickSearch onSelect={selectItem} autoFocus={showSearchFirst} smartMode={isSmartPrepMode} />
                    </div>
                  )
                )}

                {showSmartExploreBlock && (
                  isSmartPrepMode ? (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-2">
                      {(Object.entries(CATEGORY_LABELS_T) as [VisibleCategoryKey, string][]).map(([cat, label]) => (
                        <button
                          key={cat}
                          onClick={() => selectCategory(cat)}
                          className="flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 bg-[#111114] hover:bg-[#818cf8]/10 active:scale-95 transition-all text-[#818cf8] border border-[#818cf8]/10"
                        >
                          <span className="text-base">{CATEGORY_ICONS[cat]}</span>
                          <span className="text-[11px] font-semibold text-white/80">{label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white/[0.04] p-4 mb-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold mb-4 text-white/30">
                        {showCategoriesFirst ? "Choix par categories" : t('log.chooseCategory')}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(CATEGORY_LABELS_T) as [VisibleCategoryKey, string][]).map(([cat, label]) => (
                          <button
                            key={cat}
                            onClick={() => selectCategory(cat)}
                            className="flex flex-col items-center gap-2 rounded-xl p-4 bg-white/[0.06] hover:bg-white/[0.10] active:scale-95 transition-all"
                          >
                            <span className="text-2xl">{CATEGORY_ICONS[cat]}</span>
                            <span className={`text-[11px] font-semibold text-white/80`}>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )}

                {showPersonalFoodTools && showSmartLibraryBlock && (
                  <div className={`space-y-2 ${isSmartPrepMode ? 'mt-2' : ''}`}>
                    {isSmartPrepMode && favorites.length > 0 && (
                      <div className="mb-1">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold mb-2">Favoris rapides</p>
                        <div className="bg-[#111114] rounded-2xl overflow-hidden">
                          {favorites.slice(0, 4).map((fav) => (
                            <button
                              key={fav.id}
                              onClick={() => quickLogFavorite(fav)}
                              disabled={saving}
                              className="w-full flex items-center justify-between px-4 py-3 active:scale-[0.98] transition-all hover:bg-[#818cf8]/8 text-left disabled:opacity-50"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-white truncate">{fav.name}</p>
                                <p className="text-[11px] text-white/40 mt-0.5">
                                  {Math.round(fav.total_calories ?? 0)} kcal · P {Math.round(fav.total_protein_g ?? 0)} · G {Math.round(fav.total_carbs_g ?? 0)} · L {Math.round(fav.total_fat_g ?? 0)}
                                </p>
                              </div>
                              <span className="text-[10px] text-[#818cf8] font-bold ml-2 shrink-0">↗ Ajouter</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setShowCustomForm(v => !v)
                          if (showMyFoods) setShowMyFoods(false)
                          setEditingCustomFood(null)
                        }}
                        className={`w-full flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] active:scale-[0.98] transition-all ${
                          isSmartPrepMode
                            ? (showCustomForm ? 'bg-[#818cf8]/16 text-[#818cf8] font-semibold' : 'bg-[#111114] text-white/50 hover:text-white/80 hover:bg-[#818cf8]/10')
                            : 'bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]'
                        }`}
                      >
                        <Pencil size={13} />
                        {isSmartPrepMode ? 'Créer perso' : t('log.createCustom')}
                      </button>
                      <button
                        onClick={() => {
                          const next = !showMyFoods
                          setShowMyFoods(next)
                          setShowCustomForm(false)
                          setEditingCustomFood(null)
                          if (next) loadMyFoods(myFoodsQuery)
                        }}
                        className={`w-full flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] active:scale-[0.98] transition-all ${
                          isSmartPrepMode
                            ? (showMyFoods ? 'bg-[#818cf8]/16 text-[#818cf8] font-semibold' : 'bg-[#111114] text-white/50 hover:text-white/80 hover:bg-[#818cf8]/10')
                            : 'bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]'
                        }`}
                      >
                        <Search size={13} />
                        {isSmartPrepMode ? 'Ma bibliothèque' : 'Mes aliments'}
                      </button>
                    </div>
                  </div>
                )}
                {showPersonalFoodTools && showCustomForm && <CustomFoodForm onCreated={item => { setShowCustomForm(false); selectItem(item) }} onClose={() => setShowCustomForm(false)} />}
                {showPersonalFoodTools && showMyFoods && (
                  <MyFoodsManager
                    items={myFoods}
                    loading={loadingMyFoods}
                    query={myFoodsQuery}
                    onQueryChange={setMyFoodsQuery}
                    editingItem={editingCustomFood}
                    onEdit={setEditingCustomFood}
                    onEditDone={() => {
                      setEditingCustomFood(null)
                      loadMyFoods(myFoodsQuery)
                    }}
                    onDeleteDone={() => {
                      if (editingCustomFood) setEditingCustomFood(null)
                      loadMyFoods(myFoodsQuery)
                    }}
                    onSelect={selectItem}
                    onClose={() => {
                      setShowMyFoods(false)
                      setEditingCustomFood(null)
                    }}
                  />
                )}
              </div>
            )}

            {/* Layer 2: Subcategories */}
            {layer === "subcategory" && selectedCategory && (
              <div className="p-4">
                <div className={`rounded-2xl overflow-hidden ${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.04]'}`}>
                  {VISIBLE_LEAVES_BY_CATEGORY[selectedCategory].map((sub) => (
                    <button
                      key={sub}
                      onClick={() => selectSubcategory(sub)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 active:scale-[0.99] transition-all ${isSmartPrepMode ? 'hover:bg-[#818cf8]/10' : 'hover:bg-white/[0.04]'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{LEAF_ICONS[sub] ?? "•"}</span>
                        <span className="text-[13px] font-medium text-white">{SUBCATEGORY_LABELS_T[sub] ?? sub}</span>
                      </div>
                      <ChevronLeft size={14} className="text-white/30 rotate-180" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Layer 3: Items */}
            {layer === "item" && (
              <div className="p-4">
                {showSearchBlock && (
                  <div className="mb-3 space-y-2">
                    <div className={`rounded-xl flex items-center px-3 ${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.04]'}`}>
                      <Search size={14} className={`${isSmartPrepMode ? 'text-[#818cf8]' : 'text-white/30'} shrink-0`} />
                      <input
                        type="text"
                        placeholder={t('log.searchPlaceholder2')}
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        className="w-full h-10 pl-2 pr-3 bg-transparent text-[13px] text-white placeholder:text-white/20 outline-none"
                      />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/28 font-semibold px-1">
                      Recherche dans {selectedSubcategory ? (SUBCATEGORY_LABELS_T[selectedSubcategory] ?? selectedSubcategory) : ''}
                    </p>
                  </div>
                )}
                {loadingItems ? (
                  <div className={`space-y-1 rounded-2xl overflow-hidden p-2 ${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.04]'}`}>{[1, 2, 3, 4].map(i => <div key={i} className={`h-12 rounded-xl animate-pulse ${isSmartPrepMode ? 'bg-[#818cf8]/10' : 'bg-white/[0.06]'}`} />)}</div>
                ) : items.length === 0 ? (
                  <p className="text-[12px] text-white/30 text-center py-8">{t('log.noResults')}</p>
                ) : (
                  <div className={`rounded-2xl overflow-hidden ${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.04]'}`}>
                    {items.map((item) => {
                      const kcal = item.kcal_per_100g || 1
                      const pPct = Math.round((item.protein_per_100g * 4 / kcal) * 100)
                      const gPct = Math.round((item.carbs_per_100g * 4 / kcal) * 100)
                      const lPct = Math.round((item.fat_per_100g * 9 / kcal) * 100)
                      const chipSuggestion = (composerMode !== "standard" && advisorRemaining)
                        ? suggestQuantityForItem(item, advisorRemaining)
                        : null
                      return (
                        <button key={item.id} onClick={() => selectItem(item)} className={`w-full flex items-center justify-between px-4 py-3 active:scale-[0.99] transition-all text-left ${isSmartPrepMode ? 'hover:bg-[#818cf8]/10' : 'hover:bg-white/[0.04]'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-white">{item.name_fr}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-white/40">{item.kcal_per_100g} kcal</span>
                              <div className="flex h-[4px] w-[64px] rounded-full overflow-hidden gap-[1px]">
                                <div style={{ width: `${pPct}%`, backgroundColor: NUTRITION_UI_COLORS.protein }} />
                                <div style={{ width: `${gPct}%`, backgroundColor: NUTRITION_UI_COLORS.carbs }} />
                                <div style={{ width: `${lPct}%`, backgroundColor: NUTRITION_UI_COLORS.fat }} />
                              </div>
                              <span className="text-[10px] text-white/25">P·G·L</span>
                            </div>
                          </div>
                          {chipSuggestion ? (
                            <span className="text-[10px] font-bold text-[#818cf8] shrink-0 ml-2 tabular-nums">~{chipSuggestion.grams}g</span>
                          ) : (
                            <span className="text-white/20 text-[11px] shrink-0 ml-2">/ 100g</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Layer 4: Quantity */}
            {layer === "quantity" && selectedItem && (
              <div className="p-4 space-y-4">
                <div className={`flex gap-1 rounded-xl p-0.5 ${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.04]'}`}>
                  {(["grams", "portion"] as const).map(m => (
                    <button key={m} onClick={() => setQMode(m)} className={`flex-1 h-8 text-[11px] font-semibold rounded-xl transition-all ${qMode === m ? (isSmartPrepMode ? "bg-[#818cf8]/16 text-white" : "bg-white/[0.10] text-white") : "text-white/40"}`}>
                      {m === "grams" ? t('log.gramsMode') : t('log.portionMode')}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {compactSmartQuantity && (quantitySuggestion || previewRemainingTargets) && (
                    <div className="bg-[#111114] rounded-[24px] p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-[#818cf8] font-semibold">Decision</p>
                            {prepMealSlot && (
                              <span className="rounded-full bg-[#818cf8]/10 px-2 py-0.5 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#818cf8]/80">
                                {t(`compose.slot.${prepMealSlot}` as any)}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[16px] font-black text-white truncate">{selectedItem.name_fr}</p>
                          <p className="mt-1 text-[12px] text-white/62 leading-relaxed">
                            {quantitySuggestion ? quantitySuggestion.reason : "Ajuste la portion et regarde l'impact reel avant d'ajouter."}
                          </p>
                        </div>
                        <div className="shrink-0 rounded-2xl bg-[#818cf8]/12 px-3 py-2 text-right min-w-[88px]">
                          <p className="text-[18px] font-black text-white leading-none">{quantityG} g</p>
                          <p className="text-[9px] uppercase tracking-[0.12em] text-white/28 mt-1">portion</p>
                        </div>
                      </div>

                      {quantitySuggestion && quantityG !== quantitySuggestion.grams && (
                        <button
                          onClick={() => {
                            applyQuantity(quantitySuggestion.grams)
                            setDidAutoAdjust(true)
                          }}
                          className="h-9 rounded-xl bg-white/[0.06] px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white active:scale-[0.98] transition-all"
                        >
                          Appliquer {quantitySuggestion.grams} g
                        </button>
                      )}

                      {compatibility?.status === "poor_fit" && (
                        <div className="rounded-xl bg-[#ff8660]/10 px-3 py-2">
                          <p className="text-[12px] text-[#ffd7cc] leading-relaxed">{compatibility.reasons[0]}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {selectedMacros && (
                          <div className="rounded-2xl bg-[#818cf8]/10 px-3 py-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-white/28 font-semibold">Pour cette portion</p>
                            <p className="mt-2 text-[18px] font-black text-white">{Math.round(selectedMacros.calories_kcal)} kcal</p>
                            <div className="mt-2 flex gap-3 text-[12px] font-semibold">
                              <span style={{ color: NUTRITION_UI_COLORS.protein }}>P {selectedMacros.protein_g}g</span>
                              <span style={{ color: NUTRITION_UI_COLORS.carbs }}>G {selectedMacros.carbs_g}g</span>
                              <span style={{ color: NUTRITION_UI_COLORS.fat }}>L {selectedMacros.fat_g}g</span>
                            </div>
                          </div>
                        )}
                        {previewRemainingTargets && previewActionable && (
                          <div className="rounded-2xl bg-[#818cf8]/10 px-3 py-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-white/28 font-semibold">Il reste après</p>
                            <div className="mt-2 space-y-1.5 text-[12px]">
                              {([
                                { label: 'Protéines', key: 'protein' as const, color: NUTRITION_UI_COLORS.protein },
                                { label: 'Glucides', key: 'carbs' as const, color: NUTRITION_UI_COLORS.carbs },
                                { label: 'Lipides', key: 'fat' as const, color: NUTRITION_UI_COLORS.fat },
                              ]).map(({ label, key, color }) => {
                                const overflowKey = `${key}_g` as 'protein_g' | 'carbs_g' | 'fat_g'
                                const isOver = previewActionable.overflow[overflowKey] > 0
                                return (
                                  <div key={key} className="flex items-center justify-between">
                                    <span className="text-white/48">{label}</span>
                                    <span
                                      className="font-semibold tabular-nums"
                                      style={{ color: isOver ? '#ef4444' : color }}
                                    >
                                      {isOver
                                        ? `+${Math.round(previewActionable.overflow[overflowKey])}g`
                                        : `${Math.round(previewRemainingTargets[key])}g`}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {composerMode === "guide" && quantitySuggestion && !isSmartPrepMode && (
                    <div className={`${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.05]'} rounded-2xl p-3 space-y-3`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">Guide intelligent</p>
                          <p className="text-[15px] font-black text-white mt-1">Suggestion concrete</p>
                          <p className="text-[12px] text-white/70 mt-1">
                            {quantitySuggestion.grams} g de {selectedItem.name_fr.toLowerCase()} pour avancer surtout sur les {quantitySuggestion.macro}.
                          </p>
                        </div>
                        <div className={`rounded-xl px-3 py-2 text-right shrink-0 ${isSmartPrepMode ? 'bg-[#818cf8]/10' : 'bg-white/[0.03]'}`}>
                          <p className="text-[16px] font-black text-white">{quantitySuggestion.grams} g</p>
                          <p className="text-[9px] text-white/30 uppercase tracking-[0.12em] mt-1">portion cible</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          applyQuantity(quantitySuggestion.grams)
                          setDidAutoAdjust(true)
                        }}
                        className="w-full h-10 rounded-xl bg-[#f2f2f2] text-[#080808] text-[11px] font-bold uppercase tracking-[0.1em] active:scale-[0.98] transition-all"
                      >
                        Appliquer la suggestion
                      </button>
                    </div>
                  )}


                  {quantitySuggestion && !isSmartPrepMode && (
                    <div className={`${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.04]'} rounded-2xl p-3 space-y-2`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">Assistant de portion</p>
                          <p className="text-[12px] text-white/70 mt-1 leading-relaxed">
                            {quantitySuggestion.reason}
                          </p>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-[#f2f2f2]/70 font-bold shrink-0">
                          {quantitySuggestion.macro}
                        </span>
                      </div>
                      {compatibility?.status === "poor_fit" && (
                        <div className="rounded-xl bg-[#ff8660]/10 px-3 py-2">
                          <p className="text-[12px] text-[#ffd7cc] leading-relaxed">
                            {compatibility.reasons[0]}
                          </p>
                          <p className="text-[11px] text-white/60 mt-1">
                            Tu peux l&apos;ajouter manuellement, ou choisir une option plus legere.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <button
                          onClick={() => {
                            applyQuantity(quantitySuggestion.grams)
                            setDidAutoAdjust(true)
                          }}
                          className="col-span-2 h-10 rounded-xl bg-[#f2f2f2] text-[#080808] text-[11px] font-bold uppercase tracking-[0.1em] active:scale-[0.98] transition-all"
                        >
                          Ajuster automatiquement
                        </button>
                        <div className={`col-span-2 rounded-xl px-3 py-2 ${isSmartPrepMode ? 'bg-[#818cf8]/10' : 'bg-white/[0.03]'}`}>
                          <p className="text-[14px] font-black text-white leading-none">{Math.round(quantitySuggestion.preview.kcal)} kcal</p>
                          <p className="text-[9px] text-white/30 uppercase tracking-[0.12em] mt-1">prévu</p>
                        </div>
                      </div>
                      {didAutoAdjust && (
                        <p className="text-[11px] text-white/60">
                          Portion proposee: {quantitySuggestion.grams} g (modifiable).
                        </p>
                      )}
                    </div>
                  )}

                  {didAutoAdjust && selectedItem && composerMode !== "simulation" && !isSmartPrepMode && (
                    <div className={`${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.05]'} rounded-2xl p-3 space-y-3`}>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">Pour completer ta journee</p>
                        <p className="text-[15px] font-black text-white mt-1">Prepare ca</p>
                        <p className="text-[13px] text-white/80 mt-2">
                          - {quantityG} g {selectedItem.name_fr.toLowerCase()}
                        </p>
                        <p className="text-[11px] text-white/60 mt-2">
                          Cela t&apos;aide a completer tes besoins sans surcharger le reste.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          onClick={validateAutoAdjustedMeal}
                          disabled={saving}
                          className="h-10 rounded-xl bg-[#f2f2f2] text-[#080808] text-[11px] font-bold uppercase tracking-[0.1em] active:scale-[0.98] transition-all disabled:opacity-40"
                        >
                          {saving ? "Validation..." : "Valider ce repas"}
                        </button>
                        <button
                          onClick={() => setDidAutoAdjust(false)}
                          className="h-9 rounded-xl bg-white/[0.04] text-white/70 text-[11px] font-semibold active:scale-[0.98] transition-all"
                        >
                          Modifier les quantites
                        </button>
                        <button
                          onClick={() => {
                            setDidAutoAdjust(false)
                            goTo("item", -1)
                          }}
                          className="h-9 rounded-xl bg-white/[0.04] text-white/70 text-[11px] font-semibold active:scale-[0.98] transition-all"
                        >
                          Choisir d&apos;autres aliments
                        </button>
                      </div>
                    </div>
                  )}

                  {previewRemainingTargets && !isSmartPrepMode && (
                    <div className={`${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.03]'} rounded-2xl p-3`}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">Impact instantané</p>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/25 font-semibold">après ajout</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className={`rounded-xl p-2.5 ${isSmartPrepMode ? 'bg-[#818cf8]/10' : 'bg-white/[0.03]'}`}>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/30 font-semibold">Prot.</p>
                          <p className="text-[15px] font-black mt-1" style={{ color: NUTRITION_UI_COLORS.protein }}>
                            {Math.max(0, Math.round(previewRemainingTargets.protein))}g
                          </p>
                        </div>
                        <div className={`rounded-xl p-2.5 ${isSmartPrepMode ? 'bg-[#818cf8]/10' : 'bg-white/[0.03]'}`}>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/30 font-semibold">Gluc.</p>
                          <p className="text-[15px] font-black mt-1" style={{ color: NUTRITION_UI_COLORS.carbs }}>
                            {Math.max(0, Math.round(previewRemainingTargets.carbs))}g
                          </p>
                        </div>
                        <div className={`rounded-xl p-2.5 ${isSmartPrepMode ? 'bg-[#818cf8]/10' : 'bg-white/[0.03]'}`}>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/30 font-semibold">Lip.</p>
                          <p className="text-[15px] font-black mt-1" style={{ color: NUTRITION_UI_COLORS.fat }}>
                            {Math.max(0, Math.round(previewRemainingTargets.fat))}g
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {qMode === "grams" && (
                    <div className="space-y-3">
                      <div className={`${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.03]'} rounded-2xl p-3`}>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/30 font-semibold mb-2">Quantite en grammes</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => applyQuantity(quantityG - 5)}
                            className="h-10 w-10 rounded-xl bg-white/[0.06] text-white/70 flex items-center justify-center"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={quantityInput}
                            onChange={e => handleQuantityInputChange(e.target.value)}
                            onBlur={handleQuantityInputBlur}
                            className={`flex-1 h-10 rounded-xl text-center text-[16px] font-bold text-white outline-none ${isSmartPrepMode ? 'bg-[#818cf8]/10' : 'bg-white/[0.06]'}`}
                          />
                          <button
                            onClick={() => applyQuantity(quantityG + 5)}
                            className="h-10 w-10 rounded-xl bg-white/[0.06] text-white/70 flex items-center justify-center"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {qMode === "portion" && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">{t('log.choosePortion')}</p>
                        {isHandOverrideSet(scalingProfile) && <span className="text-[9px] uppercase tracking-[0.12em] text-[#f2f2f2]/70 font-bold">ajusté à ta main</span>}
                      </div>
                      <div className="flex gap-1 overflow-x-auto pb-1">
                        {PORTION_MULTIPLIERS.map(m => (
                          <button key={m} onClick={() => applyMultiplier(m)} className={`shrink-0 h-8 px-3 rounded-xl text-[11px] font-bold transition-all ${portionMult === m ? "bg-white/[0.10] text-white" : "bg-white/[0.03] text-white/40"}`}>×{m}</button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {PORTION_SIZES.map((p, i) => {
                          const scaledG = getScaledPortionG(p, scalingProfile, portionMult)
                          const isActive = selectedPortion === i && qMode === "portion"
                          return (
                            <button key={p.key} onClick={() => applyPortion(i)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? (isSmartPrepMode ? "bg-[#818cf8]/16" : "bg-white/[0.10]") : (isSmartPrepMode ? "bg-[#111114] hover:bg-[#818cf8]/10" : "bg-white/[0.03] hover:bg-white/[0.06]")}`}>
                              <span className="text-xl shrink-0">{PORTION_ICON_BY_KEY[p.key] ?? "📏"}</span>
                              <div className="text-left flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-white">{p.label}</p>
                                <p className="text-[11px] text-white/35 truncate">{p.description}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`text-[12px] font-bold ${isActive ? "text-[#f2f2f2]" : "text-white/60"}`}>{scaledG}g</span>
                                {portionMult !== 1 && <p className="text-[9px] text-white/30 mt-0.5">{p.baseG}g × {portionMult}</p>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
                {selectedMacros && !isSmartPrepMode && (
                  <div className={`${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.04]'} rounded-xl p-3`}>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold mb-2">{t('log.for', { n: quantityG })}</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div><p className="text-[16px] font-black text-white">{Math.round(selectedMacros.calories_kcal)}</p><p className="text-[9px] text-white/30 uppercase tracking-wide">kcal</p></div>
                      <div><p className="text-[16px] font-black" style={{ color: NUTRITION_UI_COLORS.protein }}>{selectedMacros.protein_g}</p><p className="text-[9px] text-white/30 uppercase tracking-wide">Prot.</p></div>
                      <div><p className="text-[16px] font-black" style={{ color: NUTRITION_UI_COLORS.carbs }}>{selectedMacros.carbs_g}</p><p className="text-[9px] text-white/30 uppercase tracking-wide">Gluc.</p></div>
                      <div><p className="text-[16px] font-black" style={{ color: NUTRITION_UI_COLORS.fat }}>{selectedMacros.fat_g}</p><p className="text-[9px] text-white/30 uppercase tracking-wide">Lip.</p></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky footer */}
      <div
        ref={footerRef}
        className={`${embedded ? "shrink-0" : "fixed bottom-0 left-0 right-0"} z-[60] bg-[#0d0d0d]`}
      >
        {drafts.length > 0 && (
          <div className={`px-4 pt-3 pb-1 ${useCompactDraftDock && !draftExpanded ? '' : 'max-h-[120px] overflow-y-auto'}`}>
            {useCompactDraftDock ? (
              <div className="rounded-2xl bg-[#111114] px-3 py-3">
                <button
                  onClick={() => setDraftExpanded((value) => !value)}
                  className="w-full flex items-center justify-between gap-3 text-left active:scale-[0.99] transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
                      {drafts.length > 1 ? t('log.itemsInMealPlural', { n: drafts.length }) : t('log.itemsInMeal', { n: drafts.length })}
                    </p>
                    <p className="mt-1 text-[12px] text-white/72 truncate">
                      {drafts.map((draft) => draft.food_item.name_fr).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex gap-2 justify-end text-[11px]">
                      <span className="text-white font-bold">{Math.round(totals.calories)} kcal</span>
                      <span style={{ color: NUTRITION_UI_COLORS.protein }}>P{totals.protein}g</span>
                      <span style={{ color: NUTRITION_UI_COLORS.carbs }}>G{totals.carbs}g</span>
                      <span style={{ color: NUTRITION_UI_COLORS.fat }}>L{totals.fat}g</span>
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] uppercase tracking-[0.12em] text-white/24">
                      {draftExpanded ? 'Réduire' : 'Voir le détail'}
                      {draftExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </div>
                  </div>
                </button>
                {draftExpanded && (
                  <div className="mt-3 space-y-1">
                    {drafts.map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                        <span className="text-[12px] text-white/82 flex-1 truncate">{d.food_item.name_fr}</span>
                        <span className="text-[11px] text-white/40 mx-2">{d.quantity_g}g</span>
                        <button onClick={() => removeDraft(i)} className="text-white/20 hover:text-white/60 active:scale-90 transition-all"><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
                    {drafts.length > 1 ? t('log.itemsInMealPlural', { n: drafts.length }) : t('log.itemsInMeal', { n: drafts.length })}
                  </p>
                  <div className="flex gap-2 text-[11px]">
                    <span className="text-white font-bold">{Math.round(totals.calories)} kcal</span>
                    <span style={{ color: NUTRITION_UI_COLORS.protein }}>P{totals.protein}g</span>
                    <span style={{ color: NUTRITION_UI_COLORS.carbs }}>G{totals.carbs}g</span>
                    <span style={{ color: NUTRITION_UI_COLORS.fat }}>L{totals.fat}g</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {drafts.map((d, i) => (
                    <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-1.5 ${isSmartPrepMode ? 'bg-[#111114]' : 'bg-white/[0.03]'}`}>
                      <span className="text-[12px] text-white/80 flex-1 truncate">{d.food_item.name_fr}</span>
                      <span className="text-[11px] text-white/40 mx-2">{d.quantity_g}g</span>
                      <button onClick={() => removeDraft(i)} className="text-white/20 hover:text-white/60 active:scale-90 transition-all"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {(!isTrackFavoritesOnly || drafts.length > 0) && (
        <div
          className="px-4 pt-2 space-y-2"
          style={{ paddingBottom: embedded ? '0.75rem' : 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {layer === "quantity" && selectedItem && (
            <button onClick={addToMeal} disabled={quantityG <= 0} className={`w-full h-11 flex items-center justify-center gap-2 disabled:opacity-40 text-[12px] font-bold uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-all ${isSmartPrepMode ? 'bg-[#818cf8] text-[#080808]' : 'bg-[#f2f2f2] text-black'}`}>
              <Plus size={16} />
              {isSmartPrepMode ? `Ajouter ${quantityG} g` : t('log.addToMeal')}
            </button>
          )}

          {/* Save as favorite section */}
          {!isSmartPrepMode && !showFavoriteSaveForm && drafts.length > 0 && (
            <button
              onClick={() => setShowFavoriteSaveForm(true)}
              className="text-[10px] text-white/40 hover:text-white/70 transition-colors text-center py-1"
            >
              ⭐ Sauvegarder comme favori
            </button>
          )}

          {!isSmartPrepMode && showFavoriteSaveForm && (
            <div className="space-y-2 pb-2">
              <input
                type="text"
                placeholder="Nom du repas..."
                value={favoriteName}
                onChange={e => setFavoriteName(e.target.value)}
                className="w-full h-9 px-3 bg-white/[0.05] rounded-xl text-[12px] text-white placeholder:text-white/20 outline-none "
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowFavoriteSaveForm(false); setFavoriteName("") }}
                  className="flex-1 h-9 bg-white/[0.04] text-white/60 text-[11px] font-semibold rounded-xl hover:bg-white/[0.08] active:scale-95 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={saveFavorite}
                  disabled={!favoriteName.trim() || savingFavorite}
                  className="flex-1 h-9 bg-[#f2f2f2] text-black text-[11px] font-bold rounded-xl hover:bg-[#f2f2f2]/90 disabled:opacity-40 active:scale-95 transition-all"
                >
                  {savingFavorite ? "..." : "Sauvegarder"}
                </button>
              </div>
            </div>
          )}

          {!hideActions && (
            <div className="grid grid-cols-2 gap-2">
              {/* Planifier — crée un prep dans l'onglet Planning */}
              <button
                onClick={savePrep}
                disabled={drafts.length === 0 || savingPrep || saving}
                className="h-11 rounded-xl bg-white/[0.06] text-white/70 disabled:opacity-30 text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] active:scale-[0.98] transition-all"
              >
                {savingPrep ? "…" : "Planifier"}
              </button>
              {/* Logger — enregistre le repas dans Bilan */}
              <button
                onClick={saveMeal}
                disabled={drafts.length === 0 || saving || savingPrep}
                className={`h-11 flex items-center justify-center gap-2 rounded-xl text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] active:scale-[0.98] transition-all ${
                  layer === "quantity" && selectedItem
                    ? "bg-white/[0.08] text-white/60 disabled:opacity-30"
                    : "bg-[#f2f2f2] text-[#080808] disabled:bg-[#f2f2f2]/25 disabled:text-[#080808]/30"
                }`}
              >
                <Check size={14} />
                {saving ? t('log.saving') : existingMealId ? t('log.appendMeal') : t('log.finishMeal')}
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      <VoiceLogSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onSuccess={() => { setVoiceOpen(false); onSuccess?.() }}
        onDraftReady={(entries) => {
          setDrafts((prev) => [...prev, ...entries])
          setVoiceOpen(false)
          setSelectedCategory(null)
          setSelectedSubcategory(null)
          setSelectedItem(null)
          setDirection(-1)
          setLayer("category")
        }}
        mealId={existingMealId ?? undefined}
        initialInputMode={voiceInputMode}
      />
    </div>
  )
}

export const NutritionLogContent = forwardRef(NutritionLogContentImpl)
NutritionLogContent.displayName = "NutritionLogContent"

// ── Recherche rapide ─────────────────────────────────────────
function QuickSearch({ onSelect, autoFocus = false, smartMode = false }: { onSelect: (item: FoodItem) => void; autoFocus?: boolean; smartMode?: boolean }) {
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
        <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${smartMode ? 'text-[#818cf8]' : 'text-white/30'}`} />
        <input autoFocus={autoFocus} type="text" placeholder={t('log.searchPlaceholder')} value={q} onChange={e => setQ(e.target.value)} className={`w-full h-10 pl-9 pr-3 rounded-xl text-[13px] text-white placeholder:text-white/20 outline-none ${smartMode ? 'bg-[#111114]' : 'bg-white/[0.04]'}`} />
      </div>
      {loading && <div className={`h-10 rounded-xl animate-pulse ${smartMode ? 'bg-[#111114]' : 'bg-white/[0.04]'}`} />}
      {results.map(item => (
        <button key={item.id} onClick={() => { setQ(""); setResults([]); onSelect(item) }} className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 mb-1 active:scale-[0.98] transition-all text-left ${smartMode ? 'bg-[#111114] hover:bg-[#818cf8]/10' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}>
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
  const [category, setCategory] = useState<CategoryL1>("extras")
  const [subcategory, setSubcategory] = useState<string>("divers")
  const [kcal, setKcal] = useState("")
  const [prot, setProt] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

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

  useEffect(() => {
    if (!SUBCATEGORIES[category].includes(subcategory)) {
      setSubcategory(SUBCATEGORIES[category][0] ?? "divers")
    }
  }, [category, subcategory])

  async function submit() {
    if (!name.trim() || !kcal) { setError(t('log.custom.requiredError')); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/client/food-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_fr: name.trim(), category_l1: category, category_l2: subcategory,
          kcal_per_100g: parseFloat(kcal) || 0, protein_per_100g: parseFloat(prot) || 0,
          carbs_per_100g: parseFloat(carbs) || 0, fat_per_100g: parseFloat(fat) || 0,
          fiber_per_100g: 0,
        }),
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
    <div className="mt-3 bg-white/[0.04] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">{t('log.custom.title')}</p>
        <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors"><X size={14} /></button>
      </div>
      <input type="text" placeholder={t('log.custom.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white placeholder:text-white/20 outline-none" />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] text-white/30">{t('log.custom.category')}</p>
          <select value={category} onChange={e => setCategory(e.target.value as CategoryL1)} className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none">
            {(Object.entries(CATEGORY_LABELS_T) as [CategoryL1, string][]).map(([value, label]) => (
              <option key={value} value={value} className="bg-[#0d0d0d] text-white">
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-white/30">{t('log.custom.subcategory')}</p>
          <select value={subcategory} onChange={e => setSubcategory(e.target.value)} className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none">
            {SUBCATEGORIES[category].map((value) => (
              <option key={value} value={value} className="bg-[#0d0d0d] text-white">
                {SUBCATEGORY_LABELS_T[value] ?? value}
              </option>
            ))}
          </select>
        </div>
      </div>
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
            <input type="text" inputMode="decimal" value={value} onChange={e => set(e.target.value)} onFocus={e => e.target.select()} className="w-full h-9 px-3 min-w-0 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none" />
          </div>
        ))}
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <button onClick={submit} disabled={saving || !name.trim() || !kcal} className="w-full h-10 flex items-center justify-center gap-2 bg-[#f2f2f2] hover:bg-[#f2f2f2]/90 disabled:opacity-40 text-[#080808] text-[12px] font-bold uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-all">
        <Check size={14} />
        {saving ? t('log.custom.creating') : t('log.custom.createCta')}
      </button>
    </div>
  )
}

function MyFoodsManager({
  items,
  loading,
  query,
  onQueryChange,
  editingItem,
  onEdit,
  onEditDone,
  onDeleteDone,
  onSelect,
  onClose,
}: {
  items: CustomFoodCatalogItem[]
  loading: boolean
  query: string
  onQueryChange: (value: string) => void
  editingItem: CustomFoodCatalogItem | null
  onEdit: (item: CustomFoodCatalogItem | null) => void
  onEditDone: () => void
  onDeleteDone: () => void
  onSelect: (item: FoodItem) => void
  onClose: () => void
}) {
  const { t } = useClientT()
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState("")

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

  async function handleDelete(item: CustomFoodCatalogItem) {
    setBusyDeleteId(item.id)
    setDeleteError("")
    try {
      const res = await fetch(`/api/client/food-items?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(json.error ?? "Impossible de supprimer cet aliment pour le moment.")
        return
      }
      onDeleteDone()
    } catch {
      setDeleteError("Erreur reseau pendant la suppression.")
    } finally {
      setBusyDeleteId(null)
    }
  }

  return (
    <div className="mt-3 bg-white/[0.04] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">Mes aliments</p>
          <p className="text-[12px] text-white/55 mt-1">Retrouve, reclasse, modifie ou supprime tes aliments personnalises.</p>
        </div>
        <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Rechercher dans mes aliments"
          className="w-full h-10 pl-9 pr-3 bg-white/[0.06] rounded-xl text-[13px] text-white placeholder:text-white/20 outline-none"
        />
      </div>

      {deleteError && <p className="text-[11px] text-red-400">{deleteError}</p>}

      {editingItem && (
        <EditableCustomFoodForm
          item={editingItem}
          onCancel={() => onEdit(null)}
          onSaved={onEditDone}
        />
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(index => (
            <div key={index} className="h-16 bg-white/[0.06] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white/[0.03] px-4 py-5 text-center">
          <p className="text-[12px] text-white/60">Aucun aliment perso trouve.</p>
          <p className="text-[11px] text-white/35 mt-1">Essaie par nom, ou recree-le avec une categorie si besoin.</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] rounded-2xl overflow-hidden">
          {items.map((item) => (
            <div
              key={item.id}
              className="px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white">{item.name_fr}</p>
                  <p className="text-[11px] text-white/40 mt-1">
                    {CATEGORY_LABELS_T[item.category_l1]} · {item.category_l2 ? (SUBCATEGORY_LABELS_T[item.category_l2] ?? item.category_l2) : "Sans sous-categorie"}
                  </p>
                  <p className="text-[11px] text-white/30 mt-1">
                    {Math.round(item.kcal_per_100g)} kcal · P {item.protein_per_100g} · G {item.carbs_per_100g} · L {item.fat_per_100g}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSelect(item)}
                    className="h-8 px-3 rounded-xl bg-white/[0.06] text-[11px] font-semibold text-white/80 active:scale-95 transition-all"
                  >
                    Ajouter
                  </button>
                  <button
                    onClick={() => onEdit(item)}
                    className="h-8 w-8 rounded-xl bg-white/[0.06] text-white/60 flex items-center justify-center active:scale-95 transition-all"
                    aria-label={`Modifier ${item.name_fr}`}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={busyDeleteId === item.id}
                    className="h-8 w-8 rounded-xl bg-[#ff8660]/10 text-[#ffb39a] flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
                    aria-label={`Supprimer ${item.name_fr}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EditableCustomFoodForm({
  item,
  onCancel,
  onSaved,
}: {
  item: CustomFoodCatalogItem
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useClientT()
  const [name, setName] = useState(item.name_fr)
  const [category, setCategory] = useState<CategoryL1>(item.category_l1)
  const [subcategory, setSubcategory] = useState<string>(item.category_l2 ?? SUBCATEGORIES[item.category_l1][0] ?? "divers")
  const [kcal, setKcal] = useState(String(item.kcal_per_100g ?? ""))
  const [prot, setProt] = useState(String(item.protein_per_100g ?? ""))
  const [carbs, setCarbs] = useState(String(item.carbs_per_100g ?? ""))
  const [fat, setFat] = useState(String(item.fat_per_100g ?? ""))
  const [fiber, setFiber] = useState(String(item.fiber_per_100g ?? "0"))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

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

  useEffect(() => {
    setName(item.name_fr)
    setCategory(item.category_l1)
    setSubcategory(item.category_l2 ?? SUBCATEGORIES[item.category_l1][0] ?? "divers")
    setKcal(String(item.kcal_per_100g ?? ""))
    setProt(String(item.protein_per_100g ?? ""))
    setCarbs(String(item.carbs_per_100g ?? ""))
    setFat(String(item.fat_per_100g ?? ""))
    setFiber(String(item.fiber_per_100g ?? "0"))
    setError("")
  }, [item])

  useEffect(() => {
    if (!SUBCATEGORIES[category].includes(subcategory)) {
      setSubcategory(SUBCATEGORIES[category][0] ?? "divers")
    }
  }, [category, subcategory])

  async function submit() {
    if (!name.trim() || !kcal) {
      setError(t('log.custom.requiredError'))
      return
    }

    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/client/food-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          name_fr: name.trim(),
          category_l1: category,
          category_l2: subcategory,
          kcal_per_100g: parseFloat(kcal) || 0,
          protein_per_100g: parseFloat(prot) || 0,
          carbs_per_100g: parseFloat(carbs) || 0,
          fat_per_100g: parseFloat(fat) || 0,
          fiber_per_100g: parseFloat(fiber) || 0,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Impossible de mettre a jour cet aliment.")
        return
      }
      onSaved()
    } catch {
      setError("Erreur reseau pendant la mise a jour.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">Modifier cet aliment</p>
          <p className="text-[12px] text-white/55 mt-1">Tu peux le renommer, le recategoriser ou corriger ses macros.</p>
        </div>
        <button onClick={onCancel} className="text-white/20 hover:text-white/60 transition-colors">
          <X size={14} />
        </button>
      </div>

      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] text-white/30">{t('log.custom.category')}</p>
          <select value={category} onChange={e => setCategory(e.target.value as CategoryL1)} className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none">
            {(Object.entries(CATEGORY_LABELS_T) as [CategoryL1, string][]).map(([value, label]) => (
              <option key={value} value={value} className="bg-[#0d0d0d] text-white">
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-white/30">{t('log.custom.subcategory')}</p>
          <select value={subcategory} onChange={e => setSubcategory(e.target.value)} className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none">
            {SUBCATEGORIES[category].map((value) => (
              <option key={value} value={value} className="bg-[#0d0d0d] text-white">
                {SUBCATEGORY_LABELS_T[value] ?? value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: t('log.custom.calories'), value: kcal, set: setKcal, required: true },
          { label: t('log.custom.protein'), value: prot, set: setProt, required: false },
          { label: t('log.custom.carbs'), value: carbs, set: setCarbs, required: false },
          { label: t('log.custom.fat'), value: fat, set: setFat, required: false },
          { label: "Fibres", value: fiber, set: setFiber, required: false },
        ].map(({ label, value, set, required }) => (
          <div key={label} className="space-y-1">
            <p className="text-[10px] text-white/30">{label}{required && " *"}</p>
            <input type="text" inputMode="decimal" value={value} onChange={e => set(e.target.value)} onFocus={e => e.target.select()} className="w-full h-9 px-3 min-w-0 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none" />
          </div>
        ))}
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onCancel}
          className="h-10 rounded-xl bg-white/[0.04] text-white/70 text-[12px] font-semibold active:scale-[0.98] transition-all"
        >
          Annuler
        </button>
        <button
          onClick={submit}
          disabled={saving || !name.trim() || !kcal}
          className="h-10 flex items-center justify-center gap-2 bg-[#f2f2f2] disabled:opacity-40 text-[#080808] text-[12px] font-bold uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-all"
        >
          <Check size={14} />
          {saving ? "Mise a jour..." : "Enregistrer"}
        </button>
      </div>
    </div>
  )
}
