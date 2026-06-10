export type CheckinFlow = 'morning' | 'evening'

export type CheckinFieldKey =
  | 'rhr_morning'
  | 'sleep_hours'
  | 'sleep_quality'
  | 'energy_level'
  | 'weight_kg'
  | 'stress_level'
  | 'muscle_soreness'
  | 'hunger_level'
  | 'daily_steps'

export type CheckinFieldDef = {
  key: CheckinFieldKey
  dbColumn: string
  flows: CheckinFlow[]
  label: string
  /** Order of the first action on waking (D6). null when not a morning action. */
  wakingPriority: number | null
  unit?: string
  scale?: { min: number; max: number; labels?: Record<number, string> }
}

/** Single source of truth for every check-in field. */
export const CHECKIN_FIELDS: CheckinFieldDef[] = [
  { key: 'rhr_morning',     dbColumn: 'rhr_morning',     flows: ['morning'],            label: 'ta fréquence cardiaque au repos', wakingPriority: 1, unit: 'bpm' },
  { key: 'sleep_hours',     dbColumn: 'sleep_hours',     flows: ['morning'],            label: 'ta durée de sommeil',             wakingPriority: 2, unit: 'h' },
  { key: 'sleep_quality',   dbColumn: 'sleep_quality',   flows: ['morning'],            label: 'ta qualité de sommeil',           wakingPriority: 3, scale: { min: 1, max: 4 } },
  { key: 'energy_level',    dbColumn: 'energy_level',    flows: ['morning', 'evening'], label: 'ton énergie',                     wakingPriority: 4, scale: { min: 1, max: 5 } },
  { key: 'weight_kg',       dbColumn: 'weight_kg',       flows: ['morning'],            label: 'ton poids',                       wakingPriority: 5, unit: 'kg' },
  { key: 'stress_level',    dbColumn: 'stress_level',    flows: ['evening'],            label: 'ton stress',                      wakingPriority: null, scale: { min: 1, max: 5 } },
  { key: 'muscle_soreness', dbColumn: 'muscle_soreness', flows: ['evening'],            label: 'tes courbatures',                 wakingPriority: null, scale: { min: 1, max: 4 } },
  { key: 'hunger_level',    dbColumn: 'hunger_level',    flows: ['evening'],            label: 'ta faim',                         wakingPriority: null, scale: { min: 1, max: 4 } },
  { key: 'daily_steps',     dbColumn: 'daily_steps',     flows: ['evening'],            label: 'tes pas',                         wakingPriority: null, unit: 'pas' },
]

const BY_KEY = new Map<string, CheckinFieldDef>(CHECKIN_FIELDS.map((f) => [f.key, f]))

export function getFieldDef(key: string): CheckinFieldDef | undefined {
  return BY_KEY.get(key)
}

export function getFieldsForFlow(flow: CheckinFlow): CheckinFieldDef[] {
  return CHECKIN_FIELDS.filter((f) => f.flows.includes(flow))
}

/** Sort a set of field keys by waking priority (D6); unknown/non-morning keys go last. */
export function orderedByWaking(keys: string[]): CheckinFieldDef[] {
  return keys
    .map((k) => BY_KEY.get(k))
    .filter((f): f is CheckinFieldDef => Boolean(f))
    .sort((a, b) => (a.wakingPriority ?? 999) - (b.wakingPriority ?? 999))
}
