'use client'

import type { PhaseEngineLocale } from '@/lib/coach/phaseEngine/localeCopy'

interface Props {
  locale: PhaseEngineLocale
  showTrail?: boolean
  trailLabel?: string
  compact?: boolean
}

export default function PhaseQuadrantLegend({
  locale,
  showTrail,
  trailLabel,
  compact = false,
}: Props) {
  const currentLabel = locale === 'fr' ? 'Actuel' : 'Current'
  const optimalLabel = locale === 'fr' ? 'Zone optimale' : 'Optimal'

  const textClass = compact
    ? 'text-[8px] font-semibold uppercase tracking-[0.1em] text-white/35'
    : 'text-[10px] font-medium uppercase tracking-widest text-neutral-500'

  return (
    <div className={`flex flex-wrap items-center justify-center ${compact ? 'gap-x-4 gap-y-1' : 'gap-x-5 gap-y-2 px-1'}`}>
      <span className={`flex items-center gap-1.5 ${textClass}`}>
        <span
          className="inline-block h-2 w-2 rounded-full bg-[#facc15]"
          style={{ boxShadow: '0 0 6px rgba(250,204,21,0.6)' }}
        />
        {currentLabel}
      </span>
      <span className={`flex items-center gap-1.5 ${textClass}`}>
        <span
          className="inline-block h-2.5 w-4 rounded-full border border-dashed border-[#2dd4bf]/80"
        />
        {optimalLabel}
      </span>
      {showTrail && trailLabel ? (
        <span className={`flex items-center gap-1.5 ${textClass}`}>
          <span className="inline-block h-px w-4 rounded bg-white/30" />
          {trailLabel}
        </span>
      ) : null}
    </div>
  )
}
