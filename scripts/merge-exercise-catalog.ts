import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

const CATALOG_PATH = path.join(process.cwd(), 'data/exercise-catalog.json')
const LIBRARY_PATH = path.join(process.cwd(), 'public/bibliotheque_exercices')
const ID_MAP_PATH = path.join(process.cwd(), 'scripts/exercise-id-map.json')

interface CsvRow {
  exercise_id: string
  name: string
  pattern: string
  plane: string
  mechanic: string
  unilateral: string
  primary_muscle: string
  primary_activation: string
  secondary_muscles: string
  secondary_activations: string
  stabilizers: string
  joint_stress_spine: string
  joint_stress_knee: string
  joint_stress_shoulder: string
  global_instability: string
  coordination_demand: string
  constraint_profile: string
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parsePipe(val: string): string[] {
  return val ? val.split('|').map(s => s.trim()).filter(Boolean) : []
}

function parsePipeNumbers(val: string): number[] {
  return parsePipe(val).map(Number).filter(n => !isNaN(n))
}

function slugMatch(csvName: string, catalogSlugs: Set<string>): string | null {
  const direct = toSlug(csvName)
  if (catalogSlugs.has(direct)) return direct

  // 3-word prefix match
  const prefix = direct.split('-').slice(0, 3).join('-')
  const candidates = [...catalogSlugs].filter(s => s.startsWith(prefix))
  if (candidates.length === 1) return candidates[0]

  return null
}

async function main() {
  const catalog: Record<string, unknown>[] = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'))
  const idMap: Record<string, string> = JSON.parse(fs.readFileSync(ID_MAP_PATH, 'utf-8'))
  const catalogBySlug = new Map(catalog.map(e => [(e as { slug: string }).slug, e]))
  const catalogSlugs = new Set(catalogBySlug.keys())

  const groups = fs.readdirSync(LIBRARY_PATH).filter(f =>
    fs.statSync(path.join(LIBRARY_PATH, f)).isDirectory()
  )

  let matched = 0
  const unmatched: string[] = []

  for (const group of groups) {
    const csvFile = fs.readdirSync(path.join(LIBRARY_PATH, group)).find(f => f.endsWith('.csv'))
    if (!csvFile) continue

    const raw = fs.readFileSync(path.join(LIBRARY_PATH, group, csvFile), 'utf-8')
    const rows: CsvRow[] = parse(raw, { columns: true, skip_empty_lines: true })

    for (const row of rows) {
      // Priority 1: manual map
      let slug = idMap[row.exercise_id] ?? null

      // Priority 2: auto slug match
      if (!slug) slug = slugMatch(row.name, catalogSlugs)

      if (!slug || !catalogBySlug.has(slug)) {
        unmatched.push(`[${group}] ${row.exercise_id} | ${row.name}`)
        continue
      }

      const entry = catalogBySlug.get(slug) as Record<string, unknown>

      // Merge biomech fields
      entry.plane = row.plane || null
      entry.mechanic = row.mechanic || null
      entry.unilateral = row.unilateral === 'true'
      entry.primaryMuscle = row.primary_muscle || null
      entry.primaryActivation = row.primary_activation ? parseFloat(row.primary_activation) : null
      entry.secondaryMuscles = parsePipe(row.secondary_muscles)
      entry.secondaryActivations = parsePipeNumbers(row.secondary_activations)
      entry.stabilizers = parsePipe(row.stabilizers)
      entry.jointStressSpine = row.joint_stress_spine ? parseInt(row.joint_stress_spine) : null
      entry.jointStressKnee = row.joint_stress_knee ? parseInt(row.joint_stress_knee) : null
      entry.jointStressShoulder = row.joint_stress_shoulder ? parseInt(row.joint_stress_shoulder) : null
      entry.globalInstability = row.global_instability ? parseInt(row.global_instability) : null
      entry.coordinationDemand = row.coordination_demand ? parseInt(row.coordination_demand) : null
      entry.constraintProfile = row.constraint_profile || null

      matched++
    }
  }

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2))

  console.log(`✅ Matched: ${matched}`)
  console.log(`⚠️  Unmatched (${unmatched.length}):`)
  unmatched.forEach(u => console.log('  ', u))
}

main().catch(console.error)
