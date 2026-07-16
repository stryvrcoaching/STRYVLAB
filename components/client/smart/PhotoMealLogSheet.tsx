"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Check,
  ChevronLeft,
  Images,
  Loader2,
  Mic,
  Pencil,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react"
import dynamic from "next/dynamic"
import useBodyScrollLock from "@/components/client/useBodyScrollLock"
import { useClientT } from "@/components/client/ClientI18nProvider"
import type {
  PhotoMealAnalysisMode,
  PhotoMealAnalysisSummary,
  PhotoMealFinalComponent,
  PhotoMealFinalResult,
  PhotoMealPhotoKind,
} from "@/lib/nutrition/photo-log-types"
import { type CategoryL1, type FoodItem, type MealType } from "@/lib/nutrition/food-items"
import { FoodIcon } from "@/components/nutrition/FoodIcon"
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget"
import { evaluateMealFit, type MealFitAdvisorResult } from "@/lib/nutrition/meal-fit-advisor"
import {
  PHOTO_LOG_CLIENT_TARGET_FILE_BYTES,
  PHOTO_LOG_COMPRESSION_QUALITIES,
  PHOTO_LOG_DOWNSCALE_STEPS,
  PHOTO_LOG_MAX_IMAGE_SIDE,
  PHOTO_LOG_MAX_PHOTOS,
  shouldBypassClientCompression,
} from "@/lib/nutrition/photo-log-upload"
import { computePhotoMealTotals, validatePhotoMealResult } from "@/lib/nutrition/photo-log-validation"
import { buildTextOnlyPhotoLogDraft } from "@/lib/nutrition/photo-log-text"
import type { ClientDictKey } from "@/lib/i18n/clientTranslations"

const VoiceLogSheet = dynamic(() => import("@/components/client/smart/VoiceLogSheet"), { ssr: false })

type TranslateFn = (key: ClientDictKey, vars?: Record<string, string | number>) => string

type Step =
  | "capture"
  | "analyzing"
  | "precheck"
  | "clarify"
  | "review"
  | "logging"
  | "success"
  | "error"

type UploadedPhoto = {
  id: string
  kind: PhotoMealPhotoKind
  signed_url?: string | null
}

type LoggedMealTotals = {
  id: string
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  total_fiber_g: number
}

type VoiceParseResponseItem = {
  name: string
  quantity_g: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  category_l1?: PhotoMealFinalComponent["category_hint"]
}

type UploadingState = {
  kind: PhotoMealPhotoKind
  fileName: string
} | null

type DeletingPhotoState = {
  id: string
} | null

type ClarifySelectionState = {
  key: string
  value: string
} | null

type RefinementDeltaSummary = {
  question: string
  answerLabel: string
  deltaCalories: number
  deltaProteinG: number
  deltaCarbsG: number
  deltaFatG: number
} | null

interface PhotoMealLogSheetProps {
  open: boolean
  activeDate: string
  onClose: () => void
  onSuccess?: () => void
  presentation?: "sheet" | "page"
  initialNoteOpen?: boolean
  nutritionContext?: {
    consumed: NutritionMacros
    target: NutritionMacros
  } | null
}

const MEAL_TYPE_OPTIONS: Array<{ value: MealType; labelKey: ClientDictKey }> = [
  { value: "breakfast", labelKey: "nutrition.photo.log.meal.breakfast" },
  { value: "lunch", labelKey: "nutrition.photo.log.meal.lunch" },
  { value: "dinner", labelKey: "nutrition.photo.log.meal.dinner" },
  { value: "snack", labelKey: "nutrition.photo.log.meal.snack" },
]

const FOOD_CATEGORY_OPTIONS: CategoryL1[] = ["proteins", "carbs", "vegetables", "fruits", "fats", "drinks", "extras"]

const FOOD_SUBCATEGORY_OPTIONS: Record<CategoryL1, string[]> = {
  proteins: ["viandes", "poissons", "oeufs", "laitiers", "vegetales", "complements"],
  carbs: ["cereales", "fecules", "pain", "legumineuses"],
  vegetables: ["feuilles", "cruciferes", "autres-legumes"],
  fruits: ["frais", "secs"],
  fats: ["huiles", "noix-graines", "autres-lipides", "sauces"],
  drinks: ["eau", "chauds", "jus-smoothies", "laits-vegetaux", "sports-drinks", "alcools"],
  extras: ["snacks-sales", "snacks-sucres", "fast-food", "divers"],
}

type ProductLibraryDraft = {
  name_fr: string
  category_l1: CategoryL1
  category_l2: string
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
}

function buildFoodCategoryLabels(t: TranslateFn): Record<CategoryL1, string> {
  return {
    proteins: t("food.cat.proteins"),
    carbs: t("food.cat.carbs"),
    vegetables: t("food.cat.vegetables"),
    fruits: t("food.cat.fruits"),
    fats: t("food.cat.fats"),
    drinks: t("food.cat.drinks"),
    extras: t("food.cat.extras"),
  }
}

function buildFoodSubcategoryLabels(t: TranslateFn): Record<string, string> {
  return {
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
  }
}

const CAMERA_HINT_STORAGE_KEY = "photo-meal-camera-hint-v2"
const PHOTO_MEAL_DRAFT_STORAGE_PREFIX = "photo-meal-draft-v1"

function isPackagingMode(mode: PhotoMealAnalysisMode | null | undefined) {
  return mode === "packaging" || mode === "barcode"
}

function isProductLedMode(mode: PhotoMealAnalysisMode | null | undefined) {
  return mode === "packaging" || mode === "barcode" || mode === "receipt" || mode === "hybrid"
}

function isTechnicalErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("json") ||
    normalized.includes("expected ','") ||
    normalized.includes("unexpected token") ||
    normalized.includes("syntaxerror") ||
    normalized.includes("position ") ||
    normalized.includes("line ") ||
    normalized.includes("column ") ||
    normalized.includes("client not found") ||
    normalized.includes("unauthorized") ||
    normalized.includes("nutrition_photo_log_session_unavailable") ||
    normalized.includes("nutrition_photo_log_session_not_found") ||
    // M4 : erreurs Supabase RLS et PostgreSQL
    normalized.includes("row-level security") ||
    normalized.includes("violates row") ||
    normalized.includes("pgrst") ||
    normalized.includes("pg_") ||
    normalized.includes("42501") || // code permission denied PostgreSQL
    normalized.includes("23505") || // unique violation
    normalized.includes("foreign key") ||
    normalized.includes("relation \"") ||
    normalized.includes("column \"") ||
    normalized.includes("supabase") ||
    // M4 : erreurs réseau brutes
    normalized.includes("failed to fetch") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed")
  )
}

function isNetworkError(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed") ||
    normalized.includes("aborterror") ||
    normalized.includes("networkerror")
  )
}

function getErrorMessage(error: unknown, t: TranslateFn) {
  if (error instanceof Error) {
    if (error.message.includes("schema cache") || error.message.includes("client_photo_meal_logs")) {
      return t("nutrition.photo.log.error.unavailable")
    }
    // M4 : erreurs réseau — message dédié
    if (isNetworkError(error.message)) {
      return t("nutrition.photo.log.error.network")
    }
    if (isTechnicalErrorMessage(error.message)) {
      const normalized = error.message.toLowerCase()
      if (
        normalized.includes("client not found") ||
        normalized.includes("unauthorized") ||
        normalized.includes("nutrition_photo_log_session_unavailable") ||
        normalized.includes("nutrition_photo_log_session_not_found")
      ) {
        return t("nutrition.photo.log.error.session")
      }
      // M4 : erreurs RLS Supabase — ne pas exposer les détails internes
      if (
        normalized.includes("row-level security") ||
        normalized.includes("violates row") ||
        normalized.includes("pgrst") ||
        normalized.includes("supabase")
      ) {
        return t("nutrition.photo.log.error.unavailable")
      }
      return t("nutrition.photo.log.error.analysis")
    }
    return error.message
  }
  return t("nutrition.photo.log.error.generic")
}

async function safeJson(res: Response) {
  return res.json().catch(() => ({}))
}

function logPerfTrace(label: string, startedAt: number, response: Response) {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "development") return
  const elapsedMs = Math.round(performance.now() - startedAt)
  const serverTiming = response.headers.get("server-timing")
  const serverPerf = response.headers.get("x-stryv-perf")
  console.info(`[perf] ${label}: ${elapsedMs}ms`, {
    serverTiming,
    serverPerf,
  })
}

function getUploadErrorMessage(status: number, json: any, t: TranslateFn) {
  const serverMessage = json.error?.message ?? json.error
  if (status === 413) {
    return t("nutrition.photo.log.error.uploadTooLarge")
  }
  if (status === 415) {
    return t("nutrition.photo.log.error.unsupportedFormat")
  }
  if (status === 409 && String(serverMessage ?? "").includes("Maximum photo count")) {
    return t("nutrition.photo.log.error.tooManyPhotos", { n: PHOTO_LOG_MAX_PHOTOS })
  }
  return serverMessage ?? t("nutrition.photo.log.error.uploadFailed")
}

// M7 : retourne l'image ET une fonction cleanup
// L'ObjectURL reste actif pendant toute la durée du draw canvas, puis est révoqué explicitement
async function loadImage(file: File): Promise<{ image: HTMLImageElement; cleanup: () => void }> {
  const objectUrl = URL.createObjectURL(file)
  const cleanup = () => URL.revokeObjectURL(objectUrl)
  try {
    const image = document.createElement("img")
    image.decoding = "async"
    image.src = objectUrl
    await image.decode()
    return { image, cleanup }
  } catch (err) {
    cleanup()
    throw err
  }
}

function isHeicPhoto(file: File) {
  return file.type === "image/heic" || file.type === "image/heif" || /\.hei[cf]$/i.test(file.name)
}

async function convertHeicPhoto(file: File) {
  if (!isHeicPhoto(file)) return file

  const { default: heic2any } = await import("heic2any")
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 })
  const jpeg = Array.isArray(converted) ? converted[0] : converted
  if (!jpeg) throw new Error("HEIC conversion failed")

  const baseName = file.name.replace(/\.[^.]+$/, "") || "meal"
  return new File([jpeg], `${baseName}.jpg`, { type: "image/jpeg" })
}

async function preparePhotoForUpload(file: File, t: TranslateFn) {
  const sourceFile = await convertHeicPhoto(file).catch(() => {
    throw new Error(t("nutrition.photo.log.error.readFailed"))
  })

  if (!sourceFile.type.startsWith("image/")) {
    throw new Error(t("nutrition.photo.log.error.unsupportedFormat"))
  }

  const loaded = await loadImage(sourceFile).catch(() => {
    throw new Error(t("nutrition.photo.log.error.readFailed"))
  })
  const { image, cleanup } = loaded

  try {
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
    if (shouldBypassClientCompression(sourceFile.size, sourceFile.type, longestSide)) {
      return sourceFile
    }
    const scale = longestSide > PHOTO_LOG_MAX_IMAGE_SIDE ? PHOTO_LOG_MAX_IMAGE_SIDE / longestSide : 1
    const baseWidth = Math.max(1, Math.round(image.naturalWidth * scale))
    const baseHeight = Math.max(1, Math.round(image.naturalHeight * scale))

    const renderBlob = async (width: number, height: number, quality: number) => {
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error(t("nutrition.photo.log.error.compressionFailed"))
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      // L'ObjectURL est toujours actif ici — drawImage peut s'exécuter correctement
      ctx.drawImage(image, 0, 0, width, height)
      return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    }

    let bestBlob: Blob | null = null
    const prioritizedAttempts = [
      { downscale: PHOTO_LOG_DOWNSCALE_STEPS[0], quality: PHOTO_LOG_COMPRESSION_QUALITIES[1] },
      { downscale: PHOTO_LOG_DOWNSCALE_STEPS[0], quality: PHOTO_LOG_COMPRESSION_QUALITIES[2] },
      { downscale: PHOTO_LOG_DOWNSCALE_STEPS[1], quality: PHOTO_LOG_COMPRESSION_QUALITIES[2] },
      { downscale: PHOTO_LOG_DOWNSCALE_STEPS[2], quality: PHOTO_LOG_COMPRESSION_QUALITIES[2] },
      { downscale: PHOTO_LOG_DOWNSCALE_STEPS[2], quality: PHOTO_LOG_COMPRESSION_QUALITIES[3] },
      { downscale: PHOTO_LOG_DOWNSCALE_STEPS[3], quality: PHOTO_LOG_COMPRESSION_QUALITIES[3] },
      { downscale: PHOTO_LOG_DOWNSCALE_STEPS[4], quality: PHOTO_LOG_COMPRESSION_QUALITIES[4] },
    ]

    for (const attempt of prioritizedAttempts) {
      const width = Math.max(1, Math.round(baseWidth * attempt.downscale))
      const height = Math.max(1, Math.round(baseHeight * attempt.downscale))
      const blob = await renderBlob(width, height, attempt.quality)
      if (!blob) continue
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob
      }
      if (blob.size <= PHOTO_LOG_CLIENT_TARGET_FILE_BYTES) {
        const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "meal"
        return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" })
      }
    }

    if (!bestBlob) throw new Error(t("nutrition.photo.log.error.compressionFailed"))
    const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "meal"
    return new File([bestBlob], `${baseName}.jpg`, { type: "image/jpeg" })
  } finally {
    // M7 : révocation de l'ObjectURL après tous les draws canvas
    cleanup()
  }
}

function getMealTypeLabel(mealType: MealType, t: TranslateFn) {
  const option = MEAL_TYPE_OPTIONS.find((candidate) => candidate.value === mealType)
  return option ? t(option.labelKey) : t("nutrition.photo.log.meal.generic")
}

