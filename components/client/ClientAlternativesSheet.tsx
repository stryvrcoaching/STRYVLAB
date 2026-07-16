'use client'

import { X } from 'lucide-react'
import useBodyScrollLock from '@/components/client/useBodyScrollLock'
import { useClientT } from '@/components/client/ClientI18nProvider'

interface Props {
  exerciseName: string
  alternatives: string[]
  onSelect: (name: string) => void
  onClose: () => void
}

export default function ClientAlternativesSheet({
  exerciseName,
  alternatives,
  onSelect,
  onClose,
}: Props) {
  const { t } = useClientT()
  useBodyScrollLock(true)

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full bg-[#111111] rounded-t-[2px] p-5 flex flex-col gap-4"
        style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30 mb-0.5">
              {t('workout.alternativesFor')}
            </p>
            <p className="text-[15px] font-bold text-white leading-snug">{exerciseName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/50"
            aria-label={t('ui.close')}
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-[12px] text-white/40 -mt-1">
          {t('workout.alternativesHelp')}
        </p>

        <div className="flex flex-col gap-2">
          {alternatives.map((alt, i) => (
            <button
              key={i}
              onClick={() => {
                onSelect(alt)
                onClose()
              }}
              className="flex items-center justify-between w-full bg-white/[0.04] hover:bg-white/[0.08] rounded-xl px-4 py-3.5 text-left transition-colors active:scale-[0.98]"
            >
              <span className="text-[13px] font-semibold text-white">{alt}</span>
              <span className="text-[11px] text-[#f2f2f2] font-bold">{t('workout.choose')} →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
