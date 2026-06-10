'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Exercise {
  id: string
  name: string
  sets: number
  reps: string
}

export default function ExerciseListDisclosure({ exercises }: { exercises: Exercise[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.14em]">
          Exercices ({exercises.length})
        </span>
        <ChevronDown
          size={14}
          className={`text-white/25 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-4 flex flex-col gap-0.5">
          {exercises.map((ex, i) => (
            <div key={ex.id} className="flex items-center gap-3 py-1.5">
              <span className="text-[9px] font-mono text-white/20 w-4 shrink-0 text-right">{i + 1}</span>
              <span className="text-[12px] text-white/65 flex-1">{ex.name}</span>
              <span className="text-[11px] font-mono text-[#f2f2f2]/70 shrink-0">{ex.sets}×{ex.reps}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
