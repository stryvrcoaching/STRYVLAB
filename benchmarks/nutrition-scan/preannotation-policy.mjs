function hasCoreNutrition(component) {
  const nutrients = component.nutrients_per_100g ?? {}
  return [nutrients.kcal, nutrients.protein_g, nutrients.carbs_g, nutrients.fat_g]
    .every((value) => typeof value === "number" && Number.isFinite(value))
}

function addQuestion(draft, question) {
  draft.human_questions_fr = Array.from(new Set([...(draft.human_questions_fr ?? []), question]))
}

function addFlag(draft, flag) {
  draft.quality_flags = Array.from(new Set([...(draft.quality_flags ?? []), flag]))
}

export function normalizeAnnotationDraft(draft, benchmarkCase) {
  if (["separate_weighing", "weighing", "scale_workflow"].includes(draft?.analysis_mode)) {
    draft.capture_workflow = "separate_weighing"
    draft.analysis_mode = "plate"
    addFlag(draft, "analysis_mode_normalized_from_weighing")
  }

  const isPackagingMode = ["packaging", "barcode"].includes(draft.analysis_mode)
  const hasExplicitConsumption = Boolean(
    benchmarkCase.input?.manual_weight_g || String(benchmarkCase.input?.text ?? "").trim(),
  )
  if (isPackagingMode && !hasExplicitConsumption) {
    for (const component of draft.components ?? []) {
      if (component.quantity_source !== "label" || component.quantity_g == null) continue
      component.package_net_weight_g = component.quantity_g
      component.quantity_g = null
      component.quantity_source = "unknown"
      component.quantity_evidence_fr = "Le poids du paquet ne prouve pas la quantité réellement consommée."
      addFlag(draft, "packaging_net_weight_not_consumed_quantity")
    }
    addQuestion(draft, "Quelle quantité du produit a réellement été consommée ?")
  }

  const components = draft.components ?? []
  const hasComponents = components.length > 0
  const allQuantitiesDirect = hasComponents && components.every((component) =>
    typeof component.quantity_g === "number" && component.quantity_g > 0 && component.quantity_source !== "visual_unknown",
  )
  const allNutritionDirect = hasComponents && components.every(hasCoreNutrition)
  draft.suggested_truth_tier = allQuantitiesDirect && allNutritionDirect
    ? "A"
    : allQuantitiesDirect
      ? "B"
      : "C"

  const hasMissingEvidence = !allQuantitiesDirect || !allNutritionDirect
  draft.requires_human_review = hasMissingEvidence || (draft.human_questions_fr ?? []).length > 0
  if (draft.suggested_truth_tier === "C" && !(draft.human_questions_fr ?? []).length) {
    addQuestion(draft, "Confirmez les aliments et les quantités réellement consommées.")
    draft.requires_human_review = true
  }
  return draft
}
