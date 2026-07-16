'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Radar,
  RefreshCw,
  Shield,
  ShieldAlert,
  Siren,
} from 'lucide-react'
import { useSetTopBar } from '@/components/layout/useSetTopBar'
import { InlineInfoTooltip } from '@/components/dashboard/InlineInfoTooltip'
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav'
import { InteractiveTrendBars } from '@/components/dashboard/InteractiveTrendBars'

type SecurityPayload = {
  generatedAt: string
  windowDays: number
  totalAccessLogs: number
  totalSecurityEvents: number
  deniedCount: number
  rateLimitedCount: number
  unauthenticatedCount: number
  alertCount: number
  criticalEvents: number
  openIncidents: number
  unresolvedCriticalIncidents: number
  posturePolicy: {
    requireAal2: boolean
    requireRecentAuthMinutes: number | null
    trustedIpsConfigured: boolean
  }
  sensitiveOperationStats: {
    total: number
    blocked: number
    failed: number
    successful: number
  }
  repeatedIps: Array<{ ip: string; count: number }>
  topEventTypes: Array<{ eventType: string; count: number }>
  trends: {
    daily: Array<{ label: string; denied: number; alerts: number; critical: number; sensitive: number }>
  }
  recent: Array<{
    id: string
    dashboard_key: string
    user_email: string | null
    ip_address: string | null
    outcome: string
    reason: string | null
    alert_sent: boolean
    created_at: string
  }>
  recentEvents: Array<{
    id: string
    event_type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    actor_email: string | null
    ip_address: string | null
    outcome: string
    reason: string | null
    created_at: string
  }>
  incidents: Array<{
    id: string
    source: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    status: string
    title: string
    actor_email: string | null
    ip_address: string | null
    last_seen_at: string
  }>
  recentSensitiveOperations: Array<{
    id: string
    operation_key: string
    dashboard_key: string | null
    actor_email: string | null
    ip_address: string | null
    outcome: string
    reason: string | null
    target_type: string | null
    target_id: string | null
    created_at: string
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

function severityTone(value: 'low' | 'medium' | 'high' | 'critical') {
  switch (value) {
    case 'critical':
      return 'text-red-200 bg-red-500/12 border-red-500/20'
    case 'high':
      return 'text-orange-200 bg-orange-500/12 border-orange-500/20'
    case 'medium':
      return 'text-amber-100 bg-amber-500/12 border-amber-500/20'
    case 'low':
      return 'text-emerald-100 bg-emerald-500/12 border-emerald-500/20'
  }
}

export default function SecurityDashboardPage() {
  const [data, setData] = useState<SecurityPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTrendDay, setSelectedTrendDay] = useState<string | null>(null)

  useSetTopBar(
    <div className="flex flex-col leading-tight">
      <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/30">Interne</p>
      <p className="text-[13px] font-semibold text-white">Sécurité</p>
    </div>,
  )

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/security')
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

  const maxTrend = Math.max(
    ...(data?.trends.daily ?? []).map((item) => item.denied + item.sensitive + item.critical),
    1,
  )
  const topIp = data?.repeatedIps?.[0] ?? null
  const visibleRecentEvents = useMemo(() => {
    const events = data?.recentEvents ?? []
    if (!selectedTrendDay) return events
    return events.filter((event) => new Date(event.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) === selectedTrendDay)
  }, [data?.recentEvents, selectedTrendDay])

  function selectTrendDay(label: string) {
    setSelectedTrendDay((current) => current === label ? null : label)
    window.setTimeout(() => document.getElementById('security-events')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] px-3 py-5 sm:p-6">
        <div className="mx-auto max-w-[1520px] space-y-4">
          <div className="h-36 rounded-[28px] bg-white/[0.03] animate-pulse" />
          <div className="h-28 rounded-3xl bg-white/[0.03] animate-pulse" />
          <div className="h-[860px] rounded-3xl bg-white/[0.03] animate-pulse" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#121212] px-3 py-5 sm:p-6">
      <div className="mx-auto max-w-[1520px] space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,#1b1b1b_0%,#141414_100%)] p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-[780px]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Surveillance des accès</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-white">Accès, alertes et incidents</h1>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
                  Sync {data ? formatDate(data.generatedAt) : '—'}
                </span>
              </div>
              <p className="mt-3 max-w-[680px] text-[13px] leading-6 text-white/58">
                Surveillance unifiée des refus d’accès, alertes, incidents ouverts et actions sensibles liées aux dashboards internes.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:min-w-[620px] xl:max-w-[680px] xl:flex-1">
              <SignalCard
                icon={<Radar size={15} />}
                label="Exposition"
                title={topIp ? topIp.ip : 'Aucune IP dominante'}
                detail={topIp ? `${topIp.count} occurrences observées` : 'Pas de répétition notable'}
              />
              <SignalCard
                icon={<Activity size={15} />}
                label="Incidents"
                title={`${data?.openIncidents ?? 0} ouverts`}
                detail={`${data?.unresolvedCriticalIncidents ?? 0} critiques · ${data?.criticalEvents ?? 0} événements critiques`}
              />
              <SignalCard
                icon={<Shield size={15} />}
                label="Contrôles"
                title={`${data?.sensitiveOperationStats.total ?? 0} actions sensibles`}
                detail={`${data?.deniedCount ?? 0} refus · ${data?.alertCount ?? 0} alertes`}
              />
            </div>
          </div>
        </section>

        <DashboardSectionNav items={[
          { id: 'security-summary', label: 'Synthèse', description: 'Indicateurs clés' },
          { id: 'security-trends', label: 'Tendances', description: 'Évolution sur 7 jours' },
          { id: 'security-incidents', label: 'Incidents', description: 'Situations à traiter' },
          { id: 'security-audit', label: 'Accès', description: 'Autorisations et refus' },
          { id: 'security-events', label: 'Événements', description: 'Journal détaillé' },
          { id: 'security-sensitive', label: 'Actions sensibles', description: 'Modifications tracées' },
        ]} />

        <section id="security-summary" className="scroll-mt-40 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <StatCard href="#security-events" label="Événements 7j" value={data?.totalSecurityEvents ?? 0} help="Total des événements de sécurité collectés sur la fenêtre observée." />
          <StatCard href="#security-audit" label="Accès refusés" value={data?.deniedCount ?? 0} help="Tentatives bloquées par les règles d’accès internes." />
          <StatCard href="#security-audit" label="Requêtes limitées" value={data?.rateLimitedCount ?? 0} help="Requêtes stoppées pour excès de volume." />
          <StatCard href="#security-events" label="Alertes" value={data?.alertCount ?? 0} help="Alertes sécurité émises automatiquement." />
          <StatCard href="#security-incidents" label="Incidents ouverts" value={data?.openIncidents ?? 0} help="Incidents encore actifs ou non clos." />
          <StatCard href="#security-sensitive" label="Actions sensibles" value={data?.sensitiveOperationStats.total ?? 0} help="Actions internes tracées comme sensibles ou à fort impact." />
        </section>

        <section id="security-trends" className="scroll-mt-40 grid items-start gap-6 xl:grid-cols-3">
          <Panel title="Flux sécurité" subtitle="7 jours · survolez puis cliquez sur une journée">
            <InteractiveTrendBars
              data={(data?.trends.daily ?? []).map((item) => ({
                label: item.label,
                values: { denied: item.denied, sensitive: item.sensitive, critical: item.critical, alerts: item.alerts },
              }))}
              series={[
                { key: 'denied', label: 'Refus', tone: 'bg-white' },
                { key: 'sensitive', label: 'Actions', tone: 'bg-violet-300' },
                { key: 'critical', label: 'Critiques', tone: 'bg-red-300' },
                { key: 'alerts', label: 'Alertes', tone: 'bg-amber-300' },
              ]}
              max={maxTrend}
              selectedLabel={selectedTrendDay}
              onSelect={selectTrendDay}
            />
          </Panel>

          <Panel title="Politique interne" subtitle="MFA, réauth, IP de confiance">
            <div className="space-y-3">
              <MetricRow left="MFA AAL2" right={data?.posturePolicy.requireAal2 ? 'Activée' : 'Monitor only'} />
              <MetricRow
                left="Réauth max"
                right={data?.posturePolicy.requireRecentAuthMinutes ? `${data.posturePolicy.requireRecentAuthMinutes} min` : 'Inactive'}
              />
              <MetricRow
                left="IP de confiance"
                right={data?.posturePolicy.trustedIpsConfigured ? 'Configurées' : 'Aucune'}
              />
            </div>
          </Panel>

          <Panel
            title="Surface d’attaque"
            subtitle="IP répétées et types d’événements"
            action={(
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.05] px-3 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                <RefreshCw size={14} />
                <span>Rafraîchir</span>
              </button>
            )}
          >
            <div className="space-y-3">
              <BlockTitle title="IP répétées" />
              {(data?.repeatedIps ?? []).slice(0, 5).map((item) => (
                <MetricRow key={item.ip} left={item.ip} right={String(item.count)} />
              ))}
              {(data?.repeatedIps ?? []).length === 0 ? <EmptyState label="Aucune IP répétée." compact /> : null}

              <BlockTitle title="Top événements" />
              {(data?.topEventTypes ?? []).slice(0, 5).map((item) => (
                <MetricRow key={item.eventType} left={item.eventType} right={String(item.count)} />
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Panel id="security-incidents" title="Incidents sécurité" subtitle="Ouverts, en investigation, historiques">
              <div className="space-y-2">
                {(data?.incidents ?? []).map((incident) => (
                  <div key={incident.id} className="rounded-2xl bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-white">{incident.title}</p>
                        <p className="mt-1 text-[11px] text-white/35">
                          {incident.source} · {incident.status} · {formatDate(incident.last_seen_at)}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] ${severityTone(incident.severity)}`}>{incident.severity}</span>
                    </div>
                    <p className="mt-3 text-[12px] text-white/60">
                      {incident.actor_email ?? incident.ip_address ?? 'Origine non identifiée'}
                    </p>
                  </div>
                ))}
                {(data?.incidents ?? []).length === 0 ? <EmptyState label="Aucun incident sécurité." /> : null}
              </div>
            </Panel>

            <Panel id="security-audit" title="Audit dashboard" subtitle="Accès internes et refus">
              <div className="space-y-2">
                {(data?.recent ?? []).map((row) => (
                  <div key={row.id} className="rounded-2xl bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-medium text-white">{row.user_email ?? 'Non authentifié'} · {row.outcome}</p>
                        <p className="mt-1 text-[11px] text-white/35">{row.ip_address ?? '—'} · {formatDate(row.created_at)}</p>
                      </div>
                      {row.alert_sent ? <ShieldAlert size={14} className="text-red-300" /> : null}
                    </div>
                    {row.reason ? <p className="mt-3 text-[12px] text-white/60">{row.reason}</p> : null}
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel
              id="security-events"
              title="Événements récents"
              subtitle={selectedTrendDay ? `Filtrés sur la journée du ${selectedTrendDay}` : 'Auth, accès, blocages'}
              action={selectedTrendDay ? (
                <button type="button" onClick={() => setSelectedTrendDay(null)} className="rounded-xl bg-white/[0.05] px-3 py-2 text-[10px] text-white/60 hover:bg-white/[0.08] hover:text-white">Voir tous</button>
              ) : undefined}
            >
              <div className="space-y-2">
                {visibleRecentEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-medium text-white">{event.event_type}</p>
                        <p className="mt-1 text-[11px] text-white/35">
                          {event.actor_email ?? event.ip_address ?? '—'} · {formatDate(event.created_at)}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] ${severityTone(event.severity)}`}>{event.severity}</span>
                    </div>
                    {event.reason ? <p className="mt-3 text-[12px] text-white/60">{event.reason}</p> : null}
                  </div>
                ))}
                {visibleRecentEvents.length === 0 ? <EmptyState label="Aucun événement pour cette journée." compact /> : null}
              </div>
            </Panel>

            <Panel id="security-sensitive" title="Actions sensibles" subtitle="Modifications internes tracées">
              <div className="mb-4 grid gap-3 md:grid-cols-4">
                <MiniStat label="Total" value={data?.sensitiveOperationStats.total ?? 0} />
                <MiniStat label="Succès" value={data?.sensitiveOperationStats.successful ?? 0} />
                <MiniStat label="Échecs" value={data?.sensitiveOperationStats.failed ?? 0} />
                <MiniStat label="Bloquées" value={data?.sensitiveOperationStats.blocked ?? 0} />
              </div>
              <div className="space-y-2">
                {(data?.recentSensitiveOperations ?? []).map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 p-4">
                    <div>
                      <p className="text-[12px] font-medium text-white">{row.operation_key}</p>
                      <p className="mt-1 text-[11px] text-white/35">
                        {[row.dashboard_key, row.target_type, row.target_id].filter(Boolean).join(' · ') || 'Contexte indisponible'}
                      </p>
                      <p className="mt-2 text-[12px] text-white/60">
                        {row.actor_email ?? row.ip_address ?? '—'} · {formatDate(row.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] text-white/70">{row.outcome}</span>
                      <ChevronRight size={14} className="text-white/30" />
                    </div>
                  </div>
                ))}
                {(data?.recentSensitiveOperations ?? []).length === 0 ? <EmptyState label="Aucune action sensible tracée." /> : null}
              </div>
            </Panel>

            <Panel title="Actions immédiates" subtitle="Ce qu’il faut traiter maintenant">
              <div className="grid gap-3">
                <ActionCallout
                  icon={<Siren size={15} />}
                  title="Triage incidents"
                  description={`${data?.openIncidents ?? 0} incidents restent ouverts, dont ${data?.unresolvedCriticalIncidents ?? 0} critiques.`}
                />
                <ActionCallout
                  icon={<ShieldAlert size={15} />}
                  title="Refus d’accès"
                  description={`${data?.deniedCount ?? 0} refus et ${data?.alertCount ?? 0} alertes nécessitent une revue des IP, UUID et politiques MFA.`}
                />
                <ActionCallout
                  icon={<Shield size={15} />}
                  title="Opérations sensibles"
                  description={`${data?.sensitiveOperationStats.blocked ?? 0} actions bloquées et ${data?.sensitiveOperationStats.failed ?? 0} en échec demandent une vérification des contrôles.`}
                />
              </div>
            </Panel>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </main>
  )
}

