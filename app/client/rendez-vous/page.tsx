'use client'

/**
 * app/client/rendez-vous/page.tsx
 *
 * Page principale rendez-vous côté client STRYVR.
 * Liste le prochain appel + les suivants + l'historique récent.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar, Video, Phone, MapPin, Clock, ExternalLink,
  ChevronRight, CheckCircle2, AlertCircle, History, Plus,
} from 'lucide-react'
import { appointmentStatusLabel, type CoachingAppointmentClientView, type AppointmentStatus } from '@/lib/appointments/types'
import ClientBookingFlow from '@/components/client/appointments/ClientBookingFlow'
import ClientTopBar from '@/components/client/ClientTopBar'

const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-[#86aeb8]/12 text-[#86aeb8]',
  awaiting_confirmation: 'bg-amber-500/12 text-amber-400',
  confirmed: 'bg-emerald-500/12 text-emerald-400',
  reschedule_requested: 'bg-orange-500/12 text-orange-400',
  cancelled: 'bg-red-500/12 text-red-400',
  completed: 'bg-white/8 text-white/40',
  no_show: 'bg-red-500/8 text-red-300/60',
}

const KIND_ICONS = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
  other: Clock,
}

function formatDateFr(iso: string, timezone?: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(iso))
}

function AppointmentCard({
  appt,
  prominent = false,
}: {
  appt: CoachingAppointmentClientView
  prominent?: boolean
}) {
  const router = useRouter()
  const Icon = KIND_ICONS[appt.meeting_kind] ?? Clock
  const isPast = new Date(appt.starts_at) < new Date()
  const canJoin = !!appt.meeting_url && !isPast && !['cancelled', 'completed', 'no_show'].includes(appt.status)
  const canRespond = appt.status === 'awaiting_confirmation'

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all cursor-pointer
        ${prominent
          ? 'bg-white/[0.03] border-white/[0.12] shadow-lg shadow-black/30'
          : 'bg-white/[0.02] border-white/[0.08] hover:border-white/12'}`}
      onClick={() => router.push(`/client/rendez-vous/${appt.id}`)}
    >
      <div className="p-5">
        {/* Status + badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${prominent ? 'bg-white/[0.04] border-[0.3px] border-white/10' : 'bg-white/[0.03]'}`}>
              <Icon size={15} className={prominent ? 'text-[#c6b48b]' : 'text-white/50'} />
            </div>
            <div>
              <p className={`font-semibold leading-snug ${prominent ? 'text-white text-sm' : 'text-white/90 text-xs'}`}>
                {appt.title}
              </p>
              {appt.coach_name && (
                <p className="text-[10px] text-white/40 mt-0.5">{appt.coach_name}</p>
              )}
            </div>
          </div>
          <span className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide ${STATUS_CLASSES[appt.status]}`}>
            {appointmentStatusLabel(appt.status)}
          </span>
        </div>

        {/* Date/heure */}
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={13} className="text-white/30 shrink-0" />
          <p className={`${prominent ? 'text-white/80 text-xs' : 'text-white/60 text-[11px]'} capitalize`}>
            {formatDateFr(appt.starts_at, appt.client_timezone)}
          </p>
        </div>

        {/* Message de préparation */}
        {prominent && appt.client_message && (
          <div className="bg-white/[0.02] border-[0.3px] border-white/[0.08] rounded-xl px-3 py-2 mb-4 space-y-1">
            <p className="text-[9px] text-white/40 uppercase tracking-wider font-semibold">Préparation</p>
            <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">{appt.client_message}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 items-center w-full pt-1 border-t border-white/[0.04]">
          {canJoin && (
            <a
              href={appt.meeting_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 bg-[#c6b48b] text-[#0d0d0d] text-[11px] font-bold px-3 py-2 rounded-lg hover:bg-[#d4c09e] transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
              Rejoindre l'appel
            </a>
          )}

          {canRespond && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/client/rendez-vous/${appt.id}`) }}
              className="flex items-center gap-1 bg-amber-500/10 border-[0.3px] border-amber-500/20 text-amber-400 text-[11px] font-semibold px-3 py-2 rounded-lg hover:bg-amber-500/20 transition-all"
            >
              <AlertCircle size={12} />
              Répondre
            </button>
          )}

          <button
            onClick={() => router.push(`/client/rendez-vous/${appt.id}`)}
            className="flex items-center gap-0.5 text-[11px] text-white/40 hover:text-white/70 transition-colors ml-auto font-medium"
          >
            Détail <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ClientRendezVousPage() {
  const router = useRouter()
  const [upcoming, setUpcoming] = useState<CoachingAppointmentClientView[]>([])
  const [history, setHistory] = useState<CoachingAppointmentClientView[]>([])
  const [loading, setLoading] = useState(true)
  const [bookingMode, setBookingMode] = useState(false)

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/client/appointments?scope=upcoming').then((r) => r.json()),
      fetch('/api/client/appointments?scope=history').then((r) => r.json()),
    ])
      .then(([up, hist]) => {
        setUpcoming(Array.isArray(up) ? up : [])
        setHistory(Array.isArray(hist) ? hist.slice(0, 10) : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const [next, ...rest] = upcoming

  const topBarRight = !bookingMode ? (
    <button
      onClick={() => setBookingMode(true)}
      className="flex items-center gap-1 bg-[#c6b48b] text-[#0d0d0d] text-[11px] font-bold px-3 py-1.5 rounded-xl hover:bg-[#d4c09e] transition-all"
    >
      <Plus size={12} />
      Réserver
    </button>
  ) : undefined

  return (
    <div className="min-h-dvh bg-[#0d0d0d] font-barlow overflow-x-hidden">
      <ClientTopBar
        section="RENDEZ-VOUS"
        title="TES APPELS COACH"
        right={topBarRight}
      />

      <main className="max-w-lg mx-auto px-4 pt-[90px] pb-6 flex flex-col gap-6">
        {bookingMode && (
          <div className="animate-fade-in">
            <ClientBookingFlow
              onSuccess={() => {
                setBookingMode(false)
                fetchAll()
              }}
              onCancel={() => setBookingMode(false)}
            />
          </div>
        )}

        {loading && !bookingMode && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.08] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && !bookingMode && (
          <div className="space-y-6">
            {/* Prochain rendez-vous */}
            {next && (
              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 px-1">Prochain appel</p>
                <AppointmentCard appt={next} prominent />
              </section>
            )}

            {/* Suivants */}
            {rest.length > 0 && (
              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 px-1">À venir</p>
                <div className="space-y-3">
                  {rest.map((appt) => (
                    <AppointmentCard key={appt.id} appt={appt} />
                  ))}
                </div>
              </section>
            )}

            {/* Aucun appel */}
            {upcoming.length === 0 && (
              <div className="text-center py-16 flex flex-col gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center mx-auto">
                  <Calendar size={22} className="text-white/20" />
                </div>
                <p className="text-[13px] font-medium text-white/40">Aucun rendez-vous à venir.</p>
                <p className="text-[11px] text-white/20 max-w-[200px] mx-auto">
                  Réserve un créneau libre avec le bouton ci-dessus ou contacte ton coach.
                </p>
              </div>
            )}

            {/* Historique */}
            {history.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-1.5 px-1">
                  <History size={12} className="text-white/30" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Historique récent</p>
                </div>
                <div className="space-y-3">
                  {history.map((appt) => (
                    <AppointmentCard key={appt.id} appt={appt} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
