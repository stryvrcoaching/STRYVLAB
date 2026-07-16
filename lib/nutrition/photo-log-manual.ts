import type { CategoryL1 } from "@/lib/nutrition/food-items"
import type { PhotoMealFinalComponent } from "@/lib/nutrition/photo-log-types"

type ManualComponentReference = {
  name_fr: string
  category_hint: CategoryL1
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
}

const EGG_WHITE_REFERENCE: ManualComponentReference = {
  name_fr: "Blanc d'oeuf",
  category_hint: "proteins",
  kcal_per_100g: 52,
  protein_per_100g: 10.9,
  carbs_per_100g: 0.7,
  fat_per_100g: 0.2,
  fiber_per_100g: 0,
}

const EGG_YOLK_REFERENCE: ManualComponentReference = {
  name_fr: "Jaune d'oeuf",
  category_hint: "proteins",
  kcal_per_100g: 322,
  protein_per_100g: 15.9,
  carbs_per_100g: 3.6,
  fat_per_100g: 26.5,
  fiber_per_100g: 0,
}

const EGG_WHOLE_REFERENCE: ManualComponentReference = {
  name_fr: "Oeufs entiers",
  category_hint: "proteins",
  kcal_per_100g: 155,
  protein_per_100g: 13,
  carbs_per_100g: 1.1,
  fat_per_100g: 11,
  fiber_per_100g: 0,
}

const COOKED_RICE_REFERENCE: ManualComponentReference = {
  name_fr: "Riz cuit",
  category_hint: "carbs",
  kcal_per_100g: 130,
  protein_per_100g: 2.5,
  carbs_per_100g: 28,
  fat_per_100g: 0.3,
  fiber_per_100g: 0.4,
}

const CHICKEN_REFERENCE: ManualComponentReference = {
  name_fr: "Poulet",
  category_hint: "proteins",
  kcal_per_100g: 165,
  protein_per_100g: 31,
  carbs_per_100g: 0,
  fat_per_100g: 3.6,
  fiber_per_100g: 0,
}

const BEEF_STRIPS_REFERENCE: ManualComponentReference = {
  name_fr: "Emince de boeuf saute",
  category_hint: "proteins",
  kcal_per_100g: 195,
  protein_per_100g: 29,
  carbs_per_100g: 3,
  fat_per_100g: 8,
  fiber_per_100g: 0,
}

const COOKED_LENTILS_REFERENCE: ManualComponentReference = {
  name_fr: "Lentilles cuites",
  category_hint: "carbs",
  kcal_per_100g: 116,
  protein_per_100g: 9,
  carbs_per_100g: 20,
  fat_per_100g: 0.4,
  fiber_per_100g: 8,
}

const COOKED_POTATO_REFERENCE: ManualComponentReference = {
  name_fr: "Pommes de terre cuites",
  category_hint: "carbs",
  kcal_per_100g: 85,
  protein_per_100g: 2,
  carbs_per_100g: 20,
  fat_per_100g: 0.1,
  fiber_per_100g: 1.8,
}

const COOKED_SWEET_POTATO_REFERENCE: ManualComponentReference = {
  name_fr: "Patate douce cuite",
  category_hint: "carbs",
  kcal_per_100g: 86,
  protein_per_100g: 1.6,
  carbs_per_100g: 20.1,
  fat_per_100g: 0.1,
  fiber_per_100g: 3,
}

const PAN_FRIED_POTATO_REFERENCE: ManualComponentReference = {
  name_fr: "Pommes de terre sautees maison",
  category_hint: "carbs",
  kcal_per_100g: 170,
  protein_per_100g: 2.5,
  carbs_per_100g: 24,
  fat_per_100g: 7,
  fiber_per_100g: 2.4,
}

const COOKED_PORK_REFERENCE: ManualComponentReference = {
  name_fr: "Porc cuit",
  category_hint: "proteins",
  kcal_per_100g: 180,
  protein_per_100g: 25,
  carbs_per_100g: 0,
  fat_per_100g: 8,
  fiber_per_100g: 0,
}

const SKINLESS_CHICKEN_THIGH_REFERENCE: ManualComponentReference = {
  name_fr: "Haut de cuisse de poulet cuit, sans peau",
  category_hint: "proteins",
  kcal_per_100g: 179,
  protein_per_100g: 24.8,
  carbs_per_100g: 0,
  fat_per_100g: 8.2,
  fiber_per_100g: 0,
}

