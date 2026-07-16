'use client'

import MetricZoneBar, { type MetricZone } from './MetricZoneBar'

interface Props {
  label: string
  value: string
  unit?: string
  subtitle?: string
  zone: MetricZone | null
  zoneLabel?: string
}

export default function PhaseFooterMetricCard({ label, value, unit, subtitle, zone, zoneLabel }: Props) {
  return (
    <div className="flex min-h-[108px] flex-col rounded-lg bg-white/[0.03] px-2.5 py-2">
      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/30">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span className="text-[15px] font-bold leading-none text-white/90 tabular-nums">
          {value}
        </span>
        {unit ? <span className="text-[9px] font-medium text-white/30">{unit}</span> : null}
      </div>
      {subtitle ? (
        <p className="mt-0.5 text-[7px] leading-tight text-white/25">{subtitle}</p>
      ) : null}
      <div className="mt-auto pt-1.5">
        <MetricZoneBar zone={zone} zoneLabel={zoneLabel} compact />
      </div>
    </div>
  )
}
