import { computeMacroEnergy } from '@/lib/nutrition/energy'

export type CategoryL1 =
  | "proteins"
  | "carbs"
  | "vegetables"
  | "fruits"
  | "fats"
  | "drinks"
  | "extras"

export type MealType = "breakfast" | "lunch" | "dinner" | "snack"
export type InputMode = "composer" | "portion" | "photo_ai" | "voice" | "text" | "photo_guided"

export interface FoodItem {
  id: string
  name_fr: string
  category_l1: CategoryL1
  category_l2: string | null
  icon_key: string | null
  item_key: string
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
  source: string
  is_verified: boolean
}

export interface NutritionEntry {
  id: string
  meal_id: string
  client_id: string
  food_item_id: string
  food_item?: FoodItem
  physiological_date: string
  quantity_g: number
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  input_mode: InputMode
  confidence_score: number
}

export interface NutritionMeal {
  id: string
  client_id: string
  physiological_date: string
  title: string | null
  meal_type: MealType
  meal_source?: "manual" | "voice" | "text" | "composer" | "auto_adjusted" | "flash_estimate" | "photo_guided" | null
  photo_log_status?: "capturing" | "analyzing" | "clarifying" | "ready_to_log" | "logged" | "refined" | "failed" | null
  logged_at: string
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  total_fiber_g: number
  photo_urls?: string[]
  notes: string | null
  entries?: NutritionEntry[]
}

export interface EntryDraft {
  food_item: FoodItem
  quantity_g: number
  input_mode: InputMode
}

/** Profil pour scaling portions anatomiques */
export interface PortionScalingProfile {
  hand_length_cm?: number | null
  height_cm?: number | null
}

export interface PortionSize {
  key: string
  label: string
  baseG: number
  /** 'hand' = scale avec longueur main user, 'fixed' = ustensile/unité produit, taille constante */
  scales: "hand" | "fixed"
  description: string
}

/**
 * Portions visuelles standard.
 * Référence main adulte: 18cm (longueur poignet → bout majeur).
 * Anatomique (paume/poing/pouce) → scale × (handCm / 18).
 * Fixed (cuillère/verre/œuf) → constant.
 */
export const PORTION_SIZES: PortionSize[] = [
  // Anatomiques (scale hand)
  { key: "palm",            label: "Paume",                baseG: 100, scales: "hand",  description: "Viande, poisson (sans doigts)" },
  { key: "half-palm",       label: "Demi-paume",           baseG: 50,  scales: "hand",  description: "Petits snacks, fromage tranché" },
  { key: "fist",            label: "Poing fermé",          baseG: 150, scales: "hand",  description: "Féculents cuits" },
  { key: "fist-dry",        label: "Poing (féculents secs)", baseG: 50,  scales: "hand",  description: "Riz/pâtes crus, flocons" },
  { key: "thumb",           label: "Pouce entier",         baseG: 15,  scales: "hand",  description: "Lipides denses, fromage" },
  { key: "pinch",           label: "Pince pouce-index",    baseG: 1,   scales: "hand",  description: "Sel, épices" },
  { key: "cupped-hands",    label: "Deux mains en coupe",  baseG: 50,  scales: "hand",  description: "Légumes feuilles" },
  { key: "bowl-hands",      label: "Bol mains jointes",    baseG: 250, scales: "hand",  description: "Céréales, soupes" },
  // Fixed (ustensiles + unités produit)
  { key: "tbsp",            label: "Cuillère à soupe",     baseG: 12,  scales: "fixed", description: "Huiles, sauces" },
  { key: "tbsp-heaped",     label: "Cuillère bombée",      baseG: 18,  scales: "fixed", description: "Beurre noix, compote" },
  { key: "tsp",             label: "Cuillère à café",      baseG: 4,   scales: "fixed", description: "Condiments, épices" },
  { key: "plate",           label: "Assiette standard",    baseG: 300, scales: "fixed", description: "Légumes cuits" },
  { key: "bread-slice",     label: "Tranche de pain",      baseG: 35,  scales: "fixed", description: "Pain standard" },
  { key: "egg-medium",      label: "Œuf moyen",            baseG: 55,  scales: "fixed", description: "Œuf entier moyen" },
  { key: "glass",           label: "Verre standard",       baseG: 200, scales: "fixed", description: "Liquides (eau/lait/jus)" },
]

/** Référence adulte (longueur main poignet → majeur, cm) */
export const REFERENCE_HAND_CM = 18.0
/** Ratio Pheasant 2003 — longueur main ≈ taille × 0.108 */
export const HEIGHT_TO_HAND_RATIO = 0.108
/** Multiplicateurs disponibles dans l'UI (×1 à ×5) */
export const PORTION_MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 4, 5] as const

