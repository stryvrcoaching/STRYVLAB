'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, ArrowRight, Brain, BriefcaseBusiness, MessageSquareQuote, RefreshCw, Shield, Sparkles, UsersRound, Zap } from 'lucide-react'
import { useSetTopBar } from '@/components/layout/useSetTopBar'
import { InlineInfoTooltip } from '@/components/dashboard/InlineInfoTooltip'

type OverviewPayload = {
  generatedAt: string
  kpis: {
    openFeedback: number
    criticalFeedback: number
    prodErrors24h: number
    llmErrors24h: number
    p95LatencyMs: number | null
    deniedAccess7d: number
    dau7d: number
    activationCount7d: number
  }
  priorities: Array<{ label: string; count: number; severity: 'critical' | 'high' | 'medium' | 'low' }>
  topPages: Array<{ page: string; count: number }>
  incidents: Array<{
    id: string
    severity: string
    status: string
    title: string
    source: string
    route: string | null
    opened_at: string
  }>
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function severityTone(value: string) {
  if (value === 'critical') return 'text-red-200 bg-red-500/12 border-red-500/20'
  if (value === 'high') return 'text-orange-200 bg-orange-500/12 border-orange-500/20'
  if (value === 'medium') return 'text-amber-100 bg-amber-500/12 border-amber-500/20'
  return 'text-emerald-100 bg-emerald-500/12 border-emerald-500/20'
}

export default function OverviewDashboardPage() {
  const [data, setData] = useState<OverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useSetTopBar(
    <div className="flex flex-col leading-tight">
      <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/30">Interne</p>
      <p className="text-[13px] font-semibold text-white">Vue d’ensemble</p>
    </div>,
  )

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/overview')
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? 'Chargement impossible')
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return <main className="min-h-screen bg-[#121212] px-3 py-5 sm:p-6"><div className="mx-auto h-[760px] max-w-[1520px] animate-pulse rounded-3xl bg-white/[0.03]" /></main>
  }

  return (
    <main className="min-h-screen bg-[#121212] px-3 py-5 sm:p-6">
      <div className="mx-auto max-w-[1520px] space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,#1b1b1b_0%,#141414_100%)] p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-[820px]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Centre de pilotage</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-white">Vue d’ensemble du projet</h1>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
                  Sync {data ? formatDate(data.generatedAt) : '—'}
                </span>
              </div>
              <p className="mt-3 max-w-[700px] text-[13px] leading-6 text-white/58">
                Les décisions qui demandent votre attention, puis un accès direct à chaque espace spécialisé pour agir sans chercher l’information.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.05] px-4 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              <RefreshCw size={14} />
              <span>Rafraîchir</span>
            </button>
          </div>
        </section>

        <section aria-labelledby="workspaces-title">
          <div className="mb-3">
            <h2 id="workspaces-title" className="text-[15px] font-semibold text-white">Choisir un espace</h2>
            <p className="mt-1 text-[12px] text-white/38">Une responsabilité claire par page.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <WorkspaceLink href="/dashboard/business" icon={<BriefcaseBusiness size={16} />} title="Business" description="Revenus, acquisition et coût IA" />
            <WorkspaceLink href="/dashboard/product-feedback" icon={<MessageSquareQuote size={16} />} title="Produit" description="Retours, priorités et backlog" />
            <WorkspaceLink href="/dashboard/stryv-connect" icon={<UsersRound size={16} />} title="STRYV Connect" description="Équipe commerciale et attribution" />
            <WorkspaceLink href="/dashboard/security" icon={<Shield size={16} />} title="Sécurité" description="Accès, alertes et incidents" />
            <WorkspaceLink href="/dashboard/ai-nutrition-ops" icon={<Brain size={16} />} title="Opérations IA" description="Qualité du parsing nutrition" />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Backlog ouvert" value={data?.kpis.openFeedback ?? 0} help="Nombre total de retours encore ouverts et non absorbés dans le flux produit." />
          <StatCard label="Critiques produit" value={data?.kpis.criticalFeedback ?? 0} help="Retours classés critiques, à traiter avant le reste du backlog." />
          <StatCard label="Erreurs prod 24h" value={data?.kpis.prodErrors24h ?? 0} help="Volume d’incidents ou d’erreurs production observés sur les dernières 24 heures." />
          <StatCard label="Refus sécurité 7j" value={data?.kpis.deniedAccess7d ?? 0} help="Tentatives d’accès refusées sur 7 jours, utile pour détecter une pression anormale." />
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <SignalCard icon={<Sparkles size={15} />} label="Produit" title={`${data?.kpis.openFeedback ?? 0} sujets ouverts`} detail={`${data?.kpis.criticalFeedback ?? 0} critiques · ${data?.topPages?.[0]?.page ?? 'aucune page dominante'}`} help="Résumé rapide de la pression backlog et du principal hotspot produit." />
          <SignalCard icon={<Zap size={15} />} label="Fiabilité" title={`${data?.kpis.prodErrors24h ?? 0} incidents 24h`} detail={`${data?.kpis.llmErrors24h ?? 0} erreurs LLM · P95 ${data?.kpis.p95LatencyMs ?? '—'} ms`} help="Lecture condensée du risque technique: erreurs, LLM et latence perçue." />
          <SignalCard icon={<Activity size={15} />} label="Adoption" title={`${data?.kpis.dau7d ?? 0} utilisateurs actifs 7j`} detail={`${data?.kpis.activationCount7d ?? 0} activations récentes`} help="Mesure si le produit est réellement utilisé et si l’onboarding convertit." />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Priorités immédiates" subtitle="Pages et sujets à traiter en premier" help="Classement agrégé des urgences produit à traiter avant le reste." >
            <div className="space-y-2">
              {(data?.priorities ?? []).map((item) => (
                <div key={item.label} className="rounded-2xl bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-white">{item.label}</p>
                      <p className="mt-1 text-[11px] text-white/35">{item.count} signaux agrégés</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] ${severityTone(item.severity)}`}>{item.severity}</span>
                  </div>
                </div>
              ))}
              {(data?.priorities ?? []).length === 0 ? <EmptyState label="Aucune priorité calculée." /> : null}
            </div>
          </Panel>

          <Panel title="Pages les plus citées" subtitle="Où concentrer les itérations" help="Écrans revenant le plus souvent dans les retours ou incidents." >
            <div className="space-y-2">
              {(data?.topPages ?? []).map((item) => (
                <div key={item.page} className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <p className="truncate pr-4 text-[12px] text-white/82">{item.page}</p>
                  <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[11px] text-white/60">{item.count}</span>
                </div>
              ))}
              {(data?.topPages ?? []).length === 0 ? <EmptyState label="Aucun hotspot page." /> : null}
            </div>
          </Panel>
        </section>

        <Panel title="Incidents récents" subtitle="Vision consolidée des incidents ouverts" help="Liste consolidée des incidents encore visibles dans le radar opérationnel." >
          <div className="grid gap-3 xl:grid-cols-2">
            {(data?.incidents ?? []).map((incident) => (
              <div key={incident.id} className="rounded-2xl bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-white">{incident.title}</p>
                    <p className="mt-1 text-[11px] text-white/35">{incident.source} · {incident.status} · {formatDate(incident.opened_at)}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[10px] ${severityTone(incident.severity)}`}>{incident.severity}</span>
                </div>
                {incident.route ? <p className="mt-3 text-[12px] text-white/60">{incident.route}</p> : null}
              </div>
            ))}
            {(data?.incidents ?? []).length === 0 ? <EmptyState label="Aucun incident récent." /> : null}
          </div>
        </Panel>

        {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">{error}</div> : null}
      </div>
    </main>
  )
}

