'use client'

import { GitCompare, Pencil, Dna, X } from 'lucide-react'

interface Props {
  count: number
  onCompare: () => void
  onAnnotate: () => void
  onAnalyze: () => void
  onClear: () => void
  analyzing: boolean
}

export function MorphoFloatingBar({ count, onCompare, onAnnotate, onAnalyze, onClear, analyzing }: Props) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-2 bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl px-4 py-3 shadow-lg">
        <span className="text-[11px] text-white/50 mr-1">{count} sélectionnée{count > 1 ? 's' : ''}</span>

        <div className="w-px h-4 bg-white/[0.06]" />

        <button
          onClick={onCompare}
          disabled={count < 2 || count > 4}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-white/[0.04] text-[10px] font-bold text-white/60 hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 transition-all"
        >
          <GitCompare size={11} />
          Comparer ({count})
        </button>

        <button
          onClick={onAnnotate}
          disabled={count !== 1}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-white/[0.04] text-[10px] font-bold text-white/60 hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 transition-all"
        >
          <Pencil size={11} />
          Annoter
        </button>

        <button
          onClick={onAnalyze}
          disabled={analyzing || count > 4}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-[#1f8a65] text-[10px] font-bold text-white hover:bg-[#217356] disabled:opacity-50 active:scale-[0.97] transition-all"
        >
          <Dna size={11} className={analyzing ? 'animate-pulse' : ''} />
          {analyzing ? 'Analyse…' : 'Analyser avec IA'}
        </button>

        <button onClick={onClear} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
