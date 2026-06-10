'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { CyclePhase } from '@/lib/cycle/cycleEngine'
import { PHASE_CONTENT, type CycleContext } from '@/lib/client/cycle/phaseContent'

const PHASE_COLORS: Record<CyclePhase, string> = {
  follicular: '#22c55e',
  ovulatory:  '#fbbf24',
  luteal:     '#a855f7',
  menstrual:  '#ef4444',
}

interface Props {
  open: boolean
  phase: CyclePhase
  cycleDay: number
  avgCycleLength?: number
  context: CycleContext
  onClose: () => void
}

export default function CyclePhaseModal({
  open,
  phase,
  cycleDay,
  avgCycleLength = 28,
  context,
  onClose,
}: Props) {
  const content = PHASE_CONTENT[phase][context]
  const color = PHASE_COLORS[phase]

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-[79]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[80] bg-[#161616] rounded-t-2xl px-5 pt-4 pb-8 space-y-4"
            style={{ maxHeight: '88vh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="w-8 h-1 rounded-full bg-white/10 mx-auto" />

            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <p
                  className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px]"
                  style={{ color }}
                >
                  {content.subtitle}
                </p>
                <p className="text-[20px] font-bold text-white leading-tight">{content.title}</p>
                <p className="text-[11px] text-white/40">J{cycleDay} sur {avgCycleLength}</p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0"
              >
                <X size={13} className="text-white/50" />
              </button>
            </div>

            <div
              className="rounded-xl px-3 py-2 border-[0.3px]"
              style={{
                background: `${color}10`,
                borderColor: `${color}30`,
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 mb-0.5">
                Impact {context === 'nutrition' ? 'nutritionnel' : 'entraînement'}
              </p>
              <p className="text-[11px] font-medium" style={{ color }}>{content.impact}</p>
            </div>

            <div className="space-y-3">
              {content.bullets.map((bullet, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                    style={{ background: color }}
                  />
                  <p className="text-[13px] text-white/70 leading-relaxed">{bullet}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
