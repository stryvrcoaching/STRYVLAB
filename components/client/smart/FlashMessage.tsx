'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

export type FlashType = 'error' | 'success' | 'info'

export interface FlashState {
  message: string
  type: FlashType
  id: number
}

const TYPE_STYLES: Record<FlashType, { bg: string; border: string; icon: string; text: string }> = {
  error:   { bg: 'bg-red-500/12',      border: 'border-red-500/20',      icon: 'text-red-400',      text: 'text-red-300' },
  success: { bg: 'bg-[#1f8a65]/12',    border: 'border-[#1f8a65]/25',    icon: 'text-[#5dba87]',    text: 'text-[#5dba87]' },
  info:    { bg: 'bg-[#818cf8]/12',    border: 'border-[#818cf8]/20',    icon: 'text-[#818cf8]',    text: 'text-white/80' },
}

export function FlashMessage({ flash, onDismiss }: { flash: FlashState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(onDismiss, 3500)
    return () => clearTimeout(timer)
  }, [flash, onDismiss])

  const styles = flash ? TYPE_STYLES[flash.type] : TYPE_STYLES.info

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash.id}
          initial={{ opacity: 0, y: -10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`fixed top-[76px] left-3 right-3 z-[80] rounded-2xl px-4 py-3 flex items-center gap-3 border ${styles.bg} ${styles.border}`}
        >
          {flash.type === 'error' && <AlertCircle size={15} className={`${styles.icon} shrink-0`} />}
          {flash.type === 'success' && <CheckCircle2 size={15} className={`${styles.icon} shrink-0`} />}
          {flash.type === 'info' && <div className={`h-2 w-2 rounded-full ${styles.icon.replace('text-', 'bg-')} shrink-0`} />}
          <p className={`text-[12px] font-semibold flex-1 leading-snug ${styles.text}`}>{flash.message}</p>
          <button onClick={onDismiss} className="text-white/25 active:scale-90 transition-all shrink-0">
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function useFlash() {
  const [flash, setFlash] = useState<FlashState | null>(null)
  const idRef = useRef(0)

  const showFlash = useCallback((message: string, type: FlashType = 'error') => {
    idRef.current += 1
    setFlash({ message, type, id: idRef.current })
  }, [])

  const dismiss = useCallback(() => setFlash(null), [])

  return { flash, showFlash, dismiss }
}
