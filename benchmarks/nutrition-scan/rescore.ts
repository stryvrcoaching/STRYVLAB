import { existsSync } from "node:fs"
import { mkdir, readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { buildPhotoMealFinalResult } from "@/lib/nutrition/photo-log-finalize"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"
import { benchmarkCaseSchema, type BenchmarkCase } from "./schema"
import { scoreBenchmarkCase } from "./scoring"
import { writeBenchmarkReports, type BenchmarkRunResult } from "./report"

function readOption(args: string[], name: string) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

async function findCaseFiles(directory: string): Promise<string[]> {
  if (!existsSync(directory)) return []
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return findCaseFiles(entryPath)
    return entry.isFile() && entry.name === "case.json" ? [entryPath] : []
  }))
  return nested.flat().sort()
}

async function main() {
  const args = process.argv.slice(2)
  const reportDirectory = path.resolve(readOption(args, "--report") ?? "")
  if (!reportDirectory || !existsSync(reportDirectory)) {
    throw new Error("--report doit pointer vers un dossier de rapport existant")
  }

  const resultsPath = path.join(reportDirectory, "results.json")
  if (!existsSync(resultsPath)) throw new Error(`results_missing:${resultsPath}`)

  const casesDirectory = path.resolve(readOption(args, "--cases") ?? "benchmarks/nutrition-scan/cases")
  const outputDirectory = path.resolve(readOption(args, "--output") ?? path.join(reportDirectory, "rescored"))
  const refinalize = args.includes("--refinalize")
  const cases = new Map<string, BenchmarkCase>()
  for (const casePath of await findCaseFiles(casesDirectory)) {
    const benchmarkCase = benchmarkCaseSchema.parse(JSON.parse(await readFile(casePath, "utf8")))
    if (cases.has(benchmarkCase.id)) throw new Error(`duplicate_case_id:${benchmarkCase.id}`)
    cases.set(benchmarkCase.id, benchmarkCase)
  }

  const storedResults = JSON.parse(await readFile(resultsPath, "utf8")) as BenchmarkRunResult[]
  const rescoredResults = storedResults.map<BenchmarkRunResult>((result) => {
    const benchmarkCase = cases.get(result.case_id)
    if (!benchmarkCase?.truth) {
      return { ...result, metrics: null, error: result.error ?? `truth_missing:${result.case_id}` }
    }
    const finalResult = refinalize && result.analysis
      ? buildPhotoMealFinalResult({
          analysis: result.analysis as PhotoMealAnalysisSummary,
          answers: benchmarkCase.input.clarification_answers,
          lang: "fr",
        })
      : result.final_result
    if (!finalResult) return { ...result, metrics: null }

    return {
      ...result,
      title: benchmarkCase.title,
      scenario: benchmarkCase.scenario,
      split: benchmarkCase.split,
      truth_tier: benchmarkCase.truth.tier,
      final_result: finalResult,
      metrics: scoreBenchmarkCase(
        benchmarkCase,
        finalResult as Parameters<typeof scoreBenchmarkCase>[1],
      ),
    }
  })

  await mkdir(outputDirectory, { recursive: true })
  const summary = await writeBenchmarkReports(outputDirectory, rescoredResults)
  console.log(`${refinalize ? "Refinalisation et rescoring" : "Rescoring"} terminé: ${summary.average_score}/100 sur ${summary.total_runs} exécutions.`)
  console.log(`Rapport: ${path.join(outputDirectory, "report.html")}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
