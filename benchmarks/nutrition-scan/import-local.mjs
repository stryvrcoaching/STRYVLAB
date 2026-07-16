import { execFileSync } from "node:child_process"
import path from "node:path"
import { existsSync } from "node:fs"
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"

const supportedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"])
const heicExtensions = new Set([".heic", ".heif"])
const scenarios = new Set([
  "simple_plate", "complex_plate", "separate_weighing", "packaging", "receipt", "hybrid", "leftovers", "unclassified",
])
const splits = new Set(["development", "holdout"])
const photoKinds = new Set(["context", "top", "side", "scale_zoom", "leftovers"])
const roleHints = new Set([
  "before_meal", "after_meal_leftovers", "separate_weighing", "receipt", "packaging_front",
  "nutrition_label", "barcode", "detail", "unknown",
])
const targetFileBytes = 5 * 1024 * 1024

function readOption(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "session"
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message)
}

async function imageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => ({ path: path.join(directory, entry.name), kind: "context", roleHint: null }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

function validateManifest(raw) {
  assertCondition(raw && typeof raw === "object", "Le manifeste doit être un objet JSON.")
  assertCondition(raw.version === 1, "La version du manifeste doit être 1.")
  assertCondition(Array.isArray(raw.groups) && raw.groups.length > 0, "Le manifeste ne contient aucune session.")
  raw.groups.forEach((group, groupIndex) => {
    assertCondition(/^[a-z0-9][a-z0-9-]*$/.test(String(group.id ?? "")), `Identifiant invalide à la session ${groupIndex + 1}.`)
    assertCondition(typeof group.title === "string" && group.title.trim(), `Titre manquant à la session ${groupIndex + 1}.`)
    assertCondition(scenarios.has(group.scenario), `Scénario invalide pour ${group.id}.`)
    assertCondition(splits.has(group.split ?? "development"), `Split invalide pour ${group.id}.`)
    assertCondition(Array.isArray(group.files) && group.files.length > 0 && group.files.length <= 20, `Photos invalides pour ${group.id}.`)
  })
  return raw
}

async function groupsFromManifest(source, manifestPath) {
  const manifest = validateManifest(JSON.parse(await readFile(manifestPath, "utf8")))
  const seenFiles = new Set()
  const groups = manifest.groups.map((group) => ({
    id: group.id,
    name: group.title,
    scenario: group.scenario,
    split: group.split ?? "development",
    files: group.files.map((file) => {
      const normalized = typeof file === "string" ? { name: file, kind: "context", role_hint: null } : file
      assertCondition(typeof normalized.name === "string" && normalized.name.trim(), `Nom de fichier invalide pour ${group.id}.`)
      assertCondition(photoKinds.has(normalized.kind ?? "context"), `Type de photo invalide pour ${normalized.name}.`)
      assertCondition(normalized.role_hint == null || roleHints.has(normalized.role_hint), `Rôle invalide pour ${normalized.name}.`)
      assertCondition(!seenFiles.has(normalized.name), `Image présente dans plusieurs sessions: ${normalized.name}`)
      seenFiles.add(normalized.name)
      const filePath = path.join(source, normalized.name)
      assertCondition(existsSync(filePath), `Image du manifeste introuvable: ${filePath}`)
      assertCondition(supportedExtensions.has(path.extname(filePath).toLowerCase()), `Format non pris en charge: ${filePath}`)
      return { path: filePath, kind: normalized.kind ?? "context", roleHint: normalized.role_hint ?? null }
    }),
  }))
  const availableImages = await imageFiles(source)
  const ungrouped = availableImages.filter((photo) => !seenFiles.has(path.basename(photo.path)))
  if (ungrouped.length) console.warn(`${ungrouped.length} image(s) du dossier ne figurent pas dans le manifeste.`)
  return groups
}

async function discoverGroups(source, singleSession, manifestPath) {
  if (manifestPath) return groupsFromManifest(source, manifestPath)
  const directImages = await imageFiles(source)
  if (singleSession) return directImages.length ? [{ name: path.basename(source), files: directImages }] : []

  const entries = await readdir(source, { withFileTypes: true })
  const directoryGroups = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => ({
    name: entry.name,
    files: await imageFiles(path.join(source, entry.name)),
  })))
  const nonEmptyGroups = directoryGroups.filter((group) => group.files.length > 0)
  if (nonEmptyGroups.length) return nonEmptyGroups
  return directImages.map((file) => ({ name: path.basename(file.path, path.extname(file.path)), files: [file] }))
}

