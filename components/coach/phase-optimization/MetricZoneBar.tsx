'use client'

export type MetricZone = 'poor' | 'average' | 'optimal'

const ZONE_ORDER: MetricZone[] = ['poor', 'average', 'optimal']

const ZONE_COLORS: Record<MetricZone, string> = {
  poor: '#f97316',
  average: '#f59e0b',
  optimal: '#1f8a65',
}

const ZONE_LABELS: Record<MetricZone, string> = {
  poor: 'Faible',
  average: 'Moyen',
  optimal: 'Optimal',
}

export default function MetricZoneBar({
  zone,
  zoneLabel,
  compact = false,
}: {
  zone: MetricZone | null
  zoneLabel?: string
  compact?: boolean
}) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex gap-[2px]">
        {ZONE_ORDER.map(z => (
          <div
            key={z}
            className={`flex-1 rounded-full transition-all duration-300 ${compact ? 'h-[2px]' : 'h-[3px]'}`}
            style={{
              backgroundColor: ZONE_COLORS[z],
              opacity: zone === z ? 1 : 0.14,
            }}
          />
        ))}
      </div>
      <p
        className={`font-semibold uppercase tracking-[0.1em] text-white/25 ${compact ? 'text-[7px]' : 'text-[8px]'}`}
        style={{ color: zone ? ZONE_COLORS[zone] : 'rgba(255,255,255,0.25)' }}
      >
        {zoneLabel ?? (zone ? ZONE_LABELS[zone] : '—')}
      </p>
    </div>
  )
}
