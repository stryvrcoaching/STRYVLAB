import { writeFile } from "node:fs/promises"
import path from "node:path"
import type { BenchmarkScenario } from "./schema"
import type { BenchmarkCaseMetrics } from "./scoring"

export interface BenchmarkRunResult {
  case_id: string
  title: string
  scenario: BenchmarkScenario
  split: "development" | "holdout"
  truth_tier: "A" | "B" | "C"
  run: number
  latency_ms: number
  metrics: BenchmarkCaseMetrics | null
  error: string | null
  analysis: unknown
  final_result: unknown
}

interface ResultGroup {
  label: string
  cases: number
  success_rate: number
  average_score: number
  average_latency_ms: number
}

export interface BenchmarkSummary {
  generated_at: string
  total_runs: number
  successful_runs: number
  technical_success_rate: number
  ready_to_log_rate: number
  average_score: number
  median_score: number
  p95_latency_ms: number
  average_run_score_stddev: number | null
  unstable_cases: string[]
  by_scenario: ResultGroup[]
  by_truth_tier: ResultGroup[]
  by_split: ResultGroup[]
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil(percentileValue * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

function groupResults(results: BenchmarkRunResult[], key: (result: BenchmarkRunResult) => string): ResultGroup[] {
  const groups = new Map<string, BenchmarkRunResult[]>()
  results.forEach((result) => groups.set(key(result), [...(groups.get(key(result)) ?? []), result]))

  return [...groups.entries()].map(([label, entries]) => {
    const successful = entries.filter((entry) => entry.metrics)
    return {
      label,
      cases: entries.length,
      success_rate: round(successful.length / entries.length, 3),
      average_score: successful.length
        ? round(successful.reduce((sum, entry) => sum + Number(entry.metrics?.score), 0) / successful.length)
        : 0,
      average_latency_ms: round(entries.reduce((sum, entry) => sum + entry.latency_ms, 0) / entries.length),
    }
  }).sort((left, right) => left.label.localeCompare(right.label))
}

export function buildBenchmarkSummary(results: BenchmarkRunResult[]): BenchmarkSummary {
  const successful = results.filter((result) => result.metrics)
  const scores = successful.map((result) => Number(result.metrics?.score))
  const scoresByCase = new Map<string, number[]>()
  successful.forEach((result) => scoresByCase.set(result.case_id, [
    ...(scoresByCase.get(result.case_id) ?? []),
    Number(result.metrics?.score),
  ]))
  const deviations = [...scoresByCase.entries()]
    .map(([caseId, caseScores]) => ({ caseId, deviation: standardDeviation(caseScores) }))
    .filter((entry): entry is { caseId: string; deviation: number } => entry.deviation !== null)
  return {
    generated_at: new Date().toISOString(),
    total_runs: results.length,
    successful_runs: successful.length,
    technical_success_rate: results.length ? round(successful.length / results.length, 3) : 0,
    ready_to_log_rate: successful.length
      ? round(successful.filter((result) => result.metrics?.ready_to_log).length / successful.length, 3)
      : 0,
    average_score: scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    median_score: round(percentile(scores, 0.5)),
    p95_latency_ms: round(percentile(results.map((result) => result.latency_ms), 0.95)),
    average_run_score_stddev: deviations.length
      ? round(deviations.reduce((sum, entry) => sum + entry.deviation, 0) / deviations.length, 2)
      : null,
    unstable_cases: deviations.filter((entry) => entry.deviation >= 5).map((entry) => entry.caseId),
    by_scenario: groupResults(results, (result) => result.scenario),
    by_truth_tier: groupResults(results, (result) => result.truth_tier),
    by_split: groupResults(results, (result) => result.split),
  }
}

function csvCell(value: unknown) {
  const stringValue = value === null || value === undefined ? "" : String(value)
  return `"${stringValue.replaceAll('"', '""')}"`
}

function resultsCsv(results: BenchmarkRunResult[]) {
  const headers = [
    "case_id", "scenario", "split", "truth_tier", "run", "latency_ms", "score", "ready_to_log",
    "mode_match", "item_precision", "item_recall", "item_f1", "quantity_accuracy", "kcal_accuracy",
    "protein_accuracy", "carbs_accuracy", "fat_accuracy", "duplicate_count", "error",
  ]
  const rows = results.map((result) => [
    result.case_id,
    result.scenario,
    result.split,
    result.truth_tier,
    result.run,
    result.latency_ms,
    result.metrics?.score,
    result.metrics?.ready_to_log,
    result.metrics?.mode_match,
    result.metrics?.item_precision,
    result.metrics?.item_recall,
    result.metrics?.item_f1,
    result.metrics?.quantity_accuracy,
    result.metrics?.kcal_accuracy,
    result.metrics?.protein_accuracy,
    result.metrics?.carbs_accuracy,
    result.metrics?.fat_accuracy,
    result.metrics?.duplicate_count,
    result.error,
  ])
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function percentage(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Math.round(value * 100)} %`
}

function htmlReport(summary: BenchmarkSummary, results: BenchmarkRunResult[]) {
  const groupRows = (groups: ResultGroup[]) => groups.map((group) => `
    <tr><td>${escapeHtml(group.label)}</td><td>${group.cases}</td><td>${percentage(group.success_rate)}</td><td>${group.average_score}</td><td>${group.average_latency_ms} ms</td></tr>
  `).join("")
  const resultRows = results
    .sort((left, right) => Number(left.metrics?.score ?? -1) - Number(right.metrics?.score ?? -1))
    .map((result) => `
      <tr>
        <td>${escapeHtml(result.case_id)}</td><td>${escapeHtml(result.scenario)}</td><td>${escapeHtml(result.truth_tier)}</td>
        <td>${result.metrics?.score ?? "—"}</td><td>${percentage(result.metrics?.item_f1)}</td>
        <td>${percentage(result.metrics?.quantity_accuracy)}</td><td>${percentage(result.metrics?.kcal_accuracy)}</td>
        <td>${result.latency_ms} ms</td><td class="error">${escapeHtml(result.error)}</td>
      </tr>
    `).join("")

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Benchmark scan nutritionnel</title><style>
body{font-family:Inter,system-ui,sans-serif;background:#0d0d0d;color:#f5f5f5;margin:0;padding:32px}main{max-width:1280px;margin:auto}
h1,h2{margin:0 0 16px}.meta{color:#aaa}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:24px 0}
.card{background:#171717;border:1px solid #333;border-radius:12px;padding:18px}.value{font-size:28px;font-weight:700;color:#c6b48b}.label{font-size:13px;color:#aaa;margin-top:6px}
section{margin-top:36px;overflow:auto}table{border-collapse:collapse;width:100%;background:#141414}th,td{padding:10px 12px;border-bottom:1px solid #2b2b2b;text-align:left;white-space:nowrap}th{color:#c6b48b}.error{color:#ff9d9d;white-space:normal}
</style></head><body><main><h1>Benchmark scan nutritionnel</h1><p class="meta">Généré le ${escapeHtml(summary.generated_at)}. Le score est un indicateur interne de régression, pas une validation clinique.</p>
<div class="cards"><div class="card"><div class="value">${summary.average_score}</div><div class="label">Score moyen / 100</div></div><div class="card"><div class="value">${percentage(summary.technical_success_rate)}</div><div class="label">Succès technique</div></div><div class="card"><div class="value">${percentage(summary.ready_to_log_rate)}</div><div class="label">Résultats prêts à logger</div></div><div class="card"><div class="value">${summary.average_run_score_stddev ?? "—"}</div><div class="label">Variabilité moyenne</div></div><div class="card"><div class="value">${summary.p95_latency_ms} ms</div><div class="label">Latence p95</div></div></div>
<section><h2>Par scénario</h2><table><thead><tr><th>Scénario</th><th>Exécutions</th><th>Succès</th><th>Score moyen</th><th>Latence moyenne</th></tr></thead><tbody>${groupRows(summary.by_scenario)}</tbody></table></section>
<section><h2>Détail des cas</h2><table><thead><tr><th>Cas</th><th>Scénario</th><th>Vérité</th><th>Score</th><th>Aliments</th><th>Quantités</th><th>Calories</th><th>Latence</th><th>Erreur</th></tr></thead><tbody>${resultRows}</tbody></table></section>
</main></body></html>`
}

export async function writeBenchmarkReports(outputDirectory: string, results: BenchmarkRunResult[]) {
  const summary = buildBenchmarkSummary(results)
  await Promise.all([
    writeFile(path.join(outputDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`),
    writeFile(path.join(outputDirectory, "results.json"), `${JSON.stringify(results, null, 2)}\n`),
    writeFile(path.join(outputDirectory, "results.csv"), `${resultsCsv(results)}\n`),
    writeFile(path.join(outputDirectory, "report.html"), htmlReport(summary, results)),
  ])
  return summary
}
