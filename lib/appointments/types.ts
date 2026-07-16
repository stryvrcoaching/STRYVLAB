/**
 * lib/appointments/types.ts
 *
 * Types partagés pour le système de rendez-vous coach–client.
 * Le coach dispose de la vue complète ; le client reçoit uniquement
 * CoachingAppointmentClientView (sans notes privées ni données de livraison).
 */

// ─── Statuts ──────────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | 'scheduled'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'reschedule_requested'
  | 'cancelled'
  | 'completed'
  | 'no_show'

// ─── Modalités ────────────────────────────────────────────────────────────────

export type MeetingKind = 'video' | 'phone' | 'in_person' | 'other'

// ─── Vue coach (complète) ─────────────────────────────────────────────────────

export interface CoachingAppointment {
  id: string
  coach_id: string
  client_id: string
  title: string
  starts_at: string           // ISO 8601 with tz
  ends_at: string             // ISO 8601 with tz
  client_timezone: string
  meeting_kind: MeetingKind
  meeting_url: string | null
  client_message: string | null
  coach_private_notes: string | null
  confirmation_required: boolean
  status: AppointmentStatus
  reschedule_reason: string | null
  responded_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ─── Vue client (sans notes privées) ─────────────────────────────────────────

export type CoachingAppointmentClientView = Omit<
  CoachingAppointment,
  'coach_private_notes' | 'coach_id'
> & {
  /** Nom affiché du coach, joint côté serveur */
  coach_name: string | null
}

// ─── Journal d'activité ───────────────────────────────────────────────────────

export type AppointmentActivityEvent =
  | 'created'
  | 'updated'
  | 'confirmed'
  | 'reschedule_requested'
  | 'cancelled'
  | 'completed'
  | 'no_show'

export interface CoachingAppointmentActivity {
  id: string
  appointment_id: string
  actor_role: 'coach' | 'client' | 'system'
  actor_user_id: string | null
  event_type: AppointmentActivityEvent
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Livraisons de notifications ─────────────────────────────────────────────

export type NotificationChannel = 'in_app' | 'push' | 'email'
export type NotificationKind =
  | 'created'
  | 'updated'
  | 'cancelled'
  | 'reminder_24h'
  | 'reminder_1h'
  | 'reschedule_requested'

export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed' | 'cancelled'

export interface AppointmentNotificationDelivery {
  id: string
  appointment_id: string
  channel: NotificationChannel
  kind: NotificationKind
  scheduled_for: string
  sent_at: string | null
  status: NotificationDeliveryStatus
  provider_message_id: string | null
  error: string | null
  created_at: string
}

// ─── Payloads API coach ───────────────────────────────────────────────────────

export interface CreateAppointmentPayload {
  client_id: string
  title?: string
  starts_at: string
  ends_at: string
  meeting_kind: MeetingKind
  meeting_url?: string | null
  client_message?: string | null
  confirmation_required?: boolean
  create_kanban_task?: boolean
}

export interface UpdateAppointmentPayload {
  title?: string
  starts_at?: string
  ends_at?: string
  meeting_kind?: MeetingKind
  meeting_url?: string | null
  client_message?: string | null
  confirmation_required?: boolean
  /** Pour annuler le rendez-vous */
  action?: 'cancel' | 'complete' | 'no_show'
  cancel_reason?: string | null
  coach_private_notes?: string | null
}

// ─── Payload réponse client ───────────────────────────────────────────────────

export interface RespondAppointmentPayload {
  action: 'confirm' | 'request_reschedule'
  reason?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Durée en minutes d'un rendez-vous */
export function appointmentDurationMinutes(appt: Pick<CoachingAppointment, 'starts_at' | 'ends_at'>): number {
  const start = new Date(appt.starts_at).getTime()
  const end = new Date(appt.ends_at).getTime()
  return Math.round((end - start) / 60_000)
}

/** Libellé court de la modalité */
export function meetingKindLabel(kind: MeetingKind, lang: 'fr' | 'en' = 'fr'): string {
  const labels: Record<MeetingKind, Record<'fr' | 'en', string>> = {
    video:      { fr: 'Visioconférence', en: 'Video call' },
    phone:      { fr: 'Téléphone',       en: 'Phone call' },
    in_person:  { fr: 'Présentiel',      en: 'In person'  },
    other:      { fr: 'Autre',           en: 'Other'      },
  }
  return labels[kind]?.[lang] ?? kind
}

/** Libellé court du statut */
export function appointmentStatusLabel(status: AppointmentStatus, lang: 'fr' | 'en' = 'fr'): string {
  const labels: Record<AppointmentStatus, Record<'fr' | 'en', string>> = {
    scheduled:              { fr: 'Planifié',             en: 'Scheduled'           },
    awaiting_confirmation:  { fr: 'En attente de confirmation', en: 'Awaiting confirmation' },
    confirmed:              { fr: 'Confirmé',             en: 'Confirmed'           },
    reschedule_requested:   { fr: 'Report demandé',       en: 'Reschedule requested'},
    cancelled:              { fr: 'Annulé',               en: 'Cancelled'           },
    completed:              { fr: 'Réalisé',              en: 'Completed'           },
    no_show:                { fr: 'Absent',               en: 'No show'             },
  }
  return labels[status]?.[lang] ?? status
}

/** Vrai si le rendez-vous est encore à venir */
export function isUpcomingAppointment(appt: Pick<CoachingAppointment, 'starts_at' | 'status'>): boolean {
  return (
    !['cancelled', 'completed', 'no_show'].includes(appt.status)
    && new Date(appt.starts_at) > new Date()
  )
}

/** Vrai si le client peut encore répondre */
export function canClientRespond(appt: Pick<CoachingAppointment, 'status'>): boolean {
  return appt.status === 'awaiting_confirmation'
}

/** Valide une URL de réunion (HTTPS requis) */
export function isValidMeetingUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && url.length <= 2048
  } catch {
    return false
  }
}

// ─── Disponibilités & Synchronisation ─────────────────────────────────────────

export interface CoachAvailability {
  id: string
  coach_id: string
  day_of_week: number // 1 = Lundi, 7 = Dimanche
  start_time: string  // Format 'HH:MM:SS' ou 'HH:MM'
  end_time: string    // Format 'HH:MM:SS' ou 'HH:MM'
  created_at?: string
  updated_at?: string
}

export interface CoachCalendarToken {
  id: string
  coach_id: string
  provider: 'google' | 'outlook'
  access_token: string
  refresh_token: string | null
  expires_at: string
  created_at?: string
  updated_at?: string
}

export interface FreeSlot {
  start: string // ISO string
  end: string   // ISO string
}

