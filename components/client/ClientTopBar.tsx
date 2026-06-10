'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface Props {
  left?: React.ReactNode
  section?: string
  title?: string
  backHref?: string
  right?: React.ReactNode
  hideCoachButton?: boolean
}

export default function ClientTopBar({ left, section, title, backHref, right }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-[#0d0d0d] px-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {left ?? (
          <>
            {backHref && (
              <Link
                href={backHref}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#222222] text-[#b0b0b0] hover:bg-[#2e2e2e] transition-colors shrink-0"
              >
                <ChevronLeft size={16} />
              </Link>
            )}
            <div className="min-w-0">
              {section && (
                <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.22em] text-[#5a5a5a] leading-none mb-0.5">
                  {section}
                </p>
              )}
              {title && (
                <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#e0e0e0] leading-tight truncate">
                  {title}
                </p>
              )}
            </div>
          </>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {right && <>{right}</>}
      </div>
    </header>
  )
}
