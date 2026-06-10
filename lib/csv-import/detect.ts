// ─────────────────────────────────────────────────────────────────────────────
// CSV Import — Universal parser + auto-detection
// ─────────────────────────────────────────────────────────────────────────────

export interface TargetField {
  key: string
  label: string
  unit?: string
  description?: string
}

// All measurable fields we accept
export const TARGET_FIELDS: TargetField[] = [
  { key: 'weight_kg',      label: 'Poids',              unit: 'kg'   },
  { key: 'body_fat_pct',   label: '% Masse grasse',     unit: '%'    },
  { key: 'fat_mass_kg',    label: 'Masse grasse',        unit: 'kg'   },
  { key: 'muscle_mass_kg',  label: 'Masse musculaire squelettique', unit: 'kg' },
  { key: 'muscle_mass_pct', label: '% Masse musculaire',            unit: '%'  },
  { key: 'lean_mass_kg',    label: 'Masse maigre',                  unit: 'kg' },
  { key: 'body_water_pct', label: '% Masse hydrique',    unit: '%'    },
  { key: 'bone_mass_kg',   label: 'Masse osseuse',       unit: 'kg'   },
  { key: 'visceral_fat_level', label: 'Graisse viscérale', unit: 'niveau' },
  { key: 'metabolic_age',  label: 'Âge métabolique',     unit: 'ans'  },
  { key: 'bmr_kcal',       label: 'Métabolisme de base', unit: 'kcal' },
  { key: 'bmi',            label: 'IMC',                 unit: ''     },
  { key: 'waist_cm',       label: 'Tour de taille',      unit: 'cm'   },
  { key: 'hips_cm',        label: 'Tour de hanches',     unit: 'cm'   },
  { key: 'chest_cm',       label: 'Tour de poitrine',    unit: 'cm'   },
  { key: 'arm_cm',         label: 'Tour de bras',        unit: 'cm'   },
  { key: 'thigh_cm',       label: 'Tour de cuisse',      unit: 'cm'   },
  { key: 'calf_cm',        label: 'Tour de mollet',      unit: 'cm'   },
  { key: 'neck_cm',        label: 'Tour de cou',         unit: 'cm'   },
  { key: 'sleep_hours',    label: 'Heures de sommeil',   unit: 'h'    },
  { key: 'energy_level',   label: 'Énergie',             unit: '/10'  },
  { key: 'stress_level',   label: 'Stress',              unit: '/10'  },
]

