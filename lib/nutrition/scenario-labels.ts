import { ct, type ClientLang } from "@/lib/i18n/clientTranslations"

export function localizeNutritionScenarioLabel(
  lang: ClientLang,
  label?: string | null,
): string {
  const trimmed = label?.trim()
  if (!trimmed) return ct(lang, "nutrition.scenario.main")
  if (trimmed === "Scénario principal") return ct(lang, "nutrition.scenario.main")
  if (trimmed === "Planning") return ct(lang, "nutrition.planning.base")
  if (trimmed === "Planning ajusté") return ct(lang, "nutrition.planning.adjusted")

  const numberedScenario = /^Scénario\s+(\d+)$/i.exec(trimmed)
  if (numberedScenario) {
    return ct(lang, "nutrition.scenario.named", { n: numberedScenario[1] })
  }

  return trimmed
}
