'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import useBodyScrollLock from '@/components/client/useBodyScrollLock'
import TrainingCheckinScale from './TrainingCheckinScale'

type Phase = 'pre' | 'post'

export interface TrainingCheckinValue {
  phase: Phase
  score: number
  discomfortLevel: number
  discomfortArea: string
}

export default function TrainingCheckinSheet({ phase, onSubmit, onClose }: {
  phase: Phase
  onSubmit: (value: TrainingCheckinValue) => Promise<void> | void
  onClose?: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [discomfortLevel, setDiscomfortLevel] = useState(0)
  const [discomfortArea, setDiscomfortArea] = useState('')
  const [saving, setSaving] = useState(false)
  const isPre = phase === 'pre'
  const closeLabel = isPre ? 'Plus tard' : 'Passer'

  useEffect(() => setMounted(true), [])
  useBodyScrollLock(mounted)

  async function submit() {
    if (score === null) return
    setSaving(true)
    try {
      await onSubmit({ phase, score, discomfortLevel, discomfortArea: discomfortArea.trim() })
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <>
      <motion.button
        type="button"
        aria-label="Fermer"
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={saving ? undefined : onClose}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-checkin-title"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 360, damping: 32 } }}
        exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
        className="client-native-bottom-sheet fixed bottom-0 left-0 right-0 z-[70] flex max-h-[88dvh] w-full flex-col overflow-y-auto rounded-t-[28px] bg-[#121212] px-5 pt-3 shadow-2xl"
        style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
      >
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-white/[0.10]" />

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/35">{isPre ? 'Avant la séance' : 'Après la séance'}</p>
            <h2 id="training-checkin-title" className="mt-1 text-[25px] font-bold tracking-[-0.035em] text-white">{isPre ? 'Comment est ton énergie ?' : 'Quel effort pour cette séance ?'}</h2>
          </div>
          {onClose ? (
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              disabled={saving}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08] disabled:opacity-30"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        <div className="mt-7">
          <TrainingCheckinScale
            phase={phase}
            value={score}
            onValueChange={setScore}
          />
        </div>

        <div className="mt-6">
          <p className="text-[12px] font-semibold text-white/85">As-tu ressenti une gêne ou douleur inhabituelle ?</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {['Aucune', 'Légère', 'Modérée', 'Importante'].map((label, index) => (
              <button key={label} type="button" onClick={() => setDiscomfortLevel(index)} className={`min-h-11 rounded-xl px-2 text-[11px] font-semibold transition-colors ${discomfortLevel === index ? 'bg-white text-black' : 'bg-white/[0.045] text-white/45 active:bg-white/[0.08]'}`}>{label}</button>
            ))}
          </div>
          {discomfortLevel > 0 ? <input value={discomfortArea} onChange={(event) => setDiscomfortArea(event.target.value)} placeholder="Zone concernée (facultatif)" className="mt-3 h-11 w-full rounded-xl bg-[#0d0d0d] px-3 text-[12px] text-white outline-none placeholder:text-white/25 focus:ring-2 focus:ring-white/10" /> : null}
        </div>

        <div className="mt-7 flex gap-3">
          {onClose ? <button type="button" onClick={onClose} disabled={saving} className="h-12 flex-1 rounded-xl bg-white/[0.05] text-[12px] font-semibold text-white/55 disabled:opacity-30">{closeLabel}</button> : null}
          <button type="button" onClick={() => void submit()} disabled={saving || score === null} className="h-12 flex-1 rounded-xl bg-white text-[12px] font-bold text-black transition-transform active:scale-[0.98] disabled:opacity-50">{saving ? '…' : isPre ? 'Commencer' : 'Terminer'}</button>
        </div>
      </motion.section>
    </>,
    document.body,
  )
}
