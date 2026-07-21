'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Clock, MessageSquare, Play, Trash2 } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import useBodyScrollLock from '@/components/client/useBodyScrollLock'

interface ExerciseContextMenuProps {
  open: boolean
  hasTempo: boolean
  onSwap: () => void
  onRest: () => void
  onNote: () => void
  onComment: () => void
  onTempo: () => void
  onDelete: () => void
  onClose: () => void
}

export default function ExerciseContextMenu({
  open, hasTempo, onSwap, onRest, onNote, onComment, onTempo, onDelete, onClose,
}: ExerciseContextMenuProps) {
  const { t } = useClientT()
  useBodyScrollLock(open)

  function item(icon: React.ReactNode, label: string, action: () => void, danger = false) {
    return (
      <button
        onClick={() => { action(); onClose() }}
        className={`w-full flex items-center gap-4 px-6 py-4 active:bg-white/[0.04] transition-colors ${danger ? 'text-red-400' : 'text-white'}`}
      >
        <span className="w-5 flex items-center justify-center opacity-70">{icon}</span>
        <span className="text-[15px] font-medium">{label}</span>
      </button>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[65] bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="client-native-bottom-sheet fixed bottom-0 left-0 right-0 z-[70] bg-[#111111] rounded-t-2xl max-h-[88dvh] overflow-y-auto"
            style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }}
            exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
          >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />
            <div className="pt-4 divide-y divide-white/[0.05]">
              {item(<RefreshCw size={16} />, t('ui.change.exercise'), onSwap)}
              {item(<Clock size={16} />, 'Temps de repos', onRest)}
              {item(<MessageSquare size={16} />, 'Ma note personnelle', onNote)}
              {item(<MessageSquare size={16} />, 'Commentaire au coach', onComment)}
              {hasTempo && item(<Play size={16} />, 'Tempo guide', onTempo)}
              <div className="pt-1">
                {item(<Trash2 size={16} />, t('ui.delete.exercise'), onDelete, true)}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
