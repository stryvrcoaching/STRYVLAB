import type {
  PhotoMealAnalysisMode,
  PhotoMealAnalysisSummary,
  PhotoMealCatalogMetadata,
  PhotoMealComponentCandidate,
  PhotoMealConfidenceBreakdown,
} from "@/lib/nutrition/photo-log-types"
import {
  computeMacroDerivedKcalPer100g,
  hasMeaningfulMacros,
  isMacroEnergyIncoherent,
} from "@/lib/nutrition/photo-log-nutrition-consistency"

type ManualPackagingSignals = {
  shouldSaveToLibrary: boolean
  productAmountG: number | null
  productAmountMl: number | null
  additions: PhotoMealComponentCandidate[]
}

type NutritionReference = {
  name_fr: string
  category_hint: PhotoMealComponentCandidate["category_hint"]
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
}

const SEMI_SKIMMED_MILK: NutritionReference = {
  name_fr: "Lait demi-écrémé",
  category_hint: "drinks",
  kcal_per_100g: 46,
  protein_per_100g: 3.4,
  carbs_per_100g: 4.8,
  fat_per_100g: 1.52,
  fiber_per_100g: 0,
}

const SKIMMED_MILK: NutritionReference = {
  name_fr: "Lait écrémé",
  category_hint: "drinks",
  kcal_per_100g: 34,
  protein_per_100g: 3.4,
  carbs_per_100g: 4.9,
  fat_per_100g: 0.2,
  fiber_per_100g: 0,
}

const WHOLE_MILK: NutritionReference = {
  name_fr: "Lait entier",
  category_hint: "drinks",
  kcal_per_100g: 64,
  protein_per_100g: 3.3,
  carbs_per_100g: 4.7,
  fat_per_100g: 3.6,
  fiber_per_100g: 0,
}

const WATER: NutritionReference = {
  name_fr: "Eau",
  category_hint: "drinks",
  kcal_per_100g: 0,
  protein_per_100g: 0,
  carbs_per_100g: 0,
  fat_per_100g: 0,
  fiber_per_100g: 0,
}

const RED_BULL: NutritionReference = {
  name_fr: "Red Bull",
  category_hint: "drinks",
  kcal_per_100g: 45,
  protein_per_100g: 0,
  carbs_per_100g: 11,
  fat_per_100g: 0,
  fiber_per_100g: 0,
}

const HONEY_RINGS: NutritionReference = {
  name_fr: "Céréales Honey Rings",
  category_hint: "carbs",
  kcal_per_100g: 379,
  protein_per_100g: 10,
  carbs_per_100g: 74,
  fat_per_100g: 3.1,
  fiber_per_100g: 7.5,
}

const TUNA_NATURAL: NutritionReference = {
  name_fr: "Thon nature",
  category_hint: "proteins",
  kcal_per_100g: 116,
  protein_per_100g: 26,
  carbs_per_100g: 0,
  fat_per_100g: 1,
  fiber_per_100g: 0,
}

const QNT_LIGHT_DIGEST_WHEY: NutritionReference = {
  name_fr: "QNT Life Light Digest Whey Protein",
  category_hint: "proteins",
  kcal_per_100g: 362.5,
  protein_per_100g: 70,
  carbs_per_100g: 8.85,
  fat_per_100g: 4.7,
  fiber_per_100g: 0,
}

