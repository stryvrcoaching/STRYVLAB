'use client'

interface TdeeWaterfallLegendProps {
  className?: string
}

const SEGMENTS = [
  { label: 'BMR (métabolisme de base)', color: '#3b82f6' },
  { label: 'NEAT (activité quotidienne)', color: '#8b5cf6' },
  { label: 'EAT (thermolyse)', color: '#f59e0b' },
  { label: 'TEF (digestion)', color: '#10b981' },
]

export default function TdeeWaterfallLegend({ className = '' }: TdeeWaterfallLegendProps) {
  return (
    <div className={`flex items-center gap-4 flex-wrap ${className}`}>
      {SEGMENTS.map(segment => (
        <div key={segment.label} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: segment.color }}
          />
          <span className="text-[10px] text-white/50">{segment.label}</span>
        </div>
      ))}
    </div>
  )
}
