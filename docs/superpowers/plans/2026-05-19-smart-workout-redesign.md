# Smart Workout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte du SessionLogger vers une liste scrollable native style Motra — sets inline-editables, swipe natif, context menus `•••`, set type selector (EC/Principal/RC/Dégressive) — en conservant toute la logique existante (live save, PR detection, SetRecommendation, RestTimer, tempo).

**Architecture:** 5 nouveaux composants (`SetRow`, `ExerciseBlock`, `SetTypeSelector`, `ExerciseContextMenu`, `SupersetContextMenu`) + refonte du `SessionLogger` pour orchestrer une liste plate. `SetSwipeCard` et `SetEditSheet` sont supprimés. `SmartWorkoutHero` reçoit un ajustement typographique mineur.

**Tech Stack:** Next.js App Router, TypeScript strict, Framer Motion (swipe), Tailwind DS v3.0 (`#0d0d0d`/`#161616`/`#ffe01e`/Barlow), Supabase (migration `set_type`)

---

## File Map

| Action | Fichier |
|--------|---------|
| CREATE | `supabase/migrations/20260519_set_type.sql` |
| CREATE | `components/client/smart/SetRow.tsx` |
| CREATE | `components/client/smart/SetTypeSelector.tsx` |
| CREATE | `components/client/smart/ExerciseContextMenu.tsx` |
| CREATE | `components/client/smart/SupersetContextMenu.tsx` |
| CREATE | `components/client/smart/ExerciseBlock.tsx` |
| REWRITE | `app/client/programme/session/[sessionId]/SessionLogger.tsx` |
| MODIFY | `components/client/smart/SmartWorkoutHero.tsx` |
| DELETE | `components/client/smart/SetSwipeCard.tsx` |
| DELETE | `components/client/smart/SetEditSheet.tsx` |

---

## Task 1 — Migration DB : colonne `set_type`

**Files:**
- Create: `supabase/migrations/20260519_set_type.sql`

- [ ] **Step 1: Créer le fichier migration**

```sql
-- supabase/migrations/20260519_set_type.sql
ALTER TABLE client_set_logs
  ADD COLUMN IF NOT EXISTS set_type text DEFAULT 'working'
  CHECK (set_type IN ('warmup', 'working', 'cooldown', 'dropset'));
```

- [ ] **Step 2: Appliquer manuellement via Supabase Dashboard**

Aller dans Supabase Dashboard → SQL Editor → coller et exécuter le contenu du fichier.  
Expected: `ALTER TABLE` sans erreur.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260519_set_type.sql
git commit -m "schema: add set_type column to client_set_logs"
```

---

## Task 2 — `SetRow` — Row inline-editable avec swipe

**Files:**
- Create: `components/client/smart/SetRow.tsx`

- [ ] **Step 1: Créer `SetRow.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { CheckCircle2, Trash2 } from 'lucide-react'

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
}

interface SetRowProps {
  set: SetRowData
  workingIndex: number | null // numéro affiché pour les séries 'working' (1-based), null si EC/RC/dropset
  recReps?: string
  recWeight?: string
  isPR?: boolean
  coachingCue?: string | null
  onValidate: () => void
  onDelete: () => void
  onChange: (patch: Partial<SetRowData>) => void
  onTypePress: () => void
}

const TYPE_LABELS: Record<SetType, string> = {
  warmup: 'EC',
  working: '',   // replaced by workingIndex
  cooldown: 'RC',
  dropset: '↘',
}

const TYPE_COLORS: Record<SetType, string> = {
  warmup: 'text-[#FF6B35]',
  working: 'text-white',
  cooldown: 'text-blue-400',
  dropset: 'text-violet-400',
}