const SALTED_CORN_TORTILLA_CHIPS: NutritionReference = {
  name_fr: "Tortillas chips de maïs salées",
  category_hint: "extras",
  kcal_per_100g: 470,
  protein_per_100g: 6.5,
  carbs_per_100g: 64,
  fat_per_100g: 20,
  fiber_per_100g: 6.2,
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

function toNumber(raw: string | undefined) {
  if (!raw) return null
  const value = Number(raw.replace(",", "."))
  return Number.isFinite(value) ? value : null
}

function toMl(amount: number, unit: string) {
  if (unit === "l") return amount * 1000
  if (unit === "cl") return amount * 10
  return amount
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildComponentFromReference(reference: NutritionReference, quantityG: number, rationale: string): PhotoMealComponentCandidate {
  return {
    name_fr: reference.name_fr,
    category_hint: reference.category_hint,
    grams_estimate: Math.max(0, Math.round(quantityG)),
    unit_count: null,
    kcal_per_100g: reference.kcal_per_100g,
    protein_per_100g: reference.protein_per_100g,
    carbs_per_100g: reference.carbs_per_100g,
    fat_per_100g: reference.fat_per_100g,
    fiber_per_100g: reference.fiber_per_100g,
    ambiguity_tags: [],
    rationale,
    nutrition_source: "manual_addition",
    component_confidence: 0.98,
    edible_yield_ratio: null,
    catalog_metadata: {
      reusable: true,
      canonical_name_fr: reference.name_fr,
    },
  }
}

function inferKnownProductReference(productName: string | null | undefined) {
  const normalized = normalizeText(productName)
  if (normalized.includes("red bull")) return RED_BULL
  if (normalized.includes("honey rings")) return HONEY_RINGS
  if (normalized.includes("thon nature")) return TUNA_NATURAL
  if (normalized.includes("qnt") && normalized.includes("whey")) return QNT_LIGHT_DIGEST_WHEY
  if ((normalized.includes("tortilla") || normalized.includes("nacho")) && normalized.includes("mais")) return SALTED_CORN_TORTILLA_CHIPS
  return null
}

function inferGenericCategoryFromProduct(productName: string | null | undefined, productType: string | null | undefined) {
  const normalizedName = normalizeText(productName)
  const normalizedType = normalizeText(productType)

  if (normalizedType.includes("boisson")) return "drinks" as const
  if (
    normalizedName.includes("protein bar") ||
    normalizedName.includes("barre prote") ||
    normalizedName.includes("barre protein") ||
    normalizedName.includes("whey") ||
    normalizedName.includes("protein")
  ) {
    return "proteins" as const
  }
  if (normalizedName.includes("drink") || normalizedName.includes("juice") || normalizedName.includes("jus")) {
    return "drinks" as const
  }
  return "extras" as const
}

function isLikelyDrinkLike(
  component: PhotoMealComponentCandidate | null,
  productType: string | null | undefined,
  canonicalName: string | null,
) {
  if (!component) return false
  if (component.category_hint === "drinks") return true

  const normalizedName = normalizeText(component.name_fr)
  const normalizedCanonical = normalizeText(canonicalName)
  const normalizedProductType = normalizeText(productType)

  return (
    normalizedProductType.includes("boisson") ||
    normalizedName.includes("boisson") ||
    normalizedName.includes("drink") ||
    normalizedCanonical.includes("red bull") ||
    normalizedCanonical.includes("monster") ||
    normalizedCanonical.includes("energy")
  )
}

function buildCatalogMetadata(name: string, brand?: string | null, reusable = true): PhotoMealCatalogMetadata {
  const canonical = name.trim()
  const slug = slugify([brand, canonical].filter(Boolean).join(" ")) || "photo-guided-product"
  return {
    item_key: `photo-guided-packaging-${slug}`,
    reusable,
    brand: brand?.trim() || null,
    canonical_name_fr: canonical,
  }
}

function parseGenericProductAmountG({
  normalizedDetail,
  candidateNames,
}: {
  normalizedDetail: string
  candidateNames: Array<string | null | undefined>
}) {
  for (const candidateName of candidateNames) {
    const normalizedName = normalizeText(candidateName).trim()
    if (!normalizedName) continue
    const compactName = normalizedName.replace(/\s+/g, "\\s+")
    const match = normalizedDetail.match(
      new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*g(?:rammes?)?\\s+de\\s+${compactName}`, "i"),
    )
    const grams = toNumber(match?.[1])
    if (grams && grams > 0) return grams

    const nameTokens = normalizedName.split(/\s+/).filter((token) => token.length >= 4)
    for (const token of nameTokens) {
      const tokenMatch = normalizedDetail.match(
        new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*g(?:rammes?)?(?:\\s+de)?\\s+${escapeRegExp(token)}`, "i"),
      )
      const tokenGrams = toNumber(tokenMatch?.[1])
      if (tokenGrams && tokenGrams > 0) return tokenGrams
    }
  }

  return null
}

