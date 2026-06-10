'use client'

const DOT: Record<string, string> = {
  low: 'bg-[#1f8a65]',
  medium: 'bg-amber-400',
  high: 'bg-red-400',
  watch: 'bg-[#1f8a65]',
}

interface Props {
  message: string
  tone?: keyof typeof DOT
  prominent?: boolean
}

export default function PhaseStatusAlert({ message, tone = 'watch', prominent = false }: Props) {
  return (
    <div className="flex items-start gap-2">
      <div className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone] ?? DOT.watch}`} />
      <span
        className={
          prominent
            ? 'text-[13px] font-medium leading-snug text-white/75'
            : 'text-[11px] leading-relaxed text-white/45'
        }
      >
        {message}
      </span>
    </div>
  )
}
