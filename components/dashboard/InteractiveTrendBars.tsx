'use client'

export type TrendSeries = {
  key: string
  label: string
  tone: string
}

export type TrendDatum = {
  label: string
  values: Record<string, number>
}

export function InteractiveTrendBars({
  data,
  series,
  max,
  selectedLabel,
  onSelect,
}: {
  data: TrendDatum[]
  series: TrendSeries[]
  max: number
  selectedLabel?: string | null
  onSelect?: (label: string) => void
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 text-[11px] text-white/42">
        {series.map((item) => (
          <div key={item.key} className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
      <div className="grid min-w-[520px] grid-cols-7 gap-2">
        {data.map((item) => {
          const total = series.reduce((sum, entry) => sum + (item.values[entry.key] ?? 0), 0)
          const selected = selectedLabel === item.label
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onSelect?.(item.label)}
              aria-pressed={selected}
              aria-label={`${item.label} : ${series.map((entry) => `${entry.label} ${item.values[entry.key] ?? 0}`).join(', ')}`}
              className={`group relative flex min-w-0 flex-col items-center rounded-2xl outline-none transition focus:ring-2 focus:ring-white/25 ${onSelect ? 'cursor-pointer' : 'cursor-default'} ${selected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}
            >
              <div className={`flex h-28 w-full items-end justify-center gap-1 rounded-2xl border px-2 py-3 transition ${selected ? 'border-white/16 bg-white/[0.06]' : 'border-transparent bg-white/[0.03] group-hover:border-white/[0.08]'}`}>
                {series.map((entry) => {
                  const value = item.values[entry.key] ?? 0
                  const height = value === 0 ? 3 : Math.max(8, (value / max) * 100)
                  return <span key={entry.key} className={`w-2 rounded-full ${entry.tone}`} style={{ height: `${height}%`, opacity: value === 0 ? 0.25 : 1 }} />
                })}
              </div>
              <span className="mt-2 pb-2 text-[10px] text-white/35 group-hover:text-white/65">{item.label}</span>

              <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 hidden w-44 -translate-x-1/2 rounded-xl border border-white/10 bg-[#0f0f0f] p-3 text-left shadow-[0_16px_50px_rgba(0,0,0,0.5)] group-hover:block group-focus:block">
                <span className="flex items-center justify-between text-[11px] font-semibold text-white"><span>{item.label}</span><span>{total} signaux</span></span>
                <span className="mt-2 block space-y-1">
                  {series.map((entry) => (
                    <span key={entry.key} className="flex items-center justify-between text-[10px] text-white/55"><span>{entry.label}</span><span className="font-semibold text-white/85">{item.values[entry.key] ?? 0}</span></span>
                  ))}
                </span>
                {onSelect ? <span className="mt-2 block border-t border-white/[0.06] pt-2 text-[9px] text-white/35">Cliquer pour voir les événements</span> : null}
              </span>
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}
