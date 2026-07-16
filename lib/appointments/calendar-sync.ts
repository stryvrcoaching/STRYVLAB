import type { SupabaseClient } from '@supabase/supabase-js'

export interface ExternalEvent {
  start: string
  end: string
}

/**
 * Récupère les tokens valides pour un coach et les rafraîchit si expiré.
 */
async function getOrRefreshTokens(
  db: SupabaseClient,
  coachId: string,
  provider: 'google' | 'outlook'
): Promise<string | null> {
  const { data: tokenData, error } = await db
    .from('coach_calendar_tokens')
    .select('*')
    .eq('coach_id', coachId)
    .eq('provider', provider)
    .maybeSingle()

  if (error || !tokenData) return null

  const now = new Date()
  const expiresAt = new Date(tokenData.expires_at)

  // Si le token est expiré ou expire dans moins de 5 minutes, on le rafraîchit
  if (expiresAt.getTime() - now.getTime() < 5 * 60_000 && tokenData.refresh_token) {
    try {
      let responseJson: any = null

      if (provider === 'google') {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            grant_type: 'refresh_token',
            refresh_token: tokenData.refresh_token,
          }),
        })

        if (!res.ok) throw new Error('Failed to refresh Google token')
        responseJson = await res.json()
      }

      if (provider === 'outlook') {
        const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.OUTLOOK_CLIENT_ID || '',
            client_secret: process.env.OUTLOOK_CLIENT_SECRET || '',
            grant_type: 'refresh_token',
            refresh_token: tokenData.refresh_token,
            scope: 'offline_access Calendars.ReadWrite',
          }),
        })

        if (!res.ok) throw new Error('Failed to refresh Outlook token')
        responseJson = await res.json()
      }

      if (responseJson && responseJson.access_token) {
        const newExpiresAt = new Date(Date.now() + (responseJson.expires_in || 3600) * 1000).toISOString()

        await db
          .from('coach_calendar_tokens')
          .update({
            access_token: responseJson.access_token,
            expires_at: newExpiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', tokenData.id)

        return responseJson.access_token
      }
    } catch (err) {
      console.error('[calendar-sync] Token refresh error:', err)
      return null
    }
  }

  return tokenData.access_token
}

/**
 * Récupère les indisponibilités de l'agenda externe du coach.
 */
export async function getExternalCalendarEvents(
  db: SupabaseClient,
  coachId: string,
  timeMin: Date,
  timeMax: Date
): Promise<ExternalEvent[]> {
  const events: ExternalEvent[] = []

  // Google Calendar integration
  const googleToken = await getOrRefreshTokens(db, coachId, 'google')
  if (googleToken) {
    try {
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${googleToken}` }
      })

      if (res.ok) {
        const data = await res.json()
        if (data.items) {
          for (const item of data.items) {
            const start = item.start?.dateTime || item.start?.date
            const end = item.end?.dateTime || item.end?.date
            if (start && end) {
              events.push({ start, end })
            }
          }
        }
      }
    } catch (err) {
      console.error('[calendar-sync] Google calendar fetch error:', err)
    }
  }

  // Outlook Calendar integration
  const outlookToken = await getOrRefreshTokens(db, coachId, 'outlook')
  if (outlookToken) {
    try {
      const url = `https://graph.microsoft.com/v1.0/me/calendar/calendarView?startDateTime=${timeMin.toISOString()}&endDateTime=${timeMax.toISOString()}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${outlookToken}` }
      })

      if (res.ok) {
        const data = await res.json()
        if (data.value) {
          for (const item of data.value) {
            const start = item.start?.dateTime
            const end = item.end?.dateTime
            if (start && end) {
              events.push({ start, end })
            }
          }
        }
      }
    } catch (err) {
      console.error('[calendar-sync] Outlook calendar fetch error:', err)
    }
  }

  return events
}

/**
 * Synchronise un rendez-vous vers Google Calendar/Outlook.
 * Si demandé et Google connecté, insère également un lien Google Meet.
 */