// Synonyms used for fuzzy auto-detection (lowercased, accents stripped)
const SYNONYMS: Record<string, string[]> = {
  weight_kg:      ['poids', 'weight', 'masse corporelle', 'kg', 'bw', 'body weight', 'bodyweight', 'masse totale'],
  body_fat_pct:   ['% masse grasse', '% mg', 'masse grasse %', 'body fat', 'fat %', 'fat%', '% grasse', 'graisse %', 'mg%', '% gras'],
  fat_mass_kg:    ['kg masse grasse', 'masse grasse kg', 'fat mass', 'graisse kg', 'mg kg', 'fat kg'],
  muscle_mass_kg:  ['kg muscles', 'masse musculaire squelettique', 'muscle mass', 'skeletal muscle', 'smm', 'muscles kg', 'mm kg', 'smm kg'],
  muscle_mass_pct: ['% muscles', 'muscle %', '% musculaire', 'muscle pct', '% masse musculaire', 'smm %', '% smm'],
  lean_mass_kg:    ['masse maigre', 'lean mass', 'lbm', 'lean body mass', 'poids maigre', 'masse sans graisse', 'fat free mass', 'ffm'],
  body_water_pct: ['% hydrique', 'eau %', 'water %', '% eau', 'hydratation', 'body water', 'masse hydrique'],
  bone_mass_kg:   ['masse osseuse', 'bone mass', 'os kg', 'bone kg'],
  visceral_fat_level: ['graisse viscerale', 'visceral', 'gv', 'visceral fat', 'graisses viscerales', 'niveau visceral'],
  metabolic_age:  ['age metabolique', 'metabolic age', 'age meta', 'âge meta'],
  bmr_kcal:       ['bmr', 'metabolisme de base', 'basal metabolic', 'kcal bmr', 'mb kcal', 'bmr kcal', 'rer'],
  bmi:            ['imc', 'bmi', 'indice masse corporelle', 'body mass index'],
  waist_cm:       ['tour de taille', 'waist', 'taille cm', 'waist cm', 'abdomen', 'abdomen cm'],
  hips_cm:        ['tour de hanches', 'hanches', 'hips', 'hips cm'],
  chest_cm:       ['tour de poitrine', 'poitrine', 'chest', 'chest cm', 'thorax'],
  arm_cm:         ['tour de bras', 'bras', 'arm', 'arm cm', 'biceps cm'],
  thigh_cm:       ['tour de cuisse', 'cuisse', 'thigh', 'thigh cm'],
  calf_cm:        ['tour de mollet', 'mollet', 'calf', 'calf cm'],
  neck_cm:        ['tour de cou', 'cou', 'neck', 'neck cm'],
  sleep_hours:    ['sommeil', 'sleep', 'heures sommeil', 'sleep hours', 'nuit h'],
  energy_level:   ['energie', 'energy', 'niveau energie', 'energy level', 'vitalite'],
  stress_level:   ['stress', 'stress level', 'niveau stress'],
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreMatch(colNorm: string, fieldKey: string): number {
  const synonyms = SYNONYMS[fieldKey] ?? []
  for (const syn of synonyms) {
    const synNorm = normalize(syn)
    if (colNorm === synNorm) return 100          // exact match
    if (colNorm.includes(synNorm)) return 80     // col contains synonym
    if (synNorm.includes(colNorm)) return 70     // synonym contains col
  }
  // Partial word overlap
  const colWords = colNorm.split(' ').filter(w => w.length > 2)
  const synonymWords = synonyms.flatMap(s => normalize(s).split(' ')).filter(w => w.length > 2)
  const overlap = colWords.filter(w => synonymWords.includes(w)).length
  if (overlap > 0) return overlap * 20
  return 0
}

export interface ColMapping {
  csvColumn: string      // original column name from CSV
  fieldKey: string | null // matched TARGET_FIELDS key, null = ignored
  confidence: number     // 0–100
}

export function autoDetectMappings(columns: string[]): ColMapping[] {
  // First pass: score every column against every field
  const scored = columns.map(col => {
    const colNorm = normalize(col)
    let best: { key: string; score: number } | null = null
    for (const field of TARGET_FIELDS) {
      const score = scoreMatch(colNorm, field.key)
      if (score > 0 && (!best || score > best.score)) {
        best = { key: field.key, score }
      }
    }
    return {
      csvColumn: col,
      fieldKey: best && best.score >= 20 ? best.key : null,
      confidence: best?.score ?? 0,
    }
  })

  // Second pass: deduplicate — when two columns match the same fieldKey,
  // keep only the one with the highest confidence; the other gets fieldKey=null.
  const assigned = new Map<string, { idx: number; confidence: number }>()
  for (let i = 0; i < scored.length; i++) {
    const m = scored[i]
    if (m.fieldKey === null) continue
    const prev = assigned.get(m.fieldKey)
    if (!prev) {
      assigned.set(m.fieldKey, { idx: i, confidence: m.confidence })
    } else if (m.confidence > prev.confidence) {
      // Current column is a better match — demote the previous one
      scored[prev.idx] = { ...scored[prev.idx], fieldKey: null, confidence: 0 }
      assigned.set(m.fieldKey, { idx: i, confidence: m.confidence })
    } else {
      // Previous column is better — demote current one
      scored[i] = { ...scored[i], fieldKey: null, confidence: 0 }
    }
  }

  return scored
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV parsing
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedCsv {
  columns: string[]
  rows: string[][]    // raw string values, parallel to columns
  dateColumnIndex: number | null
}

function detectSeparator(lines: string[]): ',' | ';' | '\t' {
  const sample = lines.slice(0, 5).join('\n')
  const counts = {
    ',': (sample.match(/,/g) ?? []).length,
    ';': (sample.match(/;/g) ?? []).length,
    '\t': (sample.match(/\t/g) ?? []).length,
  }
  if (counts[';'] > counts[','] && counts[';'] > counts['\t']) return ';'
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t'
  return ','
}

function parseLine(line: string, sep: string): string[] {
  const cols: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      cols.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cols.push(current.trim())
  return cols
}

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,            // ISO: 2026-01-15
  /^\d{2}\/\d{2}\/\d{4}$/,          // FR: 15/01/2026
  /^\d{2}-\d{2}-\d{4}$/,            // FR dash: 15-01-2026
  /^\d{2}\.\d{2}\.\d{4}$/,          // EU dot: 15.01.2026
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,    // US short: 1/15/26
]

function looksLikeDate(val: string): boolean {
  const v = val.trim()
  return DATE_PATTERNS.some(p => p.test(v))
}

function parseFlexibleDate(val: string): Date | null {
  const v = val.trim()
  // ISO with optional time: 2026-01-15 or 2026-01-15 13:30
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v.replace(' ', 'T'))
    return isNaN(d.getTime()) ? null : d
  }
  // DD/MM/YYYY HH:MM or DD/MM/YYYY (also handles - and . separators)
  const m = v.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/)
  if (m) {
    let year = parseInt(m[3])
    if (year < 100) year += 2000
    const dateStr = `${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
    const timeStr = m[4] ? `T${m[4].padStart(5, '0')}` : 'T00:00'
    const d = new Date(`${dateStr}${timeStr}`)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function parseFlexibleNumber(raw: string): number | null {
  if (!raw || raw.trim() === '') return null
  const cleaned = raw.replace(/%/g, '').replace(/,/g, '.').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function looksLikeTime(val: string): boolean {
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(val.trim())
}

export function parseCsvText(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length < 2) return { columns: [], rows: [], dateColumnIndex: null }

  const sep = detectSeparator(lines)

  // ── Step 1: find the header row ──────────────────────────────────────────
  // Strategy: scan first 8 lines, pick the one with the most non-numeric cells.
  // Also detect consecutive header rows (multi-row headers) and merge them.
  let headerIdx = 0
  let maxTextCols = 0
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const cells = parseLine(lines[i], sep)
    const textCols = cells.filter(c => {
      const v = c.trim()
      return v.length > 0 && isNaN(parseFloat(v.replace(',', '.'))) && !looksLikeDate(v)
    }).length
    if (textCols > maxTextCols) {
      maxTextCols = textCols
      headerIdx = i
    }
  }

  // Check if next line is also a header (sub-header / unit row)
  // Heuristic: next line has many text cells AND no date-like cell
  let dataStartIdx = headerIdx + 1
  const nextCells = parseLine(lines[headerIdx + 1] ?? '', sep)
  const nextTextCols = nextCells.filter(c => {
    const v = c.trim()
    return v.length > 0 && isNaN(parseFloat(v.replace(',', '.'))) && !looksLikeDate(v)
  }).length
  const nextHasDate = nextCells.some(c => looksLikeDate(c.trim()))

  // Build column labels: merge header rows if needed
  let rawHeaders = parseLine(lines[headerIdx], sep)
  if (nextTextCols >= 2 && !nextHasDate) {
    // Merge sub-header: append non-empty sub-labels to parent label
    const subHeaders = parseLine(lines[headerIdx + 1], sep)
    rawHeaders = rawHeaders.map((h, i) => {
      const sub = (subHeaders[i] ?? '').replace(/"/g, '').trim()
      const base = h.replace(/"/g, '').trim()
      if (sub && sub !== base && base === '') return sub
      if (sub && sub !== base && sub.length > 0) return `${base} ${sub}`.trim()
      return base
    })
    dataStartIdx = headerIdx + 2
  }

  const columns = rawHeaders.map(h => h.replace(/"/g, '').trim())
  // Keep columns array full-width (including empty-named cols) so indices stay correct
  const colCount = columns.length

  // ── Step 2: parse data rows ───────────────────────────────────────────────
  const rows: string[][] = []
  for (let i = dataStartIdx; i < lines.length; i++) {
    const cells = parseLine(lines[i], sep)
    // Pad or trim to colCount
    while (cells.length < colCount) cells.push('')
    const row = cells.slice(0, colCount)
    if (row.every(c => c === '')) continue
    const nonEmpty = row.filter(c => c.trim() !== '').length
    if (nonEmpty / colCount < 0.15) continue
    rows.push(row)
  }

  // ── Step 3: detect date column ────────────────────────────────────────────
  // Find column with highest proportion of date-like values (among non-empty)
  let dateColumnIndex: number | null = null
  let bestDateRatio = 0
  for (let c = 0; c < colCount; c++) {
    const vals = rows.map(r => r[c] ?? '').filter(v => v.trim() !== '')
    if (vals.length === 0) continue
    const dateLike = vals.filter(v => looksLikeDate(v)).length
    const ratio = dateLike / vals.length
    if (ratio > bestDateRatio && ratio >= 0.4) {
      bestDateRatio = ratio
      dateColumnIndex = c
    }
  }

  // ── Step 4: detect time column adjacent to date column ────────────────────
  // If found, merge date+time into a synthetic column for precision
  let timeColumnIndex: number | null = null
  if (dateColumnIndex !== null) {
    for (const offset of [1, -1]) {
      const tc = dateColumnIndex + offset
      if (tc < 0 || tc >= colCount) continue
      const vals = rows.map(r => r[tc] ?? '').filter(v => v.trim() !== '')
      const timeLike = vals.filter(v => looksLikeTime(v)).length
      if (timeLike / Math.max(vals.length, 1) >= 0.4) {
        timeColumnIndex = tc
        break
      }
    }
  }

  // Merge time into date values for all rows if both columns found
  if (dateColumnIndex !== null && timeColumnIndex !== null) {
    for (const row of rows) {
      const d = row[dateColumnIndex]?.trim()
      const t = row[timeColumnIndex]?.trim()
      if (d && t && looksLikeDate(d) && looksLikeTime(t)) {
        row[dateColumnIndex] = `${d} ${t}`
      }
    }
  }

  return { columns, rows, dateColumnIndex }
}

export interface PreviewRow {
  date: string | null
  parsedDate: Date | null
  values: Record<string, number | null>  // fieldKey → value
}

export function buildPreview(
  parsed: ParsedCsv,
  mappings: ColMapping[]
): PreviewRow[] {
  const { columns, rows, dateColumnIndex } = parsed

  const activeMappings = mappings.filter(m => m.fieldKey !== null)

  const today = new Date()

  return rows.map(row => {
    let date: string | null = null
    let parsedDate: Date | null = null
    if (dateColumnIndex !== null) {
      const raw = row[dateColumnIndex] ?? ''
      date = raw || null
      parsedDate = raw ? parseFlexibleDate(raw) : null
    }
    // If no date column or date failed to parse, fall back to today
    if (!parsedDate) {
      parsedDate = today
      date = today.toISOString().split('T')[0]
    }

    const values: Record<string, number | null> = {}
    for (const mapping of activeMappings) {
      const colIdx = columns.indexOf(mapping.csvColumn)
      if (colIdx === -1) continue
      const raw = row[colIdx] ?? ''
      values[mapping.fieldKey!] = parseFlexibleNumber(raw)
    }

    return { date, parsedDate, values }
  }).filter(r => Object.values(r.values).some(v => v !== null))
}