function computeResultTotals(result: Pick<PhotoMealFinalResult, "components"> | null) {
  if (!result) {
    return {
      total_calories: 0,
      total_protein_g: 0,
      total_carbs_g: 0,
      total_fat_g: 0,
      total_fiber_g: 0,
    }
  }
  return computePhotoMealTotals(result.components)
}

function sanitizeProductNumber(value: number | null | undefined, max: number) {
  if (!Number.isFinite(value ?? NaN)) return 0
  return Math.max(0, Math.min(max, Math.round((value ?? 0) * 10) / 10))
}

function inferProductSubcategory(category: CategoryL1, productName: string) {
  const normalized = productName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (category === "proteins") {
    if (/kefir|yaourt|yogurt|skyr|fromage|lait|activia/.test(normalized)) return "laitiers"
    if (/barre|protein|proteine|whey|gainer|shake|complement/.test(normalized)) return "complements"
    if (/oeuf|egg/.test(normalized)) return "oeufs"
    if (/tofu|tempeh|seitan|lentille|pois chiche|haricot/.test(normalized)) return "vegetales"
    if (/saumon|thon|cabillaud|poisson|crevette/.test(normalized)) return "poissons"
    return "viandes"
  }

  if (category === "carbs") {
    if (/pain|wrap|tortilla|bagel|toast/.test(normalized)) return "pain"
    if (/riz|pate|avoine|cereale|semoule|quinoa/.test(normalized)) return "cereales"
    if (/lentille|pois|haricot|faluche/.test(normalized)) return "legumineuses"
    return "fecules"
  }

  if (category === "fats") {
    if (/huile|olive|colza|noix/.test(normalized)) return "huiles"
    if (/beurre|margarine|tartiner|spread|vitelma/.test(normalized)) return "autres-lipides"
    if (/sauce|mayo|mayonnaise|ketchup/.test(normalized)) return "sauces"
    return "noix-graines"
  }

  if (category === "drinks") {
    if (/eau/.test(normalized)) return "eau"
    if (/cafe|the|infusion/.test(normalized)) return "chauds"
    if (/jus|smoothie/.test(normalized)) return "jus-smoothies"
    if (/lait|amande|soja|avoine/.test(normalized)) return "laits-vegetaux"
    return "boissons"
  }

  if (category === "extras") {
    if (/barre|chocolat|biscuit|gateau|sucre|bonbon/.test(normalized)) return "snacks-sucres"
    if (/chips|cracker|sale/.test(normalized)) return "snacks-sales"
    return "divers"
  }

  return FOOD_SUBCATEGORY_OPTIONS[category][0] ?? "divers"
}

