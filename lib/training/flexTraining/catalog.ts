import exerciseCatalog from '@/data/exercise-catalog.json'

const DEFAULT_EXERCISE_MEDIA_URL = '/bibliotheque_exercices/_placeholders/exercice-sans-media.svg'
const UUIDISH_NAME_RE = /^[0-9a-f]{8}(?:[ -][0-9a-f]{4}){3}[ -][0-9a-f]{12}$/i

type CatalogEntry = {
  id: string
  name: string
  gifUrl?: string
  movementPattern?: string | null
  equipment?: string[]
  isCompound?: boolean
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
}

const catalog = exerciseCatalog as CatalogEntry[]

export function resolveCatalogExerciseName(exerciseId: string | null | undefined): string | null {
  if (!exerciseId) return null
  const name = catalog.find(entry => entry.id === exerciseId)?.name?.trim() ?? null
  if (!name || UUIDISH_NAME_RE.test(name)) return null
  return name
}

export function resolveCatalogExerciseMuscles(exerciseId: string | null | undefined): string[] {
  if (!exerciseId) return []
  const entry = catalog.find(item => item.id === exerciseId)
  if (!entry) return []
  return Array.from(new Set([...(entry.primaryMuscles ?? []), ...(entry.secondaryMuscles ?? [])]))
}

export function resolveCatalogExerciseMeta(exerciseId: string | null | undefined) {
  if (!exerciseId) return null
  const entry = catalog.find(item => item.id === exerciseId)
  if (!entry) return null

  return {
    name: entry.name,
    image_url: entry.gifUrl?.trim() ? entry.gifUrl : DEFAULT_EXERCISE_MEDIA_URL,
    movement_pattern: entry.movementPattern ?? null,
    equipment: entry.equipment ?? [],
    is_compound: entry.isCompound ?? false,
    unilateral: entry.unilateral ?? false,
    primary_muscles: entry.primaryMuscles ?? [],
    secondary_muscles: entry.secondaryMuscles ?? [],
    muscle_groups: Array.from(new Set([...(entry.primaryMuscles ?? []), ...(entry.secondaryMuscles ?? [])])),
  }
}
