'use client'

import { useState } from 'react'
import { TrendingUp, Loader2 } from 'lucide-react'

interface Props {
  programId: string
  initialEnabled: boolean
}

/**
 * Toggle double progression sur un programme.
 * Appelle PATCH /api/programs/[programId] avec { progressive_overload_enabled }.
 * Destiné au coach uniquement — ne pas rendre côté client.
 */
export default function ProgressionToggle({ programId, initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const next = !enabled
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progressive_overload_enabled: next }),
      })
      if (res.ok) setEnabled(next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface rounded-card">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-md ${enabled ? 'bg-accent/10' : 'bg-surface-light'}`}>
          <TrendingUp size={14} className={enabled ? 'text-accent' : 'text-secondary'} />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary leading-tight">Double Progression + RIR</p>
          <p className="text-[10px] text-secondary mt-0.5 leading-relaxed max-w-xs">
            {enabled
              ? 'Actif — les charges augmentent automatiquement quand le client atteint la borne haute de sa plage de reps.'
              : 'Inactif — prescriptions fixes, pas d\'ajustement automatique des charges.'}
          </p>
        </div>
      </div>

      <button
        onClick={toggle}
        disabled={loading}
        aria-label={enabled ? 'Désactiver la double progression' : 'Activer la double progression'}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60 ${
          enabled ? 'bg-accent' : 'bg-surface-light'
        }`}
      >
        {loading ? (
          <Loader2 size={12} className="absolute inset-0 m-auto text-white animate-spin" />
        ) : (
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        )}
      </button>
    </div>
  )
}
