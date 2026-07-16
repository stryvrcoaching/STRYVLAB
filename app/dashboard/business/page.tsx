'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Coins, RefreshCw, TrendingUp, Users, Waypoints } from 'lucide-react'
import { useSetTopBar } from '@/components/layout/useSetTopBar'
import { InlineInfoTooltip } from '@/components/dashboard/InlineInfoTooltip'
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav'

type BusinessPayload = {
  generatedAt: string
  kpis: {
    totalClients: number
    activeClients: number
    totalCoaches: number
    activeCoaches: number
    avgClientsPerCoach: number
    activeSubscriptions: number
    trialSubscriptions: number
    paidRevenueMonth: number
    paidRevenue30d: number
    mrr: number
    avgRevenuePerCoachMonth: number
    pendingPayments: number
    failedPayments: number
  }
  coachEconomics: Array<{
    coachId: string
    name: string
    clientsTotal: number
    clientsActive: number
    activeSubscriptions: number
    trialSubscriptions: number
    revenueMonth: number
    revenue30d: number
    mrr: number
  }>
  acquisition: {
    waitlistTotal: number
    waitlist30d: number
    demoRequests30d: number
    productEventsTracked: boolean
    trackedEvents30d: number
    uniqueTrackedUsers30d: number
    consentedVisitors30d: number
    sources: Array<{ source: string; count: number }>
    topEvents: Array<{ label: string; count: number }>
    topFeatures: Array<{ label: string; count: number }>
    funnels: Array<{
      source: string
      landingViews: number
      ctaClicks: number
      formStarts: number
      leadsSubmitted: number
      leadRate: number
    }>
    topAttribution: Array<{
      label: string
      visitors: number
      leads: number
      leadRate: number
    }>
  }
  sales: {
    coachLeads30d: number
    demoRequests30d: number
    coachSignups30d: number
    coachSignupsPrev30d: number
    coachTrialing: number
    coachActivePaid: number
    coachPastDue: number
    coachWithStripeCheckout: number
    coachWithStripeCustomer: number
    payingCoachCount: number
    leadToSignupRate: number
    signupToPaidRate: number
    demoToWonRate: number
    followUpsDue: number
    unassignedLeads: number
    staleLeads: number
    pipelineStages: Array<{ label: string; count: number }>
    recentCoachLeads: Array<{
      id: string
      email: string
      source: string
      leadStatus: string
      ownerEmail: string | null
      priority: string
      createdAt: string
      nextFollowUpAt: string | null
      notes: string | null
    }>
    crmLeads: Array<{
      id: string
      email: string
      source: string
      leadStatus: string
      ownerEmail: string | null
      priority: string
      createdAt: string
      nextFollowUpAt: string | null
      notes: string | null
    }>
    planMix: Array<{ plan: string; count: number }>
  }
  growth: {
    leads30d: number
    leadsPrev30d: number
    coachSignups30d: number
    coachSignupsPrev30d: number
    clients30d: number
    clientsPrev30d: number
    revenue30d: number
    revenuePrev30d: number
    llmCost30d: number
    llmCostPrev30d: number
    leadsDelta: number
    coachSignupsDelta: number
    clientsDelta: number
    revenueDelta: number
    llmCostDelta: number
  }
  unitEconomics: {
    revenuePerActiveClient30d: number
    revenuePerActiveCoach30d: number
    llmCostPerActiveClient30d: number
    llmCostPerCoach30d: number
    avgRevenuePerSubscription30d: number
    llmCostToRevenueRatio30d: number
  }
  llm: {
    requests24h: number
    requests30d: number
    tokensIn30d: number
    tokensOut30d: number
    cost24hEur: number
    cost30dEur: number
    avgCostPerRequest30dEur: number
    errors24h: number
    errorRate24h: number
    bySurface: Array<{
      surface: string
      requests: number
      tokensIn: number
      tokensOut: number
      costEur: number
      errors: number
      avgLatencyMs: number | null
    }>
  }
  ipt: {
    tracked: boolean
    totalSessions: number
    completedSessions: number
    purchasesTracked: boolean
    purchases30d: number
    purchaseRevenue30d: number
  }
  instrumentation: {
    landingTrafficTracked: boolean
    demoRequestsTracked: boolean
    llmCostingMode: string
    notes: string[]
    warnings: string[]
  }
  measurement: {
    score: number
    verdict: string
    categories: Array<{ label: string; score: number; max: number }>
  }
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: value < 1 ? 4 : 0 }).format(value)
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

