import { buildCheckinReadyMetadata } from '@/lib/client/checkin/resolveClientTimezone'
import { resolveTone } from '@/lib/client/ai-coach/resolveTone'
import {
  composeMorningGreeting,
  composeEveningGreeting,
  composeEveningReminder,
} from '@/lib/client/ai-coach/messageComposer'
import { canonicalizeFields } from '@/lib/client/checkin/legacyFieldMap'
import { getFieldsForFlow } from '@/lib/client/checkin/fieldRegistry'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

export type AiRoutineFlow = 'morning' | 'evening'

export type RoutineCheckinContext = {
  enabled: boolean
  fields?: string[]
}

export type RoutineMessageInput = {
  flowType: AiRoutineFlow
  lang: ClientLang
  firstName?: string | null
  tone?: string | null
  globalTone?: string | null
  hasTrainingToday?: boolean
  trainingName?: string | null
  checkin?: RoutineCheckinContext
}

/** Natural-language reminder that primes tomorrow's first waking action (D6). */
export function buildMorningPreparationReminder(lang: ClientLang, fields?: string[]): string {
  const enabled = canonicalizeFields(fields ?? [])
  const morningFields = enabled.length > 0
    ? enabled
    : getFieldsForFlow('morning').map((f) => f.key)
  return composeEveningReminder({ tone: 'neutre', lang, enabledMorningFields: morningFields })
}

export function buildRoutineMessage(input: RoutineMessageInput): {
  content: string
  metadata: Record<string, unknown> | null
} {
  const tone = resolveTone(input.tone ?? null, input.globalTone ?? null)
  const checkinEnabled = input.checkin?.enabled ?? false
  const fields = canonicalizeFields(input.checkin?.fields ?? [])
  const name = input.firstName?.trim() ?? ''

  const metadata = checkinEnabled
    ? buildCheckinReadyMetadata(input.flowType, input.lang, input.firstName, {
      hasTrainingToday: input.hasTrainingToday,
      trainingName: input.trainingName,
    }, { tone: input.tone, globalTone: input.globalTone, enabledFields: input.checkin?.fields })
    : null

  if (input.flowType === 'morning') {
    const content = checkinEnabled
      ? composeMorningGreeting({
        name,
        lang: input.lang,
        tone,
        enabledFields: fields,
        hasTrainingToday: Boolean(input.hasTrainingToday),
        trainingName: input.trainingName ?? null,
      })
      : standaloneMorning(name, tone, input.lang, Boolean(input.hasTrainingToday), input.trainingName ?? null)
    return { content, metadata }
  }

  const eveningGreeting = checkinEnabled
    ? composeEveningGreeting({
      name,
      lang: input.lang,
      tone,
      enabledEveningFields: fields,
      hasTrainingToday: Boolean(input.hasTrainingToday),
      trainingName: input.trainingName ?? null,
    })
    : standaloneEvening(name, tone, input.lang, Boolean(input.hasTrainingToday), input.trainingName ?? null)

  const reminder = buildMorningPreparationReminder(
    input.lang,
    getFieldsForFlow('morning').map((f) => f.key),
  )
  return { content: `${eveningGreeting}\n\n${reminder}`, metadata }
}

function standaloneMorning(
  name: string,
  tone: ReturnType<typeof resolveTone>,
  lang: ClientLang,
  hasTrainingToday: boolean,
  trainingName: string | null,
): string {
  const greeting = composeMorningGreeting({
    name, tone, lang, enabledFields: [], hasTrainingToday, trainingName,
  })
  return greeting
    .split('\n')
    .map((line) => line === (
      lang === 'es'
        ? '¿Quieres que lancemos tu check-in de mañana?'
        : lang === 'en'
          ? 'Do you want to start your morning check-in?'
          : 'Tu veux qu’on lance ton check-in du matin ?'
    )
      ? (
        lang === 'es'
          ? 'Si tienes una pregunta o algo que señalarme, escríbelo aquí.'
          : lang === 'en'
            ? 'If you have a question or something to tell me, write it here.'
            : 'Si tu as une question ou quelque chose à me signaler, écris-le ici.'
      )
      : line)
    .filter(Boolean)
    .join('\n')
}

function standaloneEvening(
  name: string,
  tone: ReturnType<typeof resolveTone>,
  lang: ClientLang,
  hasTrainingToday: boolean,
  trainingName: string | null,
): string {
  const greeting = composeEveningGreeting({
    name, tone, lang, enabledEveningFields: [], hasTrainingToday, trainingName,
  })
  return greeting.replace(
    lang === 'es'
      ? '¿Listo para tu check-in de noche?'
      : lang === 'en'
        ? 'Ready for your evening check-in?'
        : 'Prêt pour ton check-in du soir ?',
    lang === 'es'
      ? 'Si tienes un comentario importante sobre hoy, déjalo aquí.'
      : lang === 'en'
        ? 'If you have an important comment about today, leave it here.'
        : 'Si tu as un commentaire important pour aujourd’hui, laisse-le ici.',
  )
}