const BRAISED_PORK_REFERENCE: ManualComponentReference = {
  name_fr: "Porc mijoté cuit",
  category_hint: "proteins",
  kcal_per_100g: 190,
  protein_per_100g: 26,
  carbs_per_100g: 0,
  fat_per_100g: 9,
  fiber_per_100g: 0,
}

const HONEY_RINGS_REFERENCE: ManualComponentReference = {
  name_fr: "Céréales Honey Rings",
  category_hint: "carbs",
  kcal_per_100g: 379,
  protein_per_100g: 10,
  carbs_per_100g: 74,
  fat_per_100g: 3.1,
  fiber_per_100g: 7.5,
}

const SEMI_SKIMMED_MILK_REFERENCE: ManualComponentReference = {
  name_fr: "Lait demi-écrémé",
  category_hint: "drinks",
  kcal_per_100g: 46,
  protein_per_100g: 3.4,
  carbs_per_100g: 4.8,
  fat_per_100g: 1.52,
  fiber_per_100g: 0,
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
}

const MANUAL_MATCH_STOPWORDS = new Set([
  "de",
  "des",
  "du",
  "d",
  "la",
  "le",
  "les",
  "et",
  "avec",
  "au",
  "aux",
  "a",
  "un",
  "une",
  "entier",
  "entiers",
  "entiere",
  "entieres",
  "cuit",
  "cuits",
  "cuite",
  "cuites",
])

type ManualQuantityHint = {
  label: string
  quantityG: number
  normalizedLabel: string
  tokens: string[]
}

type ManualConsumptionAdjustment = {
  mode: "subtract_grams" | "scale_ratio"
  targetTokens: string[] | null
  quantityG?: number
  ratio?: number
  sourceNote: string
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
}

const CONSUMPTION_ADJUSTMENT_PROFILES = [
  {
    targetTokens: ["oeuf", "oeufs", "egg", "eggs"],
    removablePartPatterns: [
      {
        partTokens: ["jaune", "jaunes"],
        defaultUnitWeightG: 15,
        label: "jaune retiré",
      },
    ],
  },
  {
    targetTokens: ["poulet", "chicken", "cuisse", "cuisses", "aile", "ailes"],
    nonEdibleKeywords: ["os"],
    edibleYieldRatio: 0.65,
    label: "Part non consommable prise en compte dans la note utilisateur.",
  },
  {
    targetTokens: ["poisson", "saumon", "truite", "bar", "dorade"],
    nonEdibleKeywords: ["arete", "aretes"],
    edibleYieldRatio: 0.72,
    label: "Part non consommable prise en compte dans la note utilisateur.",
  },
  {
    targetTokens: ["crevette", "crevettes", "shrimp"],
    nonEdibleKeywords: ["coquille", "coquilles", "carapace", "carapaces"],
    edibleYieldRatio: 0.55,
    label: "Part non consommable prise en compte dans la note utilisateur.",
  },
] as const

function toNumber(raw: string | undefined) {
  if (!raw) return null
  const value = Number(raw.replace(",", "."))
  return Number.isFinite(value) ? value : null
}

