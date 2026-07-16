'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Check,
  Copy,
  Filter,
  Loader2,
  Radar,
  RefreshCw,
  Shield,
  ShieldAlert,
  Siren,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useSetTopBar } from '@/components/layout/useSetTopBar'
import type { FeedbackStatus } from '@/lib/feedback/types'
import { InlineInfoTooltip } from '@/components/dashboard/InlineInfoTooltip'
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav'
import { InteractiveTrendBars } from '@/components/dashboard/InteractiveTrendBars'

type ProductFeedbackRow = {
  id: string
  workspace: 'client_pwa' | 'platform_web'
  source_role: 'client' | 'coach'
  source_name: string | null
  source_email: string | null
  page_path: string
  page_title: string | null
  category: 'bug' | 'usability' | 'suggestion'
  priority_user: 'low' | 'medium' | 'critical'
  message: string
  status: FeedbackStatus
  meta: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type PromptPreset = {
  role: string
  mission: string
  focus: string[]
  deliverables: string[]
}

type ProductFeedbackStats = {
  total: number
  newCount: number
  criticalCount: number
  clientCount: number
  platformCount: number
  topPages: Array<{ page: string; count: number }>
}

type DashboardPayload = {
  generatedAt: string
  feedbacks: ProductFeedbackRow[]
  stats: ProductFeedbackStats
  backlog: {
    statuses: Record<FeedbackStatus, number>
    hotspots: Array<{
      page: string
      count: number
      critical: number
      open: number
      score: number
    }>
  }
  overview: {
    openHumanFeedback: number
    plannedHumanFeedback: number
    criticalHumanFeedback: number
    categoryBreakdown: Array<{ key: string; count: number }>
  }
  ops: {
    nutritionParse: {
      total: number
      pending: number
      reviewed: number
      exported: number
      voice: number
      text: number
      topIssues: Array<{ key: string; label: string; count: number }>
      recent: Array<{
        id: string
        created_at: string
        status: 'pending' | 'reviewed' | 'exported'
        source: 'voice' | 'text'
        meal_type: string | null
        notes: string | null
        transcript: string
        issues: string[]
        client_name: string
        client_email: string | null
      }>
    }
    llm: {
      windowHours: number
      totalTraces: number
      totalErrors: number
      averageLatencyMs: number | null
      p95LatencyMs: number | null
      topErrorTypes: Array<{ key: string; count: number }>
      recentErrors: Array<{
        id: string
        created_at: string
        model: string | null
        latency_ms: number | null
        error_type: string | null
        error: string | null
      }>
    }
    system: {
      criticalIncidents: number
      openIncidents: number
      recentIncidents: Array<{
        id: string
        source: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        status: 'open' | 'investigating' | 'resolved' | 'ignored'
        title: string
        actor_email: string | null
        ip_address: string | null
        last_seen_at: string
      }>
    }
  }
  security: {
    windowDays: number
    totalAccessLogs: number
    deniedCount: number
    rateLimitedCount: number
    alertCount: number
    blockedSensitiveCount: number
    sensitiveOperationCount: number
    criticalEventCount: number
    openIncidentCount: number
    recentEvents: Array<{
      id: string
      event_type: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      actor_email: string | null
      ip_address: string | null
      outcome: 'success' | 'failure' | 'blocked' | 'info'
      reason: string | null
      created_at: string
    }>
    recentIncidents: Array<{
      id: string
      source: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      status: 'open' | 'investigating' | 'resolved' | 'ignored'
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
      outcome: 'success' | 'failure' | 'blocked'
      reason: string | null
      target_type: string | null
      target_id: string | null
      created_at: string
    }>
    recent: Array<{
      id: string
      dashboard_key: string
      user_email: string | null
      ip_address: string | null
      outcome: 'allowed' | 'denied' | 'rate_limited' | 'unauthenticated'
      reason: string | null
      alert_sent: boolean
      created_at: string
    }>
  }
  trends: {
    feedbackDaily: Array<{ label: string; total: number; open: number; critical: number }>
    llmDaily: Array<{ label: string; traces: number; errors: number }>
    securityDaily: Array<{ label: string; denied: number; alerts: number; sensitive: number }>
  }
}

const statusOptions: FeedbackStatus[] = ['new', 'reviewed', 'planned', 'done', 'dismissed']

function formatDate(value: string) {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function categoryLabel(value: ProductFeedbackRow['category']) {
  switch (value) {
    case 'bug':
      return 'Bug'
    case 'usability':
      return 'Usage'
    case 'suggestion':
      return 'Suggestion'
  }
}

function priorityLabel(value: ProductFeedbackRow['priority_user']) {
  switch (value) {
    case 'low':
      return '🙂 Faible'
    case 'medium':
      return '😐 Moyenne'
    case 'critical':
      return '🚨 Critique'
  }
}

function humanStatusLabel(value: FeedbackStatus) {
  switch (value) {
    case 'new':
      return 'Nouveau'
    case 'reviewed':
      return 'Qualifié'
    case 'planned':
      return 'Planifié'
    case 'done':
      return 'Traité'
    case 'dismissed':
      return 'Écarté'
  }
}

function summarizeContext(meta: Record<string, unknown> | null) {
  const viewport = meta?.viewport as { width?: number; height?: number } | undefined
  const routeLabel = typeof meta?.route_label === 'string' ? meta.route_label : null
  const userAgent = typeof meta?.user_agent === 'string' ? meta.user_agent : null

  return {
    routeLabel,
    viewport:
      viewport && Number.isFinite(viewport.width) && Number.isFinite(viewport.height)
        ? `${viewport.width} × ${viewport.height}`
        : '—',
    device:
      userAgent?.includes('iPhone')
        ? 'iPhone'
        : userAgent?.includes('Android')
          ? 'Android'
          : userAgent?.includes('Mac OS X')
            ? 'Desktop Apple'
            : userAgent?.includes('Windows')
              ? 'Desktop Windows'
              : '—',
  }
}

const SENSITIVE_META_KEY_PATTERN =
  /(email|mail|name|first_name|last_name|full_name|user|author|actor|client|coach|phone|mobile|ip|address|token|secret|password|cookie|session|authorization|bearer|ssid|id$|_id$|uuid)/i

function redactSensitiveString(value: string) {
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) return '[redacted-email]'
  if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(value)) return '[redacted-ip]'
  if (/\b[A-F0-9]{32,}\b/i.test(value)) return '[redacted-token]'
  return value
}

function sanitizeMetaValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated-depth]'
  if (value == null) return null
  if (typeof value === 'string') return redactSensitiveString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetaValue(item, depth + 1))
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_META_KEY_PATTERN.test(key))
      .map(([key, entryValue]) => [key, sanitizeMetaValue(entryValue, depth + 1)] as const)
      .filter(([, entryValue]) => entryValue !== undefined)
    return Object.fromEntries(entries)
  }
  return undefined
}

function buildPromptPreset(category: ProductFeedbackRow['category']): PromptPreset {
  switch (category) {
    case 'bug':
      return {
        role: 'Tu es un expert senior produit + engineering spécialisé en diagnostic et correction de bugs front-end / full-stack.',
        mission: "Ta mission est d'analyser ce retour utilisateur et de proposer le correctif le plus fiable avec un plan d'exécution concret.",
        focus: [
          'Identifier la cause probable du bug',
          'Décrire les hypothèses à vérifier',
          'Reconstituer des étapes de reproduction plausibles',
          "Distinguer comportement attendu vs comportement observé",
          'Proposer un correctif minimal et robuste',
        ],
        deliverables: [
          'Résumé du problème',
          'Étapes de reproduction',
          'Cause racine probable',
          'Correctif recommandé',
          'Risques / régressions à surveiller',
          'Prompt ou patch concret si possible',
        ],
      }
    case 'usability':
      return {
        role: 'Tu es un expert senior UX/UI et product design orienté réduction de friction et clarté d’usage.',
        mission: "Ta mission est d'analyser ce retour utilisateur et de proposer une amélioration d'expérience simple, cohérente et testable.",
        focus: [
          'Identifier la friction principale',
          'Expliquer pourquoi l’interface prête à confusion',
          'Proposer une amélioration UX prioritaire',
          'Réduire le nombre d’actions, ambiguïtés ou charges cognitives',
          'Conserver une solution réaliste à implémenter',
        ],
        deliverables: [
          'Diagnostic UX',
          'Problème racine côté interface ou wording',
          'Proposition de solution prioritaire',
          'Avant / après attendu',
          'Critères de validation',
        ],
      }
    case 'suggestion':
      return {
        role: 'Tu es un expert senior product manager + solution designer orienté priorisation et cadrage fonctionnel.',
        mission: "Ta mission est de transformer ce retour utilisateur en proposition produit exploitable sans sur-construire la solution.",
        focus: [
          'Extraire le besoin réel derrière la suggestion',
          'Distinguer problème, besoin et solution proposée',
          'Formuler une réponse produit simple',
          'Identifier les impacts UX, métier et techniques',
          'Créer un item backlog clair et actionnable',
        ],
        deliverables: [
          'Besoin utilisateur reformulé',
          'Hypothèse produit',
          'Proposition fonctionnelle',
          'Critères d’acceptation',
          'Niveau de priorité recommandé',
        ],
      }
  }
}

