'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Upload, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { MorphoPhotoCard } from './MorphoPhotoCard'
import {
  POSITION_LABELS,
  type MorphoPhoto,
  type MorphoPhotoPosition,
  type MorphoAnalysisSummary,
} from '@/lib/morpho/types'

interface Props {
  clientId: string
  analyses: MorphoAnalysisSummary[]
  onOpenCanvas: (photo: MorphoPhoto) => void
  onOpenUpload: () => void
  onViewAnalysis: (analysis: MorphoAnalysisSummary) => void
  onAnalysisCreated: (analysis: MorphoAnalysisSummary) => void
  onSelectionChange: (selected: Set<string>, photos: MorphoPhoto[], analyzing: boolean, onAnalyze: () => void) => void
  refreshToken: number
}

const POSITIONS: Array<{ value: MorphoPhotoPosition | 'all'; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'front', label: 'Face' },
  { value: 'back', label: 'Dos' },
  { value: 'left', label: 'Profil G' },
  { value: 'right', label: 'Profil D' },
  { value: 'three_quarter_front_left', label: '¾ G' },
  { value: 'three_quarter_front_right', label: '¾ D' },
  { value: 'relaxed', label: 'Relâché' },
  { value: 'contracted', label: 'Contracté' },
]

void POSITION_LABELS

// Module-level cache: survives filter changes and re-renders within the same session
const urlCache = new Map<string, { signed_url: string; expires_at: number }>()
const CACHE_FRESH_MS = 50 * 60 * 1000

function applyUrlCache(photos: MorphoPhoto[]): MorphoPhoto[] {
  return photos.map(p => {
    if (p.signed_url) {
      urlCache.set(p.id, { signed_url: p.signed_url, expires_at: Date.now() + CACHE_FRESH_MS })
      return p
    }
    const cached = urlCache.get(p.id)
    if (cached && cached.expires_at > Date.now()) {
      return { ...p, signed_url: cached.signed_url }
    }
    return p
  })
}

const PAGE_SIZE = 24
const EMPTY_ANALYSES: MorphoAnalysisSummary[] = []

