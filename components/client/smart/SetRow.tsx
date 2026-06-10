'use client'

import { useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Trash2, X } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { TRAINING_ACCENT } from '@/lib/nutrition/ui-colors'

export type SetType = 'warmup' | 'working' | 'cooldown' | 'dropset'

export interface SetRowData {
  exercise_id: string
  exercise_name: string
  set_number: number
  side: 'left' | 'right' | 'bilateral'
  set_type: SetType
  planned_reps: string
  actual_reps: string
  actual_weight_kg: string
  completed: boolean
  rir_actual: string
  rest_sec: number | null
  rest_sec_actual?: number | null
}

interface SetRowProps {
  set: SetRowData
  workingIndex: number | null
  recReps?: string
  recWeight?: string
  targetRir?: number | null
  recRir?: number | null
  isPR?: boolean
  coachingCue?: string | null
  hasTempoGuide?: boolean
  onValidate: (reps: string, weight: string, rir: string) => void
  onDelete: () => void
  onChange: (patch: Partial<SetRowData>) => void
  onTypePress: () => void
  onTempoPress?: () => void
}

const TYPE_LABELS: Record<SetType, string> = {
  warmup: 'EC',
  working: '',
  cooldown: 'RC',
  dropset: '↘',
}

const TYPE_COLORS: Record<SetType, string> = {
  warmup: 'text-[#b0b0b0]',
  working: 'text-white',
  cooldown: 'text-[#b0b0b0]',
  dropset: 'text-[#b0b0b0]',
}

function formatRestDisplay(sec: number | null): string {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Stepper component ─────────────────────────────────────────────────────────

interface StepperProps {
  label: string
  value: string
  onDecrement: () => void
  onIncrement: () => void
  onChange: (v: string) => void
  inputMode?: 'numeric' | 'decimal'
  unit?: string
}

function Stepper({ label, value, onDecrement, onIncrement, onChange, inputMode = 'numeric', unit }: StepperProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/30">
        {label}
      </p>
      <div className="flex items-center gap-2 w-full">
        <button
          onPointerDown={e => e.preventDefault()}
          onClick={onDecrement}
          className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/[0.06] text-white text-[22px] font-bold active:bg-white/[0.12] active:scale-95 transition-all shrink-0"
        >
          −
        </button>
        <div className="flex-1 flex flex-col items-center">
          <input
            type="text"
            inputMode={inputMode}
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={e => e.target.select()}
            className="w-full bg-white/[0.04] rounded-xl text-[26px] font-black text-white text-center outline-none h-12"
          />
          {unit && <span className="text-[9px] text-white/25 mt-1 uppercase tracking-wide">{unit}</span>}
        </div>
        <button
          onPointerDown={e => e.preventDefault()}
          onClick={onIncrement}
          className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/[0.06] text-white text-[22px] font-bold active:bg-white/[0.12] active:scale-95 transition-all shrink-0"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── Confirmation modal ────────────────────────────────────────────────────────

interface ConfirmModalProps {
  initialReps: string
  initialWeight: string
  initialRir: string
  setNumber: number
  side: 'left' | 'right' | 'bilateral'
  targetRir?: number | null
  restSec: number | null
  onConfirm: (reps: string, weight: string, rir: string) => void
  onClose: () => void
}

function ConfirmModal({
  initialReps,
  initialWeight,
  initialRir,
  setNumber,
  side,
  targetRir,
  restSec,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const { t } = useClientT()
  const [reps, setReps] = useState(initialReps)
  const [weight, setWeight] = useState(initialWeight)
  const [rir, setRir] = useState(
    initialRir !== '' ? initialRir
    : targetRir !== null && targetRir !== undefined ? String(targetRir)
    : '0'
  )

  const sideLabel = side === 'left' ? 'G' : side === 'right' ? 'D' : null

  function handleConfirm() {
    onConfirm(reps, weight, rir)
    onClose()
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[75] bg-black/60"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-[80] bg-[#111111] rounded-t-2xl px-5 pt-4 max-h-[88vh] overflow-y-auto"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 24px))' }}
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } }}
        exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
      >
        {/* Handle */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[15px] font-black text-white tracking-tight">
              {sideLabel ? `${sideLabel} · ` : ''}SET {setNumber}
            </p>
            {restSec !== null && (
              <p className="text-[11px] text-white/30 mt-0.5">{formatRestDisplay(restSec)} repos</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.10]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Steppers — stacked vertically for full width */}
        <div className="flex flex-col gap-5 mb-6">
          <Stepper
            label={t('logger.reps.input')}
            value={reps}
            inputMode="numeric"
            onDecrement={() => setReps(r => String(Math.max(1, parseInt(r || '0', 10) - 1)))}
            onIncrement={() => setReps(r => String(parseInt(r || '0', 10) + 1))}
            onChange={setReps}
          />
          <Stepper
            label="Charge"
            value={weight}
            inputMode="decimal"
            unit="kg"
            onDecrement={() => setWeight(w => {
              const v = Math.max(0, parseFloat(w || '0') - 2.5)
              return Number.isInteger(v) ? String(v) : v.toFixed(1)
            })}
            onIncrement={() => setWeight(w => {
              const v = parseFloat(w || '0') + 2.5
              return Number.isInteger(v) ? String(v) : v.toFixed(1)
            })}
            onChange={setWeight}
          />
          <Stepper
            label={targetRir !== null && targetRir !== undefined ? `RIR — cible ${targetRir}` : 'RIR'}
            value={rir}
            inputMode="numeric"
            onDecrement={() => setRir(r => String(Math.max(0, parseInt(r || '0', 10) - 1)))}
            onIncrement={() => setRir(r => String(parseInt(r || '0', 10) + 1))}
            onChange={setRir}
          />
        </div>

        {/* CTA */}
        <button
          onClick={handleConfirm}
          className="w-full h-14 flex items-center justify-center bg-[#f2f2f2] text-[#080808] text-[15px] font-black uppercase tracking-[0.14em] rounded-xl active:scale-[0.97] transition-transform"
        >
          {t('logger.set.validate')}
        </button>
      </motion.div>
    </>
  )
}

