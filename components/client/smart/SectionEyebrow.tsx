import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export default function SectionEyebrow({ children }: Props) {
  return (
    <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
      {children}
    </p>
  )
}
