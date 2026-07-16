'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, FileText } from 'lucide-react'
import type { DocsEntry } from '@/lib/docs/registry'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export default function ContextDocsMenu({
  docs,
  compact = false,
}: {
  docs: DocsEntry[]
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  const items = useMemo(() => docs, [docs])

  if (items.length === 0) return null

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Ouvrir la documentation"
            title="Documentation"
            className={`flex items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/70 transition-all hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.98] ${compact ? 'h-8 w-8' : 'h-9 px-3 text-[12px] font-semibold'}`}
          >
            <FileText size={12} />
            <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="rounded-xl border border-white/[0.06] bg-[#0f0f0f] px-2.5 py-1.5 text-[11px] font-medium text-white/80"
        >
          Documentation
        </TooltipContent>
      </Tooltip>

      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Fermer"
          />
          <div className="absolute right-0 z-50 mt-2 w-[340px] rounded-2xl border border-white/[0.08] bg-[#161616] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            {items.map((doc) => (
              <Link
                key={doc.id}
                href={doc.route}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.05]"
              >
                <p className="text-[13px] font-semibold text-white">{doc.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-white/55">{doc.summary}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
