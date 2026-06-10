'use client'

import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

/** Bloc recommandation principal — lisible en un coup d'œil. */
export default function PhaseInsightCard({ children }: Props) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] px-4 py-3.5">
      {children}
    </div>
  )
}