function buildProductLibraryDraft(result: PhotoMealFinalResult): ProductLibraryDraft | null {
  if (result.analysis_mode === "receipt" || !isProductLedMode(result.analysis_mode) || result.components.length === 0) return null

  const productReference = result.product_reference
  const mainComponent =
    result.components.find((component) => component.catalog_metadata?.canonical_name_fr || component.catalog_metadata?.brand) ??
    result.components[0]
  const rawName =
    productReference?.canonical_name_fr?.trim() ||
    productReference?.name_fr?.trim() ||
    mainComponent.catalog_metadata?.canonical_name_fr?.trim() ||
    mainComponent.name_fr.trim()
  const brand = productReference?.brand?.trim() || mainComponent.catalog_metadata?.brand?.trim() || ""
  const name = brand && !rawName.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${rawName}` : rawName
  const category = mainComponent.category_hint

  return {
    name_fr: name,
    category_l1: category,
    category_l2: inferProductSubcategory(category, name),
    kcal_per_100g: sanitizeProductNumber(mainComponent.kcal_per_100g, 900),
    protein_per_100g: sanitizeProductNumber(mainComponent.protein_per_100g, 100),
    carbs_per_100g: sanitizeProductNumber(mainComponent.carbs_per_100g, 100),
    fat_per_100g: sanitizeProductNumber(mainComponent.fat_per_100g, 100),
    fiber_per_100g: sanitizeProductNumber(mainComponent.fiber_per_100g, 100),
  }
}

function computeReliability(
  analysis: PhotoMealAnalysisSummary | null,
  photoCount: number,
  t: TranslateFn,
) {
  if (!analysis) {
    return {
      score: 0,
      strengths: [] as string[],
      uncertainties: [] as string[],
    }
  }

  if (isProductLedMode(analysis.analysis_mode)) {
    const breakdown = analysis.confidence_breakdown
    const score = breakdown
      ? Math.round(((breakdown.capture + breakdown.ocr + breakdown.quantity + breakdown.nutrition) / 4) * 100)
      : photoCount >= 3
        ? 90
        : photoCount >= 2
          ? 84
          : 72
    const strengths: string[] = []
    const uncertainties: string[] = []

    if (photoCount >= 2) strengths.push(t("nutrition.photo.reliability.productViews"))
    if (analysis.product_reference?.canonical_name_fr) strengths.push(t("nutrition.photo.reliability.productIdentified", { name: analysis.product_reference.canonical_name_fr }))
    if (analysis.components.length > 0) strengths.push(t("nutrition.photo.reliability.componentsComputed", {
      count: analysis.components.length,
      suffix: analysis.components.length > 1 ? "s" : "",
    }))
    if (analysis.manual_detail && /\d/.test(analysis.manual_detail)) strengths.push(t("nutrition.photo.reliability.explicitQuantities"))
    if ((breakdown?.ocr ?? 0) >= 0.9) strengths.push(t("nutrition.photo.reliability.nutritionTable"))

    if (!analysis.product_reference?.canonical_name_fr) uncertainties.push(t("nutrition.photo.reliability.productNameConfirm"))
    if (!analysis.manual_detail || !/\d/.test(analysis.manual_detail)) uncertainties.push(t("nutrition.photo.reliability.userQuantityConfirm"))
    if ((breakdown?.ocr ?? 0) < 0.75) uncertainties.push(t("nutrition.photo.reliability.labelFragile"))
    if (analysis.components.length === 0) uncertainties.push(t("nutrition.photo.reliability.compositionIncomplete"))

    return {
      score: Math.max(52, Math.min(92, score)),
      strengths,
      uncertainties,
    }
  }

  let score = 54
  const strengths: string[] = []
  const uncertainties: string[] = []

  if (photoCount >= 2) {
    score += 14
    strengths.push(t("nutrition.photo.reliability.twoAngles"))
  } else {
    uncertainties.push(t("nutrition.photo.reliability.sideMissing"))
  }

  const timeline = analysis.photo_timeline ?? []
  const hasLeftoversPhoto = timeline.some((photo) => photo.role === "after_meal_leftovers")
  const hasSeparateWeighing = timeline.some((photo) => photo.role === "separate_weighing")
  if (hasLeftoversPhoto) {
    score += 8
    strengths.push(t("nutrition.photo.reliability.leftoversDetected"))
  }
  if (hasSeparateWeighing) {
    score += 8
    strengths.push(t("nutrition.photo.reliability.separateWeight"))
  }
  if (analysis.leftovers_estimate?.detected && analysis.leftovers_estimate.grams_estimate) {
    strengths.push(t("nutrition.photo.reliability.leftoversEstimate", {
      grams: Math.round(analysis.leftovers_estimate.grams_estimate),
    }))
  }

  if (analysis.scale_weight_g && (analysis.scale_weight_confidence ?? 0) >= 0.55) {
    score += 12
    strengths.push(t("nutrition.photo.reliability.weightDetected", {
      grams: Math.round(analysis.scale_weight_g),
    }))
  } else if (analysis.manual_weight_g) {
    score += 8
    strengths.push(t("nutrition.photo.reliability.manualWeight"))
  } else {
    uncertainties.push(t("nutrition.photo.reliability.weightUnconfirmed"))
  }

  if ((analysis.components?.length ?? 0) > 0) {
    score += 8
    strengths.push(t("nutrition.photo.reliability.foodDetected", {
      count: analysis.components.length,
      suffix: analysis.components.length > 1 ? "s" : "",
    }))
  } else {
    uncertainties.push(t("nutrition.photo.reliability.compositionBlurred"))
  }

  const ambiguityCount =
    (analysis.ambiguity_tags?.length ?? 0) +
    analysis.components.reduce((sum, component) => sum + component.ambiguity_tags.length, 0)
  score -= ambiguityCount * 4
  if (analysis.components.some((component) => component.ambiguity_tags.includes("cooked_vs_raw"))) score -= 8
  if (analysis.components.some((component) => component.ambiguity_tags.includes("non_edible_parts"))) score -= 8
  if ((analysis.manual_detail ?? "").trim().length > 0) score += 4

  if (analysis.ambiguity_tags.includes("hidden_fats")) uncertainties.push(t("nutrition.photo.reliability.hiddenFat"))
  if (analysis.ambiguity_tags.includes("scale_unreadable")) uncertainties.push(t("nutrition.photo.reliability.scaleUnreadable"))
  if (analysis.components.some((component) => component.ambiguity_tags.includes("cooked_vs_raw"))) {
    uncertainties.push(t("nutrition.photo.reliability.cookingConfirm"))
  }
  if (analysis.components.some((component) => component.ambiguity_tags.includes("non_edible_parts"))) {
    uncertainties.push(t("nutrition.photo.reliability.nonEdibleParts"))
  }
  if (analysis.components.some((component) => component.ambiguity_tags.includes("partial_weight"))) {
    uncertainties.push(t("nutrition.photo.reliability.partialWeight"))
  }
  if (analysis.leftovers_estimate?.detected && !analysis.leftovers_estimate.grams_estimate) {
    uncertainties.push(t("nutrition.photo.reliability.leftoversVisible"))
  }

  return {
    score: Math.max(38, Math.min(88, Math.round(score))),
    strengths,
    uncertainties,
  }
}

function formatReliabilityLabel(score: number, t: TranslateFn) {
  if (score >= 82) return t("nutrition.photo.log.reliability.high")
  if (score >= 68) return t("nutrition.photo.log.reliability.good")
  if (score >= 52) return t("nutrition.photo.log.reliability.medium")
  return t("nutrition.photo.log.reliability.cautious")
}

function formatSourceNote(note: string | null | undefined, t: TranslateFn) {
  const normalized = String(note ?? "").trim()
  if (!normalized) return t("nutrition.photo.log.source.estimatedFromPhoto")
  if (/jaune retir[ée]/i.test(normalized)) return t("nutrition.photo.log.source.yolkRemoved")
  if (/composition d'œufs affinée/i.test(normalized)) return t("nutrition.photo.log.source.eggsAdjusted")
  if (/répartition prudente d'un mélange|repartition prudente d'un melange/i.test(normalized)) {
    return t("nutrition.photo.log.source.mixEstimated")
  }
  if (/quantité de .* fournie dans la note utilisateur|quantite de .* fournie dans la note utilisateur/i.test(normalized)) {
    return t("nutrition.photo.log.source.quantityFromNote")
  }
  if (/ajout estimation matière grasse|ajout estimation matiere grasse/i.test(normalized)) {
    return t("nutrition.photo.log.source.fatEstimated")
  }
  if (/ajout estimation sauce/i.test(normalized)) return t("nutrition.photo.log.source.sauceEstimated")
  if (/information utilisateur fusionnée|information utilisateur fusionnee/i.test(normalized)) {
    return t("nutrition.photo.log.source.userDataMerged")
  }
  return normalized
}

function formatSignedValue(value: number, suffix: string) {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10
  if (rounded > 0) return `+${rounded}${suffix}`
  if (rounded < 0) return `${rounded}${suffix}`
  return `0${suffix}`
}

function formatMacroValue(value: number) {
  return `${Math.round(value)}g`
}

function formatComponentQuantityLabel(component: PhotoMealFinalComponent, t: TranslateFn) {
  if (component.quantity_unit === "serving") {
    const count = Math.round((component.quantity_g / 100) * 10) / 10
    return count === 1
      ? t("nutrition.photo.log.quantity.oneServing")
      : t("nutrition.photo.log.quantity.servings", { n: count })
  }
  if (component.quantity_unit === "ml") return `${Math.round(component.quantity_g)} ml`
  return t("nutrition.photo.log.success.keptGrams", { n: Math.round(component.quantity_g) })
}

function toReviewResult(result: PhotoMealFinalResult | null) {
  if (!result) return null
  return {
    ...result,
    components: result.components.map((component) => ({ ...component })),
  }
}

export default function PhotoMealLogSheet({
  open,
  activeDate,
  onClose,
  onSuccess,
  presentation = "sheet",
  initialNoteOpen = false,
  nutritionContext = null,
}: PhotoMealLogSheetProps) {
  const { lang, t } = useClientT()
  const isPagePresentation = presentation === "page"
  useBodyScrollLock(open && !isPagePresentation)

  const [step, setStep] = useState<Step>("capture")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [mealType, setMealType] = useState<MealType>("lunch")
  const [manualWeightInput, setManualWeightInput] = useState("")
  const [manualDetailInput, setManualDetailInput] = useState("")
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [analysis, setAnalysis] = useState<PhotoMealAnalysisSummary | null>(null)
  const [result, setResult] = useState<PhotoMealFinalResult | null>(null)
  const [reviewResult, setReviewResult] = useState<PhotoMealFinalResult | null>(null)
  const [loggedMeal, setLoggedMeal] = useState<LoggedMealTotals | null>(null)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadingState, setUploadingState] = useState<UploadingState>(null)
  const [deletingPhoto, setDeletingPhoto] = useState<DeletingPhotoState>(null)
  const [clarifySelection, setClarifySelection] = useState<ClarifySelectionState>(null)
  const [leftoversInput, setLeftoversInput] = useState("")
  const [refiningLeftovers, setRefiningLeftovers] = useState(false)
  const [leftoversApplied, setLeftoversApplied] = useState<null | {
    leftovers_weight_g: number
    baseline_weight_g: number
    consumed_factor: number
    meal_totals: {
      total_calories: number
      total_protein_g: number
      total_carbs_g: number
      total_fat_g: number
      total_fiber_g: number
    }
  }>(null)
  const [lastRefinementSummary, setLastRefinementSummary] = useState<RefinementDeltaSummary>(null)
  const [mealNote, setMealNote] = useState("")
  const [noteOpen, setNoteOpen] = useState(initialNoteOpen)
  const [showCameraHint, setShowCameraHint] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [showAddFood, setShowAddFood] = useState(false)
  const [foodSearchQuery, setFoodSearchQuery] = useState("")
  const [foodSearchResults, setFoodSearchResults] = useState<FoodItem[]>([])
  const [foodSearchLoading, setFoodSearchLoading] = useState(false)
  const [selectedFoodToAdd, setSelectedFoodToAdd] = useState<FoodItem | null>(null)
  const [foodQuantityInput, setFoodQuantityInput] = useState("100")
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [draftRecoveryComplete, setDraftRecoveryComplete] = useState(false)

  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const fallbackCameraInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startingCameraRef = useRef(false)
  const sessionCreationRef = useRef<Promise<string> | null>(null)
  const createdSessionIdRef = useRef<string | null>(null)
  const foodSearchCacheRef = useRef(new Map<string, FoodItem[]>())

  const draftStorageKey = `${PHOTO_MEAL_DRAFT_STORAGE_PREFIX}:${activeDate}`

  const clearDraftSession = useCallback(() => {
    try {
      window.localStorage.removeItem(draftStorageKey)
    } catch {}
  }, [draftStorageKey])

  const handleCloseScanner = useCallback(() => {
    clearDraftSession()
    onClose()
  }, [clearDraftSession, onClose])

  const heroPhotoUrl = useMemo(
    () => photos[0]?.signed_url ?? null,
    [photos],
  )
  const pendingQuestion = result?.pending_question ?? null
  const showClarificationSheet =
    !!pendingQuestion &&
    (step === "precheck" || step === "clarify")
  const reliability = useMemo(() => computeReliability(analysis, photos.length, t), [analysis, photos.length, t])
  const baselineWeight = analysis?.scale_weight_g ?? analysis?.manual_weight_g ?? null
  const canRefineWithLeftovers =
    step === "success" &&
    !isProductLedMode(reviewResult?.analysis_mode) &&
    typeof baselineWeight === "number" &&
    baselineWeight > 0 &&
    !!sessionId
  const successTotals = useMemo(() => {
    if (leftoversApplied?.meal_totals) return leftoversApplied.meal_totals
    if (loggedMeal) return loggedMeal
    return computeResultTotals(reviewResult)
  }, [leftoversApplied?.meal_totals, loggedMeal, reviewResult])
  const reviewTotals = useMemo(() => computeResultTotals(reviewResult), [reviewResult])
  const mealFit = useMemo(() => {
    if (!nutritionContext || !reviewResult || isProductLedMode(reviewResult.analysis_mode)) return null
    return evaluateMealFit({
      target: nutritionContext.target,
      consumedToday: nutritionContext.consumed,
      mealComponents: reviewResult.components.map((component) => ({
        name: component.name_fr,
        category_hint: component.category_hint,
        quantity_g: component.quantity_g,
        kcal_per_100g: component.kcal_per_100g,
        protein_per_100g: component.protein_per_100g,
        carbs_per_100g: component.carbs_per_100g,
        fat_per_100g: component.fat_per_100g,
      })),
      measuredWeightG: baselineWeight,
    })
  }, [baselineWeight, nutritionContext, reviewResult])
  const reviewValidation = useMemo(
    () => reviewResult ? validatePhotoMealResult(reviewResult, lang) : null,
    [lang, reviewResult],
  )
  const hasPhotos = photos.length > 0
  const hasTextInput = manualDetailInput.trim().length >= 3
  const canStartAnalysis = hasPhotos || hasTextInput
  const canValidateReview =
    !!reviewResult &&
    reviewResult.components.length > 0 &&
    (reviewValidation?.issues.length ?? 0) === 0
  const isClarifyBusy = busyLabel === t("nutrition.photo.log.stage.adjustment")

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    if (startingCameraRef.current || !open || step !== "capture") return
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(t("nutrition.photo.log.camera.unavailableDevice"))
      return
    }

    try {
      startingCameraRef.current = true
      setCameraError(null)

      const getUserMediaWithTimeout = (constraints: MediaStreamConstraints, timeoutMs: number) => {
        const mediaPromise = navigator.mediaDevices.getUserMedia(constraints)
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new DOMException("getUserMedia timeout", "TimeoutError")), timeoutMs),
        )
        return Promise.race([mediaPromise, timeoutPromise])
      }

      let stream: MediaStream
      try {
        stream = await getUserMediaWithTimeout(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false },
          15000,
        )
      } catch (firstError) {
        const err = firstError as DOMException
        if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") {
          stream = await getUserMediaWithTimeout(
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            12000,
          )
        } else {
          throw firstError
        }
      }

      streamRef.current = stream
      const [track] = stream.getVideoTracks()
      const capabilities = (track?.getCapabilities?.() ?? {}) as { focusMode?: string[] }
      if (track && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes("continuous")) {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" as any }] }).catch(() => undefined)
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch (playErr) {
          console.warn("[camera] play() failed:", playErr)
        }
      }
      setCameraReady(true)
    } catch (err) {
      const domErr = err as DOMException
      if (domErr.name === "NotAllowedError" || domErr.name === "PermissionDeniedError") {
        setCameraError(t("nutrition.photo.log.camera.permissionDenied"))
      } else {
        setCameraError(t("nutrition.photo.log.camera.unavailableDevice"))
      }
    } finally {
      startingCameraRef.current = false
    }
  }, [open, step, t])

  useEffect(() => {
    if (!open) {
      setStep("capture")
      setSessionId(null)
      createdSessionIdRef.current = null
      setMealType("lunch")
      setManualWeightInput("")
      setManualDetailInput("")
      setPhotos([])
      setAnalysis(null)
      setResult(null)
      setReviewResult(null)
      setLoggedMeal(null)
      setBusyLabel(null)
      setError(null)
      setUploadingState(null)
      setDeletingPhoto(null)
      setClarifySelection(null)
      setLeftoversInput("")
      setRefiningLeftovers(false)
      setLeftoversApplied(null)
      setLastRefinementSummary(null)
      setMealNote("")
      setNoteOpen(initialNoteOpen)
      setShowAddFood(false)
      setFoodSearchQuery("")
      setFoodSearchResults([])
      setSelectedFoodToAdd(null)
      setFoodQuantityInput("100")
      setSelectedPhotoId(null)
      setDraftRecoveryComplete(false)
      setShowCameraHint(false)
      stopCamera()
      return
    }

    try {
      const alreadyDismissed = window.localStorage.getItem(CAMERA_HINT_STORAGE_KEY) === "1"
      setShowCameraHint(!alreadyDismissed)
    } catch {
      setShowCameraHint(true)
    }
  }, [initialNoteOpen, open, stopCamera])

  useEffect(() => {
    if (!open || draftRecoveryComplete || sessionId || sessionCreationRef.current) return

    let cancelled = false
    const recover = async () => {
      setBusyLabel(t("common.loading"))
      try {
        const stored = window.localStorage.getItem(draftStorageKey)
        if (!stored) return
        const draft = JSON.parse(stored) as {
          session_id?: string
          meal_type?: MealType
          manual_weight_input?: string
          manual_detail_input?: string
        }
        if (!draft.session_id) return

        const res = await fetch(`/api/client/nutrition/photo-log?session_id=${encodeURIComponent(draft.session_id)}`)
        const json = await safeJson(res)
        if (!res.ok || cancelled) {
          if (res.status === 404) clearDraftSession()
          return
        }

        const session = json.data as Record<string, any>
        if (
          String(session.physiological_date ?? "") !== activeDate ||
          session.meal_id ||
          session.status === "logged" ||
          session.status === "refined"
        ) {
          clearDraftSession()
          return
        }

        const recoveredSessionId = String(session.id)
        const recoveredPhotos = Array.isArray(session.client_photo_meal_log_photos)
          ? session.client_photo_meal_log_photos as UploadedPhoto[]
          : []
        const recoveredAnalysis = session.analysis_summary && Object.keys(session.analysis_summary).length > 0
          ? session.analysis_summary as PhotoMealAnalysisSummary
          : null
        const recoveredResult = session.analysis_result && Object.keys(session.analysis_result).length > 0
          ? session.analysis_result as PhotoMealFinalResult
          : null

        createdSessionIdRef.current = recoveredSessionId
        setSessionId(recoveredSessionId)
        setMealType((session.meal_type as MealType | null) ?? draft.meal_type ?? "lunch")
        setManualWeightInput(
          draft.manual_weight_input ??
          (Number(session.manual_weight_g ?? 0) > 0 ? String(session.manual_weight_g) : ""),
        )
        setManualDetailInput(draft.manual_detail_input ?? recoveredAnalysis?.manual_detail ?? "")
        setPhotos(recoveredPhotos)
        setAnalysis(recoveredAnalysis)
        setResult(recoveredResult)
        setReviewResult(toReviewResult(recoveredResult))

        if (session.status === "ready_to_log" && recoveredResult) {
          setStep("review")
        } else if (session.status === "clarifying" && recoveredAnalysis && recoveredResult) {
          setStep("precheck")
        } else {
          setStep("capture")
        }
      } catch {
        clearDraftSession()
      } finally {
        if (!cancelled) {
          setBusyLabel(null)
          setDraftRecoveryComplete(true)
        }
      }
    }

    void recover()
    return () => {
      cancelled = true
    }
  }, [activeDate, clearDraftSession, draftRecoveryComplete, draftStorageKey, open, sessionId, t])

  useEffect(() => {
    if (!open || !sessionId) return
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({
        session_id: sessionId,
        meal_type: mealType,
        manual_weight_input: manualWeightInput,
        manual_detail_input: manualDetailInput,
      }))
    } catch {}
  }, [draftStorageKey, manualDetailInput, manualWeightInput, mealType, open, sessionId])

  useEffect(() => {
    if (!open || !initialNoteOpen) return
    if (step !== "capture") return
    if (manualDetailInput.trim().length > 0) return
    setNoteOpen(true)
  }, [initialNoteOpen, manualDetailInput, open, step])

  useEffect(() => {
    if (!open || step !== "capture") {
      stopCamera()
      return
    }
    void startCamera()
    return stopCamera
  }, [open, startCamera, step, stopCamera])

  useEffect(() => () => stopCamera(), [stopCamera])

  useEffect(() => {
    if (!showAddFood) return

    const query = foodSearchQuery.trim()
    const cacheKey = query.toLowerCase()
    const cached = foodSearchCacheRef.current.get(cacheKey)
    if (cached) {
      setFoodSearchResults(cached)
      setFoodSearchLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setFoodSearchLoading(true)
        const params = new URLSearchParams({ limit: "8" })
        if (query) params.set("q", query)
        const res = await fetch(`/api/client/food-items?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = await safeJson(res)
        if (!res.ok) throw new Error(json.error?.message ?? json.error ?? t("nutrition.photo.log.error.searchFailed"))
        const nextResults = (json.data ?? []) as FoodItem[]
        foodSearchCacheRef.current.set(cacheKey, nextResults)
        setFoodSearchResults(nextResults)
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") {
          setFoodSearchResults([])
        }
      } finally {
        setFoodSearchLoading(false)
      }
    }, query ? 150 : 0)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [foodSearchQuery, showAddFood, t])

  const createSession = useCallback(async () => {
    if (sessionId) return sessionId
    if (createdSessionIdRef.current) return createdSessionIdRef.current
    if (sessionCreationRef.current) return sessionCreationRef.current

    const promise = (async () => {
      const parsedWeight = Number(manualWeightInput)
      const payload: {
        date: string
        meal_type: MealType
        manual_weight_g?: number
      } = {
        date: activeDate,
        meal_type: mealType,
      }
      if (Number.isFinite(parsedWeight) && parsedWeight > 0) {
        payload.manual_weight_g = parsedWeight
      }

      const res = await fetch("/api/client/nutrition/photo-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await safeJson(res)
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? t("nutrition.photo.log.error.sessionCreate"))
      }

      const nextSessionId = String(json.data.id)
      setSessionId(nextSessionId)
      createdSessionIdRef.current = nextSessionId
      try {
        window.localStorage.setItem(draftStorageKey, JSON.stringify({
          session_id: nextSessionId,
          meal_type: mealType,
          manual_weight_input: manualWeightInput,
          manual_detail_input: manualDetailInput,
        }))
      } catch {}
      return nextSessionId
    })()

    sessionCreationRef.current = promise
    try {
      return await promise
    } finally {
      sessionCreationRef.current = null
    }
  }, [activeDate, draftStorageKey, manualDetailInput, manualWeightInput, mealType, sessionId, t])

  useEffect(() => {
    if (!open || !draftRecoveryComplete || step !== "capture" || sessionId || sessionCreationRef.current) return

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => {
        void createSession().catch(() => undefined)
      }, { timeout: 700 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timer = window.setTimeout(() => {
      void createSession().catch(() => undefined)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [createSession, draftRecoveryComplete, open, sessionId, step])

  const patchSession = useCallback(async (
    payload: { meal_type?: MealType | null; manual_weight_g?: number | null },
    explicitSessionId?: string,
  ) => {
    const targetSessionId = explicitSessionId ?? sessionId
    if (!targetSessionId) return
    const res = await fetch("/api/client/nutrition/photo-log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: targetSessionId, ...payload }),
    })
    const json = await safeJson(res)
    if (!res.ok) {
      throw new Error(json.error?.message ?? json.error ?? t("nutrition.photo.log.error.sessionUpdate"))
    }
  }, [sessionId, t])

  const uploadSinglePhoto = useCallback(async (kind: PhotoMealPhotoKind, file: File) => {
    const [currentSessionId, preparedFile] = await Promise.all([
      createSession(),
      preparePhotoForUpload(file, t),
    ])
    const uploadViaServer = async () => {
      const form = new FormData()
      form.append("session_id", currentSessionId)
      form.append("kind", kind)
      form.append("file", preparedFile)
      const fallbackStartedAt = performance.now()
      const fallbackRes = await fetch("/api/client/nutrition/photo-log/upload-photo", {
        method: "POST",
        body: form,
      })
      logPerfTrace("photo-upload:fallback", fallbackStartedAt, fallbackRes)
      const fallbackJson = await safeJson(fallbackRes)
      if (!fallbackRes.ok) {
        throw new Error(getUploadErrorMessage(fallbackRes.status, fallbackJson, t))
      }
      setPhotos((current) => [...current, fallbackJson.data as UploadedPhoto])
    }
    const ext = preparedFile.name.split(".").pop()?.toLowerCase() ?? "jpg"
    const prepareStartedAt = performance.now()
    const prepareRes = await fetch("/api/client/nutrition/photo-log/upload-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "prepare",
        session_id: currentSessionId,
        kind,
        file_extension: ext,
        file_size: preparedFile.size,
        content_type: preparedFile.type,
      }),
    })
    logPerfTrace("photo-upload:prepare", prepareStartedAt, prepareRes)
    const prepareJson = await safeJson(prepareRes)
    if (!prepareRes.ok) {
      throw new Error(getUploadErrorMessage(prepareRes.status, prepareJson, t))
    }

    let uploadRes: Response
    try {
      uploadRes = await fetch(String(prepareJson.upload_url), {
        method: "PUT",
        headers: { "Content-Type": preparedFile.type },
        body: preparedFile,
      })
    } catch {
      await uploadViaServer()
      return
    }

    if (!uploadRes.ok) {
      await uploadViaServer()
      return
    }

    const completeStartedAt = performance.now()
    const completeRes = await fetch("/api/client/nutrition/photo-log/upload-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "complete",
        session_id: currentSessionId,
        kind,
        storage_path: prepareJson.storage_path,
      }),
    })
    logPerfTrace("photo-upload:complete", completeStartedAt, completeRes)
    const completeJson = await safeJson(completeRes)
    if (!completeRes.ok) {
      throw new Error(getUploadErrorMessage(completeRes.status, completeJson, t))
    }

    setPhotos((current) => [...current, completeJson.data as UploadedPhoto])
  }, [createSession, t])

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setError(null)
    setBusyLabel(t("common.loading"))

    try {
      if (photos.length + files.length > PHOTO_LOG_MAX_PHOTOS) {
        throw new Error(t("nutrition.photo.log.error.tooManyPhotos", { n: PHOTO_LOG_MAX_PHOTOS }))
      }
      for (const file of files) {
        const kind: PhotoMealPhotoKind = "context"
        setUploadingState({ kind, fileName: file.name })
        await uploadSinglePhoto(kind, file)
      }
      setBusyLabel(null)
      setUploadingState(null)
    } catch (cause) {
      setBusyLabel(null)
      setUploadingState(null)
      setError(getErrorMessage(cause, t))
      setStep("error")
    }
  }, [photos.length, t, uploadSinglePhoto])

  const captureLivePhoto = useCallback(async () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const width = video.videoWidth || 1080
    const height = video.videoHeight || 1440
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(video, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.96))
    if (!blob) return
    const file = new File([blob], `meal-${Date.now()}.jpg`, { type: "image/jpeg" })
    await uploadFiles([file])
  }, [uploadFiles])

  const handleGallerySelection = useCallback(async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : []
    await uploadFiles(files)
  }, [uploadFiles])

  const handleDeletePhoto = useCallback(async (photoId: string) => {
    if (!sessionId) return
    try {
      setDeletingPhoto({ id: photoId })
      setError(null)
      const res = await fetch(
        `/api/client/nutrition/photo-log/upload-photo?session_id=${encodeURIComponent(sessionId)}&photo_id=${encodeURIComponent(photoId)}`,
        { method: "DELETE" },
      )
      const json = await safeJson(res)
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? t("nutrition.photo.log.error.deletePhoto"))
      }
      setPhotos((current) => current.filter((photo) => photo.id !== photoId))
      setSelectedPhotoId((current) => (current === photoId ? null : current))
      setDeletingPhoto(null)
    } catch (cause) {
      setDeletingPhoto(null)
      setError(getErrorMessage(cause, t))
    }
  }, [sessionId, t])

  const handleDismissCameraHint = useCallback(() => {
    setShowCameraHint(false)
    try {
      window.localStorage.setItem(CAMERA_HINT_STORAGE_KEY, "1")
    } catch {}
  }, [])

  const handleMealTypeChange = useCallback(async (value: MealType) => {
    setMealType(value)
    setResult((current) => current ? { ...current, meal_type: value } : current)
    setReviewResult((current) => current ? { ...current, meal_type: value } : current)
    try {
      const currentSessionId = await createSession()
      await patchSession({ meal_type: value }, currentSessionId)
    } catch (cause) {
      setError(getErrorMessage(cause, t))
    }
  }, [createSession, patchSession, t])

  const handleAnalyze = useCallback(async () => {
    try {
      const currentSessionId = await createSession()
      const parsedWeight = Number(manualWeightInput)
      if (Number.isFinite(parsedWeight) && parsedWeight > 0) {
        await patchSession({ manual_weight_g: parsedWeight }, currentSessionId)
      } else {
        await patchSession({ manual_weight_g: null }, currentSessionId)
      }

      setStep("analyzing")
      setBusyLabel(t("nutrition.photo.log.busy.analyzingTitle"))
      setError(null)

      if (!hasPhotos && hasTextInput) {
        const textRes = await fetch("/api/client/nutrition/voice-parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: manualDetailInput.trim(),
            physiological_date: activeDate,
          }),
        })
        const textJson = await safeJson(textRes)
        if (!textRes.ok) {
          throw new Error(textJson.error?.message ?? textJson.error ?? t("nutrition.photo.log.error.textAnalysis"))
        }

        const nextMealType = (textJson.meal_type as MealType) || mealType
        const { analysis: nextAnalysis, result: nextResult } = buildTextOnlyPhotoLogDraft({
          transcript: String(textJson.clean_transcript ?? manualDetailInput.trim()),
          mealType: nextMealType,
          items: ((textJson.items ?? []) as VoiceParseResponseItem[]).map((item) => ({
            ...item,
            category_l1: item.category_l1,
          })),
          lang,
        })

        setMealType(nextMealType)
        setAnalysis(nextAnalysis)
        setResult(nextResult)
        setReviewResult(toReviewResult(nextResult))
        setLastRefinementSummary(null)
        setBusyLabel(null)
        setStep("review")
        return
      }

      const analyzeStartedAt = performance.now()

      // M1 : Lecture SSE — le serveur envoie des événements de progression en temps réel
      const res = await fetch("/api/client/nutrition/photo-log/analyze", {
        method: "POST",
        // Les réponses JSON sont nettement plus fiables que le SSE dans la webview iOS.
        // Une analyse peut durer assez longtemps pour que le flux SSE soit coupé alors que
        // le serveur a bien terminé son travail.
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: currentSessionId,
          manual_detail: manualDetailInput.trim() || undefined,
        }),
      })
      logPerfTrace("photo-analyze", analyzeStartedAt, res)

      if (!res.ok) {
        // Fallback JSON sur les erreurs HTTP (401, 404, 400, etc.)
        const json = await safeJson(res)
        throw new Error(json.error?.message ?? json.error ?? t("nutrition.photo.log.error.analysis"))
      }

      const contentType = res.headers.get("content-type") ?? ""
      let nextAnalysis: PhotoMealAnalysisSummary | null = null
      let nextResult: PhotoMealFinalResult | null = null

      if (contentType.includes("text/event-stream") && res.body) {
        // Mode streaming SSE : lire événement par événement
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Traiter les blocs SSE complets (séparés par \n\n)
          const parts = buffer.split("\n\n")
          // Le dernier élément peut être incomplet — le garder dans le buffer
          buffer = parts.pop() ?? ""

          for (const part of parts) {
            if (!part.trim()) continue
            let eventType = "message"
            let dataLine = ""
            for (const line of part.split("\n")) {
              if (line.startsWith("event: ")) eventType = line.slice(7).trim()
              if (line.startsWith("data: ")) dataLine = line.slice(6).trim()
            }
            if (!dataLine) continue

            let parsed: any
            try { parsed = JSON.parse(dataLine) } catch { continue }

            if (eventType === "progress" && parsed.message) {
              // Mise à jour progressive du label visible
              setBusyLabel(parsed.message)
            } else if (eventType === "result" && parsed.data) {
              nextAnalysis = (parsed.data.analysis ?? null) as PhotoMealAnalysisSummary | null
              nextResult = (parsed.data.result ?? null) as PhotoMealFinalResult | null
            } else if (eventType === "error") {
              throw new Error(parsed.error ?? t("nutrition.photo.log.error.analysis"))
            }
          }
        }
      } else {
        // Fallback JSON classique (si le serveur ne supporte pas SSE)
        const json = await safeJson(res)
        if (!res.ok) {
          throw new Error(json.error?.message ?? json.error ?? t("nutrition.photo.log.error.analysis"))
        }
        nextAnalysis = (json.data.analysis ?? null) as PhotoMealAnalysisSummary | null
        nextResult = (json.data.result ?? null) as PhotoMealFinalResult | null
      }

      setAnalysis(nextAnalysis)
      setResult(nextResult)
      setReviewResult(toReviewResult(nextResult))
      setLastRefinementSummary(null)
      setBusyLabel(null)
      setStep("precheck")
    } catch (cause) {
      setBusyLabel(null)
      setError(getErrorMessage(cause, t))
      setStep("error")
    }
  }, [activeDate, createSession, hasPhotos, hasTextInput, manualDetailInput, manualWeightInput, mealType, patchSession, t])

  const handleClarification = useCallback(async (value: string) => {
    if (!sessionId || !result?.pending_question) return

    try {
      const previousTotals = computeResultTotals(result)
      const selectedOption = result.pending_question.options.find((option) => option.value === value)
      setClarifySelection({
        key: result.pending_question.key,
        value,
      })
      setBusyLabel(t("nutrition.photo.log.stage.adjustment"))
      const res = await fetch("/api/client/nutrition/photo-log/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          key: result.pending_question.key,
          value,
        }),
      })
      const json = await safeJson(res)
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? t("nutrition.photo.log.error.clarify"))
      }

      const nextResult = json.data as PhotoMealFinalResult
      const nextTotals = computeResultTotals(nextResult)
      setBusyLabel(null)
      setResult(nextResult)
      setReviewResult(toReviewResult(nextResult))
      setLastRefinementSummary({
        question: result.pending_question.prompt,
        answerLabel: selectedOption?.label ?? value,
        deltaCalories: Math.round(nextTotals.total_calories - previousTotals.total_calories),
        deltaProteinG: Math.round((nextTotals.total_protein_g - previousTotals.total_protein_g) * 10) / 10,
        deltaCarbsG: Math.round((nextTotals.total_carbs_g - previousTotals.total_carbs_g) * 10) / 10,
        deltaFatG: Math.round((nextTotals.total_fat_g - previousTotals.total_fat_g) * 10) / 10,
      })
      setClarifySelection(null)
      if (nextResult.pending_question) {
        setStep("clarify")
        return
      }
      setStep("review")
    } catch (cause) {
      setBusyLabel(null)
      setClarifySelection(null)
      setError(getErrorMessage(cause, t))
      setStep("error")
    }
  }, [result?.pending_question, sessionId, t])

  const handleSkipClarification = useCallback(() => {
    if (!pendingQuestion) return
    const unknownOption = pendingQuestion.options.find((option) => option.value === "unknown")
    if (unknownOption) {
      void handleClarification(unknownOption.value)
      return
    }
    setStep("review")
  }, [handleClarification, pendingQuestion])

  const handleValidateMeal = useCallback(async () => {
    if (!sessionId || !reviewResult) return

    try {
      setStep("logging")
      setBusyLabel(t("nutrition.photo.log.stage.saving"))
      setError(null)

      const res = await fetch("/api/client/nutrition/photo-log/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          physiological_date: activeDate,
          notes: mealNote.trim() || undefined,
          result_override: reviewResult,
        }),
      })
      const json = await safeJson(res)
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? t("nutrition.photo.log.error.saveMeal"))
      }

      setLoggedMeal(json.data as LoggedMealTotals)
      clearDraftSession()
      setBusyLabel(null)
      setStep("success")
    } catch (cause) {
      setBusyLabel(null)
      setError(getErrorMessage(cause, t))
      setStep("error")
    }
  }, [activeDate, clearDraftSession, mealNote, reviewResult, sessionId, t])

  const handleLeftoversRefine = useCallback(async () => {
    if (!sessionId) return

    const leftoversWeight = Number(leftoversInput)
    if (!Number.isFinite(leftoversWeight) || leftoversWeight < 0) {
      setError(t("nutrition.photo.log.error.invalidLeftovers"))
      return
    }

    try {
      setRefiningLeftovers(true)
      setError(null)
      const res = await fetch("/api/client/nutrition/photo-log/refine-leftovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          leftovers_weight_g: leftoversWeight,
        }),
      })
      const json = await safeJson(res)
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? t("nutrition.photo.log.error.leftoversFailed"))
      }
      setLeftoversApplied(json.data)
      setRefiningLeftovers(false)
    } catch (cause) {
      setRefiningLeftovers(false)
      setError(getErrorMessage(cause, t))
    }
  }, [leftoversInput, sessionId, t])

  const updateReviewComponent = useCallback((index: number, updater: (component: PhotoMealFinalComponent) => PhotoMealFinalComponent | null) => {
    setReviewResult((current) => {
      if (!current) return current
      const nextComponents = current.components.flatMap((component, componentIndex) => {
        if (componentIndex !== index) return [component]
        const nextComponent = updater(component)
        return nextComponent ? [nextComponent] : []
      })
      return {
        ...current,
        components: nextComponents,
      }
    })
  }, [])

  const handleAddFoodToReview = useCallback(() => {
    if (!selectedFoodToAdd) return
    const quantity = Number(foodQuantityInput)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError(t("nutrition.photo.log.error.invalidQuantity"))
      return
    }

    setReviewResult((current) => current ? {
      ...current,
      components: [
        ...current.components,
        {
          name_fr: selectedFoodToAdd.name_fr,
          category_hint: selectedFoodToAdd.category_l1,
          quantity_g: quantity,
          quantity_source: "manual",
          kcal_per_100g: Number(selectedFoodToAdd.kcal_per_100g ?? 0),
          protein_per_100g: Number(selectedFoodToAdd.protein_per_100g ?? 0),
          carbs_per_100g: Number(selectedFoodToAdd.carbs_per_100g ?? 0),
          fat_per_100g: Number(selectedFoodToAdd.fat_per_100g ?? 0),
          fiber_per_100g: Number(selectedFoodToAdd.fiber_per_100g ?? 0),
          source_note: "Ajout manuel",
        },
      ],
    } : current)
    setShowAddFood(false)
    setSelectedFoodToAdd(null)
    setFoodSearchQuery("")
    setFoodSearchResults([])
    setFoodQuantityInput("100")
  }, [foodQuantityInput, selectedFoodToAdd, t])

  // M2 : Relance l'analyse uniquement — conserve photos et session
  // À utiliser quand l'erreur vient de l'analyse (timeout, JSON tronqué) et non de l'upload ou de la session
  const handleRetryAnalysis = useCallback(() => {
    setBusyLabel(null)
    setError(null)
    setAnalysis(null)
    setResult(null)
    setReviewResult(null)
    setLastRefinementSummary(null)
    // Retourner en capture avec les photos existantes pour que l'utilisateur puisse relancer
    setStep("capture")
  }, [])

  // Repart complètement de zéro — utilisé pour les erreurs de session ou d'upload
  const handleRetryFromError = useCallback(() => {
    clearDraftSession()
    sessionCreationRef.current = null
    createdSessionIdRef.current = null
    setStep("capture")
    setSessionId(null)
    setPhotos([])
    setAnalysis(null)
    setResult(null)
    setReviewResult(null)
    setLastRefinementSummary(null)
    setBusyLabel(null)
    setError(null)
    setUploadingState(null)
    setDeletingPhoto(null)
    setSelectedPhotoId(null)
  }, [clearDraftSession])

  if (!open) return null

  const renderPageBody = () => {
    if (step === "capture") {
      return (
        <CameraStage
          videoRef={videoRef}
          cameraReady={cameraReady}
          cameraError={cameraError}
          photos={photos}
          mealType={mealType}
          manualDetailInput={manualDetailInput}
          setNoteOpen={setNoteOpen}
          showCameraHint={showCameraHint}
          onDismissCameraHint={handleDismissCameraHint}
          onClose={handleCloseScanner}
          onMealTypeChange={handleMealTypeChange}
          onGalleryClick={() => galleryInputRef.current?.click()}
          onFallbackCameraClick={() => fallbackCameraInputRef.current?.click()}
          onCapture={captureLivePhoto}
          onAnalyze={handleAnalyze}
          onDeletePhoto={handleDeletePhoto}
          busyLabel={busyLabel}
          canEditDetail={!busyLabel || !!uploadingState}
          hasPhotos={hasPhotos}
          hasTextInput={hasTextInput}
          canStartAnalysis={canStartAnalysis}
          selectedPhotoId={selectedPhotoId}
          deletingPhotoId={deletingPhoto?.id ?? null}
          onSelectPhoto={(photoId) => setSelectedPhotoId((current) => current === photoId ? null : photoId)}
        />
      )
    }

    return (
      <StandardShell
        title={t("nutrition.photo.log.scannerTitle")}
        subtitle={
          step === "precheck"
            ? t("nutrition.photo.log.stage.estimate")
            : step === "review" || step === "clarify"
                ? t("nutrition.photo.log.stage.validation")
                : step === "success"
                  ? t("nutrition.photo.log.stage.saved")
                  : step === "logging"
                    ? t("nutrition.photo.log.stage.saving")
                    : step === "error"
                      ? t("nutrition.photo.log.stage.retry")
                      : t("nutrition.photo.log.stage.analysis")
        }
        onBack={() => {
          if (step === "precheck" || step === "error") {
            setStep("capture")
            return
          }
          if (step === "clarify") {
            setStep("precheck")
            return
          }
          if (step === "review") {
            setStep("precheck")
            return
          }
          if (step === "success") {
            handleCloseScanner()
            return
          }
          handleCloseScanner()
        }}
      >
        {step === "analyzing" || step === "logging" ? (
          <BusyState
            title={step === "analyzing" ? t("nutrition.photo.log.busy.analyzingTitle") : t("nutrition.photo.log.stage.saving")}
            body={step === "analyzing" ? t("nutrition.photo.log.busy.analyzingBody") : t("nutrition.photo.log.busy.savingBody")}
          />
        ) : null}

        {step === "precheck" && analysis && reviewResult ? (
          <PrecheckStage
            analysis={analysis}
            reliability={reliability}
            heroPhotoUrl={heroPhotoUrl}
            reviewTotals={reviewTotals}
            mealTypeLabel={getMealTypeLabel(reviewResult.meal_type, t)}
            onImprove={() => setStep("clarify")}
            onContinue={() => setStep("review")}
            onAddMorePhotos={() => setStep("capture")}
            hasPendingQuestion={!!pendingQuestion}
            validationIssues={reviewValidation?.issues ?? []}
          />
        ) : null}

        {(step === "review" || step === "clarify") && reviewResult ? (
          <ReviewStage
            mealType={mealType}
            onMealTypeChange={handleMealTypeChange}
            heroPhotoUrl={heroPhotoUrl}
            reviewResult={reviewResult}
            reviewTotals={reviewTotals}
            mealFit={mealFit}
            validationIssues={reviewValidation?.issues ?? []}
            refinementSummary={lastRefinementSummary}
            mealNote={mealNote}
            setMealNote={setMealNote}
            pendingQuestion={pendingQuestion}
            showAddFood={showAddFood}
            setShowAddFood={setShowAddFood}
            foodSearchQuery={foodSearchQuery}
            setFoodSearchQuery={setFoodSearchQuery}
            foodSearchLoading={foodSearchLoading}
            foodSearchResults={foodSearchResults}
            selectedFoodToAdd={selectedFoodToAdd}
            setSelectedFoodToAdd={setSelectedFoodToAdd}
            foodQuantityInput={foodQuantityInput}
            setFoodQuantityInput={setFoodQuantityInput}
            onAddFood={handleAddFoodToReview}
            onUpdateComponent={(index, quantity) => {
              updateReviewComponent(index, (component) => ({
                ...component,
                quantity_g: Math.max(0, quantity),
              }))
            }}
            onApplyMealFitAction={(action) => {
              updateReviewComponent(action.componentIndex, (component) => ({
                ...component,
                quantity_g: Math.max(0, action.toG),
              }))
            }}
            onRemoveComponent={(index) => {
              updateReviewComponent(index, () => null)
            }}
            onValidate={handleValidateMeal}
            canValidate={canValidateReview}
          />
        ) : null}

        {step === "success" && reviewResult ? (
          <SuccessStage
            heroPhotoUrl={heroPhotoUrl}
            mealTypeLabel={getMealTypeLabel(reviewResult.meal_type, t)}
            successTotals={successTotals}
            components={reviewResult.components}
            result={reviewResult}
            canRefineWithLeftovers={canRefineWithLeftovers}
            baselineWeight={baselineWeight}
            leftoversInput={leftoversInput}
            setLeftoversInput={setLeftoversInput}
            handleLeftoversRefine={handleLeftoversRefine}
            refiningLeftovers={refiningLeftovers}
            leftoversApplied={leftoversApplied}
            error={error}
            onSuccess={onSuccess}
            onClose={handleCloseScanner}
          />
        ) : null}

        {step === "error" ? (
          <ErrorStage
            error={error}
            hasRecoverablePhotos={photos.length > 0 && !!sessionId}
            onRetryAnalysis={photos.length > 0 && !!sessionId ? handleRetryAnalysis : undefined}
            onRetry={handleRetryFromError}
            onClose={handleCloseScanner}
          />
        ) : null}
      </StandardShell>
    )
  }

  return (
    <AnimatePresence>
      <>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void handleGallerySelection(event.target.files)
            event.target.value = ""
          }}
        />
        <input
          ref={fallbackCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            void handleGallerySelection(event.target.files)
            event.target.value = ""
          }}
        />

        {isPagePresentation ? (
          <div className="h-dvh bg-[#0d0d0d]">
            {renderPageBody()}
          </div>
        ) : (
          <motion.div
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="client-native-bottom-sheet fixed inset-x-0 bottom-0 z-[121] flex max-h-[94dvh] flex-col overflow-hidden rounded-t-[20px] bg-[#080808]"
              style={{ paddingBottom: "var(--client-modal-bottom-padding)" }}
              initial={{ y: "100%" }}
              animate={{ y: 0, transition: { type: "spring", stiffness: 260, damping: 28 } }}
              exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
            >
              {renderPageBody()}
            </motion.div>
          </motion.div>
        )}

        <VoiceLogSheet
          open={noteOpen}
          purpose="note"
          initialInputMode="text"
          initialText={manualDetailInput}
          onClose={() => setNoteOpen(false)}
          onNoteDraftChange={setManualDetailInput}
          onNoteSubmit={(note) => {
            setManualDetailInput(note)
            setNoteOpen(false)
          }}
        />

        <ClarificationChatSheet
          open={showClarificationSheet}
          pendingQuestion={pendingQuestion}
          clarifySelection={clarifySelection}
          busy={isClarifyBusy}
          onAnswer={(value) => void handleClarification(value)}
          onSkip={handleSkipClarification}
        />
      </>
    </AnimatePresence>
  )
}