function Panel({
  id,
  title,
  subtitle,
  help,
  action,
  children,
}: {
  id?: string
  title: string
  subtitle?: string
  help?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-40 rounded-3xl border border-white/[0.06] bg-[#181818] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold text-white">{title}</p>
            {help ? <InlineInfoTooltip title={title} body={help} /> : null}
          </div>
          {subtitle ? <p className="text-[12px] text-white/35">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function StatCard({ href, label, value, help }: { href: string; label: string; value: number; help?: string }) {
  return (
    <a href={href} className="group rounded-3xl border border-white/[0.06] bg-black/20 px-5 py-4 transition hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.035] focus:outline-none focus:ring-2 focus:ring-white/20">
      <div className="flex items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
        {help ? <InlineInfoTooltip title={label} body={help} /> : null}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3"><p className="text-[28px] font-semibold tracking-tight text-white">{value}</p><ChevronRight size={14} className="mb-1 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/65" /></div>
    </a>
  )
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-2 text-[18px] font-semibold text-white">{value}</p>
    </div>
  )
}

function SignalCard({
  icon,
  label,
  title,
  detail,
  help,
}: {
  icon: ReactNode
  label: string
  title: string
  detail: string
  help?: string
}) {
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

function MetricRow({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
      <p className="truncate pr-3 text-[12px] text-white/78">{left}</p>
      <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[11px] text-white/60">{right}</span>
    </div>
  )
}

function BlockTitle({ title }: { title: string }) {
  return <p className="pt-2 text-[11px] uppercase tracking-[0.14em] text-white/35">{title}</p>
}

function ActionCallout({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4">
      <div className="flex items-center gap-2 text-white">
        {icon}
        <p className="text-[13px] font-semibold">{title}</p>
      </div>
      <p className="mt-3 text-[12px] leading-6 text-white/60">{description}</p>
    </div>
  )
}

function EmptyState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-white/10 text-center text-[13px] text-white/35 ${compact ? 'px-4 py-8' : 'px-4 py-12'}`}>
      {compact ? <AlertTriangle size={16} className="mx-auto mb-2 opacity-55" /> : null}
      {label}
    </div>
  )
}
