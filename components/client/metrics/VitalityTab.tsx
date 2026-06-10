'use client'

import { useClientT } from '@/components/client/ClientI18nProvider'
import VitalityScoreHero from './VitalityScoreHero'
import MetricCard from './MetricCard'
import type { VitalityResponse } from '@/app/api/client/vitality/route'

interface Props {
  data: VitalityResponse
}

const VITALITY_CONFIG_KEYS = [
  { key: 'energy'   as const, iKey: 'nutrition.energy',    unit: ' / 5', positiveIsUp: true  },
  { key: 'sleep'    as const, iKey: 'vitality.sleep',      unit: ' / 4', positiveIsUp: true  },
  { key: 'stress'   as const, iKey: 'nutrition.stress',    unit: ' / 5', positiveIsUp: false },
  { key: 'soreness' as const, iKey: 'vitality.soreness',   unit: ' / 4', positiveIsUp: false },
]

type VitalKey = 'energy' | 'sleep' | 'stress' | 'soreness'

function buildVitalSeries(trend: VitalityResponse['trend'], key: VitalKey) {
  return trend
    .filter(d => d[key] != null)
    .map(d => ({ date: d.date, value: d[key] as number }))
}

function avg7(series: { value: number }[]): number | null {
  const recent = series.slice(-7)
  if (recent.length === 0) return null
  return Math.round((recent.reduce((a, b) => a + b.value, 0) / recent.length) * 10) / 10
}

function vitalDelta(
  series: { value: number }[],
  positiveIsUp: boolean,
): { delta: string; deltaGood: boolean } | undefined {
  const prev = avg7(series.slice(0, Math.max(0, series.length - 7)))
  const curr = avg7(series.slice(-7))
  if (prev == null || curr == null) return undefined
  const diff = curr - prev
  if (Math.abs(diff) < 0.1) return undefined
  const sign = diff > 0 ? '+' : ''
  const deltaGood = positiveIsUp ? diff > 0 : diff < 0
  return { delta: `${sign}${diff.toFixed(1)} pts`, deltaGood }
}

export default function VitalityTab({ data }: Props) {
  const { t } = useClientT()
  const VITALITY_CONFIG = VITALITY_CONFIG_KEYS.map(cfg => ({
    ...cfg,
    label: t(cfg.iKey as any),
  }))

  return (
    <div className="space-y-3">
      <VitalityScoreHero score={data.score} checkinCount={data.checkinCount} />

      {data.trend.length > 0 && (
        <div className="space-y-3 pt-1">
          {VITALITY_CONFIG.map(({ key, label, unit, positiveIsUp }) => {
            const series = buildVitalSeries(data.trend, key)
            if (series.length === 0) return null
            const latestAvg = avg7(series)
            if (latestAvg == null) return null
            const d = vitalDelta(series, positiveIsUp)
            return (
              <MetricCard
                key={key}
                label={label}
                value={`${latestAvg}${unit}`}
                series={series}
                unit={unit}
                {...(d ?? {})}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
