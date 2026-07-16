'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Timer, Vibrate, VibrateOff } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'

interface PrepTimeModalProps {
  exerciseName: string
  onConfirm: (seconds: number, hapticsEnabled: boolean) => void
  onClose: () => void
}

const HAPTICS_KEY = 'tempo_haptics_enabled'

export function getHapticsEnabled(): boolean {
  // iOS ne supporte pas navigator.vibrate — retourne false immédiatement
  if (typeof navigator !== 'undefined' &&
      (/iP(hone|od|ad)/.test(navigator.userAgent) ||
       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))) {
    return false
  }
  try {
    const stored = localStorage.getItem(HAPTICS_KEY)
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

function saveHapticsEnabled(enabled: boolean) {
  try { localStorage.setItem(HAPTICS_KEY, String(enabled)) } catch { /* noop */ }
}

const PREP_KEY = (name: string) =>
  `prep_time_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`

export function getPrepTime(exerciseName: string): number {
  try {
    const stored = localStorage.getItem(PREP_KEY(exerciseName))
    if (stored) {
      const n = parseInt(stored, 10)
      if (!isNaN(n) && n >= 3 && n <= 30) return n
    }
  } catch { /* localStorage unavailable */ }
  return 5 // default
}

export function hasPrepTimeConfigured(exerciseName: string): boolean {
  try {
    return localStorage.getItem(PREP_KEY(exerciseName)) !== null
  } catch {
    return false
  }
}

function savePrepTime(exerciseName: string, seconds: number) {
  try {
    localStorage.setItem(PREP_KEY(exerciseName), String(seconds))
  } catch { /* noop */ }
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function PrepTimeModal({ exerciseName, onConfirm, onClose }: PrepTimeModalProps) {
  const { t } = useClientT()
  const [seconds, setSeconds]   = useState<number>(() => getPrepTime(exerciseName))
  const [haptics, setHaptics]   = useState<boolean>(() => getHapticsEnabled())
  const [isLandscape, setIsLandscape] = useState(false)
  const iosDevice = typeof window !== 'undefined' ? isIOS() : false

  useEffect(() => {
    const syncOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight)
    syncOrientation()
    window.addEventListener('resize', syncOrientation)
    return () => window.removeEventListener('resize', syncOrientation)
  }, [])

  const dec = () => setSeconds(s => Math.max(3, s - 1))
  const inc = () => setSeconds(s => Math.min(30, s + 1))

  const toggleHaptics = () => {
    const next = !haptics
    setHaptics(next)
    saveHapticsEnabled(next)
  }

  const handleConfirm = () => {
    savePrepTime(exerciseName, seconds)
    onConfirm(seconds, haptics)
  }

  return (
    <AnimatePresence>
      <motion.div
        key="prep-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-[65] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          key="prep-card"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`w-full bg-[#111111] rounded-2xl overflow-y-auto ${isLandscape ? 'max-w-2xl max-h-[calc(100dvh-24px)] p-5' : 'max-w-xs max-h-[calc(100dvh-32px)] p-6'}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                <Timer size={15} className="text-white/50" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
                  {t('common.preparation')}
                </p>
                <p className="text-[13px] font-bold text-white leading-tight">
                  {t('prep.modal.title')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-white/30 hover:text-white/60 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Explanation */}
          <p className="text-[11px] text-white/45 leading-relaxed mb-5">
            {t('prep.modal.question', { exercise: exerciseName })}{' '}
            {t('prep.modal.desc')}
          </p>

          {/* How to calculate tip */}
          <div className="bg-[#111111] rounded-xl px-3 py-2.5 mb-5">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/25 mb-1">
              {t('prep.modal.estimate')}
            </p>
            <p className="text-[10px] text-white/35 leading-relaxed">
              {t('prep.modal.estimate.desc')}
            </p>
          </div>

          {/* Spinner */}
          <div className="flex items-center justify-center gap-5 mb-6">
            <button
              onClick={dec}
              disabled={seconds <= 3}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] text-white/60 text-xl font-bold hover:bg-white/[0.08] hover:text-white disabled:opacity-25 active:scale-95 transition-all"
            >
              −
            </button>
            <div className="text-center min-w-[72px]">
              <span
                className="font-mono font-black tabular-nums leading-none text-white"
                style={{ fontSize: 48 }}
              >
                {seconds}
              </span>
              <p className="text-[10px] text-white/30 font-medium mt-0.5">{t('common.seconds')}</p>
            </div>
            <button
              onClick={inc}
              disabled={seconds >= 30}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] text-white/60 text-xl font-bold hover:bg-white/[0.08] hover:text-white disabled:opacity-25 active:scale-95 transition-all"
            >
              +
            </button>
          </div>

          {/* Haptics toggle — masqué sur iOS (API non supportée) */}
          {iosDevice ? (
            <div className="w-full flex items-center gap-2.5 px-4 h-11 rounded-xl mb-4 bg-[#111111]">
              <VibrateOff size={14} className="text-white/20 shrink-0" />
              <span className="text-[11px] text-white/25">
                {t('prep.modal.hapticsUnavailable')}
              </span>
            </div>
          ) : (
            <button
              onClick={toggleHaptics}
              className={`w-full flex items-center justify-between px-4 h-11 rounded-xl mb-4 transition-all active:scale-[0.98] ${
                haptics ? 'bg-white/[0.08]' : 'bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {haptics
                  ? <Vibrate size={14} className="text-white/60" />
                  : <VibrateOff size={14} className="text-white/25" />
                }
                <span className={`text-[11px] font-semibold ${haptics ? 'text-white/80' : 'text-white/30'}`}>
                  {t('prep.modal.haptics')}
                </span>
              </div>
              <div className={`w-8 h-4 rounded-full relative transition-colors ${haptics ? 'bg-white/[0.30]' : 'bg-white/[0.10]'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${haptics ? 'left-4' : 'left-0.5'}`} />
              </div>
            </button>
          )}

          {/* Confirm */}
          <button
            onClick={handleConfirm}
            className="w-full h-12 rounded-xl font-bold text-[13px] uppercase tracking-[0.10em] transition-all active:scale-[0.98] bg-white text-[#0d0d0d]"
          >
            {t('common.start')}
          </button>

          <p className="text-center text-[9px] text-white/20 mt-3">
            {t('prep.modal.saved')}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
