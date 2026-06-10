import { getFieldDef, type CheckinFieldKey } from '@/lib/client/checkin/fieldRegistry'

const LEGACY_TO_CANONICAL: Record<string, CheckinFieldKey> = {
  sleep_duration: 'sleep_hours',
  energy: 'energy_level',
  energy_evening: 'energy_level',
  stress: 'stress_level',
  mood: 'stress_level', // D14
}

/** Returns the canonical key, or undefined if unknown. */
export function canonicalizeFieldKey(key: string): CheckinFieldKey | undefined {
  if (getFieldDef(key)) return key as CheckinFieldKey
  return LEGACY_TO_CANONICAL[key]
}

/** Map a list of (possibly legacy) keys to canonical, dropping unknowns and deduping (stable order). */
export function canonicalizeFields(keys: string[]): CheckinFieldKey[] {
  const out: CheckinFieldKey[] = []
  for (const k of keys) {
    const canon = canonicalizeFieldKey(k)
    if (canon && !out.includes(canon)) out.push(canon)
  }
  return out
}
