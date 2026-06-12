import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { classifyCiqualRow } from '../lib/nutrition/ciqual-classifier.mjs'

const DEFAULT_CSV_PATH = path.join(process.cwd(), 'data/nutrition/foods-import.csv')

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseArgs(argv) {
  const args = { file: DEFAULT_CSV_PATH, limit: null, maxExamples: 20 }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--file') args.file = path.resolve(process.cwd(), argv[++i])
    else if (arg === '--limit') args.limit = Number(argv[++i] ?? '0') || null
    else if (arg === '--max-examples') args.maxExamples = Number(argv[++i] ?? '20') || 20
  }
  return args
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(normalize(term)))
}

function hasWord(text, terms) {
  const normalized = ` ${normalize(text)} `
  return terms.some((term) => normalized.includes(` ${normalize(term)} `))
}

function hasPrefix(text, terms) {
  const normalized = normalize(text)
  return terms.some((term) => {
    const value = normalize(term)
    return normalized === value || normalized.startsWith(`${value} `)
  })
}

function isCompositeMeal(name, scope) {
  return hasAny(name, [
    'soupe',
    'bouillon',
    'potage',
    'veloute',
    'plat compose',
    'salade composee',
    'sandwich',
    'pizza',
    'quiche',
    'feuillete',
    'bouchee',
    'nem',
    'pate imperial',
    'burger',
    'wrap',
    'pate brisee',
    'pate sablee',
    'pate filo',
    'pate phyllo',
  ]) || hasAny(scope, ['plats composés', 'soupes', 'plats de viande', 'plats de poisson', 'plats de légumes'])
}

function isPureBaseCandidate(row, name, scope) {
  if (isCompositeMeal(name, scope)) return false
  if (hasAny(scope, ['aides culinaires', 'desserts lactés', 'charcuteries et assimilés', 'plats composés'])) return false
  if (hasAny(name, ['pate d amande', 'beurre de cacahuete', 'beurre de cacahuète', 'haricot beurre', 'courge doubeurre', 'courge spaghetti', 'pâte brisée', 'pate brisee', 'pâte sablée', 'pate sablee', 'pâte filo', 'pate filo', 'pâte phyllo', 'pate phyllo'])) return false
  if (hasPrefix(name, ['rhubarbe', 'figue de barbarie', 'polenta', 'semoule de ble dur', 'graine de couscous', 'gnocchi a la semoule', 'gnocchi à la semoule', 'gnocchi a la pomme de terre', 'gnocchi à la pomme de terre', 'gateau de semoule', 'gâteau de semoule'])) return false
  if (hasAny(name, ['fromage a pate', 'fromage à pate', 'fromage a pâte', 'fromage à pâte'])) return false
  if (hasAny(name, ['pop-corn', 'pop corn'])) return false
  if (hasAny(name, ['thonon', 'barquette', 'boisson au riz', 'marsala aux oeufs', 'marsala aux œufs', 'feta', 'fromage type feta', 'huile ou beurre de cacao', 'huile ou beurre de karite', 'huile ou beurre de karité'])) return false
  return true
}

const EXPECTED_RULES = [
  {
    id: 'animal-protein-name',
    category_l1: 'proteins',
    terms: [
      'abats', 'agneau', 'autruche', 'bavette', 'boeuf', 'bourguignon', 'canard', 'dinde', 'escalope',
      'jambon', 'lapin', 'mouton', 'poulet', 'porc', 'steak', 'veau', 'volaille',
    ],
    exclude: ['pomme', 'pois', 'huile', 'beurre de'],
    excludeIfComposite: true,
  },
  {
    id: 'fish-seafood-name',
    category_l1: 'proteins',
    category_l2: 'poissons',
    terms: [
      'anchois', 'anguille', 'araignee de mer', 'bar', 'brochet', 'cabillaud', 'calamar', 'colin',
      'crabe', 'crevette', 'dorade', 'eglefin', 'homard', 'huitre', 'langouste', 'maquereau',
      'merlan', 'morue', 'moule', 'poisson', 'saumon', 'sardine', 'seiche', 'thon', 'truite',
    ],
    exclude: ['barre', 'barres'],
    excludeIfComposite: true,
  },
  {
    id: 'egg-name',
    category_l1: 'proteins',
    category_l2: 'oeufs',
    terms: ['oeuf', 'oeufs', 'omelette'],
    exclude: [],
    excludeIfComposite: true,
  },
  {
    id: 'rice-name',
    category_l1: 'carbs',
    category_l2: 'cereales',
    terms: ['riz', 'rice'],
    exclude: ['huile', 'son de riz huile'],
    excludeIfComposite: true,
  },
  {
    id: 'pasta-name',
    category_l1: 'carbs',
    category_l2: 'cereales',
    terms: ['pates', 'spaghetti', 'macaroni', 'tagliatelle', 'penne', 'gnocchi', 'pasta'],
    exclude: ['pate a tartiner', 'pate de fruit', 'pate de foie', 'pates et terrines', 'fromage a pate', 'fromage à pâte', 'fromage a pate molle', 'fromage à pâte molle'],
    excludeIfComposite: true,
  },
  {
    id: 'bread-name',
    category_l1: 'carbs',
    category_l2: 'pain',
    terms: ['pain', 'baguette', 'biscotte', 'chapati', 'naan', 'tortilla', 'wrap'],
    exclude: ['pain de poisson', 'pain de viande'],
    excludeIfComposite: true,
  },
  {
    id: 'potato-name',
    category_l1: 'carbs',
    category_l2: 'fecules',
    terms: ['pomme de terre', 'patate', 'frite'],
    exclude: [],
    excludeIfComposite: true,
  },
  {
    id: 'legume-name',
    category_l1: 'carbs',
    category_l2: 'legumineuses',
    terms: ['haricot blanc', 'haricot rouge', 'lentille', 'pois casse', 'pois chiche', 'fève', 'feve', 'flageolet'],
    exclude: ['haricot vert'],
    excludeIfComposite: true,
  },
  {
    id: 'oil-name',
    category_l1: 'fats',
    category_l2: 'huiles',
    terms: ['huile'],
    exclude: ['à l huile', 'a l huile', 'à l huile', 'théonon', 'thonon', 'feta', 'beurre de cacao', 'beurre de karite', 'beurre de karité'],
    excludeIfComposite: true,
  },
  {
    id: 'butter-margarine-name',
    category_l1: 'fats',
    category_l2: 'autres-lipides',
    terms: ['beurre', 'margarine'],
    exclude: ['beurre de cacahuete', 'beurre de cacahuète'],
    excludeIfComposite: true,
  },
  {
    id: 'fruit-snack-exclusion',
    category_l1: 'extras',
    terms: ['biscuit', 'beignet', 'gateau', 'tarte'],
    includeAny: ['fruit', 'fruits'],
    exclude: [],
  },
]

