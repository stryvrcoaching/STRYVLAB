"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { resetBodyScrollLock } from "@/components/client/useBodyScrollLock";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Search,
  Plus,
  Minus,
  Check,
  X,
  Pencil,
  Trash2,
  Mic,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";

const VoiceLogSheet = dynamic(
  () => import("@/components/client/smart/VoiceLogSheet"),
  { ssr: false },
);
import type {
  CategoryL1,
  EntryDraft,
  FoodItem,
} from "@/lib/nutrition/food-items";
import { FoodIcon } from "@/components/nutrition/FoodIcon";
import {
  PORTION_SIZES,
  PORTION_MULTIPLIERS,
  calcEntryMacros,
  getScaledPortionG,
  isHandOverrideSet,
  sumDraftMacros,
  type PortionScalingProfile,
} from "@/lib/nutrition/food-items";
import { useClientT } from "@/components/client/ClientI18nProvider";
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors";
import { suggestQuantityForItem } from "@/lib/nutrition/compose-advisor";
import { computeActionableRemaining } from "@/lib/nutrition/actionable-remaining";
import RemainingNutritionSummary from "@/components/client/nutrition/RemainingNutritionSummary";
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget";
import {
  matchesVisibleLeaf,
  sortVisibleLeafItems,
  type VisibleCategoryKey,
  type VisibleLeafKey,
} from "@/lib/nutrition/food-taxonomy";
import { queueNutritionLiveRefresh } from "@/lib/client/nutrition-live";
import { sendClientMutation } from "@/lib/client/offline-mutations";
import type { ClientLang } from "@/lib/i18n/clientTranslations";
import { constructLoggedAt } from "@/lib/nutrition/physiological-date";

type ClientTranslate = ReturnType<typeof useClientT>["t"];

function buildVisibleCategoryLabels(
  t: ClientTranslate,
): Record<VisibleCategoryKey, string> {
  return {
    proteins: t("food.cat.proteins"),
    carbs: t("food.cat.carbs"),
    fats: t("food.cat.fats"),
    vegetables: t("food.cat.vegetables"),
    drinks: t("food.cat.drinks"),
    supplements: t("food.sub.complements"),
  };
}

function buildVisibleLeafLabels(
  lang: ClientLang,
  t: ClientTranslate,
): Record<VisibleLeafKey, string> {
  return {
    chicken: lang === "es" ? "Pollo" : lang === "en" ? "Chicken" : "Poulet",
    beef: lang === "es" ? "Ternera" : lang === "en" ? "Beef" : "Boeuf",
    pork: lang === "es" ? "Cerdo" : lang === "en" ? "Pork" : "Porc",
    turkey: lang === "es" ? "Pavo" : lang === "en" ? "Turkey" : "Dinde",
    fish: t("food.sub.poissons"),
    seafood:
      lang === "es" ? "Mariscos" : lang === "en" ? "Seafood" : "Fruits de mer",
    eggs: t("food.sub.oeufs"),
    "dairy-protein": t("food.sub.laitiers"),
    "plant-protein": t("food.sub.vegetales"),
    charcuterie:
      lang === "es" ? "Embutidos" : lang === "en" ? "Cold cuts" : "Charcuterie",
    "other-proteins":
      lang === "es"
        ? "Otras proteínas"
        : lang === "en"
          ? "Other proteins"
          : "Autres protéines",
    rice: lang === "es" ? "Arroz" : lang === "en" ? "Rice" : "Riz",
    pasta: lang === "es" ? "Pasta" : lang === "en" ? "Pasta" : "Pâtes",
    bread: t("food.sub.pain"),
    cereals: t("food.sub.cereales"),
    potatoes:
      lang === "es"
        ? "Patatas"
        : lang === "en"
          ? "Potatoes"
          : "Pommes de terre",
    legumes: t("food.sub.legumineuses"),
    "fresh-fruits": t("food.sub.frais"),
    "dried-fruits": t("food.sub.secs"),
    "sweet-products":
      lang === "es"
        ? "Productos dulces"
        : lang === "en"
          ? "Sweet products"
          : "Produits sucrés",
    "sweet-sauces":
      lang === "es"
        ? "Salsas dulces"
        : lang === "en"
          ? "Sweet sauces"
          : "Sauces sucrées",
    oils: t("food.sub.huiles"),
    "nuts-seeds": t("food.sub.noix-graines"),
    "avocado-olives":
      lang === "es"
        ? "Aguacate y aceitunas"
        : lang === "en"
          ? "Avocado & olives"
          : "Avocat & olives",
    "butter-spreads":
      lang === "es"
        ? "Mantequillas y untables"
        : lang === "en"
          ? "Butters & spreads"
          : "Beurres & tartinables",
    "nut-butters":
      lang === "es"
        ? "Cremas de frutos secos"
        : lang === "en"
          ? "Nut butters"
          : "Purées d'oléagineux",
    "fatty-sauces":
      lang === "es"
        ? "Salsas grasas"
        : lang === "en"
          ? "Fatty sauces"
          : "Sauces grasses",
    leafy: t("food.sub.feuilles"),
    cruciferous: t("food.sub.cruciferes"),
    roots:
      lang === "es"
        ? "Verduras de raíz"
        : lang === "en"
          ? "Root vegetables"
          : "Légumes racines",
    mediterranean:
      lang === "es"
        ? "Verduras mediterráneas"
        : lang === "en"
          ? "Mediterranean vegetables"
          : "Légumes méditerranéens",
    "other-vegetables": t("food.sub.autres-legumes"),
    water: t("food.sub.eau"),
    "hot-drinks": t("food.sub.chauds"),
    "juices-smoothies": t("food.sub.jus-smoothies"),
    sodas: lang === "es" ? "Refrescos" : lang === "en" ? "Sodas" : "Sodas",
    "plant-milks": t("food.sub.laits-vegetaux"),
    "sports-drinks": t("food.sub.sports-drinks"),
    alcohol: t("food.sub.alcools"),
    whey:
      lang === "es"
        ? "Whey y proteínas"
        : lang === "en"
          ? "Whey & protein"
          : "Whey & protéines",
    "gainers-bars":
      lang === "es"
        ? "Gainers y barritas"
        : lang === "en"
          ? "Gainers & bars"
          : "Gainers & barres",
    performance:
      lang === "es"
        ? "Creatina y rendimiento"
        : lang === "en"
          ? "Creatine & performance"
          : "Créatine & performance",
    "other-supplements":
      lang === "es"
        ? "Otros suplementos"
        : lang === "en"
          ? "Other supplements"
          : "Autres compléments",
  };
}

function getCompactCustomFoodLabel(lang: ClientLang) {
  if (lang === "en") return "Custom food";
  if (lang === "es") return "Alimento propio";
  return "Aliment perso";
}

function logPerfTrace(label: string, startedAt: number, response: Response) {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "development")
    return;
  const elapsedMs = Math.round(performance.now() - startedAt);
  const serverTiming = response.headers.get("server-timing");
  const serverPerf = response.headers.get("x-stryv-perf");
  console.info(`[perf] ${label}: ${elapsedMs}ms`, {
    serverTiming,
    serverPerf,
  });
}

// ─── Icônes catégories ───────────────────────────────────────
const CATEGORY_ICON_KEYS: Record<VisibleCategoryKey, string> = {
  proteins: "protein",
  carbs: "carbs",
  fats: "fats",
  vegetables: "vegetables",
  drinks: "water-bottle",
  supplements: "whey",
};

const LEAF_ICON_KEYS: Record<VisibleLeafKey, string> = {
  chicken: "chicken",
  beef: "beef",
  pork: "pork-chop",
  turkey: "turkey",
  fish: "salmon",
  seafood: "shrimp",
  eggs: "egg",
  "dairy-protein": "greek-yogurt",
  "plant-protein": "tofu",
  charcuterie: "bacon",
  "other-proteins": "steak",
  rice: "rice",
  pasta: "pasta",
  bread: "bread",
  cereals: "cereal",
  potatoes: "potato",
  legumes: "lentils",
  "fresh-fruits": "apple",
  "dried-fruits": "grapes",
  "sweet-products": "honey",
  "sweet-sauces": "jam",
  oils: "olive-oil",
  "nuts-seeds": "almonds",
  "avocado-olives": "avocado",
  "butter-spreads": "butter",
  "nut-butters": "peanut-butter",
  "fatty-sauces": "mayonnaise",
  leafy: "spinach",
  cruciferous: "broccoli",
  roots: "carrot",
  mediterranean: "eggplant",
  "other-vegetables": "salad",
  water: "water-bottle",
  "hot-drinks": "coffee",
  "juices-smoothies": "orange",
  sodas: "diet-soda",
  "plant-milks": "milk-carton",
  "sports-drinks": "energy-drink",
  alcohol: "grapes",
  whey: "whey",
  "gainers-bars": "granola-bar",
  performance: "creatine",
  "other-supplements": "capsules",
};

const PORTION_ICON_BY_KEY: Record<string, string> = {
  palm: "🤚",
  "half-palm": "✋",
  fist: "✊",
  "fist-dry": "👊",
  thumb: "👍",
  pinch: "🤏",
  "cupped-hands": "🙌",
  "bowl-hands": "🥣",
  tbsp: "🥄",
  "tbsp-heaped": "🥄",
  tsp: "☕",
  plate: "🍽️",
  "bread-slice": "🍞",
  "egg-medium": "🥚",
  glass: "🥛",
};

const VISIBLE_LEAVES_BY_CATEGORY: Record<VisibleCategoryKey, VisibleLeafKey[]> =
  {
    proteins: [
      "chicken",
      "beef",
      "pork",
      "turkey",
      "fish",
      "seafood",
      "eggs",
      "dairy-protein",
      "plant-protein",
      "charcuterie",
      "other-proteins",
    ],
    carbs: [
      "rice",
      "pasta",
      "bread",
      "cereals",
      "potatoes",
      "legumes",
      "fresh-fruits",
      "dried-fruits",
      "sweet-products",
      "sweet-sauces",
    ],
    fats: [
      "oils",
      "nuts-seeds",
      "avocado-olives",
      "butter-spreads",
      "nut-butters",
      "fatty-sauces",
    ],
    vegetables: [
      "leafy",
      "cruciferous",
      "roots",
      "mediterranean",
      "other-vegetables",
    ],
    drinks: [
      "water",
      "hot-drinks",
      "juices-smoothies",
      "sodas",
      "plant-milks",
      "sports-drinks",
      "alcohol",
    ],
    supplements: ["whey", "gainers-bars", "performance", "other-supplements"],
  };

const CATEGORY_FETCH_SCOPE: Record<VisibleCategoryKey, string[]> = {
  proteins: ["proteins", "extras"],
  carbs: ["carbs", "fruits", "extras"],
  fats: ["fats", "extras"],
  vegetables: ["vegetables"],
  drinks: ["drinks", "extras"],
  supplements: ["proteins", "extras"],
};

const CUSTOM_FOOD_VISIBLE_CATEGORIES: VisibleCategoryKey[] = [
  "proteins",
  "carbs",
  "fats",
  "vegetables",
  "drinks",
  "supplements",
];

const STORAGE_CATEGORY_BY_VISIBLE_LEAF: Record<
  VisibleLeafKey,
  { category_l1: CategoryL1; category_l2: string | null }