export function MorphoGallery({
  clientId,
  analyses,
  onOpenCanvas,
  onOpenUpload,
  onViewAnalysis,
  onAnalysisCreated,
  onSelectionChange,
  refreshToken,
}: Props) {
  const [photos, setPhotos] = useState<MorphoPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [positionFilter, setPositionFilter] = useState<MorphoPhotoPosition | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'assessment' | 'coach_upload'>('all')
  const [analyzing, setAnalyzing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const buildParams = useCallback((pageOffset: number) => {
    const params = new URLSearchParams({ clientId, limit: String(PAGE_SIZE), offset: String(pageOffset) })
    if (positionFilter !== 'all') params.set('position', positionFilter)
    if (sourceFilter !== 'all') params.set('source', sourceFilter)
    return params
  }, [clientId, positionFilter, sourceFilter])

  // Map photoId → analyses, dérivée de la prop `analyses` (fetch centralisé côté page)
  const analysisMap = useMemo(() => {
    const map = new Map<string, MorphoAnalysisSummary[]>()
    for (const analysis of analyses) {
      for (const photoId of analysis.photo_ids ?? []) {
        if (!map.has(photoId)) map.set(photoId, [])
        map.get(photoId)!.push(analysis)
      }
    }
    return map
  }, [analyses])

  const fetchPhotos = useCallback(async () => {
    setLoading(true)
    setOffset(0)
    try {
      const res = await fetch(`/api/morpho/photos?${buildParams(0)}`)
      const photosData = await res.json()
      setPhotos(applyUrlCache(photosData.photos ?? []))
      setHasMore(photosData.hasMore ?? false)
    } catch {
      setErrorMsg('Erreur chargement photos')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  const fetchMore = useCallback(async () => {
    const nextOffset = offset + PAGE_SIZE
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/morpho/photos?${buildParams(nextOffset)}`)
      const data = await res.json()
      setPhotos(prev => [...prev, ...applyUrlCache(data.photos ?? [])])
      setHasMore(data.hasMore ?? false)
      setOffset(nextOffset)
    } catch {
      setErrorMsg('Erreur chargement photos')
    } finally {
      setLoadingMore(false)
    }
  }, [offset, buildParams])

  useEffect(() => {
    fetch('/api/morpho/photos/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    })
    fetchPhotos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  useEffect(() => {
    fetchPhotos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionFilter, sourceFilter, refreshToken])

  const handleAnalyze = useCallback(async () => {
    const photoIds = Array.from(selected)
    setAnalyzing(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/morpho/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds, clientId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Erreur analyse')
      } else {
        setSelected(new Set())
        const summary: MorphoAnalysisSummary = {
          id: data.analysis_id,
          analysis_date: new Date().toISOString(),
          status: 'completed',
          photo_ids: photoIds,
          analysis_result: data.analysis_result,
          biomech_profile: null,
          prompt_version: data.prompt_version,
          stimulus_adjustments: data.stimulus_adjustments,
          body_composition: null,
          asymmetries: null,
          error_message: null,
        }
        onAnalysisCreated(summary)
      }
    } catch {
      setErrorMsg('Erreur réseau')
    } finally {
      setAnalyzing(false)
    }
  }, [selected, clientId, onAnalysisCreated])

  useEffect(() => {
    const selectedPhotos = photos.filter(p => selected.has(p.id))
    onSelectionChange(selected, selectedPhotos, analyzing, handleAnalyze)
  }, [selected, photos, analyzing, handleAnalyze, onSelectionChange])

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-7 w-16 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-6 gap-2">
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => <Skeleton key={i} className="aspect-[2/3] rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-red-500/[0.08] rounded-xl px-4 py-3 border-[0.3px] border-red-500/20">
          <p className="text-[11px] text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        {POSITIONS.map(p => (
          <button
            key={p.value}
            onClick={() => setPositionFilter(p.value as MorphoPhotoPosition | 'all')}
            className={`px-2.5 h-7 rounded-lg text-[10px] font-semibold transition-all ${
              positionFilter === p.value
                ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
                : 'bg-white/[0.03] text-white/40 hover:text-white/60'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="w-px h-4 bg-white/[0.06]" />
        {(['all', 'assessment', 'coach_upload'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSourceFilter(s)}
            className={`px-2.5 h-7 rounded-lg text-[10px] font-semibold transition-all ${
              sourceFilter === s
                ? 'bg-white/[0.08] text-white/80'
                : 'bg-white/[0.03] text-white/40 hover:text-white/60'
            }`}
          >
            {s === 'all' ? 'Toutes sources' : s === 'assessment' ? 'Bilans' : 'Uploads'}
          </button>
        ))}
        <button onClick={fetchPhotos} className="ml-auto p-1.5 text-white/30 hover:text-white/60 transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Grille */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-[13px] text-white/30">Aucune photo morphologique</p>
          <p className="text-[11px] text-white/20">Ajoutez des photos via un bilan ou uploadez directement</p>
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-4 h-8 rounded-lg bg-[#1f8a65]/10 text-[#1f8a65] text-[11px] font-bold hover:bg-[#1f8a65]/20 transition-all mt-2"
          >
            <Upload size={12} />
            Ajouter une photo
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-6 gap-2">
            {photos.map(photo => (
              <MorphoPhotoCard
                key={photo.id}
                photo={photo}
                selected={selected.has(photo.id)}
                onToggle={toggleSelect}
                onAnnotate={onOpenCanvas}
                analyses={analysisMap.get(photo.id) ?? EMPTY_ANALYSES}
                onViewAnalysis={onViewAnalysis}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={fetchMore}
                disabled={loadingMore}
                className="px-6 h-8 rounded-lg bg-white/[0.04] text-[11px] font-semibold text-white/50 hover:bg-white/[0.07] hover:text-white/70 transition-all disabled:opacity-40"
              >
                {loadingMore ? 'Chargement…' : 'Charger plus'}
              </button>
            </div>
          )}
        </>
      )}

    </div>
  )
}
