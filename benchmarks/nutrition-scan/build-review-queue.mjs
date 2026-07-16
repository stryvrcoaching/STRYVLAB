import { existsSync } from "node:fs"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"

function readOption(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

async function findCaseFiles(directory) {
  if (!existsSync(directory)) return []
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return findCaseFiles(entryPath)
    return entry.isFile() && entry.name === "case.json" ? [entryPath] : []
  }))
  return nested.flat().sort()
}

function expectedModes(scenario) {
  if (scenario === "packaging") return new Set(["packaging", "barcode", "hybrid"])
  if (scenario === "receipt") return new Set(["receipt", "hybrid"])
  if (scenario === "hybrid") return new Set(["hybrid"])
  return new Set(["plate", "hybrid"])
}

function priorityFor({ issues, scenario, tier, knownQuantities }) {
  if (issues.some((issue) => issue.severity === "critical")) return "critical"
  if (issues.some((issue) => issue.severity === "high")) return "high"
  if (["receipt", "packaging", "hybrid"].includes(scenario)) return "high"
  if (["A", "B"].includes(tier) || knownQuantities > 0) return "medium"
  return "low"
}

function recommendedAction(row) {
  if (row.scenario === "receipt") return "Confirmer les articles consommés puis joindre les valeurs officielles de l’enseigne."
  if (row.scenario === "packaging") return "Vérifier la transcription du tableau nutritionnel et la portion réellement consommée."
  if (row.scenario === "hybrid") return "Vérifier le lien entre chaque photo, la quantité consommée et la source nutritionnelle."
  if (row.tier === "A") return "Vérifier les lectures directes puis promouvoir le cas en vérité A."
  if (row.tier === "B") return "Confirmer les poids et compléter les nutriments depuis une source documentée."
  return "Confirmer les aliments et quantités réellement consommés; conserver C si aucune mesure n’existe."
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function markdownReport(summary, rows) {
  const sections = ["critical", "high", "medium", "low", "verified"].map((priority) => {
    const selected = rows.filter((row) => row.priority === priority)
    if (!selected.length) return ""
    const lines = selected.map((row) => {
      const issues = row.issues.map((issue) => issue.code).join(", ") || "aucune"
      return `- [ ] **${row.case_id} — ${row.title}** · ${row.tier} · ${row.analysis_mode} · problèmes: ${issues}\n  - ${row.recommended_action}`
    })
    return `## ${priority.toUpperCase()} (${selected.length})\n\n${lines.join("\n")}`
  }).filter(Boolean)

  return `# File de revue — pré-annotations nutritionnelles

Générée le ${summary.generated_at}.

- Cas: ${summary.total_cases}
- Brouillons présents: ${summary.annotated_cases}
- Vérités vérifiées: ${summary.verified_cases}
- Tier A: ${summary.by_tier.A ?? 0}
- Tier B: ${summary.by_tier.B ?? 0}
- Tier C: ${summary.by_tier.C ?? 0}
- Questions humaines: ${summary.total_human_questions}

${sections.join("\n\n")}
`
}

async function main() {
  const args = process.argv.slice(2)
  const casesDirectory = path.resolve(readOption(args, "--cases") ?? "benchmarks/nutrition-scan/cases/private")
  const outputDirectory = path.resolve(readOption(args, "--output") ?? "benchmarks/nutrition-scan/reports/preannotation-review")
  const rows = []

  for (const casePath of await findCaseFiles(casesDirectory)) {
    const benchmarkCase = JSON.parse(await readFile(casePath, "utf8"))
    const preannotationPath = path.join(path.dirname(casePath), "preannotation.json")
    if (!existsSync(preannotationPath)) {
      rows.push({
        case_id: benchmarkCase.id,
        title: benchmarkCase.title,
        scenario: benchmarkCase.scenario,
        split: benchmarkCase.split,
        tier: null,
        analysis_mode: null,
        photo_count: benchmarkCase.input.photos.length,
        component_names: [],
        known_quantities: 0,
        known_nutrient_profiles: 0,
        human_questions: [],
        quality_flags: [],
        issues: [{ severity: "critical", code: "missing_preannotation" }],
      })
      continue
    }

    const preannotation = JSON.parse(await readFile(preannotationPath, "utf8"))
    const draft = preannotation.draft
    const issues = []
    if (draft.photo_observations.length !== benchmarkCase.input.photos.length) {
      issues.push({ severity: "high", code: "photo_observation_count_mismatch" })
    }
    if (!draft.components.length && !draft.receipt_lines?.length) {
      issues.push({ severity: "critical", code: "no_components_or_receipt_lines" })
    }
    if (!expectedModes(benchmarkCase.scenario).has(draft.analysis_mode)) {
      issues.push({ severity: "high", code: "scenario_mode_mismatch" })
    }
    if (draft.suggested_truth_tier === "C" && !draft.human_questions_fr.length) {
      issues.push({ severity: "high", code: "tier_c_without_question" })
    }
    if (!draft.requires_human_review && draft.suggested_truth_tier !== "A") {
      issues.push({ severity: "high", code: "review_disabled_before_tier_a" })
    }
    const knownQuantities = draft.components.filter((component) => component.quantity_g !== null).length
    const knownNutrientProfiles = draft.components.filter((component) =>
      Object.values(component.nutrients_per_100g ?? {}).some((value) => value !== null),
    ).length
    const row = {
      case_id: benchmarkCase.id,
      title: benchmarkCase.title,
      scenario: benchmarkCase.scenario,
      split: benchmarkCase.split,
      tier: draft.suggested_truth_tier,
      analysis_mode: draft.analysis_mode,
      photo_count: benchmarkCase.input.photos.length,
      component_names: draft.components.map((component) => component.name_fr),
      known_quantities: knownQuantities,
      known_nutrient_profiles: knownNutrientProfiles,
      human_questions: draft.human_questions_fr,
      quality_flags: draft.quality_flags ?? [],
      issues,
    }
    if (benchmarkCase.status === "ready" && benchmarkCase.truth) {
      row.tier = benchmarkCase.truth.tier
      row.analysis_mode = benchmarkCase.truth.analysis_mode
      row.component_names = benchmarkCase.truth.components.map((component) => component.name_fr)
      row.known_quantities = benchmarkCase.truth.components.filter((component) => component.quantity_g !== null).length
      row.known_nutrient_profiles = benchmarkCase.truth.components.filter((component) =>
        Object.values(component.nutrients).some((value) => value !== null),
      ).length
      row.human_questions = []
      row.priority = "verified"
      row.recommended_action = "Vérité terrain vérifiée; cas prêt pour le benchmark."
    } else {
      row.priority = priorityFor({ issues, scenario: row.scenario, tier: row.tier, knownQuantities })
      row.recommended_action = recommendedAction(row)
    }
    rows.push(row)
  }

  rows.forEach((row) => {
    if (!row.priority) row.priority = priorityFor({ issues: row.issues, scenario: row.scenario, tier: row.tier, knownQuantities: 0 })
    if (!row.recommended_action) row.recommended_action = recommendedAction(row)
  })
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, verified: 4 }
  rows.sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority] || left.case_id.localeCompare(right.case_id))
  const countBy = (values) => values.reduce((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {})
  const summary = {
    generated_at: new Date().toISOString(),
    total_cases: rows.length,
    annotated_cases: rows.filter((row) => row.tier).length,
    verified_cases: rows.filter((row) => row.priority === "verified").length,
    by_tier: countBy(rows.map((row) => row.tier).filter(Boolean)),
    by_priority: countBy(rows.map((row) => row.priority)),
    total_human_questions: rows.reduce((sum, row) => sum + row.human_questions.length, 0),
    cases_with_issues: rows.filter((row) => row.issues.length).length,
  }

  await mkdir(outputDirectory, { recursive: true })
  const csvHeaders = [
    "case_id", "title", "priority", "scenario", "split", "tier", "analysis_mode", "photo_count",
    "known_quantities", "known_nutrient_profiles", "component_names", "human_questions", "issues", "recommended_action",
  ]
  const csvRows = rows.map((row) => [
    row.case_id, row.title, row.priority, row.scenario, row.split, row.tier, row.analysis_mode, row.photo_count,
    row.known_quantities, row.known_nutrient_profiles, row.component_names.join(" | "), row.human_questions.join(" | "),
    row.issues.map((issue) => issue.code).join(" | "), row.recommended_action,
  ])
  await Promise.all([
    writeFile(path.join(outputDirectory, "review.json"), `${JSON.stringify({ summary, rows }, null, 2)}\n`),
    writeFile(path.join(outputDirectory, "review.csv"), `${[csvHeaders, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`),
    writeFile(path.join(outputDirectory, "review.md"), markdownReport(summary, rows)),
  ])

  console.log(`File de revue créée: ${rows.length} cas, ${summary.cases_with_issues} avec anomalie structurelle.`)
  console.log(`Rapport: ${path.join(outputDirectory, "review.md")}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