function buildPromptFromFeedback(feedback: ProductFeedbackRow) {
  const preset = buildPromptPreset(feedback.category)
  const context = summarizeContext(feedback.meta)
  const safeMeta = sanitizeMetaValue(feedback.meta)

  return [
    preset.role,
    '',
    preset.mission,
    '',
    'Contrainte importante :',
    '- N’inclus ni ne déduis aucune donnée personnelle ou sensible.',
    '- Reste concret, orienté action, sans blabla.',
    '- Si une information manque, explicite les hypothèses au lieu d’inventer des faits.',
    '',
    'Contexte produit :',
    `- Workspace : ${feedback.workspace === 'client_pwa' ? 'PWA client' : 'Plateforme web'}`,
    `- Page cible : ${feedback.page_title || feedback.page_path}`,
    `- Route : ${context.routeLabel ?? feedback.page_path}`,
    `- Page path : ${feedback.page_path}`,
    `- Catégorie : ${categoryLabel(feedback.category)}`,
    `- Priorité perçue : ${priorityLabel(feedback.priority_user)}`,
    `- Statut actuel : ${humanStatusLabel(feedback.status)}`,
    `- Device : ${context.device}`,
    `- Viewport : ${context.viewport}`,
    `- Date du retour : ${formatDate(feedback.created_at)}`,
    '',
    'Retour utilisateur :',
    feedback.message,
    '',
    'Points d’attention :',
    ...preset.focus.map((item) => `- ${item}`),
    '',
    'Sortie attendue :',
    ...preset.deliverables.map((item) => `- ${item}`),
    '',
    'Contexte technique filtré :',
    '```json',
    JSON.stringify(safeMeta ?? {}, null, 2),
    '```',
  ].join('\n')
}

