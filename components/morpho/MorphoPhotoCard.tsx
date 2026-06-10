'use client'

import { memo } from 'react'
import Image from 'next/image'
import { CheckCircle2, Pencil, Dna } from 'lucide-react'
import { POSITION_LABELS, type MorphoPhoto, type MorphoAnalysisSummary } from '@/lib/morpho/types'

interface Props {
  photo: MorphoPhoto
  selected: boolean
  onToggle: (id: string) => void
  onAnnotate: (photo: MorphoPhoto) => void
  analyses: MorphoAnalysisSummary[]
  onViewAnalysis: (analysis: MorphoAnalysisSummary) => void
}

function MorphoPhotoCardImpl({ photo, selected, onToggle, onAnnotate, analyses, onViewAnalysis }: Props) {
  const latestAnalysis = analyses[0] ?? null

  return (
    <div
      className={`relative rounded-xl overflow-hidden cursor-pointer border-[0.3px] transition-all ${
        selected
          ? 'border-[#1f8a65] ring-1 ring-[#1f8a65]/40'
          : 'border-white/[0.06] hover:border-white/[0.12]'
      }`}
      onClick={() => onToggle(photo.id)}
    >
      <div className="aspect-[2/3] bg-white/[0.03] relative">
        {photo.signed_url ? (
          <Image
            src={photo.signed_url}
            alt={POSITION_LABELS[photo.position]}
            fill
            className="object-cover"
            unoptimized
            loading="lazy"
            sizes="(max-width: 768px) 17vw, 15vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/20 text-[10px]">Photo</span>
          </div>
        )}

        {selected && (
          <div className="absolute inset-0 bg-[#1f8a65]/10 flex items-start justify-end p-2">
            <CheckCircle2 size={16} className="text-[#1f8a65]" />
          </div>
        )}

        {/* IA badge — independent of selection click */}
        {latestAnalysis && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onViewAnalysis(latestAnalysis)
            }}
            className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-[#1f8a65] rounded-md px-1.5 py-0.5 hover:bg-[#217356] transition-colors z-10"
            title={`Analyse IA — ${analyses.length} analyse${analyses.length > 1 ? 's' : ''}`}
          >
            <Dna size={9} className="text-white" />
            <span className="text-[9px] text-white font-bold">IA</span>
            {analyses.length > 1 && (
              <span className="text-[8px] text-white/70">{analyses.length}</span>
            )}
          </button>
        )}

        {photo.has_annotation && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-[#181818]/90 rounded-md px-1.5 py-0.5">
            <Pencil size={9} className="text-white/50" />
            <span className="text-[9px] text-white/50">Annoté</span>
          </div>
        )}
      </div>

      <div className="p-2 space-y-0.5">
        <p className="text-[10px] font-semibold text-white/80">{POSITION_LABELS[photo.position]}</p>
        <p className="text-[9px] text-white/40">
          {new Date(photo.taken_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onAnnotate(photo) }}
          className="text-[9px] text-[#1f8a65]/70 hover:text-[#1f8a65] transition-colors mt-0.5"
        >
          Annoter →
        </button>
      </div>
    </div>
  )
}

// Memo : évite de re-render les 24 cartes (avec images) à chaque toggle de sélection
export const MorphoPhotoCard = memo(MorphoPhotoCardImpl, (prev, next) =>
  prev.photo.id === next.photo.id &&
  prev.photo.signed_url === next.photo.signed_url &&
  prev.photo.has_annotation === next.photo.has_annotation &&
  prev.selected === next.selected &&
  prev.analyses === next.analyses &&
  prev.onToggle === next.onToggle &&
  prev.onAnnotate === next.onAnnotate &&
  prev.onViewAnalysis === next.onViewAnalysis
)