/**
 * Retourne longueur main estimée (cm) : override user → dérivée taille → défaut 18.
 */
export function resolveHandLengthCm(profile: PortionScalingProfile | null | undefined): number {
  if (!profile) return REFERENCE_HAND_CM
  if (profile.hand_length_cm && profile.hand_length_cm > 0) return profile.hand_length_cm
  if (profile.height_cm && profile.height_cm > 0) return profile.height_cm * HEIGHT_TO_HAND_RATIO
  return REFERENCE_HAND_CM
}

/**
 * Calcule grammes scalés d'une portion selon profil + multiplicateur.
 * Multiplicateur appliqué après scaling main (×2 = deux fois la portion).
 */
export function getScaledPortionG(
  portion: PortionSize,
  profile: PortionScalingProfile | null | undefined,
  multiplier: number = 1
): number {
  const mult = Math.max(0.5, Math.min(multiplier, 10))
  if (portion.scales === "fixed") return Math.round(portion.baseG * mult)
  const handCm = resolveHandLengthCm(profile)
  const factor = handCm / REFERENCE_HAND_CM
  return Math.round(portion.baseG * factor * mult)
}

/** True si profil a override main explicite (badge UI "ajusté à ta main") */
export function isHandOverrideSet(profile: PortionScalingProfile | null | undefined): boolean {
  return !!(profile?.hand_length_cm && profile.hand_length_cm > 0)
}

export const CATEGORY_LABELS: Record<CategoryL1, string> = {
  proteins: "Protéines",
  carbs: "Glucides",
  vegetables: "Légumes",
  fruits: "Fruits",
  fats: "Lipides",
  drinks: "Boissons",
  extras: "Snacks & Extras",
}

export const SUBCATEGORY_LABELS: Record<string, string> = {
  viandes: "Viandes",
  poissons: "Poissons",
  oeufs: "Œufs",
  laitiers: "Produits laitiers",
  vegetales: "Protéines végétales",
  complements: "Compléments",
  cereales: "Céréales",
  fecules: "Féculents",
  pain: "Pain & Tortillas",
  legumineuses: "Légumineuses",
  feuilles: "Feuilles",
  cruciferes: "Crucifères",
  "autres-legumes": "Autres légumes",
  frais: "Fruits frais",
  secs: "Fruits secs",
  huiles: "Huiles",
  "noix-graines": "Noix & Graines",
  "autres-lipides": "Autres",
  sauces: "Sauces & Condiments",
  boissons: "Boissons",
  divers: "Divers",
  "snacks-sales": "Snacks salés",
  "snacks-sucres": "Snacks & Sucreries",
  "fast-food": "Fast-food",
  // drinks subcategories
  eau: "Eau & Hydratation",
  chauds: "Boissons chaudes",
  "jus-smoothies": "Jus & Smoothies",
  "laits-vegetaux": "Laits végétaux",
  "sports-drinks": "Boissons sportives",
  alcools: "Alcools",
}

/** Calcule les macros d'une entrée depuis food_item + quantité */
export function calcEntryMacros(
  item: FoodItem,
  quantity_g: number
): Pick<NutritionEntry, "calories_kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g"> {
  const factor = quantity_g / 100
  const protein_g = Math.round(item.protein_per_100g * factor * 10) / 10
  const carbs_g = Math.round(item.carbs_per_100g * factor * 10) / 10
  const fat_g = Math.round(item.fat_per_100g * factor * 10) / 10
  const fiber_g = Math.round(item.fiber_per_100g * factor * 10) / 10
  return {
    calories_kcal: computeMacroEnergy({ protein_g, carbs_g, fat_g, fiber_g }),
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
  }
}

/** Somme les macros d'une liste d'entrées draft */
export function sumDraftMacros(entries: EntryDraft[]): {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
} {
  return entries.reduce(
    (acc, e) => {
      const m = calcEntryMacros(e.food_item, e.quantity_g)
      return {
        calories: Math.round((acc.calories + m.calories_kcal) * 10) / 10,
        protein: Math.round((acc.protein + m.protein_g) * 10) / 10,
        carbs: Math.round((acc.carbs + m.carbs_g) * 10) / 10,
        fat: Math.round((acc.fat + m.fat_g) * 10) / 10,
        fiber: Math.round((acc.fiber + m.fiber_g) * 10) / 10,
      }
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  )
}
