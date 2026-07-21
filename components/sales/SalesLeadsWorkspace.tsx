'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Loader2, Plus } from 'lucide-react'

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
  closing_partner_id: string | null
  created_at: string
}

const statuses = [
  ['new', 'Nouveau'], ['contacted', 'Contacté'], ['qualified', 'Qualifié'], ['demo_scheduled', 'Démo planifiée'], ['trialing', 'En essai'], ['active', 'Actif'], ['lost', 'Perdu'], ['archived', 'Archivé'],
] as const

function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value: string | null) {
  if (!value) return 'Aucune relance définie'
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function SalesLeadsWorkspace() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function loadLeads() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/sales/leads', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Chargement impossible')
      setLeads(payload.leads ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadLeads() }, [])

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError('')
    const formData = new FormData(event.currentTarget)
    const followUp = String(formData.get('nextFollowUpAt') ?? '')
    const response = await fetch('/api/sales/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: formData.get('contactName'), email: formData.get('email'), companyName: formData.get('companyName') || null,
        phone: formData.get('phone') || null, source: formData.get('source'), notes: formData.get('notes') || null,
        nextFollowUpAt: followUp ? new Date(followUp).toISOString() : null,
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setError(payload?.error ?? 'Création impossible')
      setCreating(false)
      return
    }
    setLeads((current) => [payload.lead, ...current])
    setShowForm(false)
    setCreating(false)
  }

  async function saveLead(lead: Lead, input: { status?: string; nextFollowUpAt?: string }) {
    setSavingId(lead.id)
    setError('')
    const response = await fetch(`/api/sales/leads/${lead.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(input.status ? { status: input.status } : {}),
        ...(input.nextFollowUpAt !== undefined ? { nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt).toISOString() : null } : {}),
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) setError(payload?.error ?? 'Mise à jour impossible')
    else setLeads((current) => current.map((item) => item.id === lead.id ? payload.lead : item))
    setSavingId(null)
  }

  async function claimClosing(lead: Lead) {
    setSavingId(lead.id)
    setError('')
    const response = await fetch(`/api/sales/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimClosing: true }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) setError(payload?.error ?? 'Attribution impossible')
    else setLeads((current) => current.map((item) => item.id === lead.id ? payload.lead : item))
    setSavingId(null)
  }

  const formControlClassName = 'mt-2 h-12 min-w-0 w-full rounded-xl border border-white/[0.10] bg-black/20 px-3 text-base text-white outline-none focus:border-white/45 sm:h-11 sm:text-sm'
  const listControlClassName = 'h-12 min-w-0 w-full rounded-xl border border-white/[0.09] bg-black/20 px-3 text-base text-white outline-none focus:border-white/45 md:h-10 md:text-xs'

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/42">Prospection</p>
          <h1 className="mt-2 font-barlow text-4xl font-semibold uppercase leading-none tracking-[-0.04em] sm:text-5xl">Votre portefeuille</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/52">Ajoutez vos contacts, planifiez chaque relance et gardez une vue claire de leur progression.</p>
        </div>
        <button type="button" onClick={() => setShowForm((current) => !current)} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f2f2f2] px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#111315] transition hover:bg-white sm:h-11 sm:w-auto"><Plus size={16} /> Nouveau prospect</button>
      </section>

      {showForm ? <form onSubmit={createLead} className="grid grid-cols-1 gap-4 rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5 sm:grid-cols-2 sm:p-6">
        <label className="min-w-0 text-[11px] font-semibold text-white/64">Nom complet<input required name="contactName" className={formControlClassName} placeholder="Prénom Nom" /></label>
        <label className="min-w-0 text-[11px] font-semibold text-white/64">Adresse e-mail<input required name="email" type="email" className={formControlClassName} placeholder="coach@exemple.com" /></label>
        <label className="min-w-0 text-[11px] font-semibold text-white/64">Structure<input name="companyName" className={formControlClassName} placeholder="Nom de l’activité" /></label>
        <label className="min-w-0 text-[11px] font-semibold text-white/64">Téléphone<input name="phone" className={formControlClassName} placeholder="Optionnel" /></label>
        <label className="min-w-0 text-[11px] font-semibold text-white/64">Origine<select name="source" defaultValue="manual" className={formControlClassName}><option value="manual">Ajout manuel</option><option value="network">Réseau</option><option value="event">Événement</option><option value="referral_link">Lien de recommandation</option><option value="other">Autre</option></select></label>
        <label className="min-w-0 text-[11px] font-semibold text-white/64">Première relance<div className="relative min-w-0"><CalendarClock aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-[calc(50%+4px)] -translate-y-1/2 text-white/42" /><input aria-label="Date et heure de première relance" name="nextFollowUpAt" type="datetime-local" className={`${formControlClassName} pl-10`} /></div></label>
        <label className="sm:col-span-2 text-[11px] font-semibold text-white/64">Contexte<textarea name="notes" rows={3} className="mt-2 w-full resize-y rounded-xl border border-white/[0.10] bg-black/20 p-3 text-base text-white outline-none focus:border-white/45 sm:text-sm" placeholder="Ce qui est utile pour votre prochain échange." /></label>
        <div className="flex gap-3 sm:col-span-2"><button disabled={creating} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#111315] disabled:opacity-55 sm:h-10 sm:flex-none">{creating ? <Loader2 size={15} className="animate-spin" /> : null} Enregistrer</button><button type="button" onClick={() => setShowForm(false)} className="h-12 flex-1 rounded-xl px-4 text-[11px] font-semibold text-white/55 hover:text-white sm:h-10 sm:flex-none">Annuler</button></div>
      </form> : null}

      {error ? <p role="alert" className="rounded-2xl border border-red-300/15 bg-red-400/[0.07] px-4 py-3 text-sm text-red-100">{error}</p> : null}
      {loading ? <div className="h-64 animate-pulse rounded-[24px] border border-white/[0.06] bg-white/[0.03]" /> : leads.length ? <div className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.025]"><div className="hidden grid-cols-[minmax(0,1.4fr)_150px_190px] gap-4 border-b border-white/[0.06] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/32 md:grid"><span>Prospect</span><span>Étape</span><span>Prochaine action</span></div>{leads.map((lead) => <article key={lead.id} className="grid grid-cols-1 gap-4 border-b border-white/[0.055] px-4 py-5 last:border-0 md:grid-cols-[minmax(0,1.4fr)_150px_190px] md:items-center md:px-5"><div className="min-w-0"><p className="truncate text-[15px] font-semibold md:text-[14px]"><Link href={`/sales/leads/${lead.id}`} className="text-white/86 hover:text-[#1f8a65] transition">{lead.contact_name}</Link></p><p className="mt-1 truncate text-[13px] text-white/44 md:text-[12px]">{lead.company_name || lead.email}</p>{lead.company_name ? <p className="mt-1 truncate text-[12px] text-white/31 md:text-[11px]">{lead.email}</p> : null}{lead.closing_partner_id ? <p className="mt-2 text-[11px] font-semibold text-white/72">Vente complète déclarée</p> : <button type="button" disabled={savingId === lead.id} onClick={() => void claimClosing(lead)} className="mt-2 inline-flex min-h-11 items-center text-[12px] font-semibold text-white/68 transition hover:text-white disabled:opacity-50">Je gère la vente complète</button>}</div><label className="block min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/32 md:hidden">Étape</span><select value={lead.status} disabled={savingId === lead.id} onChange={(event) => void saveLead(lead, { status: event.target.value })} className={listControlClassName}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/32 md:hidden">Prochaine action</span><div className="relative min-w-0"><CalendarClock aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/42" /><input aria-label="Date et heure de prochaine action" type="datetime-local" defaultValue={toLocalDateTime(lead.next_follow_up_at)} onBlur={(event) => { const value = event.target.value; if (value !== toLocalDateTime(lead.next_follow_up_at)) void saveLead(lead, { nextFollowUpAt: value }) }} className={`${listControlClassName} pl-10`} /></div><p className="mt-1 text-[10px] text-white/32">{formatDate(lead.next_follow_up_at)}</p></label></article>)}</div> : <div className="rounded-[24px] border border-dashed border-white/[0.11] px-5 py-16 text-center"><p className="text-sm font-semibold text-white/74">Votre portefeuille est prêt.</p><p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-white/42">Ajoutez votre premier coach prospect pour commencer son suivi et sécuriser son attribution.</p></div>}
    </div>
  )
}
