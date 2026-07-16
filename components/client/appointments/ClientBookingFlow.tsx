'use client'

/**
 * components/client/appointments/ClientBookingFlow.tsx
 *
 * Expérience client STRYVR pour réserver un appel de suivi autonome
 * avec son coach.
 */

import { useEffect, useState } from 'react'
import { Calendar as CalendarIcon, Clock, Video, Phone, MapPin, Loader2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { type FreeSlot } from '@/lib/appointments/types'

interface ClientBookingFlowProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ClientBookingFlow({ onSuccess, onCancel }: ClientBookingFlowProps) {
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [slots, setSlots] = useState<FreeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null)
  const [meetingKind, setMeetingKind] = useState<'video' | 'phone'>('video')
  const [clientMessage, setClientMessage] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calcule les dates des 14 prochains jours
  const next14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  useEffect(() => {
    if (!selectedDate) return
    setLoadingSlots(true)
    setSlots([])
    setSelectedSlot(null)
    setError(null)

    fetch(`/api/client/appointments/slots?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setError('Impossible de charger les créneaux libres.'))
      .finally(() => setLoadingSlots(false))
  }, [selectedDate])

  async function handleBook() {
    if (!selectedSlot) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/client/appointments/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starts_at: selectedSlot.start,
          ends_at: selectedSlot.end,
          meeting_kind: meetingKind,
          client_message: clientMessage.trim() || null,
        }),
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const json = await res.json()
        setError(json?.error ?? 'Erreur lors de la réservation.')
      }
    } catch {
      setError('Impossible de confirmer le rendez-vous.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-[#111] border border-[#c6b48b]/30 rounded-2xl p-6 text-center space-y-4">
        <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
        <div>
          <h3 className="text-base font-bold text-white">Rendez-vous réservé !</h3>
          <p className="text-xs text-white/50 mt-1">L&apos;appel a été ajouté à votre agenda et synchronisé avec le coach.</p>
        </div>
        <button
          onClick={onSuccess}
          className="w-full py-2.5 rounded-lg bg-[#c6b48b] text-[#0d0d0d] text-xs font-semibold hover:bg-[#d4c09e] transition-all"
        >
          Voir mes rendez-vous
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-3">
        <CalendarIcon className="text-[#c6b48b]" size={18} />
        <div>
          <h3 className="text-sm font-bold text-white">Réserver un appel</h3>
          <p className="text-[10px] text-white/40 mt-0.5">Choisissez un créneau horaire avec votre coach.</p>
        </div>
      </div>

      {/* Sélection de la date */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Date</label>
        <div className="flex gap-2 overflow-x-auto pb-1.5 pr-2 scrollbar-thin">
          {next14Days.map((dStr) => {
            const d = new Date(`${dStr}T12:00:00`)
            const active = selectedDate === dStr
            const labelDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d)
            const labelNum = d.getDate()

            return (
              <button
                key={dStr}
                type="button"
                onClick={() => setSelectedDate(dStr)}
                className={`flex flex-col items-center justify-center min-w-[50px] h-[58px] rounded-xl border text-center transition-all shrink-0
                  ${active
                    ? 'border-[#c6b48b] bg-[#c6b48b]/10 text-white'
                    : 'border-white/8 bg-white/4 text-white/50 hover:border-white/15'}`}
              >
                <span className="text-[10px] uppercase font-bold tracking-tight">{labelDay}</span>
                <span className="text-sm font-bold mt-0.5">{labelNum}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sélection du créneau */}
      {selectedDate && (
        <div className="space-y-1.5">
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold flex items-center gap-1.5">
            <Clock size={11} /> Créneau horaire
          </label>

          {loadingSlots && (
            <div className="flex justify-center py-6">
              <Loader2 size={16} className="text-white/30 animate-spin" />
            </div>
          )}

          {!loadingSlots && slots.length === 0 && (
            <p className="text-xs text-white/30 italic py-3 text-center">Aucun créneau libre ce jour-là.</p>
          )}

          {!loadingSlots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot, idx) => {
                const active = selectedSlot?.start === slot.start
                const timeStr = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(new Date(slot.start))

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-all
                      ${active
                        ? 'border-[#c6b48b] bg-[#c6b48b]/15 text-[#c6b48b]'
                        : 'border-white/6 bg-white/4 text-white/60 hover:border-white/10'}`}
                  >
                    {timeStr}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modalité */}
      {selectedSlot && (
        <div className="space-y-4 pt-1 animate-fade-in">
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Modalité</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMeetingKind('video')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-semibold transition-all
                  ${meetingKind === 'video'
                    ? 'border-[#c6b48b]/50 bg-[#c6b48b]/10 text-[#c6b48b]'
                    : 'border-white/6 bg-white/4 text-white/50'}`}
              >
                <Video size={13} /> Visioconférence
              </button>
              <button
                type="button"
                onClick={() => setMeetingKind('phone')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-semibold transition-all
                  ${meetingKind === 'phone'
                    ? 'border-[#c6b48b]/50 bg-[#c6b48b]/10 text-[#c6b48b]'
                    : 'border-white/6 bg-white/4 text-white/50'}`}
              >
                <Phone size={13} /> Téléphone
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Message au coach (optionnel)</label>
            <textarea
              value={clientMessage}
              onChange={(e) => setClientMessage(e.target.value)}
              placeholder="Préciser l'objet de l'appel ou des notes..."
              rows={2}
              maxLength={500}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#c6b48b]/40 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg border border-white/8 text-white/60 text-xs font-semibold hover:bg-white/4 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleBook}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-lg bg-[#c6b48b] text-[#0d0d0d] text-xs font-bold hover:bg-[#d4c09e] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : null}
              Confirmer l&apos;appel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
