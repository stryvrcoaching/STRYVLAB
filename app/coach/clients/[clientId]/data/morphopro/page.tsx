'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Upload, GitCompare, Pencil, Dna, X } from 'lucide-react'
import { useClient } from '@/lib/client-context'
import { useClientTopBar } from '@/components/clients/useClientTopBar'
import { MorphoGallery } from '@/components/morpho/MorphoGallery'
import { MorphoUploadModal } from '@/components/morpho/MorphoUploadModal'
import { MorphoCompare } from '@/components/morpho/MorphoCompare'
import { MorphoAnalysisDrawer } from '@/components/morpho/MorphoAnalysisDrawer'
import { MorphoBiomechSummary } from '@/components/morpho/MorphoBiomechSummary'
import { MorphoEvolutionPanel } from '@/components/morpho/MorphoEvolutionPanel'
import type { MorphoPhoto, MorphoAnalysisSummary } from '@/lib/morpho/types'

// Fabric.js is heavy (~500kb) — load only when coach clicks "Annoter"
const MorphoCanvas = dynamic(
  () => import('@/components/morpho/MorphoCanvas').then(m => ({ default: m.MorphoCanvas })),
  { ssr: false }
)

export default function MorphoProPage() {
  const { clientId } = useClient()
  const [showUpload, setShowUpload] = useState(false)
  const [canvasPhoto, setCanvasPhoto] = useState<MorphoPhoto | null>(null)
  const [comparePhotos, setComparePhotos] = useState<MorphoPhoto[] | null>(null)
  const [viewAnalysis, setViewAnalysis] = useState<MorphoAnalysisSummary | null>(null)
  const [galleryRefresh, setGalleryRefresh] = useState(0)

  // Fetch centralisé des analyses — partagé entre Summary + Gallery (évite 2 fetchs redondants)
  const [analyses, setAnalyses] = useState<MorphoAnalysisSummary[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/clients/${clientId}/morpho/analyses?limit=100&offset=0`)
      .then(r => r.json())
      .then(d => { if (alive) setAnalyses(d.analyses ?? []) })
      .catch(() => { if (alive) setAnalyses([]) })
    return () => { alive = false }
  }, [clientId])

  // Nouvelle analyse créée depuis la galerie → prepend sans refetch
  const handleAnalysisCreated = useCallback((summary: MorphoAnalysisSummary) => {
    setAnalyses(prev => [summary, ...(prev ?? [])])
    setViewAnalysis(summary)
  }, [])

  // Selection state lifted from MorphoGallery
  const [selectionState, setSelectionState] = useState<{
    selected: Set<string>
    selectedPhotos: MorphoPhoto[]
    analyzing: boolean
    onAnalyze: () => void
  }>({ selected: new Set(), selectedPhotos: [], analyzing: false, onAnalyze: () => {} })

  const handleSelectionChange = useCallback((
    selected: Set<string>,
    selectedPhotos: MorphoPhoto[],
    analyzing: boolean,
    onAnalyze: () => void
  ) => {
    setSelectionState({ selected, selectedPhotos, analyzing, onAnalyze })
  }, [])

  const { selected, selectedPhotos, analyzing, onAnalyze } = selectionState
  const count = selected.size

  const topBarRight = count > 0 ? (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-white/40 mr-1">{count} sélectionnée{count > 1 ? 's' : ''}</span>
      <button
        onClick={() => setComparePhotos(selectedPhotos)}
        disabled={count < 2 || count > 4}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/[0.04] text-white/55 text-[10px] font-bold hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 transition-all"
      >
        <GitCompare size={12} />
        Comparer
      </button>
      <button
        onClick={() => selectedPhotos[0] && setCanvasPhoto(selectedPhotos[0])}
        disabled={count !== 1}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/[0.04] text-white/55 text-[10px] font-bold hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 transition-all"
      >
        <Pencil size={12} />
        Annoter
      </button>
      <button
        onClick={onAnalyze}
        disabled={analyzing}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[#1f8a65] text-white text-[10px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-all"
      >
        <Dna size={12} className={analyzing ? 'animate-pulse' : ''} />
        {analyzing ? 'Analyse…' : 'Analyser IA'}
      </button>
      <button
        onClick={() => setSelectionState(s => ({ ...s, selected: new Set(), selectedPhotos: [] }))}
        className="p-1.5 text-white/30 hover:text-white/60 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  ) : (
    <button
      onClick={() => setShowUpload(true)}
      className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/[0.04] text-white/55 text-[10px] font-bold hover:bg-white/[0.08] hover:text-white/80 transition-all"
    >
      <Upload size={12} />
      Photo
    </button>
  )

  useClientTopBar('MorphoPro', topBarRight)

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24 pt-4 space-y-4">
        <MorphoBiomechSummary
          latestAnalysis={analyses === null ? undefined : (analyses[0] ?? null)}
          onViewAnalysis={setViewAnalysis}
        />
        <MorphoEvolutionPanel clientId={clientId} />
        <MorphoGallery
          clientId={clientId}
          analyses={analyses ?? []}
          onOpenCanvas={setCanvasPhoto}
          onOpenUpload={() => setShowUpload(true)}
          onViewAnalysis={setViewAnalysis}
          onAnalysisCreated={handleAnalysisCreated}
          onSelectionChange={handleSelectionChange}
          refreshToken={galleryRefresh}
        />
      </div>

      <MorphoAnalysisDrawer
        analysis={viewAnalysis}
        clientId={clientId}
        onClose={() => setViewAnalysis(null)}
      />

      {showUpload && (
        <MorphoUploadModal
          clientId={clientId}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setGalleryRefresh(t => t + 1) }}
        />
      )}

      {canvasPhoto && (
        <MorphoCanvas
          photo={canvasPhoto}
          clientId={clientId}
          onClose={() => setCanvasPhoto(null)}
        />
      )}

      {comparePhotos && (
        <MorphoCompare
          initialPhotos={comparePhotos}
          onClose={() => setComparePhotos(null)}
        />
      )}
    </main>
  )
}