function WorkspaceLink({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="group min-w-0 rounded-2xl border border-white/[0.06] bg-[#181818] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.045] focus:outline-none focus:ring-2 focus:ring-white/20">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/70">{icon}</span>
        <ArrowRight size={14} className="text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
      </div>
      <p className="mt-4 text-[13px] font-semibold text-white">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-white/42">{description}</p>
    </Link>
  )
}

function Panel({ title, subtitle, help, children }: { title: string; subtitle?: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/[0.06] bg-[#181818] p-5">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-semibold text-white">{title}</p>
          {help ? <InlineInfoTooltip title={title} body={help} /> : null}
        </div>
        {subtitle ? <p className="text-[12px] text-white/35">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function StatCard({ label, value, help }: { label: string; value: number; help?: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.06] bg-black/20 px-5 py-4">
      <div className="flex items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
        {help ? <InlineInfoTooltip title={label} body={help} /> : null}
      </div>
      <p className="mt-2 text-[26px] font-semibold tracking-tight text-white">{value}</p>
    </div>
  )
}

function SignalCard({ icon, label, title, detail, help }: { icon: React.ReactNode; label: string; title: string; detail: string; help?: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-center gap-2 text-white/70">
        {icon}
        <p className="text-[11px] uppercase tracking-[0.16em]">{label}</p>
        {help ? <InlineInfoTooltip title={label} body={help} /> : null}
      </div>
      <p className="mt-4 text-[16px] font-semibold text-white">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-white/50">{detail}</p>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-[13px] text-white/35">
      <AlertTriangle size={16} className="mx-auto mb-2 opacity-55" />
      {label}
    </div>
  )
}
