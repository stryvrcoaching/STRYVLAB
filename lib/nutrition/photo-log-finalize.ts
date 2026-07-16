import { getPhotoLogStatusCopy } from "@/lib/nutrition/photo-log-copy"
import { getNextPhotoMealClarification } from "@/lib/nutrition/photo-log-clarifications"
import { applyScaleReadingEvidence } from "@/lib/nutrition/photo-log-evidence"
import type {
  PhotoMealAnalysisSummary,
  PhotoMealFinalResult,
} from "@/lib/nutrition/photo-log-types"
import { interpretPhotoMealWeight } from "@/lib/nutrition/photo-log-weight"
import { hasHardMacroFailureIssue, validatePhotoMealAnalysisEvidence, validatePhotoMealResult } from "@/lib/nutrition/photo-log-validation"
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations"

export function resolvePhotoMealSessionStatus(result: PhotoMealFinalResult) {
  if (result.ready_to_log) return "ready_to_log" as const
  if (hasHardMacroFailureIssue(result.validation_issues ?? [])) return "failed" as const
  return "clarifying" as const
}

export function buildPhotoMealFinalResult({
  analysis,
  answers,
  lang = "fr",
}: {
  analysis: PhotoMealAnalysisSummary
  answers: Record<string, string>
  lang?: ClientLang
}): PhotoMealFinalResult {
  const consolidatedAnalysis = applyScaleReadingEvidence(analysis)
  const pendingQuestion = getNextPhotoMealClarification(consolidatedAnalysis, answers, lang)
  const interpreted = interpretPhotoMealWeight({
    analysis: consolidatedAnalysis,
    clarificationAnswers: answers,
  })
  const validation = validatePhotoMealResult({
    analysis_mode: consolidatedAnalysis.analysis_mode ?? null,
    components: interpreted.components,
  }, lang)
  const validationIssues = Array.from(new Set([
    ...validation.issues,
    ...validatePhotoMealAnalysisEvidence(consolidatedAnalysis, lang),
  ]))
  const readyToLog = interpreted.components.length > 0 && validationIssues.length === 0 && !pendingQuestion

  return {
    meal_type: consolidatedAnalysis.meal_type,
    analysis_mode: consolidatedAnalysis.analysis_mode ?? null,
    source_context: consolidatedAnalysis.source_context ?? null,
    status_copy: pendingQuestion
      ? ct(lang, "nutrition.photo.status.improveHint")
      : getPhotoLogStatusCopy({
          hasMeasuredWeight: interpreted.hasMeasuredWeight,
          hasClarifications: Object.keys(answers).length > 0,
          leftoversRecommended: consolidatedAnalysis.leftovers_recommended,
          analysisMode: consolidatedAnalysis.analysis_mode ?? null,
          validationIssues,
          lang,
        }),
    ready_to_log: readyToLog,
    leftovers_recommended: consolidatedAnalysis.leftovers_recommended,
    validation_issues: validationIssues,
    confidence_breakdown: consolidatedAnalysis.confidence_breakdown ?? null,
    product_reference: consolidatedAnalysis.product_reference ?? null,
    components: interpreted.components,
    pending_question: pendingQuestion,
  }
}
