# Studio-Lab UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactorer `ProgramTemplateBuilder` en layout dual-pane studio-grade (Navigator 16% | Editor 54% | Intelligence Panel 30%) avec Lab Mode visible par défaut, real-time intelligence debounce 300ms, et Intelligence Panel modulaire (dock/float/minimize).

**Architecture:** Le builder actuel (1110 lignes, fichier unique) est découpé en 4 composants distincts : `NavigatorPane`, `EditorPane`, `IntelligencePanel` (refactoré), et `LabModeSection`. Le `ProgramTemplateBuilder` devient un orchestrateur léger qui gère l'état global et les callbacks. Le layout est rendu par `react-resizable-panels` avec tailles persistées en localStorage. Le drag-drop sessions/exercices reste géré par `@dnd-kit`.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, `react-resizable-panels` v4.9.0 (déjà installé), `@dnd-kit/core` v6.3.1 + `@dnd-kit/sortable` v10.0.0 (déjà installés), `framer-motion` v11.18.2 (déjà installé), Recharts (déjà installé).

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `components/programs/ProgramTemplateBuilder.tsx` | Modifier | Orchestrateur : état global, callbacks, layout root avec PanelGroup |
| `components/programs/studio/NavigatorPane.tsx` | Créer | Liste des séances, arbre exercices, drag-drop sessions |
| `components/programs/studio/EditorPane.tsx` | Créer | Header meta template + cartes exercices + Lab Mode |
| `components/programs/studio/ExerciseCard.tsx` | Créer | Carte exercice 2-colonnes extraite du builder monolithique |
| `components/programs/studio/LabModeSection.tsx` | Créer | Section Lab Mode (debug stimulus, règles, morpho) |
| `components/programs/studio/IntelligencePanelShell.tsx` | Créer | Shell modulaire : dock/float/minimize — wraps ProgramIntelligencePanel |
| `components/programs/ProgramIntelligencePanel.tsx` | Modifier | Ajouter prop `compact?: boolean` pour mode minimisé |
| `lib/programs/intelligence/index.ts` | Modifier | Debounce 300ms (actuellement 400ms) |

---

## Task 1 : Debounce 300ms + hook morpho dans builder

**Files:**
- Modify: `lib/programs/intelligence/index.ts`
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

- [ ] **Step 1 : Lire le hook actuel**

```bash
grep -n "debounce\|400\|morpho" lib/programs/intelligence/index.ts
```

- [ ] **Step 2 : Modifier le debounce de 400ms → 300ms**

Dans `lib/programs/intelligence/index.ts`, repérer la ligne `setTimeout(..., 400)` et la remplacer par `300` :

```typescript
// Avant
const timer = setTimeout(() => {
  setResult(buildIntelligenceResult(sessions, meta, profile, morphoStimulusAdjustments))
}, 400)

// Après
const timer = setTimeout(() => {
  setResult(buildIntelligenceResult(sessions, meta, meta, profile, morphoStimulusAdjustments))
}, 300)
```

- [ ] **Step 3 : Ajouter le state morphoAdjustments dans ProgramTemplateBuilder**

Dans `ProgramTemplateBuilder.tsx`, après le state `intelligenceProfile` (ligne ~262) :

```typescript
const [morphoAdjustments, setMorphoAdjustments] = useState<Record<string, number> | undefined>(undefined);

useEffect(() => {
  if (!clientId) return
  fetch(`/api/clients/${clientId}/morpho/latest`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data?.data?.stimulus_adjustments) {
        setMorphoAdjustments(data.data.stimulus_adjustments)
      }
    })
    .catch(() => {})
}, [clientId])
```

- [ ] **Step 4 : Passer morphoAdjustments à useProgramIntelligence**

```typescript
// Avant (ligne ~304)
const { result: intelligenceResult, alertsFor } = useProgramIntelligence(intelligenceSessions, intelligenceMeta, intelligenceProfile);

// Après
const { result: intelligenceResult, alertsFor } = useProgramIntelligence(intelligenceSessions, intelligenceMeta, intelligenceProfile, morphoAdjustments);
```

- [ ] **Step 5 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "intelligence/index|ProgramTemplateBuilder" | head -20
```

Attendu : 0 erreurs sur ces fichiers.

- [ ] **Step 6 : Commit**

```bash
git add lib/programs/intelligence/index.ts components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(studio): debounce intelligence 300ms + morpho adjustments wired in builder"
```

---

## Task 2 : Créer NavigatorPane

**Files:**
- Create: `components/programs/studio/NavigatorPane.tsx`

Le `NavigatorPane` affiche la liste des séances avec leurs exercices en arbre. Il reçoit `sessions` en lecture seule et émet des callbacks pour sélectionner une séance/exercice (scroll dans l'éditeur), ajouter une séance, ou réordonner.

- [ ] **Step 1 : Créer le dossier studio**

```bash
mkdir -p components/programs/studio
```

- [ ] **Step 2 : Créer NavigatorPane.tsx**

```typescript
// components/programs/studio/NavigatorPane.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, GripVertical, Dumbbell } from 'lucide-react'

export interface NavSession {
  name: string
  exercises: { name: string }[]
}

interface Props {
  sessions: NavSession[]
  activeSessionIndex: number | null
  activeExerciseKey: string | null // format "si-ei"
  onSelectSession: (si: number) => void
  onSelectExercise: (si: number, ei: number) => void
  onAddSession: () => void
}