> = {
  chicken: { category_l1: "proteins", category_l2: "viandes" },
  beef: { category_l1: "proteins", category_l2: "viandes" },
  pork: { category_l1: "proteins", category_l2: "viandes" },
  turkey: { category_l1: "proteins", category_l2: "viandes" },
  fish: { category_l1: "proteins", category_l2: "poissons" },
  seafood: { category_l1: "proteins", category_l2: "poissons" },
  eggs: { category_l1: "proteins", category_l2: "oeufs" },
  "dairy-protein": { category_l1: "proteins", category_l2: "laitiers" },
  "plant-protein": { category_l1: "proteins", category_l2: "vegetales" },
  charcuterie: { category_l1: "proteins", category_l2: "viandes" },
  "other-proteins": { category_l1: "proteins", category_l2: "viandes" },
  rice: { category_l1: "carbs", category_l2: "cereales" },
  pasta: { category_l1: "carbs", category_l2: "cereales" },
  bread: { category_l1: "carbs", category_l2: "pain" },
  cereals: { category_l1: "carbs", category_l2: "cereales" },
  potatoes: { category_l1: "carbs", category_l2: "fecules" },
  legumes: { category_l1: "carbs", category_l2: "legumineuses" },
  "fresh-fruits": { category_l1: "fruits", category_l2: "frais" },
  "dried-fruits": { category_l1: "fruits", category_l2: "secs" },
  "sweet-products": { category_l1: "extras", category_l2: "snacks-sucres" },
  "sweet-sauces": { category_l1: "extras", category_l2: "sauces" },
  oils: { category_l1: "fats", category_l2: "huiles" },
  "nuts-seeds": { category_l1: "fats", category_l2: "noix-graines" },
  "avocado-olives": { category_l1: "fats", category_l2: "autres-lipides" },
  "butter-spreads": { category_l1: "fats", category_l2: "autres-lipides" },
  "nut-butters": { category_l1: "fats", category_l2: "noix-graines" },
  "fatty-sauces": { category_l1: "extras", category_l2: "sauces" },
  leafy: { category_l1: "vegetables", category_l2: "feuilles" },
  cruciferous: { category_l1: "vegetables", category_l2: "cruciferes" },
  roots: { category_l1: "vegetables", category_l2: "autres-legumes" },
  mediterranean: { category_l1: "vegetables", category_l2: "autres-legumes" },
  "other-vegetables": {
    category_l1: "vegetables",
    category_l2: "autres-legumes",
  },
  water: { category_l1: "drinks", category_l2: "eau" },
  "hot-drinks": { category_l1: "drinks", category_l2: "chauds" },
  "juices-smoothies": { category_l1: "drinks", category_l2: "jus-smoothies" },
  sodas: { category_l1: "extras", category_l2: "boissons" },
  "plant-milks": { category_l1: "drinks", category_l2: "laits-vegetaux" },
  "sports-drinks": { category_l1: "drinks", category_l2: "sports-drinks" },
  alcohol: { category_l1: "drinks", category_l2: "alcools" },
  whey: { category_l1: "proteins", category_l2: "complements" },
  "gainers-bars": { category_l1: "proteins", category_l2: "complements" },
  performance: { category_l1: "proteins", category_l2: "complements" },
  "other-supplements": { category_l1: "proteins", category_l2: "complements" },
};

function getDefaultVisibleLeaf(category: VisibleCategoryKey): VisibleLeafKey {
  return VISIBLE_LEAVES_BY_CATEGORY[category][0];
}

function getStorageCategoryFromVisibleLeaf(leaf: VisibleLeafKey) {
  return STORAGE_CATEGORY_BY_VISIBLE_LEAF[leaf];
}

function resolveVisibleSelection(
  item: Pick<FoodItem, "category_l1" | "category_l2" | "name_fr">,
): {
  category: VisibleCategoryKey;
  leaf: VisibleLeafKey;
} {
  const matchableItem: FoodItem = {
    id: "custom-food-visible-selection",
    item_key: "custom-food-visible-selection",
    icon_key: null,
    kcal_per_100g: 0,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 0,
    fiber_per_100g: 0,
    source: "user",
    is_verified: false,
    ...item,
  };

  for (const category of CUSTOM_FOOD_VISIBLE_CATEGORIES) {
    const matchedLeaf = VISIBLE_LEAVES_BY_CATEGORY[category].find((leaf) =>
      matchesVisibleLeaf(matchableItem, leaf),
    );
    if (matchedLeaf) return { category, leaf: matchedLeaf };
  }

  switch (item.category_l1) {
    case "proteins":
      return {
        category: "supplements",
        leaf:
          item.category_l2 === "complements"
            ? "other-supplements"
            : "other-proteins",
      };
    case "carbs":
      return {
        category: "carbs",
        leaf:
          item.category_l2 === "pain"
            ? "bread"
            : item.category_l2 === "legumineuses"
              ? "legumes"
              : "cereals",
      };
    case "fruits":
      return {
        category: "carbs",
        leaf: item.category_l2 === "secs" ? "dried-fruits" : "fresh-fruits",
      };
    case "fats":
      return {
        category: "fats",
        leaf:
          item.category_l2 === "huiles"
            ? "oils"
            : item.category_l2 === "noix-graines"
              ? "nuts-seeds"
              : "avocado-olives",
      };
    case "vegetables":
      return {
        category: "vegetables",
        leaf:
          item.category_l2 === "feuilles"
            ? "leafy"
            : item.category_l2 === "cruciferes"
              ? "cruciferous"
              : "other-vegetables",
      };
    case "drinks":
      return {
        category: "drinks",
        leaf:
          item.category_l2 === "eau"
            ? "water"
            : item.category_l2 === "chauds"
              ? "hot-drinks"
              : item.category_l2 === "jus-smoothies"
                ? "juices-smoothies"
                : item.category_l2 === "laits-vegetaux"
                  ? "plant-milks"
                  : item.category_l2 === "sports-drinks"
                    ? "sports-drinks"
                    : item.category_l2 === "alcools"
                      ? "alcohol"
                      : "water",
      };
    case "extras":
      if (item.category_l2 === "boissons")
        return { category: "drinks", leaf: "sodas" };
      if (item.category_l2 === "sauces")
        return { category: "fats", leaf: "fatty-sauces" };
      if (item.category_l2 === "snacks-sucres")
        return { category: "carbs", leaf: "sweet-products" };
      return { category: "proteins", leaf: "other-proteins" };
    default:
      return { category: "proteins", leaf: "other-proteins" };
  }
}
type Layer = "category" | "subcategory" | "item" | "quantity";
type SelectionPath = "browse" | "quick";
export type NutritionLogLayer = Layer;
type MealSource =
  | "manual"
  | "voice"
  | "text"
  | "composer"
  | "auto_adjusted"
  | "flash_estimate";
type SmartComposeSurface = "explore" | "library";

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

function inferCategoryFromMacros(entry: {
  name_fr?: string | null;
  calories_kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
}): CategoryL1 {
  const protein = Number(entry.protein_g ?? 0);
  const carbs = Number(entry.carbs_g ?? 0);
  const fat = Number(entry.fat_g ?? 0);
  const calories = Number(entry.calories_kcal ?? 0);
  const name = (entry.name_fr ?? "").toLowerCase();

  if (
    name.includes("eau") ||
    name.includes("water") ||
    name.includes("café") ||
    name.includes("cafe") ||
    name.includes("thé") ||
    name.includes("the")
  ) {
    return "drinks";
  }

  if (
    name.includes("huile") ||
    name.includes("beurre") ||
    name.includes("peanut butter") ||
    name.includes("cacahu")
  ) {
    return "fats";
  }

  if (protein >= carbs && protein >= fat && protein >= 8) {
    return "proteins";
  }

  if (fat > protein && fat >= carbs && fat >= 8) {
    return "fats";
  }

  if (carbs >= protein && carbs >= fat && carbs >= 8) {
    return "carbs";
  }

  if (calories <= 120 && protein <= 6 && carbs <= 12 && fat <= 4) {
    return "vegetables";
  }

  return "carbs";
}

interface FavoriteMeal {
  id: string;
  name: string;
  entries: any[];
  total_calories: number | null;
  total_protein_g: number | null;
  total_carbs_g: number | null;
  total_fat_g: number | null;
  use_count: number;
  last_used_at: string;
}

interface CustomFoodCatalogItem extends FoodItem {
  client_id?: string | null;
}

export interface NutritionLogContentHandle {
  saveMeal: () => Promise<boolean>;
  savePrep: () => Promise<boolean>;
  clearDrafts: () => void;
  openVoice?: (mode?: "voice" | "text") => void;
}

export interface NutritionLogContentProps {
  onSuccess?: () => void;
  /** When true, renders without the fixed TopBar (used inside MealLogSheet which has its own header) */
  embedded?: boolean;
  /** Pre-select a meal to add items to (overrides ?meal_id search param) */
  mealId?: string | null;
  /** Existing Smart Nutrition Prep to update instead of creating a new one */
  prepId?: string | null;
  prepScenario?: {
    key: string;
    label: string;
  };
  initialPrepEntries?: Array<{
    food_item_id: string;
    name_fr: string;
    quantity_g: number;
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
  }>;
  /** Runtime behavior from meal method selector */
  composerMode?: "standard" | "guide" | "simulation";
  /** Preferred starting emphasis when tracking an already eaten meal */
  entryMode?: "default" | "search" | "favorites" | "categories";
  /** Current day balance used to propose an automatic quantity */
  balanceContext?: {
    consumed: NutritionMacros;
    target: NutritionMacros;
    profile?: {
      gender?: string | null;
      weightKg?: number | null;
    };
  };
  /** When true, suppresses internal save/log buttons — parent controls actions via ref */
  hideActions?: boolean;
  /** Called whenever draft totals change — use to drive external simulation views */
  onDraftsChange?: (totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    count: number;
  }) => void;
  /** Live preview including the selected item before it is added to the meal */
  onLiveTotalsChange?: (totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    count: number;
    pendingItemName: string | null;
    pendingQuantityG: number | null;
  }) => void;
  /** When true, parent page owns scrolling and this component expands naturally */
  externalScroll?: boolean;
  /** Exposes current navigation depth so parent containers can compact surrounding chrome */
  onLayerChange?: (layer: NutritionLogLayer) => void;
  onHeaderCollapseChange?: (collapsed: boolean) => void;
  /** Compose date (ISO YYYY-MM-DD) — used when saving preps to set the correct physiological_date */
  prepDate?: string | null;
  /** Meal slot for this prep (breakfast/lunch/dinner/snack) — parent sets via slot picker */
  prepMealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
  /** Optional prep title — displayed in coach view and prep list */
  prepTitle?: string | null;
  /** Called when the parent wants to open the voice/text log — used in embedded smart mode where mic lives in parent header */
  onVoiceOpen?: () => void;
  /** Opens the photo-guided scanner from the add-meal flow */
  onPhotoScanOpen?: () => void;
}

