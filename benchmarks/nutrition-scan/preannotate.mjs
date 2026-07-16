import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, readdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { normalizeAnnotationDraft } from "./preannotation-policy.mjs"

const supportedMimeTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

const annotationPrompt = `Tu constitues un BROUILLON DE VERITE TERRAIN indépendant pour évaluer un scanner nutritionnel.
Toutes les photos appartiennent à une seule session. Observe chaque image et retourne uniquement un objet JSON valide.

Structure obligatoire:
{
  "schema_version": 1,
  "analysis_mode": "plate|packaging|barcode|receipt|hybrid",
  "session_summary_fr": "description factuelle courte",
  "photo_observations": [
    {
      "photo_index": 1,
      "role": "before_meal|after_meal_leftovers|separate_weighing|receipt|packaging_front|nutrition_label|barcode|detail|unknown",
      "observations_fr": "faits visibles",
      "scale_reading_g": null,
      "scale_scope": "meal_total|component|unknown|null",
      "scale_food_name_fr": null,
      "confidence": 0
    }
  ],
  "components": [
    {
      "name_fr": "nom factuel",
      "aliases": [],
      "quantity_g": null,
      "quantity_source": "scale|label|receipt|count|visual_unknown|unknown",
      "quantity_evidence_fr": "preuve ou raison du null",
      "unit_count": null,
      "nutrients_per_100g": {
        "kcal": null,
        "protein_g": null,
        "carbs_g": null,
        "fat_g": null,
        "fiber_g": null
      },
      "nutrition_source": "label|receipt|unknown",
      "nutrition_evidence_fr": "preuve ou raison du null",
      "evidence_photos": [1],
      "confidence": 0
    }
  ],
  "product_reference": {
    "brand": null,
    "name": null,
    "barcode": null,
    "serving_size_g": null,
    "evidence_photos": []
  },
  "receipt_lines": [
    { "label": "article", "quantity": 1, "evidence_photo": 1 }
  ],
  "direct_totals": {
    "kcal": null,
    "protein_g": null,
    "carbs_g": null,
    "fat_g": null,
    "fiber_g": null,
    "source": "label|receipt|sum_of_direct_components|unknown"
  },
  "suggested_truth_tier": "A|B|C",
  "requires_human_review": true,
  "human_questions_fr": [],
  "quality_flags": []
}

Règles impératives:
- Ce document est un brouillon de preuve, pas une estimation du scanner testé.
- N'invente jamais un poids. Sans balance, étiquette, ticket ou quantité explicitement fournie, quantity_g reste null.
- Un poids total d'assiette ne devient jamais le poids d'un composant.
- Pour des pesées successives, distingue le poids propre du composant d'un poids cumulatif. Si le périmètre est incertain, scale_scope="unknown" et quantity_g=null.
- N'invente jamais les nutriments d'un aliment visuel. Remplis-les seulement si un tableau nutritionnel est réellement lisible sur les photos.
- Pour un plat mélangé, relève les ingrédients réellement distincts et visibles. Si sa composition exacte reste incertaine, décris l'ensemble prudemment et demande confirmation dans human_questions_fr.
- Un titre de cas peut être fourni comme indice humain faible. Vérifie-le visuellement et signale toute contradiction au lieu de le recopier aveuglément.
- Ne nomme jamais un petit emballage, une marque ou un produit si son texte n'est pas lisible. Utilise un libellé générique et demande confirmation.
- Pour une valeur d'étiquette par portion, ne la convertis par 100 g que si la taille de portion est lisible et le calcul certain.
- Un ticket permet d'identifier les articles et quantités, mais pas leurs nutriments si ceux-ci ne sont pas imprimés.
- Les photos avant/après permettent d'identifier des restes. Ne calcule une quantité consommée que si les deux masses comparables sont lisibles.
- Ajoute duplicate_photo uniquement pour une copie du même fichier ou un cadrage manifestement identique. Deux angles du même repas ne sont pas des doublons.
- Tier A: quantités et nutrition directement mesurées/lues pour l'ensemble du cas.
- Tier B: quantités mesurées mais nutrition nécessitant encore une source documentée.
- Tier C: identité ou quantité reposant principalement sur l'interprétation visuelle.
- requires_human_review doit rester true tant qu'une question, une lecture incertaine ou une donnée nutritionnelle manque.
- Pour un cas Tier C, human_questions_fr ne peut pas être vide: demande au minimum la confirmation des aliments et des quantités réellement consommées.
- confidence est compris entre 0 et 1.`

function readOption(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function parseEnvFile(content) {
  const values = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed
    const separator = normalized.indexOf("=")
    if (separator < 1) continue
    const key = normalized.slice(0, separator).trim()
    let value = normalized.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

async function loadEnvironment() {
  if (!existsSync(".env.local")) return
  const values = parseEnvFile(await readFile(".env.local", "utf8"))
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) process.env[key] = value
  }
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

function parseModelJson(content) {
  const source = String(content ?? "").trim()
  const candidates = [
    source,
    source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(),
    source.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"))
    } catch {}
  }
  throw new Error("annotation_json_invalid")
}

