import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveTone } from '@/lib/client/ai-coach/resolveTone'
import { composeMorningGreeting, composeEveningGreeting } from '@/lib/client/ai-coach/messageComposer'
import { canonicalizeFields } from '@/lib/client/checkin/legacyFieldMap'
import type { ClientLang } from '@/lib/i18n/clientTranslations'
import { buildCheckinReadyCopy } from '@/lib/client/checkin/flows'

const DEFAULT_TZ = 'Europe/Paris'

export type CheckinReadyContext = {
  hasTrainingToday?: boolean
  trainingName?: string | null
}

export type CheckinReadyOptions = {
  /** Per-client tone (coach_ai_settings_per_client.ai_tone). */
  tone?: string | null
  /** Global coach tone (coach_profiles.ai_tone). */
  globalTone?: string | null
  /** Configured check-in fields for this flow (canonical or legacy keys). */
  enabledFields?: string[]
}

/** Client timezone from coach_clients, else daily_checkin_schedules, else default. */
export async function resolveClientTimezone(
  db: SupabaseClient,
  clientId: string,
): Promise<string> {
  const { data: client } = await db
    .from('coach_clients')
    .select('timezone')
    .eq('id', clientId)
    .maybeSingle()

  const clientTimezone = (client as { timezone?: string } | null)?.timezone
  if (clientTimezone && clientTimezone.length > 0) return clientTimezone

  const { data } = await db
    .from('daily_checkin_schedules')
    .select('timezone')
    .eq('client_id', clientId)
    .limit(1)
    .maybeSingle()

  const tz = (data as { timezone?: string } | null)?.timezone
  if (tz && tz.length > 0) return tz
  return DEFAULT_TZ
}

export function buildCheckinReadyMetadata(
  flowType: 'morning' | 'evening',
  lang: ClientLang,
  firstName?: string | null,
  context?: CheckinReadyContext,
  options?: CheckinReadyOptions,
): Record<string, unknown> {
  const name = firstName?.trim() ? firstName.trim() : ''
  const tone = resolveTone(options?.tone ?? null, options?.globalTone ?? null)
  const enabledFields = canonicalizeFields(options?.enabledFields ?? [])

  const greeting = flowType === 'morning'
    ? composeMorningGreeting({
      name,
      lang,
      tone,
      enabledFields,
      hasTrainingToday: Boolean(context?.hasTrainingToday),
      trainingName: context?.trainingName ?? null,
    })
    : composeEveningGreeting({
      name,
      lang,
      tone,
      enabledEveningFields: enabledFields,
      hasTrainingToday: Boolean(context?.hasTrainingToday),
      trainingName: context?.trainingName ?? null,
    })

  const readyCopy = buildCheckinReadyCopy(lang, flowType)

  return {
    greeting,
    flow_type: flowType,
    component: 'chips',
    key: 'checkin_ready',
    question: readyCopy.question,
    options: [
      { label: readyCopy.yes, value: 1 },
      { label: readyCopy.later, value: 2 },
    ],
    defer_message: readyCopy.deferMessage,
    answered: false,
    deferred_until: null as string | null,
  }
}

export function isCheckinDeferred(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false
  const until = metadata.deferred_until
  if (typeof until !== 'string' || !until) return false
  return new Date(until).getTime() > Date.now()
}
