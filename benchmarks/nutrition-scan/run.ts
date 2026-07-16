import { existsSync } from "node:fs"
import { mkdir, readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { loadEnvConfig } from "@next/env"
import { benchmarkCaseSchema, type BenchmarkCase } from "./schema"
import { scoreBenchmarkCase } from "./scoring"
import { writeBenchmarkReports, type BenchmarkRunResult } from "./report"

interface RunnerOptions {
  casesDirectory: string
  outputDirectory: string
  validateOnly: boolean
  runs: number
  split: "development" | "holdout" | null
  caseIds: Set<string>
}

const supportedMimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

const scenarioTargets = {
  simple_plate: 16,
  complex_plate: 20,
  separate_weighing: 15,
  packaging: 15,
  receipt: 10,
  hybrid: 15,
  leftovers: 9,
} as const

function readOption(args: string[], name: string) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function parseOptions(): RunnerOptions {
  const args = process.argv.slice(2)
  const root = process.cwd()
  const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")
  const splitValue = readOption(args, "--split")
  if (splitValue && splitValue !== "development" && splitValue !== "holdout") {
    throw new Error("--split doit valoir development ou holdout")
  }
  const runs = Math.max(1, Number(readOption(args, "--runs") ?? 1) || 1)

  return {
    casesDirectory: path.resolve(root, readOption(args, "--cases") ?? "benchmarks/nutrition-scan/cases"),
    outputDirectory: path.resolve(root, readOption(args, "--output") ?? `benchmarks/nutrition-scan/reports/${timestamp}`),
    validateOnly: args.includes("--validate-only"),
    runs,
    split: splitValue ?? null,
    caseIds: new Set((readOption(args, "--ids") ?? "").split(",").map((value) => value.trim()).filter(Boolean)),
  }
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

async function loadCase(casePath: string) {
  const raw = JSON.parse(await readFile(casePath, "utf8")) as unknown
  const benchmarkCase = benchmarkCaseSchema.parse(raw)
  const photos = benchmarkCase.input.photos.map((photo) => ({
    ...photo,
    absolutePath: path.resolve(path.dirname(casePath), photo.path),
  }))
  photos.forEach((photo) => {
    if (!existsSync(photo.absolutePath)) throw new Error(`photo_missing:${photo.absolutePath}`)
    if (!supportedMimeTypes[path.extname(photo.absolutePath).toLowerCase()]) {
      throw new Error(`unsupported_image_format:${photo.absolutePath}`)
    }
  })
  return { benchmarkCase, photos }
}

async function imageToDataUrl(imagePath: string) {
  const extension = path.extname(imagePath).toLowerCase()
  const mimeType = supportedMimeTypes[extension]
  if (!mimeType) throw new Error(`unsupported_image_format:${extension}`)
  const bytes = await readFile(imagePath)
  return `data:${mimeType};base64,${bytes.toString("base64")}`
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Partial<Record<T, number>>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

function printCorpusCoverage(cases: BenchmarkCase[]) {
  const statuses = countBy(cases.map((benchmarkCase) => benchmarkCase.status))
  const readyCases = cases.filter((benchmarkCase) => benchmarkCase.status === "ready")
  const splits = countBy(readyCases.map((benchmarkCase) => benchmarkCase.split))
  const scenarios = countBy(cases.map((benchmarkCase) => benchmarkCase.scenario))
  const tiers = countBy(readyCases.flatMap((benchmarkCase) => benchmarkCase.truth ? [benchmarkCase.truth.tier] : []))
  const scenarioCoverage = Object.entries(scenarioTargets)
    .map(([scenario, target]) => `${scenario} ${scenarios[scenario as keyof typeof scenarios] ?? 0}/${target}`)
    .join("; ")

  console.log(`Statuts: ready=${statuses.ready ?? 0}, needs_truth=${statuses.needs_truth ?? 0}, excluded=${statuses.excluded ?? 0}.`)
  console.log(`Splits prêts: development=${splits.development ?? 0}, holdout=${splits.holdout ?? 0}.`)
  console.log(`Vérités prêtes: A=${tiers.A ?? 0}, B=${tiers.B ?? 0}, C=${tiers.C ?? 0}.`)
  console.log(`Couverture cible: ${scenarioCoverage}.`)
}

async function runCase(benchmarkCase: BenchmarkCase, photoPaths: string[], run: number): Promise<BenchmarkRunResult> {
  const startedAt = Date.now()
  try {
    const [{ analyzePhotoMeal }, { buildPhotoMealFinalResult }] = await Promise.all([
      import("@/lib/nutrition/photo-log-analyze"),
      import("@/lib/nutrition/photo-log-finalize"),
    ])
    const photoUrls = await Promise.all(photoPaths.map(imageToDataUrl))
    const { analysis, perf } = await analyzePhotoMeal({
      photoUrls,
      photoEvidence: benchmarkCase.input.photos.map((photo, index) => ({
        index: index + 1,
        kind: photo.kind,
        signed_url: photoUrls[index],
      })),
      manualWeightG: benchmarkCase.input.manual_weight_g,
      manualDetail: benchmarkCase.input.text,
    })
    const finalResult = buildPhotoMealFinalResult({
      analysis,
      answers: benchmarkCase.input.clarification_answers,
      lang: "fr",
    })
    return {
      case_id: benchmarkCase.id,
      title: benchmarkCase.title,
      scenario: benchmarkCase.scenario,
      split: benchmarkCase.split,
      truth_tier: benchmarkCase.truth!.tier,
      run,
      latency_ms: perf.totalMs || Date.now() - startedAt,
      metrics: scoreBenchmarkCase(benchmarkCase, finalResult),
      error: null,
      analysis,
      final_result: finalResult,
    }
  } catch (error) {
    return {
      case_id: benchmarkCase.id,
      title: benchmarkCase.title,
      scenario: benchmarkCase.scenario,
      split: benchmarkCase.split,
      truth_tier: benchmarkCase.truth!.tier,
      run,
      latency_ms: Date.now() - startedAt,
      metrics: null,
      error: messageFromError(error),
      analysis: null,
      final_result: null,
    }
  }
}

async function main() {
  loadEnvConfig(process.cwd())
  const options = parseOptions()
  const caseFiles = await findCaseFiles(options.casesDirectory)
  const loaded = await Promise.all(caseFiles.map(async (caseFile) => ({
    caseFile,
    ...(await loadCase(caseFile)),
  })))
  const seenIds = new Set<string>()
  const duplicateIds = new Set<string>()
  loaded.forEach(({ benchmarkCase }) => {
    if (seenIds.has(benchmarkCase.id)) duplicateIds.add(benchmarkCase.id)
    seenIds.add(benchmarkCase.id)
  })
  if (duplicateIds.size) throw new Error(`Identifiants de cas dupliqués: ${[...duplicateIds].join(", ")}`)
  const selected = loaded.filter(({ benchmarkCase }) =>
    benchmarkCase.status === "ready" &&
    (!options.split || benchmarkCase.split === options.split) &&
    (!options.caseIds.size || options.caseIds.has(benchmarkCase.id)),
  )

  console.log(`Cas valides: ${loaded.length}; prêts à exécuter: ${selected.length}.`)
  printCorpusCoverage(loaded.map(({ benchmarkCase }) => benchmarkCase))
  if (options.validateOnly) return
  if (!selected.length) throw new Error("Aucun cas ready ne correspond aux filtres.")
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY est requis pour exécuter le benchmark.")

  await mkdir(options.outputDirectory, { recursive: true })
  const results: BenchmarkRunResult[] = []
  for (const { benchmarkCase, photos } of selected) {
    for (let run = 1; run <= options.runs; run += 1) {
      console.log(`[${benchmarkCase.id}] exécution ${run}/${options.runs}`)
      results.push(await runCase(benchmarkCase, photos.map((photo) => photo.absolutePath), run))
    }
  }

  const summary = await writeBenchmarkReports(options.outputDirectory, results)
  console.log(`Score moyen: ${summary.average_score}/100; succès technique: ${Math.round(summary.technical_success_rate * 100)} %.`)
  console.log(`Rapport: ${path.join(options.outputDirectory, "report.html")}`)
}

main().catch((error) => {
  console.error(messageFromError(error))
  process.exitCode = 1
})
