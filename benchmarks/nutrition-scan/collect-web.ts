import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { benchmarkScenarioSchema, benchmarkSplitSchema } from "./schema"

const manifestSchema = z.object({
  contact: z.string().email(),
  entries: z.array(z.object({
    case_id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().trim().min(1),
    scenario: benchmarkScenarioSchema,
    split: benchmarkSplitSchema.default("development"),
    source_page: z.string().url(),
    source_type: z.enum(["licensed_dataset", "official_public"]),
    license: z.string().trim().min(1),
    attribution: z.string().trim().min(1),
    rights_confirmed: z.literal(true),
    text: z.string().trim().nullable().default(null),
    photos: z.array(z.object({
      url: z.string().url(),
      filename: z.string().regex(/^[a-zA-Z0-9._-]+$/),
      kind: z.enum(["context", "top", "side", "scale_zoom", "leftovers"]).default("context"),
      role_hint: z.enum([
        "before_meal", "after_meal_leftovers", "separate_weighing", "receipt", "packaging_front",
        "nutrition_label", "barcode", "detail", "unknown",
      ]).nullable().default(null),
    })).min(1).max(20),
  })).min(1),
})

const maximumImageBytes = 15 * 1024 * 1024

function readOption(args: string[], name: string) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function assertPublicHttpsUrl(value: string) {
  const url = new URL(value)
  const blocked = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|::1$)/i.test(url.hostname)
  const private172 = /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)
  if (url.protocol !== "https:" || blocked || private172) throw new Error(`URL non publique refusée: ${value}`)
  return url
}

async function downloadImage(urlValue: string, userAgent: string) {
  const url = assertPublicHttpsUrl(urlValue)
  const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "image/*" } })
  if (!response.ok) throw new Error(`Téléchargement ${response.status}: ${url}`)
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? ""
  if (!new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]).has(contentType)) {
    throw new Error(`Type de fichier refusé (${contentType || "inconnu"}): ${url}`)
  }
  const contentLength = Number(response.headers.get("content-length") ?? 0)
  if (contentLength > maximumImageBytes) throw new Error(`Image trop volumineuse: ${url}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > maximumImageBytes) throw new Error(`Image trop volumineuse: ${url}`)
  return bytes
}

async function pause(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function main() {
  const args = process.argv.slice(2)
  const manifestValue = readOption(args, "--manifest")
  if (!manifestValue) throw new Error("Utilisation: npm run benchmark:nutrition:collect -- --manifest chemin/manifest.json")
  const manifestPath = path.resolve(manifestValue)
  const manifest = manifestSchema.parse(JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(manifestPath, "utf8"))))
  const destination = path.resolve(readOption(args, "--destination") ?? "benchmarks/nutrition-scan/cases/public")
  const userAgent = `STRYVLABNutritionBenchmark/1.0 (${manifest.contact})`
  let imported = 0
  let skipped = 0

  for (const entry of manifest.entries) {
    const caseDirectory = path.join(destination, entry.case_id)
    const casePath = path.join(caseDirectory, "case.json")
    if (existsSync(casePath)) {
      skipped += 1
      continue
    }
    const assetsDirectory = path.join(caseDirectory, "assets")
    await mkdir(assetsDirectory, { recursive: true })
    const photos = []
    for (const photo of entry.photos) {
      const bytes = await downloadImage(photo.url, userAgent)
      await writeFile(path.join(assetsDirectory, photo.filename), bytes)
      photos.push({ path: `assets/${photo.filename}`, kind: photo.kind, role_hint: photo.role_hint })
      await pause(1000)
    }
    const benchmarkCase = {
      schema_version: 1,
      id: entry.case_id,
      title: entry.title,
      status: "needs_truth",
      split: entry.split,
      scenario: entry.scenario,
      provenance: {
        source_type: entry.source_type,
        source_url: entry.source_page,
        license: entry.license,
        attribution: entry.attribution,
        consent_confirmed: true,
        notes: "Téléchargé depuis une URL explicitement approuvée dans le manifeste.",
      },
      input: { photos, text: entry.text, manual_weight_g: null, clarification_answers: {} },
      truth: null,
    }
    await writeFile(casePath, `${JSON.stringify(benchmarkCase, null, 2)}\n`)
    imported += 1
  }

  console.log(`${imported} cas web importés, ${skipped} cas déjà présents.`)
  console.log("Aucune recherche ni collecte aveugle n'a été effectuée; seules les URL approuvées ont été utilisées.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
