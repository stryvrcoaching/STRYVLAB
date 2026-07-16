'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Activity,
  Calendar,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { NutritionProtocol } from '@/lib/nutrition/types'
import ActionFeedbackBadge from '@/components/ui/ActionFeedbackBadge'
import useTimedActionFeedback from '@/components/ui/useTimedActionFeedback'
import useActionRequest from '@/components/ui/useActionRequest'

const TRACKING_VIEW_STORAGE_KEY = 'nutrition-protocol-dashboard-tracking-view'

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDeltaKcal(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded} kcal/j`
}

function formatNutritionScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)}/100`
}

function formatVariationKcal(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `±${Math.round(Math.abs(value))} kcal/j`
}

function formatPlannedKcal(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)} kcal/j`
}

function formatHydration(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)} ml/j`
}

function describeTrend(values: number[]) {
  if (values.length < 2) return { label: 'À construire', tone: 'text-white/35' }
  const first = values[0] ?? 0
  const last = values[values.length - 1] ?? 0
  const delta = last - first
  if (delta > 0) return { label: 'Hausse', tone: 'text-[#86efac]' }
  if (delta < 0) return { label: 'Baisse', tone: 'text-[#fca5a5]' }
  return { label: 'Stable', tone: 'text-[#fcd34d]' }
}

function TrendSparkline({
  values,
  stroke,
  fill,
}: {
  values: number[]
  stroke: string
  fill: string
}) {
  if (values.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.02] text-[10px] text-white/25">
        Pas assez de données
      </div>
    )
  }

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const width = 220
  const height = 64

  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * (height - 8) - 4
      return `${x},${y}`
    })
    .join(' ')

  const areaPoints = `0,${height} ${points} ${width},${height}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
      <polyline points={areaPoints} fill={fill} stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MetricCard({
  icon,
  label,
  value,
  accent = 'text-white',
}: {
  icon: ReactNode
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-white/28">
        {icon}
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] leading-tight">{label}</span>
      </div>
      <p className={`text-[13px] font-semibold ${accent}`}>{value}</p>
    </div>
  )
}

function DeleteConfirmModal({
  name,
  onConfirm,
  onCancel,
  loading,
}: {
  name: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] p-6">
        <h3 className="mb-2 text-[15px] font-bold text-white">Supprimer ce protocole ?</h3>
        <p className="mb-5 text-[13px] text-white/50">
          <span className="font-medium text-white/80">"{name}"</span> sera définitivement supprimé. Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl bg-white/[0.04] py-2.5 text-[13px] font-medium text-white/55 transition-colors hover:text-white/80 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-500/80 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  protocols: NutritionProtocol[]
  onRefresh: () => void
  onRequestPdf?: (protocol: NutritionProtocol) => void | Promise<void>
}

export default function NutritionProtocolDashboard({ protocols, onRefresh, onRequestPdf }: Props) {
  const params = useParams()
  const router = useRouter()
  const clientId = params.clientId as string
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const { feedback: actionFeedback, pushFeedback: pushActionFeedback } =
    useTimedActionFeedback<string>()
  const { runAction } = useActionRequest<string>({
    setLoadingKey: setActionLoading,
    pushFeedback: pushActionFeedback,
  })

  const shared = protocols.find((protocol) => protocol.status === 'shared')
  const drafts = protocols.filter((protocol) => protocol.status !== 'shared')

  async function handleShare(protocolId: string) {
    await runAction({
      scope: protocolId,
      loadingKey: `share-${protocolId}`,
      loadingMessage: 'Partage en cours...',
      successMessage: 'Protocole partagé',
      request: async () => {
        const response = await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}/share`, { method: 'POST' })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Action impossible pour le moment.')
        }
        return response
      },
      onSuccess: onRefresh,
    })
  }

  async function handleUnshare(protocolId: string) {
    await runAction({
      scope: protocolId,
      loadingKey: `unshare-${protocolId}`,
      loadingMessage: 'Retrait en cours...',
      successMessage: 'Protocole retiré de l’app',
      request: async () => {
        const response = await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}/unshare`, { method: 'POST' })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Action impossible pour le moment.')
        }
        return response
      },
      onSuccess: onRefresh,
    })
  }

  async function handleDuplicate(protocolId: string) {
    await runAction({
      scope: protocolId,
      loadingKey: `duplicate-${protocolId}`,
      loadingMessage: 'Duplication en cours...',
      successMessage: 'Copie créée',
      request: async () => {
        const response = await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}/duplicate`, { method: 'POST' })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Action impossible pour le moment.')
        }
        return response
      },
      onSuccess: onRefresh,
    })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    const result = await runAction({
      scope: target.id,
      loadingKey: `delete-${target.id}`,
      loadingMessage: 'Suppression en cours...',
      successMessage: 'Protocole supprimé',
      request: async () => {
        const response = await fetch(`/api/clients/${clientId}/nutrition-protocols/${target.id}`, { method: 'DELETE' })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Suppression impossible pour le moment.')
        }
        return response
      },
      onSuccess: async () => {
        setDeleteTarget(null)
        onRefresh()
      },
      getErrorMessage: (error) =>
        error instanceof Error ? error.message : 'Suppression impossible pour le moment.',
    })
    if (!result) return
  }

  async function handlePdf(protocol: NutritionProtocol) {
    if (!onRequestPdf) return
    const protocolId = protocol.id
    await runAction({
      scope: protocolId,
      loadingKey: `pdf-${protocolId}`,
      loadingMessage: 'Préparation du PDF...',
      successMessage: 'PDF prêt',
      request: () => onRequestPdf(protocol),
      getErrorMessage: (error) =>
        error instanceof Error ? error.message : 'Export PDF impossible pour le moment.',
    })
  }

  if (protocols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03]">
          <Layers3 size={20} className="text-white/20" />
        </div>
        <p className="mb-1 text-[14px] font-semibold text-white/60">Aucun protocole nutritionnel</p>
        <p className="mb-6 text-[12px] text-white/30">Créez le premier protocole pour ce client</p>
        <Link
          href={`/coach/clients/${clientId}/protocoles/nutrition/new`}
          className="flex h-9 items-center gap-2 rounded-xl bg-[#1f8a65] px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#217356]"
        >
          Nouveau protocole
        </Link>
      </div>
    )
  }

  const allProtocols = [
    ...(shared ? [{ protocol: shared, isActive: true }] : []),
    ...drafts.map((protocol) => ({ protocol, isActive: false })),
  ]

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          {allProtocols.map(({ protocol, isActive }) => (
            <NutritionProtocolCard
              key={protocol.id}
              protocol={protocol}
              isActive={isActive}
              actionLoading={actionLoading}
              actionFeedback={actionFeedback?.scope === protocol.id ? actionFeedback : null}
              onOpen={() => router.push(`/coach/clients/${clientId}/protocoles/nutrition/${protocol.id}/edit`)}
              onToggle={() => (isActive ? handleUnshare(protocol.id) : handleShare(protocol.id))}
              onDuplicate={() => handleDuplicate(protocol.id)}
              onPdf={() => handlePdf(protocol)}
              onDelete={() => setDeleteTarget({ id: protocol.id, name: protocol.name })}
            />
          ))}
        </div>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.name}
          loading={actionLoading === `delete-${deleteTarget.id}`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}

