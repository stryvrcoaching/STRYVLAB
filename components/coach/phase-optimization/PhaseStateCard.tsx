'use client'

interface Props {
  label: string
  value: string
  valueColor?: string
  statusDotColor: string
}

export default function PhaseStateCard({
  label,
  value,
  valueColor = '#ffffff',
  statusDotColor,
}: Props) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg bg-white/[0.04] px-3 py-2.5">
      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</p>
      <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            backgroundColor: statusDotColor,
            boxShadow: `0 0 6px ${statusDotColor}66`,
          }}
        />
        <p
          className="truncate text-[12px] font-semibold leading-tight tracking-tight"
          style={{ color: valueColor }}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
