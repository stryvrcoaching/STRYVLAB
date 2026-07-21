'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle } from 'lucide-react'
import { useClientT } from './ClientI18nProvider'
import useBodyScrollLock from './useBodyScrollLock'
import PointsEarnedOverlay from './PointsEarnedOverlay'
import CheckinSavingOverlay from './checkin/CheckinSavingOverlay'
import { formatCheckinStepValue, getCheckinUiSteps, getDefaultCheckinStepValue, type CheckinUiStep } from '@/lib/client/checkin/presentation'
import { emitClientInboxUpdated } from '@/lib/client/inboxEvents'

interface Props {
  moment: 'morning' | 'evening'
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  date?: string
}

export default function CheckinModal({ moment, open, onClose, onSuccess, date }: Props) {
  const { t, lang } = useClientT()
  const uiCopy = {
    section: t('checkin.modal.section'),
    response: t('checkin.modal.response'),
    skip: t('checkin.modal.skip'),
    inputHint: t('checkin.modal.inputHint'),
  }
  useBodyScrollLock(open)
  const [loading, setLoading] = useState(true)
  const [configId, setConfigId] = useState('')
  const [steps, setSteps] = useState<CheckinUiStep[]>([])
  const [values, setValues] = useState<Record<string, number>>({})
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setStep(0)
    setDone(false)
    setPoints(null)
    setError(null)
    setSteps([])
    setValues({})

    const fetchUrl = date
      ? `/api/client/checkin/today?date=${encodeURIComponent(date)}`
      : '/api/client/checkin/today'

    fetch(fetchUrl)
      .then((r) => r.json())
      .then((data) => {
        const current = (data?.moments ?? []).find((m: any) => m.moment === moment)
        setConfigId(data?.config_id ?? '')
        const activeFields: string[] = current?.fields ?? []
        const nextSteps = getCheckinUiSteps(moment, activeFields, lang)
        setSteps(nextSteps)
        const defaults: Record<string, number> = {}
        for (const nextStep of nextSteps) {
          const defaultValue = getDefaultCheckinStepValue(nextStep)
          if (typeof defaultValue === 'number') {
            defaults[nextStep.key] = defaultValue
          }
        }
        setValues(defaults)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [open, moment, lang, date])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const currentStep = steps[step] ?? null
  const isLast = step >= steps.length - 1
  const currentValue = currentStep ? values[currentStep.key] : undefined
  const canContinue = Boolean(currentStep) && (typeof currentValue === 'number' || currentStep?.optional)
  const pct = currentStep && typeof currentValue === 'number' && typeof currentStep.min === 'number' && typeof currentStep.max === 'number'
    ? (((currentValue - currentStep.min) / (currentStep.max - currentStep.min)) * 100)
    : 0

  function setNumericValue(stepKey: string, rawValue: string) {
    const trimmed = rawValue.replace(',', '.').trim()
    setValues((prev) => {
      const next = { ...prev }
      if (!trimmed.length) {
        delete next[stepKey]
        return next
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) return next
      next[stepKey] = stepKey === 'daily_steps' ? Math.max(0, Math.round(parsed)) : parsed
      return next
    })
  }

  function advanceAfterChoice(nextValue: number) {
    if (!currentStep) return

    setValues((prev) => ({ ...prev, [currentStep.key]: nextValue }))

    window.setTimeout(() => {
      if (isLast) {
        void submit()
        return
      }
      setStep((current) => Math.min(steps.length - 1, current + 1))
    }, 120)
  }

  async function submit() {
    if (!configId || !steps.length) return
    setSubmitting(true)
    setError(null)
    try {
      const responses = Object.fromEntries(
        Object.entries(values).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)),
      )
      const res = await fetch('/api/client/checkin/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: configId,
          moment,
          responses,
          ...(date ? { date } : {}),
        }),
      })
      if (res.status === 409) {
        setPoints(0)
        setDone(true)
        emitClientInboxUpdated()
        onSuccess?.()
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? t('checkin.modal.error.submit'))
        return
      }
      const data = await res.json().catch(() => null)
      setPoints(data?.points_awarded ?? (data?.is_late ? 5 : 10))
      setDone(true)
      emitClientInboxUpdated()
      onSuccess?.()
    } catch {
      setError(t('checkin.modal.error.network'))
    } finally {
      setSubmitting(false)
    }
  }

  const momentLabel = t(moment === 'morning' ? 'checkin.label.matin' : 'checkin.label.soir')

  if (!mounted) return null

  return createPortal((
    <>
      <PointsEarnedOverlay open={open && done && points !== null} points={points ?? 0} onDone={onClose} />
      <AnimatePresence>
      {open && !done && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={submitting ? undefined : onClose}
          />

          <motion.div
            className="client-native-bottom-sheet fixed bottom-0 left-0 right-0 z-[70] flex flex-col overflow-hidden rounded-t-[28px] shadow-2xl"
            style={{ background: '#0d0d0d', maxHeight: '88dvh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/[0.10]" />

            <div className="flex shrink-0 items-center justify-between px-5 pb-4 pt-5">
              <div>
                <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
                  {momentLabel}
                </p>
                <p className="mt-1 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/32">
                  {uiCopy.section}
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08] disabled:opacity-30"
                aria-label={t('ui.close')}
              >
                <X size={15} />
              </button>
            </div>

            {!loading && !done && steps.length > 1 && (
              <div className="flex items-center gap-1.5 px-5 pb-4">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className="h-[3px] rounded-full transition-all duration-300"
                    style={{
                      background: i <= step ? '#f2f2f2' : 'rgba(255,255,255,0.12)',
                      flex: i === step ? 2 : 1,
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
                {loading ? (
                  <div className="py-8 text-center text-[13px] text-white/40">{t('checkin.modal.loading')}</div>
                ) : !steps.length ? (
                  <div className="py-8 text-center">
                    <p className="text-[13px] text-white/50">{t('checkin.modal.empty')}</p>
                  </div>
                ) : done ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3 py-8"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f2f2f2]">
                      <CheckCircle size={28} className="text-[#080808]" />
                    </div>
                    <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.1em] text-white">
                      {t('checkin.modal.success')}
                    </p>
                    {points ? (
                      <p className="font-mono text-[28px] font-black text-[#f2f2f2]">
                        +{points} pts
                      </p>
                    ) : null}
                  </motion.div>
                ) : currentStep ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep.key}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="space-y-6"
                    >
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[32px] leading-none">{currentStep.emoji}</span>
                          <p className="text-[18px] font-bold leading-snug text-white">{currentStep.question}</p>
                        </div>
                        {currentStep.helperText ? (
                          <p className="text-[12px] leading-relaxed text-white/50">{currentStep.helperText}</p>
                        ) : null}
                      </div>

                      {typeof currentValue === 'number' ? (
                        <div className="rounded-2xl bg-white/[0.035] px-4 py-3">
                          <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/32">{uiCopy.response}</p>
                          <p className="mt-1 text-[28px] font-black text-white">
                            {formatCheckinStepValue(currentStep, currentValue, lang)}
                          </p>
                        </div>
                      ) : null}

                      {currentStep.component === 'chips' ? (
                        <div className="grid grid-cols-2 gap-3">
                          {(currentStep.options ?? []).map((option) => {
                            const selected = values[currentStep.key] === option.value
                            return (
                              <button
                                key={option.value}
                                onClick={() => advanceAfterChoice(option.value)}
                                className={`rounded-xl px-4 py-4 text-left transition-colors ${
                                  selected
                                    ? 'bg-white/[0.10] text-white'
                                    : 'bg-white/[0.03] text-white/70 active:bg-white/[0.06]'
                                }`}
                              >
                                <p className="text-[24px] leading-none">{option.emoji ?? currentStep.emoji}</p>
                                <p className="mt-3 text-[13px] font-semibold">{option.label}</p>
                              </button>
                            )
                          })}
                        </div>
                      ) : currentStep.component === 'number' ? (
                        <div>
                          <label className="mb-2 block text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/55">
                            {uiCopy.inputHint}
                          </label>
                          <div className="flex items-end gap-3">
                            <input
                              type="number"
                              inputMode={currentStep.step && currentStep.step < 1 ? 'decimal' : 'numeric'}
                              min={currentStep.min}
                              max={currentStep.max}
                              step={currentStep.step ?? 1}
                              value={typeof currentValue === 'number' ? String(currentValue) : ''}
                              onChange={(e) => setNumericValue(currentStep.key, e.target.value)}
                              placeholder={currentStep.unit === 'kg' ? '79.2' : currentStep.key === 'daily_steps' ? '8432' : '60'}
                              className="h-11 min-w-0 flex-1 rounded-xl bg-[#080808] px-3 text-[18px] font-bold text-white outline-none placeholder:text-white/20"
                            />
                            {currentStep.unit ? (
                              <span className="pb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-white/45">
                                {currentStep.unit}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="range"
                            min={currentStep.min}
                            max={currentStep.max}
                            step={currentStep.step}
                            value={currentValue ?? currentStep.min}
                            onChange={(e) => setValues((prev) => ({ ...prev, [currentStep.key]: parseFloat(e.target.value) }))}
                            className="slider-client h-2 w-full cursor-pointer appearance-none rounded-full"
                            style={{
                              background: `linear-gradient(to right, #f2f2f2 0%, #f2f2f2 ${pct}%, rgba(255,255,255,0.10) ${pct}%, rgba(255,255,255,0.10) 100%)`,
                            }}
                          />
                          <div className="flex justify-between">
                            <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.1em] text-white/30">
                              {currentStep.lowLabel ?? t('common.low' as any)}
                            </span>
                            <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.1em] text-white/30">
                              {currentStep.highLabel ?? t('common.high' as any)}
                            </span>
                          </div>
                        </div>
                      )}

                      {error ? (
                        <p className="py-1 text-center text-[12px] text-red-400">{error}</p>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                ) : null}
              </div>

              {!loading && !done && currentStep ? (
                <div
                  className="shrink-0 border-t border-white/[0.06] bg-[#121212] px-5 pt-3"
                  style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
                >
                  <div className="flex gap-2">
                    {step > 0 ? (
                      <button
                        onClick={() => setStep((s) => Math.max(0, s - 1))}
                        className="h-11 rounded-xl bg-white/[0.06] px-5 text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/55 transition-all active:scale-[0.98] active:bg-white/[0.08]"
                      >
                        {t('checkin.modal.action.back')}
                      </button>
                    ) : null}
                    {currentStep.optional ? (
                      <button
                        onClick={() => {
                          setValues((prev) => {
                            const next = { ...prev }
                            delete next[currentStep.key]
                            return next
                          })
                          if (isLast) submit()
                          else setStep((s) => Math.min(steps.length - 1, s + 1))
                        }}
                        className="h-11 rounded-xl bg-white/[0.06] px-5 text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/55 transition-all active:scale-[0.98]"
                      >
                        {uiCopy.skip}
                      </button>
                    ) : null}
                    {isLast ? (
                      <button
                        onClick={submit}
                        disabled={submitting || !canContinue}
                        className="h-11 flex-1 rounded-xl font-barlow-condensed text-[12px] font-black uppercase tracking-[0.14em] transition-all active:scale-[0.98] disabled:opacity-50"
                        style={{ background: '#f2f2f2', color: '#080808' }}
                      >
                        {submitting ? t('common.sending') : t('checkin.modal.action.submit')}
                      </button>
                    ) : (
                      <button
                        onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                        disabled={!canContinue}
                        className="h-11 flex-1 rounded-xl font-barlow-condensed text-[12px] font-black uppercase tracking-[0.14em] transition-all active:scale-[0.98] disabled:opacity-50"
                        style={{ background: '#f2f2f2', color: '#080808' }}
                      >
                        {t('checkin.modal.action.next')}
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <CheckinSavingOverlay open={submitting} />
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </>
  ), document.body)
}
