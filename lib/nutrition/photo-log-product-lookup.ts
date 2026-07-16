import type {
  PhotoMealAnalysisSummary,
  PhotoMealComponentCandidate,
  PhotoMealProductReference,
} from "@/lib/nutrition/photo-log-types"

type OpenFoodFactsProduct = {
  status?: number
  code?: string
  product_name?: string
  product_name_fr?: string
  brands?: string
  quantity?: string
  serving_size?: string
  nutrition_data_per?: string
  nutriments?: Record<string, unknown>
}

type ProductNutritionReference = {
  barcode: string
  brand: string | null
  name: string
  servingSizeG: number | null
  kcalPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g: number
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeBarcode(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "")
  return digits.length >= 8 ? digits : null
}

function parseGrams(value: string | null | undefined) {
  const match = String(value ?? "").match(/(\d+(?:[.,]\d+)?)\s*g\b/i)
  return toNumber(match?.[1])
}

function readNutriment(nutriments: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(nutriments[key])
    if (value !== null) return value
  }
  return null
}

function readKcalPer100g(nutriments: Record<string, unknown>) {
  const kcal = readNutriment(nutriments, ["energy-kcal_100g", "energy-kcal"])
  if (kcal !== null) return kcal

  const kj = readNutriment(nutriments, ["energy-kj_100g", "energy-kj", "energy_100g", "energy"])
  return kj !== null ? kj / 4.184 : null
}

function parseOpenFoodFactsProduct(barcode: string, payload: OpenFoodFactsProduct): ProductNutritionReference | null {
  if (payload.status !== 1) return null

  const nutriments = payload.nutriments && typeof payload.nutriments === "object" ? payload.nutriments : null
  if (!nutriments) return null

  const kcalPer100g = readKcalPer100g(nutriments)
  const proteinPer100g = readNutriment(nutriments, ["proteins_100g", "proteins"])
  const carbsPer100g = readNutriment(nutriments, ["carbohydrates_100g", "carbohydrates"])
  const fatPer100g = readNutriment(nutriments, ["fat_100g", "fat"])
  const fiberPer100g = readNutriment(nutriments, ["fiber_100g", "fiber"]) ?? 0

  if (
    kcalPer100g === null ||
    proteinPer100g === null ||
    carbsPer100g === null ||
    fatPer100g === null ||
    kcalPer100g <= 0
  ) {
    return null
  }

  const productName = String(payload.product_name_fr || payload.product_name || "").trim()
  if (!productName) return null

  const servingSizeG = parseGrams(payload.serving_size) ?? parseGrams(payload.quantity)
  const brand = String(payload.brands ?? "").split(",")[0]?.trim() || null

  return {
    barcode,
    brand,
    name: [brand, productName].filter(Boolean).join(" ").trim(),
    servingSizeG: servingSizeG && servingSizeG > 0 ? servingSizeG : null,
    kcalPer100g,
    proteinPer100g,
    carbsPer100g,
    fatPer100g,
    fiberPer100g,
  }
}

async function lookupOpenFoodFactsByBarcode(barcode: string) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=status,code,product_name,product_name_fr,brands,quantity,serving_size,nutrition_data_per,nutriments`
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 * 14 },
  })

  if (!response.ok) return null
  const payload = (await response.json()) as OpenFoodFactsProduct
  return parseOpenFoodFactsProduct(barcode, payload)
}

function buildCatalogKey(reference: ProductNutritionReference) {
  return `photo-guided-packaging-${reference.barcode}`
}

function buildProductReference(
  existing: PhotoMealProductReference | null | undefined,
  reference: ProductNutritionReference,
): PhotoMealProductReference {
  return {
    ...existing,
    brand: reference.brand ?? existing?.brand ?? null,
    name_fr: reference.name,
    canonical_name_fr: reference.name,
    product_type: existing?.product_type ?? "snack",
    serving_size_g: reference.servingSizeG ?? existing?.serving_size_g ?? null,
    serving_label: reference.servingSizeG ? `${reference.servingSizeG} g` : existing?.serving_label ?? null,
    barcode_text: reference.barcode,
    evidence: "Valeurs consolidées depuis le code-barres produit.",
    save_to_personal_library: existing?.save_to_personal_library ?? true,
  }
}

function buildComponent(
  existing: PhotoMealComponentCandidate | null,
  reference: ProductNutritionReference,
): PhotoMealComponentCandidate {
  const gramsEstimate =
    Number(existing?.grams_estimate ?? 0) > 0
      ? Number(existing?.grams_estimate)
      : reference.servingSizeG ?? 100

  return {
    name_fr: reference.name,
    category_hint: existing?.category_hint ?? "proteins",
    grams_estimate: gramsEstimate,
    quantity_unit: existing?.quantity_unit ?? "g",
    unit_count: existing?.unit_count ?? null,
    kcal_per_100g: reference.kcalPer100g,
    protein_per_100g: reference.proteinPer100g,
    carbs_per_100g: reference.carbsPer100g,
    fat_per_100g: reference.fatPer100g,
    fiber_per_100g: reference.fiberPer100g,
    ambiguity_tags: existing?.ambiguity_tags ?? [],
    rationale: "Valeurs nutritionnelles consolidées depuis le code-barres.",
    edible_yield_ratio: existing?.edible_yield_ratio ?? null,
    nutrition_source: "catalog_fallback",
    component_confidence: 0.96,
    catalog_metadata: {
      item_key: buildCatalogKey(reference),
      reusable: true,
      brand: reference.brand,
      canonical_name_fr: reference.name,
    },
  }
}

function isPackagingAnalysis(analysis: PhotoMealAnalysisSummary) {
  return analysis.analysis_mode === "packaging" || analysis.analysis_mode === "barcode" || analysis.analysis_mode === "hybrid"
}

export async function enrichPackagingAnalysisFromBarcode(
  analysis: PhotoMealAnalysisSummary,
): Promise<PhotoMealAnalysisSummary> {
  if (!isPackagingAnalysis(analysis)) return analysis

  const barcode = normalizeBarcode(analysis.product_reference?.barcode_text)
  if (!barcode) return analysis

  const reference = await lookupOpenFoodFactsByBarcode(barcode).catch(() => null)
  if (!reference) return analysis

  const existingComponents = Array.isArray(analysis.components) ? analysis.components : []
  const primaryIndex = Math.max(0, existingComponents.findIndex((component) => component.category_hint !== "drinks"))
  const primary = existingComponents[primaryIndex] ?? null
  const nextComponents = existingComponents.length > 0 ? [...existingComponents] : []
  const enrichedPrimary = buildComponent(primary, reference)

  if (nextComponents.length === 0) {
    nextComponents.push(enrichedPrimary)
  } else {
    nextComponents[primaryIndex] = enrichedPrimary
  }

  return {
    ...analysis,
    analysis_mode: analysis.analysis_mode === "plate" ? "packaging" : analysis.analysis_mode,
    source_context: analysis.source_context ?? "product_packaging_v1",
    product_reference: buildProductReference(analysis.product_reference, reference),
    confidence_breakdown: {
      capture: Math.max(analysis.confidence_breakdown?.capture ?? 0, 0.8),
      ocr: Math.max(analysis.confidence_breakdown?.ocr ?? 0, 0.82),
      quantity: Math.max(analysis.confidence_breakdown?.quantity ?? 0, reference.servingSizeG ? 0.94 : 0.75),
      nutrition: Math.max(analysis.confidence_breakdown?.nutrition ?? 0, 0.96),
    },
    components: nextComponents,
    vision_notes: "Produit identifié par code-barres. Valeurs nutritionnelles consolidées depuis une fiche produit.",
  }
}
