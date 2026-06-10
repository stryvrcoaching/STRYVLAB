import { buildCheckinReadyMetadata } from '@/lib/client/checkin/resolveClientTimezone'
import { resolveTone } from '@/lib/client/ai-coach/resolveTone'
import {
  composeMorningGreeting,
  composeEveningGreeting,
  composeEveningReminder,
} from '@/lib/client/ai-coach/messageComposer'
import { canonicalizeFields } from '@/lib/client/checkin/legacyFieldMap'
import { getFieldsForFlow } from '@/lib/client/checkin/fieldRegistry'

export type AiRoutineFlow = 'morning' | 'evening'

export type RoutineCheckinContext = {
  enabled: boolean
  fields?: string[]
}

export type RoutineMessageInput = {
  flowType: AiRoutineFlow
  firstName?: string | null
  tone?: string | null
  globalTone?: string | null
  hasTrainingToday?: boolean
  trainingName?: string | null
  checkin?: RoutineCheckinContext
}

/** Natural-language reminder that primes tomorrow's first waking action (D6). */
export function buildMorningPreparationReminder(fields?: string[]): string {
  const enabled = canonicalizeFields(fields ?? [])
  const morningFields = enabled.length > 0
    ? enabled
    : getFieldsForFlow('morning').map((f) => f.key)
  return composeEveningReminder({ tone: 'neutre', enabledMorningFields: morningFields })
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
    ? buildCheckinReadyMetadata(input.flowType, input.firstName, {
      hasTrainingToday: input.hasTrainingToday,
      trainingName: input.trainingName,
    }, { tone: input.tone, globalTone: input.globalTone, enabledFields: input.checkin?.fields })
    : null

  if (input.flowType === 'morning') {
    const content = checkinEnabled
      ? composeMorningGreeting({
        name,
        tone,
        enabledFields: fields,
        hasTrainingToday: Boolean(input.hasTrainingToday),
        trainingName: input.trainingName ?? null,
      })
      : standaloneMorning(name, tone, Boolean(input.hasTrainingToday), input.trainingName ?? null)
    return { content, metadata }
  }

  const eveningGreeting = checkinEnabled
    ? composeEveningGreeting({
      name,
      tone,
      enabledEveningFields: fields,
      hasTrainingToday: Boolean(input.hasTrainingToday),
      trainingName: input.trainingName ?? null,
    })
    : standaloneEvening(name, tone, Boolean(input.hasTrainingToday), input.trainingName ?? null)

  const reminder = buildMorningPreparationReminder(
    getFieldsForFlow('morning').map((f) => f.key),
  )
  return { content: `${eveningGreeting}\n\n${reminder}`, metadata }
}

function standaloneMorning(
  name: string,
  tone: ReturnType<typeof resolveTone>,
  hasTrainingToday: boolean,
  trainingName: string | null,
): string {
  const greeting = composeMorningGreeting({
    name, tone, enabledFields: [], hasTrainingToday, trainingName,
  })
  return greeting
    .split('\n')
    .map((line) => line === 'Prêt pour ton check-in du matin ?'
      ? 'Si tu as une question ou quelque chose à me signaler, écris-le ici.'
      : line)
    .filter(Boolean)
    .join('\n')
}

function standaloneEvening(
  name: string,
  tone: ReturnType<typeof resolveTone>,
  hasTrainingToday: boolean,
  trainingName: string | null,
): string {
  const greeting = composeEveningGreeting({
    name, tone, enabledEveningFields: [], hasTrainingToday, trainingName,
  })
  return greeting.replace('Prêt pour ton check-in du soir ?', 'Si tu as un commentaire important pour aujourd’hui, laisse-le ici.')
}
