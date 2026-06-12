import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'
import { classifyCiqualRow } from '../lib/nutrition/ciqual-classifier.mjs'

const DEFAULT_CSV_PATH = path.join(process.cwd(), 'data/nutrition/foods-import.csv')
const CHUNK_SIZE = 200

function parseArgs(argv) {
  const args = { apply: false, file: DEFAULT_CSV_PATH, limit: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--apply') args.apply = true
    else if (arg === '--file') args.file = path.resolve(process.cwd(), argv[++i])
    else if (arg === '--limit') args.limit = Number(argv[++i] ?? '0') || null
  }
  return args
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf-8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
}

function parseNumber(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '-' || text === 'traces') return null
  const clean = text
    .replace(',', '.')
    .replace(/<\s*/g, '')
    .replace(/\s+/g, '')
  const parsed = Number(clean)
  return Number.isFinite(parsed) ? parsed : null
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function deriveKcal(row) {
  const direct = parseNumber(row['Energie (kcal/100 g)'])
  if (direct != null) return direct
  const protein = parseNumber(row['Protéines (g/100 g)']) ?? 0
  const carbs = parseNumber(row['Glucides (g/100 g)']) ?? 0
  const fat = parseNumber(row['Lipides (g/100 g)']) ?? 0
  const fiber = parseNumber(row['Fibres alimentaires (g/100 g)']) ?? 0
  return round1(protein * 4 + carbs * 4 + fat * 9 + fiber * 2)
}

function classifyRow(row) {
  return classifyCiqualRow(row)
}

function buildFoodRow(row) {
  const category = classifyRow(row)
  const name = String(row.Aliments ?? '').trim()
  const alimCode = String(row.alim_code ?? '').trim()
  const protein = parseNumber(row['Protéines (g/100 g)']) ?? 0
  const carbs = parseNumber(row['Glucides (g/100 g)']) ?? 0
  const fat = parseNumber(row['Lipides (g/100 g)']) ?? 0
  const fiber = parseNumber(row['Fibres alimentaires (g/100 g)']) ?? 0
  const sugar = parseNumber(row['Sucres (g/100 g)'])
  const sodium = parseNumber(row['Sodium (mg/100 g)'])
  const kcal = deriveKcal(row)

  return {
    item_key: `ciqual-${alimCode}`,
    name_fr: name,
    category_l1: category.category_l1,
    category_l2: category.category_l2,
    kcal_per_100g: kcal,
    protein_per_100g: round1(protein),
    carbs_per_100g: round1(carbs),
    fat_per_100g: round1(fat),
    fiber_per_100g: round1(fiber),
    source: 'internal',
    is_verified: true,
  }
}

function chunk(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size))
  return chunks
}

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env.local'))
  loadEnvFile(path.join(process.cwd(), '.env'))

  const args = parseArgs(process.argv.slice(2))
  const rawCsv = fs.readFileSync(args.file, 'utf-8')
  const records = parse(rawCsv, { columns: true, skip_empty_lines: true, bom: true, trim: true })
  const slicedRecords = args.limit ? records.slice(0, args.limit) : records
  const rawRows = slicedRecords
    .filter((row) => String(row.Aliments ?? '').trim())
    .map(buildFoodRow)

  const dedupedMap = new Map()
  for (const row of rawRows) dedupedMap.set(row.item_key, row)
  const rows = Array.from(dedupedMap.values())
  const duplicateCount = rawRows.length - rows.length

  const byCategory = rows.reduce((acc, row) => {
    const key = `${row.category_l1}/${row.category_l2}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  console.log(`CSV: ${args.file}`)
  console.log(`Rows prepared: ${rows.length}`)
  if (duplicateCount > 0) console.log(`Duplicate item_keys skipped from CSV: ${duplicateCount}`)
  console.log('Top categories:')
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([key, count]) => console.log(`  - ${key}: ${count}`))

  console.log('Sample rows:')
  rows.slice(0, 5).forEach((row) => console.log(`  - ${row.item_key} | ${row.name_fr} | ${row.category_l1}/${row.category_l2} | ${row.kcal_per_100g} kcal`))

  if (!args.apply) {
    console.log('Dry run complete. Re-run with --apply to write to Supabase.')
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let upserted = 0
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const { error } = await supabase
      .from('food_items')
      .upsert(batch, { onConflict: 'item_key' })
    if (error) throw error
    upserted += batch.length
  }

  console.log(`Import complete. Upserted: ${upserted}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
