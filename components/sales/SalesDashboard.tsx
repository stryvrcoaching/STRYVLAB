'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, CalendarClock, CircleDollarSign, RefreshCw, UsersRound } from 'lucide-react'

type DashboardData = {
  partnerId: string
  kpis: { openPipeline: number; demosScheduled: number; coachesInTrial: number; activeCoaches: number; pendingCommissions: number; paidCommissions: number }
  pipeline: Record<string, number>
  upcomingTasks: Array<{ id: string; title: string; kind: string; due_at: string | null }>
  recentLeads: Array<{ id: string; contact_name: string; email: string; company_name: string | null; status: string; next_follow_up_at: string | null }>
  recentCommissions: Array<{ id: string; amount_eur: number; status: string; description: string; eligible_at: string | null; paid_at: string | null }>
}

const statusLabels: Record<string, string> = {
  new: 'Nouveaux', contacted: 'Contactés', qualified: 'Qualifiés', demo_scheduled: 'Démos', trialing: 'Essais', active: 'Actifs', lost: 'Perdus',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return 'Sans échéance'
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function SalesDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/sales/dashboard', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Chargement impossible')
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  if (loading) return <div className="h-72 animate-pulse rounded-[28px] border border-white/[0.06] bg-white/[0.035]" />
  if (error || !data) return <div className="rounded-[28px] border border-red-300/15 bg-red-400/[0.06] p-6"><p className="text-sm text-red-100">{error || 'Chargement impossible'}</p><button onClick={() => void loadData()} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-white"><RefreshCw size={14} /> Réessayer</button></div>

  const referralLink = data ? `${typeof window !== 'undefined' ? window.location.origin : ''}/coaches?ref=${data.partnerId}` : ''

  const copyToClipboard = () => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const metricCards = [
    { label: 'Pipeline ouvert', value: data.kpis.openPipeline, detail: 'prospects à faire avancer', icon: UsersRound },
    { label: 'Démos planifiées', value: data.kpis.demosScheduled, detail: 'rendez-vous à préparer', icon: CalendarClock },
    { label: 'Coachs en essai', value: data.kpis.coachesInTrial, detail: 'à accompagner vers l’activation', icon: ArrowRight },
    { label: 'Commissions à venir', value: formatCurrency(data.kpis.pendingCommissions), detail: 'en attente ou validées', icon: CircleDollarSign },
  ]

  return (
    <div className="space-y-8 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-xl [&_a]:focus-visible:outline [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-white">
      <section className="flex flex-col justify-between gap-5 rounded-[28px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_45%,rgba(92,98,104,0.16)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] sm:flex-row sm:items-end sm:p-8">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/42">Pilotage commercial</p><h1 className="mt-3 font-barlow text-4xl font-semibold uppercase leading-[0.9] tracking-[-0.04em] sm:text-5xl">Votre prochaine<br /><span className="text-white/38">décision.</span></h1><p className="mt-4 max-w-xl text-sm leading-6 text-white/55">Suivez votre portefeuille STRYV, gardez le rythme des relances et visualisez les activations qui comptent.</p></div>
        <Link href="/sales/leads" className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#f2f2f2] px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#111315] transition hover:bg-white sm:h-11 sm:w-auto">Ajouter un prospect <ArrowRight size={15} /></Link>
      </section>

      <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1f8a65]">Affiliation</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Votre lien de recommandation</h2>
        <p className="mt-2 text-xs leading-relaxed text-white/55">
          Partagez ce lien avec des entraîneurs et des clubs. Tout coach s'inscrivant via ce lien sera automatiquement attribué à votre portefeuille.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={referralLink}
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/[0.10] bg-black/20 px-3 text-xs text-white outline-none focus:border-[#1f8a65]"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={copyToClipboard}
            type="button"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#1f8a65]/10 px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1f8a65] hover:bg-[#1f8a65]/20 transition"
          >
            {copied ? 'Copié !' : 'Copier le lien'}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => { const Icon = metric.icon; return <article key={metric.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.028] p-5"><Icon size={16} className="text-white/60" /><p className="mt-6 text-3xl font-semibold tracking-tight text-white">{metric.value}</p><p className="mt-1 text-[12px] font-semibold text-white/75">{metric.label}</p><p className="mt-1 text-[11px] leading-5 text-white/38">{metric.detail}</p></article> })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/36">Pipeline</p><h2 className="mt-1 text-lg font-semibold">Où en sont vos prospects</h2></div><Link href="/sales/leads" className="text-[11px] font-semibold text-white/60 hover:text-white">Voir les prospects</Link></div><div className="mt-6 grid gap-2 sm:grid-cols-2">{Object.entries(data.pipeline).filter(([status]) => status !== 'archived').map(([status, value]) => <div key={status} className="flex items-center justify-between rounded-xl border border-white/[0.055] bg-black/15 px-4 py-3"><span className="text-[12px] text-white/58">{statusLabels[status] ?? status}</span><span className="text-[15px] font-semibold">{value}</span></div>)}</div></article>
        <article className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/36">À faire</p><h2 className="mt-1 text-lg font-semibold">Prochaines actions</h2></div><Link href="/sales/tasks" className="text-[11px] font-semibold text-white/60 hover:text-white">Gérer</Link></div><div className="mt-5 space-y-2">{data.upcomingTasks.length ? data.upcomingTasks.map((task) => <div key={task.id} className="rounded-xl border border-white/[0.055] bg-black/15 px-4 py-3"><p className="text-[13px] font-medium text-white/85">{task.title}</p><p className="mt-1 text-[11px] text-white/40">{formatDate(task.due_at)}</p></div>) : <p className="rounded-xl border border-dashed border-white/[0.09] px-4 py-6 text-center text-[12px] leading-5 text-white/42">Aucune action à faire. Créez une relance pour garder le rythme.</p>}</div></article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/36">Portefeuille</p><h2 className="mt-1 text-lg font-semibold">Derniers prospects</h2></div><Link href="/sales/leads" className="text-[11px] font-semibold text-white/60 hover:text-white">Tout voir</Link></div><div className="mt-5 divide-y divide-white/[0.055]">{data.recentLeads.length ? data.recentLeads.map((lead) => <div key={lead.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-[13px] font-medium text-white/85">{lead.contact_name}</p><p className="truncate text-[11px] text-white/40">{lead.company_name || lead.email}</p></div><span className="shrink-0 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-white/55">{statusLabels[lead.status] ?? lead.status}</span></div>) : <p className="py-7 text-center text-[12px] text-white/42">Votre portefeuille apparaîtra ici.</p>}</div></article>
        <article className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/36">Rémunération</p><h2 className="mt-1 text-lg font-semibold">Dernières commissions</h2></div><Link href="/sales/commissions" className="text-[11px] font-semibold text-white/60 hover:text-white">Voir le détail</Link></div><div className="mt-5 divide-y divide-white/[0.055]">{data.recentCommissions.length ? data.recentCommissions.map((commission) => <div key={commission.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-[13px] font-medium text-white/85">{commission.description}</p><p className="mt-1 text-[11px] text-white/40">{commission.status === 'paid' ? 'Versée' : commission.status === 'approved' ? 'Validée' : 'En attente'}</p></div><span className="text-[14px] font-semibold text-white">{formatCurrency(Number(commission.amount_eur))}</span></div>) : <p className="py-7 text-center text-[12px] text-white/42">Les commissions validées par STRYV apparaîtront ici.</p>}</div></article>
      </section>
    </div>
  )
}