function NutritionProtocolCard({
  protocol,
  isActive,
  actionLoading,
  actionFeedback,
  onOpen,
  onToggle,
  onDuplicate,
  onPdf,
  onDelete,
}: {
  protocol: NutritionProtocol
  isActive: boolean
  actionLoading: string | null
  actionFeedback: {
    scope: string
    tone: 'loading' | 'success' | 'error'
    message: string
  } | null
  onOpen: () => void
  onToggle: () => void
  onDuplicate: () => void
  onPdf: () => void
  onDelete: () => void
}) {
  const [trackingView, setTrackingView] = useState<'live' | 'history'>('live')
  const analytics = protocol.tracking_analytics ?? protocol.analytics
  const historicalAnalytics = protocol.historical_tracking_analytics
  const planAnalytics = protocol.plan_analytics
  const isPlanMode = protocol.card_mode === 'plan'
  const displayedTrackingAnalytics =
    !isPlanMode && trackingView === 'history' && historicalAnalytics
      ? historicalAnalytics
      : analytics
  const configuredDaysCount = protocol.days?.length ?? 0
  const deltaTrend = describeTrend(displayedTrackingAnalytics?.kcal_delta_trend ?? [])
  const variationTrend = describeTrend(displayedTrackingAnalytics?.kcal_variation_trend ?? [])
  const isToggling = actionLoading === `${isActive ? 'unshare' : 'share'}-${protocol.id}`
  const isDuplicating = actionLoading === `duplicate-${protocol.id}`
  const isPdfLoading = actionLoading === `pdf-${protocol.id}`
  const isDeleting = actionLoading === `delete-${protocol.id}`
  const roles = new Set((protocol.days ?? []).map((day) => day.role).filter(Boolean))
  const tags = [
    protocol.cycle_sync_enabled ? 'Cycle sync' : null,
    protocol.tdee_adaptive_active ? 'TDEE client actif' : null,
  ].filter(Boolean) as string[]

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(TRACKING_VIEW_STORAGE_KEY)
    if (stored === 'live' || stored === 'history') {
      setTrackingView(stored)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || isPlanMode) return
    window.localStorage.setItem(TRACKING_VIEW_STORAGE_KEY, trackingView)
  }, [isPlanMode, trackingView])

  return (
    <div className="rounded-[24px] border-[0.3px] border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.035]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${
                isActive ? 'bg-[#1f8a65]/12 text-[#7fe2bf]' : 'bg-white/[0.05] text-white/38'
              }`}
            >
              {isActive ? <Eye size={10} /> : <EyeOff size={10} />}
              {isActive ? 'Actif app' : 'Brouillon'}
            </span>
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35"
              >
                {tag}
              </span>
            ))}
            <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
              {isPlanMode
                ? 'Plan'
                : displayedTrackingAnalytics?.state_label ?? 'En attente'}
            </span>
            {!isPlanMode && historicalAnalytics ? (
              <div className="ml-1 inline-flex rounded-full border border-white/[0.07] bg-white/[0.03] p-0.5">
                <button
                  onClick={() => setTrackingView('live')}
                  className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                    trackingView === 'live' ? 'bg-white/[0.12] text-white' : 'text-white/35'
                  }`}
                >
                  Live
                </button>
                <button
                  onClick={() => setTrackingView('history')}
                  className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                    trackingView === 'history' ? 'bg-white/[0.12] text-white' : 'text-white/35'
                  }`}
                >
                  Historique
                </button>
              </div>
            ) : null}
          </div>

          <button onClick={onOpen} className="block text-left">
            <h3 className="truncate text-[18px] font-semibold text-white">{protocol.name}</h3>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/35">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={11} />
              Créé le {formatShortDate(protocol.created_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={11} />
              {configuredDaysCount} jours
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Activity size={11} />
              {isActive ? 'Suivi actif' : 'Suivi en brouillon'}
            </span>
          </div>
          {protocol.notes ? (
            <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-white/45">
              {protocol.notes}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {actionFeedback ? (
            <ActionFeedbackBadge
              tone={actionFeedback.tone}
              message={actionFeedback.message}
              className="hidden md:flex"
            />
          ) : null}
          <button
            onClick={onToggle}
            disabled={isToggling}
            title={isActive ? "Visible sur l'app client — cliquer pour retirer" : "Masqué sur l'app client — cliquer pour activer"}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${
              isActive
                ? 'bg-[#1f8a65]/10 text-[#7fe2bf] hover:bg-[#1f8a65]/18'
                : 'bg-white/[0.04] text-white/32 hover:bg-white/[0.08] hover:text-white/55'
            }`}
          >
            {isToggling ? <Loader2 size={11} className="animate-spin" /> : isActive ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
          <button
            onClick={onDuplicate}
            disabled={isDuplicating}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/28 transition-colors hover:bg-white/[0.08] hover:text-white/60"
            title="Dupliquer le protocole"
          >
            {isDuplicating ? <Loader2 size={11} className="animate-spin" /> : <Copy size={12} />}
          </button>
          <button
            onClick={onPdf}
            disabled={isPdfLoading}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/28 transition-colors hover:bg-white/[0.08] hover:text-white/60"
            title="Enregistrer en PDF"
          >
            {isPdfLoading ? <Loader2 size={11} className="animate-spin" /> : <Download size={12} />}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Supprimer le protocole"
          >
            {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Layers3 size={11} />}
          label="Structure"
          value={`${configuredDaysCount} jours`}
        />
        <MetricCard
          icon={<Sparkles size={11} />}
          label={isPlanMode ? 'Kcal moyen planifié' : 'Écart kcal'}
          value={isPlanMode ? formatPlannedKcal(planAnalytics?.avg_target_kcal) : formatDeltaKcal(displayedTrackingAnalytics?.avg_kcal_delta)}
          accent={(isPlanMode ? planAnalytics?.avg_target_kcal : displayedTrackingAnalytics?.avg_kcal_delta) == null ? 'text-white/60' : 'text-[#f2f2f2]'}
        />
        <MetricCard
          icon={<ShieldCheck size={11} />}
          label={isPlanMode ? 'Score structure' : 'Score global'}
          value={isPlanMode ? formatNutritionScore(planAnalytics?.structure_score) : formatNutritionScore(displayedTrackingAnalytics?.nutrition_score)}
          accent={(isPlanMode ? planAnalytics?.structure_score : displayedTrackingAnalytics?.nutrition_score) == null ? 'text-white/60' : 'text-white'}
        />
        <MetricCard
          icon={<Activity size={11} />}
          label={isPlanMode ? 'Amplitude kcal' : 'Variation kcal/jour'}
          value={isPlanMode ? formatVariationKcal(planAnalytics?.kcal_amplitude) : formatVariationKcal(displayedTrackingAnalytics?.avg_daily_kcal_variation)}
          accent={(isPlanMode ? planAnalytics?.kcal_amplitude : displayedTrackingAnalytics?.avg_daily_kcal_variation) == null ? 'text-white/60' : 'text-white'}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.05] bg-[#131313] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">{isPlanMode ? 'Projection du plan' : 'Écart kcal'}</p>
              <p className="mt-1 text-[13px] font-semibold text-white">
                {isPlanMode ? formatPlannedKcal(planAnalytics?.avg_target_kcal) : formatDeltaKcal(displayedTrackingAnalytics?.avg_kcal_delta)}
              </p>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${deltaTrend.tone}`}>
              {isPlanMode ? 'Simulation' : deltaTrend.label}
            </span>
          </div>
          {isPlanMode ? (
            <div className="flex h-16 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.02] text-[10px] text-white/35">
              {planAnalytics?.warnings?.length ? planAnalytics.warnings[0] : 'Simulation du protocole'}
            </div>
          ) : (
            <TrendSparkline
              values={displayedTrackingAnalytics?.kcal_delta_trend ?? []}
              stroke="#7fe2bf"
              fill="rgba(31,138,101,0.12)"
            />
          )}
          <p className="mt-1 text-[10px] text-white/26">
            {isPlanMode
              ? `${planAnalytics?.training_days_count ?? 0} entraînement · ${planAnalytics?.rest_days_count ?? 0} repos`
              : displayedTrackingAnalytics?.analyzed_days_count
                ? `${displayedTrackingAnalytics.analyzed_days_count} jours observés`
                : 'En attente de données client'}
          </p>
          {!isPlanMode && historicalAnalytics && trackingView === 'live' ? (
            <p className="mt-1 text-[10px] text-white/20">
              Historique du plan : {historicalAnalytics.analyzed_days_count} jour{historicalAnalytics.analyzed_days_count > 1 ? 's' : ''}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/[0.05] bg-[#131313] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">{isPlanMode ? 'Hydratation cible' : 'Variation kcal/jour'}</p>
              <p className="mt-1 text-[13px] font-semibold text-white">
                {isPlanMode ? formatHydration(planAnalytics?.hydration_target_avg_ml) : formatVariationKcal(displayedTrackingAnalytics?.avg_daily_kcal_variation)}
              </p>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${variationTrend.tone}`}>
              {isPlanMode ? (planAnalytics?.warnings?.length ? 'Alerte' : 'Cohérent') : variationTrend.label}
            </span>
          </div>
          {isPlanMode ? (
            <div className="flex h-16 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 text-[10px] text-white/35">
              {planAnalytics?.warnings?.slice(0, 2).join(' · ') || 'Structure prête au partage'}
            </div>
          ) : (
            <TrendSparkline
              values={displayedTrackingAnalytics?.kcal_variation_trend ?? []}
              stroke="#fcd34d"
              fill="rgba(245, 158, 11, 0.12)"
            />
          )}
          <p className="mt-1 text-[10px] text-white/26">
            {isPlanMode
              ? `Hydratation moyenne cible ${formatHydration(planAnalytics?.hydration_target_avg_ml)}`
              : trackingView === 'history'
                ? `Depuis début du plan : ${displayedTrackingAnalytics?.analyzed_days_count ?? 0} jour${(displayedTrackingAnalytics?.analyzed_days_count ?? 0) > 1 ? 's' : ''}`
                : displayedTrackingAnalytics?.window_label ?? 'Suivi en attente'}
          </p>
          {!isPlanMode && historicalAnalytics?.analyzed_days_count && trackingView === 'live' ? (
            <p className="mt-1 text-[10px] text-white/20">
              Depuis début du plan : {formatDeltaKcal(historicalAnalytics.avg_kcal_delta)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/32">
          {roles.has('training') ? (
            <span className="rounded-full border border-white/[0.06] px-2.5 py-1 uppercase tracking-[0.14em]">
              Entraînement
            </span>
          ) : null}
          {roles.has('rest') ? (
            <span className="rounded-full border border-white/[0.06] px-2.5 py-1 uppercase tracking-[0.14em]">
              Repos
            </span>
          ) : null}
        </div>
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70 transition-colors hover:bg-white/[0.09] hover:text-white"
        >
          Ouvrir
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
