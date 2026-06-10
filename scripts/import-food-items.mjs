import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

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

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-')
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

function inKeywords(haystack, keywords) {
  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword)
    if (!normalizedKeyword) return false
    const pattern = new RegExp(`(^| )${escapeRegex(normalizedKeyword)}(?= |$)`)
    return pattern.test(haystack)
  })
}

function classifyRow(row) {
  const group = normalizeText(row.alim_ssgrp_nom_fr)
  const subgroup = normalizeText(row.alim_ssssgrp_nom_fr)
  const name = normalizeText(row.Aliments)
  const scope = [group, subgroup, name].filter(Boolean).join(' | ')

  if (inKeywords(scope, ['eaux'])) return { category_l1: 'drinks', category_l2: 'eau' }
  if (inKeywords(scope, ['boisson alcoolisee', 'liqueurs et alcools', 'vins', 'bieres et cidres', 'cocktails'])) {
    return { category_l1: 'drinks', category_l2: 'alcools' }
  }
  if (inKeywords(scope, ['boissons vegetales'])) return { category_l1: 'drinks', category_l2: 'laits-vegetaux' }
  if (inKeywords(scope, ['cafe the cacao', 'cafe', 'the', 'infusion', 'chicoree'])) {
    return { category_l1: 'drinks', category_l2: 'chauds' }
  }
  if (inKeywords(scope, ['jus', 'nectars', 'smoothie'])) return { category_l1: 'drinks', category_l2: 'jus-smoothies' }
  if (inKeywords(scope, ['boisson energetique', 'boisson isotoni', 'boisson a reconstituer', 'sports'])) {
    return { category_l1: 'drinks', category_l2: 'sports-drinks' }
  }
  if (inKeywords(scope, ['boissons sans alcool', 'boissons rafraichissantes lactees', 'sodas', 'colas'])) {
    return { category_l1: 'extras', category_l2: 'boissons' }
  }

  if (inKeywords(scope, ['viandes crues', 'viandes cuites', 'bœuf', 'boeuf', 'veau', 'porc', 'agneau', 'mouton', 'gibier', 'lapin', 'canard'])) {
    return { category_l1: 'proteins', category_l2: 'viandes' }
  }
  if (inKeywords(scope, ['charcuteries', 'jambons', 'saucisses', 'pates et terrines', 'rillettes', 'saucisson'])) {
    return { category_l1: 'proteins', category_l2: 'viandes' }
  }
  if (inKeywords(scope, ['poissons crus', 'poissons cuits', 'produits a base de poissons', 'mollusques', 'crustaces', 'thon', 'saumon', 'sardine', 'anchois'])) {
    return { category_l1: 'proteins', category_l2: 'poissons' }
  }
  if (inKeywords(scope, ['œufs', 'oeufs', 'ovoproduits', 'omelettes'])) {
    return { category_l1: 'proteins', category_l2: 'oeufs' }
  }
  if (inKeywords(scope, ['fromages', 'produits laitiers frais', 'yaourts', 'yaourt', 'laits'])) {
    return { category_l1: 'proteins', category_l2: 'laitiers' }
  }
  if (inKeywords(scope, ['substitus de produits carnes', 'substituts de charcuteries', 'desserts vegetaux', 'substituts de fromages'])) {
    return { category_l1: 'proteins', category_l2: 'vegetales' }
  }

  if (inKeywords(scope, ['legumineuses'])) {
    return { category_l1: 'carbs', category_l2: subgroup.includes('seches') ? 'legumineuses' : 'legumineuses' }
  }
  if (inKeywords(scope, ['pates riz et cereales', 'cereales de petit dejeuner'])) {
    return { category_l1: 'carbs', category_l2: 'cereales' }
  }
  if (inKeywords(scope, ['pains et assimiles', 'pains', 'biscottes', 'pain de mie', 'tortilla', 'wrap'])) {
    return { category_l1: 'carbs', category_l2: 'pain' }
  }
  if (inKeywords(scope, ['pommes de terre et autres tubercules', 'pommes de terre', 'tubercules'])) {
    return { category_l1: 'carbs', category_l2: 'fecules' }
  }

  if (inKeywords(scope, ['fruits a coque et graines oleagineuses'])) {
    return { category_l1: 'fats', category_l2: 'noix-graines' }
  }
  if (inKeywords(scope, ['huiles et graisses vegetales', 'margarines', 'beurres', 'huiles de poissons', 'autres matieres grasses'])) {
    return { category_l1: 'fats', category_l2: 'huiles' }
  }

  if (inKeywords(scope, ['legumes'])) {
    if (inKeywords(scope, ['crus', 'salade', 'laitue', 'roquette', 'epinard', 'mache'])) {
      return { category_l1: 'vegetables', category_l2: 'feuilles' }
    }
    if (inKeywords(scope, ['chou', 'brocoli', 'chou fleur', 'crucif'])) {
      return { category_l1: 'vegetables', category_l2: 'cruciferes' }
    }
    return { category_l1: 'vegetables', category_l2: 'autres-legumes' }
  }
  if (inKeywords(scope, ['herbes', 'algues'])) return { category_l1: 'vegetables', category_l2: 'autres-legumes' }

  if (inKeywords(scope, ['fruits'])) {
    return { category_l1: 'fruits', category_l2: inKeywords(scope, ['seches', 'compotes', 'appertises']) ? 'secs' : 'frais' }
  }

  if (inKeywords(scope, ['sauces', 'condiments'])) return { category_l1: 'extras', category_l2: 'sauces' }
  if (inKeywords(scope, ['biscuits aperitifs'])) return { category_l1: 'extras', category_l2: 'snacks-sales' }
  if (inKeywords(scope, ['gateaux et patisseries', 'biscuits sucres', 'viennoiseries', 'confiseries', 'chocolats', 'glaces', 'desserts glaces', 'sorbets', 'barres cerealieres', 'confitures', 'sucres miels'])) {
    return { category_l1: 'extras', category_l2: 'snacks-sucres' }
  }
  if (inKeywords(scope, ['pizzas', 'sandwichs', 'plats composes', 'feuilletees', 'salades composees', 'soupes'])) {
    return { category_l1: 'extras', category_l2: 'fast-food' }
  }

  return { category_l1: 'extras', category_l2: 'divers' }
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
