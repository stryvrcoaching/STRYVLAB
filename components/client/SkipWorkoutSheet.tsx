'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import useBodyScrollLock from '@/components/client/useBodyScrollLock'

export type SkipWorkoutReasonOption = {
  key: string
  label: string
}

type SkipWorkoutSheetProps = {
  open: boolean
  title: string
  description: string
  closeLabel: string
  noteLabel: string
  notePlaceholder: string
  cancelLabel: string
  confirmLabel: string
  options: SkipWorkoutReasonOption[]
  selectedReason: string
  note: string
  submitting: boolean
  error: string | null
  onClose: () => void
  onReasonChange: (reason: string) => void
  onNoteChange: (note: string) => void
  onConfirm: () => void
}

export default function SkipWorkoutSheet({
  open,
  title,
  description,
  closeLabel,
  noteLabel,
  notePlaceholder,
  cancelLabel,
  confirmLabel,
  options,
  selectedReason,
  note,
  submitting,
  error,
  onClose,
  onReasonChange,
  onNoteChange,
  onConfirm,
}: SkipWorkoutSheetProps) {
  const [mounted, setMounted] = useState(false)
  useBodyScrollLock(open)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!open || !mounted) return null

  const close = () => {
    if (!submitting) onClose()
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label={closeLabel}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
        onClick={close}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="skip-workout-sheet-title"
        className="client-native-bottom-sheet fixed left-0 right-0 bottom-0 z-[70] flex max-h-[88dvh] flex-col rounded-t-[28px] bg-[#0d0d0d] shadow-2xl"
        style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/[0.10]" />

        <header className="flex shrink-0 items-center justify-between px-5 pt-5 pb-4">
          <h2
            id="skip-workout-sheet-title"
            className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white"
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 transition-colors active:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label={closeLabel}
          >
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <p className="mb-4 text-[12px] leading-relaxed text-white/45">{description}</p>

          <div className="space-y-2">
            {options.map((option) => {
              const selected = selectedReason === option.key

              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onReasonChange(option.key)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                    selected
                      ? 'border-white/40 bg-white/[0.045] text-white'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/55 hover:bg-white/[0.045] hover:text-white/80'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4">
            <label
              htmlFor="skip-workout-note"
              className="mb-2 block text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/35"
            >
              {noteLabel}
            </label>
            <textarea
              id="skip-workout-note"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder={notePlaceholder}
              className="min-h-[88px] w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[12px] leading-relaxed text-white outline-none placeholder:text-white/20 focus:border-white/25 focus:ring-2 focus:ring-white/10"
            />
          </div>

          {error && <p className="mt-3 text-[11px] text-[#f39a9a]">{error}</p>}
        </div>

        <footer className="shrink-0 border-t border-white/[0.07] px-5 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="min-h-12 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-[12px] font-semibold text-white/60 transition-colors hover:bg-white/[0.045] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="min-h-12 flex-1 rounded-xl bg-[#f2f2f2] px-4 text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.08em] text-[#080808] transition-opacity disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {confirmLabel}
            </button>
          </div>
        </footer>
      </section>
    </>,
    document.body,
  )
}
