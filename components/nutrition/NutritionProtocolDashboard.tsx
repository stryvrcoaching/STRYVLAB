'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Plus, Edit2, Trash2, Share2, EyeOff } from 'lucide-react'
import type { NutritionProtocol, NutritionProtocolDay } from '@/lib/nutrition/types'

function DeleteConfirmModal({ name, onConfirm, onCancel, loading }: {
  name: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] rounded-2xl p-6 w-full max-w-sm border-[0.3px] border-white/[0.06]">
        <h3 className="text-[15px] font-bold text-white mb-2">Supprimer ce protocole ?</h3>
        <p className="text-[13px] text-white/50 mb-5">
          <span className="text-white/80 font-medium">"{name}"</span> sera définitivement supprimé. Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500/80 text-white text-[13px] font-bold hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DayMacroRow({ day }: { day: NutritionProtocolDay }) {
  const hasMacros = day.calories != null && day.protein_g != null && day.carbs_g != null && day.fat_g != null
  const total = hasMacros ? (day.protein_g! * 4 + day.carbs_g! * 4 + day.fat_g! * 9) : 0
  const pPct = total > 0 ? Math.round((day.protein_g! * 4 / total) * 100) : 0
  const fPct = total > 0 ? Math.round((day.fat_g! * 9 / total) * 100) : 0
  const cPct = total > 0 ? 100 - pPct - fPct : 0

  return (
    <div className="py-2 border-b-[0.3px] border-white/[0.04] last:border-0 space-y-1.5">
      {/* Nom + calories */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold text-white truncate">{day.name}</p>
        <p className="text-[11px] font-bold text-white shrink-0">
          {day.calories != null ? `${day.calories} kcal` : <span className="text-white/25 font-normal">—</span>}
        </p>
      </div>
      {hasMacros && (
        <>
          {/* Grammes P / L / G avec dots */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[9px] text-white/50">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#5dba87]" />
              P {day.protein_g}g · {pPct}%
            </span>
            <span className="flex items-center gap-1 text-[9px] text-white/50">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#ff8660]" />
              L {day.fat_g}g · {fPct}%
            </span>
            <span className="flex items-center gap-1 text-[9px] text-white/50">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#ffd15e]" />
              G {day.carbs_g}g · {cPct}%
            </span>
          </div>
          {/* Barre segmentée */}
          <div className="flex w-full h-[3px] rounded-full overflow-hidden bg-white/[0.04]">
            <div style={{ width: `${pPct}%`, backgroundColor: '#5dba87' }} />
            <div style={{ width: `${fPct}%`, backgroundColor: '#ff8660' }} />
            <div style={{ width: `${cPct}%`, backgroundColor: '#ffd15e' }} />
          </div>
        </>
      )}
    </div>
  )
}

interface Props {
  protocols: NutritionProtocol[]
  onRefresh: () => void
}

export default function NutritionProtocolDashboard({ protocols, onRefresh }: Props) {
  const params   = useParams()
  const router   = useRouter()
  const clientId = params.clientId as string
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const shared = protocols.find(p => p.status === 'shared')
  const drafts = protocols.filter(p => p.status !== 'shared')

  async function handleShare(protocolId: string) {
    setActionLoading(`share-${protocolId}`)
    await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}/share`, { method: 'POST' })
    setActionLoading(null)
    onRefresh()
  }

  async function handleUnshare(protocolId: string) {
    setActionLoading(`unshare-${protocolId}`)
    await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}/unshare`, { method: 'POST' })
    setActionLoading(null)
    onRefresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setActionLoading(`delete-${deleteTarget.id}`)
    await fetch(`/api/clients/${clientId}/nutrition-protocols/${deleteTarget.id}`, { method: 'DELETE' })
    setActionLoading(null)
    setDeleteTarget(null)
    onRefresh()
  }

  function renderDay(day: NutritionProtocolDay) {
    return <DayMacroRow key={day.id} day={day} />
  }

  function renderProtocolCard(protocol: NutritionProtocol, isActive: boolean) {
    const days = protocol.days ?? []
    return (
      <div
        key={protocol.id}
        className={`bg-white/[0.02] border-[0.3px] rounded-2xl p-4 ${
          isActive ? 'border-[#1f8a65]/30' : 'border-white/[0.06]'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isActive ? (
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#1f8a65]">
                  <CheckCircle2 size={10} /> Actif
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">
                  <Clock size={10} /> Brouillon
                </span>
              )}
            </div>
            <p className="text-[14px] font-semibold text-white truncate">{protocol.name}</p>
            <p className="text-[10px] text-white/30 mt-0.5">
              {new Date(protocol.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}{days.length} jour{days.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => router.push(`/coach/clients/${clientId}/protocoles/nutrition/${protocol.id}/edit`)}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white transition-all"
            >
              <Edit2 size={12} />
            </button>
            {isActive ? (
              <button
                onClick={() => handleUnshare(protocol.id)}
                disabled={actionLoading === `unshare-${protocol.id}`}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/[0.04] text-[10px] font-semibold text-white/40 hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-40"
              >
                <EyeOff size={11} /> Retirer
              </button>
            ) : (
              <button
                onClick={() => handleShare(protocol.id)}
                disabled={actionLoading === `share-${protocol.id}`}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-[#1f8a65]/10 text-[10px] font-semibold text-[#1f8a65] hover:bg-[#1f8a65]/20 transition-all disabled:opacity-40"
              >
                <Share2 size={11} /> Partager
              </button>
            )}
            {!isActive && (
              <button
                onClick={() => setDeleteTarget({ id: protocol.id, name: protocol.name })}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-all"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {days.length > 0 && (
          <div className="mt-2">
            {days.slice(0, 3).map(renderDay)}
            {days.length > 3 && (
              <p className="text-[10px] text-white/30 mt-1.5">+{days.length - 3} jour{days.length - 3 !== 1 ? 's' : ''}</p>
            )}
          </div>
        )}
      </div>
    )
  }

  if (protocols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
          <Plus size={20} className="text-white/20" />
        </div>
        <p className="text-[14px] font-semibold text-white/60 mb-1">Aucun protocole nutritionnel</p>
        <p className="text-[12px] text-white/30 mb-6">Créez le premier protocole pour ce client</p>
        <Link
          href={`/coach/clients/${clientId}/protocoles/nutrition/new`}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.12em] hover:bg-[#217356] transition-colors"
        >
          <Plus size={14} /> Créer un protocole
        </Link>
      </div>
    )
  }

  const allProtocols = [
    ...(shared ? [{ protocol: shared, isActive: true }] : []),
    ...drafts.map(p => ({ protocol: p, isActive: false })),
  ]

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {allProtocols.map(({ protocol, isActive }) => renderProtocolCard(protocol, isActive))}
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
