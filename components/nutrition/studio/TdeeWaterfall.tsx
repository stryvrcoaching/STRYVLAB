'use client'

import type { MacroResult } from '@/lib/formulas/macros'

interface TdeeWaterfallProps {
  result: MacroResult
}

const SOURCE_LABELS: Record<string, string> = {
  measured: 'balance',
  'katch-mcardle': 'Katch',
  mifflin: 'Mifflin',
  steps: 'pas',
  'activity-level': 'activité',
  tracker: 'tracker',
  'duration-met': 'MET',
  table: 'table',
  'duration-met_cardio': 'MET',
  none: '',
}

const SEGMENTS = [
  { key: 'bmr',  label: 'BMR',  color: '#3b82f6', desc: 'métabolisme de base' },
  { key: 'neat', label: 'NEAT', color: '#8b5cf6', desc: 'activité quotidienne' },
  { key: 'eat',  label: 'EAT',  color: '#1f8a65', desc: 'thermolyse' },
  { key: 'tef',  label: 'TEF',  color: '#f59e0b', desc: 'digestion · 10% BMR' },
]

export default function TdeeWaterfall({ result }: TdeeWaterfallProps) {
  const { breakdown, tdee, dataProvenance } = result

  const items = [
    { key: 'bmr',  value: breakdown.bmr,                        source: SOURCE_LABELS[dataProvenance.bmrSource]  ?? '' },
    { key: 'neat', value: breakdown.neat,                       source: SOURCE_LABELS[dataProvenance.neatSource] ?? '' },
    { key: 'eat',  value: breakdown.eat + breakdown.eatCardio,  source: SOURCE_LABELS[dataProvenance.eatSource]  ?? '' },
    { key: 'tef',  value: breakdown.tef,                        source: '10% BMR' },
  ]

  return (
    <div className="space-y-3">

      {/* Barre empilée */}
      <div className="flex w-full h-[8px] overflow-hidden rounded-full bg-white/[0.04]">
        {items.map(item => (
          <div
            key={item.key}
            className="transition-all duration-500"
            style={{
              width: `${Math.round((item.value / tdee) * 100)}%`,
              backgroundColor: SEGMENTS.find(s => s.key === item.key)?.color,
            }}
          />
        ))}
      </div>

      {/* Grille 4 segments */}
      <div className="grid grid-cols-4 gap-2">
        {items.map(item => {
          const seg = SEGMENTS.find(s => s.key === item.key)!
          const pct = Math.round((item.value / tdee) * 100)
          return (
            <div key={item.key} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-[10px] font-semibold text-white/70">{seg.label}</span>
              </div>
              <p className="text-[13px] font-bold text-white leading-none">{item.value}</p>
              <p className="text-[9px] text-white/35">{pct}% · {item.source || seg.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
        <span className="text-[10px] text-white/40">TDEE estimé</span>
        <span className="text-[15px] font-bold text-white">{tdee} <span className="text-[10px] font-normal text-white/40">kcal</span></span>
      </div>

    </div>
  )
}