async function prepareBenchmarkImage(sourceFile, destinationBase) {
  const extension = path.extname(sourceFile).toLowerCase()
  const needsHeicConversion = heicExtensions.has(extension)
  if (process.platform !== "darwin") {
    if (needsHeicConversion) throw new Error(`Conversion HEIC indisponible sur cette plateforme: ${sourceFile}`)
    const destination = `${destinationBase}${extension}`
    await copyFile(sourceFile, destination)
    return path.basename(destination)
  }

  const destination = `${destinationBase}.jpg`
  execFileSync("/usr/bin/sips", [
    "-Z", "2800", "-s", "format", "jpeg", "-s", "formatOptions", "92", sourceFile, "--out", destination,
  ], { stdio: "ignore" })
  if ((await stat(destination)).size > targetFileBytes) {
    execFileSync("/usr/bin/sips", [
      "-Z", "2400", "-s", "format", "jpeg", "-s", "formatOptions", "82", sourceFile, "--out", destination,
    ], { stdio: "ignore" })
  }
  return path.basename(destination)
}

async function main() {
  const args = process.argv.slice(2)
  const sourceValue = readOption(args, "--source")
  if (!sourceValue) throw new Error("Utilisation: npm run benchmark:nutrition:import -- --source /chemin/vers/photos")

  const source = path.resolve(sourceValue)
  const destination = path.resolve(readOption(args, "--destination") ?? "benchmarks/nutrition-scan/cases/private")
  const manifestValue = readOption(args, "--manifest")
  const manifestPath = manifestValue ? path.resolve(manifestValue) : undefined
  if (!existsSync(source)) throw new Error(`Dossier introuvable: ${source}`)
  if (manifestPath && !existsSync(manifestPath)) throw new Error(`Manifeste introuvable: ${manifestPath}`)
  const groups = await discoverGroups(source, args.includes("--single-session"), manifestPath)
  if (!groups.length) throw new Error("Aucune image JPG, PNG, WEBP, GIF, HEIC ou HEIF trouvée.")

  await mkdir(destination, { recursive: true })
  let imported = 0
  let skipped = 0
  let processedPhotos = 0
  const totalPhotos = groups.reduce((sum, group) => sum + group.files.length, 0)
  for (const [index, group] of groups.entries()) {
    const id = group.id ?? `private-${String(index + 1).padStart(3, "0")}-${slugify(group.name)}`
    const caseDirectory = path.join(destination, id)
    const casePath = path.join(caseDirectory, "case.json")
    if (existsSync(casePath)) {
      skipped += 1
      processedPhotos += group.files.length
      continue
    }

    const assetsDirectory = path.join(caseDirectory, "assets")
    await mkdir(assetsDirectory, { recursive: true })
    const photos = []
    for (const [photoIndex, sourcePhoto] of group.files.entries()) {
      const extension = path.extname(sourcePhoto.path).toLowerCase()
      const filenameBase = `${String(photoIndex + 1).padStart(2, "0")}-${slugify(path.basename(sourcePhoto.path, extension))}`
      const filename = await prepareBenchmarkImage(sourcePhoto.path, path.join(assetsDirectory, filenameBase))
      photos.push({ path: `assets/${filename}`, kind: sourcePhoto.kind, role_hint: sourcePhoto.roleHint })
      processedPhotos += 1
      if (processedPhotos % 10 === 0 || processedPhotos === totalPhotos) {
        console.log(`Préparation des images: ${processedPhotos}/${totalPhotos}`)
      }
    }

    const benchmarkCase = {
      schema_version: 1,
      id,
      title: group.name,
      status: "needs_truth",
      split: group.split ?? "development",
      scenario: group.scenario ?? "unclassified",
      provenance: {
        source_type: "owned",
        source_url: null,
        license: "owned-private",
        attribution: null,
        consent_confirmed: true,
        notes: "Import local. Vérifier le consentement si une autre personne est identifiable.",
      },
      input: { photos, text: null, manual_weight_g: null, clarification_answers: {} },
      truth: null,
    }
    await writeFile(casePath, `${JSON.stringify(benchmarkCase, null, 2)}\n`)
    imported += 1
  }

  console.log(`${imported} cas importés, ${skipped} cas déjà présents.`)
  console.log(`Destination: ${destination}`)
  console.log("Étape suivante: compléter chaque case.json puis passer status à ready.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