function formatDelta(value: number, reverse = false) {
  const positive = reverse ? value <= 0 : value >= 0
  const sign = value > 0 ? '+' : ''
  const tone = positive ? 'text-emerald-300' : 'text-amber-300'
  return <span className={tone}>{`${sign}${formatNumber(value * 100, 1)}% vs période précédente`}</span>
}

function boolTone(value: boolean) {
  return value ? 'text-emerald-100 border-emerald-500/20 bg-emerald-500/10' : 'text-amber-100 border-amber-500/20 bg-amber-500/10'
}

export default function BusinessDashboardPage() {
  const [data, setData] = useState<BusinessPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')

  useSetTopBar(
    <div className="flex flex-col leading-tight">
      <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/30">Interne</p>
      <p className="text-[13px] font-semibold text-white">Pilotage business</p>
    </div>,
  )

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/business')
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

  async function updateLead(input: {
    leadId: string
    leadStatus: string
    priority: string
    ownerEmail: string
    nextFollowUpAt: string
    notes: string
  }) {
    setSavingLeadId(input.leadId)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/business/leads/${input.leadId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? 'Mise à jour impossible')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible')
    } finally {
      setSavingLeadId(null)
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#121212] px-3 py-5 sm:p-6"><div className="mx-auto h-[760px] max-w-[1520px] animate-pulse rounded-3xl bg-white/[0.03]" /></main>
  }

  const crmLeads = data?.sales.crmLeads ?? []
  const ownerOptions = Array.from(new Set(crmLeads.map((lead) => lead.ownerEmail?.trim()).filter(Boolean))) as string[]
  const filteredCrmLeads = crmLeads.filter((lead) => {
    if (statusFilter !== 'all' && lead.leadStatus !== statusFilter) return false
    if (priorityFilter !== 'all' && lead.priority !== priorityFilter) return false
    if (ownerFilter !== 'all' && (lead.ownerEmail ?? 'unassigned') !== ownerFilter) return false
    return true
  })
  const leadsByStatus = LEAD_STATUSES.map((status) => ({
    status,
    leads: filteredCrmLeads.filter((lead) => lead.leadStatus === status),
  }))

  return (
    <main className="min-h-screen bg-[#121212] px-3 py-5 sm:p-6">
      <div className="mx-auto max-w-[1520px] space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,#1b1b1b_0%,#141414_100%)] p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-[920px]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Business Cockpit</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-white">Pilotage business du produit</h1>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
                  Sync {data ? formatDate(data.generatedAt) : '—'}
                </span>
              </div>
              <p className="mt-3 max-w-[760px] text-[13px] leading-6 text-white/58">
                Vision consolidée business, acquisition et économie IA. Le but est d’arbitrer croissance, monétisation et coûts d’exploitation depuis un seul cockpit.
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

        <DashboardSectionNav items={[
          { id: 'business-summary', label: 'Synthèse', description: 'Chiffres essentiels' },
          { id: 'business-growth', label: 'Croissance', description: 'Évolution et rentabilité' },
          { id: 'business-coaches', label: 'Coachs', description: 'Contribution et revenus' },
          { id: 'business-acquisition', label: 'Acquisition', description: 'Demande et coût IA' },
          { id: 'business-sales', label: 'Commercial', description: 'Pipeline et suivi' },
        ]} />

        <section id="business-summary" className="scroll-mt-40 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Clients" value={formatNumber(data?.kpis.totalClients ?? 0)} detail={`${formatNumber(data?.kpis.activeClients ?? 0)} actifs`} help="Volume total de clients gérés par les coachs sur la plateforme." />
          <StatCard label="Coachs" value={formatNumber(data?.kpis.totalCoaches ?? 0)} detail={`${formatNumber(data?.kpis.activeCoaches ?? 0)} actifs`} help="Nombre de coachs présents, avec une vue sur ceux qui génèrent une activité réelle." />
          <StatCard label="Clients / coach" value={formatNumber(data?.kpis.avgClientsPerCoach ?? 0, 1)} detail="moyenne portefeuille" help="Taille moyenne du portefeuille client par coach." />
          <StatCard label="MRR estimé" value={formatCurrency(data?.kpis.mrr ?? 0)} detail={`${formatNumber(data?.kpis.activeSubscriptions ?? 0)} abonnements actifs`} help="Projection de revenu mensuel récurrent issue des abonnements actifs ou trial valorisés." />
          <StatCard label="Revenu mois" value={formatCurrency(data?.kpis.paidRevenueMonth ?? 0)} detail={`${formatCurrency(data?.kpis.avgRevenuePerCoachMonth ?? 0)} / coach`} help="Encaissement observé sur le mois courant, hors simple projection MRR." />
          <StatCard label="Coût LLM 30j" value={formatCurrency(data?.llm.cost30dEur ?? 0)} detail={`${formatNumber(data?.llm.requests30d ?? 0)} requêtes`} help="Estimation du coût IA sur 30 jours à partir des tokens persistés." />
        </section>

        <section id="business-growth" className="scroll-mt-40 grid items-start gap-6 xl:grid-cols-2">
          <Panel title="Croissance 30j vs 30j précédents" subtitle="Lecture rapide volume, revenu et coût" help="Compare la période récente à la précédente pour juger la dynamique business." >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricTrend label="Leads" value={formatNumber(data?.growth.leads30d ?? 0)} delta={data?.growth.leadsDelta ?? 0} />
              <MetricTrend label="Signups coach" value={formatNumber(data?.growth.coachSignups30d ?? 0)} delta={data?.growth.coachSignupsDelta ?? 0} />
              <MetricTrend label="Clients créés" value={formatNumber(data?.growth.clients30d ?? 0)} delta={data?.growth.clientsDelta ?? 0} />
              <MetricTrend label="Revenu 30j" value={formatCurrency(data?.growth.revenue30d ?? 0)} delta={data?.growth.revenueDelta ?? 0} />
              <MetricTrend label="Coût LLM 30j" value={formatCurrency(data?.growth.llmCost30d ?? 0)} delta={data?.growth.llmCostDelta ?? 0} reverse />
            </div>
          </Panel>

          <Panel title="Unit economics" subtitle="Rentabilité réelle d’usage et monétisation" help="Montre si la monétisation couvre bien l’usage et le coût d’exploitation." >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricBlock label="CA / client actif 30j" value={formatCurrency(data?.unitEconomics.revenuePerActiveClient30d ?? 0)} />
              <MetricBlock label="CA / coach actif 30j" value={formatCurrency(data?.unitEconomics.revenuePerActiveCoach30d ?? 0)} />
              <MetricBlock label="CA / abonnement 30j" value={formatCurrency(data?.unitEconomics.avgRevenuePerSubscription30d ?? 0)} />
              <MetricBlock label="Coût LLM / client actif" value={formatCurrency(data?.unitEconomics.llmCostPerActiveClient30d ?? 0)} />
              <MetricBlock label="Coût LLM / coach" value={formatCurrency(data?.unitEconomics.llmCostPerCoach30d ?? 0)} />
              <MetricBlock label="Coût LLM / CA" value={`${formatNumber((data?.unitEconomics.llmCostToRevenueRatio30d ?? 0) * 100, 2)}%`} />
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <SignalCard icon={<Users size={15} />} label="Portefeuille" title={`${formatNumber(data?.kpis.totalClients ?? 0)} clients gérés`} detail={`${formatNumber(data?.kpis.activeSubscriptions ?? 0)} abonnements actifs · ${formatNumber(data?.kpis.trialSubscriptions ?? 0)} en trial`} help="Résumé du portefeuille client et du niveau de souscription actif." />
          <SignalCard icon={<TrendingUp size={15} />} label="Monétisation" title={formatCurrency(data?.kpis.paidRevenue30d ?? 0)} detail={`30 derniers jours · ${formatCurrency(data?.kpis.mrr ?? 0)} MRR`} help="Lecture condensée des revenus récents et du récurrent estimé." />
          <SignalCard icon={<Coins size={15} />} label="IA economics" title={formatCurrency(data?.llm.cost24hEur ?? 0)} detail={`24h · ${formatNumber(data?.llm.requests24h ?? 0)} requêtes · ${formatNumber((data?.llm.errorRate24h ?? 0) * 100, 1)}% erreurs`} help="Coût et qualité de l’exploitation IA sur les dernières 24 heures." />
        </section>

        <section id="business-coaches" className="scroll-mt-40 grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel title="Coachs les plus contributifs" subtitle="Portefeuille, MRR et revenu encaissé">
            <div className="space-y-3">
              {(data?.coachEconomics ?? []).map((coach) => (
                <div key={coach.coachId} className="rounded-2xl bg-black/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-white">{coach.name}</p>
                      <p className="mt-1 text-[11px] text-white/35">
                        {coach.clientsActive}/{coach.clientsTotal} clients actifs · {coach.activeSubscriptions} abonnements · {coach.trialSubscriptions} trial
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 md:min-w-[320px]">
                      <MiniMetric label="30j" value={formatCurrency(coach.revenue30d)} />
                      <MiniMetric label="Mois" value={formatCurrency(coach.revenueMonth)} />
                      <MiniMetric label="MRR" value={formatCurrency(coach.mrr)} />
                    </div>
                  </div>
                </div>
              ))}
              {(data?.coachEconomics ?? []).length === 0 ? <EmptyState label="Aucune donnée coach exploitable." /> : null}
            </div>
          </Panel>

          <Panel title="Monétisation" subtitle="Encaissement, risque paiement, traction abonnement">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricBlock label="Revenu encaissé 30j" value={formatCurrency(data?.kpis.paidRevenue30d ?? 0)} />
              <MetricBlock label="MRR actif" value={formatCurrency(data?.kpis.mrr ?? 0)} />
              <MetricBlock label="Paiements en attente" value={formatNumber(data?.kpis.pendingPayments ?? 0)} />
              <MetricBlock label="Paiements en échec" value={formatNumber(data?.kpis.failedPayments ?? 0)} />
              <MetricBlock label="Abonnements actifs" value={formatNumber(data?.kpis.activeSubscriptions ?? 0)} />
              <MetricBlock label="Abonnements trial" value={formatNumber(data?.kpis.trialSubscriptions ?? 0)} />
            </div>
          </Panel>
        </section>

        <section id="business-acquisition" className="scroll-mt-40 grid items-start gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Acquisition & demande" subtitle="Waitlist, sources et analytics disponibles">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricBlock label="Leads waitlist total" value={formatNumber(data?.acquisition.waitlistTotal ?? 0)} />
              <MetricBlock label="Leads waitlist 30j" value={formatNumber(data?.acquisition.waitlist30d ?? 0)} />
              <MetricBlock label="Demandes démo 30j" value={formatNumber(data?.acquisition.demoRequests30d ?? 0)} />
              <MetricBlock label="Visiteurs consentis 30j" value={formatNumber(data?.acquisition.consentedVisitors30d ?? 0)} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <SubList title="Sources de leads" items={(data?.acquisition.sources ?? []).map((item) => ({ label: item.source, value: item.count }))} emptyLabel="Aucune source disponible." />
              <SubList title="Top events produit" items={(data?.acquisition.topEvents ?? []).map((item) => ({ label: item.label, value: item.count }))} emptyLabel="Aucun event disponible." />
            </div>

            <div className="mt-4 space-y-2">
              {(data?.acquisition.funnels ?? []).map((item) => (
                <div key={item.source} className="rounded-2xl bg-black/20 px-4 py-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[12px] font-semibold text-white">{item.source}</p>
                      <p className="mt-1 text-[11px] text-white/35">
                        {formatNumber(item.landingViews)} vues · {formatNumber(item.ctaClicks)} CTA · {formatNumber(item.formStarts)} starts · {formatNumber(item.leadsSubmitted)} leads
                      </p>
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/65">
                      {formatNumber(item.leadRate * 100, 1)}%
                    </span>
                  </div>
                </div>
              ))}
              {(data?.acquisition.funnels ?? []).length === 0 ? <EmptyState label="Funnel acquisition indisponible." /> : null}
            </div>

            <div className="mt-4">
              <SubList
                title="Attribution first-touch"
                items={(data?.acquisition.topAttribution ?? []).map((item) => ({
                  label: `${item.label} · ${formatNumber(item.leadRate * 100, 1)}%`,
                  value: item.leads,
                }))}
                emptyLabel="Aucune attribution exploitable."
              />
            </div>
          </Panel>

          <Panel title="Économie LLM" subtitle="Volume, coût estimé et surfaces les plus consommatrices">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricBlock label="Requêtes 24h" value={formatNumber(data?.llm.requests24h ?? 0)} />
              <MetricBlock label="Requêtes 30j" value={formatNumber(data?.llm.requests30d ?? 0)} />
              <MetricBlock label="Coût 24h" value={formatCurrency(data?.llm.cost24hEur ?? 0)} />
              <MetricBlock label="Coût / requête" value={formatCurrency(data?.llm.avgCostPerRequest30dEur ?? 0)} />
            </div>

            <div className="mt-4 space-y-2">
              {(data?.llm.bySurface ?? []).map((surface) => (
                <div key={surface.surface} className="rounded-2xl bg-black/20 px-4 py-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[12px] font-semibold text-white">{surface.surface}</p>
                      <p className="mt-1 text-[11px] text-white/35">
                        {formatNumber(surface.requests)} requêtes · {formatNumber(surface.tokensIn)} in · {formatNumber(surface.tokensOut)} out · {surface.errors} erreurs
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-white/60">
                      <span>{surface.avgLatencyMs ? `${formatNumber(surface.avgLatencyMs)} ms` : 'latence —'}</span>
                      <span className="rounded-full bg-white/[0.06] px-2 py-1">{formatCurrency(surface.costEur)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {(data?.llm.bySurface ?? []).length === 0 ? <EmptyState label="Aucune trace LLM récente." /> : null}
            </div>
          </Panel>
        </section>

        <section id="business-sales" className="scroll-mt-40 grid items-start gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <Panel title="Pipeline CRM sales" subtitle="Lead → démo → signup → monétisation coach">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricBlock label="Leads coach 30j" value={formatNumber(data?.sales.coachLeads30d ?? 0)} />
              <MetricBlock label="Demandes démo 30j" value={formatNumber(data?.sales.demoRequests30d ?? 0)} />
              <MetricBlock label="Signups coach 30j" value={formatNumber(data?.sales.coachSignups30d ?? 0)} />
              <MetricBlock label="Coachs payants" value={formatNumber(data?.sales.coachActivePaid ?? 0)} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricBlock label="Lead → signup" value={`${formatNumber((data?.sales.leadToSignupRate ?? 0) * 100, 1)}%`} />
              <MetricBlock label="Signup → paid" value={`${formatNumber((data?.sales.signupToPaidRate ?? 0) * 100, 1)}%`} />
              <MetricBlock label="Démo → won" value={`${formatNumber((data?.sales.demoToWonRate ?? 0) * 100, 1)}%`} />
              <MetricBlock label="Trials coach" value={formatNumber(data?.sales.coachTrialing ?? 0)} />
              <MetricBlock label="Past due coach" value={formatNumber(data?.sales.coachPastDue ?? 0)} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <SubList
                title="Mix plans coach"
                items={(data?.sales.planMix ?? []).map((item) => ({
                  label: item.plan,
                  value: item.count,
                }))}
                emptyLabel="Aucun plan coach."
              />
              <SubList
                title="Étapes Stripe"
                items={[
                  { label: 'Checkout lancé', value: data?.sales.coachWithStripeCheckout ?? 0 },
                  { label: 'Customer Stripe', value: data?.sales.coachWithStripeCustomer ?? 0 },
                  { label: 'Payants / past due', value: data?.sales.payingCoachCount ?? 0 },
                ]}
                emptyLabel="Aucune étape Stripe."
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <SubList
                title="Étapes CRM"
                items={(data?.sales.pipelineStages ?? []).map((item) => ({
                  label: item.label,
                  value: item.count,
                }))}
                emptyLabel="Aucune étape CRM."
              />
              <SubList
                title="Hygiène commerciale"
                items={[
                  { label: 'Follow-up dus', value: data?.sales.followUpsDue ?? 0 },
                  { label: 'Leads non assignés', value: data?.sales.unassignedLeads ?? 0 },
                  { label: 'Leads stagnants > 7j', value: data?.sales.staleLeads ?? 0 },
                ]}
                emptyLabel="Aucun signal commercial."
              />
            </div>
          </Panel>

          <Panel title="IPT & ventes directes" subtitle="Traction du produit hors coaching récurrent">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricBlock label="Sessions IPT" value={formatNumber(data?.ipt.totalSessions ?? 0)} />
              <MetricBlock label="Sessions complètes" value={formatNumber(data?.ipt.completedSessions ?? 0)} />
              <MetricBlock label="Achats 30j" value={formatNumber(data?.ipt.purchases30d ?? 0)} />
              <MetricBlock label="CA achats 30j" value={formatCurrency(data?.ipt.purchaseRevenue30d ?? 0)} />
            </div>

            <div className="mt-4 space-y-3">
              {(data?.sales.recentCoachLeads ?? []).map((lead) => (
                <div key={lead.id} className="rounded-2xl bg-black/20 px-4 py-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[12px] font-semibold text-white">{lead.email}</p>
                      <p className="mt-1 text-[11px] text-white/35">
                        {lead.source} · {lead.leadStatus} · owner {lead.ownerEmail ?? '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-white/60">
                      <span className="rounded-full bg-white/[0.06] px-2 py-1">{lead.priority}</span>
                      <span>{formatDate(lead.createdAt)}</span>
                    </div>
                  </div>
                  <LeadEditor lead={lead} saving={savingLeadId === lead.id} onSave={updateLead} />
                </div>
              ))}
              {(data?.sales.recentCoachLeads ?? []).length === 0 ? <EmptyState label="Aucun lead coach récent." /> : null}
            </div>
          </Panel>

          <Panel title="Board CRM" subtitle="Filtres rapides et lecture pipeline par statut">
            <div className="grid gap-3 md:grid-cols-3">
              <SelectField label="Statut" value={statusFilter} onChange={setStatusFilter} options={['all', ...LEAD_STATUSES]} />
              <SelectField label="Priorité" value={priorityFilter} onChange={setPriorityFilter} options={['all', ...LEAD_PRIORITIES]} />
              <SelectField label="Owner" value={ownerFilter} onChange={setOwnerFilter} options={['all', 'unassigned', ...ownerOptions]} />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-4">
              {leadsByStatus.map((column) => (
                <div key={column.status} className="rounded-2xl bg-black/20 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-white">{column.status}</p>
                    <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[11px] text-white/60">{formatNumber(column.leads.length)}</span>
                  </div>
                  <div className="space-y-2">
                    {column.leads.slice(0, 12).map((lead) => (
                      <div key={lead.id} className="rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[12px] font-semibold text-white">{lead.email}</p>
                            <p className="mt-1 text-[11px] text-white/35">{lead.source}</p>
                          </div>
                          <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] text-white/60">{lead.priority}</span>
                        </div>
                        <p className="mt-2 text-[11px] text-white/45">owner {lead.ownerEmail ?? '—'}</p>
                        <p className="mt-1 text-[11px] text-white/45">
                          suivi {lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : '—'}
                        </p>
                      </div>
                    ))}
                    {column.leads.length === 0 ? <EmptyState label="Aucun lead" /> : null}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Qualité de pilotage" subtitle="Ce qui est fiable aujourd’hui, et ce qui doit être instrumenté">
            <div className="grid gap-3 md:grid-cols-3">
              <StatusFlag label="Trafic landing" value={data?.instrumentation.landingTrafficTracked ?? false} />
              <StatusFlag label="Demandes démo" value={data?.instrumentation.demoRequestsTracked ?? false} />
              <StatusFlag label="Coût LLM exact" value={false} detail={data?.instrumentation.llmCostingMode ?? 'estimated'} />
            </div>

            <div className="mt-4 rounded-2xl bg-black/20 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">Measurement readiness</p>
                  <p className="mt-2 text-[26px] font-semibold text-white">
                    {formatNumber(data?.measurement.score ?? 0)}
                    <span className="ml-2 text-[12px] font-medium text-white/45">/ 100</span>
                  </p>
                  <p className="mt-1 text-[12px] text-white/55">{data?.measurement.verdict ?? '—'}</p>
                </div>
                <div className="text-[11px] text-white/45">Score diagnostic de qualité de mesure, pas KPI business.</div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(data?.measurement.categories ?? []).map((category) => (
                  <div key={category.label} className="rounded-2xl bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{category.label}</p>
                    <p className="mt-2 text-[16px] font-semibold text-white">
                      {formatNumber(category.score)} / {formatNumber(category.max)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {(data?.instrumentation.notes ?? []).map((note) => (
                <div key={note} className="rounded-2xl bg-black/20 px-4 py-3 text-[12px] leading-6 text-white/68">{note}</div>
              ))}
              {(data?.instrumentation.warnings ?? []).map((warning) => (
                <div key={warning} className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[12px] leading-6 text-amber-100">{warning}</div>
              ))}
            </div>
          </Panel>
        </section>

        {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">{error}</div> : null}
      </div>
    </main>
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

function StatCard({ label, value, detail, help }: { label: string; value: string; detail: string; help?: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.06] bg-black/20 px-5 py-4">
      <div className="flex items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
        {help ? <InlineInfoTooltip title={label} body={help} /> : null}
      </div>
      <p className="mt-2 text-[28px] font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-[11px] text-white/40">{detail}</p>
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

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-2 text-[20px] font-semibold text-white">{value}</p>
    </div>
  )
}

function MetricTrend({ label, value, delta, reverse = false }: { label: string; value: string; delta: number; reverse?: boolean }) {
  return (
    <div className="rounded-2xl bg-black/20 px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-2 text-[20px] font-semibold text-white">{value}</p>
      <p className="mt-2 text-[11px]">{formatDelta(delta, reverse)}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2 text-right">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-1 text-[12px] font-semibold text-white">{value}</p>
    </div>
  )
}

function SubList({ title, items, emptyLabel }: { title: string; items: Array<{ label: string; value: number }>; emptyLabel: string }) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-[12px] font-semibold text-white">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2">
            <p className="truncate pr-3 text-[12px] text-white/75">{item.label}</p>
            <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[11px] text-white/60">{formatNumber(item.value)}</span>
          </div>
        ))}
        {items.length === 0 ? <EmptyState label={emptyLabel} /> : null}
      </div>
    </div>
  )
}

function StatusFlag({ label, value, detail }: { label: string; value: boolean; detail?: string }) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${boolTone(value)}`}>
      <div className="flex items-center gap-2">
        <Waypoints size={14} />
        <p className="text-[12px] font-semibold">{label}</p>
      </div>
      <p className="mt-3 text-[14px] font-semibold">{value ? 'Oui' : 'Non'}</p>
      <p className="mt-1 text-[11px] opacity-75">{detail ?? (value ? 'source fiable branchée' : 'instrumentation manquante')}</p>
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

const LEAD_STATUSES = ['new', 'qualified', 'contacted', 'demo_requested', 'demo_scheduled', 'proposal_sent', 'won', 'lost', 'archived']
const LEAD_PRIORITIES = ['low', 'medium', 'high']

function LeadEditor({
  lead,
  saving,
  onSave,
}: {
  lead: {
    id: string
    email: string
    source: string
    leadStatus: string
    ownerEmail: string | null
    priority: string
    createdAt: string
    nextFollowUpAt: string | null
    notes: string | null
  }
  saving: boolean
  onSave: (input: {
    leadId: string
    leadStatus: string
    priority: string
    ownerEmail: string
    nextFollowUpAt: string
    notes: string
  }) => Promise<void>
}) {
  const [leadStatus, setLeadStatus] = useState(lead.leadStatus)
  const [priority, setPriority] = useState(lead.priority)
  const [ownerEmail, setOwnerEmail] = useState(lead.ownerEmail ?? '')
  const [nextFollowUpAt, setNextFollowUpAt] = useState(toDateTimeLocalValue(lead.nextFollowUpAt))
  const [notes, setNotes] = useState(lead.notes ?? '')

  useEffect(() => {
    setLeadStatus(lead.leadStatus)
    setPriority(lead.priority)
    setOwnerEmail(lead.ownerEmail ?? '')
    setNextFollowUpAt(toDateTimeLocalValue(lead.nextFollowUpAt))
    setNotes(lead.notes ?? '')
  }, [lead])

  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 lg:grid-cols-5">
      <SelectField label="Statut" value={leadStatus} onChange={setLeadStatus} options={LEAD_STATUSES} />
      <SelectField label="Priorité" value={priority} onChange={setPriority} options={LEAD_PRIORITIES} />
      <InputField label="Owner" value={ownerEmail} onChange={setOwnerEmail} placeholder="owner@stryvlab.com" />
      <InputField label="Suivi" type="datetime-local" value={nextFollowUpAt} onChange={setNextFollowUpAt} />
      <div className="flex flex-col gap-2">
        <label className="text-[11px] uppercase tracking-[0.14em] text-white/35">Notes</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[88px] rounded-2xl border border-white/10 bg-[#151515] px-3 py-2 text-[12px] text-white outline-none transition focus:border-white/20"
          placeholder="Contexte, relance, blocage…"
        />
      </div>
      <div className="lg:col-span-5 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave({
            leadId: lead.id,
            leadStatus,
            priority,
            ownerEmail,
            nextFollowUpAt,
            notes,
          })}
          className="rounded-2xl bg-white px-4 py-2 text-[12px] font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/40"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-white/10 bg-[#151515] px-3 py-2 text-[12px] text-white outline-none transition focus:border-white/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-2xl border border-white/10 bg-[#151515] px-3 py-2 text-[12px] text-white outline-none transition focus:border-white/20"
      />
    </div>
  )
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
