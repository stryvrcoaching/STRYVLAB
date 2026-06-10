import type { SupabaseClient } from '@supabase/supabase-js'
import type { WeekdayKind } from '@/lib/nutrition/training-week-schedule'

export type DayOverrideKind = 'off'
export type EffectiveDayKind =
  | 'training'
  | 'rest'
  | 'rest_with_activity'
  | 'off_override'
  | 'undefined'

export type ClientDayOverride = {
  id?: string
  client_id: string
  date: string
  kind: DayOverrideKind
  source: 'session_skip'
  linked_program_session_id?: string | null
  linked_skip_id?: string | null
  created_at?: string
}

export function resolveEffectiveDayKind(args: {
  weekdayKind: WeekdayKind | null | undefined
  overrideKind: DayOverrideKind | null | undefined
}): EffectiveDayKind {
  if (args.overrideKind === 'off') return 'off_override'
  if (args.weekdayKind === 'training') return 'training'
  if (args.weekdayKind === 'rest') return 'rest'
  if (args.weekdayKind === 'rest_with_activity') return 'rest_with_activity'
  return 'undefined'
}

export function toNutritionWeekdayKind(kind: EffectiveDayKind): WeekdayKind {
  if (kind === 'training') return 'training'
  if (kind === 'rest_with_activity') return 'rest_with_activity'
  return 'rest'
}

export async function fetchClientDayOverride(
  db: SupabaseClient,
  clientId: string,
  date: string,
): Promise<ClientDayOverride | null> {
  const { data, error } = await db
    .from('client_day_overrides')
    .select('id, client_id, date, kind, source, linked_program_session_id, linked_skip_id, created_at')
    .eq('client_id', clientId)
    .eq('date', date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as ClientDayOverride
}