function tokenizeManualLabel(value: string) {
  return normalizeText(value)
    .replace(/['’]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !MANUAL_MATCH_STOPWORDS.has(token))
}

function extractManualQuantityHints(detail: string | null | undefined): ManualQuantityHint[] {
  const raw = String(detail ?? "").trim()
  if (!raw) return []

  const hints: ManualQuantityHint[] = []
  const normalizedRaw = raw.replace(/\s+/g, " ").trim()
  const inlinePattern = /(\d+(?:[.,]\d+)?)\s*(?:g|grammes?|ml)\s+(?:de\s+)?(.+?)(?=(?:\s+\d+(?:[.,]\d+)?\s*(?:g|grammes?|ml)\s+(?=[a-zA-ZÀ-ÿ]))|$)/gi

  for (const match of normalizedRaw.matchAll(inlinePattern)) {
    const quantityG = toNumber(match[1])
    const label = String(match[2] ?? "").trim()
    if (!quantityG || quantityG <= 0 || !label) continue

    hints.push({
      label,
      quantityG,
      normalizedLabel: normalizeText(label),
      tokens: tokenizeManualLabel(label),
    })
  }

  return hints
}

function scoreManualHintMatch(componentName: string, hint: ManualQuantityHint) {
  const normalizedComponent = normalizeText(componentName)
  const componentTokens = tokenizeManualLabel(componentName)
  if (!componentTokens.length || !hint.tokens.length) return 0

  const overlap = componentTokens.filter((token) => hint.tokens.includes(token)).length
  if (overlap <= 0) return 0

  let score =
    (overlap / componentTokens.length) * 0.7 +
    (overlap / hint.tokens.length) * 0.3

  if (
    normalizedComponent.includes(hint.normalizedLabel) ||
    hint.normalizedLabel.includes(normalizedComponent)
  ) {
    score += 0.25
  }

  return score
}

function buildManualComponent(
  reference: ManualComponentReference,
  quantityG: number,
  sourceNote: string,
): PhotoMealFinalComponent {
  return {
    name_fr: reference.name_fr,
    category_hint: reference.category_hint,
    quantity_g: Math.round(quantityG),
    quantity_source: "user_note",
    kcal_per_100g: reference.kcal_per_100g,
    protein_per_100g: reference.protein_per_100g,
    carbs_per_100g: reference.carbs_per_100g,
    fat_per_100g: reference.fat_per_100g,
    fiber_per_100g: reference.fiber_per_100g,
    source_note: sourceNote,
    nutrition_source: "user_note",
    component_confidence: 0.96,
    catalog_metadata: {
      reusable: true,
      canonical_name_fr: reference.name_fr,
    },
  }
}

function parseExplicitGramMatch(detail: string, pattern: RegExp) {
  const match = detail.match(pattern)
  const grams = toNumber(match?.[1])
  return grams && grams > 0 ? grams : null
}

function toCount(raw: string | undefined) {
  if (!raw) return null
  const normalized = normalizeText(raw).trim()
  if (!normalized) return null
  if (/^\d+$/.test(normalized)) return Number(normalized)
  return NUMBER_WORDS[normalized] ?? null
}

function resolveRemovedYolkGrams(detail: string) {
  const removalPatterns = [
    /(?:moins|sans|retrait\s+de|retire|retirer)\s+(?:(\d+|un|une)\s+)?jaunes?(?:\s+d[' ]oeuf)?(?:[^0-9]{0,24})(\d+(?:[.,]\d+)?)\s*g/i,
    /(?:moins|sans|retrait\s+de|retire|retirer)\s+(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?(?:\s+de)?\s+jaunes?(?:\s+d[' ]oeuf)?/i,
  ]

  for (const pattern of removalPatterns) {
    const match = detail.match(pattern)
    if (!match) continue
    const directGrams = toNumber(match[2] ?? match[1])
    if (directGrams && directGrams > 0) return directGrams
  }

  const countPatterns = [
    /(?:moins|sans|retrait\s+de|retire|retirer)\s+(\d+|un|une)\s+jaunes?(?:\s+d[' ]oeuf)?/i,
  ]

  for (const pattern of countPatterns) {
    const match = detail.match(pattern)
    if (!match) continue
    const yolkCount = toCount(match[1])
    if (yolkCount && yolkCount > 0) return yolkCount * 15
  }

  return null
}

function hasAffirmativeNonEdibleMention(detail: string, keywords: readonly string[]) {
  return keywords.some((keyword) => {
    const negativePattern = new RegExp(`sans\\s+${keyword}\\b`, "i")
    if (negativePattern.test(detail)) return false

    const positivePatterns = [
      new RegExp(`avec\\s+${keyword}\\b`, "i"),
      new RegExp(`(?:inclu|inclus|incluse|inclues|compris|comprise|comprises)\\s*(?:dans|au)?\\s*(?:le|la|les)?\\s*poids?.{0,12}${keyword}\\b`, "i"),
      new RegExp(`poids\\s+(?:avec|brut).{0,12}${keyword}\\b`, "i"),
    ]

    return positivePatterns.some((pattern) => pattern.test(detail))
  })
}

function resolveMealConsumptionRatio(detail: string) {
  const directPercentPatterns = [
    /(?:j[' ]ai\s+)?(?:mange|mangé|consomme|consommé)\s+(\d{1,3})\s*%/i,
    /(?:portion|part)\s+consommee?\s*[:=-]?\s*(\d{1,3})\s*%/i,
  ]

  for (const pattern of directPercentPatterns) {
    const match = detail.match(pattern)
    const percent = toNumber(match?.[1])
    if (percent && percent > 0 && percent <= 100) {
      return percent / 100
    }
  }

  const leftoverPercentPatterns = [
    /(?:j[' ]ai\s+)?(?:laisse|laissé|garde|gardé)\s+(\d{1,3})\s*%/i,
    /(?:il\s+)?reste\s+(\d{1,3})\s*%/i,
  ]

  for (const pattern of leftoverPercentPatterns) {
    const match = detail.match(pattern)
    const percent = toNumber(match?.[1])
    if (percent && percent >= 0 && percent < 100) {
      return Math.max(0, 1 - percent / 100)
    }
  }

  const halfConsumedPatterns = [
    /(?:j[' ]ai\s+)?(?:mange|mangé|consomme|consommé)\s+(?:seulement\s+)?la\s+moitie/i,
    /(?:portion|part)\s+consommee?\s*[:=-]?\s*moitie/i,
  ]
  if (halfConsumedPatterns.some((pattern) => pattern.test(detail))) return 0.5

  const halfLeftPatterns = [
    /(?:j[' ]ai\s+)?(?:laisse|laissé|garde|gardé).{0,24}la\s+moitie/i,
    /(?:il\s+)?reste\s+la\s+moitie/i,
  ]
  if (halfLeftPatterns.some((pattern) => pattern.test(detail))) return 0.5

  return null
}

function extractManualConsumptionAdjustments(detail: string | null | undefined): ManualConsumptionAdjustment[] {
  const normalized = normalizeText(detail)
  if (!normalized) return []

  const adjustments: ManualConsumptionAdjustment[] = []

  for (const profile of CONSUMPTION_ADJUSTMENT_PROFILES) {
    for (const removablePart of profile.removablePartPatterns ?? []) {
      const removedQuantityG =
        removablePart.partTokens.includes("jaune")
          ? resolveRemovedYolkGrams(normalized)
          : null

      if (!removedQuantityG || removedQuantityG <= 0) continue

      adjustments.push({
        mode: "subtract_grams",
        targetTokens: [...profile.targetTokens],
        quantityG: removedQuantityG,
        sourceNote: `${removablePart.label[0]?.toUpperCase() ?? ""}${removablePart.label.slice(1)} pris en compte dans la note utilisateur.`,
      })
    }

    if (
      "nonEdibleKeywords" in profile &&
      profile.nonEdibleKeywords?.length &&
      profile.edibleYieldRatio &&
      hasAffirmativeNonEdibleMention(normalized, profile.nonEdibleKeywords)
    ) {
      adjustments.push({
        mode: "scale_ratio",
        targetTokens: [...profile.targetTokens],
        ratio: profile.edibleYieldRatio,
        sourceNote: profile.label,
      })
    }
  }

  const consumedRatio = resolveMealConsumptionRatio(normalized)
  if (consumedRatio && consumedRatio > 0 && consumedRatio < 1) {
    adjustments.push({
      mode: "scale_ratio",
      targetTokens: null,
      ratio: consumedRatio,
      sourceNote: "Part réellement consommée prise en compte dans la note utilisateur.",
    })
  }

  return adjustments
}

function distributeCompositeQuantity(
  totalQuantityG: number,
  parts: Array<{ reference: ManualComponentReference; ratio: number; note: string }>,
) {
  const safeTotal = Math.round(totalQuantityG)
  if (safeTotal <= 0 || parts.length === 0) return [] as PhotoMealFinalComponent[]

  const normalizedParts = parts.map((part) => ({ ...part, quantity: Math.round(safeTotal * part.ratio) }))
  const allocated = normalizedParts.reduce((sum, part) => sum + part.quantity, 0)
  const delta = safeTotal - allocated
  if (delta !== 0 && normalizedParts[0]) {
    normalizedParts[0].quantity += delta
  }

  return normalizedParts
    .filter((part) => part.quantity > 0)
    .map((part) =>
      buildManualComponent(
        part.reference,
        part.quantity,
        `${part.note} Répartition prudente d'un mélange indiqué dans la note utilisateur (${safeTotal} g au total).`,
      ),
    )
}

export function parseManualPlateComponents(detail: string | null | undefined): PhotoMealFinalComponent[] {
  const normalized = normalizeText(detail)
  if (!normalized) return []

  const components: PhotoMealFinalComponent[] = []
  const wholeEggMinusYolkTotal = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+oeufs?\s+entiers?/i,
  )
  const removedYolkG = resolveRemovedYolkGrams(normalized)

  if (wholeEggMinusYolkTotal) {
    components.push(
      buildManualComponent(
        EGG_WHOLE_REFERENCE,
        wholeEggMinusYolkTotal,
        `Quantité de ${Math.round(wholeEggMinusYolkTotal)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const eggWhiteG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+de\s+blancs?\s+d[' ]oeuf/i,
  )
  if (eggWhiteG) {
    components.push(
      buildManualComponent(
        EGG_WHITE_REFERENCE,
        eggWhiteG,
        `Quantité de ${Math.round(eggWhiteG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const eggYolkG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+de\s+jaunes?\s+d[' ]oeuf/i,
  )
  if (eggYolkG && !removedYolkG) {
    components.push(
      buildManualComponent(
        EGG_YOLK_REFERENCE,
        eggYolkG,
        `Quantité de ${Math.round(eggYolkG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const cookedRiceG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+(?:de\s+)?riz(?:\s+cuit|\s+basmati)?/i,
  )
  if (cookedRiceG) {
    components.push(
      buildManualComponent(
        COOKED_RICE_REFERENCE,
        cookedRiceG,
        `Quantité de ${Math.round(cookedRiceG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const cookedSweetPotatoG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+(?:de\s+)?patates?\s+douces?(?:\s+cuite?s?)?/i,
  )
  if (cookedSweetPotatoG) {
    components.push(
      buildManualComponent(
        COOKED_SWEET_POTATO_REFERENCE,
        cookedSweetPotatoG,
        `Quantité de ${Math.round(cookedSweetPotatoG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const cookedPotatoG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+(?:de\s+)?pommes?\s+de\s+terre(?:\s+cuite?s?)?(?:\s+a\s+l[' ]eau)?/i,
  )
  if (cookedPotatoG) {
    components.push(
      buildManualComponent(
        COOKED_POTATO_REFERENCE,
        cookedPotatoG,
        `Quantité de ${Math.round(cookedPotatoG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const lentilPotatoPorkG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+(?:de\s+)?lentilles?.*pommes?\s+de\s+terre.*porc/i,
  )
  if (lentilPotatoPorkG) {
    components.push(
      ...distributeCompositeQuantity(lentilPotatoPorkG, [
        {
          reference: COOKED_LENTILS_REFERENCE,
          ratio: 0.4,
          note: "Part lentilles estimée à partir de la note utilisateur.",
        },
        {
          reference: COOKED_POTATO_REFERENCE,
          ratio: 0.3,
          note: "Part pommes de terre estimée à partir de la note utilisateur.",
        },
        {
          reference: COOKED_PORK_REFERENCE,
          ratio: 0.3,
          note: "Part porc estimée à partir de la note utilisateur.",
        },
      ]),
    )
  }

  const skinlessChickenThighG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+(?:(?:de\s+)?)(?:haut(?:e)?\s+de\s+)?cuisse\s+de\s+poulet(?:\s*\([^)]*sans\s+peau[^)]*\))?/i,
  )
  if (skinlessChickenThighG) {
    components.push(
      buildManualComponent(
        SKINLESS_CHICKEN_THIGH_REFERENCE,
        skinlessChickenThighG,
        `Quantité de ${Math.round(skinlessChickenThighG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const chickenG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+de\s+poulet/i,
  )
  if (chickenG && !skinlessChickenThighG) {
    components.push(
      buildManualComponent(
        CHICKEN_REFERENCE,
        chickenG,
        `Quantité de ${Math.round(chickenG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const braisedPorkG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+(?:de\s+)?porc(?:\s+cuit)?(?:\s*\([^)]*(?:mijote|rouelle)[^)]*\))?/i,
  )
  if (braisedPorkG) {
    components.push(
      buildManualComponent(
        BRAISED_PORK_REFERENCE,
        braisedPorkG,
        `Quantité de ${Math.round(braisedPorkG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const beefStripsG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+(?:(?:d[' ]|de\s+))?(?:emince(?:e|es)?\s+de\s+)?boeuf(?:\s+saute)?(?:\s*\([^)]*\))?/i,
  )
  if (beefStripsG) {
    components.push(
      buildManualComponent(
        BEEF_STRIPS_REFERENCE,
        beefStripsG,
        `Quantité de ${Math.round(beefStripsG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const friesOrSauteedPotatoesG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+(?:(?:de\s+))?(?:frites?(?:\s+epaisses?)?|pommes?\s+de\s+terre\s+saute(?:e|es)?(?:\s+maison)?)/i,
  )
  if (friesOrSauteedPotatoesG) {
    components.push(
      buildManualComponent(
        PAN_FRIED_POTATO_REFERENCE,
        friesOrSauteedPotatoesG,
        `Quantité de ${Math.round(friesOrSauteedPotatoesG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const cerealG = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?\s+de\s+cereales?(?:\s+honey\s+rings)?/i,
  )
  if (cerealG) {
    components.push(
      buildManualComponent(
        HONEY_RINGS_REFERENCE,
        cerealG,
        `Quantité de ${Math.round(cerealG)} g fournie dans la note utilisateur.`,
      ),
    )
  }

  const milkMl = parseExplicitGramMatch(
    normalized,
    /(\d+(?:[.,]\d+)?)\s*(?:ml|g)\s+de\s+lait\s+demi[- ]ecreme/i,
  )
  if (milkMl) {
    components.push(
      buildManualComponent(
        SEMI_SKIMMED_MILK_REFERENCE,
        milkMl,
        `Quantité de ${Math.round(milkMl)} ml fournie dans la note utilisateur.`,
      ),
    )
  }

  return components
}

export function countManualQuantityHints(detail: string | null | undefined) {
  return extractManualQuantityHints(detail).length
}

export function applyManualQuantityOverrides({
  existingComponents,
  detail,
}: {
  existingComponents: PhotoMealFinalComponent[]
  detail: string | null | undefined
}) {
  const hints = extractManualQuantityHints(detail)
  if (!hints.length) return existingComponents

  const usedHintIndexes = new Set<number>()

  return existingComponents.map((component) => {
    let bestIndex = -1
    let bestScore = 0

    hints.forEach((hint, index) => {
      if (usedHintIndexes.has(index)) return
      const score = scoreManualHintMatch(component.name_fr, hint)
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })

    if (bestIndex < 0 || bestScore < 0.45) {
      return component
    }

    usedHintIndexes.add(bestIndex)
    const hint = hints[bestIndex]
    if (!hint) return component

    return {
      ...component,
      quantity_g: Math.round(hint.quantityG),
      quantity_source: "user_note",
      nutrition_source: component.nutrition_source === "default" ? "user_note" : component.nutrition_source,
      component_confidence: Math.max(Number(component.component_confidence ?? 0), 0.94),
      source_note: `Quantité de ${Math.round(hint.quantityG)} g fournie dans la note utilisateur.`,
    }
  })
}

export function applyManualConsumptionAdjustments({
  existingComponents,
  detail,
}: {
  existingComponents: PhotoMealFinalComponent[]
  detail: string | null | undefined
}) {
  const adjustments = extractManualConsumptionAdjustments(detail)
  if (!adjustments.length) return existingComponents

  const globalRatio = adjustments
    .filter((adjustment) => adjustment.mode === "scale_ratio" && adjustment.targetTokens === null)
    .reduce((ratio, adjustment) => ratio * Math.max(0, adjustment.ratio ?? 1), 1)

  return existingComponents.map((component) => {
    const normalizedName = normalizeText(component.name_fr)
    let nextQuantity = component.quantity_g * globalRatio
    const sourceNotes = globalRatio !== 1 ? ["Part réellement consommée prise en compte dans la note utilisateur."] : []

    for (const adjustment of adjustments) {
      if (adjustment.targetTokens === null) continue
      const matchesTarget = adjustment.targetTokens.some((token) => normalizedName.includes(token))
      if (!matchesTarget) continue

      if (adjustment.mode === "subtract_grams") {
        nextQuantity -= adjustment.quantityG ?? 0
        sourceNotes.push(adjustment.sourceNote)
        continue
      }

      if (adjustment.mode === "scale_ratio") {
        nextQuantity *= Math.max(0, adjustment.ratio ?? 1)
        sourceNotes.push(adjustment.sourceNote)
      }
    }

    nextQuantity = Math.max(0, Math.round(nextQuantity))
    if (nextQuantity === component.quantity_g) return component

    return {
      ...component,
      quantity_g: nextQuantity,
      quantity_source: "user_note",
      nutrition_source: "user_note",
      component_confidence: Math.max(Number(component.component_confidence ?? 0), 0.96),
      source_note: sourceNotes.at(-1) ?? component.source_note,
    }
  })
}

export function mergeManualPlateComponents({
  existingComponents,
  manualComponents,
}: {
  existingComponents: PhotoMealFinalComponent[]
  manualComponents: PhotoMealFinalComponent[]
}) {
  if (!manualComponents.length) return existingComponents

  const normalizedManualNames = manualComponents.map((component) => normalizeText(component.name_fr))
  const hasManualEgg = normalizedManualNames.some((name) => name.includes("oeuf") || name.includes("egg"))
  const hasManualRice = normalizedManualNames.some((name) => name.includes("riz") || name.includes("rice"))
  const hasManualChicken = normalizedManualNames.some((name) => name.includes("poulet") || name.includes("chicken"))
  const hasManualBeef = normalizedManualNames.some((name) => name.includes("boeuf") || name.includes("beef"))
  const hasManualCereal = normalizedManualNames.some((name) => name.includes("cereales") || name.includes("honey rings"))
  const hasManualMilk = normalizedManualNames.some((name) => name.includes("lait") || name.includes("milk"))
  const hasManualLentils = normalizedManualNames.some((name) => name.includes("lentilles") || name.includes("lentils"))
  const hasManualPotatoes = normalizedManualNames.some((name) => name.includes("pomme de terre") || name.includes("pommes de terre") || name.includes("potato"))
  const hasManualSweetPotato = normalizedManualNames.some((name) => name.includes("patate douce") || name.includes("sweet potato"))
  const hasManualFries = normalizedManualNames.some((name) => name.includes("frite"))
  const hasManualPork = normalizedManualNames.some((name) => name.includes("porc") || name.includes("pork"))

  const remaining = existingComponents.filter((component) => {
    const normalized = normalizeText(component.name_fr)
    if (normalizedManualNames.includes(normalized)) return false
    const isEggLike =
      normalized.includes("oeuf") ||
      normalized.includes("egg")
    const isRiceLike = normalized.includes("riz") || normalized.includes("rice")
    const isChickenLike = normalized.includes("poulet") || normalized.includes("chicken")
    const isBeefLike =
      normalized.includes("boeuf") ||
      normalized.includes("beef") ||
      normalized.includes("viande hachee") ||
      normalized.includes("steak")
    const isCerealLike = normalized.includes("cereales") || normalized.includes("honey rings")
    const isMilkLike = normalized.includes("lait") || normalized.includes("milk")
    const isLentilLike = normalized.includes("lentilles") || normalized.includes("lentils")
    const isPotatoLike = normalized.includes("pomme de terre") || normalized.includes("pommes de terre") || normalized.includes("potato")
    const isSweetPotatoLike = normalized.includes("patate douce") || normalized.includes("sweet potato")
    const isFriesLike = normalized.includes("frite")
    const isPorkLike = normalized.includes("porc") || normalized.includes("pork")
    const isLegacyMixedDish =
      normalized.includes("lentilles") &&
      normalized.includes("pommes de terre") &&
      normalized.includes("porc")
    if (hasManualEgg && isEggLike) return false
    if (hasManualRice && isRiceLike) return false
    if (hasManualChicken && isChickenLike) return false
    if (hasManualBeef && isBeefLike) return false
    if (hasManualCereal && isCerealLike) return false
    if (hasManualMilk && isMilkLike) return false
    if (isLegacyMixedDish && (hasManualLentils || hasManualPotatoes || hasManualPork)) return false
    if (hasManualLentils && isLentilLike) return false
    if (hasManualFries && isFriesLike) return false
    if (hasManualPotatoes && isFriesLike) return false
    if (hasManualPotatoes && isPotatoLike) return false
    if (hasManualSweetPotato && isSweetPotatoLike) return false
    if (hasManualPork && isPorkLike) return false
    return true
  })

  return [...manualComponents, ...remaining]
}