function parseGenericProductAmountMl({
  normalizedDetail,
  candidateNames,
}: {
  normalizedDetail: string
  candidateNames: Array<string | null | undefined>
}) {
  for (const candidateName of candidateNames) {
    const normalizedName = normalizeText(candidateName).trim()
    if (!normalizedName) continue
    const compactName = normalizedName.replace(/\s+/g, "\\s+")

    const leadingMatch = normalizedDetail.match(
      new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(ml|cl|l)\\s+(?:de\\s+)?${compactName}`, "i"),
    )
    const trailingMatch = normalizedDetail.match(
      new RegExp(`${compactName}\\s*(?:de\\s+)?(\\d+(?:[.,]\\d+)?)\\s*(ml|cl|l)`, "i"),
    )
    const amount = toNumber(leadingMatch?.[1] ?? trailingMatch?.[1])
    const unit = leadingMatch?.[2] ?? trailingMatch?.[2]
    if (amount && unit) {
      const quantityMl = toMl(amount, unit)
      if (quantityMl > 0) return quantityMl
    }

    const nameTokens = normalizedName.split(/\s+/).filter((token) => token.length >= 4)
    for (const token of nameTokens) {
      const tokenMatch = normalizedDetail.match(
        new RegExp(`${escapeRegExp(token)}\\s*(?:de\\s+)?(\\d+(?:[.,]\\d+)?)\\s*(ml|cl|l)`, "i"),
      )
      const tokenAmount = toNumber(tokenMatch?.[1])
      const tokenUnit = tokenMatch?.[2]
      if (tokenAmount && tokenUnit) {
        const quantityMl = toMl(tokenAmount, tokenUnit)
        if (quantityMl > 0) return quantityMl
      }
    }
  }

  return null
}

function parseManualPackagingSignals(
  detail: string | null | undefined,
  options?: {
    productNames?: Array<string | null | undefined>
  },
): ManualPackagingSignals {
  const normalized = normalizeText(detail)
  if (!normalized) {
    return {
      shouldSaveToLibrary: false,
      productAmountG: null,
      productAmountMl: null,
      additions: [],
    }
  }

  const shouldSaveToLibrary =
    normalized.includes("bibliotheque") ||
    normalized.includes("aliments perso") ||
    normalized.includes("aliment perso")

  const productAmountMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*g(?:rammes?)?(?:\s+de)?\s+(?:cette|ce|la|du|de la|des)?\s*(?:poudre|whey|proteine|proteines|poudre de proteines|complement|cereales|cereale|honey rings|corn flakes|muesli|granola|flakes|anneaux)/i,
  )
  const productAmountG =
    toNumber(productAmountMatch?.[1]) ??
    parseGenericProductAmountG({
      normalizedDetail: normalized,
      candidateNames: options?.productNames ?? [],
    })
  const productAmountMlMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\s+(?:de\s+)?(?:cette|ce|la|du|de la|des)?\s*(?:boisson|canette|energy drink|red bull|soda|cola|jus|smoothie)/i,
  )
  const productAmountMl = (() => {
    const amount = toNumber(productAmountMlMatch?.[1])
    const unit = productAmountMlMatch?.[2]
    if (amount && unit) {
      const quantityMl = toMl(amount, unit)
      return quantityMl > 0 ? quantityMl : null
    }
    return parseGenericProductAmountMl({
      normalizedDetail: normalized,
      candidateNames: options?.productNames ?? [],
    })
  })()

  const additions: PhotoMealComponentCandidate[] = []

  const milkMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\s+de\s+lait\s+(demi[- ]ecreme|ecreme|entier)/i,
  )
  if (milkMatch) {
    const amount = toNumber(milkMatch[1])
    const unit = milkMatch[2]
    const milkType = milkMatch[3]
    const quantityMl = amount ? toMl(amount, unit) : null
    if (quantityMl && quantityMl > 0) {
      const reference =
        milkType.includes("demi") ? SEMI_SKIMMED_MILK : milkType.includes("entier") ? WHOLE_MILK : SKIMMED_MILK
      additions.push(
        buildComponentFromReference(reference, quantityMl, `Quantité de ${Math.round(quantityMl)} ml fournie par l'utilisateur.`),
      )
    }
  }

  const waterMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\s+d['’]?eau/i)
  if (waterMatch) {
    const amount = toNumber(waterMatch[1])
    const unit = waterMatch[2]
    const quantityMl = amount ? toMl(amount, unit) : null
    if (quantityMl && quantityMl > 0) {
      additions.push(
        buildComponentFromReference(WATER, quantityMl, `Quantité de ${Math.round(quantityMl)} ml fournie par l'utilisateur.`),
      )
    }
  }

  return {
    shouldSaveToLibrary,
    productAmountG,
    productAmountMl,
    additions,
  }
}

