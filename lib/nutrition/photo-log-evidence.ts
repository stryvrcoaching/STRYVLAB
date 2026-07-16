import type {
  PhotoMealAnalysisSummary,
  PhotoMealComponentCandidate,
  PhotoMealScaleReading,
} from "@/lib/nutrition/photo-log-types"

const MATCH_STOPWORDS = new Set([
  "aliment",
  "assiette",
  "cuit",
  "cuite",
  "cuits",
  "cuites",
  "portion",
  "produit",
])

function tokens(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !MATCH_STOPWORDS.has(token))
}

function matchScore(foodName: string, component: PhotoMealComponentCandidate) {
  const wanted = new Set(tokens(foodName))
  const candidate = tokens(`${component.name_fr} ${component.rationale ?? ""}`)
  if (wanted.size === 0 || candidate.length === 0) return 0

  const overlap = candidate.filter((token) => wanted.has(token)).length
  return overlap / Math.max(wanted.size, 1)
}

function appendScaleRationale(component: PhotoMealComponentCandidate, reading: PhotoMealScaleReading) {
  const scaleNote = `Poids lu sur la photo ${reading.photo_index}: ${Math.round(reading.grams)} g.`
  if (!component.rationale) return scaleNote
  if (component.rationale.includes(scaleNote)) return component.rationale
  return `${component.rationale} ${scaleNote}`
}

function rationaleGramValues(component: PhotoMealComponentCandidate) {
  return [...String(component.rationale ?? "").matchAll(/(\d+(?:[.,]\d+)?)\s*g\b/gi)]
    .map((match) => Number(String(match[1]).replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0)
}

export function applyScaleReadingEvidence(analysis: PhotoMealAnalysisSummary): PhotoMealAnalysisSummary {
  const readings = (analysis.scale_readings ?? [])
    .filter((reading) => Number(reading.grams) > 0 && Number(reading.confidence) >= 0.55)

  if (readings.length === 0) return analysis

  const mealTotal = readings
    .filter((reading) => reading.scope === "meal_total")
    .sort((left, right) => right.confidence - left.confidence)[0]
  const componentReadings = readings.filter(
    (reading) => reading.scope === "component" && String(reading.food_name ?? "").trim().length > 0,
  )

  const usedReadingIndexes = new Set<number>()
  const components = analysis.components.map((component) => {
    let bestIndex = -1
    let bestScore = 0

    componentReadings.forEach((reading, readingIndex) => {
      if (usedReadingIndexes.has(readingIndex)) return
      const score = matchScore(String(reading.food_name), component)
      if (score > bestScore) {
        bestIndex = readingIndex
        bestScore = score
      }
    })

    if (bestIndex < 0 || bestScore < 0.5) return component

    usedReadingIndexes.add(bestIndex)
    const reading = componentReadings[bestIndex]
    const explicitEstimate = Number(component.grams_estimate)
    const rationaleSupportsEstimate = rationaleGramValues(component).some(
      (value) => Math.abs(value - explicitEstimate) <= 2,
    )
    const readingConflictsWithEstimate =
      explicitEstimate > 0 &&
      Math.abs(reading.grams - explicitEstimate) > Math.max(5, explicitEstimate * 0.2)
    if (rationaleSupportsEstimate && readingConflictsWithEstimate) {
      return component
    }

    return {
      ...component,
      grams_estimate: Math.round(reading.grams),
      ambiguity_tags: Array.from(new Set([...component.ambiguity_tags, "partial_weight" as const])),
      rationale: appendScaleRationale(component, reading),
      component_confidence: Math.max(Number(component.component_confidence ?? 0), reading.confidence),
    }
  })

  let adjustedComponents = components
  const leftovers = analysis.leftovers_estimate
  if (
    leftovers?.detected &&
    Number(leftovers.grams_estimate) > 0 &&
    Number(leftovers.confidence) >= 0.75 &&
    leftovers.rationale
  ) {
    const leftoversWeight = Math.round(Number(leftovers.grams_estimate))
    const candidates = components.map((component, componentIndex) => {
      const matchingReading = componentReadings.find(
        (reading) => matchScore(String(reading.food_name), component) >= 0.5,
      )
      const leftoversMatch = matchScore(leftovers.rationale ?? "", component)
      const stillUsesInitialWeight = matchingReading
        ? Math.abs(Number(component.grams_estimate) - Number(matchingReading.grams)) <= 2
        : false
      return { componentIndex, leftoversMatch, stillUsesInitialWeight }
    }).filter((candidate) => candidate.leftoversMatch >= 0.5 && candidate.stillUsesInitialWeight)

    if (candidates.length === 1) {
      const [{ componentIndex }] = candidates
      adjustedComponents = components.map((component, index) => {
        if (index !== componentIndex || Number(component.grams_estimate) <= leftoversWeight) return component
        return {
          ...component,
          grams_estimate: Math.round(Number(component.grams_estimate) - leftoversWeight),
          ambiguity_tags: component.ambiguity_tags.filter((tag) => tag !== "non_edible_parts"),
          rationale: `${component.rationale ?? "Poids initial lu sur la balance."} Restes mesurés soustraits: ${leftoversWeight} g.`,
        }
      })
    }
  }

  const hasComponentReadings = componentReadings.length > 0
  const confidenceBreakdown = analysis.confidence_breakdown
    ? {
        ...analysis.confidence_breakdown,
        quantity: Math.max(
          analysis.confidence_breakdown.quantity,
          mealTotal?.confidence ?? (hasComponentReadings ? 0.88 : 0),
        ),
      }
    : analysis.confidence_breakdown

  return {
    ...analysis,
    scale_weight_g: mealTotal
      ? Math.round(mealTotal.grams)
      : hasComponentReadings
        ? null
        : analysis.scale_weight_g,
    scale_weight_confidence: mealTotal
      ? mealTotal.confidence
      : hasComponentReadings
        ? null
        : analysis.scale_weight_confidence,
    confidence_breakdown: confidenceBreakdown,
    components: adjustedComponents,
  }
}
