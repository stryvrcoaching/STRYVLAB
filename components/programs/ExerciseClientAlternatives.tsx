'use client'

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { X, Library } from 'lucide-react'

interface Alternative {
  id: string
  name: string
  notes: string | null
  position: number
}

export interface ExerciseClientAlternativesHandle {
  addAlternative: (name: string) => Promise<void>
}

interface Props {
  templateId: string
  exerciseId: string
  onRequestAddFromCatalog: () => void
}

const ExerciseClientAlternatives = forwardRef<ExerciseClientAlternativesHandle, Props>(
  function ExerciseClientAlternatives({ templateId, exerciseId, onRequestAddFromCatalog }, ref) {
    const [alternatives, setAlternatives] = useState<Alternative[]>([])
    const [error, setError] = useState('')

    const url = `/api/program-templates/${templateId}/exercises/${exerciseId}/alternatives`

    useEffect(() => {
      fetch(url).then(r => r.json()).then(data => {
        if (Array.isArray(data)) setAlternatives(data)
      }).catch(() => {})
    }, [url])

    async function addAlternative(name: string) {
      if (!name.trim()) return
      setError('')
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur')
      } else {
        setAlternatives(prev => [...prev, data])
      }
    }

    useImperativeHandle(ref, () => ({ addAlternative }))

    async function handleDelete(id: string) {
      const res = await fetch(`${url}?id=${id}`, { method: 'DELETE' })
      if (res.ok) setAlternatives(prev => prev.filter(a => a.id !== id))
    }

    return (
      <div className="mt-1 border-t border-white/[0.06] pt-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30 mb-1.5">
          Alternatives client ({alternatives.length}/3)
        </p>

        {alternatives.length > 0 && (
          <div className="flex flex-col gap-1 mb-1.5">
            {alternatives.map(alt => (
              <div
                key={alt.id}
                className="flex items-center justify-between gap-2 bg-white/[0.03] rounded-lg px-2 py-1.5"
              >
                <span className="text-[11px] text-white/60 truncate">{alt.name}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(alt.id)}
                  className="shrink-0 text-white/25 hover:text-red-400 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {alternatives.length < 3 && (
          <button
            type="button"
            onClick={onRequestAddFromCatalog}
            className="flex items-center gap-1.5 text-[10px] text-[#1f8a65]/60 hover:text-[#1f8a65] transition-colors"
          >
            <Library size={10} />
            Ajouter depuis le catalogue
          </button>
        )}

        {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
      </div>
    )
  }
)

export default ExerciseClientAlternatives
