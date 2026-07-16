'use client'

/**
 * app/client/rendez-vous/[appointmentId]/page.tsx
 *
 * Détail d'un rendez-vous côté client.
 * Confirmation / demande de report via route serveur dédiée.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Calendar, Video, Phone, MapPin, Clock, ExternalLink, CheckCircle2,
  XCircle, AlertCircle, Loader2, MessageSquare,
} from 'lucide-react'
import {
  appointmentStatusLabel,
  appointmentDurationMinutes,
  canClientRespond,
  type CoachingAppointmentClientView,
  type AppointmentStatus,
} from '@/lib/appointments/types'
import ClientTopBar from '@/components/client/ClientTopBar'

const STATUS_CLASSES: Record<AppointmentStatus, { bg: string; text: string; label: string }> = {
  scheduled:             { bg: 'bg-[#86aeb8]/12', text: 'text-[#86aeb8]', label: '📅 Planifié' },
  awaiting_confirmation: { bg: 'bg-amber-500/12', text: 'text-amber-400', label: '⏳ À confirmer' },
  confirmed:             { bg: 'bg-emerald-500/12', text: 'text-emerald-400', label: '✅ Confirmé' },
  reschedule_requested:  { bg: 'bg-orange-500/12', text: 'text-orange-400', label: '🔄 Report demandé' },
  cancelled:             { bg: 'bg-red-500/12', text: 'text-red-400', label: '❌ Annulé' },
  completed:             { bg: 'bg-white/8', text: 'text-white/40', label: '✔ Réalisé' },
  no_show:               { bg: 'bg-red-500/8', text: 'text-red-300/60', label: 'Absent' },
}

const KIND_ICONS = { video: Video, phone: Phone, in_person: MapPin, other: Clock }

function formatFull(iso: string, tz?: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: tz,
  }).format(new Date(iso))
}

export default function AppointmentDetailPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const router = useRouter()

  const [appt, setAppt] = useState<CoachingAppointmentClientView | null>(null)
  const [loading, setLoading] = useState(true)
  const [respondLoading, setRespondLoading] = useState(false)
  const [rescheduleMode, setRescheduleMode] = useState(false)
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    fetch(`/api/client/appointments/${appointmentId}`)
      .then((r) => r.json())
      .then((data) => setAppt(data))
      .catch(() => setAppt(null))
      .finally(() => setLoading(false))
  }, [appointmentId])

  async function respond(action: 'confirm' | 'request_reschedule') {
    setRespondLoading(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/client/appointments/${appointmentId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erreur')

      setFeedback({
        type: 'success',
        message: action === 'confirm' ? 'Rendez-vous confirmé !' : 'Demande de report envoyée à ton coach.',
      })
      // Recharge les données
      const updated = await fetch(`/api/client/appointments/${appointmentId}`).then((r) => r.json())
      setAppt(updated)
      setRescheduleMode(false)
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erreur' })
    } finally {
      setRespondLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 size={24} className="text-[#c6b48b] animate-spin" />
      </div>
    )
  }

  if (!appt) {
    return (
      <div className="min-h-dvh bg-[#0d0d0d] flex flex-col items-center justify-center gap-3">
        <AlertCircle size={32} className="text-white/20" />
        <p className="text-white/50 text-sm font-barlow">Rendez-vous introuvable.</p>
        <button onClick={() => router.push('/client/rendez-vous')} className="text-[#c6b48b] text-sm font-semibold font-barlow">
          ← Retour
        </button>
      </div>
    )
  }

  const Icon = KIND_ICONS[appt.meeting_kind] ?? Clock
  const status = STATUS_CLASSES[appt.status]
  const isPast = new Date(appt.starts_at) < new Date()
  const canJoin = !!appt.meeting_url && !isPast && !['cancelled', 'completed', 'no_show'].includes(appt.status)
  const durationMin = appointmentDurationMinutes(appt as any)

  const statusBadge = (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${status.bg} ${status.text}`}>
      {status.label}
    </span>
  )

  return (
    <div className="min-h-dvh bg-[#0d0d0d] font-barlow overflow-x-hidden">
      <ClientTopBar
        section="RENDEZ-VOUS"
        title={appt.title}
        backHref="/client/rendez-vous"
        right={statusBadge}
      />

      <main className="max-w-lg mx-auto px-4 pt-[90px] pb-6 flex flex-col gap-4">
        {/* Main card */}
        <div className="bg-white/[0.02] border-[0.3px] border-white/[0.08] rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.08] flex items-center justify-center shrink-0">
              <Icon size={20} className="text-[#c6b48b]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white leading-snug">{appt.title}</h1>
              {appt.coach_name && (
                <p className="text-xs text-white/40 mt-0.5">avec {appt.coach_name}</p>
              )}
            </div>
          </div>

          <div className="h-[1px] bg-white/[0.06] w-full" />

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar size={14} className="text-white/30 shrink-0" />
              <span className="text-xs text-white/70 capitalize">{formatFull(appt.starts_at, appt.client_timezone)}</span>
            </div>
            {durationMin > 0 && (
              <div className="flex items-center gap-3">
                <Clock size={14} className="text-white/30 shrink-0" />
                <span className="text-xs text-white/60">
                  {durationMin} min — {appt.meeting_kind === 'video' ? 'Visioconférence' : appt.meeting_kind === 'phone' ? 'Téléphone' : appt.meeting_kind === 'in_person' ? 'Présentiel' : 'Autre'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Rejoindre l'appel */}
        {canJoin && (
          <a
            href={appt.meeting_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#c6b48b] text-[#0d0d0d] font-bold text-xs py-3.5 rounded-xl hover:bg-[#d4c09e] transition-all"
          >
            <ExternalLink size={14} />
            Rejoindre l'appel
          </a>
        )}

        {/* Message de préparation */}
        {appt.client_message && (
          <div className="bg-white/[0.02] border-[0.3px] border-white/[0.08] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare size={13} className="text-[#86aeb8]" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Message de ton coach</p>
            </div>
            <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">{appt.client_message}</p>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${feedback.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            {feedback.type === 'success'
              ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              : <AlertCircle size={14} className="text-red-400 shrink-0" />}
            <p className={`text-xs ${feedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback.message}
            </p>
          </div>
        )}

        {/* Confirmation / Report */}
        {canClientRespond(appt) && !feedback && (
          <div className="bg-amber-500/[0.03] border-[0.3px] border-amber-500/20 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-400" />
              <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Ton coach attend ta réponse</p>
            </div>

            {!rescheduleMode ? (
              <div className="flex gap-2">
                <button
                  onClick={() => respond('confirm')}
                  disabled={respondLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/15 text-emerald-400 font-semibold text-xs py-3 rounded-xl hover:bg-emerald-500/25 transition-all disabled:opacity-50"
                >
                  {respondLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Confirmer
                </button>
                <button
                  onClick={() => setRescheduleMode(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-white/[0.04] text-white/70 border-[0.3px] border-white/10 font-semibold text-xs py-3 rounded-xl hover:bg-white/[0.08] transition-all"
                >
                  <XCircle size={13} />
                  Demander un report
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Précise la raison ou tes disponibilités... (optionnel)"
                  rows={3}
                  maxLength={500}
                  className="w-full bg-white/[0.03] border-[0.3px] border-white/10 rounded-xl px-3 py-2.5 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-[#c6b48b]/40 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setRescheduleMode(false); setReason('') }}
                    className="flex-1 text-xs text-white/40 hover:text-white/70 py-2.5 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => respond('request_reschedule')}
                    disabled={respondLoading}
                    className="flex-1 bg-orange-500/15 text-orange-400 font-semibold text-xs py-2.5 rounded-xl hover:bg-orange-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {respondLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                    Envoyer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Annulation */}
        {appt.status === 'cancelled' && appt.cancel_reason && (
          <div className="bg-red-500/8 border border-red-500/15 rounded-xl px-4 py-3">
            <p className="text-xs text-red-300/60 uppercase tracking-wider mb-1">Motif d'annulation</p>
            <p className="text-sm text-red-300/80">{appt.cancel_reason}</p>
          </div>
        )}
      </main>
    </div>
  )
}
