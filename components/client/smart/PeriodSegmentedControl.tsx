'use client'

type PeriodOption<T extends string | number> = {
  value: T
  label: string
}

type Props<T extends string | number> = {
  options: readonly PeriodOption<T>[]
  value: T
  onChange: (value: T) => void
}

export default function PeriodSegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-1">
      <div className="grid grid-cols-4 gap-1">
        {options.map((option) => {
          const active = option.value === value

          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-[14px] px-3 py-3 text-center text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] transition-all duration-200 ${
                active
                  ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  : 'text-white/28 hover:text-white/55'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
