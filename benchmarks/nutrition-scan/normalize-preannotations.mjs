import { existsSync } from "node:fs"
import { readFile, readdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { normalizeAnnotationDraft } from "./preannotation-policy.mjs"

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

async function main() {
  const root = path.resolve(process.argv[2] ?? "benchmarks/nutrition-scan/cases/private")
  let normalized = 0
  for (const casePath of await findCaseFiles(root)) {
    const preannotationPath = path.join(path.dirname(casePath), "preannotation.json")
    if (!existsSync(preannotationPath)) continue
    const benchmarkCase = JSON.parse(await readFile(casePath, "utf8"))
    const preannotation = JSON.parse(await readFile(preannotationPath, "utf8"))
    preannotation.draft = normalizeAnnotationDraft(preannotation.draft, benchmarkCase)
    preannotation.metadata.policy_normalized_at = new Date().toISOString()
    const temporaryPath = `${preannotationPath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(preannotation, null, 2)}\n`)
    await rename(temporaryPath, preannotationPath)
    normalized += 1
  }
  console.log(`${normalized} pré-annotation(s) normalisée(s).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