function ClarificationChatSheet({
  open,
  pendingQuestion,
  clarifySelection,
  busy,
  onAnswer,
  onSkip,
}: {
  open: boolean
  pendingQuestion: PhotoMealFinalResult["pending_question"] | null
  clarifySelection: ClarifySelectionState
  busy: boolean
  onAnswer: (value: string) => void
  onSkip: () => void
}) {
  const { t } = useClientT()

  return (
    <AnimatePresence>
      {open && pendingQuestion ? (
        <>
          <motion.div
            className="fixed inset-0 z-[140] bg-black/58 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={busy ? undefined : onSkip}
          />
          <motion.div
            className="client-native-bottom-sheet fixed inset-x-0 bottom-0 z-[141] flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl bg-[#0d0d0d] shadow-[0_-18px_60px_rgba(0,0,0,0.45)]"
              style={{ paddingBottom: "var(--client-modal-bottom-padding)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", stiffness: 280, damping: 30 } }}
            exit={{ y: "100%", transition: { duration: 0.22, ease: "easeIn" } }}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/[0.18]" />
            <div className="px-5 pb-5 pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-barlow-condensed text-[15px] font-bold uppercase tracking-[0.12em] text-white">
                  {t("nutrition.photo.log.clarify.kicker")}
                </p>
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={busy}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/50 transition active:scale-95 disabled:opacity-40"
                  aria-label={t("nutrition.photo.log.clarify.skip")}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[#19A974]">
                  <UtensilsCrossed size={18} />
                </div>
                <div className="min-h-12 flex-1 rounded-2xl rounded-tl-md bg-white/[0.04] px-4 py-3">
                  <p className="text-[16px] font-semibold leading-6 text-white">
                    {pendingQuestion.prompt}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-2.5">
                {pendingQuestion.options.map((option) => {
                  const selected =
                    clarifySelection?.key === pendingQuestion.key &&
                    clarifySelection.value === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onAnswer(option.value)}
                      disabled={busy}
                      className={`flex min-h-[56px] items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-60 ${
                        selected ? "bg-white text-[#050505]" : "bg-white/[0.035] text-white/86"
                      }`}
                    >
                      <span className="text-[14px] font-semibold leading-5">
                        {option.label}
                      </span>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        selected ? "bg-[#050505] text-white" : "bg-white/[0.04] text-white/36"
                      }`}>
                        {selected && busy ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : selected ? (
                          <Check size={15} />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={onSkip}
                disabled={busy}
                className="mt-3 h-11 w-full rounded-xl bg-white/[0.03] text-[11px] font-bold uppercase tracking-[0.16em] text-white/48 transition active:scale-[0.99] disabled:opacity-40"
              >
                {t("nutrition.photo.log.clarify.skip")}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function CameraStage({
  videoRef,
  cameraReady,
  cameraError,
  photos,
  mealType,
  manualDetailInput,
  setNoteOpen,
  showCameraHint,
  onDismissCameraHint,
  onClose,
  onMealTypeChange,
  onGalleryClick,
  onFallbackCameraClick,
  onCapture,
  onAnalyze,
  onDeletePhoto,
  busyLabel,
  canEditDetail,
  hasPhotos,
  hasTextInput,
  canStartAnalysis,
  selectedPhotoId,
  deletingPhotoId,
  onSelectPhoto,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  cameraReady: boolean
  cameraError: string | null
  photos: UploadedPhoto[]
  mealType: MealType
  manualDetailInput: string
  setNoteOpen: (value: boolean) => void
  showCameraHint: boolean
  onDismissCameraHint: () => void
  onClose: () => void
  onMealTypeChange: (value: MealType) => void | Promise<void>
  onGalleryClick: () => void
  onFallbackCameraClick: () => void
  onCapture: () => Promise<void>
  onAnalyze: () => Promise<void>
  onDeletePhoto: (photoId: string) => void
  busyLabel: string | null
  canEditDetail: boolean
  hasPhotos: boolean
  hasTextInput: boolean
  canStartAnalysis: boolean
  selectedPhotoId: string | null
  deletingPhotoId: string | null
  onSelectPhoto: (photoId: string) => void
}) {
  const { t } = useClientT()
  const captureSummary = busyLabel
    ? busyLabel
    : manualDetailInput.trim()
      ? t("nutrition.photo.log.capture.detailAdded")
      : photos.length > 1
        ? t("nutrition.photo.log.capture.viewsAdded", { n: photos.length })
        : photos.length === 1
          ? t("nutrition.photo.log.capture.oneViewAdded")
          : null

  return (
    <div className="relative h-full overflow-hidden bg-[#0d0d0d] text-white">
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover transition-opacity ${cameraReady ? "opacity-100" : "opacity-0"}`}
        />
        {!cameraReady ? (
          <div className="absolute inset-0 bg-[#111111]" />
        ) : null}
        <div className="absolute inset-0 bg-black/38" />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-10">
          <div className="relative aspect-square w-full max-w-[288px]">
            <div className="absolute inset-[21%] rounded-[24px] border border-white/14 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]" />
            <div className="absolute left-0 top-0 h-9 w-9 rounded-tl-[18px] border-l-4 border-t-4 border-white/82" />
            <div className="absolute right-0 top-0 h-9 w-9 rounded-tr-[18px] border-r-4 border-t-4 border-white/82" />
            <div className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-[18px] border-b-4 border-l-4 border-white/82" />
            <div className="absolute bottom-0 right-0 h-9 w-9 rounded-br-[18px] border-b-4 border-r-4 border-white/82" />
          </div>
        </div>
      </div>

      <div className="absolute left-0 right-0 top-0 z-20 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-black/76 text-white backdrop-blur-md"
          >
            <X size={18} />
          </button>

          <div className="flex min-h-[44px] flex-1 items-center justify-center gap-2">
            {photos.length > 0 ? (
              <>
                {photos.map((photo) => (
                  <div key={photo.id} className="relative h-11 w-11">
                    <button
                      onClick={() => onSelectPhoto(photo.id)}
                      className={`group relative h-11 w-11 overflow-hidden rounded-[14px] bg-[#1a1a1a]/90 ${
                        selectedPhotoId === photo.id ? "ring-2 ring-white/80" : ""
                      }`}
                      title={t("nutrition.photo.log.camera.selectPhoto")}
                    >
                      {photo.signed_url ? (
                        <Image
                          src={photo.signed_url}
                          alt={t("nutrition.photo.log.meal.generic")}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/26" />
                    </button>
                    {selectedPhotoId === photo.id ? (
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeletePhoto(photo.id)
                        }}
                        disabled={deletingPhotoId === photo.id}
                        className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#050505] shadow-[0_6px_18px_rgba(0,0,0,0.35)] disabled:opacity-60"
                        title={t("nutrition.photo.log.camera.deletePhoto")}
                      >
                        {deletingPhotoId === photo.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      </button>
                    ) : null}
                  </div>
                ))}
                {busyLabel ? (
                  <div className="relative h-11 w-11 overflow-hidden rounded-[14px] bg-[#1a1a1a]/95">
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 size={14} className="animate-spin text-white/82" />
                    </div>
                  </div>
                ) : null}
              </>
            ) : busyLabel ? (
              <div className="relative h-11 w-11 overflow-hidden rounded-[14px] bg-[#1a1a1a]/95">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={14} className="animate-spin text-white/82" />
                </div>
              </div>
            ) : (
              <div className="h-11 w-11 rounded-[14px] border border-dashed border-white/14 bg-[#1a1a1a]/68" />
            )}
          </div>

          <div className="w-11" />
        </div>

        {captureSummary ? (
          <div className="mt-3 flex justify-center">
            <div className="rounded-full bg-black/22 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/74 backdrop-blur-md">
              {captureSummary}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {MEAL_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onMealTypeChange(option.value)}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition ${
                mealType === option.value
                  ? "bg-white text-[#050505] shadow-[0_10px_24px_rgba(0,0,0,0.2)]"
                  : "bg-black/34 text-white/72 backdrop-blur-md"
              }`}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 px-4" style={{ paddingBottom: "22px" }}>
        {cameraError ? (
          <div className="mb-4 rounded-[24px] border border-[#ff7a59]/18 bg-[#2a1712]/82 p-4 text-[13px] leading-5 text-white/78 backdrop-blur-md">
            <p className="font-semibold text-[#ff9a79]">{t("nutrition.photo.log.camera.unavailable")}</p>
            <p className="mt-1">{cameraError}</p>
            <button
              onClick={onFallbackCameraClick}
              className="mt-3 rounded-full bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#050505]"
            >
              {t("nutrition.photo.log.camera.fallback")}
            </button>
          </div>
        ) : null}

        <div className="rounded-[28px] bg-black/42 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
          <div className="grid grid-cols-[108px_1fr_128px] items-center gap-3">
            <div className="flex items-center gap-2.5">
              <button
                onClick={onGalleryClick}
                disabled={!!busyLabel}
                className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-black/64 text-white/84"
                aria-label={t("nutrition.photo.log.camera.galleryAria")}
              >
                <Images size={20} />
              </button>

              <button
                onClick={() => setNoteOpen(true)}
                disabled={!canEditDetail}
                className={`flex h-12 w-12 items-center justify-center rounded-[16px] border ${
                  manualDetailInput.trim()
                    ? "border-white/0 bg-white text-[#050505]"
                    : "border-transparent bg-black/64 text-white/84"
                }`}
                aria-label={manualDetailInput.trim() ? t("nutrition.photo.log.camera.noteAria.edit") : t("nutrition.photo.log.camera.noteAria.add")}
              >
                <Mic size={20} />
              </button>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => void onCapture()}
                disabled={!!busyLabel}
                className="relative flex h-[78px] w-[78px] items-center justify-center rounded-full bg-white/12 shadow-[0_14px_36px_rgba(0,0,0,0.28)]"
                aria-label={t("nutrition.photo.log.camera.captureAria")}
              >
                <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white shadow-[0_10px_26px_rgba(0,0,0,0.22)]">
                  <span className="h-[42px] w-[42px] rounded-full bg-[#050505]" />
                </span>
              </button>
            </div>

            <button
              onClick={() => void onAnalyze()}
              disabled={!canStartAnalysis || !!busyLabel}
              className={`flex h-12 items-center justify-center gap-2 rounded-[18px] px-4 text-[11px] font-bold uppercase tracking-[0.16em] ${
                canStartAnalysis && !busyLabel
                  ? "bg-white text-[#050505] shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                  : "bg-black/38 text-white/28"
              }`}
            >
              <Check size={16} />
              {t("nutrition.photo.log.camera.analyze")}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCameraHint ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black/48 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="absolute left-4 right-4 top-1/2 z-40 -translate-y-1/2 rounded-[24px] bg-[#111111] p-6 text-white"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">{t("nutrition.photo.log.camera.hintKicker")}</p>
              <h2 className="mt-3 font-barlow-condensed text-[30px] font-bold uppercase leading-[0.9] text-white">
                {t("nutrition.photo.log.camera.hintTitle")}
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-white/72">
                {t("nutrition.photo.log.camera.hintBody")}
              </p>
              <button
                onClick={onDismissCameraHint}
                className="mt-6 h-12 w-full rounded-[20px] bg-white text-[12px] font-bold uppercase tracking-[0.16em] text-[#050505]"
              >
                {t("nutrition.photo.log.camera.hintCta")}
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function StandardShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string
  subtitle: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="flex h-full flex-col bg-[#080808] text-white">
      <div
        className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#0d0d0d] px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", paddingBottom: "12px" }}
      >
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#1a1a1a] text-white/76"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-barlow-condensed text-[16px] font-bold uppercase tracking-[0.14em] text-white">{title}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">{subtitle}</p>
        </div>
        <div className="w-10" />
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-3"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", paddingBottom: "24px" }}
      >
        {children}
      </div>
    </div>
  )
}

function BusyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[58dvh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="relative flex h-[88px] w-[88px] items-center justify-center">
        <motion.div
          className="relative h-[70px] w-[70px]"
          animate={{ rotate: [0, 12, 180, 348, 360], scale: [1, 1.04, 0.98, 1.03, 1] }}
          transition={{ duration: 1.85, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }}
        >
          <Image src="/logo/logo-stryvr-silver.png" alt="STRYVR" fill sizes="70px" className="object-contain opacity-90" />
        </motion.div>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">{title}</p>
        <h2 className="mt-3 font-barlow-condensed text-[28px] font-bold uppercase leading-none text-white">{body}</h2>
      </div>
    </div>
  )
}

function StageHeroCard({
  heroPhotoUrl,
  topSlot,
  eyebrow,
  title,
  body,
  totals,
  compact = false,
}: {
  heroPhotoUrl: string | null
  topSlot: ReactNode
  eyebrow?: string
  title?: string
  body?: string
  totals: ReturnType<typeof computeResultTotals>
  compact?: boolean
}) {
  const hasTextBlock = Boolean(eyebrow || title || body)
  return (
    <div className="overflow-hidden rounded-[20px] bg-[#111111]">
      <div className={`relative ${compact ? "min-h-[176px]" : "min-h-[218px]"} bg-[#161616]`}>
        {heroPhotoUrl ? (
          <>
            <Image src={heroPhotoUrl} alt="Meal photo" fill sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-black/42" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2f2f2f,transparent_52%),linear-gradient(180deg,#161616_0%,#080808_100%)]" />
        )}

        <div className={`relative flex ${compact ? "min-h-[176px] p-3" : "min-h-[218px] p-4"} flex-col justify-between`}>
          {topSlot}
          {hasTextBlock ? (
            <div className={`${compact ? "rounded-[16px] p-3" : "rounded-[16px] p-4"} bg-[#111111]/92`}>
              {eyebrow ? (
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/66">{eyebrow}</p>
              ) : null}
              {title ? (
                <h2 className={`${compact ? "mt-1.5 text-[27px]" : "mt-2 text-[30px]"} font-barlow-condensed font-bold uppercase leading-none text-white`}>
                  {title}
                </h2>
              ) : null}
              {body ? (
                <p className={`${compact ? "mt-1.5 text-[12px]" : "mt-2 text-[13px]"} max-w-[34ch] leading-5 text-white/82`}>
                  {body}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <MacroStrip totals={totals} compact={compact} />
    </div>
  )
}

function MacroStrip({
  totals,
  compact = false,
}: {
  totals: ReturnType<typeof computeResultTotals>
  compact?: boolean
}) {
  return (
    <div className={`grid grid-cols-4 gap-2 ${compact ? "p-3" : "p-4"}`}>
      <MacroTile label="Kcal" value={Math.round(totals.total_calories)} accent="#78a7ff" compact={compact} />
      <MacroTile label="P" value={formatMacroValue(totals.total_protein_g)} accent="#65d39a" compact={compact} />
      <MacroTile label="G" value={formatMacroValue(totals.total_carbs_g)} accent="#ffd35a" compact={compact} />
      <MacroTile label="L" value={formatMacroValue(totals.total_fat_g)} accent="#ff8e6a" compact={compact} />
    </div>
  )
}

function PrecheckStage({
  analysis,
  reliability,
  heroPhotoUrl,
  reviewTotals,
  mealTypeLabel,
  onImprove,
  onContinue,
  onAddMorePhotos,
  hasPendingQuestion,
  validationIssues,
}: {
  analysis: PhotoMealAnalysisSummary
  reliability: { score: number; strengths: string[]; uncertainties: string[] }
  heroPhotoUrl: string | null
  reviewTotals: ReturnType<typeof computeResultTotals>
  mealTypeLabel: string
  onImprove: () => void
  onContinue: () => void
  onAddMorePhotos: () => void
  hasPendingQuestion: boolean
  validationIssues: string[]
}) {
  const { t } = useClientT()
  const isProductFlow = isProductLedMode(analysis.analysis_mode)
  const hasBlockingIssue = validationIssues.length > 0
  const title = hasBlockingIssue ? t("nutrition.photo.log.precheck.retryTitle") : t("nutrition.photo.log.precheck.readyTitle")
  const body = hasBlockingIssue
    ? validationIssues[0]
    : hasPendingQuestion
      ? t("nutrition.photo.log.precheck.pendingBody")
      : null

  return (
    <div className="space-y-3">
      <StageHeroCard
        heroPhotoUrl={heroPhotoUrl}
        totals={reviewTotals}
        topSlot={
          <div className="flex items-start justify-between gap-3">
            <div className="rounded-full bg-[#1a1a1a]/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
              {mealTypeLabel}
            </div>
          </div>
        }
        eyebrow={title}
        title={undefined}
        body={body ?? undefined}
      />

      <div className="grid gap-2">
        {hasPendingQuestion && !hasBlockingIssue ? (
          <button
            onClick={onImprove}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-white text-[12px] font-bold uppercase tracking-[0.16em] text-[#050505]"
          >
            <Pencil size={16} />
            {t("nutrition.photo.log.precheck.improve")}
          </button>
        ) : null}
        {!hasBlockingIssue ? (
          <button
            onClick={onContinue}
            className={`h-12 w-full rounded-[14px] text-[12px] font-bold uppercase tracking-[0.16em] ${
              hasPendingQuestion ? "bg-[#111111] text-white/82" : "bg-white text-[#050505]"
            }`}
          >
            {t("nutrition.photo.log.precheck.continue")}
          </button>
        ) : null}
        <button
          onClick={onAddMorePhotos}
          className={`h-11 w-full rounded-[14px] text-[11px] font-semibold uppercase tracking-[0.14em] ${
            hasBlockingIssue ? "bg-white text-[#050505]" : "bg-[#111111] text-white/55"
          }`}
        >
          {hasBlockingIssue ? t("nutrition.photo.log.precheck.retry") : t("nutrition.photo.log.precheck.addPhotos")}
        </button>
      </div>
    </div>
  )
}

function ReviewStage({
  mealType,
  onMealTypeChange,
  heroPhotoUrl,
  reviewResult,
  reviewTotals,
  mealFit,
  validationIssues,
  refinementSummary,
  mealNote,
  setMealNote,
  pendingQuestion,
  showAddFood,
  setShowAddFood,
  foodSearchQuery,
  setFoodSearchQuery,
  foodSearchLoading,
  foodSearchResults,
  selectedFoodToAdd,
  setSelectedFoodToAdd,
  foodQuantityInput,
  setFoodQuantityInput,
  onAddFood,
  onUpdateComponent,
  onApplyMealFitAction,
  onRemoveComponent,
  onValidate,
  canValidate,
}: {
  mealType: MealType
  onMealTypeChange: (value: MealType) => void
  heroPhotoUrl: string | null
  reviewResult: PhotoMealFinalResult
  reviewTotals: ReturnType<typeof computeResultTotals>
  mealFit: MealFitAdvisorResult | null
  validationIssues: string[]
  refinementSummary: RefinementDeltaSummary
  mealNote: string
  setMealNote: (value: string) => void
  pendingQuestion: PhotoMealFinalResult["pending_question"] | null
  showAddFood: boolean
  setShowAddFood: (value: boolean) => void
  foodSearchQuery: string
  setFoodSearchQuery: (value: string) => void
  foodSearchLoading: boolean
  foodSearchResults: FoodItem[]
  selectedFoodToAdd: FoodItem | null
  setSelectedFoodToAdd: (value: FoodItem | null) => void
  foodQuantityInput: string
  setFoodQuantityInput: (value: string) => void
  onAddFood: () => void
  onUpdateComponent: (index: number, quantity: number) => void
  onApplyMealFitAction: (action: NonNullable<MealFitAdvisorResult["primaryAction"]>) => void
  onRemoveComponent: (index: number) => void
  onValidate: () => Promise<void>
  canValidate: boolean
}) {
  const { t } = useClientT()
  const isProductFlow = isProductLedMode(reviewResult.analysis_mode)
  const suggestedProductDraft = useMemo(() => buildProductLibraryDraft(reviewResult), [reviewResult])
  const [productSaveOpen, setProductSaveOpen] = useState(false)
  const [productDraft, setProductDraft] = useState<ProductLibraryDraft | null>(suggestedProductDraft)
  const [productSaveStatus, setProductSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [productSaveMessage, setProductSaveMessage] = useState<string | null>(null)
  const visibleMealFit = mealFit && (mealFit.primaryAction || mealFit.secondarySuggestion) ? mealFit : null

  useEffect(() => {
    setProductDraft(suggestedProductDraft)
    setProductSaveOpen(false)
    setProductSaveStatus("idle")
    setProductSaveMessage(null)
  }, [suggestedProductDraft])

  const handleSaveProductToLibrary = useCallback(async () => {
    if (!productDraft || productSaveStatus === "saving") return

    setProductSaveStatus("saving")
    setProductSaveMessage(null)

    try {
      const response = await fetch("/api/client/food-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_fr: productDraft.name_fr.trim(),
          category_l1: productDraft.category_l1,
          category_l2: productDraft.category_l2,
          kcal_per_100g: productDraft.kcal_per_100g,
          protein_per_100g: productDraft.protein_per_100g,
          carbs_per_100g: productDraft.carbs_per_100g,
          fat_per_100g: productDraft.fat_per_100g,
          fiber_per_100g: productDraft.fiber_per_100g,
        }),
      })

      if (!response.ok && response.status !== 409) {
        throw new Error("save_failed")
      }

      setProductSaveStatus("saved")
      setProductSaveMessage(
        response.status === 409
          ? t("nutrition.photo.log.library.alreadyExists")
          : t("nutrition.photo.log.success.productSaved"),
      )
      setProductSaveOpen(false)
    } catch {
      setProductSaveStatus("error")
      setProductSaveMessage(t("nutrition.photo.log.library.saveFailed"))
    }
  }, [productDraft, productSaveStatus])

  return (
    <div className="space-y-3 pb-28">
      <StageHeroCard
        heroPhotoUrl={heroPhotoUrl}
        totals={reviewTotals}
        compact
        topSlot={
          <div className="flex flex-wrap gap-2">
              {MEAL_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onMealTypeChange(option.value)}
	                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
	                    mealType === option.value
	                      ? "bg-white text-[#050505]"
	                      : "bg-[#1a1a1a]/90 text-white/72"
	                  }`}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
        }
      />

      {isProductFlow && productDraft ? (
        <ProductLibraryAccordion
          draft={productDraft}
          open={productSaveOpen}
          status={productSaveStatus}
          message={productSaveMessage}
          onToggle={() => setProductSaveOpen((value) => !value)}
          onDraftChange={(value) => setProductDraft(value)}
          onSave={handleSaveProductToLibrary}
        />
      ) : null}

      {validationIssues.length > 0 ? (
        <div className="rounded-[20px] bg-[#111111] p-4 text-[13px] leading-6 text-white/76">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">{t("nutrition.photo.log.review.fix")}</p>
          <p className="mt-1">{validationIssues[0]}</p>
        </div>
      ) : null}

      {visibleMealFit ? (
        <MealFitPanel mealFit={visibleMealFit} onApplyAction={onApplyMealFitAction} />
      ) : null}

      <div className="rounded-[20px] bg-[#111111] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/62">{t("nutrition.photo.log.review.selectedComposition")}</p>
          <button
            onClick={() => setShowAddFood(!showAddFood)}
            className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full bg-[#1a1a1a] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.10em] text-white/82"
          >
            <Plus size={14} />
            {t("common.add")}
          </button>
        </div>

        <div className="space-y-2">
          {reviewResult.components.map((component, index) => (
            <ReviewComponentRow
              key={`${component.name_fr}-${index}`}
              component={component}
              onRemove={() => onRemoveComponent(index)}
              onUpdate={(quantity) => onUpdateComponent(index, quantity)}
            />
          ))}
        </div>
      </div>

      {showAddFood ? (
        <div className="rounded-[20px] bg-[#111111] p-4">
          <div className="mb-3 flex items-center gap-2 text-white/78">
            <Search size={15} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{t("nutrition.photo.log.review.addFood")}</p>
          </div>
          <input
            value={foodSearchQuery}
            onChange={(event) => setFoodSearchQuery(event.target.value)}
            placeholder={t("nutrition.photo.log.review.searchFood")}
            className="h-12 w-full rounded-[14px] bg-[#0a0a0a] px-4 text-[14px] text-white outline-none placeholder:text-white/28"
          />
          <div className="mt-3 space-y-2">
            {foodSearchLoading ? (
              <div className="flex items-center gap-2 rounded-[14px] bg-[#0a0a0a] px-4 py-3 text-[13px] text-white/58">
                <Loader2 size={14} className="animate-spin" />
                {t("nutrition.photo.log.review.searching")}
              </div>
            ) : foodSearchResults.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedFoodToAdd(item)}
                className={`flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left ${
                  selectedFoodToAdd?.id === item.id ? "bg-[#222222]" : "bg-[#0a0a0a]"
                }`}
              >
                <FoodIcon food={item} size={42} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-white">{item.name_fr}</p>
                  <p className="mt-1 text-[12px] text-white/42">{Math.round(item.kcal_per_100g ?? 0)} kcal / 100g</p>
                </div>
              </button>
            ))}
          </div>
          {selectedFoodToAdd ? (
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
              <input
                inputMode="decimal"
                value={foodQuantityInput}
                onChange={(event) => setFoodQuantityInput(event.target.value.replace(",", "."))}
                placeholder="100"
                className="h-11 rounded-[14px] bg-[#0a0a0a] px-4 text-[14px] text-white outline-none"
              />
              <button
                onClick={onAddFood}
                className="h-11 rounded-[16px] bg-white px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#050505]"
              >
                {t("common.add")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-[20px] bg-[#111111] p-4">
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
          {t("nutrition.photo.log.review.finalDetail")}
        </label>
        <textarea
          value={mealNote}
          onChange={(event) => setMealNote(event.target.value)}
          placeholder={t("nutrition.photo.log.review.finalDetailPlaceholder")}
          rows={4}
          className="w-full rounded-[14px] bg-[#0a0a0a] px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/28"
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] bg-[#080808] px-4 pb-2.5 pt-3">
        <button
          onClick={() => void onValidate()}
          disabled={!canValidate}
          className={`h-[54px] w-full rounded-[24px] text-[12px] font-bold uppercase tracking-[0.16em] shadow-[0_18px_44px_rgba(0,0,0,0.5)] ${
            canValidate ? "bg-white text-[#050505]" : "bg-white/[0.06] text-white/36"
          }`}
        >
          {isPackagingMode(reviewResult.analysis_mode) ? t("nutrition.photo.log.review.saveProduct") : t("nutrition.photo.log.review.saveMeal")}
        </button>
      </div>
    </div>
  )
}

function ReviewComponentRow({
  component,
  onRemove,
  onUpdate,
}: {
  component: PhotoMealFinalComponent
  onRemove: () => void
  onUpdate: (quantity: number) => void
}) {
  const { t } = useClientT()
  const isServing = component.quantity_unit === "serving"
  const quantityStep = isServing ? 100 : 10
  const displayQuantity = isServing
    ? Math.round((component.quantity_g / 100) * 10) / 10
    : Math.round(component.quantity_g)
  const displayUnit = isServing
    ? displayQuantity === 1
      ? t("nutrition.photo.log.quantity.serving")
      : t("nutrition.photo.log.quantity.servingsShort")
    : component.quantity_unit === "ml"
      ? "ml"
      : "g"

  return (
    <div className="rounded-[16px] bg-[#0a0a0a] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-white">{component.name_fr}</p>
          <p className="mt-0.5 text-[12px] leading-5 text-white/58">{formatSourceNote(component.source_note, t)}</p>
        </div>
        <button
          onClick={onRemove}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#1a1a1a] text-white/66"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[44px_1fr_44px] items-center gap-2">
        <button
          onClick={() => onUpdate(Math.max(0, component.quantity_g - quantityStep))}
          className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#1a1a1a] text-white/82"
        >
          -
        </button>
        <div className="relative">
          <input
            inputMode="decimal"
            value={String(displayQuantity)}
            onChange={(event) => {
              const next = Number(event.target.value.replace(",", "."))
              if (!Number.isFinite(next)) return
              onUpdate(isServing ? next * 100 : next)
            }}
            className="h-11 w-full rounded-[12px] bg-[#1a1a1a] px-3 pr-16 text-center text-[15px] font-semibold text-white outline-none"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-white/42">
            {displayUnit}
          </span>
        </div>
        <button
          onClick={() => onUpdate(component.quantity_g + quantityStep)}
          className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#1a1a1a] text-white/82"
        >
          +
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2 text-[12px] text-white/68">
        <span>{displayQuantity} {displayUnit}</span>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right">
          <span>{Math.round((component.kcal_per_100g * component.quantity_g) / 100)} kcal</span>
          <span>P {formatMacroValue((component.protein_per_100g * component.quantity_g) / 100)}</span>
          <span>G {formatMacroValue((component.carbs_per_100g * component.quantity_g) / 100)}</span>
          <span>L {formatMacroValue((component.fat_per_100g * component.quantity_g) / 100)}</span>
        </div>
      </div>
    </div>
  )
}

function ProductLibraryAccordion({
  draft,
  open,
  status,
  message,
  onToggle,
  onDraftChange,
  onSave,
}: {
  draft: ProductLibraryDraft
  open: boolean
  status: "idle" | "saving" | "saved" | "error"
  message: string | null
  onToggle: () => void
  onDraftChange: (value: ProductLibraryDraft) => void
  onSave: () => void
}) {
  const { t } = useClientT()
  const subcategories = FOOD_SUBCATEGORY_OPTIONS[draft.category_l1]
  const categoryLabels = buildFoodCategoryLabels(t)
  const subcategoryLabels = buildFoodSubcategoryLabels(t)
  const canSave = draft.name_fr.trim().length > 0 && draft.category_l2.trim().length > 0 && status !== "saving"

  const updateNumericField = (field: keyof Pick<ProductLibraryDraft, "kcal_per_100g" | "protein_per_100g" | "carbs_per_100g" | "fat_per_100g" | "fiber_per_100g">, value: string) => {
    const parsed = Number(value.replace(",", "."))
    onDraftChange({
      ...draft,
      [field]: sanitizeProductNumber(Number.isFinite(parsed) ? parsed : 0, field === "kcal_per_100g" ? 900 : 100),
    })
  }

  return (
    <div className="rounded-[20px] bg-[#111111] p-3">
      <button
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[16px] bg-[#0a0f0d] px-4 py-3 text-left"
      >
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#39c98a]">
            {status === "saved" ? t("nutrition.photo.log.library.personalFood") : t("nutrition.photo.log.library.personalLibrary")}
          </span>
          <span className="mt-1 block text-[14px] font-semibold text-white">
            {status === "saved" ? t("nutrition.photo.log.success.productSaved") : t("nutrition.photo.log.library.saveProduct")}
          </span>
        </span>
        <span className={`h-2.5 w-2.5 rounded-full ${status === "error" ? "bg-[#ff8e6a]" : "bg-[#39c98a]"}`} />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <div className="grid gap-2">
                <label className="grid gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">{t("nutrition.photo.log.library.name")}</span>
                  <input
                    value={draft.name_fr}
                    onChange={(event) => onDraftChange({ ...draft, name_fr: event.target.value })}
                    className="h-11 rounded-[14px] bg-[#0a0a0a] px-3 text-[14px] font-semibold text-white outline-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">{t("log.custom.category")}</span>
                    <select
                      value={draft.category_l1}
                      onChange={(event) => {
                        const nextCategory = event.target.value as CategoryL1
                        onDraftChange({
                          ...draft,
                          category_l1: nextCategory,
                          category_l2: FOOD_SUBCATEGORY_OPTIONS[nextCategory][0] ?? "",
                        })
                      }}
                      className="h-11 rounded-[14px] bg-[#0a0a0a] px-3 text-[13px] font-semibold text-white outline-none"
                    >
                      {FOOD_CATEGORY_OPTIONS.map((category) => (
                        <option key={category} value={category}>
                          {categoryLabels[category]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">{t("log.custom.subcategory")}</span>
                    <select
                      value={draft.category_l2}
                      onChange={(event) => onDraftChange({ ...draft, category_l2: event.target.value })}
                      className="h-11 rounded-[14px] bg-[#0a0a0a] px-3 text-[13px] font-semibold text-white outline-none"
                    >
                      {subcategories.map((subcategory) => (
                        <option key={subcategory} value={subcategory}>
                          {subcategoryLabels[subcategory] ?? subcategory}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {([
                    ["kcal_per_100g", "Kcal"],
                    ["protein_per_100g", "P"],
                    ["carbs_per_100g", "G"],
                    ["fat_per_100g", "L"],
                    ["fiber_per_100g", "Fib."],
                  ] as const).map(([field, label]) => (
                    <label key={field} className="grid gap-1.5">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/34">{label}</span>
                      <input
                        inputMode="decimal"
                        value={String(draft[field])}
                        onChange={(event) => updateNumericField(field, event.target.value)}
                        className="h-10 rounded-[12px] bg-[#0a0a0a] px-2 text-center text-[13px] font-semibold text-white outline-none"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {message ? (
                <p className={`mt-3 text-[12px] ${status === "error" ? "text-[#ff9a79]" : "text-[#39c98a]"}`}>
                  {message}
                </p>
              ) : null}

              <button
                onClick={onSave}
                disabled={!canSave}
                className={`mt-3 flex h-11 w-full items-center justify-center rounded-[16px] text-[11px] font-bold uppercase tracking-[0.14em] ${
                  canSave ? "bg-white text-[#050505]" : "bg-white/[0.06] text-white/32"
                }`}
              >
                {status === "saving" ? "Enregistrement..." : "Confirmer l’enregistrement"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function MealFitPanel({
  mealFit,
  onApplyAction,
}: {
  mealFit: MealFitAdvisorResult
  onApplyAction: (action: NonNullable<MealFitAdvisorResult["primaryAction"]>) => void
}) {
  const { t } = useClientT()
  const titleTone =
    mealFit.severity === "critical"
      ? "text-[#ff9a79]"
      : mealFit.severity === "warning"
        ? "text-[#ffcd8d]"
        : "text-white"

  return (
    <div className="rounded-[20px] bg-[#111111] p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
          {t("nutrition.photo.log.review.usefulAction")}
        </p>
        <h3 className={`mt-2 text-[19px] font-bold leading-snug ${titleTone}`}>{mealFit.title}</h3>
      </div>

      <p className="mt-3 text-[14px] leading-6 text-white/78">{mealFit.message}</p>

      {mealFit.primaryAction ? (
        <button
          onClick={() => onApplyAction(mealFit.primaryAction!)}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-[14px] bg-white text-[11px] font-bold uppercase tracking-[0.12em] text-[#080808]"
        >
          {t("nutrition.photo.log.review.applyAction", {
            name: mealFit.primaryAction.componentName,
            grams: mealFit.primaryAction.toG,
          })}
        </button>
      ) : null}

      {mealFit.secondarySuggestion ? (
        <div className="mt-3 rounded-[14px] bg-[#0a0a0a] px-3 py-3 text-[13px] leading-5 text-white/70">
          <span className="font-semibold text-white/82">{t("nutrition.photo.log.review.usefulOption")} </span>
          {mealFit.secondarySuggestion.label}
        </div>
      ) : null}
    </div>
  )
}

function ProjectedMiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[12px] bg-black/20 px-2 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/36">{label}</p>
      <p className="mt-1 text-[13px] font-bold text-white">{value}</p>
    </div>
  )
}

function SuccessStage({
  heroPhotoUrl,
  mealTypeLabel,
  successTotals,
  components,
  result,
  canRefineWithLeftovers,
  baselineWeight,
  leftoversInput,
  setLeftoversInput,
  handleLeftoversRefine,
  refiningLeftovers,
  leftoversApplied,
  error,
  onSuccess,
  onClose,
}: {
  heroPhotoUrl: string | null
  mealTypeLabel: string
  successTotals: {
    total_calories: number
    total_protein_g: number
    total_carbs_g: number
    total_fat_g: number
    total_fiber_g: number
  }
  components: PhotoMealFinalComponent[]
  result: PhotoMealFinalResult
  canRefineWithLeftovers: boolean
  baselineWeight: number | null
  leftoversInput: string
  setLeftoversInput: (value: string) => void
  handleLeftoversRefine: () => Promise<void>
  refiningLeftovers: boolean
  leftoversApplied: {
    leftovers_weight_g: number
    baseline_weight_g: number
    consumed_factor: number
    meal_totals: {
      total_calories: number
      total_protein_g: number
      total_carbs_g: number
      total_fat_g: number
      total_fiber_g: number
    }
  } | null
  error: string | null
  onSuccess?: () => void
  onClose: () => void
}) {
  const { t } = useClientT()
  const isProductFlow = isPackagingMode(result.analysis_mode)
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[20px] bg-[#111111]">
        <div className="relative min-h-[208px] bg-[#161616]">
          {heroPhotoUrl ? (
            <>
              <Image src={heroPhotoUrl} alt="Logged meal" fill sizes="100vw" className="object-cover" />
              <div className="absolute inset-0 bg-black/42" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[#161616]" />
          )}
          <div className="relative flex min-h-[208px] flex-col justify-between p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#1a1a1a]/90 text-white">
                <UtensilsCrossed size={22} />
              </div>
              <div className="rounded-full bg-[#1a1a1a]/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/86">
                {mealTypeLabel}
              </div>
            </div>
            <div className="rounded-[16px] bg-[#111111]/92 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                {isProductFlow ? t("nutrition.photo.log.success.productSaved") : t("nutrition.photo.log.success.mealSaved")}
              </p>
              <h2 className="mt-2 font-barlow-condensed text-[30px] font-bold uppercase leading-none text-white">
                {t("nutrition.photo.log.success.savedTitle")}
              </h2>
              <p className="mt-2 max-w-[34ch] text-[13px] leading-5 text-white/78">{result.status_copy}</p>
            </div>
          </div>
        </div>

        <MacroStrip totals={successTotals} />
      </div>

      <div className="rounded-[20px] bg-[#111111] p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{t("nutrition.photo.log.review.selectedComposition")}</p>
        <div className="space-y-2">
          {components.map((component, index) => (
            <div key={`${component.name_fr}-${index}`} className="flex items-center justify-between gap-4 rounded-[14px] bg-[#0a0a0a] px-3 py-3">
              <div>
                <p className="text-[14px] font-semibold text-white">{component.name_fr}</p>
                <p className="text-[12px] text-white/42">{formatComponentQuantityLabel(component, t)}</p>
              </div>
              <p className="text-[16px] font-bold text-white">
                {Math.round((component.kcal_per_100g * component.quantity_g) / 100)} kcal
              </p>
            </div>
          ))}
        </div>
      </div>

      {canRefineWithLeftovers ? (
        <div className="rounded-[20px] bg-[#111111] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{t("nutrition.photo.log.success.leftoversTitle")}</p>
          <p className="mt-2 text-[14px] leading-6 text-white/68">
            {t("nutrition.photo.log.success.leftoversBody", { n: Math.round(baselineWeight ?? 0) })}
          </p>
          <input
            inputMode="decimal"
            placeholder={t("nutrition.photo.log.success.leftoversPlaceholder")}
            value={leftoversInput}
            onChange={(event) => setLeftoversInput(event.target.value.replace(",", "."))}
            className="mt-3 h-12 w-full rounded-[14px] bg-[#0a0a0a] px-4 text-[16px] text-white outline-none placeholder:text-white/28"
          />
          <button
            onClick={() => void handleLeftoversRefine()}
            disabled={refiningLeftovers}
            className="mt-3 h-11 w-full rounded-[14px] bg-[#1a1a1a] text-[11px] font-bold uppercase tracking-[0.14em] text-white/78 disabled:opacity-50"
          >
            {refiningLeftovers ? t("nutrition.photo.log.success.updating") : t("nutrition.photo.log.success.apply")}
          </button>
          {leftoversApplied ? (
            <div className="mt-3 rounded-[14px] bg-[#0a0a0a] p-3 text-[13px] leading-6 text-white/74">
              {t("nutrition.photo.log.success.leftoversApplied", {
                grams: Math.round(leftoversApplied.leftovers_weight_g),
                kcal: Math.round(leftoversApplied.meal_totals.total_calories),
                protein: Math.round(leftoversApplied.meal_totals.total_protein_g),
                carbs: Math.round(leftoversApplied.meal_totals.total_carbs_g),
                fat: Math.round(leftoversApplied.meal_totals.total_fat_g),
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[20px] bg-[#1a1110] p-3 text-[13px] leading-6 text-white/76">{error}</div>
      ) : null}

      <button
        onClick={onSuccess ?? onClose}
        className="h-12 w-full rounded-[14px] bg-white text-[12px] font-bold uppercase tracking-[0.16em] text-[#050505]"
      >
        {onSuccess ? t("nutrition.photo.log.success.viewJournal") : t("nutrition.photo.log.success.finish")}
      </button>
    </div>
  )
}

function ErrorStage({
  error,
  hasRecoverablePhotos,
  onRetryAnalysis,
  onRetry,
  onClose,
}: {
  error: string | null
  hasRecoverablePhotos?: boolean
  onRetryAnalysis?: () => void
  onRetry: () => void
  onClose: () => void
}) {
  const { t } = useClientT()
  const isSessionError = error === t("nutrition.photo.log.error.session")
  return (
    <div className="space-y-4">
      <div className={`rounded-[24px] p-5 ${isSessionError ? "bg-[#111111]" : "bg-[#1a1110]"}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isSessionError ? "text-white/38" : "text-[#ff9a79]"}`}>
          {isSessionError ? t("nutrition.photo.log.error.sessionKicker") : t("nutrition.photo.log.errorFlow.kicker")}
        </p>
        <h2 className="mt-3 font-barlow-condensed text-[30px] font-bold uppercase leading-[0.92] text-white">
          {isSessionError ? t("nutrition.photo.log.error.sessionTitle") : t("nutrition.photo.log.errorFlow.title")}
        </h2>
        <p className="mt-3 text-[14px] leading-6 text-white/72">{error ?? t("nutrition.photo.log.errorFlow.body")}</p>
      </div>
      
      {hasRecoverablePhotos && onRetryAnalysis ? (
        <>
          <button
            onClick={onRetryAnalysis}
            className="h-12 w-full rounded-[22px] bg-white text-[12px] font-bold uppercase tracking-[0.16em] text-[#050505]"
          >
            {t("nutrition.photo.log.errorFlow.retryAnalysis") || "Relancer l'analyse"}
          </button>
          <button
            onClick={onRetry}
            className="h-12 w-full rounded-[22px] bg-white/[0.08] text-[12px] font-bold uppercase tracking-[0.16em] text-white"
          >
            {isSessionError ? t("nutrition.photo.log.error.sessionRetry") : t("nutrition.photo.log.error.restartFromScratch")}
          </button>
        </>
      ) : (
        <button
          onClick={onRetry}
          className="h-12 w-full rounded-[22px] bg-white text-[12px] font-bold uppercase tracking-[0.16em] text-[#050505]"
        >
          {isSessionError ? t("nutrition.photo.log.error.sessionRetry") : t("nutrition.photo.log.errorFlow.retry")}
        </button>
      )}

      <button
        onClick={onClose}
        className="h-12 w-full rounded-[22px] bg-transparent text-[11px] font-semibold uppercase tracking-[0.14em] text-white/68"
      >
        {t("ui.close")}
      </button>
    </div>
  )
}

function InfoBlock({
  title,
  items,
  tone = "neutral",
}: {
  title: string
  items: string[]
  tone?: "neutral" | "warning"
}) {
  return (
    <div className="rounded-[20px] bg-[#111111] p-4">
      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${tone === "warning" ? "text-[#ffcd8d]" : "text-white/35"}`}>
        {title}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-full px-3 py-2 text-[12px] font-medium ${
              tone === "warning"
                ? "bg-[#1a1a1a] text-white/84"
                : "bg-[#0a0a0a] text-white/74"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function MacroTile({
  label,
  value,
  accent,
  compact = false,
}: {
  label: string
  value: string | number
  accent: string
  compact?: boolean
}) {
  return (
    <div className={`${compact ? "rounded-[14px] px-2.5 py-2.5" : "rounded-[16px] px-3 py-3"} bg-[#0a0a0a]`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: accent }}>
        {label}
      </p>
      <p className={`${compact ? "mt-1.5 text-[18px]" : "mt-2 text-[20px]"} font-black leading-none tracking-[-0.03em] text-white`}>
        {value}
      </p>
    </div>
  )
}
