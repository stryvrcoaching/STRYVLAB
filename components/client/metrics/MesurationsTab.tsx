'use client'

import MetricCard from './MetricCard'
import type { BodyDataResponse } from '@/app/api/client/body-data/route'

interface Props {
  data: BodyDataResponse
}

function buildMeasureSeries(
  measuresByBilan: BodyDataResponse['measuresByBilan'],
  key: string,
) {
  return measuresByBilan
    .filter(b => b.values?.[key] != null)
    .map(b => ({ date: b.date, value: b.values[key] as number, bilanIndex: b.bilanIndex }))
}

function measureDelta(series: { value: number }[]): { delta: string; deltaGood: boolean } | undefined {
  if (series.length < 2) return undefined
  const diff = series[series.length - 1].value - series[0].value
  const sign = diff > 0 ? '+' : ''
  return { delta: `${sign}${diff} cm`, deltaGood: diff <= 0 }
}

export default function MesurationsTab({ data }: Props) {
  const hasCards = data.measureOrder.some(
    key => buildMeasureSeries(data.measuresByBilan, key).length > 0
  )

  if (!hasCards) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-[13px] text-white/30 text-center leading-relaxed">
          Aucune mensuration enregistrée.<br />
          Appuie sur <span className="text-white/50 font-semibold">+</span> pour en ajouter.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-1">
      {data.measureOrder.map((key) => {
        const series = buildMeasureSeries(data.measuresByBilan, key)
        if (series.length === 0) return null
        const latest = series[series.length - 1]
        const d = measureDelta(series)
        const label = data.measureLabels[key] ?? key
        return (
          <MetricCard
            key={key}
            label={label}
            value={`${latest.value} cm`}
            series={series}
            unit=" cm"
            {...(d ?? {})}
          />
        )
      })}
    </div>
  )
}