export async function syncAppointmentToExternalCalendar(
  db: SupabaseClient,
  appt: {
    id: string
    coach_id: string
    title: string
    starts_at: string
    ends_at: string
    client_message: string | null
    google_event_id?: string | null
    outlook_event_id?: string | null
  }
): Promise<{ google_event_id?: string; outlook_event_id?: string; meeting_url?: string } | null> {
  let googleRes: any = null
  let outlookRes: any = null

  // 1. Google Calendar Integration
  const googleToken = await getOrRefreshTokens(db, appt.coach_id, 'google')
  if (googleToken) {
    try {
      const isUpdate = !!appt.google_event_id
      const method = isUpdate ? 'PUT' : 'POST'
      const url = isUpdate
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${appt.google_event_id}?conferenceDataVersion=1`
        : 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1'

      const body: any = {
        summary: appt.title,
        description: appt.client_message || '',
        start: { dateTime: appt.starts_at },
        end: { dateTime: appt.ends_at },
      }

      if (!isUpdate) {
        body.conferenceData = {
          createRequest: {
            requestId: `stryv-${appt.id}-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      }

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        const data = await res.json()
        const google_event_id = data.id
        const meeting_url = data.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri

        googleRes = { google_event_id, meeting_url }
      }
    } catch (err) {
      console.error('[calendar-sync] Google Calendar sync error:', err)
    }
  }

  // 2. Outlook Calendar (Microsoft Graph) Integration
  const outlookToken = await getOrRefreshTokens(db, appt.coach_id, 'outlook')
  if (outlookToken) {
    try {
      const isUpdate = !!appt.outlook_event_id
      const method = isUpdate ? 'PATCH' : 'POST'
      const url = isUpdate
        ? `https://graph.microsoft.com/v1.0/me/events/${appt.outlook_event_id}`
        : 'https://graph.microsoft.com/v1.0/me/events'

      const body: any = {
        subject: appt.title,
        body: {
          contentType: 'HTML',
          content: appt.client_message || '',
        },
        start: { dateTime: appt.starts_at, timeZone: 'UTC' },
        end: { dateTime: appt.ends_at, timeZone: 'UTC' },
      }

      if (!isUpdate) {
        body.isOnlineMeeting = true
        body.onlineMeetingProvider = 'teamsForBusiness'
      }

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${outlookToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        const data = await res.json()
        const outlook_event_id = data.id
        const meeting_url = data.onlineMeeting?.joinUrl

        outlookRes = { outlook_event_id, meeting_url }
      }
    } catch (err) {
      console.error('[calendar-sync] Outlook Calendar sync error:', err)
    }
  }

  // Fusionne et applique les mises à jour en base de données
  if (googleRes || outlookRes) {
    const updates: any = {}
    if (googleRes?.google_event_id) updates.google_event_id = googleRes.google_event_id
    if (outlookRes?.outlook_event_id) updates.outlook_event_id = outlookRes.outlook_event_id
    
    // Priorité au lien de visio généré
    const meeting_url = googleRes?.meeting_url || outlookRes?.meeting_url
    if (meeting_url) {
      updates.meeting_url = meeting_url
    }

    await db
      .from('coaching_appointments')
      .update(updates)
      .eq('id', appt.id)

    return { ...googleRes, ...outlookRes }
  }

  return null
}

/**
 * Supprime un événement de l'agenda externe.
 */
export async function deleteAppointmentFromExternalCalendar(
  db: SupabaseClient,
  appt: { coach_id: string; google_event_id?: string | null; outlook_event_id?: string | null }
): Promise<void> {
  // Google Event deletion
  if (appt.google_event_id) {
    const googleToken = await getOrRefreshTokens(db, appt.coach_id, 'google')
    if (googleToken) {
      try {
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${appt.google_event_id}`
        await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${googleToken}` }
        })
      } catch (err) {
        console.error('[calendar-sync] Google event delete failed:', err)
      }
    }
  }

  // Outlook Event deletion
  if (appt.outlook_event_id) {
    const outlookToken = await getOrRefreshTokens(db, appt.coach_id, 'outlook')
    if (outlookToken) {
      try {
        const url = `https://graph.microsoft.com/v1.0/me/events/${appt.outlook_event_id}`
        await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${outlookToken}` }
        })
      } catch (err) {
        console.error('[calendar-sync] Outlook event delete failed:', err)
      }
    }
  }
}
