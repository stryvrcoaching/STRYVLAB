import { getCatalogEntryByName } from '@/lib/programs/intelligence/catalog-utils'

function normalizeExerciseName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function getExerciseHistoryKeys(exerciseName: string): string[] {
  const trimmedName = exerciseName.trim()
  if (!trimmedName) return []

  const keys = new Set<string>()
  const catalogEntry = getCatalogEntryByName(trimmedName)
  if (catalogEntry?.slug) {
    keys.add(`catalog:${catalogEntry.slug}`)
  }

  const normalizedName = normalizeExerciseName(trimmedName)
  if (normalizedName) {
    keys.add(`name:${normalizedName}`)
  }

  return [...keys]
}

export function resolveCanonicalExerciseKey(exerciseName: string): string {
  return getExerciseHistoryKeys(exerciseName)[0] ?? `name:${normalizeExerciseName(exerciseName)}`
}

export function resolveCanonicalExerciseName(exerciseName: string): string {
  return getCatalogEntryByName(exerciseName)?.name ?? exerciseName.trim()
}

export function indexExerciseHistoryEntry<TEntry>(
  index: Record<string, TEntry[]>,
  exerciseName: string,
  entry: TEntry,
) {
  for (const key of getExerciseHistoryKeys(exerciseName)) {
    if (!index[key]) index[key] = []
    index[key].push(entry)
  }
}

export function getExerciseHistoryEntries<TEntry>(
  index: Record<string, TEntry[]>,
  exerciseName: string,
): TEntry[] {
  const merged: TEntry[] = []
  const seen = new Set<TEntry>()

  for (const key of getExerciseHistoryKeys(exerciseName)) {
    for (const entry of index[key] ?? []) {
      if (seen.has(entry)) continue
      seen.add(entry)
      merged.push(entry)
    }
  }

  return merged
}
