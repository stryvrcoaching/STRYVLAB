'use client'

import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface InfoModalProps {
  isOpen: boolean
  title: string
  description: string
  example: string
  whenToUse: string
  onClose: () => void
}

export default function InfoModal({
  isOpen,
  title,
  description,
  example,
  whenToUse,
  onClose,
}: InfoModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="modal-backdrop"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-[#181818] rounded-2xl p-6 max-w-md w-full border border-white/[0.06] pointer-events-auto">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-[15px] font-bold text-white pr-4">{title}</h3>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/60 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-3">
                {/* Description */}
                <div>
                  <p className="text-[12px] text-white/60 leading-relaxed">{description}</p>
                </div>

                {/* Example */}
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.06]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 mb-1.5">
                    Exemple
                  </p>
                  <p className="text-[12px] text-white/55 leading-relaxed font-mono">{example}</p>
                </div>

                {/* When to use */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 mb-1.5">
                    Quand utiliser
                  </p>
                  <p className="text-[12px] text-white/55 leading-relaxed">{whenToUse}</p>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="w-full mt-4 h-10 rounded-lg bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.08em] hover:bg-[#217356] active:scale-[0.98] transition-all"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
