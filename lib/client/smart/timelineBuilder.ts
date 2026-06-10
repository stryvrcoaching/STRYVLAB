import { groupWaterByTimeOfDay, type WaterLog } from './waterAggregation'

export type TimelineKind = 'meal' | 'water' | 'workout' | 'activity' | 'checkin'

export type TimelineEntry = {
  id: string
  kind: TimelineKind
  start_iso: string
  title: string
  subtitle: string
  href?: string
  meta?: Record<string, unknown>
}

export type MealRow = {
  id: string
  logged_at: string
  title: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export type SessionSummary = {
  id: string
  completed_at: string
  title: string
  duration_min: number
  exercises_count: number
}

export type ActivityRow = {
  id: string
  started_at: string
  activity_type: 'running' | 'cycling' | 'swimming' | 'walking' | 'team_sport' | 'other'
  custom_label?: string | null
  duration_min: number
  intensity: number
}

export type CheckinRow = {
  id: string
  logged_at: string
  sleep_h?: number | null
  energy?: number | null
  stress?: number | null
}

export type TimelineSource = {
  meals: MealRow[]
  waterLogs: WaterLog[]
  session: SessionSummary | null
  activities: ActivityRow[]
  checkins: CheckinRow[]
}

const ACTIVITY_LABEL: Record<ActivityRow['activity_type'], string> = {
  running: 'Course',
  cycling: 'Vélo',
  swimming: 'Natation',
  walking: 'Marche',
  team_sport: 'Sport collectif',
  other: 'Activité',
}

const SLOT_REPRESENTATIVE_SUFFIX: Record<'morning' | 'midday' | 'afternoon' | 'evening', string> = {
  morning: 'T08:00:00Z',
  midday: 'T13:00:00Z',
  afternoon: 'T16:00:00Z',
  evening: 'T20:00:00Z',
}

const SLOT_LABEL: Record<'morning' | 'midday' | 'afternoon' | 'evening', string> = {
  morning: 'Hydratation matin',
  midday: 'Hydratation midi',
  afternoon: 'Hydratation après-midi',
  evening: 'Hydratation soir',
}

export function buildTimeline(src: TimelineSource, tz: string = 'Europe/Paris'): TimelineEntry[] {
  const entries: TimelineEntry[] = []

  // Meals
  for (const m of src.meals) {
    entries.push({
      id: m.id,
      kind: 'meal',
      start_iso: m.logged_at,
      title: m.title,
      subtitle: `${m.kcal} kcal · ${m.protein_g}P ${m.carbs_g}G ${m.fat_g}L`,
      href: `/client/nutrition/journal#${m.id}`,
    })
  }

  // Water aggregated by time of day
  if (src.waterLogs.length > 0) {
    const grouped = groupWaterByTimeOfDay(src.waterLogs, tz)
    const dateRef = src.waterLogs[0].logged_at.slice(0, 10)
    for (const slot of ['morning', 'midday', 'afternoon', 'evening'] as const) {
      const ml = grouped[slot]
      if (ml > 0) {
        entries.push({
          id: `water-${slot}`,
          kind: 'water',
          start_iso: `${dateRef}${SLOT_REPRESENTATIVE_SUFFIX[slot]}`,
          title: SLOT_LABEL[slot],
          subtitle: `${ml} ml`,
        })
      }
    }
  }

  // Session
  if (src.session) {
    entries.push({
      id: src.session.id,
      kind: 'workout',
      start_iso: src.session.completed_at,
      title: src.session.title,
      subtitle: `${src.session.exercises_count} exercices · ${src.session.duration_min} min`,
      href: `/client/programme/recap/${src.session.id}`,
    })
  }

  // Activities
  for (const a of src.activities) {
    entries.push({
      id: a.id,
      kind: 'activity',
      start_iso: a.started_at,
      title: a.custom_label?.trim() || ACTIVITY_LABEL[a.activity_type],
      subtitle: `${a.duration_min} min · intensité ${a.intensity}/10`,
    })
  }

  // Checkins
  for (const c of src.checkins) {
    const parts: string[] = []
    if (c.sleep_h != null) parts.push(`${c.sleep_h}h sommeil`)
    if (c.energy != null) parts.push(`énergie ${c.energy}/10`)
    if (c.stress != null) parts.push(`stress ${c.stress}/10`)
    entries.push({
      id: c.id,
      kind: 'checkin',
      start_iso: c.logged_at,
      title: 'Check-in',
      subtitle: parts.join(' · '),
    })
  }

  return entries.sort((a, b) => a.start_iso.localeCompare(b.start_iso))
}
