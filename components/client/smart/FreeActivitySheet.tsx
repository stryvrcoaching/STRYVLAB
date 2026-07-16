'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useClientT } from '../ClientI18nProvider'
import useBodyScrollLock from '@/components/client/useBodyScrollLock'

type ActivityType = 'running' | 'cycling' | 'swimming' | 'walking' | 'team_sport' | 'other'

export type FreeActivitySheetProps = {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

const TYPES: ActivityType[] = ['running', 'cycling', 'swimming', 'walking', 'team_sport', 'other']

const formatDateTime = (iso: string, lang: 'fr' | 'en' | 'es') => {
  const d = new Date(iso)
  const locale = lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'fr-FR'
  const atWord = lang === 'es' ? 'a las' : lang === 'en' ? 'at' : 'à'
  return (
    d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) +
    ` ${atWord} ` +
    d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  )
}

export default function FreeActivitySheet({ open, onClose, onSaved }: FreeActivitySheetProps) {
  const { t, lang } = useClientT()
  useBodyScrollLock(open)

  const [type, setType] = useState<ActivityType>('running')
  const [customLabel, setCustomLabel] = useState('')
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [duration, setDuration] = useState(30)
  const [intensity, setIntensity] = useState(5)
  const [notes, setNotes] = useState('')
  const [steps, setSteps] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        activity_type: type,
        started_at: new Date(startedAt).toISOString(),
        duration_min: duration,
        intensity,
      }
      if (type === 'other' && customLabel.trim()) body.custom_label = customLabel.trim()
      if (notes.trim()) body.notes = notes.trim()
      if ((type === 'walking' || type === 'running') && steps.trim()) {
        body.steps = parseInt(steps, 10)
      }

      const r = await fetch('/api/client/activity-logs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error((j as any).error ?? t('common.error'))
      }
      onSaved?.()
      setSteps('')
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const pct = ((intensity - 1) / 9) * 100

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-[2px]"
            onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <motion.div
            className="client-native-bottom-sheet fixed left-0 right-0 bottom-0 z-[70] rounded-t-2xl flex flex-col"
            style={{ background: '#0d0d0d', maxHeight: '88dvh', paddingBottom: 'var(--client-modal-bottom-padding)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="relative px-5 pt-5 pb-4 shrink-0 flex items-center justify-between">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.10]" />
              <h3 className="font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[15px] text-white">
                {t('activity.logTitle')}
              </h3>
              <button onClick={onClose} className="h-8 w-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/40">
                <X size={15} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-8 space-y-4">
              <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">{t('activity.typeLabel')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map(tt => (
                    <button
                      key={tt}
                      onClick={() => setType(tt)}
                      className={`h-10 rounded-xl text-[11px] font-semibold transition-colors ${
                        type === tt ? 'bg-white/[0.10] text-white' : 'bg-white/[0.03] text-white/40'
                      }`}
                    >
                      {t(`smart.activity.type.${tt}` as any)}
                    </button>
                  ))}
                </div>
              </div>

              {type === 'other' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">{t('activity.specify')}</label>
                  <input
                    value={customLabel}
                    onChange={e => setCustomLabel(e.target.value)}
                    maxLength={80}
                    className="w-full min-w-0 h-11 px-3 rounded-xl bg-[#080808] text-white text-[14px] outline-none"
                    placeholder={t('activity.placeholder.custom')}
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">{t('activity.when')}</label>
                <div className="relative w-full h-11">
                  <div className="w-full h-full flex items-center px-3 rounded-xl bg-[#080808] text-white text-[14px] pointer-events-none select-none">
                    {formatDateTime(startedAt, lang)}
                  </div>
                  <input
                    type="datetime-local"
                    value={startedAt}
                    onChange={e => setStartedAt(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">{t('smart.activity.duration')}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  min={1}
                  max={360}
                  value={duration}
                  onFocus={e => e.target.select()}
                  onChange={e => setDuration(parseInt(e.target.value) || 1)}
                  className="w-full min-w-0 h-11 px-3 rounded-xl bg-[#080808] text-white text-[14px] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">
                  {t('activity.intensityFull', { n: String(intensity) })}
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={intensity}
                  onChange={e => setIntensity(parseInt(e.target.value))}
                  className="w-full h-2 appearance-none rounded-full cursor-pointer slider-client"
                  style={{
                    background: `linear-gradient(to right, #f2f2f2 0%, #f2f2f2 ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
              </div>

              {(type === 'walking' || type === 'running') && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">{t('activity.steps')}</label>
                  <input
                    type="number"
                    min={0}
                    placeholder={t('activity.placeholder.steps')}
                    value={steps}
                    onChange={e => setSteps(e.target.value)}
                    className="w-full min-w-0 h-11 px-3 rounded-xl bg-[#080808] text-white text-[14px] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">{t('activity.notesOpt')}</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full min-w-0 px-3 py-2 rounded-xl bg-[#080808] text-white text-[14px] outline-none resize-none"
                />
              </div>

              {error && <p className="text-[12px] text-red-400">{error}</p>}

              <button
            onClick={submit}
            disabled={saving}
            className="mt-3 h-11 w-full rounded-xl font-barlow-condensed text-[12px] font-black uppercase tracking-[0.14em] active:scale-[0.98] transition-all disabled:opacity-50"
            style={{ background: "#f2f2f2", color: "#080808" }}
          >
            {saving ? t('common.saving') : t('common.add')}
          </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