function assertDraft(draft) {
  const modes = new Set(["plate", "packaging", "barcode", "receipt", "hybrid"])
  if (!draft || draft.schema_version !== 1) throw new Error("annotation_schema_invalid")
  if (!modes.has(draft.analysis_mode)) throw new Error("annotation_mode_invalid")
  if (!Array.isArray(draft.photo_observations) || !Array.isArray(draft.components)) {
    throw new Error("annotation_arrays_invalid")
  }
  if (!["A", "B", "C"].includes(draft.suggested_truth_tier)) throw new Error("annotation_tier_invalid")
}

async function imageContent(caseDirectory, photo, index, hash) {
  const imagePath = path.resolve(caseDirectory, photo.path)
  const extension = path.extname(imagePath).toLowerCase()
  const mimeType = supportedMimeTypes[extension]
  if (!mimeType) throw new Error(`unsupported_image:${imagePath}`)
  const bytes = await readFile(imagePath)
  hash.update(String(index)).update(photo.path).update(bytes)
  return [
    {
      type: "text",
      text: `Photo ${index}. Contexte technique déclaré: kind=${photo.kind}; role_hint=${photo.role_hint ?? "null"}. Vérifie son rôle réel visuellement.`,
    },
    {
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${bytes.toString("base64")}`, detail: "high" },
    },
  ]
}

async function requestAnnotation({ apiKey, model, benchmarkCase, caseDirectory }) {
  const hash = createHash("sha256")
  hash.update(JSON.stringify(benchmarkCase.input))
  const photoParts = (await Promise.all(benchmarkCase.input.photos.map(
    (photo, index) => imageContent(caseDirectory, photo, index + 1, hash),
  ))).flat()
  const userContext = {
    case_id: benchmarkCase.id,
    case_title_hint: benchmarkCase.title,
    scenario_hint: benchmarkCase.scenario,
    user_text: benchmarkCase.input.text,
    manual_weight_g: benchmarkCase.input.manual_weight_g,
    photo_count: benchmarkCase.input.photos.length,
  }
  const body = {
    model,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 3000,
    messages: [
      { role: "system", content: annotationPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: `Contexte de session: ${JSON.stringify(userContext)}` },
          ...photoParts,
        ],
      },
    ],
  }

  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      })
      const json = await response.json()
      if (!response.ok) {
        const message = json?.error?.message ?? `openai_http_${response.status}`
        const retryable = response.status === 429 || response.status >= 500
        if (!retryable) throw Object.assign(new Error(message), { retryable: false })
        throw Object.assign(new Error(message), { retryable: true })
      }
      const draft = normalizeAnnotationDraft(parseModelJson(json.choices?.[0]?.message?.content), benchmarkCase)
      assertDraft(draft)
      return {
        metadata: {
          schema_version: 1,
          case_id: benchmarkCase.id,
          created_at: new Date().toISOString(),
          model,
          purpose: "independent_ground_truth_draft",
          input_fingerprint: hash.digest("hex"),
          usage: json.usage ?? null,
        },
        draft,
      }
    } catch (error) {
      lastError = error
      if (error?.retryable === false || attempt === 3) break
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000))
    }
  }
  throw lastError
}

async function writeAtomic(destination, value) {
  const temporary = `${destination}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temporary, destination)
}

async function main() {
  await loadEnvironment()
  const args = process.argv.slice(2)
  const root = path.resolve(readOption(args, "--cases") ?? "benchmarks/nutrition-scan/cases/private")
  const limit = Math.max(1, Number(readOption(args, "--limit") ?? 10) || 10)
  const model = readOption(args, "--model") ?? process.env.BENCHMARK_ANNOTATION_MODEL ?? "gpt-4o"
  const requestedIds = new Set((readOption(args, "--ids") ?? "").split(",").map((value) => value.trim()).filter(Boolean))
  const overwrite = args.includes("--overwrite")
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY est requis.")

  const candidates = []
  for (const casePath of await findCaseFiles(root)) {
    const benchmarkCase = JSON.parse(await readFile(casePath, "utf8"))
    const destination = path.join(path.dirname(casePath), "preannotation.json")
    if (benchmarkCase.status !== "needs_truth") continue
    if (requestedIds.size && !requestedIds.has(benchmarkCase.id)) continue
    if (!overwrite && existsSync(destination)) continue
    candidates.push({ benchmarkCase, casePath, destination })
  }
  const selected = candidates.slice(0, limit)
  if (!selected.length) {
    console.log("Aucun cas à pré-annoter.")
    return
  }

  let completed = 0
  const failures = []
  for (const candidate of selected) {
    console.log(`[${candidate.benchmarkCase.id}] pré-annotation ${completed + 1}/${selected.length}`)
    try {
      const result = await requestAnnotation({
        apiKey,
        model,
        benchmarkCase: candidate.benchmarkCase,
        caseDirectory: path.dirname(candidate.casePath),
      })
      await writeAtomic(candidate.destination, result)
      completed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push({ case_id: candidate.benchmarkCase.id, error: message })
      console.error(`[${candidate.benchmarkCase.id}] échec: ${message}`)
    }
  }
  console.log(`${completed} pré-annotation(s) créée(s) avec ${model}.`)
  if (failures.length) {
    console.error(`${failures.length} échec(s): ${failures.map((failure) => failure.case_id).join(", ")}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
