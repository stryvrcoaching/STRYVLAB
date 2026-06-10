'use client'

import { useEffect, useState } from 'react'
import { useClientT } from '@/components/client/ClientI18nProvider'

interface WeightPoint { date: string; value: number }

interface Composition {
  body_fat_pct: number | null
  lean_mass_kg: number | null
  muscle_mass_kg: number | null
  skeletal_muscle_pct: number | null
  visceral_fat_level: number | null
  body_water_pct: number | null
  muscle_mass_pct: number | null
  bone_mass_kg: number | null
}

interface BodyData {
  weightSeries: WeightPoint[]
  composition: Composition
  measures: Record<string, number | null>
  measureOrder: string[]
  measureLabels: Record<string, string>
  latestWeight: number | null
}

function WeightSparkline({ series }: { series: WeightPoint[] }) {
  if (series.length < 2) return null
  const values = series.map(p => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 200
  const H = 48
  const pts = series.map((p, i) => {
    const x = (i / (series.length - 1)) * W
    const y = H - ((p.value - min) / range) * (H - 8) - 4
    return `${x},${y}`
  }).join(' ')

  const first = values[0]
  const last = values[values.length - 1]
  const delta = last - first
  const color = delta <= 0 ? '#f2f2f2' : '#ef4444'

  const lastPoint = series[series.length - 1]
  const lastX = W
  const lastY = H - ((lastPoint.value - min) / range) * (H - 8) - 4

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/30">
          {series.length} bilans
        </span>
        <span className={`text-[11px] font-bold ${delta <= 0 ? 'text-[#f2f2f2]' : 'text-red-400'}`}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12" preserveAspectRatio="none">
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
      </svg>
    </div>
  )
}

export default function BodyDataSection() {
  const { t } = useClientT()
  const [data, setData] = useState<BodyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/client/body-data')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const hasAnyData = data && (
    data.latestWeight != null ||
    (data.composition && (data.composition.body_fat_pct != null || data.composition.lean_mass_kg != null)) ||
    (data.measures && (data.measures.waist_cm != null || data.measures.hips_cm != null))
  )

  if (!hasAnyData) {
    return (
      <p className="text-[12px] text-white/40 leading-relaxed py-2">
        {t('profil.body.noData')}
      </p>
    )
  }

  const hasMeasures = data!.measures && data!.measureOrder.some(k => data!.measures[k] != null)
  const hasComposition = data!.composition && (
    data!.composition.body_fat_pct != null || data!.composition.lean_mass_kg != null
  )

  return (
    <div className="space-y-5">

      {/* ── Poids + sparkline ── */}
      {data!.latestWeight != null && (
        <div className="bg-white/[0.03] rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/40">
              {t('profil.body.weight')}
            </span>
            <span className="text-[18px] font-black text-white leading-none">
              {data!.latestWeight}
              <span className="text-[12px] font-medium text-white/40 ml-1">kg</span>
            </span>
          </div>
          {data!.weightSeries.length >= 2 && (
            <WeightSparkline series={data!.weightSeries} />
          )}
        </div>
      )}

      {/* ── Composition corporelle ── */}
      {hasComposition && (
        <div>
          <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/30 mb-2">
            {t('profil.body.composition')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {data!.composition.body_fat_pct != null && (
              <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                <p className="text-[16px] font-black text-[#f2f2f2] leading-none mb-1">
                  {data!.composition.body_fat_pct.toFixed(1)}%
                </p>
                <p className="text-[9px] font-medium text-white/40">{t('profil.body.bodyFat')}</p>
              </div>
            )}
            {data!.composition.lean_mass_kg != null && (
              <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                <p className="text-[16px] font-black text-white leading-none mb-1">
                  {data!.composition.lean_mass_kg.toFixed(1)}
                  <span className="text-[10px] font-medium text-white/40 ml-0.5">kg</span>
                </p>
                <p className="text-[9px] font-medium text-white/40">{t('profil.body.leanMass')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mensurations ── */}
      {hasMeasures && (
        <div>
          <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/30 mb-2">
            {t('profil.body.measures')}
          </p>
          <div className="space-y-1.5">
            {data!.measureOrder.map((key) => {
              const val = data!.measures[key]
              if (val == null) return null
              return (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-[12px] text-white/50">{data!.measureLabels[key] ?? key}</span>
                  <span className="text-[12px] font-bold text-white">
                    {val} <span className="text-white/30 font-normal">cm</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