export default function ProductFeedbackPage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspaceFilter, setWorkspaceFilter] = useState<'all' | 'client_pwa' | 'platform_web'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | ProductFeedbackRow['priority_user']>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [promptDraft, setPromptDraft] = useState('')
  const [copiedPromptForId, setCopiedPromptForId] = useState<string | null>(null)
  const [selectedTrendDay, setSelectedTrendDay] = useState<string | null>(null)

  useSetTopBar(
    <div className="flex flex-col leading-tight">
      <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/30">Interne</p>
      <p className="text-[13px] font-semibold text-white">Produit & retours</p>
    </div>,
  )

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/dashboard/product-feedback')
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? 'Chargement impossible')
      }
      const payload = await res.json()
      setData(payload)
      setSelectedId((current) => current ?? payload.feedbacks?.[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredFeedbacks = useMemo(() => {
    const feedbacks = data?.feedbacks ?? []
    return feedbacks.filter((feedback) => {
      if (workspaceFilter !== 'all' && feedback.workspace !== workspaceFilter) return false
      if (statusFilter !== 'all' && feedback.status !== statusFilter) return false
      if (priorityFilter !== 'all' && feedback.priority_user !== priorityFilter) return false
      if (selectedTrendDay && new Date(feedback.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) !== selectedTrendDay) return false
      return true
    })
  }, [data?.feedbacks, priorityFilter, selectedTrendDay, statusFilter, workspaceFilter])

  const selected = filteredFeedbacks.find((feedback) => feedback.id === selectedId) ?? filteredFeedbacks[0] ?? null
  const selectedContext = summarizeContext(selected?.meta ?? null)
  const topHotspot = data?.backlog.hotspots?.[0] ?? null
  const maxFeedbackTrend = Math.max(...(data?.trends.feedbackDaily ?? []).map((item) => item.total), 1)

  function selectTrendDay(label: string) {
    setSelectedTrendDay((current) => current === label ? null : label)
    window.setTimeout(() => document.getElementById('product-feedback-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  useEffect(() => {
    if (!selected && filteredFeedbacks[0]) {
      setSelectedId(filteredFeedbacks[0].id)
    }
  }, [filteredFeedbacks, selected])

  async function copyPrompt(prompt: string, feedbackId: string) {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPromptForId(feedbackId)
      window.setTimeout(() => {
        setCopiedPromptForId((current) => (current === feedbackId ? null : current))
      }, 2200)
    } catch {
      setError('Copie impossible')
    }
  }

  function openPromptPreview(feedback: ProductFeedbackRow) {
    setPromptDraft(buildPromptFromFeedback(feedback))
    setPromptModalOpen(true)
  }

  async function updateStatus(id: string, status: FeedbackStatus) {
    setUpdatingId(id)
    setError(null)

    try {
      const res = await fetch('/api/dashboard/product-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? 'Mise à jour impossible')
      }
      const payload = await res.json()
      setData((current) => {
        if (!current) return current
        const nextFeedbacks = current.feedbacks.map((feedback) =>
          feedback.id === id
            ? { ...feedback, status: payload.status, updated_at: payload.updated_at }
            : feedback,
        )

        const nextStatuses = {
          new: nextFeedbacks.filter((row) => row.status === 'new').length,
          reviewed: nextFeedbacks.filter((row) => row.status === 'reviewed').length,
          planned: nextFeedbacks.filter((row) => row.status === 'planned').length,
          done: nextFeedbacks.filter((row) => row.status === 'done').length,
          dismissed: nextFeedbacks.filter((row) => row.status === 'dismissed').length,
        } satisfies Record<FeedbackStatus, number>

        return {
          ...current,
          feedbacks: nextFeedbacks,
          stats: {
            ...current.stats,
            newCount: nextStatuses.new,
          },
          backlog: {
            ...current.backlog,
            statuses: nextStatuses,
          },
          overview: {
            ...current.overview,
            openHumanFeedback: nextFeedbacks.filter((feedback) => ['new', 'reviewed'].includes(feedback.status)).length,
            plannedHumanFeedback: nextFeedbacks.filter((feedback) => feedback.status === 'planned').length,
          },
        }
      })
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Mise à jour impossible')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] px-3 py-5 sm:p-6">
        <div className="mx-auto max-w-[1520px] space-y-4">
          <div className="h-36 rounded-[28px] bg-white/[0.03] animate-pulse" />
          <div className="h-28 rounded-3xl bg-white/[0.03] animate-pulse" />
          <div className="h-[960px] rounded-3xl bg-white/[0.03] animate-pulse" />
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
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Control Room</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-white">Retours et décisions produit</h1>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
                  Sync {data ? formatDate(data.generatedAt) : '—'}
                </span>
              </div>
              <p className="mt-3 max-w-[680px] text-[13px] leading-6 text-white/58">
                Transformez les retours utilisateurs en décisions claires : qualifier le problème, mesurer sa priorité et suivre sa prise en charge.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:min-w-[620px] xl:max-w-[680px] xl:flex-1">
              <SignalCard
                icon={<Radar size={15} />}
                label="Zone prioritaire"
                title={topHotspot ? topHotspot.page : 'Aucun hotspot'}
                detail={topHotspot ? `${topHotspot.count} signaux · ${topHotspot.critical} critiques` : 'Pas de signal dominant'}
              />
              <SignalCard
                icon={<Activity size={15} />}
                label="À qualifier"
                title={`${data?.overview.openHumanFeedback ?? 0} retours ouverts`}
                detail={`${data?.overview.criticalHumanFeedback ?? 0} signalés comme critiques`}
              />
              <SignalCard
                icon={<Shield size={15} />}
                label="Décisions prises"
                title={`${data?.overview.plannedHumanFeedback ?? 0} retours planifiés`}
                detail="Éléments qualifiés et intégrés au backlog"
              />
            </div>
          </div>
        </section>

        <DashboardSectionNav items={[
          { id: 'product-summary', label: 'Synthèse', description: 'Indicateurs clés' },
          { id: 'product-trend', label: 'Tendance', description: 'Retours sur 7 jours' },
          { id: 'product-feedback-list', label: 'Retours', description: 'Liste à qualifier' },
          { id: 'product-backlog', label: 'Backlog', description: 'Priorités et statuts' },
          { id: 'product-detail', label: 'Détail', description: 'Retour sélectionné' },
        ]} />

        <section id="product-summary" className="scroll-mt-40 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Retours utilisateurs" value={data?.stats.total ?? 0} />
          <StatCard label="À traiter" value={data?.overview.openHumanFeedback ?? 0} />
          <StatCard label="Critiques" value={data?.overview.criticalHumanFeedback ?? 0} />
          <StatCard label="Planifiés" value={data?.overview.plannedHumanFeedback ?? 0} />
        </section>

        <section id="product-trend" className="scroll-mt-40">
          <Panel title="Flux produit" subtitle="7 jours · survolez puis cliquez sur une journée">
            <InteractiveTrendBars
              data={(data?.trends.feedbackDaily ?? []).map((item) => ({
                label: item.label,
                values: { total: item.total, open: item.open, critical: item.critical },
              }))}
              max={maxFeedbackTrend}
              series={[
                { key: 'total', label: 'Total', tone: 'bg-white' },
                { key: 'open', label: 'Ouverts', tone: 'bg-blue-300' },
                { key: 'critical', label: 'Critiques', tone: 'bg-red-300' },
              ]}
              selectedLabel={selectedTrendDay}
              onSelect={selectTrendDay}
            />
          </Panel>

        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div id="product-feedback-list" className="scroll-mt-40 space-y-6">
            <Panel
              title="Feedback utilisateur"
              subtitle="Client + coach, lié à la page courante"
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
              {selectedTrendDay ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">
                  <p className="text-[11px] text-white/60">Journée sélectionnée : <span className="font-semibold text-white">{selectedTrendDay}</span></p>
                  <button type="button" onClick={() => setSelectedTrendDay(null)} className="rounded-lg px-2 py-1 text-[10px] text-white/45 hover:bg-white/[0.06] hover:text-white">Voir tous</button>
                </div>
              ) : null}
              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                <FilterSelect
                  label="Source"
                  value={workspaceFilter}
                  onChange={setWorkspaceFilter}
                  options={[
                    { value: 'all', label: 'Toutes' },
                    { value: 'client_pwa', label: 'PWA client' },
                    { value: 'platform_web', label: 'Plateforme' },
                  ]}
                />
                <FilterSelect
                  label="Statut"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'Tous' },
                    ...statusOptions.map((status) => ({ value: status, label: humanStatusLabel(status) })),
                  ]}
                />
                <FilterSelect
                  label="Priorité"
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  options={[
                    { value: 'all', label: 'Toutes' },
                    { value: 'low', label: 'Faible' },
                    { value: 'medium', label: 'Moyenne' },
                    { value: 'critical', label: 'Critique' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                {filteredFeedbacks.length === 0 ? (
                  <EmptyState label="Aucun retour pour ces filtres." />
                ) : (
                  filteredFeedbacks.map((feedback) => (
                    <button
                      key={feedback.id}
                      type="button"
                      onClick={() => setSelectedId(feedback.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selected?.id === feedback.id
                          ? 'border-white/18 bg-white/[0.08]'
                          : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-white">
                            {feedback.source_name ?? 'Utilisateur'}
                          </p>
                          <p className="mt-1 text-[11px] text-white/35">
                            {feedback.workspace === 'client_pwa' ? 'PWA client' : 'Plateforme web'} · {formatDate(feedback.created_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] text-white/70">
                          {priorityLabel(feedback.priority_user)}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-[12px] leading-5 text-white/72">{feedback.message}</p>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-white/35">
                        <span>{categoryLabel(feedback.category)}</span>
                        <span>•</span>
                        <span>{feedback.page_path}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="Pages les plus citées" subtitle="Écrans à reprendre en priorité">
              <div className="space-y-2">
                {(data?.backlog.hotspots ?? []).map((item) => (
                  <div key={item.page} className="rounded-2xl bg-white/[0.03] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate pr-4 text-[12px] font-medium text-white/84">{item.page}</p>
                      <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[11px] text-white/60">{item.count}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-white/38">
                      <span>{item.open} ouverts</span>
                      <span>•</span>
                      <span>{item.critical} critiques</span>
                      <span>•</span>
                      <span>score {item.score}</span>
                    </div>
                  </div>
                ))}
                {(data?.backlog.hotspots ?? []).length === 0 && <EmptyState label="Aucun signal pour l’instant." compact />}
              </div>
            </Panel>

            <div id="product-backlog" className="scroll-mt-40">
            <Panel title="Kanban backlog" subtitle="Répartition actuelle du flux utilisateur">
              <div className="grid gap-3 sm:grid-cols-2">
                {statusOptions.map((status) => (
                  <LaneCard
                    key={status}
                    label={humanStatusLabel(status)}
                    value={data?.backlog.statuses?.[status] ?? 0}
                    active={status === 'new' || status === 'reviewed'}
                  />
                ))}
              </div>
            </Panel>
            </div>
          </div>

          <div className="space-y-6">
            <Panel
              title="Pilotage produit"
              subtitle="Ce que les retours demandent de décider"
              action={(
                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-[11px] text-white/60">
                  <Filter size={12} />
                  <span>{selected ? humanStatusLabel(selected.status) : '—'}</span>
                </div>
              )}
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <InsightCard
                  icon={<Sparkles size={15} />}
                  title="Backlog utilisateur"
                  lines={[
                    `${data?.overview.openHumanFeedback ?? 0} retours ouverts`,
                    `${data?.overview.plannedHumanFeedback ?? 0} déjà planifiés`,
                    `${topHotspot?.page ?? '—'} en tête de file`,
                  ]}
                />
                <InsightCard
                  icon={<Zap size={15} />}
                  title="Zone la plus citée"
                  lines={[
                    `${topHotspot?.page ?? 'Aucune page dominante'}`,
                    `${topHotspot?.count ?? 0} signaux regroupés`,
                    `${topHotspot?.critical ?? 0} retours critiques`,
                  ]}
                />
                <InsightCard
                  icon={<ShieldAlert size={15} />}
                  title="Décision suivante"
                  lines={[
                    `${data?.overview.criticalHumanFeedback ?? 0} critiques à arbitrer`,
                    `${data?.overview.openHumanFeedback ?? 0} retours à qualifier`,
                    `${data?.overview.plannedHumanFeedback ?? 0} déjà planifiés`,
                  ]}
                />
              </div>
            </Panel>

            <Panel id="product-detail" title="Détail retour utilisateur" subtitle="Qualifier puis prioriser">
              {!selected ? (
                <EmptyState label="Sélectionne un retour dans la colonne de gauche." />
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoBlock label="Auteur" value={selected.source_name ?? '—'} />
                    <InfoBlock label="Email" value={selected.source_email ?? '—'} />
                    <InfoBlock label="Source" value={selected.workspace === 'client_pwa' ? 'PWA client' : 'Plateforme web'} />
                    <InfoBlock label="Priorité" value={priorityLabel(selected.priority_user)} />
                    <InfoBlock label="Type" value={categoryLabel(selected.category)} />
                    <InfoBlock label="Créé le" value={formatDate(selected.created_at)} />
                  </div>

                  <div className="rounded-2xl bg-black/20 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">Page liée</p>
                    <p className="mt-2 text-[13px] text-white">{selected.page_title || selected.page_path}</p>
                    {selected.page_title ? <p className="mt-1 text-[11px] text-white/35">{selected.page_path}</p> : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <InfoBlock label="Route brute" value={selectedContext.routeLabel ?? selected.page_path} />
                    <InfoBlock label="Viewport" value={selectedContext.viewport} />
                    <InfoBlock label="Device" value={selectedContext.device} />
                  </div>

                  <div className="rounded-2xl bg-black/20 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">Commentaire</p>
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-white/88">{selected.message}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyPrompt(buildPromptFromFeedback(selected), selected.id)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[12px] font-medium text-black transition hover:bg-white/90"
                    >
                      {copiedPromptForId === selected.id ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedPromptForId === selected.id ? 'Prompt copié' : 'Copier le prompt'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openPromptPreview(selected)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.05] px-3 py-2 text-[12px] font-medium text-white/80 transition hover:bg-white/[0.09] hover:text-white"
                    >
                      <Sparkles size={14} />
                      <span>Voir / éditer le prompt</span>
                    </button>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">Statut</p>
                    <div className="flex flex-wrap gap-2">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateStatus(selected.id, status)}
                          disabled={updatingId === selected.id}
                          className={`rounded-2xl px-3 py-2 text-[12px] font-medium transition ${
                            selected.status === status
                              ? 'bg-white text-black'
                              : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.09] hover:text-white'
                          } disabled:opacity-50`}
                        >
                          {updatingId === selected.id && selected.status !== status ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 size={12} className="animate-spin" />
                              <span>{humanStatusLabel(status)}</span>
                            </span>
                          ) : (
                            humanStatusLabel(status)
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selected.meta ? (
                    <div className="rounded-2xl bg-black/20 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">Contexte technique</p>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] leading-5 text-white/55">
                        {JSON.stringify(sanitizeMetaValue(selected.meta), null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )}
            </Panel>

            <Panel title="Actions immédiates" subtitle="Ce qu’il faut traiter maintenant">
              <div className="grid gap-3 lg:grid-cols-3">
                <ActionCallout
                  icon={<Siren size={15} />}
                  title="Page la plus chaude"
                  description={topHotspot ? `${topHotspot.page} concentre ${topHotspot.count} signaux et ${topHotspot.critical} critiques.` : 'Aucun hotspot détecté.'}
                />
                <ActionCallout
                  icon={<Zap size={15} />}
                  title="Retours à qualifier"
                  description={`${data?.overview.openHumanFeedback ?? 0} retours sont encore ouverts, dont ${data?.overview.criticalHumanFeedback ?? 0} signalés comme critiques.`}
                />
                <ActionCallout
                  icon={<ShieldAlert size={15} />}
                  title="Décisions planifiées"
                  description={`${data?.overview.plannedHumanFeedback ?? 0} retours sont déjà qualifiés et intégrés au travail produit.`}
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

        {promptModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/10 bg-[#141414] shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
                <div>
                  <p className="text-[15px] font-semibold text-white">Prompt prêt à envoyer</p>
                  <p className="text-[12px] text-white/40">Version éditable, sans données sensibles</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPromptModalOpen(false)}
                  className="rounded-2xl bg-white/[0.05] p-2 text-white/65 transition hover:bg-white/[0.09] hover:text-white"
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <textarea
                  value={promptDraft}
                  onChange={(event) => setPromptDraft(event.target.value)}
                  className="min-h-[480px] w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-[12px] leading-6 text-white/85 outline-none"
                  spellCheck={false}
                />

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPromptModalOpen(false)}
                    className="rounded-2xl bg-white/[0.05] px-3 py-2 text-[12px] font-medium text-white/75 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    onClick={() => selected && copyPrompt(promptDraft, selected.id)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[12px] font-medium text-black transition hover:bg-white/90"
                  >
                    {selected && copiedPromptForId === selected.id ? <Check size={14} /> : <Copy size={14} />}
                    <span>{selected && copiedPromptForId === selected.id ? 'Prompt copié' : 'Copier ce prompt'}</span>
                  </button>
                </div>
              </div>
            </div>
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

function StatCard({ label, value, help }: { label: string; value: number; help?: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.06] bg-black/20 px-5 py-4">
      <div className="flex items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
        {help ? <InlineInfoTooltip title={label} body={help} /> : null}
      </div>
      <p className="mt-2 text-[28px] font-semibold tracking-tight text-white">{value}</p>
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

function InsightCard({
  icon,
  title,
  lines,
}: {
  icon: ReactNode
  title: string
  lines: string[]
}) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <div className="flex items-center gap-2 text-white">
        {icon}
        <p className="text-[13px] font-semibold">{title}</p>
      </div>
      <div className="mt-3 space-y-2">
        {lines.map((line) => (
          <p key={line} className="text-[12px] text-white/72">{line}</p>
        ))}
      </div>
    </div>
  )
}

function LaneCard({ label, value, active }: { label: string; value: number; active?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${active ? 'border-white/16 bg-white/[0.06]' : 'border-white/[0.06] bg-white/[0.03]'}`}>
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-3 text-[24px] font-semibold tracking-tight text-white">{value}</p>
    </div>
  )
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

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <label className="rounded-2xl bg-white/[0.03] px-3 py-2">
      <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/32">{label}</p>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full bg-transparent text-[12px] text-white outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#111111]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-2 text-[13px] text-white/88">{value}</p>
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
