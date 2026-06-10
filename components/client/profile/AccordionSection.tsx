'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface Props {
  id: string
  title: string
  icon: string
  badge?: number
  isOpen: boolean
  onToggle: (id: string) => void
  children: React.ReactNode
}

export default function AccordionSection({ id, title, icon, badge, isOpen, onToggle, children }: Props) {
  return (
    <div className="bg-[#161616] rounded-2xl overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/[0.03] transition-colors"
      >
        <span className="text-[15px] shrink-0">{icon}</span>
        <span className="flex-1 text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/70">
          {title}
        </span>
        {badge != null && badge > 0 && (
          <span className="w-5 h-5 rounded-full bg-[#f2f2f2] text-[#080808] text-[10px] font-bold flex items-center justify-center shrink-0">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="shrink-0"
        >
          <ChevronDown size={16} className="text-white/30" />
        </motion.div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4">
              <div className="border-t border-white/[0.06] pt-4">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
