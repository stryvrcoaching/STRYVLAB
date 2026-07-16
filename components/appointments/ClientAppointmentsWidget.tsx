'use client'

/**
 * components/appointments/ClientAppointmentsWidget.tsx
 *
 * Widget pour la fiche client côté coach.
 * Affiche la liste des rendez-vous de ce client et permet d'en planifier/gérer.
 */

import { useEffect, useState } from 'react'
import { Calendar, Video, Phone, MapPin, Clock, Plus, Trash2, CheckCircle, AlertTriangle } from 'lucide-react'
import {
  appointmentStatusLabel,
  appointmentDurationMinutes,
  type CoachingAppointment,
  type AppointmentStatus,
} from '@/lib/appointments/types'
import AppointmentFormModal from './AppointmentFormModal'

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

  const fetchAppointments = () => {
    setLoading(true)
    fetch(`/api/coach/appointments?clientId=${clientId}`)
      .then((r) => r.json())
      .then((data) => setAppointments(Array.isArray(data) ? data : []))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAppointments()
  }, [clientId])

  async function handleAction(apptId: string, action: 'cancel' | 'complete' | 'no_show') {
    setActionLoading(apptId)
    try {
      const res = await fetch(`/api/coach/appointments/${apptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        fetchAppointments()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 leading-none mb-0.5">Rendez-vous</p>
          <h3 className="text-[12px] font-bold text-white leading-none">Appels & One-to-One</h3>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-xs text-[#c6b48b] hover:text-[#d4c09e] transition-colors"
        >
          <Plus size={14} />
          Planifier un appel
        </button>
      </div>

      {loading && (
        <div className="space-y-2 py-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/4 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && appointments.length === 0 && (
        <div className="text-center py-8 border border-dashed border-white/8 rounded-xl">
          <Calendar className="text-white/10 mx-auto mb-2" size={24} />
          <p className="text-xs text-white/40">Aucun rendez-vous enregistré pour ce client.</p>
        </div>
      )}

      {!loading && appointments.length > 0 && (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {appointments.map((appt) => {
            const Icon = KIND_ICONS[appt.meeting_kind] ?? Clock
            const start = new Date(appt.starts_at)
            const durationMin = appointmentDurationMinutes(appt)
            const dateLabel = new Intl.DateTimeFormat('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(start)

            const isTerminal = ['cancelled', 'completed', 'no_show'].includes(appt.status)

            return (
              <div
                key={appt.id}
                className="flex items-center justify-between gap-3 bg-white/4 border border-white/6 rounded-xl p-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-[#c6b48b]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-white truncate">{appt.title}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${STATUS_CLASSES[appt.status]}`}>
                        {appointmentStatusLabel(appt.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <span>{dateLabel}</span>
                      {durationMin > 0 && (
                        <>
                          <span>·</span>
                          <span>{durationMin} min</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions rapides */}
                {!isTerminal && (
                  <div className="flex items-center gap-1 shrink-0">
                    {appt.status === 'reschedule_requested' && appt.reschedule_reason && (
                      <div className="group relative mr-2">
                        <AlertTriangle size={14} className="text-orange-400 cursor-help" />
                        <div className="absolute right-0 bottom-6 hidden group-hover:block bg-[#222] border border-white/10 text-white text-[10px] rounded-lg p-2.5 w-48 shadow-xl z-20">
                          <p className="font-bold mb-1">Motif du report :</p>
                          <p className="italic text-white/80">« {appt.reschedule_reason} »</p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleAction(appt.id, 'complete')}
                      disabled={actionLoading !== null}
                      title="Marquer comme réalisé"
                      className="p-1.5 text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                    >
                      <CheckCircle size={14} />
                    </button>
                    <button
                      onClick={() => handleAction(appt.id, 'cancel')}
                      disabled={actionLoading !== null}
                      title="Annuler le rendez-vous"
                      className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
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
