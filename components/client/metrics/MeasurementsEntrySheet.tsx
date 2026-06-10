'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Info } from 'lucide-react'
import { useClientT } from '../ClientI18nProvider'

interface Field {
  key: string
  iKey: string
  gKey?: string
  unit: string
}

const FIELDS_CONFIG: Field[] = [
  { key: 'weight_kg', iKey: 'meas.weight', unit: 'kg' },
  { key: 'neck_cm', iKey: 'meas.neck', gKey: 'meas.guide.neck', unit: 'cm' },
  { key: 'shoulder_circumference_cm', iKey: 'meas.shoulders', gKey: 'meas.guide.shoulders', unit: 'cm' },
  { key: 'chest_cm', iKey: 'meas.chest', gKey: 'meas.guide.chest', unit: 'cm' },
  { key: 'waist_cm', iKey: 'meas.waist', gKey: 'meas.guide.waist', unit: 'cm' },
  { key: 'hips_cm', iKey: 'meas.hips', gKey: 'meas.guide.hips', unit: 'cm' },
  { key: 'glute_cm', iKey: 'meas.glutes', gKey: 'meas.guide.glutes', unit: 'cm' },
  { key: 'arm_left_cm', iKey: 'meas.armLeft', gKey: 'meas.guide.armLeft', unit: 'cm' },
  { key: 'arm_right_cm', iKey: 'meas.armRight', gKey: 'meas.guide.armRight', unit: 'cm' },
  { key: 'forearm_left_cm', iKey: 'meas.forearmLeft', gKey: 'meas.guide.forearmLeft', unit: 'cm' },
  { key: 'forearm_right_cm', iKey: 'meas.forearmRight', gKey: 'meas.guide.forearmRight', unit: 'cm' },
  { key: 'thigh_left_cm', iKey: 'meas.thighLeft', gKey: 'meas.guide.thighLeft', unit: 'cm' },
  { key: 'thigh_right_cm', iKey: 'meas.thighRight', gKey: 'meas.guide.thighRight', unit: 'cm' },
  { key: 'calf_left_cm', iKey: 'meas.calfLeft', gKey: 'meas.guide.calfLeft', unit: 'cm' },
  { key: 'calf_right_cm', iKey: 'meas.calfRight', gKey: 'meas.guide.calfRight', unit: 'cm' },
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: () => Promise<void> | void
}

export default function MeasurementsEntrySheet({ open, onClose, onSaved }: Props) {
  const { t, ta } = useClientT()
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [openGuides, setOpenGuides] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildFields = () => FIELDS_CONFIG.map(cfg => ({
    ...cfg,
    label: t(cfg.iKey as any),
    guide: cfg.gKey ? ta(cfg.gKey as any) : undefined,
  }))

  function setVal(key: string, val: string) {
    setInputs(prev => ({ ...prev, [key]: val }))
  }

  function toggleGuide(key: string) {
    setOpenGuides(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleSave() {
    const fields = buildFields()
    const values: Record<string, number> = {}
    for (const f of fields) {
      const v = Number(inputs[f.key] ?? '')
      if (Number.isFinite(v) && v > 0) values[f.key] = v
    }
    if (Object.keys(values).length === 0) {
      setError(t('meas.error.empty'))
      return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/client/body-data/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submittedAt: new Date().toISOString(), values }),
      })
      if (!res.ok) throw new Error('save failed')
      setInputs({})
      setOpenGuides(new Set())
      await onSaved?.()
      onClose()
    } catch {
      setError(t('meas.error.save'))
    } finally {
      setSaving(false)
    }
  }

  const fields = buildFields()
  const filledCount = fields.filter(f => {
    const v = Number(inputs[f.key] ?? '')
    return Number.isFinite(v) && v > 0
  }).length

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
            style={{ background: '#111111', maxHeight: '88vh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
            exit={{ y: '100%', transition: { duration: 0.2, ease: 'easeIn' } }}
          >
            {/* Drag handle */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.10]" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
              <div>
                <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">
                  MÉTRIQUES
                </p>
                <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.08em] text-white">
                  Mensurations
                </p>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.10] transition-colors"
                aria-label={t('ui.close')}
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable field list */}
            <div className="flex-1 overflow-y-auto px-5 space-y-1.5 pb-4">
              {fields.map((f, i) => {
                const filled = Number.isFinite(Number(inputs[f.key])) && Number(inputs[f.key]) > 0
                const guideOpen = openGuides.has(f.key)
                const hasGuide = f.guide && f.guide.length > 0

                return (
                  <div key={f.key}>
                    {i === 0 && (
                      <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 mb-2 mt-1">
                        {t('meas.section.weight')}
                      </p>
                    )}
                    {i === 1 && (
                      <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 mb-2 mt-3">
                        {t('meas.section.measurements')}
                      </p>
                    )}

                    {/* Field row */}
                    <div
                      className={`flex items-center gap-3 h-11 px-4 rounded-xl transition-colors ${
                        filled ? 'bg-white/[0.08]' : 'bg-white/[0.04]'
                      } ${guideOpen ? 'rounded-b-none' : ''}`}
                    >
                      <span className="text-[13px] font-barlow text-white/70 flex-1 min-w-0 truncate">
                        {f.label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          value={inputs[f.key] ?? ''}
                          onChange={e => setVal(f.key, e.target.value)}
                          inputMode="decimal"
                          placeholder="—"
                          className="w-16 text-right text-[14px] font-barlow font-semibold text-white bg-transparent outline-none placeholder:text-white/20"
                        />
                        <span className="text-[11px] font-barlow-condensed text-white/30 w-5">
                          {f.unit}
                        </span>
                      </div>
                      {hasGuide && (
                        <button
                          onClick={() => toggleGuide(f.key)}
                          className={`shrink-0 transition-colors ${
                            guideOpen ? 'text-white/60' : 'text-white/20 active:text-white/50'
                          }`}
                          aria-label={`Guide ${f.label}`}
                        >
                          <Info size={14} />
                        </button>
                      )}
                    </div>

                    {/* Inline guide panel */}
                    <AnimatePresence initial={false}>
                      {guideOpen && hasGuide && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1, transition: { duration: 0.18 } }}
                          exit={{ height: 0, opacity: 0, transition: { duration: 0.14 } }}
                          className="overflow-hidden"
                        >
                          <div className="bg-white/[0.03] rounded-b-xl px-4 py-3 space-y-1.5 border-t border-white/[0.04]">
                            {f.guide!.map((line, li) => (
                              <div key={li} className="flex items-start gap-2">
                                <span className="text-white/30 text-[11px] mt-0.5 shrink-0">•</span>
                                <p className="text-[11px] font-barlow text-white/50 leading-relaxed">
                                  {line}
                                </p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 pb-8 pt-3 border-t border-white/[0.05]">
              {error && (
                <p className="text-[11px] text-white/50 text-center mb-2">{error}</p>
              )}
              <button
                onClick={handleSave}
                disabled={saving || filledCount === 0}
                className="w-full h-12 rounded-xl font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[13px] transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: '#f2f2f2', color: '#080808' }}
              >
                {saving
                  ? 'Enregistrement…'
                  : filledCount > 0
                    ? `Enregistrer${filledCount > 1 ? ` (${filledCount})` : ''}`
                    : 'Enregistrer'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