function formatRestDisplay(sec: number | null): string {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function SetRow({
  set,
  workingIndex,
  recReps,
  recWeight,
  isPR,
  coachingCue,
  onValidate,
  onDelete,
  onChange,
  onTypePress,
}: SetRowProps) {
  const x = useMotionValue(0)
  const hasActioned = useRef(false)
  const [editingRest, setEditingRest] = useState(false)
  const [restInputVal, setRestInputVal] = useState(String(set.rest_sec ?? ''))

  const leftBg = useTransform(x, [0, 60, 140], [0, 0.04, 0.14])
  const rightBg = useTransform(x, [-140, -60, 0], [0.14, 0.04, 0])
  const checkOpacity = useTransform(x, [60, 140], [0.3, 1])
  const trashOpacity = useTransform(x, [-140, -60], [1, 0.3])

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (hasActioned.current) return
    if (info.offset.x > 100) {
      hasActioned.current = true
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(40)
      animate(x, 500, { type: 'spring', stiffness: 300, damping: 28 }).then(() => {
        onValidate()
        x.set(0)
        hasActioned.current = false
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

  if (set.completed) {
    return (
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer active:scale-[0.99] transition-transform"
          style={{ backgroundColor: 'rgba(255,224,30,0.06)', borderColor: 'rgba(255,224,30,0.20)' }}
          onClick={() => onChange({ completed: false })}
        >
          <CheckCircle2 size={14} className="text-[#ffe01e] shrink-0" />
          <span className={`text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] shrink-0 ${TYPE_COLORS[set.set_type]}`}>
            {sideLabel && <span className="mr-0.5">{sideLabel}</span>}
            {typeLabel}
          </span>
          <span className="text-[12px] font-mono font-bold text-white flex-1 min-w-0 truncate">
            {set.actual_reps || recReps || set.planned_reps} × {set.actual_weight_kg || recWeight || '—'}kg
          </span>
          {set.rir_actual && (
            <span className="text-[11px] text-white/40 shrink-0">RIR {set.rir_actual}</span>
          )}
          {isPR && (
            <span className="bg-[#ffe01e] text-[#0d0d0d] text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0">PR</span>
          )}
        </div>
        {coachingCue && (
          <p className="px-1 text-[10px] text-white/40 italic">{coachingCue}</p>
        )}
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe right → validate (green) */}
      <motion.div
        className="absolute inset-0 rounded-xl flex items-center pl-4"
        style={{ backgroundColor: '#10b981', opacity: leftBg }}
      >
        <motion.div style={{ opacity: checkOpacity }}>
          <CheckCircle2 size={22} className="text-white" />
        </motion.div>
      </motion.div>

      {/* Swipe left → delete (red) */}
      <motion.div
        className="absolute inset-0 rounded-xl flex items-center justify-end pr-4"
        style={{ backgroundColor: '#ef4444', opacity: rightBg }}
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
        className="relative rounded-xl border border-white/[0.08] bg-[#1a1a1a] cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Type pill */}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onTypePress() }}
            className={`shrink-0 min-w-[32px] text-center text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] px-1.5 py-1 rounded-lg bg-white/[0.06] active:bg-white/[0.10] transition-colors ${TYPE_COLORS[set.set_type]}`}
          >
            {sideLabel && <span className="mr-0.5 text-white/50">{sideLabel}</span>}
            {typeLabel}
          </button>

          {/* Rest */}
          <div
            className="shrink-0 w-[52px]"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {editingRest ? (
              <input
                type="number"
                inputMode="numeric"
                value={restInputVal}
                autoFocus
                onChange={e => setRestInputVal(e.target.value)}
                onBlur={() => {
                  const sec = parseInt(restInputVal, 10)
                  if (!isNaN(sec) && sec >= 0) onChange({ rest_sec: sec })
                  setEditingRest(false)
                }}
                className="w-full min-w-0 bg-transparent text-[12px] font-mono text-white text-center border-b border-white/20 outline-none"
              />
            ) : (
              <button
                onClick={() => { setRestInputVal(String(set.rest_sec ?? '')); setEditingRest(true) }}
                className="w-full text-[12px] font-mono text-white/50 text-center"
              >
                {formatRestDisplay(set.rest_sec)}
              </button>
            )}
          </div>

          {/* Reps */}
          <input
            type="number"
            inputMode="numeric"
            value={set.actual_reps}
            placeholder={recReps ?? set.planned_reps}
            min={1}
            max={99}
            onPointerDown={e => e.stopPropagation()}
            onChange={e => onChange({ actual_reps: e.target.value })}
            className="flex-1 min-w-0 bg-transparent text-[14px] font-bold text-white text-center outline-none placeholder:text-white/20"
          />

          {/* Weight */}
          <div
            className="flex items-center gap-0.5 flex-1 min-w-0"
            onPointerDown={e => e.stopPropagation()}
          >
            <input
              type="number"
              inputMode="decimal"
              step={0.25}
              value={set.actual_weight_kg}
              placeholder={recWeight ?? '—'}
              min={0}
              max={999}
              onChange={e => onChange({ actual_weight_kg: e.target.value })}
              className="flex-1 min-w-0 w-0 bg-transparent text-[14px] font-bold text-white text-center outline-none placeholder:text-white/20"
            />
            <span className="text-[10px] text-white/25 shrink-0">kg</span>
          </div>

          {/* Validate button */}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onValidate() }}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.08] active:scale-95 transition-all"
          >
            <CheckCircle2 size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 nouvelles erreurs.

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/SetRow.tsx
git commit -m "feat(workout): add SetRow — inline editable set with swipe validate/delete"
```

---

## Task 3 — `SetTypeSelector` — Bottom sheet type de série

**Files:**
- Create: `components/client/smart/SetTypeSelector.tsx`

- [ ] **Step 1: Créer `SetTypeSelector.tsx`**

```tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { SetType } from './SetRow'

interface SetTypeSelectorProps {
  open: boolean
  current: SetType
  onSelect: (type: SetType) => void
  onClose: () => void
}

const OPTIONS: { type: SetType; label: string; sublabel: string; icon: string; color: string }[] = [
  { type: 'warmup',  label: 'Échauffement', sublabel: 'EC', icon: '⚡', color: 'text-[#FF6B35]' },
  { type: 'working', label: 'Série principale', sublabel: '', icon: '1', color: 'text-white' },
  { type: 'cooldown',label: 'Retour au calme', sublabel: 'RC', icon: '❄', color: 'text-blue-400' },
  { type: 'dropset', label: 'Dégressive', sublabel: '', icon: '↘', color: 'text-violet-400' },
]

export default function SetTypeSelector({ open, current, onSelect, onClose }: SetTypeSelectorProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[65] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[70] bg-[#161616] rounded-t-2xl border-t border-white/[0.08] pb-8"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }}
            exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
          >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />
            <p className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/40 text-center pt-6 pb-4">
              Type de série
            </p>
            <div className="divide-y divide-white/[0.05]">
              {OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => { onSelect(opt.type); onClose() }}
                  className={`w-full flex items-center gap-4 px-6 py-4 active:bg-white/[0.04] transition-colors ${current === opt.type ? 'bg-white/[0.04]' : ''}`}
                >
                  <span className={`text-[18px] w-6 text-center ${opt.color}`}>{opt.icon}</span>
                  <span className="text-[15px] font-semibold text-white flex-1 text-left">{opt.label}</span>
                  {opt.sublabel && (
                    <span className={`text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] ${opt.color}`}>{opt.sublabel}</span>
                  )}
                  {current === opt.type && (
                    <span className="text-[#ffe01e] text-[12px]">✓</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-full mt-2 py-4 text-[13px] text-white/40 font-medium"
            >
              Annuler
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/SetTypeSelector.tsx
git commit -m "feat(workout): add SetTypeSelector — EC/Principal/RC/Dégressive sheet"
```

---

## Task 4 — `ExerciseContextMenu` + `SupersetContextMenu`

**Files:**
- Create: `components/client/smart/ExerciseContextMenu.tsx`
- Create: `components/client/smart/SupersetContextMenu.tsx`

- [ ] **Step 1: Créer `ExerciseContextMenu.tsx`**

```tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Clock, MessageSquare, Play, Trash2 } from 'lucide-react'

interface ExerciseContextMenuProps {
  open: boolean
  hasTempo: boolean
  onSwap: () => void
  onRest: () => void
  onNote: () => void
  onTempo: () => void
  onDelete: () => void
  onClose: () => void
}

export default function ExerciseContextMenu({
  open, hasTempo, onSwap, onRest, onNote, onTempo, onDelete, onClose,
}: ExerciseContextMenuProps) {
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
          <motion.div className="fixed inset-0 z-[65] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[70] bg-[#161616] rounded-t-2xl border-t border-white/[0.08] pb-8"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }}
            exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
          >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />
            <div className="pt-4 divide-y divide-white/[0.05]">
              {item(<RefreshCw size={16} />, "Exercice d'échange", onSwap)}
              {item(<Clock size={16} />, "Temps de repos", onRest)}
              {item(<MessageSquare size={16} />, "Ajouter une note", onNote)}
              {hasTempo && item(<Play size={16} />, "Tempo guide", onTempo)}
              <div className="pt-1">
                {item(<Trash2 size={16} />, "Supprimer l'exercice", onDelete, true)}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Créer `SupersetContextMenu.tsx`**

```tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, Clock, Trash2 } from 'lucide-react'

interface SupersetContextMenuProps {
  open: boolean
  onDissolve: () => void
  onRest: () => void
  onDelete: () => void
  onClose: () => void
}

export default function SupersetContextMenu({
  open, onDissolve, onRest, onDelete, onClose,
}: SupersetContextMenuProps) {
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
          <motion.div className="fixed inset-0 z-[65] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[70] bg-[#161616] rounded-t-2xl border-t border-white/[0.08] pb-8"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }}
            exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
          >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />
            <div className="pt-4 divide-y divide-white/[0.05]">
              {item(<ArrowLeftRight size={16} />, "Dissocier le superset", onDissolve)}
              {item(<Clock size={16} />, "Temps de repos", onRest)}
              <div className="pt-1">
                {item(<Trash2 size={16} />, "Supprimer le superset", onDelete, true)}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add components/client/smart/ExerciseContextMenu.tsx components/client/smart/SupersetContextMenu.tsx
git commit -m "feat(workout): add ExerciseContextMenu + SupersetContextMenu sheets"
```

---

## Task 5 — `ExerciseBlock` — Card exercice avec sets inline

**Files:**
- Create: `components/client/smart/ExerciseBlock.tsx`

- [ ] **Step 1: Créer `ExerciseBlock.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { MoreHorizontal, Plus, BarChart2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import SetRow, { type SetRowData, type SetType } from './SetRow'
import SetTypeSelector from './SetTypeSelector'
import ExerciseContextMenu from './ExerciseContextMenu'
import type { SetRecommendation } from '@/lib/training/setRecommendation'

interface ExerciseBlockExercise {
  id: string
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  target_rir: number | null
  image_url: string | null
  tempo: string | null
  movement_pattern: string | null
  weight_increment_kg?: number | null
}

interface ExerciseBlockProps {
  exercise: ExerciseBlockExercise
  sets: SetRowData[]
  recommendations: Record<string, SetRecommendation>
  prSets: Set<string>
  coachingCues: Record<string, string | null>
  lastPerformance: Record<string, { weight: number | null; reps: number | null; rir?: number | null }[]>
  inSuperset?: boolean
  onValidateSet: (exId: string, setNum: number, side: string) => void
  onDeleteSet: (exId: string, setNum: number, side: string) => void
  onChangeSet: (exId: string, setNum: number, side: string, patch: Partial<SetRowData>) => void
  onAddSet: (exId: string) => void
  onSwap: (exId: string) => void
  onRest: (exId: string) => void
  onNote: (exId: string) => void
  onTempo: (exId: string) => void
  onDeleteExercise: (exId: string) => void
  onOpenProgression: (exId: string, exerciseName: string) => void
}

function recKey(exerciseId: string, setNumber: number, side: string): string {
  return `${exerciseId}_set${setNumber}_${side}`
}

export default function ExerciseBlock({
  exercise,
  sets,
  recommendations,
  prSets,
  coachingCues,
  lastPerformance,
  inSuperset = false,
  onValidateSet,
  onDeleteSet,
  onChangeSet,
  onAddSet,
  onSwap,
  onRest,
  onNote,
  onTempo,
  onDeleteExercise,
  onOpenProgression,
}: ExerciseBlockProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [typeSelectorFor, setTypeSelectorFor] = useState<{ setNum: number; side: string } | null>(null)
  const activeSetRef = useRef<HTMLDivElement>(null)

  const firstActiveSet = sets.find(s => !s.completed)

  // Count working sets for display numbers
  let workingCounter = 0
  const workingIndexMap: Record<string, number> = {}
  for (const s of sets) {
    if (s.set_type === 'working') {
      workingCounter++
      workingIndexMap[`${s.set_number}_${s.side}`] = workingCounter
    }
  }

  const effectiveRir = exercise.target_rir ?? exercise.rir
  const hasTempo = !!exercise.tempo

  return (
    <div className={inSuperset ? '' : 'bg-[#161616] rounded-2xl border border-white/[0.08] overflow-hidden'}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3 pb-2">
        {exercise.image_url ? (
          <Image
            src={exercise.image_url}
            alt={exercise.name}
            width={56}
            height={56}
            unoptimized={exercise.image_url.endsWith('.gif')}
            className="w-14 h-14 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-white/[0.04] shrink-0 flex items-center justify-center">
            <span className="text-white/10 text-[22px]">💪</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-white leading-tight truncate">{exercise.name}</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            {exercise.sets} séries · {exercise.reps} reps{effectiveRir !== null ? ` · RIR ${effectiveRir}` : ''}
          </p>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40 hover:text-white/60 hover:bg-white/[0.08] active:scale-95 transition-all"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 pb-1">
        <span className="shrink-0 min-w-[32px] text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 text-center">Série</span>
        <span className="shrink-0 w-[52px] text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 text-center">Repos</span>
        <span className="flex-1 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 text-center">Reps</span>
        <span className="flex-1 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 text-center">kg</span>
        <span className="shrink-0 w-8" />
      </div>

      {/* Sets */}
      <div className="px-3 pb-2 flex flex-col gap-1.5">
        {sets.map(s => {
          const key = recKey(s.exercise_id, s.set_number, s.side)
          const rec = recommendations[key]
          const isActive = firstActiveSet?.set_number === s.set_number && firstActiveSet?.side === s.side
          const wi = s.set_type === 'working' ? (workingIndexMap[`${s.set_number}_${s.side}`] ?? null) : null

          return (
            <div
              key={key}
              ref={isActive ? activeSetRef : undefined}
              style={isActive ? { borderRadius: '12px', boxShadow: '0 0 0 1px rgba(255,224,30,0.2)' } : undefined}
            >
              <SetRow
                set={s}
                workingIndex={wi}
                recReps={rec ? String(rec.reps) : undefined}
                recWeight={rec ? String(rec.weight_kg) : undefined}
                isPR={prSets.has(key)}
                coachingCue={coachingCues[key] ?? null}
                onValidate={() => onValidateSet(s.exercise_id, s.set_number, s.side)}
                onDelete={() => onDeleteSet(s.exercise_id, s.set_number, s.side)}
                onChange={patch => onChangeSet(s.exercise_id, s.set_number, s.side, patch)}
                onTypePress={() => setTypeSelectorFor({ setNum: s.set_number, side: s.side })}
              />
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pt-1 pb-3">
        <button
          onClick={() => onAddSet(exercise.id)}
          className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/60 font-medium active:scale-95 transition-all"
        >
          <Plus size={13} />
          Add Set
        </button>
        <button
          onClick={() => onOpenProgression(exercise.id, exercise.name)}
          className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/50 active:scale-95 transition-all"
        >
          <BarChart2 size={13} />
        </button>
      </div>

      {/* Context menu */}
      <ExerciseContextMenu
        open={menuOpen}
        hasTempo={hasTempo}
        onSwap={() => onSwap(exercise.id)}
        onRest={() => onRest(exercise.id)}
        onNote={() => onNote(exercise.id)}
        onTempo={() => onTempo(exercise.id)}
        onDelete={() => onDeleteExercise(exercise.id)}
        onClose={() => setMenuOpen(false)}
      />

      {/* Set type selector */}
      <SetTypeSelector
        open={typeSelectorFor !== null}
        current={typeSelectorFor ? (sets.find(s => s.set_number === typeSelectorFor.setNum && s.side === typeSelectorFor.side)?.set_type ?? 'working') : 'working'}
        onSelect={type => {
          if (typeSelectorFor) {
            onChangeSet(exercise.id, typeSelectorFor.setNum, typeSelectorFor.side, { set_type: type })
          }
        }}
        onClose={() => setTypeSelectorFor(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/ExerciseBlock.tsx
git commit -m "feat(workout): add ExerciseBlock — exercise card with inline sets"
```

---

## Task 6 — Réécriture `SessionLogger.tsx`

**Files:**
- Rewrite: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

C'est la tâche la plus complexe. On conserve toute la logique (live save, PR detection, RestTimer, tempo, hydration, long press) et on remplace l'UI de rendu par la nouvelle liste.

- [ ] **Step 1: Lire le fichier complet avant modification**

```bash
wc -l /Users/user/Desktop/STRYVLAB/app/client/programme/session/\[sessionId\]/SessionLogger.tsx
```

- [ ] **Step 2: Ajouter `set_type` à l'interface `SetLog`**

Dans `SessionLogger.tsx`, trouver l'interface `SetLog` et ajouter le champ :

```typescript
interface SetLog {
  exercise_id: string
  exercise_name: string
  set_number: number
  side: 'left' | 'right' | 'bilateral'
  set_type: 'warmup' | 'working' | 'cooldown' | 'dropset'  // ← ADD
  planned_reps: string
  actual_reps: string
  actual_weight_kg: string
  completed: boolean
  rir_actual: string
  notes: string
  rest_sec_actual: number | null
  rest_sec: number | null  // ← ADD (repos prescrit pour affichage dans SetRow)
  primary_muscles: string[]
  secondary_muscles: string[]
  tempo_used: string | null
}
```

- [ ] **Step 3: Mettre à jour `buildInitialSets` pour initialiser `set_type` et `rest_sec`**

Trouver la fonction `buildInitialSets` et ajouter dans chaque `sets.push({...})` :

```typescript
set_type: 'working',
rest_sec: ex.rest_sec,
```

- [ ] **Step 4: Ajouter les imports des nouveaux composants**

En haut du fichier, remplacer les imports `SetSwipeCard` et `SetEditSheet` par :

```typescript
import ExerciseBlock from '@/components/client/smart/ExerciseBlock'
import SupersetContextMenu from '@/components/client/smart/SupersetContextMenu'
import type { SetRowData } from '@/components/client/smart/SetRow'
```

Supprimer les imports :
```typescript
// DELETE: import SetSwipeCard from '@/components/client/smart/SetSwipeCard'
// DELETE: import SetEditSheet from '@/components/client/smart/SetEditSheet'
```

- [ ] **Step 5: Ajouter states pour le nouveau header et les menus**

Dans la section states du composant, ajouter :

```typescript
const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
const [progressionTarget, setProgressionTarget] = useState<{ exId: string; name: string } | null>(null)
const [deletedExerciseIds, setDeletedExerciseIds] = useState<Set<string>>(new Set())
const [dissolvedGroupIds, setDissolvedGroupIds] = useState<Set<string>>(new Set())
const [supersetMenuFor, setSupersetMenuFor] = useState<string | null>(null) // group_id
```

- [ ] **Step 6: Ajouter `deleteSet` et `addSet` handlers**

Après la fonction `toggleSet`, ajouter :

```typescript
function deleteSet(exId: string, setNum: number, side: string) {
  setSets(prev => prev.filter(s => !(s.exercise_id === exId && s.set_number === setNum && s.side === side)))
}

function addSet(exId: string) {
  const ex = exercises.find(e => e.id === exId)
  if (!ex) return
  const exSets = sets.filter(s => s.exercise_id === exId)
  const lastSet = exSets[exSets.length - 1]
  const newSetNum = (lastSet?.set_number ?? 0) + 1
  const resolvedTempo = ex.tempo ?? getDefaultTempo(ex.movement_pattern ?? null, goal)
  const newSet: SetLog = {
    exercise_id: exId,
    exercise_name: ex.name,
    set_number: newSetNum,
    side: 'bilateral',
    set_type: 'working',
    planned_reps: lastSet?.planned_reps ?? ex.reps,
    actual_reps: '',
    actual_weight_kg: lastSet?.actual_weight_kg ?? (ex.current_weight_kg !== null ? String(ex.current_weight_kg) : ''),
    completed: false,
    rir_actual: '',
    notes: '',
    rest_sec_actual: null,
    rest_sec: ex.rest_sec,
    primary_muscles: ex.primary_muscles ?? [],
    secondary_muscles: ex.secondary_muscles ?? [],
    tempo_used: resolvedTempo,
  }
  setSets(prev => [...prev, newSet])
}
```

- [ ] **Step 7: Mettre à jour `updateSet` pour supporter `set_type` et `rest_sec`**

La fonction `updateSet` existante appelle `onChange` avec un `Partial<SetLog>` — elle supporte déjà les nouveaux champs automatiquement. Vérifier que le `patchSets` sérialise bien `set_type` vers l'API. Dans `parseSetForApi`, ajouter la propagation de `set_type` :

```typescript
function parseSetForApi(s: SetLog) {
  const reps = s.actual_reps !== '' ? parseInt(s.actual_reps, 10) : null
  const weight = s.actual_weight_kg !== '' ? parseFloat(s.actual_weight_kg) : null
  const rir = s.rir_actual !== '' ? parseInt(s.rir_actual, 10) : null
  return {
    ...s,
    set_type: s.set_type,  // explicit
    actual_reps: reps !== null && !isNaN(reps) ? reps : null,
    actual_weight_kg: weight !== null && !isNaN(weight) ? weight : null,
    rir_actual: rir !== null && !isNaN(rir) ? rir : null,
    planned_reps: s.planned_reps || null,
  }
}
```

- [ ] **Step 8: Calculer `coachingCues` map pour passer à ExerciseBlock**

Dans la section render (avant le return), ajouter :

```typescript
const coachingCuesMap: Record<string, string | null> = {}
for (const s of sets) {
  if (s.completed) {
    const key = recKey(s.exercise_id, s.set_number, s.side)
    const ex = exercises.find(e => e.id === s.exercise_id)
    const exSets = sets.filter(st => st.exercise_id === s.exercise_id)
    const totalSets = exSets.length
    const isLastSet = s.set_number === Math.max(...exSets.map(st => st.set_number))
    const rir = s.rir_actual !== '' ? parseInt(s.rir_actual, 10) : null
    coachingCuesMap[key] = getCoachingCue(rir, s.set_number, totalSets, isLastSet)
  }
}
```

- [ ] **Step 9: Remplacer le JSX de rendu principal**

Trouver le bloc `return (` du composant et remplacer le contenu par la nouvelle structure. Le rendu doit contenir :

**Header fixe :**
```tsx
<div className="sticky top-0 z-50 bg-[#0d0d0d] border-b border-white/[0.06]">
  <div className="flex items-center justify-between px-4 py-3">
    <button
      onClick={() => setSessionMenuOpen(true)}
      className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40"
    >
      <MoreHorizontal size={16} />
    </button>
    <span className="text-[16px] font-mono font-bold text-white tabular-nums">
      {formatTime(elapsed)}
    </span>
    <button
      onPointerDown={onFinishPressStart}
      onPointerUp={onFinishPressEnd}
      onPointerLeave={onFinishPressEnd}
      className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-white/[0.04] text-white/60 text-[11px] font-bold uppercase tracking-[0.08em] relative overflow-hidden"
    >
      {longPressProgress > 0 && (
        <div
          className="absolute inset-0 bg-[#ffe01e]/15 origin-left"
          style={{ transform: `scaleX(${longPressProgress})` }}
        />
      )}
      <Flag size={12} />
      Terminer
    </button>
  </div>
  {/* Progress bar */}
  <div className="h-[2px] bg-white/[0.06] mx-4 mb-2 rounded-full overflow-hidden">
    <div
      className="h-full bg-[#ffe01e] rounded-full transition-all duration-300"
      style={{ width: `${progress * 100}%` }}
    />
  </div>
  <p className="text-center text-[10px] text-white/25 font-barlow-condensed uppercase tracking-[0.1em] pb-2">
    {completedCount}/{totalSets} séries
  </p>
</div>
```

**Zone scrollable — liste des exercices :**

```tsx
<div className="flex flex-col gap-3 px-4 py-4 pb-24">
  {exerciseGroups
    .filter(group => !group.every(ex => deletedExerciseIds.has(ex.id)))
    .map((group, gi) => {
      const isSuperset = group.length > 1
      const groupId = group[0].group_id ?? null
      const isDissolved = groupId ? dissolvedGroupIds.has(groupId) : false
      const renderExercises = isDissolved ? group : group

      if (isSuperset && !isDissolved && groupId) {
        return (
          <div key={groupId} className="bg-[#161616] rounded-2xl border border-white/[0.08] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <RefreshCw size={12} className="text-white/40" />
                <span className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/50">Surensemble</span>
              </div>
              <button
                onClick={() => setSupersetMenuFor(groupId)}
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.04] text-white/30"
              >
                <MoreHorizontal size={13} />
              </button>
            </div>
            {group
              .filter(ex => !deletedExerciseIds.has(ex.id))
              .map((ex, ei) => (
                <div key={ex.id} className={ei > 0 ? 'border-t border-white/[0.05]' : ''}>
                  <ExerciseBlock
                    exercise={ex}
                    sets={sets.filter(s => s.exercise_id === ex.id).map(s => s as SetRowData)}
                    recommendations={recommendations}
                    prSets={prSets}
                    coachingCues={coachingCuesMap}
                    lastPerformance={lastPerformance}
                    inSuperset
                    onValidateSet={(exId, setNum, side) => toggleSet(exId, setNum, side, ex.rest_sec)}
                    onDeleteSet={deleteSet}
                    onChangeSet={(exId, setNum, side, patch) => updateSet(exId, setNum, side, patch as any)}
                    onAddSet={addSet}
                    onSwap={exId => setSwapTarget(exId)}
                    onRest={exId => { const e = exercises.find(x => x.id === exId); startRest(exId, 0, 'bilateral', e?.rest_sec ?? null) }}
                    onNote={exId => setShowNoteInput(prev => prev === exId ? null : exId)}
                    onTempo={exId => {
                      const e = exercises.find(x => x.id === exId)
                      if (!e?.tempo) return
                      const reps = resolveReps(e)
                      const prepSec = getPrepTime()
                      const hapticsOn = getHapticsEnabled()
                      if (!hasPrepTimeConfigured()) {
                        setPrepTimeTarget({ tempo: e.tempo, reps, exerciseName: e.name })
                      } else {
                        setTempoGuideTarget({ tempo: e.tempo, reps, exerciseName: e.name, prepSeconds: prepSec, hapticsEnabled: hapticsOn })
                      }
                    }}
                    onDeleteExercise={exId => setDeletedExerciseIds(prev => new Set(prev).add(exId))}
                    onOpenProgression={(exId, name) => setProgressionTarget({ exId, name })}
                  />
                </div>
              ))}
          </div>
        )
      }

      // Solo exercises (or dissolved superset members)
      return renderExercises
        .filter(ex => !deletedExerciseIds.has(ex.id))
        .map(ex => (
          <ExerciseBlock
            key={ex.id}
            exercise={ex}
            sets={sets.filter(s => s.exercise_id === ex.id).map(s => s as SetRowData)}
            recommendations={recommendations}
            prSets={prSets}
            coachingCues={coachingCuesMap}
            lastPerformance={lastPerformance}
            onValidateSet={(exId, setNum, side) => toggleSet(exId, setNum, side, ex.rest_sec)}
            onDeleteSet={deleteSet}
            onChangeSet={(exId, setNum, side, patch) => updateSet(exId, setNum, side, patch as any)}
            onAddSet={addSet}
            onSwap={exId => setSwapTarget(exId)}
            onRest={exId => { const e = exercises.find(x => x.id === exId); startRest(exId, 0, 'bilateral', e?.rest_sec ?? null) }}
            onNote={exId => setShowNoteInput(prev => prev === exId ? null : exId)}
            onTempo={exId => {
              const e = exercises.find(x => x.id === exId)
              if (!e?.tempo) return
              const reps = resolveReps(e)
              const prepSec = getPrepTime()
              const hapticsOn = getHapticsEnabled()
              if (!hasPrepTimeConfigured()) {
                setPrepTimeTarget({ tempo: e.tempo, reps, exerciseName: e.name })
              } else {
                setTempoGuideTarget({ tempo: e.tempo, reps, exerciseName: e.name, prepSeconds: prepSec, hapticsEnabled: hapticsOn })
              }
            }}
            onDeleteExercise={exId => setDeletedExerciseIds(prev => new Set(prev).add(exId))}
            onOpenProgression={(exId, name) => setProgressionTarget({ exId, name })}
          />
        ))
    })}
</div>
```

**Ajouter après le scroll zone les overlays conservés :**

Conserver exactement tel quel (copier depuis l'existant) :
- RestTimer modal
- TempoGuideModal
- PrepTimeModal
- ShowFinishConfirm modal
- HydrationIntro modal
- ExerciseSwapSheet
- ClientAlternativesSheet
- PR flash toast

**Ajouter les nouveaux overlays :**

```tsx
{/* Session context menu */}
<AnimatePresence>
  {sessionMenuOpen && (
    <>
      <motion.div className="fixed inset-0 z-[65] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSessionMenuOpen(false)} />
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#161616] rounded-t-2xl border-t border-white/[0.08] pb-8"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }}
        exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
      >
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />
        <div className="pt-4 divide-y divide-white/[0.05]">
          <button onClick={() => { startRest('', 0, 'bilateral', 120); setSessionMenuOpen(false) }} className="w-full flex items-center gap-4 px-6 py-4 text-white active:bg-white/[0.04]">
            <Clock size={16} className="opacity-70" /><span className="text-[15px] font-medium">Démarrer un repos manuel</span>
          </button>
          <button onClick={() => { setShowHydration(true); setSessionMenuOpen(false) }} className="w-full flex items-center gap-4 px-6 py-4 text-white active:bg-white/[0.04]">
            <span className="w-4 text-center">💧</span><span className="text-[15px] font-medium">Hydratation</span>
          </button>
          <div className="pt-1">
            <button onClick={() => { setSessionMenuOpen(false); setShowFinishConfirm(true) }} className="w-full flex items-center gap-4 px-6 py-4 text-red-400 active:bg-white/[0.04]">
              <Flag size={16} className="opacity-70" /><span className="text-[15px] font-medium">Terminer la séance</span>
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>

{/* Superset context menu */}
{supersetMenuFor && (
  <SupersetContextMenu
    open={true}
    onDissolve={() => { setDissolvedGroupIds(prev => new Set(prev).add(supersetMenuFor!)); setSupersetMenuFor(null) }}
    onRest={() => { startRest('', 0, 'bilateral', 120); setSupersetMenuFor(null) }}
    onDelete={() => {
      const group = exerciseGroups.find(g => g[0].group_id === supersetMenuFor)
      if (group) {
        setDeletedExerciseIds(prev => {
          const next = new Set(prev)
          group.forEach(ex => next.add(ex.id))
          return next
        })
      }
      setSupersetMenuFor(null)
    }}
    onClose={() => setSupersetMenuFor(null)}
  />
)}

{/* Exercise Progression Chart */}
{progressionTarget && (
  <div className="fixed inset-0 z-[80] bg-black/60" onClick={() => setProgressionTarget(null)}>
    <div className="absolute bottom-0 left-0 right-0 bg-[#161616] rounded-t-2xl border-t border-white/[0.08] p-4 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="w-10 h-1 rounded-full bg-white/[0.12] mx-auto mb-4" />
      <ExerciseProgressionChart clientId={clientId} exerciseName={progressionTarget.name} />
    </div>
  </div>
)}
```

- [ ] **Step 10: Supprimer les states devenus obsolètes**

Supprimer ces states qui ne sont plus utilisés après la refonte :
```typescript
// DELETE: currentGroupIndex, setCurrentGroupIndex
// DELETE: editingSet, setEditingSet
// DELETE: swipeHintDismissed, setSwipeHintDismissed (et le localStorage check)
// DELETE: firstIncompleteKey
```

- [ ] **Step 11: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -50
```
Corriger toutes les erreurs avant de continuer.

- [ ] **Step 12: Commit**

```bash
git add app/client/programme/session/\[sessionId\]/SessionLogger.tsx
git commit -m "feat(workout): rewrite SessionLogger — scrollable list with ExerciseBlock"
```

---

## Task 7 — Supprimer `SetSwipeCard` et `SetEditSheet`

**Files:**
- Delete: `components/client/smart/SetSwipeCard.tsx`
- Delete: `components/client/smart/SetEditSheet.tsx`

- [ ] **Step 1: Vérifier qu'aucun autre fichier n'importe ces composants**

```bash
grep -r "SetSwipeCard\|SetEditSheet" /Users/user/Desktop/STRYVLAB/components /Users/user/Desktop/STRYVLAB/app --include="*.tsx" --include="*.ts" -l
```
Expected: aucune ligne de résultat (seul SessionLogger les utilisait, et il a été refondu).

- [ ] **Step 2: Supprimer les fichiers**

```bash
rm /Users/user/Desktop/STRYVLAB/components/client/smart/SetSwipeCard.tsx
rm /Users/user/Desktop/STRYVLAB/components/client/smart/SetEditSheet.tsx
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 erreurs liées à ces suppressions.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(workout): remove SetSwipeCard and SetEditSheet (replaced by SetRow)"
```

---

## Task 8 — `SmartWorkoutHero` redesign

**Files:**
- Modify: `components/client/smart/SmartWorkoutHero.tsx`

- [ ] **Step 1: Lire le fichier actuel**

```bash
cat /Users/user/Desktop/STRYVLAB/components/client/smart/SmartWorkoutHero.tsx
```

- [ ] **Step 2: Remplacer le contenu**

```tsx
'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import BodyMap from '../BodyMap'
import type { MuscleGroup } from '@/lib/client/muscleDetection'

type Props = {
  date: string
  state: 'scheduled' | 'completed' | 'rest'
  sessionName?: string
  sessionLogHref?: string
  recapHref?: string
  exerciseCount?: number
  estimatedMinutes?: number
  performanceSummary?: string
  primaryMuscles?: MuscleGroup[]
  secondaryMuscles?: MuscleGroup[]
  musclePills?: string[]
}

function fmt(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(iso + 'T00:00:00'))
}

export default function SmartWorkoutHero(p: Props) {
  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[10px] text-white/40">Séance du jour</span>
        <span className="text-[11px] text-white/40">{fmt(p.date)}</span>
      </div>

      {p.state === 'scheduled' && p.sessionName && (
        <>
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[22px] font-black tracking-[-0.02em] text-white leading-tight">{p.sessionName}</div>
              <div className="text-[11px] text-white/50 mt-1">{p.exerciseCount} exercices · ~{p.estimatedMinutes} min</div>
              {p.musclePills && p.musclePills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.musclePills.slice(0, 3).map(pill => (
                    <span key={pill} className="bg-[#ffe01e]/10 text-[#ffe01e] text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-md">{pill}</span>
                  ))}
                </div>
              )}
            </div>
            {p.primaryMuscles && p.primaryMuscles.length > 0 && (
              <div className="shrink-0">
                <BodyMap
                  primaryGroups={new Set(p.primaryMuscles)}
                  secondaryGroups={new Set(p.secondaryMuscles ?? [])}
                  className="w-16 h-[96px]"
                />
              </div>
            )}
          </div>
          {p.sessionLogHref && (
            <Link
              href={p.sessionLogHref}
              className="mt-4 flex w-full items-center justify-center h-11 rounded-xl bg-[#ffe01e] text-[#0d0d0d] text-[11px] font-black uppercase tracking-[0.1em] active:scale-[0.98] transition-transform"
            >
              Démarrer →
            </Link>
          )}
        </>
      )}

      {p.state === 'completed' && (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 size={18} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="text-[12px] text-white font-semibold">Séance terminée</div>
            <div className="text-[10px] text-white/40">{p.performanceSummary}</div>
          </div>
          {p.recapHref && <Link href={p.recapHref} className="text-[11px] text-[#ffe01e]">Voir →</Link>}
        </div>
      )}

      {p.state === 'rest' && (
        <p className="text-[12px] text-white/55">Jour de repos 💤</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add components/client/smart/SmartWorkoutHero.tsx
git commit -m "feat(workout): redesign SmartWorkoutHero — bigger title, no date nav, muscle pills"
```

---

## Task 9 — Mise à jour CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Mettre à jour CHANGELOG.md**

Ajouter en tête du fichier sous la date `## 2026-05-19` :

```
FEATURE: Smart Workout redesign — SessionLogger liste scrollable style Motra
FEATURE: SetRow — inline editable avec swipe validate (droite) + delete (gauche)
FEATURE: SetTypeSelector — EC / Série principale / RC / Dégressive
FEATURE: ExerciseBlock — card exercice avec sets inline + context menu •••
FEATURE: ExerciseContextMenu + SupersetContextMenu — bottom sheets options
FEATURE: SmartWorkoutHero — titre 22px, suppression nav date, muscle pills
SCHEMA: add set_type column to client_set_logs (warmup/working/cooldown/dropset)
CHORE: remove SetSwipeCard.tsx and SetEditSheet.tsx
```

- [ ] **Step 2: Mettre à jour project-state.md**

Dans `.claude/rules/project-state.md`, ajouter dans "Dernières Avancées" :

```markdown
### 2026-05-19 — Smart Workout Redesign (Motra-style)
- `components/client/smart/SetRow.tsx` — row inline-editable, swipe droite=valider, swipe gauche=supprimer
- `components/client/smart/SetTypeSelector.tsx` — EC/Principal/RC/Dégressive sheet
- `components/client/smart/ExerciseBlock.tsx` — card exercice avec sets inline + footer Add Set
- `components/client/smart/ExerciseContextMenu.tsx` — options •••: échange, repos, note, tempo, supprimer
- `components/client/smart/SupersetContextMenu.tsx` — options •••: dissocier, repos, supprimer
- `app/client/programme/session/[sessionId]/SessionLogger.tsx` — refonte totale vers liste scrollable
- `components/client/smart/SmartWorkoutHero.tsx` — titre 22px, sans nav date, muscle pills
- `supabase/migrations/20260519_set_type.sql` — colonne set_type sur client_set_logs
- Supprimés : SetSwipeCard.tsx, SetEditSheet.tsx
- Conservé sans modification : live save, PR detection, SetRecommendation, RestTimer, tempo, hydration
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update changelog and project-state after smart workout redesign"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Task couvrant |
|---|---|
| SetRow inline editable + swipe | Task 2 |
| SetTypeSelector EC/RC/Dégressive | Task 3 |
| ExerciseContextMenu | Task 4 |
| SupersetContextMenu | Task 4 |
| ExerciseBlock + Add Set + Progression | Task 5 |
| SessionLogger header + liste scrollable | Task 6 |
| SessionContextMenu (•••) | Task 6 step 9 |
| Suppression SetSwipeCard + SetEditSheet | Task 7 |
| SmartWorkoutHero redesign | Task 8 |
| Migration set_type | Task 1 |
| CHANGELOG + project-state | Task 9 |

**Gaps identifiés et couverts :**
- Note inline textarea par exercice : géré via `showNoteInput` state existant dans SessionLogger (conservé), le toggle est câblé dans `onNote` de chaque ExerciseBlock.
- PR flash toast : conservé tel quel dans SessionLogger, aucun JSX supprimé de ce bloc.
- `RefreshCw` import dans SessionLogger step 9 : ajouter à la liste d'imports Lucide.
- `Clock` import dans SessionLogger step 9 : déjà importé dans le fichier existant.

**Type consistency check :**
- `SetRowData` exporté depuis `SetRow.tsx` = shape identique à `SetLog` dans SessionLogger. Le cast `s as SetRowData` en Task 6 est safe car tous les champs requis sont présents après l'ajout de `set_type` et `rest_sec` en step 2-3.
- `recKey()` définie identiquement dans SessionLogger ET ExerciseBlock — acceptable (fonction pure de 1 ligne, pas de module partagé nécessaire).