function NutritionLogContentImpl(
  {
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
    onLiveTotalsChange,
    externalScroll = false,
    onLayerChange,
    onHeaderCollapseChange,
    prepDate,
    prepMealSlot,
    prepTitle,
    onVoiceOpen,
    onPhotoScanOpen,
  }: NutritionLogContentProps,
  ref: ForwardedRef<NutritionLogContentHandle>,
) {
  const { lang, t } = useClientT();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceInputMode, setVoiceInputMode] = useState<"voice" | "text">(
    "voice",
  );
  const initialVoiceInputOpenedRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const CATEGORY_LABELS_T = buildVisibleCategoryLabels(t);
  const SUBCATEGORY_LABELS_T = buildVisibleLeafLabels(lang, t);
  const compactCustomFoodLabel = getCompactCustomFoodLabel(lang);

  const existingMealId = mealIdProp ?? searchParams?.get("meal_id");
  const activeDate =
    prepDate ??
    searchParams?.get("date") ??
    new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (initialVoiceInputOpenedRef.current) return;
    const requestedInput = searchParams?.get("input");
    if (requestedInput !== "voice" && requestedInput !== "text") return;
    initialVoiceInputOpenedRef.current = true;
    setVoiceInputMode(requestedInput);
    setVoiceOpen(true);
  }, [searchParams]);

  const queryClient = useQueryClient();
  const FAVORITES_QUERY_KEY = ["nutrition-favorites"] as const;

  // useQuery remplace le useState + fetch manuel pour les favoris
  const { data: favoritesData, isFetching: loadingFavorites } = useQuery<FavoriteMeal[]>({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/client/nutrition/favorites");
      if (!r.ok) return [];
      const d = await r.json();
      return d?.data ?? [];
    },
    enabled: entryMode !== "search",  // ne pas fetcher en mode recherche pure
    staleTime: 5 * 60 * 1000,         // 5 minutes
    gcTime: 24 * 60 * 60 * 1000,      // 24h
    placeholderData: [],
  });
  const favorites = favoritesData ?? [];

  const [savingFavorite, setSavingFavorite] = useState(false);
  const [deletingFavoriteId, setDeletingFavoriteId] = useState<string | null>(
    null,
  );
  const [savingPrep, setSavingPrep] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [showFavoriteSaveForm, setShowFavoriteSaveForm] = useState(false);
  const [editingFavoriteId, setEditingFavoriteId] = useState<string | null>(
    null,
  );

  const [layer, setLayer] = useState<Layer>("category");
  const [direction, setDirection] = useState(1);
  const [selectedCategory, setSelectedCategory] =
    useState<VisibleCategoryKey | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<VisibleLeafKey | null>(null);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [selectionPath, setSelectionPath] = useState<SelectionPath>("browse");
  const [searchQ, setSearchQ] = useState("");
  const [qMode, setQMode] = useState<"grams" | "portion">("grams");
  const [quantityG, setQuantityG] = useState<number>(100);
  const [quantityInput, setQuantityInput] = useState("100");
  const [selectedPortion, setSelectedPortion] = useState<number>(0);
  const [portionMult, setPortionMult] = useState<number>(1);
  const [scalingProfile, setScalingProfile] =
    useState<PortionScalingProfile | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showMyFoods, setShowMyFoods] = useState(false);
  const [myFoodsQuery, setMyFoodsQuery] = useState("");
  const [editingCustomFood, setEditingCustomFood] =
    useState<CustomFoodCatalogItem | null>(null);
  const [smartSurface, setSmartSurface] = useState<SmartComposeSurface>(
    entryMode === "favorites" ? "library" : "explore",
  );
  const [drafts, setDrafts] = useState<EntryDraft[]>([]);
  const [draftExpanded, setDraftExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const [footerH, setFooterH] = useState(120);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerSentinelRef = useRef<HTMLDivElement | null>(null);
  const scalingRequestedRef = useRef(false);
  // itemSearchCacheRef et myFoodsCacheRef sont remplacés par useQuery
  const totals = sumDraftMacros(drafts);


  useEffect(() => {
    if (scalingProfile || scalingRequestedRef.current) return;
    const runner = () => {
      if (scalingRequestedRef.current) return;
      scalingRequestedRef.current = true;
      let cancelled = false;
      fetch("/api/client/profile-scaling")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d) setScalingProfile(d);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(
        () => {
          runner();
        },
        { timeout: 1200 },
      );
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = globalThis.setTimeout(() => {
      runner();
    }, 250);
    return () => globalThis.clearTimeout(timer);
  }, [scalingProfile]);

  useEffect(() => {
    if (!initialPrepEntries?.length) return;
    setDrafts(
      initialPrepEntries.map((entry): EntryDraft => {
        const q = entry.quantity_g > 0 ? entry.quantity_g : 100;
        const factor = 100 / q;
        return {
          food_item: {
            id: entry.food_item_id,
            name_fr: entry.name_fr,
            category_l1: inferCategoryFromMacros(entry),
            category_l2: null,
            icon_key: null,
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
        };
      }),
    );
  }, [initialPrepEntries]);


  useEffect(() => {
    if (!footerRef.current) return;
    const ro = new ResizeObserver(() => {
      setFooterH(footerRef.current?.offsetHeight ?? 120);
    });
    ro.observe(footerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (
      !scrollRef.current ||
      !headerSentinelRef.current ||
      !onHeaderCollapseChange
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => onHeaderCollapseChange(!entry.isIntersecting),
      {
        root: scrollRef.current,
        threshold: 0,
      },
    );

    observer.observe(headerSentinelRef.current);
    return () => observer.disconnect();
  }, [onHeaderCollapseChange]);

  useEffect(() => {
    if (layer !== "quantity" || !selectedItem || qMode !== "grams") return;

    const timer = window.setTimeout(() => {
      const input = quantityInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.select();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [layer, qMode, selectedItem]);

  function goTo(next: Layer, dir: number) {
    setDirection(dir);
    setLayer(next);
  }
  function selectCategory(cat: VisibleCategoryKey) {
    setSelectionPath("browse");
    setSelectedCategory(cat);
    setSelectedSubcategory(null);
    goTo("subcategory", 1);
  }
  function selectSubcategory(sub: VisibleLeafKey) {
    setSelectionPath("browse");
    setSelectedSubcategory(sub);
    setSearchQ("");
    goTo("item", 1);
  }
  function applyQuantity(next: number) {
    const safe = Math.max(0, Math.round(next));
    setQuantityG(safe);
    setQuantityInput(String(safe));
  }

  function handleQuantityInputChange(value: string) {
    if (value === "") {
      setQuantityInput("");
      setQuantityG(0);
      return;
    }
    if (!/^\d+$/.test(value)) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setQuantityInput(value);
    setQuantityG(Math.max(0, parsed));
  }

  function handleQuantityInputBlur() {
    if (quantityInput.trim() === "") {
      setQuantityInput("0");
    }
  }

  function selectItem(item: FoodItem, path: SelectionPath = "browse") {
    setSelectionPath(path);
    if (path === "quick") {
      setSelectedCategory(null);
      setSelectedSubcategory(null);
    }
    setSelectedItem(item);
    const suggested = advisorRemaining
      ? suggestQuantityForItem(item, advisorRemaining)
      : null;
    if (suggested) {
      applyQuantity(suggested.grams);
    } else {
      applyQuantity(0);
    }
    setSelectedPortion(0);
    setPortionMult(1);
    setQMode("grams");
    goTo("quantity", 1);
  }

  function goBack() {
    if (layer === "quantity") {
      setSelectedItem(null);
      if (selectionPath === "quick") {
        setSelectionPath("browse");
        goTo("category", -1);
      } else {
        goTo("item", -1);
      }
    } else if (layer === "item") {
      goTo("subcategory", -1);
      setSelectedSubcategory(null);
    } else if (layer === "subcategory") {
      goTo("category", -1);
      setSelectedCategory(null);
    } else if (!embedded) {
      resetBodyScrollLock();
      router.back();
    }
  }

  // ── Aliments perso (mes aliments) ──────────────────────────────────────────
  const normalizedMyFoodsQuery = myFoodsQuery.trim().toLowerCase();
  const { data: myFoodsData, isFetching: loadingMyFoods } = useQuery<CustomFoodCatalogItem[]>({
    queryKey: ["my-foods", normalizedMyFoodsQuery] as const,
    queryFn: async () => {
      const params = new URLSearchParams({ mine: "true", limit: "300" });
      if (normalizedMyFoodsQuery) params.set("q", normalizedMyFoodsQuery);
      const res = await fetch(`/api/client/food-items?${params.toString()}`);
      const json = await res.json();
      return (json.data ?? []) as CustomFoodCatalogItem[];
    },
    enabled: showMyFoods,
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: [],
  });
  const myFoods = myFoodsData ?? [];

  // ── Catalogue d'aliments (browse par sous-catégorie) ─────────────────────
  const normalizedSearchQ = searchQ.trim().toLowerCase();
  const isItemLayerActive = layer === "item" && !!selectedCategory && !!selectedSubcategory;
  const { data: itemsData, isFetching: loadingItems } = useQuery<FoodItem[]>({
    queryKey: ["food-items", selectedSubcategory, normalizedSearchQ] as const,
    queryFn: async ({ queryKey }) => {
      const [, sub, q] = queryKey as [string, VisibleLeafKey, string];
      const startedAt = performance.now();
      const scopedCategory = getStorageCategoryFromVisibleLeaf(sub);
      const params = new URLSearchParams({
        visible_leaf: sub,
        limit: q ? "120" : "240",
        category: scopedCategory.category_l1,
      });
      if (scopedCategory.category_l2)
        params.set("subcategory", scopedCategory.category_l2);
      if (q) params.set("q", q);

      const res = await fetch(`/api/client/food-items?${params.toString()}`);
      logPerfTrace(
        `food-items:${sub}${q ? ":query" : ":browse"}`,
        startedAt,
        res,
      );
      const json = await res.json();
      return (json.data ?? []) as FoodItem[];
    },
    enabled: isItemLayerActive,
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: [],
  });
  const items = itemsData ?? [];
  const loadingItems_ = loadingItems;

  function applyPortion(idx: number, mult: number = portionMult) {
    setSelectedPortion(idx);
    applyQuantity(getScaledPortionG(PORTION_SIZES[idx], scalingProfile, mult));
  }

  function applyMultiplier(mult: number) {
    setPortionMult(mult);
    if (qMode === "portion")
      applyQuantity(
        getScaledPortionG(PORTION_SIZES[selectedPortion], scalingProfile, mult),
      );
  }

  function addToMeal() {
    if (!selectedItem || quantityG <= 0) return;
    setDrafts((prev) => [
      ...prev,
      {
        food_item: selectedItem,
        quantity_g: quantityG,
        input_mode: qMode === "portion" ? "portion" : "composer",
      },
    ]);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSelectedItem(null);
    setDirection(-1);
    setLayer("category");
  }

  function removeDraft(idx: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  }

  const mapFavoriteEntriesToDrafts = useCallback(
    (entries: any[], favoriteId?: string): EntryDraft[] => {
      return entries.map((entry): EntryDraft => {
        const quantity = entry.quantity_g > 0 ? entry.quantity_g : 100;
        const factor = 100 / quantity;
        return {
          food_item: {
            id: entry.food_item_id,
            name_fr: entry.name_fr,
            category_l1: inferCategoryFromMacros(entry) as CategoryL1,
            category_l2: null,
            icon_key: null,
            item_key: favoriteId
              ? `fav-${favoriteId}-${entry.food_item_id}`
              : `fav-${entry.food_item_id}`,
            kcal_per_100g: Math.round((entry.calories_kcal ?? 0) * factor),
            protein_per_100g:
              Math.round((entry.protein_g ?? 0) * factor * 10) / 10,
            carbs_per_100g: Math.round((entry.carbs_g ?? 0) * factor * 10) / 10,
            fat_per_100g: Math.round((entry.fat_g ?? 0) * factor * 10) / 10,
            fiber_per_100g: Math.round((entry.fiber_g ?? 0) * factor * 10) / 10,
            source: "user",
            is_verified: false,
          },
          quantity_g: quantity,
          input_mode: "composer" as const,
        };
      });
    },
    [],
  );

  async function saveMeal() {
    if (!drafts.length) return;
    return persistMeal(drafts, "composer");
  }

  const savePrep = useCallback(async (): Promise<boolean> => {
    if (!drafts.length) return false;
    setSavingPrep(true);
    try {
      const plannedFor = prepDate
        ? new Date(`${prepDate}T12:00:00.000Z`).toISOString()
        : new Date().toISOString();
      const hour = new Date().getHours();
      const inferredSlot: "breakfast" | "lunch" | "dinner" | "snack" =
        hour < 10
          ? "breakfast"
          : hour < 14
            ? "lunch"
            : hour < 18
              ? "snack"
              : "dinner";
      const slot = prepMealSlot ?? inferredSlot;
      const body = {
        scenario_key: prepScenario?.key,
        scenario_label: prepScenario?.label,
        planned_for: plannedFor,
        ...(prepTitle?.trim() ? { title: prepTitle.trim() } : {}),
        meal_slot: slot,
        meal_type: slot,
        entries: drafts.map((d) => ({
          food_item_id: d.food_item.id,
          quantity_g: d.quantity_g,
        })),
      };
      const result = await sendClientMutation({
        kind: "prep",
        url: prepId
          ? `/api/client/nutrition/preps/${prepId}`
          : "/api/client/nutrition/preps",
        method: prepId ? "PATCH" : "POST",
        body,
      });

      if (result.queued) {
        // Optimistic update: add a provisional prep to the live list
        queueNutritionLiveRefresh({
          date: activeDate,
          consumedDelta: undefined,
        });
        if (onSuccess) onSuccess();
        return true;
      }

      if (result.response?.ok) {
        const json = await result.response.json().catch(() => null);
        if (json?.data) {
          queueNutritionLiveRefresh({
            date: activeDate,
            prep: json.data,
          });
        }
        if (onSuccess) onSuccess();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setSavingPrep(false);
    }
  }, [
    activeDate,
    drafts,
    onSuccess,
    prepDate,
    prepId,
    prepMealSlot,
    prepScenario?.key,
    prepScenario?.label,
    prepTitle,
  ]);

  const persistMeal = useCallback(
    async (
      entriesDraft: EntryDraft[],
      mealSource: MealSource,
    ): Promise<boolean> => {
      if (!entriesDraft.length) return false;
      setSaving(true);
      try {
        const body: Record<string, unknown> = {
          entries: entriesDraft.map((d) => ({
            food_item_id: d.food_item.id,
            quantity_g: d.quantity_g,
            input_mode: d.input_mode,
          })),
          meal_source: mealSource,
        };
        if (existingMealId) body.meal_id = existingMealId;
        // Pass logged_at with the current local time of the client, adjusted for physiological boundary.
        if (prepDate) {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
          body.logged_at = constructLoggedAt(prepDate, tz, new Date());
        }
        if (prepMealSlot) body.meal_type = prepMealSlot;
        const result = await sendClientMutation({
          kind: "meal",
          url: "/api/client/nutrition/meals",
          method: "POST",
          body,
        });
        if (result.queued || result.response?.ok) {
          await result.response?.json().catch(() => null);
          queueNutritionLiveRefresh({
            date: activeDate,
            consumedDelta: {
              kcal: totals.calories,
              protein_g: totals.protein,
              carbs_g: totals.carbs,
              fat_g: totals.fat,
            },
          });
          if (onSuccess) onSuccess();
          return true;
        }
        setSaving(false);
        return false;
      } catch {
        setSaving(false);
        return false;
      }
    },
    [
      activeDate,
      existingMealId,
      onSuccess,
      prepDate,
      prepMealSlot,
      totals.calories,
      totals.carbs,
      totals.fat,
      totals.protein,
    ],
  );

  async function quickLogFavorite(fav: FavoriteMeal) {
    if (isSmartPrepMode) {
      const newDrafts = mapFavoriteEntriesToDrafts(
        fav.entries as any[],
        fav.id,
      );
      setDrafts((prev) => [...prev, ...newDrafts]);
      return;
    }

    const favoriteDrafts = mapFavoriteEntriesToDrafts(
      fav.entries as any[],
      fav.id,
    );

    await persistMeal(favoriteDrafts, "composer");
  }

  function startFavoriteEdit(fav: FavoriteMeal) {
    setDrafts(mapFavoriteEntriesToDrafts(fav.entries as any[], fav.id));
    setFavoriteName(fav.name);
    setEditingFavoriteId(fav.id);
    setShowFavoriteSaveForm(true);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSelectedItem(null);
    setSelectionPath("browse");
    setDirection(-1);
    setLayer("category");
  }

  function resetFavoriteForm() {
    setFavoriteName("");
    setShowFavoriteSaveForm(false);
    setEditingFavoriteId(null);
  }

  async function deleteFavorite(favoriteId: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("nutrition.favorites.deleteConfirm"))
    )
      return;
    setDeletingFavoriteId(favoriteId);
    try {
      const res = await fetch(`/api/client/nutrition/favorites/${favoriteId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      // Optimistic update via cache query
      queryClient.setQueryData<FavoriteMeal[]>(FAVORITES_QUERY_KEY, (prev) =>
        (prev ?? []).filter((fav) => fav.id !== favoriteId)
      );
      if (editingFavoriteId === favoriteId) resetFavoriteForm();
    } catch {
      // silent fail
    } finally {
      setDeletingFavoriteId(null);
    }
  }

  async function saveFavorite() {
    if (!favoriteName.trim() || !drafts.length) return;
    setSavingFavorite(true);
    try {
      const totals = sumDraftMacros(drafts);
      const entries = drafts.map((d) => ({
        food_item_id: d.food_item.id,
        name_fr: d.food_item.name_fr,
        quantity_g: d.quantity_g,
        calories_kcal: calcEntryMacros(d.food_item, d.quantity_g).calories_kcal,
        protein_g: calcEntryMacros(d.food_item, d.quantity_g).protein_g,
        carbs_g: calcEntryMacros(d.food_item, d.quantity_g).carbs_g,
        fat_g: calcEntryMacros(d.food_item, d.quantity_g).fat_g,
        fiber_g: calcEntryMacros(d.food_item, d.quantity_g).fiber_g,
      }));

      const isEditing = Boolean(editingFavoriteId);
      const res = await fetch(
        isEditing
          ? `/api/client/nutrition/favorites/${editingFavoriteId}`
          : "/api/client/nutrition/favorites",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: favoriteName.trim(),
            entries,
            total_calories: totals.calories,
            total_protein_g: totals.protein,
            total_carbs_g: totals.carbs,
            total_fat_g: totals.fat,
          }),
        },
      );

      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          // Optimistic update : insérer/remplacer dans le cache de la query
          queryClient.setQueryData<FavoriteMeal[]>(FAVORITES_QUERY_KEY, (prev) => {
            const next = [
              json.data,
              ...(prev ?? []).filter((fav: FavoriteMeal) => fav.id !== json.data.id),
            ];
            return next.slice(0, 10);
          });
        } else {
          void queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY });
        }
        resetFavoriteForm();
      }
    } catch {
      // silent fail
    } finally {
      setSavingFavorite(false);
    }
  }

  useEffect(() => {
    onDraftsChange?.({
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      count: drafts.length,
    });
  }, [drafts]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedMacros = selectedItem
    ? calcEntryMacros(selectedItem, quantityG)
    : null;
  const liveTotals = useMemo(
    () => ({
      calories: totals.calories + (selectedMacros?.calories_kcal ?? 0),
      protein: totals.protein + (selectedMacros?.protein_g ?? 0),
      carbs: totals.carbs + (selectedMacros?.carbs_g ?? 0),
      fat: totals.fat + (selectedMacros?.fat_g ?? 0),
      count: drafts.length + (selectedItem && quantityG > 0 ? 1 : 0),
      pendingItemName: selectedItem?.name_fr ?? null,
      pendingQuantityG: selectedItem && quantityG > 0 ? quantityG : null,
    }),
    [
      drafts.length,
      quantityG,
      selectedItem,
      selectedMacros,
      totals.calories,
      totals.carbs,
      totals.fat,
      totals.protein,
    ],
  );

  useEffect(() => {
    onLiveTotalsChange?.(liveTotals);
  }, [liveTotals, onLiveTotalsChange]);

  useEffect(() => {
    onLayerChange?.(layer);
  }, [layer, onLayerChange]);

  const effectiveConsumed = balanceContext
    ? {
        kcal: balanceContext.consumed.kcal + totals.calories,
        protein_g: balanceContext.consumed.protein_g + totals.protein,
        carbs_g: balanceContext.consumed.carbs_g + totals.carbs,
        fat_g: balanceContext.consumed.fat_g + totals.fat,
        water_ml: balanceContext.consumed.water_ml,
      }
    : null;
  const actionableRemaining =
    effectiveConsumed && balanceContext
      ? computeActionableRemaining({
          target: balanceContext.target,
          consumed: effectiveConsumed,
          profile: balanceContext.profile,
        })
      : null;
  const remainingTargets = actionableRemaining?.actionableRemaining ?? null;
  const advisorRemaining = remainingTargets
    ? {
        protein_g: Math.max(0, remainingTargets.protein),
        carbs_g: Math.max(0, remainingTargets.carbs),
        fat_g: Math.max(0, remainingTargets.fat),
      }
    : null;
  const quantitySuggestion =
    selectedItem && advisorRemaining
      ? suggestQuantityForItem(selectedItem, advisorRemaining)
      : null;
  const layerTitle =
    layer === "category"
      ? t("log.title")
      : layer === "subcategory"
        ? (CATEGORY_LABELS_T[selectedCategory!] ?? "")
        : layer === "item"
          ? selectedSubcategory
            ? (SUBCATEGORY_LABELS_T[selectedSubcategory] ?? "")
            : ""
          : (selectedItem?.name_fr ?? "");
  const layerStepLabel =
    selectionPath === "quick" && layer === "quantity"
      ? null
      : layer === "subcategory"
        ? "1/3"
        : layer === "item"
          ? "2/3"
          : layer === "quantity"
            ? "3/3"
            : null;

  const topBarH = 56;
  const showSearchFirst = false;
  const showCategoriesFirst = entryMode === "categories";
  const isTrackSearchOnly =
    composerMode === "standard" && entryMode === "search";
  const isTrackFavoritesOnly =
    composerMode === "standard" && entryMode === "favorites";
  const isTrackCategoriesOnly =
    composerMode === "standard" && entryMode === "categories";
  const isSmartPrepMode = composerMode !== "standard";
  const useComposeVisualMode = embedded;
  const showFavoritesBlock =
    favorites.length > 0 && (entryMode === "default" || isTrackFavoritesOnly);
  const showSearchBlock = layer === "item" && !!selectedSubcategory;
  const showCategoryBlock = !isTrackFavoritesOnly && !isTrackSearchOnly;
  const showPersonalFoodTools = !isTrackFavoritesOnly && !isTrackSearchOnly;
  const showSmartSearchBlock = layer === "category" && !isTrackFavoritesOnly;
  // In smart mode: always show both explore (categories) and library (favorites + personal tools)
  const showSmartExploreBlock = isSmartPrepMode ? true : showCategoryBlock;
  const showSmartLibraryBlock = isSmartPrepMode
    ? true
    : showFavoritesBlock || showPersonalFoodTools;
  const compactSmartQuantity = false;
  const useCompactDraftDock = false;
  const isSelectingQuantity = layer === "quantity" && !!selectedItem;

  useEffect(() => {
    if (drafts.length === 0) {
      setDraftExpanded(false);
    }
  }, [drafts.length]);

  useEffect(() => {
    onLayerChange?.(layer);
  }, [layer, onLayerChange]);

  // Expose handle to parent (ComposeClientPage uses this to save/clear from outside)
  useImperativeHandle(
    ref,
    () => ({
      saveMeal: async () => persistMeal(drafts, "composer"),
      savePrep: async () => savePrep(),
      clearDrafts: () => {
        setDrafts([]);
        setLayer("category");
        setSelectionPath("browse");
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setSelectedItem(null);
      },
      openVoice: (mode: "voice" | "text" = "voice") => {
        setVoiceInputMode(mode);
        setVoiceOpen(true);
      },
    }),
    [drafts, persistMeal, savePrep],
  );

  return (
    <div
      className={
        embedded
          ? `flex flex-col bg-[#0d0d0d] ${externalScroll ? "" : "h-full"}`
          : "min-h-dvh bg-[#0d0d0d] flex flex-col overflow-x-hidden"
      }
    >
      {/* TopBar — hidden in embedded mode */}
      {!embedded && (
        <div
          className="fixed inset-x-0 z-50 h-14 flex items-center px-4 bg-[#0a0a0a]"
          style={{ top: "env(safe-area-inset-top)" }}
        >
          <button
            onClick={goBack}
            className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/50 hover:text-white active:scale-95 transition-all mr-3"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="text-[13px] font-semibold text-white truncate flex-1">
            {layerTitle}
          </p>
          {composerMode === "standard" &&
            layer === "category" &&
            onPhotoScanOpen && (
              <button
                onClick={onPhotoScanOpen}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/50 hover:text-white active:scale-95 transition-all mr-2"
                title={t("nutrition.photo.quickScan")}
              >
                <Zap size={15} />
              </button>
            )}
          {layerStepLabel && (
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
              {layerStepLabel}
            </p>
          )}
        </div>
      )}

      {/* Embedded sub-header (layer title + back) — shown only when navigated past category layer */}
      {embedded && layer !== "category" && (
        <div className="flex items-center gap-2 px-4 py-2 shrink-0 border-b border-white/[0.06]">
          <button
            onClick={goBack}
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-white/50 active:scale-95 transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-[12px] font-semibold text-white truncate flex-1">
            {layerTitle}
          </p>
          {layerStepLabel && (
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
              {layerStepLabel}
            </p>
          )}
        </div>
      )}

      {/* Layers content — min-h-0 requis pour que flex-1 ait une hauteur réelle en embedded */}
      <div
        className={
          externalScroll
            ? "relative"
            : "flex-1 overflow-hidden relative min-h-0"
        }
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
            ref={scrollRef}
            className={
              externalScroll ? "relative" : "absolute inset-0 overflow-y-auto"
            }
            style={{
              paddingBottom: footerH + (embedded ? 32 : 16),
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div
              ref={headerSentinelRef}
              aria-hidden
              className="pointer-events-none absolute left-0 top-[42px] h-px w-px"
            />
            {/* Layer 1: Categories */}
            {layer === "category" && (
              <div className="p-4">
                {remainingTargets &&
                  !externalScroll &&
                  !(embedded && balanceContext) && (
                    <RemainingNutritionSummary
                      remaining={remainingTargets}
                      variant="neutral"
                    />
                  )}

                {/* In smart mode: section header for the food picker — voice button lives in parent header */}

                {isTrackFavoritesOnly &&
                  favorites.length === 0 &&
                  !loadingFavorites && (
                    <div className="rounded-2xl bg-white/[0.04] px-4 py-8 text-center">
                      <p className="text-[13px] font-semibold text-white">
                        {t("nutrition.favorites.empty")}
                      </p>
                      <p className="text-[12px] text-white/45 mt-1">
                        {t("nutrition.favorites.emptyDesc")}
                      </p>
                    </div>
                  )}

                {showSmartSearchBlock &&
                  (useComposeVisualMode ? (
                    <div className="mb-2">
                      <QuickSearch
                        onSelect={(item) => selectItem(item, "quick")}
                        smartMode={useComposeVisualMode}
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl mb-3 bg-white/[0.04] p-4">
                      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold mb-3 text-white/30">
                        Recherche rapide
                      </p>
                      <QuickSearch
                        onSelect={(item) => selectItem(item, "quick")}
                        smartMode={useComposeVisualMode}
                      />
                    </div>
                  ))}

                {showSmartExploreBlock &&
                  (useComposeVisualMode ? (
                    <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {(
                        Object.entries(CATEGORY_LABELS_T) as [
                          VisibleCategoryKey,
                          string,
                        ][]
                      ).map(([cat, label]) => (
                        <button
                          key={cat}
                          onClick={() => selectCategory(cat)}
                          className="flex h-8 shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111111] px-2.5 hover:bg-white/[0.08] active:scale-95 transition-all text-white/72"
                        >
                          <FoodIcon
                            iconKey={CATEGORY_ICON_KEYS[cat]}
                            size={20}
                          />
                          <span className="text-[10px] font-semibold text-white/80">
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-3 rounded-2xl bg-white/[0.04] p-3">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
                        {showCategoriesFirst
                          ? t("log.chooseByCategory")
                          : t("log.chooseCategory")}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          Object.entries(CATEGORY_LABELS_T) as [
                            VisibleCategoryKey,
                            string,
                          ][]
                        ).map(([cat, label]) => (
                          <button
                            key={cat}
                            onClick={() => selectCategory(cat)}
                            className="flex min-h-[82px] flex-col items-center justify-center gap-1.5 rounded-[16px] bg-white/[0.06] px-2 py-2.5 hover:bg-white/[0.10] active:scale-95 transition-all"
                          >
                            <FoodIcon
                              iconKey={CATEGORY_ICON_KEYS[cat]}
                              size={30}
                            />
                            <span className="text-center text-[10px] font-semibold leading-tight text-white/80">
                              {label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                {showPersonalFoodTools && showSmartLibraryBlock && (
                  <div
                    className={`space-y-2 ${useComposeVisualMode ? "mt-2" : ""}`}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setShowCustomForm((v) => !v);
                          if (showMyFoods) setShowMyFoods(false);
                          setEditingCustomFood(null);
                        }}
                        className={`h-9 w-full flex items-center justify-center gap-2 rounded-xl text-[11px] active:scale-[0.98] transition-all ${
                          useComposeVisualMode
                            ? showCustomForm
                              ? "bg-white/[0.12] text-white font-semibold"
                              : "bg-[#111111] text-white/50 hover:text-white/80 hover:bg-white/[0.08]"
                            : "bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]"
                        }`}
                      >
                        <Pencil size={13} />
                        {useComposeVisualMode
                          ? compactCustomFoodLabel
                          : t("log.createCustom")}
                      </button>
                      <button
                        onClick={() => {
                          const next = !showMyFoods;
                          setShowMyFoods(next);
                          setShowCustomForm(false);
                          setEditingCustomFood(null);
                        }}
                        className={`h-9 w-full flex items-center justify-center gap-2 rounded-xl text-[11px] active:scale-[0.98] transition-all ${
                          useComposeVisualMode
                            ? showMyFoods
                              ? "bg-white/[0.12] text-white font-semibold"
                              : "bg-[#111111] text-white/50 hover:text-white/80 hover:bg-white/[0.08]"
                            : "bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08]"
                        }`}
                      >
                        <Search size={13} />
                        {useComposeVisualMode
                          ? t("nutrition.library.title")
                          : t("nutrition.myFoods.title")}
                      </button>
                    </div>
                  </div>
                )}

                {showFavoritesBlock && (
                  <div className={`mt-4 ${useComposeVisualMode ? "" : "mb-2"}`}>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold mb-2">
                      {t("nutrition.favorites.title")}
                    </p>
                    <div
                      className={`${useComposeVisualMode ? "bg-[#111111]" : "bg-white/[0.04]"} rounded-2xl overflow-hidden`}
                    >
                      {favorites.slice(0, 6).map((fav) => (
                        <div
                          key={fav.id}
                          className={`flex items-center gap-2 px-4 py-3 ${useComposeVisualMode ? "hover:bg-white/[0.05]" : "hover:bg-white/[0.04]"}`}
                        >
                          <button
                            onClick={() => quickLogFavorite(fav)}
                            disabled={saving}
                            className="flex flex-1 items-center justify-between text-left active:scale-[0.98] transition-all disabled:opacity-50"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-white truncate">
                                {fav.name}
                              </p>
                              <p className="text-[11px] text-white/40 mt-0.5">
                                {Math.round(fav.total_calories ?? 0)} kcal · P{" "}
                                {Math.round(fav.total_protein_g ?? 0)} · G{" "}
                                {Math.round(fav.total_carbs_g ?? 0)} · L{" "}
                                {Math.round(fav.total_fat_g ?? 0)}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-bold ml-2 shrink-0 ${useComposeVisualMode ? "text-white/62" : "text-[#f2f2f2]"}`}
                            >
                              {t("nutrition.favorites.use")}
                            </span>
                          </button>
                          {!isSmartPrepMode && (
                            <>
                              <button
                                type="button"
                                onClick={() => startFavoriteEdit(fav)}
                                className="h-8 w-8 shrink-0 rounded-lg bg-white/[0.06] text-white/58 hover:text-white hover:bg-white/[0.1] active:scale-95 transition-all"
                                aria-label={t("nutrition.myFoods.editAction", {
                                  name: fav.name,
                                })}
                              >
                                <Pencil size={13} className="mx-auto" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteFavorite(fav.id)}
                                disabled={deletingFavoriteId === fav.id}
                                className="h-8 w-8 shrink-0 rounded-lg bg-white/[0.06] text-white/58 hover:text-[#ff8c8c] hover:bg-white/[0.1] active:scale-95 transition-all disabled:opacity-40"
                                aria-label={t(
                                  "nutrition.myFoods.deleteAction",
                                  { name: fav.name },
                                )}
                              >
                                <Trash2 size={13} className="mx-auto" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {showPersonalFoodTools && showCustomForm && (
                  <CustomFoodForm
                    onCreated={(item) => {
                      setShowCustomForm(false);
                      selectItem(item);
                    }}
                    onClose={() => setShowCustomForm(false)}
                  />
                )}
                {showPersonalFoodTools && showMyFoods && (
                  <MyFoodsManager
                    items={myFoods}
                    loading={loadingMyFoods}
                    query={myFoodsQuery}
                    onQueryChange={setMyFoodsQuery}
                    editingItem={editingCustomFood}
                    onEdit={setEditingCustomFood}
                    onEditDone={() => {
                      setEditingCustomFood(null);
                      void queryClient.invalidateQueries({ queryKey: ["my-foods"] });
                    }}
                    onDeleteDone={() => {
                      if (editingCustomFood) setEditingCustomFood(null);
                      void queryClient.invalidateQueries({ queryKey: ["my-foods"] });
                    }}
                    onSelect={selectItem}
                    onClose={() => {
                      setShowMyFoods(false);
                      setEditingCustomFood(null);
                    }}
                  />
                )}
              </div>
            )}

            {/* Layer 2: Subcategories */}
            {layer === "subcategory" && selectedCategory && (
              <div className="p-4">
                <div
                  className={`rounded-2xl overflow-hidden ${useComposeVisualMode ? "bg-[#111111]" : "bg-white/[0.04]"}`}
                >
                  {VISIBLE_LEAVES_BY_CATEGORY[selectedCategory].map((sub) => (
                    <button
                      key={sub}
                      onClick={() => selectSubcategory(sub)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 active:scale-[0.99] transition-all ${useComposeVisualMode ? "hover:bg-white/[0.06]" : "hover:bg-white/[0.04]"}`}
                    >
                      <div className="flex items-center gap-3">
                        <FoodIcon iconKey={LEAF_ICON_KEYS[sub]} size={26} />
                        <span className="text-[13px] font-medium text-white">
                          {SUBCATEGORY_LABELS_T[sub] ?? sub}
                        </span>
                      </div>
                      <ChevronLeft
                        size={14}
                        className="text-white/30 rotate-180"
                      />
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
                    <div
                      className={`rounded-xl flex items-center px-3 ${useComposeVisualMode ? "bg-[#111111]" : "bg-white/[0.04]"}`}
                    >
                      <Search
                        size={14}
                        className={`${useComposeVisualMode ? "text-white/40" : "text-white/30"} shrink-0`}
                      />
                      <input
                        type="text"
                        placeholder={t("log.searchPlaceholder2")}
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        className="w-full h-10 pl-2 pr-3 bg-transparent text-[13px] text-white placeholder:text-white/20 outline-none"
                      />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/28 font-semibold px-1">
                      {t("nutrition.search.in", {
                        name: selectedSubcategory
                          ? (SUBCATEGORY_LABELS_T[selectedSubcategory] ??
                            selectedSubcategory)
                          : "",
                      })}
                    </p>
                  </div>
                )}
                {loadingItems ? (
                  <div
                    className={`space-y-1 rounded-2xl overflow-hidden p-2 ${useComposeVisualMode ? "bg-[#111111]" : "bg-white/[0.04]"}`}
                  >
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-12 rounded-xl animate-pulse ${useComposeVisualMode ? "bg-white/[0.08]" : "bg-white/[0.06]"}`}
                      />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-[12px] text-white/30 text-center py-8">
                    {t("log.noResults")}
                  </p>
                ) : (
                  <div
                    className={`rounded-2xl overflow-hidden ${useComposeVisualMode ? "bg-[#111111]" : "bg-white/[0.04]"}`}
                  >
                    {items.map((item) => {
                      const kcal = item.kcal_per_100g || 1;
                      const pPct = Math.round(
                        ((item.protein_per_100g * 4) / kcal) * 100,
                      );
                      const gPct = Math.round(
                        ((item.carbs_per_100g * 4) / kcal) * 100,
                      );
                      const lPct = Math.round(
                        ((item.fat_per_100g * 9) / kcal) * 100,
                      );
                      const chipSuggestion = advisorRemaining
                        ? suggestQuantityForItem(item, advisorRemaining)
                        : null;
                      return (
                        <button
                          key={item.id}
                          onClick={() => selectItem(item)}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-3 active:scale-[0.99] transition-all text-left ${useComposeVisualMode ? "hover:bg-white/[0.06]" : "hover:bg-white/[0.04]"}`}
                        >
                          <FoodIcon food={item} size={42} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-white">
                              {item.name_fr}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-white/40">
                                {item.kcal_per_100g} kcal
                              </span>
                              <div className="flex h-[4px] w-[64px] rounded-full overflow-hidden gap-[1px]">
                                <div
                                  style={{
                                    width: `${pPct}%`,
                                    backgroundColor:
                                      NUTRITION_UI_COLORS.protein,
                                  }}
                                />
                                <div
                                  style={{
                                    width: `${gPct}%`,
                                    backgroundColor: NUTRITION_UI_COLORS.carbs,
                                  }}
                                />
                                <div
                                  style={{
                                    width: `${lPct}%`,
                                    backgroundColor: NUTRITION_UI_COLORS.fat,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-white/25">
                                P·G·L
                              </span>
                            </div>
                          </div>
                          {chipSuggestion ? (
                            <span className="text-[10px] font-bold text-white/62 shrink-0 ml-2 tabular-nums">
                              {chipSuggestion.grams > 0
                                ? `~${chipSuggestion.grams}g`
                                : "0g"}
                            </span>
                          ) : (
                            <span className="text-white/20 text-[11px] shrink-0 ml-2">
                              / 100g
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Layer 4: Quantity */}
            {layer === "quantity" && selectedItem && (
              <div className="p-4 space-y-4">
                <div
                  className={`flex gap-1 rounded-2xl border p-1 ${useComposeVisualMode ? "border-white/[0.06] bg-[#111111]" : "border-white/[0.04] bg-white/[0.04]"}`}
                >
                  {(["grams", "portion"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setQMode(m)}
                      className={`flex-1 h-9 text-[11px] font-semibold rounded-xl transition-all ${qMode === m ? (useComposeVisualMode ? "bg-white/[0.12] text-white" : "bg-white/[0.10] text-white") : "text-white/40"}`}
                    >
                      {m === "grams"
                        ? t("log.gramsMode")
                        : t("log.portionMode")}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {compactSmartQuantity && quantitySuggestion && (
                    <div className="rounded-[26px] border border-white/[0.06] bg-[#111114] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <FoodIcon food={selectedItem} size={48} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-white/42 font-semibold">
                                {t("nutrition.quantity.decision")}
                              </p>
                              {prepMealSlot && (
                                <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/68">
                                  {t(`compose.slot.${prepMealSlot}` as any)}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[16px] font-black text-white truncate">
                              {selectedItem.name_fr}
                            </p>
                            <p className="mt-1 text-[12px] text-white/62 leading-relaxed">
                              {quantitySuggestion
                                ? quantitySuggestion.reason
                                : t("nutrition.quantity.adjustHint")}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 min-w-[96px] rounded-[20px] border border-white/[0.06] bg-white/[0.06] px-3 py-2.5 text-right">
                          <p className="text-[18px] font-black text-white leading-none">
                            {quantityG} g
                          </p>
                          <p className="text-[9px] uppercase tracking-[0.12em] text-white/28 mt-1">
                            {t("nutrition.quantity.portion")}
                          </p>
                        </div>
                      </div>

                      {quantitySuggestion &&
                        quantityG !== quantitySuggestion.grams && (
                          <button
                            onClick={() => {
                              applyQuantity(quantitySuggestion.grams);
                            }}
                            className="h-9 rounded-xl border border-white/[0.06] bg-white/[0.06] px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white active:scale-[0.98] transition-all hover:bg-white/[0.1]"
                          >
                            {t("nutrition.quantity.apply", {
                              grams: quantitySuggestion.grams,
                            })}
                          </button>
                        )}

                      <div className="grid grid-cols-2 gap-2">
                        {selectedMacros && (
                          <div className="rounded-[20px] border border-white/[0.05] bg-white/[0.05] px-3 py-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-white/28 font-semibold">
                              {t("nutrition.quantity.forPortion")}
                            </p>
                            <p className="mt-2 text-[20px] font-black text-white">
                              {Math.round(selectedMacros.calories_kcal)} kcal
                            </p>
                            <div className="mt-2 flex gap-3 text-[12px] font-semibold">
                              <span
                                style={{ color: NUTRITION_UI_COLORS.protein }}
                              >
                                P {selectedMacros.protein_g}g
                              </span>
                              <span
                                style={{ color: NUTRITION_UI_COLORS.carbs }}
                              >
                                G {selectedMacros.carbs_g}g
                              </span>
                              <span style={{ color: NUTRITION_UI_COLORS.fat }}>
                                L {selectedMacros.fat_g}g
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="rounded-[20px] border border-white/[0.05] bg-white/[0.05] px-3 py-3">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/28 font-semibold">
                            {t("nutrition.quantity.suggested")}
                          </p>
                          <p className="mt-2 text-[20px] font-black text-white">
                            {quantitySuggestion.grams} g
                          </p>
                          <p className="mt-2 text-[12px] text-white/60 leading-relaxed">
                            {t("nutrition.quantity.suggestedHint")}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {qMode === "grams" && (
                    <div className="space-y-3">
                      <div
                        className={`${useComposeVisualMode ? "bg-[#111111] border border-white/[0.06]" : "bg-white/[0.03]"} rounded-[24px] p-3`}
                      >
                        <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-white/30 font-semibold">
                          {t("nutrition.quantity.gramsTitle")}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => applyQuantity(quantityG - 5)}
                            className="h-11 w-11 rounded-xl bg-white/[0.06] text-white/70 flex items-center justify-center"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            ref={quantityInputRef}
                            type="text"
                            inputMode="numeric"
                            value={quantityInput}
                            onChange={(e) =>
                              handleQuantityInputChange(e.target.value)
                            }
                            onBlur={handleQuantityInputBlur}
                            className={`flex-1 h-11 rounded-xl text-center text-[18px] font-black tracking-[-0.02em] text-white outline-none ${useComposeVisualMode ? "bg-white/[0.08]" : "bg-white/[0.06]"}`}
                          />
                          <button
                            onClick={() => applyQuantity(quantityG + 5)}
                            className="h-11 w-11 rounded-xl bg-white/[0.06] text-white/70 flex items-center justify-center"
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
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">
                          {t("log.choosePortion")}
                        </p>
                        {isHandOverrideSet(scalingProfile) && (
                          <span className="text-[9px] uppercase tracking-[0.12em] text-[#f2f2f2]/70 font-bold">
                            {t("nutrition.quantity.handAdjusted")}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 overflow-x-auto pb-1">
                        {PORTION_MULTIPLIERS.map((m) => (
                          <button
                            key={m}
                            onClick={() => applyMultiplier(m)}
                            className={`shrink-0 h-8 px-3 rounded-xl text-[11px] font-bold transition-all ${portionMult === m ? "bg-white/[0.12] text-white" : "bg-white/[0.03] text-white/40"}`}
                          >
                            ×{m}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {PORTION_SIZES.map((p, i) => {
                          const scaledG = getScaledPortionG(
                            p,
                            scalingProfile,
                            portionMult,
                          );
                          const isActive =
                            selectedPortion === i && qMode === "portion";
                          return (
                            <button
                              key={p.key}
                              onClick={() => applyPortion(i)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[20px] transition-all ${isActive ? (useComposeVisualMode ? "border border-white/[0.10] bg-white/[0.12]" : "bg-white/[0.10]") : useComposeVisualMode ? "border border-white/[0.05] bg-[#111111] hover:bg-white/[0.06]" : "bg-white/[0.03] hover:bg-white/[0.06]"}`}
                            >
                              <span className="text-xl shrink-0">
                                {PORTION_ICON_BY_KEY[p.key] ?? "📏"}
                              </span>
                              <div className="text-left flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-white">
                                  {p.label}
                                </p>
                                <p className="text-[11px] text-white/35 truncate">
                                  {p.description}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span
                                  className={`text-[12px] font-bold ${isActive ? "text-[#f2f2f2]" : "text-white/60"}`}
                                >
                                  {scaledG}g
                                </span>
                                {portionMult !== 1 && (
                                  <p className="text-[9px] text-white/30 mt-0.5">
                                    {p.baseG}g × {portionMult}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky footer */}
      <div
        ref={footerRef}
        className={`${
          embedded && !externalScroll ? "shrink-0" : "fixed inset-x-0 bottom-0"
        } z-[60] bg-[#0d0d0d]`}
        style={
          embedded && !externalScroll
            ? undefined
            : { paddingBottom: "12px" }
        }
      >
        {drafts.length > 0 && !isSelectingQuantity && (
          <div
            className={`px-4 pt-3 pb-1 ${useCompactDraftDock && !draftExpanded ? "" : "max-h-[120px] overflow-y-auto"}`}
          >
            {useCompactDraftDock ? (
              <div className="rounded-2xl bg-[#111114] px-3 py-3">
                <button
                  onClick={() => setDraftExpanded((value) => !value)}
                  className="w-full flex items-center justify-between gap-3 text-left active:scale-[0.99] transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
                      {drafts.length > 1
                        ? t("log.itemsInMealPlural", { n: drafts.length })
                        : t("log.itemsInMeal", { n: drafts.length })}
                    </p>
                    <p className="mt-1 text-[12px] text-white/72 truncate">
                      {drafts
                        .map((draft) => draft.food_item.name_fr)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex gap-2 justify-end text-[11px]">
                      <span className="text-white font-bold">
                        {Math.round(totals.calories)} kcal
                      </span>
                      <span style={{ color: NUTRITION_UI_COLORS.protein }}>
                        P{totals.protein}g
                      </span>
                      <span style={{ color: NUTRITION_UI_COLORS.carbs }}>
                        G{totals.carbs}g
                      </span>
                      <span style={{ color: NUTRITION_UI_COLORS.fat }}>
                        L{totals.fat}g
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] uppercase tracking-[0.12em] text-white/24">
                      {draftExpanded
                        ? t("nutrition.details.hide")
                        : t("nutrition.details.show")}
                      {draftExpanded ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </div>
                  </div>
                </button>
                {draftExpanded && (
                  <div className="mt-3 space-y-1">
                    {drafts.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2"
                      >
                        <FoodIcon food={d.food_item} size={34} />
                        <span className="text-[12px] text-white/82 flex-1 truncate">
                          {d.food_item.name_fr}
                        </span>
                        <span className="text-[11px] text-white/40 mx-2">
                          {d.quantity_g}g
                        </span>
                        <button
                          onClick={() => removeDraft(i)}
                          className="text-white/20 hover:text-white/60 active:scale-90 transition-all"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
                    {drafts.length > 1
                      ? t("log.itemsInMealPlural", { n: drafts.length })
                      : t("log.itemsInMeal", { n: drafts.length })}
                  </p>
                  <div className="flex gap-2 text-[11px]">
                    <span className="text-white font-bold">
                      {Math.round(totals.calories)} kcal
                    </span>
                    <span style={{ color: NUTRITION_UI_COLORS.protein }}>
                      P{totals.protein}g
                    </span>
                    <span style={{ color: NUTRITION_UI_COLORS.carbs }}>
                      G{totals.carbs}g
                    </span>
                    <span style={{ color: NUTRITION_UI_COLORS.fat }}>
                      L{totals.fat}g
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  {drafts.map((d, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 ${useComposeVisualMode ? "bg-[#111111]" : "bg-white/[0.03]"}`}
                    >
                      <FoodIcon food={d.food_item} size={34} />
                      <span className="text-[12px] text-white/80 flex-1 truncate">
                        {d.food_item.name_fr}
                      </span>
                      <span className="text-[11px] text-white/40 mx-2">
                        {d.quantity_g}g
                      </span>
                      <button
                        onClick={() => removeDraft(i)}
                        className="text-white/20 hover:text-white/60 active:scale-90 transition-all"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {(!isTrackFavoritesOnly ||
          drafts.length > 0 ||
          isSelectingQuantity) && (
          <div
            className="px-4 pt-2 space-y-2"
            style={{ paddingBottom: "12px" }}
          >
            {isSelectingQuantity && (
              <button
                onClick={addToMeal}
                disabled={quantityG <= 0}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] text-[12px] font-bold uppercase tracking-[0.1em] text-[#080808] active:scale-[0.98] transition-all disabled:opacity-40"
              >
                <Plus size={16} />
                {isSmartPrepMode
                  ? t("nutrition.addWithQuantity", { grams: quantityG })
                  : t("log.addToMeal")}
              </button>
            )}

            {/* Save as favorite section */}
            {!isSelectingQuantity &&
              !isSmartPrepMode &&
              !showFavoriteSaveForm &&
              drafts.length > 0 && (
                <button
                  onClick={() => setShowFavoriteSaveForm(true)}
                  className="text-[10px] text-white/40 hover:text-white/70 transition-colors text-center py-1"
                >
                  ⭐{" "}
                  {editingFavoriteId
                    ? t("nutrition.favorite.edit")
                    : t("nutrition.favorite.save")}
                </button>
              )}

            {!isSelectingQuantity &&
              !isSmartPrepMode &&
              showFavoriteSaveForm && (
                <div className="space-y-2 pb-2">
                  <input
                    type="text"
                    placeholder={t("nutrition.favorite.namePlaceholder")}
                    value={favoriteName}
                    onChange={(e) => setFavoriteName(e.target.value)}
                    className="w-full h-9 px-3 bg-white/[0.05] rounded-xl text-[12px] text-white placeholder:text-white/20 outline-none "
                  />
                  {editingFavoriteId && (
                    <p className="px-1 text-[10px] text-white/38">
                      {t("nutrition.favorite.replaceHint")}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={resetFavoriteForm}
                      className="flex-1 h-9 bg-white/[0.04] text-white/60 text-[11px] font-semibold rounded-xl hover:bg-white/[0.08] active:scale-95 transition-all"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      onClick={saveFavorite}
                      disabled={!favoriteName.trim() || savingFavorite}
                      className="flex-1 h-9 bg-[#f2f2f2] text-black text-[11px] font-bold rounded-xl hover:bg-[#f2f2f2]/90 disabled:opacity-40 active:scale-95 transition-all"
                    >
                      {savingFavorite
                        ? "..."
                        : editingFavoriteId
                          ? t("common.update")
                          : t("common.save")}
                    </button>
                  </div>
                </div>
              )}

            {!hideActions && !isSelectingQuantity && (
              <div className="grid grid-cols-2 gap-2">
                {/* Planifier — crée un prep dans l'onglet Planning */}
                <button
                  onClick={savePrep}
                  disabled={drafts.length === 0 || savingPrep || saving}
                  className="h-11 rounded-xl bg-white/[0.06] text-white/70 disabled:opacity-30 text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] active:scale-[0.98] transition-all"
                >
                  {savingPrep ? "…" : t("nutrition.prep.plan")}
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
                  {saving
                    ? t("log.saving")
                    : existingMealId
                      ? t("log.appendMeal")
                      : t("log.finishMeal")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <VoiceLogSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onSuccess={() => {
          setVoiceOpen(false);
          onSuccess?.();
        }}
        onDraftReady={(entries) => {
          setDrafts((prev) => [...prev, ...entries]);
          setVoiceOpen(false);
          setSelectedCategory(null);
          setSelectedSubcategory(null);
          setSelectedItem(null);
          setDirection(-1);
          setLayer("category");
        }}
        mealId={existingMealId ?? undefined}
        initialInputMode={voiceInputMode}
      />
    </div>
  );
}

export const NutritionLogContent = forwardRef(NutritionLogContentImpl);
NutritionLogContent.displayName = "NutritionLogContent";

// ── Recherche rapide ─────────────────────────────────────────
const QUICK_SEARCH_HISTORY_KEY = "stryv-nutrition-quick-search-history-v1";
const QUICK_SEARCH_HISTORY_LIMIT = 18;
const QUICK_SEARCH_RECENT_ITEMS_LIMIT = 10;
const QUICK_SEARCH_FREQUENT_MIN_USES = 5;
const QUICK_SEARCH_FREQUENT_FILTERS = [15, 10, 5] as const;
const QUICK_SEARCH_FREQUENT_FETCH_LIMIT = 50;

type QuickSearchHistoryEntry = {
  item: FoodItem;
  count: number;
  lastUsedAt: number;
};

function readQuickSearchHistory(): QuickSearchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUICK_SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is QuickSearchHistoryEntry =>
          !!entry &&
          typeof entry === "object" &&
          entry.item &&
          typeof entry.item.id === "string" &&
          typeof entry.count === "number" &&
          typeof entry.lastUsedAt === "number",
      )
      .slice(0, QUICK_SEARCH_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function writeQuickSearchHistory(entries: QuickSearchHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      QUICK_SEARCH_HISTORY_KEY,
      JSON.stringify(entries.slice(0, QUICK_SEARCH_HISTORY_LIMIT)),
    );
  } catch {}
}

function upsertQuickSearchHistoryItem(item: FoodItem) {
  const current = readQuickSearchHistory();
  const existing = current.find((entry) => entry.item.id === item.id);
  const nextEntries = existing
    ? current.map((entry) =>
        entry.item.id === item.id
          ? { ...entry, item, count: entry.count + 1, lastUsedAt: Date.now() }
          : entry,
      )
    : [{ item, count: 1, lastUsedAt: Date.now() }, ...current];

  nextEntries.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  writeQuickSearchHistory(nextEntries);
  return nextEntries;
}

function normalizeQuickSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .trim();
}

function matchesQuickSearchQuery(name: string, query: string) {
  const normalizedName = normalizeQuickSearchText(name);
  const normalizedQuery = normalizeQuickSearchText(query);
  if (!normalizedQuery) return true;

  const nameTokens = normalizedName.split(/[\s''()-]+/).filter(Boolean);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return queryTokens.every((queryToken) =>
    nameTokens.some(
      (nameToken) =>
        nameToken === queryToken || nameToken.startsWith(queryToken),
    ),
  );
}

function QuickSearch({
  onSelect,
  autoFocus = false,
  smartMode = false,
}: {
  onSelect: (item: FoodItem) => void;
  autoFocus?: boolean;
  smartMode?: boolean;
}) {
  const { lang, t } = useClientT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QuickSearchHistoryEntry[]>([]);
  const [backendFrequent, setBackendFrequent] = useState<
    QuickSearchHistoryEntry[]
  >([]);
  const searchCacheRef = useRef(new Map<string, FoodItem[]>());
  const CATEGORY_LABELS_T: Record<CategoryL1, string> = {
    proteins: t("food.cat.proteins"),
    carbs: t("food.cat.carbs"),
    vegetables: t("food.cat.vegetables"),
    fruits: t("food.cat.fruits"),
    fats: t("food.cat.fats"),
    drinks: t("food.cat.drinks"),
    extras: t("food.cat.extras"),
  };
  const SUBCATEGORY_LABELS_T: Record<string, string> = {
    viandes: t("food.sub.viandes"),
    poissons: t("food.sub.poissons"),
    oeufs: t("food.sub.oeufs"),
    laitiers: t("food.sub.laitiers"),
    vegetales: t("food.sub.vegetales"),
    complements: t("food.sub.complements"),
    cereales: t("food.sub.cereales"),
    fecules: t("food.sub.fecules"),
    pain: t("food.sub.pain"),
    legumineuses: t("food.sub.legumineuses"),
    feuilles: t("food.sub.feuilles"),
    cruciferes: t("food.sub.cruciferes"),
    "autres-legumes": t("food.sub.autres-legumes"),
    frais: t("food.sub.frais"),
    secs: t("food.sub.secs"),
    huiles: t("food.sub.huiles"),
    "noix-graines": t("food.sub.noix-graines"),
    "autres-lipides": t("food.sub.autres-lipides"),
    sauces: t("food.sub.sauces"),
    boissons: t("food.sub.boissons"),
    divers: t("food.sub.divers"),
    "snacks-sales": t("food.sub.snacks-sales"),
    "snacks-sucres": t("food.sub.snacks-sucres"),
    "fast-food": t("food.sub.fast-food"),
    eau: t("food.sub.eau"),
    chauds: t("food.sub.chauds"),
    "jus-smoothies": t("food.sub.jus-smoothies"),
    "laits-vegetaux": t("food.sub.laits-vegetaux"),
    "sports-drinks": t("food.sub.sports-drinks"),
    alcools: t("food.sub.alcools"),
  };

  useEffect(() => {
    setHistory(readQuickSearchHistory());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/client/nutrition/frequent-foods?limit=${QUICK_SEARCH_FREQUENT_FETCH_LIMIT}&meal_limit=240&min_count=${QUICK_SEARCH_FREQUENT_MIN_USES}`,
        );
        const json = await res.json();
        if (!res.ok || cancelled) return;
        const nextItems: unknown[] = Array.isArray(json.data) ? json.data : [];
        setBackendFrequent(
          nextItems.filter(
            (entry: unknown): entry is QuickSearchHistoryEntry =>
              !!entry &&
              typeof entry === "object" &&
              "item" in entry &&
              "count" in entry &&
              "lastUsedAt" in entry &&
              !!entry.item &&
              typeof entry.item === "object" &&
              "id" in entry.item &&
              typeof entry.item.id === "string" &&
              typeof entry.count === "number" &&
              typeof entry.lastUsedAt === "number",
          ),
        );
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recentItems = useMemo(
    () =>
      [...history]
        .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
        .slice(0, QUICK_SEARCH_RECENT_ITEMS_LIMIT),
    [history],
  );
  const allFrequentItems = useMemo(() => {
    const recentIds = new Set(recentItems.map((entry) => entry.item.id));
    const mergedById = new Map<string, QuickSearchHistoryEntry>();

    for (const entry of [...history, ...backendFrequent]) {
      const current = mergedById.get(entry.item.id);
      if (!current) {
        mergedById.set(entry.item.id, entry);
        continue;
      }
      mergedById.set(entry.item.id, {
        item: entry.item,
        count: Math.max(current.count, entry.count),
        lastUsedAt: Math.max(current.lastUsedAt, entry.lastUsedAt),
      });
    }

    return Array.from(mergedById.values())
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.lastUsedAt - a.lastUsedAt;
      })
      .filter((entry) => entry.count >= QUICK_SEARCH_FREQUENT_MIN_USES)
      .filter((entry) => !recentIds.has(entry.item.id));
  }, [backendFrequent, history, recentItems]);
  const availableFrequentFilters = useMemo(
    () =>
      QUICK_SEARCH_FREQUENT_FILTERS.filter((threshold) =>
        allFrequentItems.some((entry) => entry.count >= threshold),
      ),
    [allFrequentItems],
  );
  const [selectedFrequentThreshold, setSelectedFrequentThreshold] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (availableFrequentFilters.length === 0) {
      setSelectedFrequentThreshold(null);
      return;
    }

    setSelectedFrequentThreshold((current) => {
      if (
        current !== null &&
        availableFrequentFilters.includes(
          current as (typeof QUICK_SEARCH_FREQUENT_FILTERS)[number],
        )
      ) {
        return current;
      }
      return availableFrequentFilters[0];
    });
  }, [availableFrequentFilters]);

  const frequentItems = useMemo(
    () =>
      allFrequentItems.filter(
        (entry) =>
          entry.count >=
          (selectedFrequentThreshold ?? QUICK_SEARCH_FREQUENT_MIN_USES),
      ),
    [allFrequentItems, selectedFrequentThreshold],
  );
  const prioritizedQueryHistory = useMemo(() => {
    const query = q.trim();
    if (!query) return [];

    const mergedById = new Map<string, QuickSearchHistoryEntry>();
    for (const entry of [...history, ...backendFrequent]) {
      if (!matchesQuickSearchQuery(entry.item.name_fr, query)) continue;
      const current = mergedById.get(entry.item.id);
      if (!current) {
        mergedById.set(entry.item.id, entry);
        continue;
      }
      mergedById.set(entry.item.id, {
        item: entry.item,
        count: Math.max(current.count, entry.count),
        lastUsedAt: Math.max(current.lastUsedAt, entry.lastUsedAt),
      });
    }

    return Array.from(mergedById.values())
      .sort((a, b) => {
        if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
        return b.count - a.count;
      })
      .slice(0, 5);
  }, [backendFrequent, history, q]);
  const mergedQueryResults = useMemo(() => {
    if (!q.trim()) return results;

    const merged = [
      ...prioritizedQueryHistory.map((entry) => entry.item),
      ...results,
    ];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [prioritizedQueryHistory, q, results]);

  function handleSelect(item: FoodItem) {
    setQ("");
    setResults([]);
    setHistory(upsertQuickSearchHistoryItem(item));
    onSelect(item);
  }

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    const cacheKey = query.toLowerCase();
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      setLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(
        `/api/client/food-items?q=${encodeURIComponent(query)}&limit=8`,
      );
      const json = await res.json();
      const nextResults = (json.data ?? []) as FoodItem[];
      searchCacheRef.current.set(cacheKey, nextResults);
      setResults(nextResults);
      setLoading(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div>
      <div className="relative mb-2">
        <Search
          size={14}
          className={`absolute left-3 top-1/2 -translate-y-1/2 ${smartMode ? "text-white/36" : "text-white/30"}`}
        />
        <input
          autoFocus={autoFocus}
          type="text"
          placeholder={t("log.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`w-full h-11 pl-9 pr-10 rounded-xl text-[13px] text-white placeholder:text-white/20 outline-none ${smartMode ? "bg-white/[0.03]" : "bg-white/[0.04]"}`}
        />
        {q.trim() && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setResults([]);
            }}
            className={`absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center transition-all active:scale-95 ${smartMode ? "bg-white/[0.06] text-white/55 hover:text-white/80" : "bg-white/[0.06] text-white/45 hover:text-white/75"}`}
            aria-label={t("nutrition.quick.clearSearch")}
          >
            <X size={13} />
          </button>
        )}
      </div>
      {loading && (
        <div
          className={`h-10 rounded-xl animate-pulse ${smartMode ? "bg-white/[0.03]" : "bg-white/[0.04]"}`}
        />
      )}
      {!loading && q.trim() && mergedQueryResults.length === 0 && (
        <div
          className={`rounded-xl px-4 py-3 text-[12px] text-white/42 ${smartMode ? "bg-white/[0.03]" : "bg-white/[0.03]"}`}
        >
          {t("nutrition.quick.empty")}
        </div>
      )}
      {!loading && q.trim() && prioritizedQueryHistory.length > 0 && (
        <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
          {t("nutrition.quick.recentFirst")}
        </p>
      )}
      {!q.trim() && (recentItems.length > 0 || frequentItems.length > 0) && (
        <div className="space-y-3">
          {recentItems.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
                {t("nutrition.quick.recent")}
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {recentItems.map(({ item }) => (
                  <button
                    key={`recent-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="shrink-0 w-[148px] rounded-xl bg-white/[0.03] px-3 py-2.5 text-left active:scale-[0.98] transition-all hover:bg-white/[0.06]"
                  >
                    <FoodIcon food={item} size={42} className="mb-1" />
                    <p className="text-[12px] font-semibold leading-tight text-white whitespace-normal break-words">
                      {item.name_fr}
                    </p>
                    <p className="mt-1 text-[10px] text-white/38">
                      {item.kcal_per_100g} kcal/100g
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
          {frequentItems.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">
                  {t("nutrition.quick.frequent")}
                </p>
                {availableFrequentFilters.length > 0 && (
                  <div className="flex items-center gap-3">
                    {availableFrequentFilters.map((threshold) => {
                      const isActive = selectedFrequentThreshold === threshold;
                      return (
                        <button
                          key={`frequent-threshold-${threshold}`}
                          type="button"
                          onClick={() =>
                            setSelectedFrequentThreshold(threshold)
                          }
                          className={`text-[10px] uppercase tracking-[0.14em] font-semibold transition-colors ${
                            isActive
                              ? "text-white/88"
                              : "text-white/30 hover:text-white/55"
                          }`}
                        >
                          {threshold}x
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-1">
                {frequentItems.map(({ item, count }) => (
                  <button
                    key={`frequent-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-left active:scale-[0.98] transition-all hover:bg-white/[0.06]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <FoodIcon food={item} size={42} />
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-[12px] font-semibold leading-tight text-white whitespace-normal break-words">
                          {item.name_fr}
                        </p>
                        <p className="mt-0.5 text-[10px] text-white/38">
                          {item.kcal_per_100g} kcal/100g
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/45">
                      {count}×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {mergedQueryResults.map((item, index) => (
        <button
          key={item.id}
          onClick={() => handleSelect(item)}
          className="mb-1 w-full rounded-xl bg-white/[0.03] px-4 py-3 text-left active:scale-[0.98] transition-all hover:bg-white/[0.06]"
        >
          <div className="flex items-start justify-between gap-3">
            <FoodIcon food={item} size={42} />
            <div className="min-w-0 flex-1">
              <div className="min-w-0">
                <span className="block text-[13px] font-semibold leading-tight text-white whitespace-normal break-words">
                  {item.name_fr}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
                {index < prioritizedQueryHistory.length && (
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/45">
                    {t("nutrition.quick.recentBadge")}
                  </span>
                )}
                {item.is_verified && (
                  <span className="shrink-0 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/60">
                    {t("nutrition.quick.verifiedBadge")}
                  </span>
                )}
                <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/55">
                  {CATEGORY_LABELS_T[item.category_l1] ?? item.category_l1}
                </span>
                {item.category_l2 && (
                  <span className="shrink-0 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/40">
                    {SUBCATEGORY_LABELS_T[item.category_l2] ?? item.category_l2}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2.5 overflow-x-auto no-scrollbar whitespace-nowrap text-[11px] font-medium">
                <span className="shrink-0 text-white/42">
                  {item.kcal_per_100g} kcal/100g
                </span>
                <span
                  className="shrink-0"
                  style={{ color: NUTRITION_UI_COLORS.protein }}
                >
                  P {item.protein_per_100g}g
                </span>
                <span
                  className="shrink-0"
                  style={{ color: NUTRITION_UI_COLORS.carbs }}
                >
                  G {item.carbs_per_100g}g
                </span>
                <span
                  className="shrink-0"
                  style={{ color: NUTRITION_UI_COLORS.fat }}
                >
                  L {item.fat_per_100g}g
                </span>
              </div>
            </div>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-white/30">
              {t("nutrition.quick.addAction")}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Formulaire aliment personnalisé ─────────────────────────
function CustomFoodForm({
  onCreated,
  onClose,
}: {
  onCreated: (item: FoodItem) => void;
  onClose: () => void;
}) {
  const { lang, t } = useClientT();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<VisibleCategoryKey>("proteins");
  const [subcategory, setSubcategory] = useState<VisibleLeafKey>(
    getDefaultVisibleLeaf("proteins"),
  );
  const [kcal, setKcal] = useState("");
  const [prot, setProt] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const CATEGORY_LABELS_T = buildVisibleCategoryLabels(t);
  const SUBCATEGORY_LABELS_T = buildVisibleLeafLabels(lang, t);

  useEffect(() => {
    if (!VISIBLE_LEAVES_BY_CATEGORY[category].includes(subcategory)) {
      setSubcategory(getDefaultVisibleLeaf(category));
    }
  }, [category, subcategory]);

  async function submit() {
    if (!name.trim() || !kcal) {
      setError(t("log.custom.requiredError"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const storageCategory = getStorageCategoryFromVisibleLeaf(subcategory);
      const res = await fetch("/api/client/food-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_fr: name.trim(),
          category_l1: storageCategory.category_l1,
          category_l2: storageCategory.category_l2,
          kcal_per_100g: parseFloat(kcal) || 0,
          protein_per_100g: parseFloat(prot) || 0,
          carbs_per_100g: parseFloat(carbs) || 0,
          fat_per_100g: parseFloat(fat) || 0,
          fiber_per_100g: 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("log.custom.error"));
        return;
      }
      onCreated(json.data);
    } catch {
      setError(t("log.custom.networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 bg-white/[0.04] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
          {t("log.custom.title")}
        </p>
        <button
          onClick={onClose}
          className="text-white/20 hover:text-white/60 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <input
        type="text"
        placeholder={t("log.custom.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white placeholder:text-white/20 outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] text-white/30">
            {t("log.custom.category")}
          </p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as VisibleCategoryKey)}
            className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none"
          >
            {(
              Object.entries(CATEGORY_LABELS_T) as [
                VisibleCategoryKey,
                string,
              ][]
            ).map(([value, label]) => (
              <option
                key={value}
                value={value}
                className="bg-[#0d0d0d] text-white"
              >
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-white/30">
            {t("log.custom.subcategory")}
          </p>
          <select
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value as VisibleLeafKey)}
            className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none"
          >
            {VISIBLE_LEAVES_BY_CATEGORY[category].map((value) => (
              <option
                key={value}
                value={value}
                className="bg-[#0d0d0d] text-white"
              >
                {SUBCATEGORY_LABELS_T[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[9px] uppercase tracking-[0.16em] text-white/25">
        {t("log.custom.per100")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            label: t("log.custom.calories"),
            value: kcal,
            set: setKcal,
            required: true,
          },
          {
            label: t("log.custom.protein"),
            value: prot,
            set: setProt,
            required: false,
          },
          {
            label: t("log.custom.carbs"),
            value: carbs,
            set: setCarbs,
            required: false,
          },
          {
            label: t("log.custom.fat"),
            value: fat,
            set: setFat,
            required: false,
          },
        ].map(({ label, value, set, required }) => (
          <div key={label} className="space-y-1">
            <p className="text-[10px] text-white/30">
              {label}
              {required && " *"}
            </p>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => set(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-full h-9 px-3 min-w-0 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none"
            />
          </div>
        ))}
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={saving || !name.trim() || !kcal}
        className="w-full h-10 flex items-center justify-center gap-2 bg-[#f2f2f2] hover:bg-[#f2f2f2]/90 disabled:opacity-40 text-[#080808] text-[12px] font-bold uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-all"
      >
        <Check size={14} />
        {saving ? t("log.custom.creating") : t("log.custom.createCta")}
      </button>
    </div>
  );
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
  items: CustomFoodCatalogItem[];
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  editingItem: CustomFoodCatalogItem | null;
  onEdit: (item: CustomFoodCatalogItem | null) => void;
  onEditDone: () => void;
  onDeleteDone: () => void;
  onSelect: (item: FoodItem) => void;
  onClose: () => void;
}) {
  const { lang, t } = useClientT();
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const CATEGORY_LABELS_T = buildVisibleCategoryLabels(t);
  const SUBCATEGORY_LABELS_T = buildVisibleLeafLabels(lang, t);

  async function handleDelete(item: CustomFoodCatalogItem) {
    setBusyDeleteId(item.id);
    setDeleteError("");
    try {
      const res = await fetch(
        `/api/client/food-items?id=${encodeURIComponent(item.id)}`,
        {
          method: "DELETE",
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(json.error ?? t("activity.error.delete.permanent"));
        return;
      }
      onDeleteDone();
    } catch {
      setDeleteError(t("log.custom.networkError"));
    } finally {
      setBusyDeleteId(null);
    }
  }

  return (
    <div className="mt-3 bg-white/[0.04] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
            {t("nutrition.myFoods.title")}
          </p>
          <p className="text-[12px] text-white/55 mt-1">
            {t("nutrition.myFoods.desc")}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white/20 hover:text-white/60 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("nutrition.myFoods.search")}
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
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-16 bg-white/[0.06] rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white/[0.03] px-4 py-5 text-center">
          <p className="text-[12px] text-white/60">
            {t("nutrition.myFoods.empty")}
          </p>
          <p className="text-[11px] text-white/35 mt-1">
            {t("nutrition.myFoods.emptyDesc")}
          </p>
        </div>
      ) : (
        <div className="bg-white/[0.03] rounded-2xl overflow-hidden">
          {items.map((item) => {
            const visibleSelection = resolveVisibleSelection(item);
            return (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <FoodIcon food={item} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white">
                      {item.name_fr}
                    </p>
                    <p className="text-[11px] text-white/40 mt-1">
                      {CATEGORY_LABELS_T[visibleSelection.category]} ·{" "}
                      {SUBCATEGORY_LABELS_T[visibleSelection.leaf]}
                    </p>
                    <p className="text-[11px] text-white/30 mt-1">
                      {Math.round(item.kcal_per_100g)} kcal · P{" "}
                      {item.protein_per_100g} · G {item.carbs_per_100g} · L{" "}
                      {item.fat_per_100g}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onSelect(item)}
                      className="h-8 px-3 rounded-xl bg-white/[0.06] text-[11px] font-semibold text-white/80 active:scale-95 transition-all"
                    >
                      {t("common.add")}
                    </button>
                    <button
                      onClick={() => onEdit(item)}
                      className="h-8 w-8 rounded-xl bg-white/[0.06] text-white/60 flex items-center justify-center active:scale-95 transition-all"
                      aria-label={t("nutrition.myFoods.editAction", {
                        name: item.name_fr,
                      })}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={busyDeleteId === item.id}
                      className="h-8 w-8 rounded-xl bg-[#ff8660]/10 text-[#ffb39a] flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
                      aria-label={t("nutrition.myFoods.deleteAction", {
                        name: item.name_fr,
                      })}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditableCustomFoodForm({
  item,
  onCancel,
  onSaved,
}: {
  item: CustomFoodCatalogItem;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { lang, t } = useClientT();
  const selected = resolveVisibleSelection(item);
  const [name, setName] = useState(item.name_fr);
  const [category, setCategory] = useState<VisibleCategoryKey>(
    selected.category,
  );
  const [subcategory, setSubcategory] = useState<VisibleLeafKey>(selected.leaf);
  const [kcal, setKcal] = useState(String(item.kcal_per_100g ?? ""));
  const [prot, setProt] = useState(String(item.protein_per_100g ?? ""));
  const [carbs, setCarbs] = useState(String(item.carbs_per_100g ?? ""));
  const [fat, setFat] = useState(String(item.fat_per_100g ?? ""));
  const [fiber, setFiber] = useState(String(item.fiber_per_100g ?? "0"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const CATEGORY_LABELS_T = buildVisibleCategoryLabels(t);
  const SUBCATEGORY_LABELS_T = buildVisibleLeafLabels(lang, t);

  useEffect(() => {
    const nextSelected = resolveVisibleSelection(item);
    setName(item.name_fr);
    setCategory(nextSelected.category);
    setSubcategory(nextSelected.leaf);
    setKcal(String(item.kcal_per_100g ?? ""));
    setProt(String(item.protein_per_100g ?? ""));
    setCarbs(String(item.carbs_per_100g ?? ""));
    setFat(String(item.fat_per_100g ?? ""));
    setFiber(String(item.fiber_per_100g ?? "0"));
    setError("");
  }, [item]);

  useEffect(() => {
    if (!VISIBLE_LEAVES_BY_CATEGORY[category].includes(subcategory)) {
      setSubcategory(getDefaultVisibleLeaf(category));
    }
  }, [category, subcategory]);

  async function submit() {
    if (!name.trim() || !kcal) {
      setError(t("log.custom.requiredError"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      const storageCategory = getStorageCategoryFromVisibleLeaf(subcategory);
      const res = await fetch("/api/client/food-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          name_fr: name.trim(),
          category_l1: storageCategory.category_l1,
          category_l2: storageCategory.category_l2,
          kcal_per_100g: parseFloat(kcal) || 0,
          protein_per_100g: parseFloat(prot) || 0,
          carbs_per_100g: parseFloat(carbs) || 0,
          fat_per_100g: parseFloat(fat) || 0,
          fiber_per_100g: parseFloat(fiber) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("activity.error.update"));
        return;
      }
      onSaved();
    } catch {
      setError(t("log.custom.networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 font-semibold">
            {t("nutrition.myFoods.editTitle")}
          </p>
          <p className="text-[12px] text-white/55 mt-1">
            {t("nutrition.myFoods.editDesc")}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-white/20 hover:text-white/60 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] text-white/30">
            {t("log.custom.category")}
          </p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as VisibleCategoryKey)}
            className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none"
          >
            {(
              Object.entries(CATEGORY_LABELS_T) as [
                VisibleCategoryKey,
                string,
              ][]
            ).map(([value, label]) => (
              <option
                key={value}
                value={value}
                className="bg-[#0d0d0d] text-white"
              >
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-white/30">
            {t("log.custom.subcategory")}
          </p>
          <select
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value as VisibleLeafKey)}
            className="w-full h-10 px-3 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none"
          >
            {VISIBLE_LEAVES_BY_CATEGORY[category].map((value) => (
              <option
                key={value}
                value={value}
                className="bg-[#0d0d0d] text-white"
              >
                {SUBCATEGORY_LABELS_T[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          {
            label: t("log.custom.calories"),
            value: kcal,
            set: setKcal,
            required: true,
          },
          {
            label: t("log.custom.protein"),
            value: prot,
            set: setProt,
            required: false,
          },
          {
            label: t("log.custom.carbs"),
            value: carbs,
            set: setCarbs,
            required: false,
          },
          {
            label: t("log.custom.fat"),
            value: fat,
            set: setFat,
            required: false,
          },
          {
            label: t("log.custom.fiber"),
            value: fiber,
            set: setFiber,
            required: false,
          },
        ].map(({ label, value, set, required }) => (
          <div key={label} className="space-y-1">
            <p className="text-[10px] text-white/30">
              {label}
              {required && " *"}
            </p>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => set(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-full h-9 px-3 min-w-0 bg-white/[0.06] rounded-xl text-[13px] text-white outline-none"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onCancel}
          className="h-10 rounded-xl bg-white/[0.04] text-white/70 text-[12px] font-semibold active:scale-[0.98] transition-all"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={submit}
          disabled={saving || !name.trim() || !kcal}
          className="h-10 flex items-center justify-center gap-2 bg-[#f2f2f2] disabled:opacity-40 text-[#080808] text-[12px] font-bold uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-all"
        >
          <Check size={14} />
          {saving ? t("nutrition.myFoods.updateSaving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
