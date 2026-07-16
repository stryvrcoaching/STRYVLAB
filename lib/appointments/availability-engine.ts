import type { SupabaseClient } from '@supabase/supabase-js'
import type { CoachAvailability, FreeSlot } from '@/lib/appointments/types'
import { getExternalCalendarEvents } from '@/lib/appointments/calendar-sync'

/**
 * Calcule les créneaux disponibles pour un coach sur une date donnée.
 *
 * @param db Supabase client
 * @param coachId ID du coach
 * @param dateKey Date au format 'YYYY-MM-DD'
 * @param slotDurationMin Durée d'un créneau en minutes (ex: 30)
 * @param clientTimezone Fuseau horaire du client (ex: 'Europe/Paris')
 */
export async function getCoachAvailableSlots(
  db: SupabaseClient,
  coachId: string,
  dateKey: string,
  slotDurationMin: number = 30,
  clientTimezone: string = 'Europe/Paris'
): Promise<FreeSlot[]> {
  // 1. Détermine le jour de la semaine (1 = Lundi, 7 = Dimanche)
  const targetDate = new Date(`${dateKey}T12:00:00`)
  let dayOfWeek = targetDate.getDay() // 0 = Dimanche, 1 = Lundi
  if (dayOfWeek === 0) dayOfWeek = 7

  // 2. Charge les disponibilités configurées du coach pour ce jour
  const { data: availabilities, error: availErr } = await db
    .from('coach_availabilities')
    .select('start_time, end_time')
    .eq('coach_id', coachId)
    .eq('day_of_week', dayOfWeek)

  if (availErr || !availabilities || availabilities.length === 0) {
    return []
  }

  // 3. Calcule les bornes temporelles absolues en UTC pour la date recherchée
  // Base de la journée locale dans le fuseau du client (ou UTC par défaut)
  const dayStartIso = `${dateKey}T00:00:00`
  const dayEndIso = `${dateKey}T23:59:59`

  const dayStart = new Date(dayStartIso)
  const dayEnd = new Date(dayEndIso)

  // 4. Charge les rendez-vous existants pour ce coach ce jour-là
  const { data: appointments } = await db
    .from('coaching_appointments')
    .select('starts_at, ends_at')
    .eq('coach_id', coachId)
    .not('status', 'in', '("cancelled")')
    .gte('starts_at', dayStart.toISOString())
    .lte('starts_at', dayEnd.toISOString())

  // 5. Récupère les plages d'indisponibilité de l'agenda externe (Google/Outlook)
  const externalEvents = await getExternalCalendarEvents(db, coachId, dayStart, dayEnd)

  // Fusionner tous les blocs occupés (internes et externes)
  const busyIntervals: { start: Date; end: Date }[] = []

  if (appointments) {
    for (const appt of appointments) {
      busyIntervals.push({
        start: new Date(appt.starts_at),
        end: new Date(appt.ends_at)
      })
    }
  }

  for (const ext of externalEvents) {
    busyIntervals.push({
      start: new Date(ext.start),
      end: new Date(ext.end)
    })
  }

  // Tri par date de début
  busyIntervals.sort((a, b) => a.start.getTime() - b.start.getTime())

  // 6. Génère les créneaux théoriques à partir de la grille de dispo coach
  const freeSlots: FreeSlot[] = []

  for (const avail of availabilities) {
    // Crée des objets dates absolus basés sur les heures locales configurées
    const [startH, startM] = avail.start_time.split(':').map(Number)
    const [endH, endM] = avail.end_time.split(':').map(Number)

    const availStart = new Date(dayStart)
    availStart.setHours(startH, startM, 0, 0)

    const availEnd = new Date(dayStart)
    availEnd.setHours(endH, endM, 0, 0)

    let current = new Date(availStart)

    while (current.getTime() + slotDurationMin * 60_000 <= availEnd.getTime()) {
      const slotStart = new Date(current)
      const slotEnd = new Date(current.getTime() + slotDurationMin * 60_000)

      // Vérifie si ce créneau n'intersecte aucun bloc occupé
      const isOverlap = busyIntervals.some(busy => {
        // Overlap si slotStart < busyEnd ET slotEnd > busyStart
        return slotStart < busy.end && slotEnd > busy.start
      })

      // Ne pas proposer de créneau dans le passé
      const isPast = slotStart.getTime() < Date.now()

      if (!isOverlap && !isPast) {
        freeSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString()
        })
      }

      // Passe au créneau suivant
      current = new Date(current.getTime() + slotDurationMin * 60_000)
    }
  }

  return freeSlots
}