// ── SetRow ────────────────────────────────────────────────────────────────────

export default function SetRow({
  set,
  workingIndex,
  recReps,
  recWeight,
  targetRir,
  recRir,
  isPR,
  coachingCue,
  hasTempoGuide,
  onValidate,
  onDelete,
  onChange,
  onTypePress,
  onTempoPress,
}: SetRowProps) {
  const x = useMotionValue(0)
  const hasActioned = useRef(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const leftBgOpacity = useTransform(x, [0, 60, 140], [0, 0.04, 0.14])
  const rightBgOpacity = useTransform(x, [-140, -60, 0], [0.14, 0.04, 0])
  const checkOpacity = useTransform(x, [60, 140], [0.3, 1])
  const trashOpacity = useTransform(x, [-140, -60], [1, 0.3])

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (hasActioned.current) return
    if (info.offset.x > 100) {
      hasActioned.current = true
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(40)
      animate(x, 500, { type: 'spring', stiffness: 300, damping: 28 }).then(() => {
        x.set(0)
        hasActioned.current = false
        setShowConfirm(true)
      })
    } else if (info.offset.x < -100 && !set.completed) {
      hasActioned.current = true
      animate(x, -500, { type: 'spring', stiffness: 300, damping: 28 }).then(() => {
        onDelete()
        x.set(0)
        hasActioned.current = false
      })
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  const typeLabel = set.set_type === 'working'
    ? (workingIndex !== null ? String(workingIndex) : '1')
    : TYPE_LABELS[set.set_type]

  const sideLabel = set.side === 'left' ? 'G' : set.side === 'right' ? 'D' : null

  // Values shown in the row (prescribed, greyed out)
  const displayReps = set.planned_reps || recReps || '—'
  const displayWeight = recWeight || '—'
  const displayRir = targetRir !== null && targetRir !== undefined
    ? String(targetRir)
    : recRir !== null && recRir !== undefined ? String(recRir) : null

  // Initial values for modal: prefer already-entered actuals, else prescribed
  const modalInitialReps = set.actual_reps || recReps || set.planned_reps
  const modalInitialWeight = set.actual_weight_kg || recWeight || ''
  const modalInitialRir = set.rir_actual

  if (set.completed) {
    return (
      <div className="flex flex-col gap-1">
        <div className="rounded-xl bg-[#1a1a1a] cursor-pointer active:scale-[0.99] transition-transform"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5">
            {/* Type pill — cliquable même sur série validée */}
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onTypePress() }}
              className="shrink-0 min-w-[28px] text-center text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.1em] px-1 py-1 rounded-lg bg-white/[0.06] active:bg-white/[0.08] transition-colors text-[#b0b0b0]"
            >
              {sideLabel && <span className="mr-0.5 text-[#808080]">{sideLabel}</span>}
              {typeLabel}
            </button>

            {/* Repos réel (ou prescrit si non encore mesuré) */}
            <div className="shrink-0 w-[46px] text-center">
              <span className="text-[11px] font-mono text-white/40">
                {formatRestDisplay(set.rest_sec_actual ?? set.rest_sec)}
              </span>
            </div>

            {/* Reps réelles */}
            <div className="flex-1 min-w-0 text-center">
              <span className="text-[13px] font-bold text-white">
                {set.actual_reps || recReps || set.planned_reps}
              </span>
            </div>

            {/* Poids réel */}
            <div className="flex items-center gap-0.5 flex-1 min-w-0 justify-center"
              onClick={() => setShowConfirm(true)}
            >
              <span className="text-[13px] font-bold text-white">
                {set.actual_weight_kg || recWeight || '—'}
              </span>
              <span className="text-[9px] text-white/40 shrink-0">kg</span>
            </div>

            {/* RIR réel */}
            {(displayRir !== null || set.rir_actual !== '') && (
              <div className="shrink-0 text-center min-w-[22px]">
                <p className="text-[13px] font-bold text-white/70 leading-none">
                  {set.rir_actual !== '' ? set.rir_actual : displayRir}
                </p>
                <p className="text-[8px] text-white/30 uppercase tracking-wide">rir</p>
              </div>
            )}

            {/* Slot tempo — même largeur que pending */}
            {onTempoPress !== undefined && <span className="shrink-0 w-7" />}

            {/* Checkmark validé */}
            <div
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setShowConfirm(true) }}
              className="shrink-0 h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-[#b0b0b0]"
            >
              <CheckCircle2 size={16} />
            </div>
          </div>

          {/* PR badge + coaching cue inline */}
          {(isPR || coachingCue) && (
            <div className="flex items-center gap-2 px-3 pb-2.5">
              {isPR && (
                <span className="bg-[#f2f2f2] text-[#080808] text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0">PR</span>
              )}
              {coachingCue && (
                <p className="text-[10px] text-white/40 italic truncate">{coachingCue}</p>
              )}
            </div>
          )}
        </div>

        {/* Modal pour modifier les valeurs d'une série validée */}
        <AnimatePresence>
          {showConfirm && (
            <ConfirmModal
              initialReps={set.actual_reps || recReps || set.planned_reps}
              initialWeight={set.actual_weight_kg || recWeight || ''}
              initialRir={set.rir_actual}
              setNumber={set.set_number}
              side={set.side}
              targetRir={targetRir}
              restSec={set.rest_sec}
              onConfirm={(reps, weight, rir) => {
                onValidate(reps, weight, rir)
              }}
              onClose={() => setShowConfirm(false)}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        {/* Swipe right → validate */}
        <motion.div
          className="absolute inset-0 rounded-xl flex items-center pl-4"
          style={{ backgroundColor: TRAINING_ACCENT, opacity: leftBgOpacity }}
        >
          <motion.div style={{ opacity: checkOpacity }}>
            <CheckCircle2 size={22} className="text-white" />
          </motion.div>
        </motion.div>

        {/* Swipe left → delete */}
        <motion.div
          className="absolute inset-0 rounded-xl flex items-center justify-end pr-4"
          style={{ backgroundColor: '#ef4444', opacity: rightBgOpacity }}
        >
          <motion.div style={{ opacity: trashOpacity }}>
            <Trash2 size={18} className="text-white" />
          </motion.div>
        </motion.div>

        <motion.div
          drag="x"
          dragConstraints={{ left: -200, right: 200 }}
          dragElastic={{ left: 0.06, right: 0.06 }}
          style={{ x }}
          onDragEnd={handleDragEnd}
          onClick={() => setShowConfirm(true)}
          className="relative rounded-xl bg-[#1a1a1a] cursor-pointer"
        >
          <div className="flex items-center gap-2 px-3 py-2.5">
            {/* Type pill */}
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onTypePress() }}
              className={`shrink-0 min-w-[28px] text-center text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.1em] px-1 py-1 rounded-lg bg-white/[0.06] active:bg-white/[0.10] transition-colors ${TYPE_COLORS[set.set_type]}`}
            >
              {sideLabel && <span className="mr-0.5 text-white/50">{sideLabel}</span>}
              {typeLabel}
            </button>

            {/* Rest — read only, tap opens modal */}
            <div className="shrink-0 w-[46px] text-center">
              <span className="text-[11px] font-mono text-white/50">
                {formatRestDisplay(set.rest_sec)}
              </span>
            </div>

            {/* Reps — prescribed, read only */}
            <div className="flex-1 min-w-0 text-center">
              <span className="text-[13px] font-bold text-white/30">{displayReps}</span>
            </div>

            {/* Weight — prescribed, read only */}
            <div className="flex items-center gap-0.5 flex-1 min-w-0 justify-center">
              <span className="text-[13px] font-bold text-white/30">{displayWeight}</span>
              <span className="text-[9px] text-white/20 shrink-0">kg</span>
            </div>

            {/* RIR target */}
            {displayRir !== null && (
              <div className="shrink-0 text-center min-w-[22px]">
                <p className="text-[13px] font-bold text-white/30 leading-none">{displayRir}</p>
                <p className="text-[8px] text-white/20 uppercase tracking-wide">rir</p>
              </div>
            )}

            {/* Tempo guide slot */}
            {onTempoPress !== undefined && (
              hasTempoGuide ? (
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onTempoPress() }}
                  className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg bg-[#222222] text-[#808080] active:scale-95 transition-all"
                >
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                    <polygon points="2,1 9,5 2,9" />
                  </svg>
                </button>
              ) : (
                <span className="shrink-0 w-7" />
              )
            )}

            {/* Validate icon — visual hint only, tap on row opens modal */}
            <div
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setShowConfirm(true) }}
              className="shrink-0 h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/20"
            >
              <CheckCircle2 size={16} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showConfirm && (
          <ConfirmModal
            initialReps={modalInitialReps}
            initialWeight={modalInitialWeight}
            initialRir={modalInitialRir}
            setNumber={set.set_number}
            side={set.side}
            targetRir={targetRir}
            restSec={set.rest_sec}
            onConfirm={(reps, weight, rir) => {
              onValidate(reps, weight, rir)
            }}
            onClose={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
