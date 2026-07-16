'use client'

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CircleDollarSign, Loader2, RefreshCw, Send, Trash2, UserPlus, UsersRound } from 'lucide-react'

type Partner = {
  id: string
  fullName: string
  email: string
  status: 'active' | 'suspended'
  createdAt: string
  introducedLeads: number
  closingAssignments: number
  pendingCommission: number
  paidCommission: number
  needsActivation: boolean
}

type Lead = {
  id: string
  contactName: string
  email: string
  companyName: string | null
  status: string
  introducerId: string
  closingPartnerId: string | null
  nextFollowUpAt: string | null
  createdAt: string
  coachId: string | null
}

type Commission = {
  id: string
  sales_partner_id: string
  lead_id: string | null
  coach_id: string | null
  coach_plan: 'solo' | 'pro' | 'studio'
  commission_kind: 'referral' | 'closing_bonus'
  amount_eur: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  description: string
  created_at: string
  paid_at: string | null
}

type Coach = {
  coach_id: string
  full_name: string
  pro_email: string
}

type Payload = {
  partners: Partner[]
  leads: Lead[]
  commissions: Commission[]
  coaches: Coach[]
  summary: { activePartners: number; openLeads: number; trialingLeads: number; activeCoaches: number }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value)
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 12_000) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