export default function NavigatorPane({
  sessions,
  activeSessionIndex,
  activeExerciseKey,
  onSelectSession,
  onSelectExercise,
  onAddSession,
}: Props) {
  const [expandedSessions, setExpandedSessions] = useState<Record<number, boolean>>(
    Object.fromEntries(sessions.map((_, i) => [i, true]))
  )

  function toggleSession(i: number) {
    setExpandedSessions(prev => ({ ...prev, [i]: !prev[i] }))
  }

  return (
    <div className="flex flex-col h-full bg-[#121212] border-r-[0.3px] border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b-[0.3px] border-white/[0.06] shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Séances
        </span>
        <button
          onClick={onAddSession}
          className="flex items-center gap-1 h-6 px-2 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/80 transition-colors"
        >
          <Plus size={11} />
          <span className="text-[10px] font-medium">Séance</span>
        </button>
      </div>

      {/* Session tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 && (
          <p className="text-[11px] text-white/25 text-center py-6 px-3">
            Aucune séance
          </p>
        )}
        {sessions.map((session, si) => {
          const isExpanded = expandedSessions[si] ?? true
          const isActive = activeSessionIndex === si

          return (
            <div key={si} className="mb-0.5">
              {/* Session row */}
              <button
                onClick={() => { onSelectSession(si); toggleSession(si) }}
                className={[
                  'w-full flex items-center gap-1.5 px-3 py-2 text-left transition-colors group',
                  isActive
                    ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
                    : 'text-white/70 hover:bg-white/[0.03] hover:text-white/90',
                ].join(' ')}
              >
                <GripVertical size={10} className="text-white/20 shrink-0" />
                {isExpanded
                  ? <ChevronDown size={11} className="shrink-0 opacity-50" />
                  : <ChevronRight size={11} className="shrink-0 opacity-50" />
                }
                <span className="text-[11px] font-medium truncate flex-1">
                  {session.name || `Séance ${si + 1}`}
                </span>
                <span className="text-[9px] text-white/25 shrink-0">
                  {session.exercises.length}
                </span>
              </button>

              {/* Exercises */}
              {isExpanded && session.exercises.map((ex, ei) => {
                const key = `${si}-${ei}`
                const isActiveEx = activeExerciseKey === key
                return (
                  <button
                    key={ei}
                    onClick={() => onSelectExercise(si, ei)}
                    className={[
                      'w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left transition-colors',
                      isActiveEx
                        ? 'bg-[#1f8a65]/5 text-[#1f8a65]/80'
                        : 'text-white/40 hover:bg-white/[0.02] hover:text-white/60',
                    ].join(' ')}
                  >
                    <Dumbbell size={9} className="shrink-0 opacity-60" />
                    <span className="text-[10px] truncate">
                      {ex.name || `Exercice ${ei + 1}`}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "studio/NavigatorPane" | head -10
```

Attendu : 0 erreurs.

- [ ] **Step 4 : Commit**

```bash
git add components/programs/studio/NavigatorPane.tsx
git commit -m "feat(studio): add NavigatorPane component — session tree with collapse/expand"
```

---

## Task 3 : Créer ExerciseCard extrait

**Files:**
- Create: `components/programs/studio/ExerciseCard.tsx`

Extraire la carte exercice (grille 2 colonnes, image 140px + détails) du builder monolithique pour la réutiliser dans `EditorPane`. La carte reçoit toutes les données exercice + callbacks de mutation.

- [ ] **Step 1 : Lire la carte exercice dans le builder actuel**

```bash
grep -n "grid grid-cols-\[140px" components/programs/ProgramTemplateBuilder.tsx
```

Repérer la ligne de début du `<div className="grid grid-cols-[140px_1fr]...">` pour chaque exercice.

- [ ] **Step 2 : Créer ExerciseCard.tsx**

```typescript
// components/programs/studio/ExerciseCard.tsx
'use client'

import { useRef } from 'react'
import Image from 'next/image'
import {
  Trash2, ImagePlus, Upload, Tag, Dumbbell,
} from 'lucide-react'
import IntelligenceAlertBadge from '@/components/programs/IntelligenceAlertBadge'
import ExerciseClientAlternatives from '@/components/programs/ExerciseClientAlternatives'
import type { IntelligenceAlert } from '@/lib/programs/intelligence'

const MOVEMENT_PATTERNS = [
  { value: '', label: '— Pattern —' },
  { value: 'horizontal_push', label: 'Poussée horiz.' },
  { value: 'vertical_push', label: 'Poussée vert.' },
  { value: 'horizontal_pull', label: 'Tirage horiz.' },
  { value: 'vertical_pull', label: 'Tirage vert.' },
  { value: 'squat_pattern', label: 'Squat' },
  { value: 'hip_hinge', label: 'Charnière hanche' },
  { value: 'knee_flexion', label: 'Flex. genou' },
  { value: 'knee_extension', label: 'Ext. genou' },
  { value: 'calf_raise', label: 'Mollets' },
  { value: 'elbow_flexion', label: 'Biceps' },
  { value: 'elbow_extension', label: 'Triceps' },
  { value: 'lateral_raise', label: 'Élév. lat.' },
  { value: 'carry', label: 'Carry' },
  { value: 'scapular_elevation', label: 'Shrug' },
  { value: 'core_anti_flex', label: 'Gainage' },
  { value: 'core_flex', label: 'Core flex.' },
  { value: 'core_rotation', label: 'Rotation' },
]

const EQUIPMENT_ITEMS = [
  { value: 'bodyweight', label: 'BW' },
  { value: 'band', label: 'Élas.' },
  { value: 'dumbbell', label: 'Halt.' },
  { value: 'barbell', label: 'Barre' },
  { value: 'kettlebell', label: 'KB' },
  { value: 'machine', label: 'Mach.' },
  { value: 'cable', label: 'Poulie' },
  { value: 'smith', label: 'Smith' },
  { value: 'trx', label: 'TRX' },
  { value: 'ez_bar', label: 'EZ' },
  { value: 'trap_bar', label: 'Trap' },
]

const MUSCLE_GROUPS = [
  { slug: 'chest', label: 'Pecto.' },
  { slug: 'shoulders', label: 'Épaules' },
  { slug: 'biceps', label: 'Biceps' },
  { slug: 'triceps', label: 'Triceps' },
  { slug: 'abs', label: 'Abdos' },
  { slug: 'back_upper', label: 'Dos (H)' },
  { slug: 'back_lower', label: 'Lombaires' },
  { slug: 'traps', label: 'Trapèzes' },
  { slug: 'quads', label: 'Quads' },
  { slug: 'hamstrings', label: 'Ischio.' },
  { slug: 'glutes', label: 'Fessiers' },
  { slug: 'calves', label: 'Mollets' },
]

export interface ExerciseData {
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  notes: string
  image_url: string | null
  movement_pattern: string | null
  equipment_required: string[]
  primary_muscles: string[]
  secondary_muscles: string[]
  is_compound: boolean | undefined
  group_id?: string
  dbId?: string
}

interface Props {
  exercise: ExerciseData
  si: number
  ei: number
  isHighlighted: boolean
  isUploading: boolean
  alerts: IntelligenceAlert[]
  templateId?: string
  onUpdate: (patch: Partial<ExerciseData>) => void
  onRemove: () => void
  onImageUpload: (file: File) => void
  onPickExercise: () => void
  onOpenAlternatives: () => void
  exerciseRef: (el: HTMLDivElement | null) => void
}

export default function ExerciseCard({
  exercise,
  si,
  ei,
  isHighlighted,
  isUploading,
  alerts,
  templateId,
  onUpdate,
  onRemove,
  onImageUpload,
  onPickExercise,
  onOpenAlternatives,
  exerciseRef,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div
      ref={exerciseRef}
      className={[
        'rounded-xl border-[0.3px] bg-white/[0.02] p-3 transition-all duration-200',
        isHighlighted
          ? 'border-[#1f8a65]/60 ring-1 ring-[#1f8a65]/30'
          : 'border-white/[0.06]',
      ].join(' ')}
    >
      <div className="grid grid-cols-[140px_1fr] gap-4">
        {/* Left column: image + pattern + equipment */}
        <div className="flex flex-col gap-2">
          {/* Image */}
          <div
            className="relative w-[140px] h-[140px] rounded-lg overflow-hidden bg-white/[0.03] border-[0.3px] border-white/[0.06] cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            {exercise.image_url ? (
              <Image
                src={exercise.image_url}
                alt={exercise.name}
                fill
                className="object-cover"
                unoptimized={exercise.image_url.endsWith('.gif')}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                <ImagePlus size={18} className="text-white/20" />
                <span className="text-[9px] text-white/20">Image</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload size={16} className="text-white" />
            </div>
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-[#1f8a65] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) onImageUpload(f)
              e.target.value = ''
            }}
          />

          {/* Movement pattern */}
          <select
            value={exercise.movement_pattern ?? ''}
            onChange={e => onUpdate({ movement_pattern: e.target.value || null })}
            className="w-full rounded-lg bg-[#0a0a0a] border-[0.3px] border-white/[0.06] text-[10px] text-white/60 px-2 py-1.5 outline-none"
          >
            {MOVEMENT_PATTERNS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Equipment pills */}
          <div className="flex flex-wrap gap-1">
            {EQUIPMENT_ITEMS.map(eq => {
              const active = exercise.equipment_required.includes(eq.value)
              return (
                <button
                  key={eq.value}
                  onClick={() => onUpdate({
                    equipment_required: active
                      ? exercise.equipment_required.filter(v => v !== eq.value)
                      : [...exercise.equipment_required, eq.value],
                  })}
                  className={[
                    'rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors',
                    active
                      ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
                      : 'bg-white/[0.03] text-white/30 hover:text-white/50',
                  ].join(' ')}
                >
                  {eq.label}
                </button>
              )
            })}
          </div>

          {/* Polyarticulaire toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={exercise.is_compound === true}
              onChange={e => onUpdate({ is_compound: e.target.checked ? true : undefined })}
              className="w-3 h-3 rounded accent-[#1f8a65]"
            />
            <span className="text-[9px] text-white/40">Polyart.</span>
          </label>
        </div>

        {/* Right column: name, sets/reps, muscles, notes */}
        <div className="flex flex-col gap-2 min-w-0">
          {/* Name + delete + pick */}
          <div className="flex items-center gap-2">
            <input
              value={exercise.name}
              onChange={e => onUpdate({ name: e.target.value })}
              placeholder={`Exercice ${ei + 1}`}
              className="flex-1 bg-transparent text-[13px] font-medium text-white placeholder:text-white/20 outline-none"
            />
            <button
              onClick={onPickExercise}
              title="Choisir depuis le catalogue"
              className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
            >
              <Tag size={13} />
            </button>
            <button
              onClick={onRemove}
              className="p-1 rounded-md text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Sets / Reps / Rest / RIR */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'Séries', value: String(exercise.sets), key: 'sets', type: 'number' },
              { label: 'Reps', value: exercise.reps, key: 'reps', type: 'text' },
              { label: 'Repos (s)', value: exercise.rest_sec != null ? String(exercise.rest_sec) : '', key: 'rest_sec', type: 'number' },
              { label: 'RIR', value: exercise.rir != null ? String(exercise.rir) : '', key: 'rir', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[9px] text-white/30 mb-0.5">{f.label}</label>
                <input
                  type={f.type}
                  value={f.value}
                  onChange={e => {
                    const v = e.target.value
                    if (f.key === 'sets') onUpdate({ sets: Number(v) || 1 })
                    else if (f.key === 'reps') onUpdate({ reps: v })
                    else if (f.key === 'rest_sec') onUpdate({ rest_sec: v ? Number(v) : null })
                    else if (f.key === 'rir') onUpdate({ rir: v ? Number(v) : null })
                  }}
                  className="w-full bg-[#0a0a0a] rounded-md border-[0.3px] border-white/[0.06] text-[11px] text-white/80 px-2 py-1 outline-none font-mono"
                />
              </div>
            ))}
          </div>

          {/* Primary muscles */}
          <div>
            <label className="block text-[9px] text-white/30 mb-1">Muscles primaires</label>
            <div className="flex flex-wrap gap-1">
              {MUSCLE_GROUPS.map(m => {
                const active = exercise.primary_muscles.includes(m.slug)
                return (
                  <button
                    key={m.slug}
                    onClick={() => onUpdate({
                      primary_muscles: active
                        ? exercise.primary_muscles.filter(s => s !== m.slug)
                        : [...exercise.primary_muscles, m.slug],
                    })}
                    className={[
                      'rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors',
                      active
                        ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
                        : 'bg-white/[0.03] text-white/25 hover:text-white/50',
                    ].join(' ')}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <textarea
            value={exercise.notes}
            onChange={e => onUpdate({ notes: e.target.value })}
            placeholder="Notes coach..."
            rows={2}
            className="w-full bg-[#0a0a0a] rounded-lg border-[0.3px] border-white/[0.06] text-[11px] text-white/60 placeholder:text-white/20 px-2 py-1.5 outline-none resize-none"
          />

          {/* Intelligence alerts + alternatives */}
          {alerts.length > 0 && (
            <IntelligenceAlertBadge
              alerts={alerts}
              onOpenAlternatives={onOpenAlternatives}
            />
          )}

          {/* Client alternatives (edit mode) */}
          {templateId && exercise.dbId && (
            <ExerciseClientAlternatives
              templateId={templateId}
              exerciseId={exercise.dbId}
            />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "studio/ExerciseCard" | head -10
```

Attendu : 0 erreurs.

- [ ] **Step 4 : Commit**

```bash
git add components/programs/studio/ExerciseCard.tsx
git commit -m "feat(studio): extract ExerciseCard component — 2-column layout, self-contained"
```

---

## Task 4 : Créer LabModeSection

**Files:**
- Create: `components/programs/studio/LabModeSection.tsx`

Section Lab Mode visible par défaut (toggle hide/show). Affiche le debug stimulus (coefficients par pattern), les règles actives (pourquoi chaque subscore = X/100), et les contrôles morpho (badge morpho connecté).

- [ ] **Step 1 : Créer LabModeSection.tsx**

```typescript
// components/programs/studio/LabModeSection.tsx
'use client'

import { useState } from 'react'
import { FlaskConical, ChevronDown, ChevronUp, Microscope, Info } from 'lucide-react'
import type { IntelligenceResult } from '@/lib/programs/intelligence'

interface Props {
  result: IntelligenceResult | null
  morphoConnected: boolean
  morphoDate?: string
}

const RULE_EXPLANATIONS: Record<string, string> = {
  balance: 'Ratio push/pull/jambes/core selon l\'objectif. Cible : ~40% jambes, 30% push+pull, 30% core pour hypertrophie.',
  recovery: 'Fenêtres SRA par groupe musculaire. Un muscle sollicité trop souvent avant récupération complète → pénalité.',
  specificity: 'Coefficient de stimulus moyen pondéré. Les exercices polyarticulaires avec charge lourde ont un coeff élevé.',
  progression: 'RIR semaine 1 doit être ≥1 (marge de progression). Un RIR=0 dès semaine 1 = risque de stagnation rapide.',
  redundancy: 'Exercices identiques (même pattern + mêmes muscles + coeff similaire) → volume dilué sans stimulus nouveau.',
  completeness: 'Patterns requis par objectif. Hypertrophie = push + pull + jambes + core. Manque → score incomplet.',
}

export default function LabModeSection({ result, morphoConnected, morphoDate }: Props) {
  const [visible, setVisible] = useState(true)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)

  return (
    <div className="mt-4 rounded-xl border-[0.3px] border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.03] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setVisible(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#8b5cf6]/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical size={13} className="text-[#8b5cf6]" />
          <span className="text-[11px] font-semibold text-[#8b5cf6]">Lab Mode</span>
          <span className="text-[9px] text-[#8b5cf6]/50 bg-[#8b5cf6]/10 px-1.5 py-0.5 rounded-full">
            BETA
          </span>
          {morphoConnected && (
            <span className="text-[9px] text-[#1f8a65] bg-[#1f8a65]/10 px-1.5 py-0.5 rounded-full">
              Morpho {morphoDate ? `(${morphoDate})` : 'connecté'}
            </span>
          )}
        </div>
        {visible
          ? <ChevronUp size={13} className="text-[#8b5cf6]/50" />
          : <ChevronDown size={13} className="text-[#8b5cf6]/50" />
        }
      </button>

      {visible && (
        <div className="px-4 pb-4 space-y-4">
          {/* Stimulus Debug */}
          {result && Object.keys(result.subscores).length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-2 flex items-center gap-1.5">
                <Microscope size={10} />
                Debug subscores
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(result.subscores).map(([key, score]) => (
                  <div key={key} className="rounded-lg bg-black/20 px-2 py-1.5">
                    <div className="text-[9px] text-white/35 mb-0.5 capitalize">
                      {key}
                    </div>
                    <div
                      className="text-[13px] font-bold font-mono"
                      style={{
                        color: score >= 75 ? '#1f8a65' : score >= 50 ? '#f59e0b' : '#ef4444',
                      }}
                    >
                      {Math.round(score)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rule Transparency */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-2 flex items-center gap-1.5">
              <Info size={10} />
              Règles actives
            </p>
            <div className="space-y-1">
              {Object.entries(RULE_EXPLANATIONS).map(([key, explanation]) => (
                <button
                  key={key}
                  onClick={() => setExpandedRule(expandedRule === key ? null : key)}
                  className="w-full text-left rounded-lg px-2.5 py-2 bg-black/10 hover:bg-black/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-white/60 capitalize">{key}</span>
                    {expandedRule === key
                      ? <ChevronUp size={10} className="text-white/25" />
                      : <ChevronDown size={10} className="text-white/25" />
                    }
                  </div>
                  {expandedRule === key && (
                    <p className="text-[10px] text-white/40 mt-1 leading-relaxed">
                      {explanation}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Morpho status */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-2">
              Morpho
            </p>
            {morphoConnected ? (
              <p className="text-[10px] text-[#1f8a65]/80">
                Ajustements morpho actifs — les coefficients stimulus sont modulés par les asymétries du client.
              </p>
            ) : (
              <p className="text-[10px] text-white/30">
                Aucune analyse morpho disponible — les coefficients utilisent les valeurs catalogue standards.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "studio/LabModeSection" | head -10
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/programs/studio/LabModeSection.tsx
git commit -m "feat(studio): add LabModeSection — rule transparency, subscore debug, morpho status"
```

---

## Task 5 : Créer IntelligencePanelShell (dock/float/minimize)

**Files:**
- Create: `components/programs/studio/IntelligencePanelShell.tsx`

Shell qui wrappe `ProgramIntelligencePanel` et ajoute les modes : docked (intégré dans le layout), floated (fenêtre flottante draggable), minimized (barre d'icônes compacte).

- [ ] **Step 1 : Créer IntelligencePanelShell.tsx**

```typescript
// components/programs/studio/IntelligencePanelShell.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { Minus, Maximize2, Move, X, PanelRight, Zap } from 'lucide-react'
import ProgramIntelligencePanel from '@/components/programs/ProgramIntelligencePanel'
import type { IntelligenceResult } from '@/lib/programs/intelligence'

type PanelMode = 'docked' | 'floating' | 'minimized'

interface Props {
  result: IntelligenceResult
  weeks: number
  onAlertClick: (si: number, ei: number) => void
}

export default function IntelligencePanelShell({ result, weeks, onAlertClick }: Props) {
  const [mode, setMode] = useState<PanelMode>('docked')
  const dragControls = useDragControls()

  // Minimized: compact score bar
  if (mode === 'minimized') {
    return (
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl bg-[#181818] border-[0.3px] border-white/[0.08] px-4 py-2.5 shadow-lg">
        <Zap size={13} className="text-[#1f8a65]" />
        <span
          className="text-[15px] font-bold font-mono"
          style={{
            color: result.globalScore >= 75 ? '#1f8a65' : result.globalScore >= 50 ? '#f59e0b' : '#ef4444',
          }}
        >
          {Math.round(result.globalScore)}
        </span>
        <span className="text-[10px] text-white/40">/100</span>
        <div className="w-px h-4 bg-white/[0.08] mx-1" />
        <button
          onClick={() => setMode('docked')}
          title="Ancrer le panneau"
          className="p-1 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
        >
          <PanelRight size={13} />
        </button>
        <button
          onClick={() => setMode('floating')}
          title="Fenêtre flottante"
          className="p-1 rounded hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
        >
          <Maximize2 size={13} />
        </button>
      </div>
    )
  }

  // Floating: draggable window
  if (mode === 'floating') {
    return (
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        initial={{ right: 24, top: 80, opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed z-40 w-[360px] max-h-[80vh] rounded-2xl bg-[#181818] border-[0.3px] border-white/[0.08] shadow-2xl overflow-hidden flex flex-col"
        style={{ right: 24, top: 80 }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={e => dragControls.start(e)}
          className="flex items-center justify-between px-4 py-2.5 border-b-[0.3px] border-white/[0.06] cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2">
            <Move size={12} className="text-white/25" />
            <span className="text-[11px] font-semibold text-white/60">Intelligence</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode('minimized')}
              className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors"
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => setMode('docked')}
              className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors"
            >
              <PanelRight size={12} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ProgramIntelligencePanel result={result} weeks={weeks} onAlertClick={onAlertClick} />
        </div>
      </motion.div>
    )
  }

  // Docked: standard panel (rendered inside PanelGroup by parent)
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b-[0.3px] border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-[#1f8a65]" />
          <span className="text-[11px] font-semibold text-white/70">Intelligence</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode('minimized')}
            title="Minimiser"
            className="p-1 rounded hover:bg-white/[0.06] text-white/25 hover:text-white/60 transition-colors"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={() => setMode('floating')}
            title="Détacher"
            className="p-1 rounded hover:bg-white/[0.06] text-white/25 hover:text-white/60 transition-colors"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ProgramIntelligencePanel result={result} weeks={weeks} onAlertClick={onAlertClick} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "studio/IntelligencePanelShell\|framer-motion" | head -10
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/programs/studio/IntelligencePanelShell.tsx
git commit -m "feat(studio): add IntelligencePanelShell — dock/float/minimize modes with framer-motion drag"
```

---

## Task 6 : Créer EditorPane

**Files:**
- Create: `components/programs/studio/EditorPane.tsx`

Le `EditorPane` contient le header de métadonnées du template (nom, objectif, niveau, fréquence, semaines) + la liste des séances avec leurs exercices via `ExerciseCard` + le `LabModeSection` en bas. Il reçoit tout l'état depuis `ProgramTemplateBuilder` via props et émet des callbacks.

- [ ] **Step 1 : Créer EditorPane.tsx**

```typescript
// components/programs/studio/EditorPane.tsx
'use client'

import { useRef } from 'react'
import { Plus, Loader2, Save, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import ExerciseCard, { type ExerciseData } from './ExerciseCard'
import LabModeSection from './LabModeSection'
import type { IntelligenceResult, IntelligenceAlert } from '@/lib/programs/intelligence'

const GOALS = [
  { value: 'hypertrophy', label: 'Hypertrophie' },
  { value: 'strength', label: 'Force' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'fat_loss', label: 'Perte de gras' },
  { value: 'recomp', label: 'Recomposition' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'athletic', label: 'Athletic' },
]

const LEVELS = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'advanced', label: 'Avancé' },
  { value: 'elite', label: 'Élite' },
]

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const EQUIPMENT_ARCHETYPES = [
  { value: '', label: '— Non spécifié —' },
  { value: 'bodyweight', label: 'Poids du corps' },
  { value: 'home_dumbbells', label: 'Domicile — Haltères' },
  { value: 'home_full', label: 'Domicile — Complet' },
  { value: 'home_rack', label: 'Rack à domicile' },
  { value: 'functional_box', label: 'Box / Fonctionnel' },
  { value: 'commercial_gym', label: 'Salle de sport' },
]

export interface TemplateMeta {
  name: string
  description: string
  goal: string
  level: string
  frequency: number
  weeks: number
  notes: string
  equipment_archetype: string
  muscle_tags: string[]
}

export interface EditorSession {
  name: string
  day_of_week: number | null
  notes: string
  exercises: ExerciseData[]
  open: boolean
}

interface Props {
  meta: TemplateMeta
  sessions: EditorSession[]
  saving: boolean
  error: string
  uploadingKey: string | null
  highlightKey: string | null
  intelligenceResult: IntelligenceResult | null
  morphoConnected: boolean
  morphoDate?: string
  templateId?: string
  alertsFor: (si: number, ei: number) => IntelligenceAlert[]
  onMetaChange: (patch: Partial<TemplateMeta>) => void
  onUpdateSession: (si: number, patch: Partial<EditorSession>) => void
  onUpdateExercise: (si: number, ei: number, patch: Partial<ExerciseData>) => void
  onRemoveExercise: (si: number, ei: number) => void
  onAddExercise: (si: number) => void
  onRemoveSession: (si: number) => void
  onAddSession: () => void
  onImageUpload: (si: number, ei: number, file: File) => void
  onPickExercise: (si: number, ei: number) => void
  onOpenAlternatives: (si: number, ei: number) => void
  onSave: () => void
  exerciseRefSetter: (key: string) => (el: HTMLDivElement | null) => void
}

export default function EditorPane({
  meta,
  sessions,
  saving,
  error,
  uploadingKey,
  highlightKey,
  intelligenceResult,
  morphoConnected,
  morphoDate,
  templateId,
  alertsFor,
  onMetaChange,
  onUpdateSession,
  onUpdateExercise,
  onRemoveExercise,
  onAddExercise,
  onRemoveSession,
  onAddSession,
  onImageUpload,
  onPickExercise,
  onOpenAlternatives,
  onSave,
  exerciseRefSetter,
}: Props) {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#121212]">
      {/* Sticky sub-header: template meta + save button */}
      <div className="shrink-0 border-b-[0.3px] border-white/[0.06] px-6 py-3 space-y-3">
        {/* Name + Save */}
        <div className="flex items-center gap-3">
          <input
            value={meta.name}
            onChange={e => onMetaChange({ name: e.target.value })}
            placeholder="Nom du template..."
            className="flex-1 bg-transparent text-[15px] font-semibold text-white placeholder:text-white/20 outline-none"
          />
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 h-8 px-4 rounded-lg bg-[#1f8a65] text-white text-[12px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors active:scale-[0.97]"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={meta.goal}
            onChange={e => onMetaChange({ goal: e.target.value })}
            className="h-7 rounded-lg bg-[#0a0a0a] border-[0.3px] border-white/[0.06] text-[11px] text-white/70 px-2 outline-none"
          >
            {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <select
            value={meta.level}
            onChange={e => onMetaChange({ level: e.target.value })}
            className="h-7 rounded-lg bg-[#0a0a0a] border-[0.3px] border-white/[0.06] text-[11px] text-white/70 px-2 outline-none"
          >
            {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <select
            value={meta.equipment_archetype}
            onChange={e => onMetaChange({ equipment_archetype: e.target.value })}
            className="h-7 rounded-lg bg-[#0a0a0a] border-[0.3px] border-white/[0.06] text-[11px] text-white/70 px-2 outline-none"
          >
            {EQUIPMENT_ARCHETYPES.map(eq => <option key={eq.value} value={eq.value}>{eq.label}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={meta.frequency}
              onChange={e => onMetaChange({ frequency: Number(e.target.value) || 1 })}
              min={1} max={7}
              className="w-10 h-7 bg-[#0a0a0a] rounded-lg border-[0.3px] border-white/[0.06] text-[11px] text-white/70 px-2 outline-none font-mono text-center"
            />
            <span className="text-[10px] text-white/30">j/sem</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={meta.weeks}
              onChange={e => onMetaChange({ weeks: Number(e.target.value) || 1 })}
              min={1} max={52}
              className="w-10 h-7 bg-[#0a0a0a] rounded-lg border-[0.3px] border-white/[0.06] text-[11px] text-white/70 px-2 outline-none font-mono text-center"
            />
            <span className="text-[10px] text-white/30">semaines</span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border-[0.3px] border-red-500/20 px-3 py-2">
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <p className="text-[12px] text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Sessions + exercises scroll area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {sessions.map((session, si) => (
          <div
            key={si}
            className="rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.01] overflow-hidden"
          >
            {/* Session header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b-[0.3px] border-white/[0.06]">
              <button
                onClick={() => onUpdateSession(si, { open: !session.open })}
                className="p-0.5 text-white/30 hover:text-white/60 transition-colors"
              >
                {session.open
                  ? <ChevronUp size={14} />
                  : <ChevronDown size={14} />
                }
              </button>
              <input
                value={session.name}
                onChange={e => onUpdateSession(si, { name: e.target.value })}
                placeholder={`Séance ${si + 1}`}
                className="flex-1 bg-transparent text-[13px] font-semibold text-white placeholder:text-white/30 outline-none"
              />
              {/* Day of week */}
              <div className="flex items-center gap-1">
                {DAYS.map((d, idx) => (
                  <button
                    key={idx}
                    onClick={() => onUpdateSession(si, { day_of_week: session.day_of_week === idx + 1 ? null : idx + 1 })}
                    className={[
                      'w-7 h-7 rounded-md text-[9px] font-medium transition-colors',
                      session.day_of_week === idx + 1
                        ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
                        : 'text-white/25 hover:text-white/50 hover:bg-white/[0.04]',
                    ].join(' ')}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button
                onClick={() => onRemoveSession(si)}
                className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors text-[11px]"
              >
                ×
              </button>
            </div>

            {/* Exercises */}
            {session.open && (
              <div className="p-4 space-y-3">
                {session.exercises.map((ex, ei) => (
                  <ExerciseCard
                    key={ei}
                    exercise={ex}
                    si={si}
                    ei={ei}
                    isHighlighted={highlightKey === `${si}-${ei}`}
                    isUploading={uploadingKey === `${si}-${ei}`}
                    alerts={alertsFor(si, ei)}
                    templateId={templateId}
                    onUpdate={patch => onUpdateExercise(si, ei, patch)}
                    onRemove={() => onRemoveExercise(si, ei)}
                    onImageUpload={file => onImageUpload(si, ei, file)}
                    onPickExercise={() => onPickExercise(si, ei)}
                    onOpenAlternatives={() => onOpenAlternatives(si, ei)}
                    exerciseRef={exerciseRefSetter(`${si}-${ei}`)}
                  />
                ))}
                <button
                  onClick={() => onAddExercise(si)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-[0.3px] border-dashed border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/[0.15] transition-colors text-[11px]"
                >
                  <Plus size={12} />
                  Ajouter un exercice
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add session */}
        <button
          onClick={onAddSession}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-[0.3px] border-dashed border-white/[0.06] text-white/25 hover:text-white/50 hover:border-white/[0.12] transition-colors text-[12px]"
        >
          <Plus size={13} />
          Ajouter une séance
        </button>

        {/* Lab Mode */}
        <LabModeSection
          result={intelligenceResult}
          morphoConnected={morphoConnected}
          morphoDate={morphoDate}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "studio/EditorPane" | head -10
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/programs/studio/EditorPane.tsx
git commit -m "feat(studio): add EditorPane — template meta header + session list + LabMode integration"
```

---

## Task 7 : Refactorer ProgramTemplateBuilder vers layout dual-pane

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

C'est la tâche d'intégration principale. Le builder actuel (1110 lignes) est remplacé par un orchestrateur léger qui :
1. Conserve tout l'état (`meta`, `sessions`, `intelligenceProfile`, `morphoAdjustments`, etc.)
2. Conserve toutes les fonctions (`updateExercise`, `handleSave`, `handleImageUpload`, etc.)
3. Remplace le JSX de rendu par un `PanelGroup` avec NavigatorPane + EditorPane + IntelligencePanelShell
4. Conserve `ExercisePicker` et `ExerciseAlternativesDrawer` comme overlays modaux

- [ ] **Step 1 : Lire la fin du builder (JSX de rendu)**

```bash
grep -n "return (" components/programs/ProgramTemplateBuilder.tsx | tail -5
```

Puis lire à partir de cette ligne pour voir la structure de rendu actuelle.

- [ ] **Step 2 : Ajouter les imports manquants en haut du builder**

```typescript
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import NavigatorPane from './studio/NavigatorPane'
import EditorPane from './studio/EditorPane'
import IntelligencePanelShell from './studio/IntelligencePanelShell'
```

- [ ] **Step 3 : Ajouter le state morphoAdjustments (si Task 1 déjà faite, skip)**

Si Task 1 déjà appliquée, passer à Step 4. Sinon :

```typescript
const [morphoAdjustments, setMorphoAdjustments] = useState<Record<string, number> | undefined>(undefined)

useEffect(() => {
  if (!clientId) return
  fetch(`/api/clients/${clientId}/morpho/latest`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data?.data?.stimulus_adjustments) setMorphoAdjustments(data.data.stimulus_adjustments)
    })
    .catch(() => {})
}, [clientId])
```

- [ ] **Step 4 : Ajouter la fonction removeSession**

Si absente dans le builder actuel :

```typescript
function removeSession(si: number) {
  setSessions(prev => prev.filter((_, i) => i !== si))
}
```

- [ ] **Step 5 : Ajouter exerciseRefSetter helper**

```typescript
function exerciseRefSetter(key: string) {
  return (el: HTMLDivElement | null) => {
    exerciseRefs.current[key] = el
  }
}
```

- [ ] **Step 6 : Remplacer le JSX return par le layout dual-pane**

Trouver le `return (` final du composant et remplacer tout le JSX par :

```typescript
  const morphoConnected = !!morphoAdjustments && Object.keys(morphoAdjustments).length > 0

  const navSessions = sessions.map(s => ({
    name: s.name,
    exercises: s.exercises.map(e => ({ name: e.name })),
  }))

  return (
    <div className="h-full flex flex-col bg-[#121212]">
      {/* Morpho chip */}
      {clientId && morphoConnected && (
        <div className="shrink-0 flex items-center justify-end px-4 py-1 border-b-[0.3px] border-white/[0.04]">
          <span className="text-[9px] text-[#1f8a65] bg-[#1f8a65]/10 px-2 py-0.5 rounded-full">
            Profil morpho appliqué
          </span>
        </div>
      )}

      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* Navigator — 16% */}
        <Panel defaultSize={16} minSize={12} maxSize={25} id="navigator" order={1}>
          <NavigatorPane
            sessions={navSessions}
            activeSessionIndex={null}
            activeExerciseKey={highlightKey}
            onSelectSession={si => {
              const el = exerciseRefs.current[`${si}-0`]
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            onSelectExercise={(si, ei) => handleAlertClick(si, ei)}
            onAddSession={() => setSessions(prev => [...prev, emptySession()])}
          />
        </Panel>

        <PanelResizeHandle className="w-px bg-white/[0.06] hover:bg-[#1f8a65]/40 transition-colors cursor-col-resize" />

        {/* Editor — 54% */}
        <Panel defaultSize={54} minSize={40} id="editor" order={2}>
          <EditorPane
            meta={meta}
            sessions={sessions}
            saving={saving}
            error={error}
            uploadingKey={uploadingKey}
            highlightKey={highlightKey}
            intelligenceResult={intelligenceResult}
            morphoConnected={morphoConnected}
            templateId={templateId}
            alertsFor={alertsFor}
            onMetaChange={patch => setMeta(m => ({ ...m, ...patch }))}
            onUpdateSession={updateSession}
            onUpdateExercise={updateExercise}
            onRemoveExercise={removeExercise}
            onAddExercise={addExercise}
            onRemoveSession={removeSession}
            onAddSession={() => setSessions(prev => [...prev, emptySession()])}
            onImageUpload={handleImageUpload}
            onPickExercise={(si, ei) => setPickerTarget({ si, ei })}
            onOpenAlternatives={(si, ei) => setAlternativesTarget({ si, ei })}
            onSave={handleSave}
            exerciseRefSetter={exerciseRefSetter}
          />
        </Panel>

        <PanelResizeHandle className="w-px bg-white/[0.06] hover:bg-[#1f8a65]/40 transition-colors cursor-col-resize" />

        {/* Intelligence Panel — 30% */}
        <Panel defaultSize={30} minSize={20} maxSize={40} id="intelligence" order={3}>
          <IntelligencePanelShell
            result={intelligenceResult}
            weeks={meta.weeks}
            onAlertClick={handleAlertClick}
          />
        </Panel>
      </PanelGroup>

      {/* Overlays */}
      {pickerTarget && (
        <ExercisePicker
          onSelect={(name, isCompound) => {
            updateExercise(pickerTarget.si, pickerTarget.ei, { name, is_compound: isCompound })
            setPickerTarget(null)
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}

      {alternativesTarget && intelligenceResult && (
        <ExerciseAlternativesDrawer
          exercise={sessions[alternativesTarget.si]?.exercises[alternativesTarget.ei]}
          sessionMeta={intelligenceMeta}
          allExercises={intelligenceSessions.flatMap(s => s.exercises)}
          onReplace={(name) => {
            updateExercise(alternativesTarget.si, alternativesTarget.ei, { name, is_compound: undefined })
            setAlternativesTarget(null)
          }}
          onClose={() => setAlternativesTarget(null)}
        />
      )}
    </div>
  )
```

- [ ] **Step 7 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Corriger toute erreur liée à l'intégration. Les erreurs pré-existantes (Stripe, BodyFatCalculator) sont à ignorer.

- [ ] **Step 8 : Vérifier que les pages routes fonctionnent**

```bash
grep -rn "ProgramTemplateBuilder" app/ --include="*.tsx" | head -5
```

Les routes `/coach/programs/templates/new` et `/coach/programs/templates/[templateId]/edit` doivent toujours fonctionner sans modification.

- [ ] **Step 9 : Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(studio): refactor ProgramTemplateBuilder to dual-pane layout — Navigator + Editor + Intelligence Panel"
```

---

## Task 8 : CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1 : Mettre à jour CHANGELOG.md**

Ajouter en haut du fichier sous la date du jour :

```markdown
## 2026-04-19

FEATURE: Studio-Lab dual-pane layout — NavigatorPane (16%) + EditorPane (54%) + IntelligencePanel (30%)
FEATURE: NavigatorPane — session tree, collapse/expand, click-to-scroll
FEATURE: ExerciseCard — extracted component, 2-column layout (140px image + details)
FEATURE: LabModeSection — visible by default, subscore debug, rule transparency, morpho status
FEATURE: IntelligencePanelShell — dock/float/minimize with framer-motion drag
FEATURE: EditorPane — template meta header, session list with day picker, add session/exercise
FEATURE: ProgramTemplateBuilder — refactored to orchestrator, react-resizable-panels layout
FEATURE: Morpho adjustments wired to useProgramIntelligence via /api/clients/[clientId]/morpho/latest
CHORE: Intelligence debounce reduced from 400ms to 300ms
```

- [ ] **Step 2 : Mettre à jour project-state.md**

Ajouter une section datée avec les fichiers créés, les points de vigilance, et cocher les next steps Phase 1 accomplis.

- [ ] **Step 3 : Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for Phase 1 Studio-Lab UI"
```

---

## Self-Review

### Couverture spec

| Requirement master plan | Tâche couverte |
|------------------------|----------------|
| Dual-pane Navigator 16% / Editor 54% / Intelligence 30% | Task 7 (PanelGroup) |
| Lab Mode visible par défaut | Task 4 (LabModeSection, `visible=true` par défaut) |
| Real-time intelligence debounce 300ms | Task 1 |
| Intelligence Panel dock/float/minimize | Task 5 (IntelligencePanelShell) |
| Morpho adjustments connectés au builder | Task 1 |
| ExerciseCard 2-colonnes extrait | Task 3 |
| NavigatorPane liste séances/exercices | Task 2 |
| DS v2.0 `#121212`, `#1f8a65`, `border-white/[0.06]` | Toutes les tâches |

### Points de vigilance

- `react-resizable-panels` v4.9.0 : `Panel` requiert `id` + `order` props (sinon warning sur SSR)
- `framer-motion` `drag` sur `IntelligencePanelShell` : le `dragConstraints` n'est pas défini → la fenêtre peut sortir de l'écran. Acceptable pour MVP.
- `intelligenceResult` peut être `null` au premier render (avant le debounce 300ms) — `IntelligencePanelShell` et `EditorPane` doivent gérer `null`
- Le builder actuel n'a pas de `removeSession` — Task 7 Step 4 l'ajoute
- `exerciseRefSetter` est un helper qui crée une closure — il doit être stable (pas recréé à chaque render). Si besoin de perf : `useCallback`
- La déduplication des constants (MOVEMENT_PATTERNS, EQUIPMENT_ITEMS, MUSCLE_GROUPS) dans ExerciseCard vs le builder original : les deux définissent ces listes. Une fois l'extraction faite, supprimer les définitions dans le builder original pour éviter la duplication.
