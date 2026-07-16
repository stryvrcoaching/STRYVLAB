'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useClientT } from '../ClientI18nProvider'
import type { CycleState } from '@/lib/cycle/cycleEngine'
import useBodyScrollLock from '@/components/client/useBodyScrollLock'

interface Props {
  open: boolean
  cycleState: CycleState | null
  onClose: () => void
  onUpdated: (newState: CycleState) => void
}

type Mode = 'main' | 'pick-start-date' | 'pick-end-date' | 'confirm-conflict'

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export default function LogPeriodSheet({ open, cycleState, onClose, onUpdated }: Props) {
  const { t } = useClientT()
  useBodyScrollLock(open)

  const [mode, setMode] = useState<Mode>('main')
  const [pickedDate, setPickedDate] = useState('')
  const [conflictDate, setConflictDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const hasOpenPeriod =
    cycleState?.lastPeriodDate !== null &&
    cycleState?.lastPeriodEndDate === null

  async function logStart(date: string, _force = false) {
    setLoading(true)
    try {
      const res = await fetch('/api/client/cycle/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'start', date, force: _force }),
      })
      if (res.status === 409) {
        const data = await res.json()
        setConflictDate(data.existingDate)
        setPickedDate(date)
        setMode('confirm-conflict')
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      onUpdated(data.cycleState)
      const phaseName = data.cycleState.currentPhase ?? ''
      setSuccessMsg(t('cycle.success.start', { phase: phaseName }))
      setTimeout(() => { setSuccessMsg(null); onClose() }, 2000)
    } catch {
      setLoading(false)
    } finally {
      setLoading(false)
      if (mode !== 'confirm-conflict') setMode('main')
    }
  }

  async function logEnd(date: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/client/cycle/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'end', date }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      onUpdated(data.cycleState)
      setSuccessMsg(t('cycle.success.end'))
      setTimeout(() => { setSuccessMsg(null); onClose() }, 2000)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setMode('main')
    setPickedDate('')
    setConflictDate('')
    setSuccessMsg(null)
    onClose()
  }

  const today = new Date().toISOString().slice(0, 10)
  const earliestEndDate = cycleState?.lastPeriodDate
    ? addDays(cycleState.lastPeriodDate, 1)
    : null
  const canLogPeriodEnd = Boolean(
    hasOpenPeriod && earliestEndDate && earliestEndDate <= today,
  )
  const isPickingDate = mode === 'pick-start-date' || mode === 'pick-end-date'
  const isPickingStartDate = mode === 'pick-start-date'
  const shouldConfirmPeriodStart = Boolean(
    cycleState?.isPeriodStartExpected && !hasOpenPeriod,
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            key="sheet"
            className="client-native-bottom-sheet fixed left-0 right-0 bottom-0 z-[90] rounded-t-2xl"
            style={{ background: '#0d0d0d', paddingBottom: 'var(--client-modal-bottom-padding)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between px-5 pt-5 pb-4">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.10]" />
              <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
                {t('cycle.title')}
              </p>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="px-4 pb-4 space-y-3">
              {successMsg ? (
                <div className="py-6 text-center">
                  <p className="text-[14px] font-barlow font-semibold text-[#e0e0e0]">{successMsg}</p>
                </div>
              ) : mode === 'confirm-conflict' ? (
                <div className="space-y-3">
                  <p className="text-[12px] font-barlow text-[#808080] leading-relaxed px-1">
                    {t('cycle.modal.conflict', { date: conflictDate })}
                  </p>
                  <button
                    onClick={() => {
                      setMode('main')
                      logStart(pickedDate || today, true)
                    }}
                    disabled={loading}
                    className="w-full h-[52px] rounded-xl bg-white/[0.10] text-white text-[13px] font-barlow font-bold active:opacity-80 disabled:opacity-50"
                  >
                    {t('cycle.action.confirm_anyway')}
                  </button>
                  <button
                    onClick={() => setMode('main')}
                    className="w-full h-[44px] rounded-xl bg-white/[0.03] text-[#808080] text-[13px] font-barlow active:bg-white/[0.06]"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : isPickingDate ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-barlow text-[#5a5a5a] px-1">
                    {t(isPickingStartDate ? 'cycle.label.start_date' : 'cycle.label.end_date')}
                  </p>
                  <input
                    type="date"
                    value={pickedDate}
                    min={isPickingStartDate ? undefined : earliestEndDate ?? undefined}
                    max={today}
                    onChange={e => setPickedDate(e.target.value)}
                    className="w-full h-[52px] rounded-xl bg-white/[0.06] text-[#e0e0e0] text-[14px] font-barlow px-4 min-w-0 outline-none"
                  />
                  <button
                    onClick={() => pickedDate && (isPickingStartDate ? logStart(pickedDate) : logEnd(pickedDate))}
                    disabled={!pickedDate || loading}
                    className="w-full h-[52px] rounded-xl bg-white/[0.10] text-white text-[13px] font-barlow font-bold active:opacity-80 disabled:opacity-50"
                  >
                    {loading ? t('cycle.modal.loading') : t('common.confirm')}
                  </button>
                  <button
                    onClick={() => setMode('main')}
                    className="w-full h-[44px] rounded-xl bg-white/[0.03] text-[#808080] text-[13px] font-barlow active:bg-white/[0.06]"
                  >
                    {t('cycle.action.retour')}
                  </button>
                </div>
              ) : (
                <>
                  {shouldConfirmPeriodStart && (
                    <p className="rounded-xl bg-white/[0.04] px-4 py-3 text-[12px] font-barlow leading-relaxed text-[#a0a0a0]">
                      {t('cycle.hint.expected_start')}
                    </p>
                  )}
                  {/* Section 1: Début de règles */}
                  <div className="rounded-xl bg-white/[0.04] overflow-hidden">
                    <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[#5a5a5a] px-4 pt-3 pb-1">
                      {t('cycle.section.start')}
                    </p>
                    <div className="p-3 space-y-2">
                      <button
                        onClick={() => logStart(today)}
                        disabled={loading}
                        className="w-full h-[52px] rounded-xl bg-white/[0.10] text-white text-[13px] font-barlow font-bold active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <span className="w-3 h-3 rounded-full bg-white/[0.30] shrink-0" />
                        {t('cycle.action.today')}
                      </button>
                      <button
                        onClick={() => setMode('pick-start-date')}
                        disabled={loading}
                        className="w-full h-[44px] rounded-xl bg-white/[0.03] text-[#808080] text-[12px] font-barlow active:bg-white/[0.06]"
                      >
                        {t('cycle.action.choose_date')}
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Fin de règles — conditional */}
                  {canLogPeriodEnd && (
                    <div className="rounded-xl bg-white/[0.04] overflow-hidden">
                      <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[#5a5a5a] px-4 pt-3 pb-1">
                        {t('cycle.section.end')}
                      </p>
                      <div className="p-3">
                        <button
                          onClick={() => logEnd(today)}
                          disabled={loading}
                          className="w-full h-[44px] rounded-xl bg-white/[0.03] text-[#e0e0e0] text-[13px] font-barlow active:bg-white/[0.06] disabled:opacity-50"
                        >
                          {loading ? t('cycle.modal.loading') : t('cycle.action.end_today')}
                        </button>
                        <button
                          onClick={() => setMode('pick-end-date')}
                          disabled={loading}
                          className="w-full h-[40px] mt-2 rounded-xl bg-white/[0.03] text-[#808080] text-[12px] font-barlow active:bg-white/[0.06] disabled:opacity-50"
                        >
                          {t('cycle.action.choose_date')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
