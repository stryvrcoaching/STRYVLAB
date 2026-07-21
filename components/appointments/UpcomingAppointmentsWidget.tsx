'use client'

/**
 * components/appointments/UpcomingAppointmentsWidget.tsx
 *
 * Widget compact pour OrgSummary : affiche les prochains appels coach.
 * Lit /api/coach/appointments?from=now&to=+14days
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Video, MapPin, Clock, User, ChevronRight, Plus } from 'lucide-react'
import {
  appointmentStatusLabel,
  meetingKindLabel,
  appointmentDurationMinutes,
  type CoachingAppointment,
  type AppointmentStatus,
} from '@/lib/appointments/types'

const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-blue-500/15 text-blue-400',
  awaiting_confirmation: 'bg-amber-500/15 text-amber-400',
  confirmed: 'bg-emerald-500/15 text-emerald-400',
  reschedule_requested: 'bg-orange-500/15 text-orange-400',
  cancelled: 'bg-red-500/15 text-red-400',
  completed: 'bg-white/10 text-white/40',
  no_show: 'bg-red-500/10 text-red-300/70',
}

const KIND_ICONS = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
  other: Clock,
}

interface UpcomingAppointmentsWidgetProps {
  onNewAppointment?: () => void
  clientNames?: Record<string, string>
}

export default function UpcomingAppointmentsWidget({
  onNewAppointment,
  clientNames = {},
}: UpcomingAppointmentsWidgetProps) {
  const router = useRouter()
  const [appointments, setAppointments] = useState<CoachingAppointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const from = new Date().toISOString()
    const to = new Date(Date.now() + 14 * 24 * 3600_000).toISOString()

    fetch(`/api/coach/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((data) => setAppointments(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
          Appels à venir
        </h3>
        <button
          onClick={onNewAppointment}
          className="flex items-center gap-1 text-xs text-[#1f8a65] hover:text-[#217356] transition-colors"
        >
          <Plus size={12} />
          Planifier
        </button>
      </div>

      {appointments.length === 0 && (
        <div className="text-center py-6">
          <Clock size={24} className="text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/30">Aucun appel dans les 14 prochains jours</p>
          <button
            onClick={onNewAppointment}
            className="mt-3 text-xs text-[#1f8a65] hover:text-[#217356] transition-colors"
          >
            Planifier un appel →
          </button>
        </div>
      )}

      {appointments.map((appt) => {
        const Icon = KIND_ICONS[appt.meeting_kind] ?? Clock
        const start = new Date(appt.starts_at)
        const durationMin = appointmentDurationMinutes(appt)
        const dateLabel = new Intl.DateTimeFormat('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }).format(start)
        const timeLabel = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(start)
        const clientName = clientNames[appt.client_id] ?? 'Client'

        return (
          <div
            key={appt.id}
            onClick={() => router.push(`/coach/clients/${appt.client_id}/profil`)}
            className="flex items-center gap-3 bg-white/4 hover:bg-white/7 border border-white/6 hover:border-white/10 rounded-xl px-4 py-3 transition-all cursor-pointer group"
          >
            {/* Icône modalité */}
            <div className="shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Icon size={14} className="text-[#1f8a65]" />
            </div>

            {/* Infos */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-white truncate">{appt.title}</p>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_CLASSES[appt.status]}`}>
                  {appointmentStatusLabel(appt.status)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40">
                <User size={10} />
                <span className="truncate">{clientName}</span>
                <span>·</span>
                <span>{dateLabel}</span>
                <span>·</span>
                <span>{timeLabel}</span>
                {durationMin > 0 && <span>· {durationMin} min</span>}
              </div>
            </div>

            <ChevronRight size={14} className="text-white/20 group-hover:text-white/40 transition-colors shrink-0" />
          </div>
        )
      })}
    </div>
  )
}
