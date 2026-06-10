'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { POSITION_LABELS, type MorphoPhoto } from '@/lib/morpho/types'

type Layout = '1x2' | '2x2' | '1+3'

interface Props {
  initialPhotos: MorphoPhoto[]
  onClose: () => void
}

export function MorphoCompare({ initialPhotos, onClose }: Props) {
  const [layout, setLayout] = useState<Layout>('1x2')
  const [slots, setSlots] = useState<Array<MorphoPhoto | null>>(() => {
    const arr: Array<MorphoPhoto | null> = [null, null, null, null]
    initialPhotos.slice(0, 4).forEach((p, i) => { arr[i] = p })
    return arr
  })
  const [opacity, setOpacity] = useState(50)
  const [splitDirection, setSplitDirection] = useState<'horizontal' | 'vertical'>('vertical')

  const slotCount = layout === '1x2' ? 2 : 4

  const gridClass = layout === '1x2'
    ? 'grid-cols-2'
    : 'grid-cols-2 grid-rows-2'

  void setSlots
  void splitDirection

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="h-12 bg-[#181818] border-b-[0.3px] border-white/[0.06] flex items-center px-4 gap-3 shrink-0">
        <p className="text-[12px] font-bold text-white/70">Comparaison</p>
        <div className="flex gap-1">
          {(['1x2', '2x2', '1+3'] as Layout[]).map(l => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`px-2.5 h-7 rounded-lg text-[10px] font-bold transition-all ${
                layout === l ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Superposition (1x2 seulement) */}
        {layout === '1x2' && slots[0] && slots[1] && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Superposition</span>
            <input
              type="range" min={0} max={100} value={opacity}
              onChange={e => setOpacity(Number(e.target.value))}
              className="w-20"
            />
            <button
              onClick={() => setSplitDirection(d => d === 'vertical' ? 'horizontal' : 'vertical')}
              className="px-2 h-6 rounded text-[9px] bg-white/[0.04] text-white/50 hover:text-white/70"
            >
              {splitDirection === 'vertical' ? '⇕ Horiz.' : '⇔ Vert.'}
            </button>
          </div>
        )}

        <div className="flex-1" />
        <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white/70 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Grille de slots */}
      <div className={`flex-1 grid ${gridClass} gap-px`}>
        {Array.from({ length: slotCount }).map((_, i) => {
          const photo = slots[i] ?? null
          return (
            <div key={i} className="relative bg-[#181818] flex items-center justify-center">
              {(photo?.full_url ?? photo?.signed_url) ? (
                <>
                  <Image
                    src={(photo.full_url ?? photo.signed_url)!}
                    alt={POSITION_LABELS[photo.position]}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                  {/* Overlay superposition (slot 1 seulement en mode 1x2) */}
                  {layout === '1x2' && i === 1 && (slots[0]?.full_url ?? slots[0]?.signed_url) && (
                    <div
                      className="absolute inset-0"
                      style={{ opacity: opacity / 100 }}
                    >
                      <Image
                        src={(slots[0].full_url ?? slots[0].signed_url)!}
                        alt="overlay"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-[#181818]/80 rounded px-1.5 py-0.5">
                    <p className="text-[9px] text-white/60">{POSITION_LABELS[photo.position]} — {new Date(photo.taken_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-1">
                  <p className="text-[11px] text-white/20">Slot {i + 1}</p>
                  <p className="text-[9px] text-white/15">Sélectionner une photo depuis la galerie</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
