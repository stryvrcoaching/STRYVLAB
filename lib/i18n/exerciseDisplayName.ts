import type { ClientLang } from '@/lib/i18n/clientTranslations'
import type { SupabaseClient } from '@supabase/supabase-js'

// The catalogue was historically authored in French. These fallbacks keep the
// client-facing programme readable while database translations are incomplete.
const SPANISH_EXERCISE_NAMES: Record<string, string> = {
  'Crunch poulie haute': 'Crunch en polea alta',
  'Flexions des obliques banc lombaire 45': 'Flexiones de oblicuos en banco lumbar a 45°',
  'Releve jambes chaise romaine': 'Elevación de piernas en silla romana',
  'Extension hanche poulie basse': 'Extensión de cadera en polea baja',
  'Extension lombaire avec élastique': 'Extensión lumbar con banda elástica',
  'Hack squat': 'Sentadilla Hack',
  'Leg curl allongé': 'Curl femoral tumbado',
  'Leg extension': 'Extensión de piernas',
}

export function getClientExerciseDisplayName(name: string, lang: ClientLang): string {
  if (lang !== 'es') return name
  return SPANISH_EXERCISE_NAMES[name] ?? name
}

export type ExerciseTranslationRow = {
  exerciseId: string
  name: string
}

export type ExerciseNameResolver = (sourceName: string, catalogId?: string | null) => string

/**
 * Resolves the label shown to a client. The database can use either the
 * catalogue ID or the legacy French exercise name while the migration finishes.
 */
export function createExerciseNameResolver(
  lang: ClientLang,
  rows: ExerciseTranslationRow[],
): ExerciseNameResolver {
  const translations = new Map(
    rows
      .filter((row) => row.exerciseId?.trim() && row.name?.trim())
      .map((row) => [row.exerciseId.trim(), row.name.trim()]),
  )

  return (sourceName, catalogId) => {
    const translated = (catalogId ? translations.get(catalogId) : null)
      ?? translations.get(sourceName)
    return translated ?? getClientExerciseDisplayName(sourceName, lang)
  }
}

export async function loadExerciseNameResolver(
  db: SupabaseClient,
  lang: ClientLang,
): Promise<ExerciseNameResolver> {
  if (lang === 'fr') return (name) => name

  const { data } = await db
    .from('exercise_translations')
    .select('exerciseId, name')
    .eq('lang', lang.toUpperCase())

  return createExerciseNameResolver(lang, (data ?? []) as ExerciseTranslationRow[])
}
