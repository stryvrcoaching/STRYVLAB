import { groupWaterByTimeOfDay, type WaterLog } from './waterAggregation'
import { ct, type ClientLang } from '@/lib/i18n/clientTranslations'

export type TimelineKind = 'meal' | 'water' | 'workout' | 'activity' | 'checkin' | 'appointment'

export type AppointmentRow = {
  id: string
  starts_at: string
  title: string
  meeting_kind: string
}

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
  appointments?: AppointmentRow[]
}

const ACTIVITY_LABEL_KEY: Record<ActivityRow['activity_type'], Parameters<typeof ct>[1]> = {
  running: 'smart.activity.type.running',
  cycling: 'smart.activity.type.cycling',
  swimming: 'smart.activity.type.swimming',
  walking: 'smart.activity.type.walking',
  team_sport: 'smart.activity.type.team_sport',
  other: 'smart.activity.type.other',
}

const SLOT_REPRESENTATIVE_SUFFIX: Record<'morning' | 'midday' | 'afternoon' | 'evening', string> = {
  morning: 'T08:00:00Z',
  midday: 'T13:00:00Z',
  afternoon: 'T16:00:00Z',
  evening: 'T20:00:00Z',
}

export function buildTimeline(src: TimelineSource, tz: string = 'Europe/Paris', lang: ClientLang = 'fr'): TimelineEntry[] {
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
          title: ct(lang, slot === 'morning'
            ? 'smart.timeline.morning'
            : slot === 'midday'
              ? 'smart.timeline.midday'
              : slot === 'afternoon'
                ? 'smart.timeline.afternoon'
                : 'smart.timeline.evening'),
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
      subtitle: `${src.session.exercises_count} ${ct(lang, 'smart.timeline.exercises')} · ${src.session.duration_min} min`,
      href: `/client/programme/recap/${src.session.id}`,
    })
  }

  // Activities
  for (const a of src.activities) {
    entries.push({
      id: a.id,
      kind: 'activity',
      start_iso: a.started_at,
      title: a.custom_label?.trim() || ct(lang, ACTIVITY_LABEL_KEY[a.activity_type]),
      subtitle: `${a.duration_min} min · ${ct(lang, 'smart.timeline.intensity')} ${a.intensity}/10`,
    })
  }

  // Checkins
  for (const c of src.checkins) {
    const parts: string[] = []
    if (c.sleep_h != null) parts.push(`${c.sleep_h}h ${ct(lang, 'smart.timeline.sleep')}`)
    if (c.energy != null) parts.push(`${ct(lang, 'smart.timeline.energy')} ${c.energy}/10`)
    if (c.stress != null) parts.push(`${ct(lang, 'smart.timeline.stress')} ${c.stress}/10`)
    entries.push({
      id: c.id,
      kind: 'checkin',
      start_iso: c.logged_at,
      title: ct(lang, 'smart.radial.checkin'),
      subtitle: parts.join(' · '),
    })
  }

  // Appointments
  if (src.appointments) {
    for (const appt of src.appointments) {
      const timeLabel = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(new Date(appt.starts_at))
      entries.push({
        id: appt.id,
        kind: 'appointment',
        start_iso: appt.starts_at,
        title: appt.title,
        subtitle: `${appt.meeting_kind === 'video' ? 'Visioconférence' : appt.meeting_kind === 'phone' ? 'Téléphone' : appt.meeting_kind === 'in_person' ? 'Présentiel' : 'Appel'} · ${timeLabel}`,
        href: `/client/rendez-vous/${appt.id}`,
      })
    }
  }

  return entries.sort((a, b) => a.start_iso.localeCompare(b.start_iso))
}
