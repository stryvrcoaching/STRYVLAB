/**
 * GET /api/coach/calendar.ics?token=xxxx
 *
 * Route publique (pas de session Supabase requise).
 * Vérifie le token dans coach_ics_tokens, récupère les événements
 * agenda + rendez-vous du coach, génère et retourne un fichier .ics
 * compatible Apple Calendar, Google Calendar, Outlook, Fantastical, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Helpers ICS ───────────────────────────────────────────────────────────────

/** Échappe les caractères spéciaux dans les champs texte ICS (RFC 5545) */
function escapeICS(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/** Formate une Date en timestamp ICS UTC : 20260717T090000Z */
function toICSDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

/**
 * Formate une date agenda (event_date: "2026-07-17", event_time: "09:00")
 * en timestamp ICS. Si event_time est absent → événement toute la journée (DATE).
 */
function agendaToICS(
  eventDate: string,
  eventTime: string | null | undefined,
  isAllDay: boolean = false,
): string {
  if (!eventTime || isAllDay) {
    // Toute la journée : format DATE uniquement
    return eventDate.replace(/-/g, '')
  }
  // Heure locale → UTC (on suppose Europe/Paris UTC+2 en été, mais on utilise l'heure telle quelle
  // pour éviter une dépendance externe. Le flux indique TZID=Europe/Paris.)
  const [h, m] = eventTime.split(':').map(Number)
  const d = new Date(`${eventDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
  return toICSDate(d)
}

/** Génère un VEVENT ICS complet */
function buildVEvent({
  uid,
  summary,
  description,
  location,
  dtstart,
  dtend,
  allDay,
  created,
  url,
}: {
  uid: string
  summary: string
  description?: string | null
  location?: string | null
  dtstart: string
  dtend: string
  allDay?: boolean
  created?: string
  url?: string | null
}): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SUMMARY:${escapeICS(summary)}`,
  ]

  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`)
    lines.push(`DTEND;VALUE=DATE:${dtend}`)
  } else {
    lines.push(`DTSTART:${dtstart}`)
    lines.push(`DTEND:${dtend}`)
  }

  if (description) {
    lines.push(`DESCRIPTION:${escapeICS(description)}`)
  }
  if (location) {
    lines.push(`LOCATION:${escapeICS(location)}`)
  }
  if (created) {
    lines.push(`CREATED:${created}`)
  }
  if (url) {
    lines.push(`URL:${url}`)
  }

  // Fold les lignes longues (RFC 5545 : max 75 octets par ligne)
  const folded = lines.map(foldLine).join('\r\n')
  return folded + '\r\nEND:VEVENT'
}

/** RFC 5545 line folding : coupe les lignes > 75 octets avec CRLF + SPACE */
function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line
  const result: string[] = []
  let current = ''
  for (const char of line) {
    if (Buffer.byteLength(current + char, 'utf8') > 75) {
      result.push(current)
      current = ' ' + char
    } else {
      current += char
    }
  }
  if (current) result.push(current)
  return result.join('\r\n')
}

// ─── Labels humains ────────────────────────────────────────────────────────────

const MEETING_KIND_LABELS: Record<string, string> = {
  video: 'Visioconférence',
  phone: 'Téléphone',
  in_person: 'Présentiel',
  other: 'Rendez-vous',
}

const PRIORITY_EMOJI: Record<string, string> = {
  high: '🔴 ',
  medium: '🟡 ',
  low: '🟢 ',
}

// ─── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return new NextResponse('Token manquant', { status: 400 })
  }

  const db = service()

  // 1. Résoudre le coach via le token
  const { data: tokenRow, error: tokenErr } = await db
    .from('coach_ics_tokens')
    .select('coach_id')
    .eq('token', token)
    .single()

  if (tokenErr || !tokenRow) {
    return new NextResponse('Token invalide ou expiré', { status: 404 })
  }

  const coachId = tokenRow.coach_id

  // 2. Récupérer les événements agenda + les rendez-vous en parallèle
  const [agendaRes, apptRes] = await Promise.all([
    db
      .from('agenda_events')
      .select('id, title, description, event_date, event_time, event_time_end, priority, created_at, template_type')
      .eq('coach_id', coachId)
      .order('event_date', { ascending: false })
      .limit(500),

    db
      .from('coaching_appointments')
      .select('id, title, starts_at, ends_at, meeting_kind, meeting_url, client_message, status, created_at')
      .eq('coach_id', coachId)
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: false })
      .limit(200),
  ])

  const agendaEvents = agendaRes.data ?? []
  const appointments = apptRes.data ?? []

  // 3. Construire les VEVENTs

  const vevents: string[] = []

  // Événements agenda
  for (const ev of agendaEvents) {
    const priorityPrefix = (ev.priority && PRIORITY_EMOJI[ev.priority]) ?? ''
    const summary = `${priorityPrefix}${ev.title ?? 'Événement'}`
    const allDay = !ev.event_time

    const dtstart = agendaToICS(ev.event_date, ev.event_time, allDay)
    let dtend: string

    if (allDay) {
      // Événement toute la journée → fin = jour suivant
      const d = new Date(`${ev.event_date}T00:00:00`)
      d.setDate(d.getDate() + 1)
      dtend = d.toISOString().slice(0, 10).replace(/-/g, '')
    } else if (ev.event_time_end) {
      dtend = agendaToICS(ev.event_date, ev.event_time_end)
    } else {
      // Durée par défaut : 1h
      const [h, m] = (ev.event_time ?? '09:00').split(':').map(Number)
      const d = new Date(`${ev.event_date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
      d.setHours(d.getHours() + 1)
      dtend = toICSDate(d)
    }

    const created = ev.created_at ? toICSDate(new Date(ev.created_at)) : undefined

    vevents.push(buildVEvent({
      uid: `agenda-${ev.id}@stryvlab.com`,
      summary,
      description: ev.description,
      dtstart,
      dtend,
      allDay,
      created,
    }))
  }

  // Rendez-vous
  for (const appt of appointments) {
    const kindLabel = MEETING_KIND_LABELS[appt.meeting_kind ?? 'other'] ?? 'Rendez-vous'
    const summary = `📞 ${appt.title ?? kindLabel}`

    const dtstart = toICSDate(new Date(appt.starts_at))
    const dtend = toICSDate(new Date(appt.ends_at))
    const created = appt.created_at ? toICSDate(new Date(appt.created_at)) : undefined

    const descParts: string[] = [`Type : ${kindLabel}`]
    if (appt.client_message) descParts.push(`\nMessage : ${appt.client_message}`)
    if (appt.status === 'awaiting_confirmation') descParts.push('\n⏳ En attente de confirmation client')

    vevents.push(buildVEvent({
      uid: `appointment-${appt.id}@stryvlab.com`,
      summary,
      description: descParts.join(''),
      location: appt.meeting_kind === 'in_person' ? 'Présentiel' : undefined,
      url: appt.meeting_url ?? undefined,
      dtstart,
      dtend,
      created,
    }))
  }

  // 4. Assembler le VCALENDAR
  const now = toICSDate(new Date())

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//STRYV lab//Coach Calendar//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:STRYV lab — Mon agenda',
    'X-WR-TIMEZONE:Europe/Paris',
    'X-WR-CALDESC:Événements et rendez-vous STRYV lab',
    `X-PUBLISHED-TTL:PT1H`,
    `LAST-MODIFIED:${now}`,
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(calendar, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="stryvlab.ics"',
      // Indique aux clients iCal de rafraîchir toutes les heures
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