function expectedFor(row) {
  const name = normalize(row.Aliments)
  const group = normalize(row.alim_ssgrp_nom_fr)
  const subgroup = normalize(row.alim_ssssgrp_nom_fr)
  const scope = `${group} ${subgroup} ${name}`

  if (!isPureBaseCandidate(row, name, scope)) return null

  for (const rule of EXPECTED_RULES) {
    if (rule.includeAny && !hasAny(scope, rule.includeAny)) continue
    if (!hasAny(name, rule.terms)) continue
    if (rule.exclude?.length && hasAny(name, rule.exclude)) continue
    if (rule.excludeIfComposite && isCompositeMeal(name, scope)) continue
    return rule
  }

  return null
}

function isSuspiciousMismatch(row, classified) {
  const name = normalize(row.Aliments)
  const group = normalize(row.alim_ssgrp_nom_fr)
  const scope = `${group} ${normalize(row.alim_ssssgrp_nom_fr)} ${name}`

  if (classified.category_l1 === 'extras' && classified.category_l2 === 'fast-food') return false
  if (hasAny(scope, ['salades composées', 'soupes', 'plats composés', 'plâts de viande', 'plats de poisson', 'plats de légumes'])) return false
  if (hasAny(name, ['oignon nouveau', 'tomate, séchée, à l huile', 'tomate sechee a l huile', 'hareng fumé à l huile', 'hareng fume a l huile'])) return false
  return true
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const rawCsv = fs.readFileSync(args.file, 'utf-8')
  const records = parse(rawCsv, { columns: true, skip_empty_lines: true, bom: true, trim: true })
  const rows = args.limit ? records.slice(0, args.limit) : records

  const issues = []
  const byCategory = new Map()
  const ruleHits = new Map()

  for (const row of rows) {
    if (!String(row.Aliments ?? '').trim()) continue
    const classified = classifyCiqualRow(row)
    const categoryKey = `${classified.category_l1}/${classified.category_l2}`
    byCategory.set(categoryKey, (byCategory.get(categoryKey) ?? 0) + 1)

    const expected = expectedFor(row)
    if (!expected) continue
    ruleHits.set(expected.id, (ruleHits.get(expected.id) ?? 0) + 1)

    const wrongL1 = expected.category_l1 && classified.category_l1 !== expected.category_l1
    const wrongL2 = expected.category_l2 && classified.category_l2 !== expected.category_l2
    if ((wrongL1 || wrongL2) && isSuspiciousMismatch(row, classified)) {
      issues.push({
        id: expected.id,
        name: row.Aliments,
        group: row.alim_ssgrp_nom_fr,
        subgroup: row.alim_ssssgrp_nom_fr,
        expected: `${expected.category_l1}${expected.category_l2 ? `/${expected.category_l2}` : ''}`,
        actual: categoryKey,
      })
    }
  }

  console.log(`Rows audited: ${rows.length}`)
  console.log(`Rule hits: ${Array.from(ruleHits.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ')}`)
  console.log(`Issues: ${issues.length}`)
  const byIssue = issues.reduce((acc, issue) => {
    acc[issue.id] = (acc[issue.id] ?? 0) + 1
    return acc
  }, {})
  Object.entries(byIssue).sort((a, b) => b[1] - a[1]).forEach(([id, count]) => {
    console.log(`  - ${id}: ${count}`)
  })

  if (issues.length > 0) {
    console.log('Examples:')
    issues.slice(0, args.maxExamples).forEach((issue) => {
      console.log(`  - [${issue.id}] ${issue.name} | ${issue.group} / ${issue.subgroup} | ${issue.actual} -> ${issue.expected}`)
    })
  }

  console.log('Top classified categories:')
  Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([key, count]) => console.log(`  - ${key}: ${count}`))

  if (issues.length > 0) process.exitCode = 1
}

main()
