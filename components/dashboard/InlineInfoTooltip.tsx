'use client'

import { HelpCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useHelpMode } from '@/components/dashboard/help-mode'

type InlineInfoTooltipProps = {
  title: string
  body: string
  placement?: 'top' | 'bottom'
  width?: 'sm' | 'md'
}

export function InlineInfoTooltip({
  title,
  body,
  placement = 'top',
  width = 'md',
}: InlineInfoTooltipProps) {
  const { enabled } = useHelpMode()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const panelWidth = width === 'sm' ? 'w-[220px] sm:w-[240px]' : 'w-[248px] sm:w-[280px]'
  const placementClass =
    placement === 'bottom'
      ? 'left-1/2 top-full mt-2 -translate-x-1/2'
      : 'left-1/2 bottom-full mb-2 -translate-x-1/2'

  return (
    <div ref={rootRef} className="group relative inline-flex shrink-0 items-center align-top">
      <button
        type="button"
        aria-label={`Info ${title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
            setOpen(false)
          }
        }}
        className={`flex h-6 w-6 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-white/20 ${
          enabled
            ? 'border-white/16 bg-white/[0.09] text-white/88 hover:bg-white/[0.13]'
            : 'border-white/[0.06] bg-white/[0.04] text-white/46 hover:border-white/14 hover:bg-white/[0.08] hover:text-white/82'
        }`}
      >
        <HelpCircle size={13} />
      </button>

      <div
        id={panelId}
        role="tooltip"
        className={`absolute ${placementClass} ${panelWidth} z-[70] rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-3.5 shadow-[0_24px_56px_rgba(0,0,0,0.5)] backdrop-blur-sm transition duration-150 ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100'
        }`}
      >
        <p className="text-[11px] font-semibold tracking-[0.01em] text-white">{title}</p>
        <p className="mt-1.5 text-[12px] leading-5 text-white/78 break-words">{body}</p>
      </div>
    </div>
  )
}
