'use client'

/**
 * components/appointments/AppointmentFormModal.tsx
 *
 * Modal de création/modification d'un rendez-vous coach–client.
 * Utilisable depuis le dashboard, OrgSummary ou la fiche client.
 */

import { useState } from 'react'
import {
  X, Calendar, Clock, Video, Phone, MapPin, Link2, MessageSquare,
  CheckSquare, Loader2, AlertCircle,
} from 'lucide-react'
import { isValidMeetingUrl, type MeetingKind } from '@/lib/appointments/types'

interface ClientOption {
  id: string
  first_name: string | null
  last_name: string | null
  timezone?: string | null
}

interface AppointmentFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (appointmentId: string) => void
  /** Si fourni, le sélecteur de client est verrouillé sur ce client */
  preselectedClient?: ClientOption
  clients?: ClientOption[]
}

const DURATION_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1h', value: 60 },
  { label: '1h 30', value: 90 },
  { label: '2h', value: 120 },
]

const MEETING_KINDS: { value: MeetingKind; label: string; icon: React.ElementType }[] = [
  { value: 'video', label: 'Visioconférence', icon: Video },
  { value: 'phone', label: 'Téléphone', icon: Phone },
  { value: 'in_person', label: 'Présentiel', icon: MapPin },
]

function formatLocalDatetime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export default function AppointmentFormModal({
  open,
  onClose,
  onSuccess,
  preselectedClient,
  clients = [],
}: AppointmentFormModalProps) {
  const defaultStart = addMinutes(new Date(), 60)
  defaultStart.setMinutes(0, 0, 0)

  const [selectedClientId, setSelectedClientId] = useState(preselectedClient?.id ?? '')
  const [title, setTitle] = useState('')
  const [startDatetime, setStartDatetime] = useState(formatLocalDatetime(defaultStart))
  const [durationMin, setDurationMin] = useState(60)
  const [meetingKind, setMeetingKind] = useState<MeetingKind>('video')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [clientMessage, setClientMessage] = useState('')
  const [confirmationRequired, setConfirmationRequired] = useState(false)
  const [createKanbanTask, setCreateKanbanTask] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)

  if (!open) return null

  const allClients = preselectedClient
    ? [preselectedClient]
    : clients

  function buildEndsAt(): string {
    const start = new Date(startDatetime)
    const end = addMinutes(start, durationMin)
    return end.toISOString()
  }

  function buildStartsAt(): string {
    return new Date(startDatetime).toISOString()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setUrlError(null)

    if (meetingUrl && !isValidMeetingUrl(meetingUrl)) {
      setUrlError('Le lien doit être une URL HTTPS valide.')
      return
    }

    if (!selectedClientId) {
      setError('Sélectionne un client.')
      return
    }

    const startsAt = buildStartsAt()
    const endsAt = buildEndsAt()

    if (new Date(startsAt) >= new Date(endsAt)) {
      setError('La durée doit être supérieure à 0.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/coach/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClientId,
          title: title.trim() || undefined,
          starts_at: startsAt,
          ends_at: endsAt,
          meeting_kind: meetingKind,
          meeting_url: meetingUrl.trim() || null,
          client_message: clientMessage.trim() || null,
          confirmation_required: confirmationRequired,
          create_kanban_task: createKanbanTask,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json?.error ?? 'Une erreur est survenue.')
        return
      }

      onSuccess?.(json.appointment.id)
      onClose()
    } catch {
      setError('Impossible de créer le rendez-vous. Réessaie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#111] border border-white/8 rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <Calendar className="text-[#c6b48b]" size={18} />
            <h2 className="text-white font-semibold text-base">Planifier un rendez-vous</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Client */}
          {!preselectedClient && (
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Client *</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c6b48b]/50"
              >
                <option value="">Sélectionner un client...</option>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {preselectedClient && (
            <div className="bg-white/5 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-white/70">
              <span className="text-white/40 mr-2">Client :</span>
              <span className="text-white font-medium">
                {[preselectedClient.first_name, preselectedClient.last_name].filter(Boolean).join(' ')}
              </span>
            </div>
          )}

          {/* Objet */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Objet</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Point de suivi"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#c6b48b]/50"
            />
          </div>

          {/* Date + Durée */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider font-medium flex items-center gap-1.5">
                <Clock size={12} /> Date et heure *
              </label>
              <input
                type="datetime-local"
                value={startDatetime}
                onChange={(e) => setStartDatetime(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c6b48b]/50 [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Durée</label>
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c6b48b]/50"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Modalité */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium">Modalité</label>
            <div className="grid grid-cols-3 gap-2">
              {MEETING_KINDS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMeetingKind(value)}
                  className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-xs font-medium transition-all
                    ${meetingKind === value
                      ? 'border-[#c6b48b]/60 bg-[#c6b48b]/10 text-[#c6b48b]'
                      : 'border-white/10 bg-white/5 text-white/50 hover:text-white/80 hover:border-white/20'}`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Lien d'appel */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium flex items-center gap-1.5">
              <Link2 size={12} /> Lien de participation
            </label>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => { setMeetingUrl(e.target.value); setUrlError(null) }}
              placeholder="https://meet.google.com/..."
              className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none
                ${urlError ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-[#c6b48b]/50'}`}
            />
            {urlError && <p className="text-red-400 text-xs">{urlError}</p>}
          </div>

          {/* Message client */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium flex items-center gap-1.5">
              <MessageSquare size={12} /> Message de préparation
            </label>
            <textarea
              value={clientMessage}
              onChange={(e) => setClientMessage(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Objectif de l'appel, consignes, documents à préparer..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#c6b48b]/50 resize-none"
            />
          </div>

          {/* Options */}
          <div className="space-y-3 border-t border-white/8 pt-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <button
                type="button"
                onClick={() => setConfirmationRequired(!confirmationRequired)}
                className={`w-5 h-5 rounded flex items-center justify-center border transition-all
                  ${confirmationRequired ? 'bg-[#c6b48b] border-[#c6b48b]' : 'border-white/20 bg-white/5'}`}
                aria-pressed={confirmationRequired}
              >
                {confirmationRequired && <CheckSquare size={12} className="text-black" />}
              </button>
              <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                Demander une confirmation au client
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <button
                type="button"
                onClick={() => setCreateKanbanTask(!createKanbanTask)}
                className={`w-5 h-5 rounded flex items-center justify-center border transition-all
                  ${createKanbanTask ? 'bg-[#c6b48b] border-[#c6b48b]' : 'border-white/20 bg-white/5'}`}
                aria-pressed={createKanbanTask}
              >
                {createKanbanTask && <CheckSquare size={12} className="text-black" />}
              </button>
              <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                Créer une tâche de préparation dans le Kanban
              </span>
            </label>
          </div>

          {/* Erreur */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm hover:text-white/80 hover:border-white/20 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#c6b48b] text-[#0d0d0d] text-sm font-semibold hover:bg-[#d4c09e] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              Planifier
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
