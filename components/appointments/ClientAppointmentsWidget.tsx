'use client'

/**
 * Client appointments block — coach client profile.
 * Aligned with profil page Card / SectionLabel DA (flat dark, no rainbow badges).
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Calendar,
  Video,
  Phone,
  MapPin,
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import {
  appointmentStatusLabel,
  appointmentDurationMinutes,
  type CoachingAppointment,
  type AppointmentStatus,
} from '@/lib/appointments/types'
import AppointmentFormModal from './AppointmentFormModal'

const STATUS_DOT: Record<AppointmentStatus, string> = {
  scheduled: 'bg-[#7aa7ff]',
  awaiting_confirmation: 'bg-amber-400',
  confirmed: 'bg-[#1f8a65]',
  reschedule_requested: 'bg-orange-400',
  cancelled: 'bg-red-400/80',
  completed: 'bg-white/25',
  no_show: 'bg-red-400/60',
}

const KIND_ICONS = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
  other: Clock,
}

interface ClientAppointmentsWidgetProps {
  clientId: string
  clientFirstName: string | null
  clientLastName: string | null
}

export default function ClientAppointmentsWidget({
  clientId,
  clientFirstName,
  clientLastName,
}: ClientAppointmentsWidgetProps) {
  const [appointments, setAppointments] = useState<CoachingAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchAppointments = useCallback(() => {
    setLoading(true)
    fetch(`/api/coach/appointments?clientId=${clientId}`)
      .then((r) => r.json())
      .then((data) => setAppointments(Array.isArray(data) ? data : []))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  async function handleAction(apptId: string, action: 'cancel' | 'complete' | 'no_show') {
    setActionLoading(apptId)
    try {
      const res = await fetch(`/api/coach/appointments/${apptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) fetchAppointments()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const upcoming = appointments.filter(
    (a) => !['cancelled', 'completed', 'no_show'].includes(a.status),
  )
  const past = appointments.filter((a) =>
    ['cancelled', 'completed', 'no_show'].includes(a.status),
  )

  return (
    <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
          Rendez-vous
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f8a65] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#217356]"
        >
          <Plus size={12} />
          Planifier
        </button>
      </div>

      <p className="mb-4 text-[12px] leading-relaxed text-white/45">
        Appels et one-to-one avec ce client. Le client peut confirmer, reporter ou
        annuler depuis STRYVR.
      </p>

      {loading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[64px] animate-pulse rounded-xl border-[0.3px] border-white/[0.04] bg-[#0a0a0a]"
            />
          ))}
        </div>
      )}

      {!loading && appointments.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-white/[0.08] bg-[#0a0a0a]/50 px-4 py-8 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.03]">
            <Calendar size={18} className="text-white/25" />
          </div>
          <p className="text-[13px] font-semibold text-white/70">Aucun rendez-vous</p>
          <p className="mt-1 max-w-[260px] text-[11px] leading-relaxed text-white/35">
            Planifie un appel pour qu’il apparaisse ici et dans l’app client.
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-4 text-[11px] font-bold text-[#1f8a65] transition-colors hover:text-[#7fe2bf]"
          >
            Planifier un appel →
          </button>
        </div>
      )}

      {!loading && appointments.length > 0 && (
        <div className="max-h-[320px] space-y-4 overflow-y-auto pr-0.5">
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/25">
                À venir · {upcoming.length}
              </p>
              {upcoming.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appt={appt}
                  actionLoading={actionLoading}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/25">
                Historique · {past.length}
              </p>
              {past.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appt={appt}
                  actionLoading={actionLoading}
                  onAction={handleAction}
                  muted
                />
              ))}
            </div>
          )}
        </div>
      )}

      <AppointmentFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        preselectedClient={{
          id: clientId,
          first_name: clientFirstName,
          last_name: clientLastName,
        }}
        onSuccess={fetchAppointments}
      />
    </div>
  )
}

function AppointmentRow({
  appt,
  actionLoading,
  onAction,
  muted = false,
}: {
  appt: CoachingAppointment
  actionLoading: string | null
  onAction: (id: string, action: 'cancel' | 'complete' | 'no_show') => void
  muted?: boolean
}) {
  const Icon = KIND_ICONS[appt.meeting_kind] ?? Clock
  const start = new Date(appt.starts_at)
  const durationMin = appointmentDurationMinutes(appt)
  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(start)
  const isTerminal = ['cancelled', 'completed', 'no_show'].includes(appt.status)
  const busy = actionLoading === appt.id

  return (
    <div
      className={`rounded-xl border-[0.3px] border-white/[0.06] bg-[#0a0a0a] p-3.5 transition-opacity ${
        muted ? 'opacity-55' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.03]">
            <Icon size={14} className="text-[#1f8a65]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[13px] font-semibold text-white">{appt.title}</p>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/50">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[appt.status]}`} />
                {appointmentStatusLabel(appt.status)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-white/40">
              {dateLabel}
              {durationMin > 0 ? ` · ${durationMin} min` : ''}
            </p>
            {appt.status === 'reschedule_requested' && appt.reschedule_reason && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-amber-400/80">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>Report demandé : « {appt.reschedule_reason} »</span>
              </p>
            )}
          </div>
        </div>

        {!isTerminal && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onAction(appt.id, 'complete')}
              disabled={busy}
              title="Marquer comme réalisé"
              className="flex h-8 w-8 items-center justify-center rounded-lg border-[0.3px] border-white/[0.06] bg-white/[0.03] text-white/40 transition-colors hover:border-[#1f8a65]/30 hover:text-[#5dba87] disabled:opacity-40"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            </button>
            <button
              type="button"
              onClick={() => onAction(appt.id, 'cancel')}
              disabled={busy}
              title="Annuler le rendez-vous"
              className="flex h-8 w-8 items-center justify-center rounded-lg border-[0.3px] border-white/[0.06] bg-white/[0.03] text-white/40 transition-colors hover:border-red-500/25 hover:text-red-400 disabled:opacity-40"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
