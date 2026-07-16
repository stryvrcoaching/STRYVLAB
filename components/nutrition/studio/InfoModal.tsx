'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface InfoModalProps {
  isOpen: boolean
  title: string
  description: string
  example: string
  whenToUse: string
  tabs?: Array<{
    id: string
    label: string
    content: string
  }>
  onClose: () => void
  docLink?: string
}

export default function InfoModal({
  isOpen,
  title,
  description,
  example,
  whenToUse,
  tabs,
  onClose,
  docLink,
}: InfoModalProps) {
  const [activeTabId, setActiveTabId] = useState<string | null>(tabs?.[0]?.id ?? null)

  useEffect(() => {
    setActiveTabId(tabs?.[0]?.id ?? null)
  }, [tabs, isOpen])

  const activeTab = tabs?.find((tab) => tab.id === activeTabId) ?? tabs?.[0] ?? null

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
            <div className="bg-[#181818] rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-white/[0.06] pointer-events-auto">
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
                {tabs && tabs.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {tabs.map((tab) => {
                        const isActive = tab.id === activeTab?.id
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                                isActive
                                  ? 'bg-[#1f8a65] text-white'
                                  : 'bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/75'
                             }`}
                          >
                            {tab.label}
                          </button>
                        )
                      })}
                    </div>

                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-[12px] text-white/60 leading-relaxed whitespace-pre-line">
                        {activeTab?.content}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                {/* Description */}
                <div>
                  <p className="text-[12px] text-white/60 leading-relaxed whitespace-pre-line">{description}</p>
                </div>

                {/* Example */}
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.06]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 mb-1.5">
                    Exemple
                  </p>
                  <p className="text-[12px] text-white/55 leading-relaxed whitespace-pre-line">{example}</p>
                </div>

                {/* When to use */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 mb-1.5">
                    Quand utiliser
                  </p>
                  <p className="text-[12px] text-white/55 leading-relaxed whitespace-pre-line">{whenToUse}</p>
                </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-4">
                {docLink && (
                  <a
                    href={docLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-10 rounded-lg border border-white/[0.08] bg-white/[0.02] text-white/80 hover:text-white hover:bg-white/[0.06] text-[11px] font-bold uppercase tracking-[0.08em] flex items-center justify-center transition-all"
                  >
                    Documentation complète
                  </a>
                )}
                <button
                  onClick={onClose}
                  className={`${docLink ? 'flex-1' : 'w-full'} h-10 rounded-lg bg-[#1f8a65] text-white text-[11px] font-bold uppercase tracking-[0.08em] hover:bg-[#217356] active:scale-[0.98] transition-all`}
                >
                  Fermer
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