export function SalesAdminPanel() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function loadData(silent = false) {
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const response = await fetchWithTimeout('/api/dashboard/sales-partners', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Chargement commercial impossible')
      setData(payload)
    } catch (loadError) {
      if (!silent) setError(loadError instanceof Error ? loadError.message : 'Chargement commercial impossible')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  const partnerNames = useMemo(() => new Map((data?.partners ?? []).map((partner) => [partner.id, partner.fullName])), [data?.partners])
  const activePartners = (data?.partners ?? []).filter((partner) => partner.status === 'active')

  async function invitePartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setSaving('invite')
    setError('')
    setNotice('')
    const formData = new FormData(form)

    try {
      const response = await fetchWithTimeout('/api/dashboard/sales-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', fullName: formData.get('fullName'), email: formData.get('email') }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Invitation impossible')

      setNotice(payload?.mode === 'existing_account'
        ? 'Accès STRYV Connect ajouté. Aucun e-mail n’a été envoyé : cette personne possède déjà un compte STRYV et peut se connecter sur /sales/login avec ses identifiants habituels.'
        : 'Invitation envoyée par e-mail. La personne pourra créer son mot de passe puis activer son accès STRYV Connect.')
      form.reset()

      if (payload?.partner) {
        setData((current) => {
          if (!current) return current
          const partners = [payload.partner, ...current.partners.filter((partner) => partner.id !== payload.partner.id)]
          return {
            ...current,
            partners,
            summary: {
              ...current.summary,
              activePartners: partners.filter((partner) => partner.status === 'active').length,
            },
          }
        })
      }

      void loadData(true)
    } catch (inviteError) {
      setError(inviteError instanceof Error && inviteError.name === 'AbortError'
        ? 'La demande a pris trop de temps. Vérifiez la liste avant de réessayer.'
        : inviteError instanceof Error ? inviteError.message : 'Invitation impossible')
    } finally {
      setSaving(null)
    }
  }

  async function update(input: Record<string, unknown>, key: string) {
    setSaving(key)
    setError('')
    try {
      const response = await fetchWithTimeout('/api/dashboard/sales-partners', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Mise à jour impossible')
      if (input.action === 'resend_activation') {
        setNotice('Nouvel e-mail STRYV Connect envoyé. La personne peut maintenant activer son accès.')
      }
      await loadData()
    } catch (updateError) {
      setError(updateError instanceof Error && updateError.name === 'AbortError'
        ? 'La mise à jour a pris trop de temps. Actualisez la page avant de réessayer.'
        : updateError instanceof Error ? updateError.message : 'Mise à jour impossible')
    } finally {
      setSaving(null)
    }
  }

  async function deletePartner(partner: Partner) {
    const key = `delete:${partner.id}`
    setSaving(key)
    setError('')
    setNotice('')

    try {
      const response = await fetchWithTimeout('/api/dashboard/sales-partners', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: partner.id }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Suppression impossible')

      setData((current) => {
        if (!current) return current
        const partners = current.partners.filter((item) => item.id !== partner.id)
        return {
          ...current,
          partners,
          summary: {
            ...current.summary,
            activePartners: partners.filter((item) => item.status === 'active').length,
          },
        }
      })
      setConfirmDeleteId(null)
      setNotice(`${partner.fullName} a été supprimé de STRYV Connect.`)
    } catch (deleteError) {
      setError(deleteError instanceof Error && deleteError.name === 'AbortError'
        ? 'La suppression a pris trop de temps. Actualisez la page avant de réessayer.'
        : deleteError instanceof Error ? deleteError.message : 'Suppression impossible')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="rounded-[28px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_45%,rgba(92,98,104,0.16)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">STRYV Connect</p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-white">Partenaires, attribution et commissions</h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-5 text-white/55">Ajoutez un partenaire, coupez son accès si nécessaire et attribuez la vente complète au bon closer avant le deuxième paiement du coach.</p>
        </div>
        <button type="button" onClick={() => void loadData()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 text-[11px] font-semibold text-white/72 hover:bg-white/[0.08] hover:text-white"><RefreshCw size={14} /> Actualiser</button>
      </div>

      <form onSubmit={invitePartner} className="mt-5 grid gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">Nom du commercial</span><input required name="fullName" className="h-10 w-full rounded-xl border border-white/[0.10] bg-black/20 px-3 text-[12px] text-white outline-none focus:border-white/45" placeholder="Prénom Nom" /></label>
        <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">E-mail du partenaire</span><input required name="email" type="email" className="h-10 w-full rounded-xl border border-white/[0.10] bg-black/20 px-3 text-[12px] text-white outline-none focus:border-white/45" placeholder="nom@exemple.com" /></label>
        <button disabled={saving === 'invite'} className="mt-[22px] inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#111315] disabled:opacity-55">{saving === 'invite' ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Ajouter</button>
      </form>

      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-300/15 bg-red-400/[0.08] px-4 py-3 text-[12px] text-red-100">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08] px-4 py-3 text-[12px] leading-5 text-emerald-100">{notice}</p> : null}
      {loading ? <div className="mt-5 h-48 animate-pulse rounded-2xl bg-white/[0.04]" /> : <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStat label="Commerciaux actifs" value={data?.summary.activePartners ?? 0} icon={<UsersRound size={14} />} />
          <AdminStat label="Prospects ouverts" value={data?.summary.openLeads ?? 0} icon={<Send size={14} />} />
          <AdminStat label="Coachs en essai" value={data?.summary.trialingLeads ?? 0} icon={<RefreshCw size={14} />} />
          <AdminStat label="Coachs actifs" value={data?.summary.activeCoaches ?? 0} icon={<CircleDollarSign size={14} />} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.25fr]">
          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
            <p className="text-[12px] font-semibold text-white">Équipe commerciale</p>
            <div className="mt-3 space-y-2">
              {data?.partners.length ? data.partners.map((partner) => (
                <PartnerCard
                  key={partner.id}
                  partner={partner}
                  busy={saving === partner.id || saving === `delete:${partner.id}`}
                  confirmingDelete={confirmDeleteId === partner.id}
                  onToggleStatus={() => void update({ action: 'set_status', partnerId: partner.id, status: partner.status === 'active' ? 'suspended' : 'active' }, partner.id)}
                  onResendActivation={() => void update({ action: 'resend_activation', partnerId: partner.id }, partner.id)}
                  onAskDelete={() => setConfirmDeleteId(partner.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onDelete={() => void deletePartner(partner)}
                />
              )) : <p className="py-6 text-center text-[12px] text-white/40">Aucun commercial invité.</p>}
            </div>
          </div>
          
          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
            <div>
              <p className="text-[12px] font-semibold text-white">Attribution et réconciliation des prospects</p>
              <p className="mt-1 text-[10px] text-white/38">
                Attribuez un closer (bonus) et associez manuellement un compte coach STRYV à chaque lead.
              </p>
            </div>
            
            <div className="mt-3 space-y-3">
              {data?.leads.length ? data.leads.map((lead) => (
                <article key={lead.id} className="grid gap-3 rounded-xl border border-white/[0.055] bg-white/[0.025] px-3.5 py-3 md:grid-cols-[1.2fr_1fr_1fr]">
                  <div className="min-w-0 flex flex-col justify-center">
                    <p className="truncate text-[12px] font-semibold text-white/88">{lead.contactName}</p>
                    <p className="truncate text-[10px] text-white/38">
                      {lead.companyName || lead.email} · Apport : {partnerNames.get(lead.introducerId) ?? '—'}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/30">Closer (Bonus)</span>
                    <select
                      value={lead.closingPartnerId ?? ''}
                      disabled={saving === lead.id}
                      onChange={(event) => void update({ action: 'assign_closer', leadId: lead.id, closingPartnerId: event.target.value || null }, lead.id)}
                      className="h-8 w-full rounded-lg border border-white/[0.09] bg-[#161616] px-2 text-[10px] text-white outline-none focus:border-white/45"
                    >
                      <option value="">Simple apport (Pas de closer)</option>
                      {activePartners.map((partner) => (
                        <option key={partner.id} value={partner.id}>{partner.fullName}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/30">Liaison Coach STRYV</span>
                    <select
                      value={lead.coachId ?? ''}
                      disabled={saving === lead.id}
                      onChange={(event) => void update({ action: 'link_coach', leadId: lead.id, coachId: event.target.value || null }, lead.id)}
                      className="h-8 w-full rounded-lg border border-white/[0.09] bg-[#161616] px-2 text-[10px] text-white outline-none focus:border-white/45"
                    >
                      <option value="">Non lié (Prospect uniquement)</option>
                      {data?.coaches.map((c) => (
                        <option key={c.coach_id} value={c.coach_id}>
                          {c.full_name} ({c.pro_email})
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              )) : (
                <p className="py-6 text-center text-[12px] text-white/40">Les prospects apparaîtront ici.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/20 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-white">Gestion des versements de commissions</p>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/50">
              {data?.commissions.length ?? 0} au total
            </span>
          </div>
          
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[11px] text-white/70">
              <thead>
                <tr className="border-b border-white/10 text-[9px] uppercase tracking-[0.1em] text-white/36">
                  <th className="py-2.5">Partenaire</th>
                  <th className="py-2.5">Description</th>
                  <th className="py-2.5 text-right">Montant</th>
                  <th className="py-2.5 text-center">Statut</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data?.commissions.length ? data.commissions.map((comm) => {
                  const partnerName = partnerNames.get(comm.sales_partner_id) ?? '—'
                  return (
                    <tr key={comm.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3 font-medium text-white">{partnerName}</td>
                      <td className="py-3 text-white/50">{comm.description}</td>
                      <td className="py-3 text-right font-semibold text-white">{formatCurrency(Number(comm.amount_eur))}</td>
                      <td className="py-3 text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.05em] ${
                          comm.status === 'paid' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {comm.status === 'paid' ? 'Versée' : 'Validée'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {comm.status !== 'paid' ? (
                          <button
                            disabled={saving === comm.id}
                            onClick={() => void update({ action: 'mark_paid', commissionId: comm.id, status: 'paid' }, comm.id)}
                            className="inline-flex h-7 items-center justify-center rounded-lg bg-white px-2.5 text-[9px] font-bold uppercase tracking-[0.05em] text-[#111315] hover:bg-white/80 disabled:opacity-50 transition"
                          >
                            {saving === comm.id ? <Loader2 size={10} className="animate-spin" /> : 'Marquer versée'}
                          </button>
                        ) : (
                          <button
                            disabled={saving === comm.id}
                            onClick={() => void update({ action: 'mark_paid', commissionId: comm.id, status: 'approved' }, comm.id)}
                            className="text-[9px] text-white/40 hover:text-white/60 transition underline"
                          >
                            Annuler versement
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-white/30">Aucune commission enregistrée.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </section>
  )
}

function PartnerCard({
  partner,
  busy,
  confirmingDelete,
  onToggleStatus,
  onResendActivation,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  partner: Partner
  busy: boolean
  confirmingDelete: boolean
  onToggleStatus: () => void
  onResendActivation: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  return (
    <article className="rounded-xl border border-white/[0.055] bg-white/[0.025] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-white/88">{partner.fullName}</p>
          <p className="truncate text-[10px] text-white/38">{partner.email}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onToggleStatus}
          aria-label={partner.status === 'active' ? `Suspendre ${partner.fullName}` : `Réactiver ${partner.fullName}`}
          className={`rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] disabled:opacity-50 ${partner.status === 'active' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/[0.07] text-white/45'}`}
        >
          {partner.status === 'active' ? 'Actif' : 'Suspendu'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/43">
        <span>{partner.introducedLeads} apports</span>
        <span>{partner.closingAssignments} closings</span>
        <span>{formatCurrency(partner.pendingCommission)} à venir</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {partner.needsActivation ? (
          <button type="button" disabled={busy} onClick={onResendActivation} className="inline-flex h-9 items-center rounded-lg border border-white/[0.10] px-3 text-[10px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50">
            Renvoyer l’activation
          </button>
        ) : null}

        {!confirmingDelete ? (
          <button type="button" disabled={busy} onClick={onAskDelete} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[10px] font-semibold text-red-200/65 transition hover:bg-red-400/10 hover:text-red-100 disabled:opacity-50">
            <Trash2 size={13} /> Supprimer
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300/15 bg-red-400/[0.07] p-2">
            <span className="px-1 text-[10px] text-red-100/75">Supprimer définitivement ?</span>
            <button type="button" disabled={busy} onClick={onDelete} className="inline-flex h-8 items-center gap-2 rounded-md bg-red-300 px-3 text-[9px] font-bold uppercase tracking-[0.08em] text-red-950 disabled:opacity-50">
              {busy ? <Loader2 size={12} className="animate-spin" /> : null} Confirmer
            </button>
            <button type="button" disabled={busy} onClick={onCancelDelete} className="h-8 rounded-md px-3 text-[10px] text-white/55 hover:bg-white/[0.05] hover:text-white">
              Annuler
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function AdminStat({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"><div className="flex items-center gap-2 text-white/60"><span>{icon}</span><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">{label}</p></div><p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p></div>
}