function isLiquidAdditionComponent(name: string) {
  const normalized = normalizeText(name)
  return (
    normalized.includes("lait") ||
    normalized.includes("milk") ||
    normalized.includes("eau") ||
    normalized.includes("water") ||
    normalized.includes("yaourt") ||
    normalized.includes("yogurt") ||
    normalized.includes("fromage frais")
  )
}

function choosePrimaryPackagingComponent(components: PhotoMealComponentCandidate[]) {
  return (
    components.find((component) => component.category_hint !== "drinks") ??
    [...components].sort((left, right) => right.protein_per_100g - left.protein_per_100g)[0] ??
    null
  )
}

function hasNamedComponent(components: PhotoMealComponentCandidate[], name: string) {
  const normalizedName = normalizeText(name)
  return components.some((component) => normalizeText(component.name_fr) === normalizedName)
}

function normalizePackagingNutrition(component: PhotoMealComponentCandidate) {
  const derivedKcal = computeMacroDerivedKcalPer100g(component)
  if (derivedKcal <= 0 || !hasMeaningfulMacros(component)) return component

  if (
    Number(component.kcal_per_100g ?? 0) <= 0 ||
    isMacroEnergyIncoherent(component, {
      lowRatio: 0.78,
      highRatio: 1.22,
      absoluteToleranceKcal: 30,
    })
  ) {
    component.kcal_per_100g = Math.round(derivedKcal * 10) / 10
    component.rationale = component.rationale
      ? `${component.rationale} Calories recalées sur les macros lues sur l'étiquette.`
      : "Calories recalées sur les macros lues sur l'étiquette."
  }

  return component
}

function buildDefaultConfidenceBreakdown({
  analysisMode,
  manualDetail,
  photoCount,
  hasProductReference,
}: {
  analysisMode: PhotoMealAnalysisMode
  manualDetail: string | null | undefined
  photoCount: number
  hasProductReference: boolean
}): PhotoMealConfidenceBreakdown {
  if (analysisMode === "packaging" || analysisMode === "barcode") {
    return {
      capture: photoCount >= 3 ? 0.95 : photoCount >= 2 ? 0.88 : 0.72,
      ocr: hasProductReference ? 0.94 : 0.78,
      quantity: /\d/.test(manualDetail ?? "") ? 0.96 : 0.68,
      nutrition: hasProductReference ? 0.95 : 0.8,
    }
  }

  if (analysisMode === "hybrid") {
    return {
      capture: photoCount >= 3 ? 0.9 : 0.8,
      ocr: hasProductReference ? 0.88 : 0.72,
      quantity: /\d/.test(manualDetail ?? "") ? 0.88 : 0.62,
      nutrition: 0.82,
    }
  }

  return {
    capture: photoCount >= 2 ? 0.82 : 0.68,
    ocr: 0.7,
    quantity: /\d/.test(manualDetail ?? "") ? 0.78 : 0.54,
    nutrition: 0.72,
  }
}

export function isPackagingAnalysisMode(mode: PhotoMealAnalysisMode | null | undefined) {
  return mode === "packaging" || mode === "barcode"
}

