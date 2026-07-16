'use client'

import { useEffect, useState, FormEvent } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  Phone,
  Users,
  FileText,
  CheckSquare,
  Copy,
  Check,
  ExternalLink,
  CircleDollarSign,
  AlertCircle
} from 'lucide-react'

type Lead = {
  id: string
  contact_name: string
  email: string
  company_name: string | null
  phone: string | null
  source: string
  status: string
  notes: string | null
  next_follow_up_at: string | null
  demo_scheduled_at: string | null
  sales_partner_id: string
  closing_partner_id: string | null
  created_at: string
}

type Activity = {
  id: string
  kind: 'task' | 'note' | 'meeting' | 'call'
  title: string
  details: string | null
  due_at: string | null
  completed_at: string | null
  created_at: string
}

const statusLabels: Record<string, string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  demo_scheduled: 'Démo planifiée',
  trialing: 'En essai',
  active: 'Actif',
  lost: 'Perdu',
  archived: 'Archivé',
}

const sourceLabels: Record<string, string> = {
  manual: 'Ajout manuel',
  network: 'Réseau',
  event: 'Événement',
  referral_link: 'Lien de recommandation',
  other: 'Autre',
}

const statuses = Object.entries(statusLabels)

function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value: string | null) {
  if (!value) return 'Non définie'
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

export function SalesLeadDetailWorkspace({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activityTab, setActivityTab] = useState<'note' | 'task' | 'call' | 'meeting'>('note')
  const [submittingActivity, setSubmittingActivity] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedCalLink, setCopiedCalLink] = useState(false)

  // Activity fields
  const [activityTitle, setActivityTitle] = useState('')
  const [activityDetails, setActivityDetails] = useState('')
  const [activityDueAt, setActivityDueAt] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/sales/leads/${leadId}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Chargement impossible')
      setLead(payload.lead)
      setActivities(payload.activities ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [leadId])

  async function updateLeadField(fields: {
    status?: string
    notes?: string | null
    nextFollowUpAt?: string | null
    demoScheduledAt?: string | null
    claimClosing?: boolean
  }) {
    if (!lead) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/sales/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Mise à jour impossible')
      setLead(payload.lead)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Mise à jour impossible')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTaskCompleted(activity: Activity) {
    setError('')
    const isCompleted = !!activity.completed_at
    try {
      const response = await fetch(`/api/sales/tasks/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !isCompleted }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Mise à jour de la tâche impossible')
      
      setActivities((current) =>
        current.map((item) =>
          item.id === activity.id
            ? { ...item, completed_at: payload.task.completed_at }
            : item
        )
      )
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : 'Mise à jour de la tâche impossible')
    }
  }

  async function handleAddActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lead) return
    setSubmittingActivity(true)
    setError('')

    const title = activityTitle.trim() || getDefaultTitle()
    const details = activityDetails.trim() || null
    const dueAt = activityDueAt ? new Date(activityDueAt).toISOString() : null

    try {
      const response = await fetch(`/api/sales/leads/${lead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: activityTab,
          title,
          details,
          dueAt,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Enregistrement impossible')

      setActivities((current) => [payload.activity, ...current])
      
      // Reset form
      setActivityTitle('')
      setActivityDetails('')
      setActivityDueAt('')
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : 'Enregistrement impossible')
    } finally {
      setSubmittingActivity(false)
    }
  }

  function getDefaultTitle() {
    switch (activityTab) {
      case 'note': return 'Note de suivi'
      case 'call': return 'Appel téléphonique'
      case 'meeting': return 'Réunion / Démo'
      case 'task': return 'Tâche de relance'
    }
  }

  const copyEmail = () => {
    if (!lead) return
    navigator.clipboard.writeText(lead.email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const demoUrl = lead
    ? `https://cal.com/stryvlab/demo-stryvlab?name=${encodeURIComponent(lead.contact_name)}&email=${encodeURIComponent(lead.email)}`
    : ''

  const copyCalLink = () => {
    navigator.clipboard.writeText(demoUrl)
    setCopiedCalLink(true)
    setTimeout(() => setCopiedCalLink(false), 2000)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-44 animate-pulse rounded-xl bg-white/[0.04]" />
        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          <div className="h-96 animate-pulse rounded-3xl bg-white/[0.03]" />
          <div className="h-96 animate-pulse rounded-3xl bg-white/[0.03]" />
        </div>
      </div>
    )
  }

  if (error && !lead) {
    return (
      <div className="rounded-3xl border border-red-300/15 bg-red-400/[0.06] p-6 text-center">
        <AlertCircle size={28} className="mx-auto text-red-400" />
        <p className="mt-3 text-sm text-red-200">{error}</p>
        <Link href="/sales/leads" className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white/[0.05] px-4 text-xs font-semibold hover:bg-white/[0.1]">
          <ArrowLeft size={14} /> Retour au portefeuille
        </Link>
      </div>
    )
  }

  if (!lead) return null

  const formControlClassName = 'mt-1.5 h-11 w-full rounded-xl border border-white/[0.10] bg-black/20 px-3 text-base text-white outline-none focus:border-white/45 sm:text-sm'

  return (
    <div className="space-y-6">
      <div>
        <Link href="/sales/leads" className="inline-flex items-center gap-2 text-xs font-semibold text-white/52 transition hover:text-white">
          <ArrowLeft size={14} /> Retour au portefeuille
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300/15 bg-red-400/[0.06] p-4 text-sm text-red-200 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        
        {/* Left Column: Profile Card & Quick Actions */}
        <div className="space-y-6">
          <article className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6 space-y-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/36">Fiche prospect</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{lead.contact_name}</h1>
              {lead.company_name ? <p className="mt-1 text-sm text-white/55">{lead.company_name}</p> : null}
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center gap-2 border-b border-white/[0.04] pb-3">
                <span className="text-white/45">Adresse e-mail</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate text-white font-medium">{lead.email}</span>
                  <button onClick={copyEmail} type="button" className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/45 hover:text-white transition">
                    {copiedEmail ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {lead.phone ? (
                <div className="flex justify-between items-center gap-2 border-b border-white/[0.04] pb-3">
                  <span className="text-white/45">Téléphone</span>
                  <span className="text-white font-medium">{lead.phone}</span>
                </div>
              ) : null}

              <div className="flex justify-between items-center gap-2 border-b border-white/[0.04] pb-3">
                <span className="text-white/45">Origine</span>
                <span className="text-white font-medium">{sourceLabels[lead.source] ?? lead.source}</span>
              </div>

              <div className="flex justify-between items-center gap-2 border-b border-white/[0.04] pb-3">
                <span className="text-white/45">Ajouté le</span>
                <span className="text-white font-medium">{new Date(lead.created_at).toLocaleDateString('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Quick configuration */}
            <div className="space-y-4 pt-2">
              <label className="block text-[11px] font-semibold text-white/60">
                Étape du tunnel
                <select
                  value={lead.status}
                  disabled={saving}
                  onChange={(e) => void updateLeadField({ status: e.target.value as Lead['status'] })}
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.09] bg-black/20 px-3 text-xs text-white outline-none focus:border-white/45"
                >
                  {statuses.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-[11px] font-semibold text-white/60">
                Date de prochaine relance
                <div className="relative mt-2">
                  <CalendarClock aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/42" />
                  <input
                    aria-label="Date et heure de prochaine action"
                    type="datetime-local"
                    disabled={saving}
                    value={toLocalDateTime(lead.next_follow_up_at)}
                    onChange={(e) => {
                      const value = e.target.value
                      void updateLeadField({ nextFollowUpAt: value ? new Date(value).toISOString() : null })
                    }}
                    className="h-11 w-full rounded-xl border border-white/[0.09] bg-black/20 pl-9 pr-3 text-xs text-white outline-none focus:border-white/45"
                  />
                </div>
              </label>
            </div>

            {/* Closing attribution button */}
            <div className="pt-2 border-t border-white/[0.06]">
              {lead.closing_partner_id ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3 text-emerald-300">
                  <CircleDollarSign size={16} className="shrink-0" />
                  <p className="text-[11px] font-semibold">Vente complète déclarée par vous</p>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void updateLeadField({ claimClosing: true })}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-white/[0.08]"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Je gère la vente complète
                </button>
              )}
            </div>
          </article>

          {/* Cal.com Demo card */}
          <article className="rounded-3xl border border-[#c6b48b]/20 bg-[#c6b48b]/[0.02] p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#c6b48b] flex items-center gap-2">
              <CalendarClock size={16} /> Aide Planification Démo
            </h2>
            <p className="text-xs text-white/55 leading-relaxed">
              Utilisez le lien officiel STRYV pour planifier l'appel de démonstration. Les coordonnées du prospect y seront pré-remplies.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] text-[11px] font-bold uppercase tracking-[0.12em] text-[#111315] hover:bg-white transition"
              >
                Ouvrir Cal.com <ExternalLink size={13} />
              </a>
              <button
                type="button"
                onClick={copyCalLink}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-white/[0.08]"
              >
                {copiedCalLink ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier le lien démo</>}
              </button>
            </div>
          </article>
        </div>

        {/* Right Column: Activity Logger & Chronological Timeline */}
        <div className="space-y-6">
          {/* Activity Logger Form */}
          <section className="rounded-3xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-white/[0.06] bg-black/10">
              {(['note', 'task', 'call', 'meeting'] as const).map((tab) => {
                const label = { note: 'Note', task: 'Tâche', call: 'Appel', meeting: 'Réunion' }[tab]
                const active = activityTab === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setActivityTab(tab)
                      setError('')
                    }}
                    className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-[0.1em] border-b-2 transition ${
                      active
                        ? 'border-[#c6b48b] text-[#c6b48b] bg-white/[0.02]'
                        : 'border-transparent text-white/45 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Form Content */}
            <form onSubmit={handleAddActivity} className="p-5 sm:p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-[11px] font-semibold text-white/60 min-w-0 sm:col-span-2">
                  Titre de l'action / note
                  <input
                    required
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                    className={formControlClassName}
                    placeholder={getDefaultTitle()}
                  />
                </label>

                {activityTab === 'task' ? (
                  <label className="block text-[11px] font-semibold text-white/60 min-w-0 sm:col-span-2">
                    Date d'échéance
                    <input
                      required
                      type="datetime-local"
                      value={activityDueAt}
                      onChange={(e) => setActivityDueAt(e.target.value)}
                      className={formControlClassName}
                    />
                  </label>
                ) : null}

                {(activityTab === 'call' || activityTab === 'meeting') ? (
                  <label className="block text-[11px] font-semibold text-white/60 min-w-0">
                    Planifier pour le (optionnel)
                    <input
                      type="datetime-local"
                      value={activityDueAt}
                      onChange={(e) => setActivityDueAt(e.target.value)}
                      className={formControlClassName}
                      placeholder="Laisser vide si déjà réalisé"
                    />
                  </label>
                ) : null}

                <label className="block text-[11px] font-semibold text-white/60 sm:col-span-2">
                  Détails / Commentaires
                  <textarea
                    value={activityDetails}
                    onChange={(e) => setActivityDetails(e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full resize-y rounded-xl border border-white/[0.10] bg-black/20 p-3 text-sm text-white outline-none focus:border-white/45"
                    placeholder="Détails de l'échange ou consignes pour la tâche…"
                  />
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submittingActivity}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] px-6 text-[11px] font-bold uppercase tracking-[0.12em] text-[#111315] hover:bg-white transition disabled:opacity-55"
                >
                  {submittingActivity ? <Loader2 size={14} className="animate-spin" /> : null}
                  Enregistrer l'action
                </button>
              </div>
            </form>
          </section>

          {/* Timeline Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-white/80">Historique d'activité</h2>
            
            <div className="space-y-3">
              {activities.length ? (
                activities.map((act) => {
                  const isTask = act.kind === 'task'
                  const isCompletedTask = isTask && !!act.completed_at
                  
                  const Icon = {
                    note: FileText,
                    call: Phone,
                    meeting: Users,
                    task: CheckSquare
                  }[act.kind]

                  return (
                    <article
                      key={act.id}
                      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 flex gap-4 items-start transition ${
                        isCompletedTask
                          ? 'border-white/[0.04] bg-white/[0.01] opacity-60'
                          : 'border-white/[0.07] bg-white/[0.02]'
                      }`}
                    >
                      {/* Checkbox for tasks or static icon for others */}
                      {isTask ? (
                        <button
                          type="button"
                          onClick={() => void toggleTaskCompleted(act)}
                          className="mt-0.5 shrink-0 rounded-lg border border-white/20 p-1 hover:border-[#c6b48b] hover:bg-white/[0.04] text-white/50 hover:text-white transition"
                        >
                          <CheckSquare size={16} className={isCompletedTask ? 'text-[#c6b48b]' : 'text-white/20'} />
                        </button>
                      ) : (
                        <div className="mt-1 shrink-0 rounded-lg bg-white/[0.05] p-2 text-white/50">
                          <Icon size={16} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <h3 className={`text-[13px] font-semibold ${isCompletedTask ? 'line-through text-white/40' : 'text-white/90'}`}>
                            {act.title}
                          </h3>
                          <span className="text-[10px] text-white/36">
                            {formatDate(act.created_at)}
                          </span>
                        </div>

                        {act.details ? (
                          <p className="text-xs leading-relaxed text-white/55 whitespace-pre-wrap">
                            {act.details}
                          </p>
                        ) : null}

                        {isTask && act.due_at ? (
                          <p className="text-[10px] font-semibold text-white/40 flex items-center gap-1">
                            Échéance : <span className={isCompletedTask ? 'text-white/30' : 'text-[#c6b48b]'}>{formatDate(act.due_at)}</span>
                          </p>
                        ) : null}

                        {!isTask && act.due_at ? (
                          <p className="text-[10px] font-semibold text-white/40">
                            Prévu le : {formatDate(act.due_at)}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/[0.09] p-8 text-center text-xs text-white/42 leading-relaxed">
                  Aucune activité enregistrée sur ce prospect.
                  <br />
                  Utilisez le formulaire ci-dessus pour consigner vos notes, relances ou rendez-vous.
                </div>
              )}
            </div>
          </section>
        </div>

      </div>
    </div>
  )
}
