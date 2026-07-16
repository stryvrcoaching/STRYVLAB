import { ct, type ClientLang } from "@/lib/i18n/clientTranslations"

export function getPhotoLogStatusCopy({
  hasMeasuredWeight,
  hasClarifications,
  leftoversRecommended,
  analysisMode,
  validationIssues = [],
  lang = "fr",
}: {
  hasMeasuredWeight: boolean
  hasClarifications: boolean
  leftoversRecommended: boolean
  analysisMode?: "plate" | "packaging" | "barcode" | "receipt" | "hybrid" | null
  validationIssues?: string[]
  lang?: ClientLang
}) {
  if (validationIssues.length > 0) {
    return validationIssues[0] ?? ct(lang, "nutrition.photo.status.incomplete")
  }
  if (analysisMode === "packaging" || analysisMode === "barcode") {
    return ct(lang, "nutrition.photo.status.packagingReady")
  }
  if (analysisMode === "receipt" || analysisMode === "hybrid") {
    return ct(lang, "nutrition.photo.status.hybridReady")
  }
  if (leftoversRecommended) {
    return ct(lang, "nutrition.photo.status.leftoversRecommended")
  }
  if (hasMeasuredWeight && hasClarifications) {
    return ct(lang, "nutrition.photo.status.weightAndAnswers")
  }
  if (hasMeasuredWeight) {
    return ct(lang, "nutrition.photo.status.weightOnly")
  }
  return ct(lang, "nutrition.photo.status.ready")
}