export function applyPackagingPostProcessing(
  analysis: PhotoMealAnalysisSummary,
  photoCount: number,
): PhotoMealAnalysisSummary {
  const analysisMode = analysis.analysis_mode ?? "plate"
  if (!isPackagingAnalysisMode(analysisMode) && analysisMode !== "hybrid") {
    return {
      ...analysis,
      confidence_breakdown:
        analysis.confidence_breakdown ??
        buildDefaultConfidenceBreakdown({
          analysisMode,
          manualDetail: analysis.manual_detail,
          photoCount,
          hasProductReference: Boolean(analysis.product_reference?.canonical_name_fr || analysis.product_reference?.name_fr),
        }),
      source_context: analysis.source_context ?? "plate_home_v1",
    }
  }

  const signals = parseManualPackagingSignals(analysis.manual_detail, {
    productNames: [
      analysis.product_reference?.canonical_name_fr,
      analysis.product_reference?.name_fr,
    ],
  })
  const nextComponents = [...analysis.components]
    .filter((component) => {
      if (!isLiquidAdditionComponent(component.name_fr)) return true
      return signals.additions.some((addition) => normalizeText(addition.name_fr) === normalizeText(component.name_fr))
    })
  const primary = choosePrimaryPackagingComponent(nextComponents)
  const canonicalName =
    analysis.product_reference?.canonical_name_fr?.trim() ||
    analysis.product_reference?.name_fr?.trim() ||
    primary?.name_fr?.trim() ||
    null
  const brand = analysis.product_reference?.brand?.trim() || null
  const knownProductReferenceFromName = inferKnownProductReference(canonicalName)

  if (!primary && canonicalName) {
    nextComponents.push({
      name_fr: canonicalName,
      category_hint: knownProductReferenceFromName?.category_hint ?? inferGenericCategoryFromProduct(canonicalName, analysis.product_reference?.product_type),
      grams_estimate:
        Math.round(
          signals.productAmountG ??
          signals.productAmountMl ??
          Number(analysis.product_reference?.serving_size_g ?? 0) ??
          0,
        ),
      unit_count: null,
      kcal_per_100g: knownProductReferenceFromName?.kcal_per_100g ?? 0,
      protein_per_100g: knownProductReferenceFromName?.protein_per_100g ?? 0,
      carbs_per_100g: knownProductReferenceFromName?.carbs_per_100g ?? 0,
      fat_per_100g: knownProductReferenceFromName?.fat_per_100g ?? 0,
      fiber_per_100g: knownProductReferenceFromName?.fiber_per_100g ?? 0,
      ambiguity_tags: [],
      rationale: "Produit emballé reconstruit depuis le nom, le poids unitaire et l’étiquette visible.",
      nutrition_source: knownProductReferenceFromName ? "catalog_fallback" : "label_read",
      component_confidence: knownProductReferenceFromName ? 0.82 : 0.72,
      edible_yield_ratio: null,
      catalog_metadata: buildCatalogMetadata(canonicalName, brand, true),
    })
  }

  const resolvedPrimary = choosePrimaryPackagingComponent(nextComponents)

  if (resolvedPrimary) {
    if (signals.productAmountG && signals.productAmountG > 0) {
      resolvedPrimary.grams_estimate = Math.round(signals.productAmountG)
    }
    if (
      (!signals.productAmountG || signals.productAmountG <= 0) &&
      signals.productAmountMl &&
      signals.productAmountMl > 0
    ) {
      resolvedPrimary.grams_estimate = Math.round(signals.productAmountMl)
    }
    if (
      (!signals.productAmountG || signals.productAmountG <= 0) &&
      Number(analysis.scale_weight_g ?? 0) > 0 &&
      (analysis.photo_timeline?.some((photo) => photo.role === "separate_weighing") ?? false)
    ) {
      resolvedPrimary.grams_estimate = Math.round(Number(analysis.scale_weight_g))
      resolvedPrimary.ambiguity_tags = resolvedPrimary.ambiguity_tags.filter((tag) => tag !== "partial_weight")
      resolvedPrimary.rationale = resolvedPrimary.rationale
        ? `${resolvedPrimary.rationale} Quantité produit priorisée depuis la balance (${Math.round(Number(analysis.scale_weight_g))} g).`
        : `Quantité produit priorisée depuis la balance (${Math.round(Number(analysis.scale_weight_g))} g).`
    }
    if (canonicalName) {
      resolvedPrimary.name_fr = canonicalName
    }
    const knownProductReference =
      (
        isLikelyDrinkLike(resolvedPrimary, analysis.product_reference?.product_type, canonicalName) ||
        Boolean(inferKnownProductReference(canonicalName ?? resolvedPrimary.name_fr))
      ) &&
      (
        Number(resolvedPrimary.kcal_per_100g ?? 0) <= 0 ||
        (
          Number(resolvedPrimary.protein_per_100g ?? 0) <= 0 &&
          Number(resolvedPrimary.carbs_per_100g ?? 0) <= 0 &&
          Number(resolvedPrimary.fat_per_100g ?? 0) <= 0
        )
      )
        ? inferKnownProductReference(canonicalName ?? resolvedPrimary.name_fr)
        : null
    if (knownProductReference) {
      resolvedPrimary.category_hint = knownProductReference.category_hint
      resolvedPrimary.kcal_per_100g = knownProductReference.kcal_per_100g
      resolvedPrimary.protein_per_100g = knownProductReference.protein_per_100g
      resolvedPrimary.carbs_per_100g = knownProductReference.carbs_per_100g
      resolvedPrimary.fat_per_100g = knownProductReference.fat_per_100g
      resolvedPrimary.fiber_per_100g = knownProductReference.fiber_per_100g
      resolvedPrimary.name_fr = knownProductReference.name_fr
      resolvedPrimary.nutrition_source = "catalog_fallback"
      resolvedPrimary.component_confidence = 0.82
    } else {
      resolvedPrimary.nutrition_source = resolvedPrimary.nutrition_source ?? "label_read"
      resolvedPrimary.component_confidence = resolvedPrimary.component_confidence ?? (analysisMode === "hybrid" ? 0.86 : 0.94)
    }
    normalizePackagingNutrition(resolvedPrimary)
    resolvedPrimary.catalog_metadata = {
      ...buildCatalogMetadata(canonicalName ?? resolvedPrimary.name_fr, brand, true),
      ...(resolvedPrimary.catalog_metadata ?? {}),
      reusable: true,
      brand,
      canonical_name_fr: canonicalName ?? resolvedPrimary.name_fr,
    }
    resolvedPrimary.rationale = resolvedPrimary.rationale
      ? `${resolvedPrimary.rationale} Quantité produit consolidée depuis l'étiquette et la note utilisateur.`
      : "Produit emballé consolidé depuis l'étiquette et la note utilisateur."
  }

  for (const addition of signals.additions) {
    if (!hasNamedComponent(nextComponents, addition.name_fr)) {
      nextComponents.push(addition)
    }
  }

  return {
    ...analysis,
    analysis_mode: analysisMode,
    source_context:
      analysisMode === "barcode"
        ? "product_barcode_v1"
        : analysisMode === "hybrid"
          ? "product_hybrid_v1"
          : "product_packaging_v1",
    scale_weight_g: null,
    scale_weight_confidence: null,
    leftovers_estimate: null,
    leftovers_recommended: false,
    ambiguity_tags: [],
    components: nextComponents,
    product_reference: analysis.product_reference
      ? {
          ...analysis.product_reference,
          canonical_name_fr: canonicalName ?? analysis.product_reference.canonical_name_fr ?? analysis.product_reference.name_fr ?? null,
          save_to_personal_library:
            analysis.product_reference.save_to_personal_library ?? signals.shouldSaveToLibrary,
        }
      : canonicalName
        ? {
            brand,
            canonical_name_fr: canonicalName,
            name_fr: canonicalName,
            product_type: "packaged_food",
            save_to_personal_library: signals.shouldSaveToLibrary,
          }
        : null,
    confidence_breakdown:
      analysis.confidence_breakdown ??
      buildDefaultConfidenceBreakdown({
        analysisMode,
        manualDetail: analysis.manual_detail,
        photoCount,
        hasProductReference: Boolean(canonicalName),
      }),
    vision_notes:
      analysis.vision_notes ||
      "Produit emballé détecté. Les valeurs viennent de l'étiquette, complétées par la quantité fournie.",
  }
}
