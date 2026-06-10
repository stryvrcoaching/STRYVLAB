# Client Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la grille 2 colonnes du dashboard client par un layout full-width vertical avec Hero Snapshot, alertes regroupées, séance, nutrition et timeline.

**Architecture:** 2 nouveaux composants (`DashboardHeroSnapshot`, `DashboardAlertsFeed`) + refactor `SmartNutritionWidget` (suppr compact, ajout régularités) + refactor `SmartWorkoutWidget` (suppr compact) + refactor `page.tsx` (layout + nouvelle query nutrition 7j).

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Framer Motion, Supabase, DS v3.0 tokens

---

## File Map

| Action | Fichier | Responsabilité |
|--------|---------|----------------|
| Create | `components/client/smart/DashboardHeroSnapshot.tsx` | 4 stats clés journée |
| Create | `components/client/smart/DashboardAlertsFeed.tsx` | Toutes alertes regroupées |
| Modify | `components/client/smart/SmartWorkoutWidget.tsx` | Suppr prop `compact` |
| Modify | `components/client/smart/SmartNutritionWidget.tsx` | Suppr `compact`, ajout régularités |
| Modify | `app/client/page.tsx` | Layout + query nutrition 7j + props |

---

### Task 1: DashboardHeroSnapshot — nouveau composant

**Files:**
- Create: `components/client/smart/DashboardHeroSnapshot.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/client/smart/DashboardHeroSnapshot.tsx
'use client'

export type DashboardHeroSnapshotProps = {
  kcalRemaining: number | null   // null = pas de protocole nutrition
  sessionState: 'scheduled' | 'completed' | 'rest' | 'no_program'
  sessionName: string | null
  waterMl: number
  waterTargetMl: number
  streak: number
  date: string  // ex: "Mer. 21 mai"
}

export default function DashboardHeroSnapshot({
  kcalRemaining,
  sessionState,
  sessionName,
  waterMl,
  waterTargetMl,
  streak,
  date,
}: DashboardHeroSnapshotProps) {
  const kcalDisplay = kcalRemaining === null
    ? '—'
    : kcalRemaining < 0
      ? `${Math.abs(Math.round(kcalRemaining))}`
      : String(Math.round(kcalRemaining))
  const kcalColor = kcalRemaining !== null && kcalRemaining < 0 ? '#ef4444' : 'white'

  const sessionDisplay = (() => {
    if (sessionState === 'completed') return `✓ ${sessionName ?? 'Séance'}`
    if (sessionState === 'scheduled') return sessionName ?? 'Séance'
    if (sessionState === 'rest') return 'Repos'
    return '—'
  })()

  const waterDisplay = `${(waterMl / 1000).toFixed(1)}L`
  const waterTarget = `${(waterTargetMl / 1000).toFixed(1)}L`

  const stats = [
    {
      value: kcalDisplay,
      label: kcalRemaining !== null && kcalRemaining < 0 ? 'kcal dépassées' : 'kcal rest.',
      color: kcalColor,
    },
    {
      value: sessionDisplay,
      label: sessionState === 'completed' ? 'Complétée' : 'Séance',
      color: sessionState === 'completed' ? '#ffe01e' : 'white',
    },
    {
      value: waterDisplay,
      label: `/ ${waterTarget}`,
      color: 'white',
    },
    {
      value: streak > 0 ? `${streak}j` : '0j',
      label: 'streak',
      color: streak > 0 ? '#ffe01e' : 'rgba(255,255,255,0.35)',
    },
  ]

  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] px-5 py-4">
      <p className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[9px] text-white/30 mb-3">
        {date}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span
              className="font-black font-mono leading-none text-[16px] tabular-nums"
              style={{ color: s.color }}
            >
              {s.value}
            </span>
            <span className="text-[8px] text-white/35 uppercase tracking-[0.08em] text-center leading-tight">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "DashboardHeroSnapshot"
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/DashboardHeroSnapshot.tsx
git commit -m "feat(dashboard): DashboardHeroSnapshot — 4 stats hero plein largeur"
```

---

### Task 2: DashboardAlertsFeed — nouveau composant

**Files:**
- Create: `components/client/smart/DashboardAlertsFeed.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/client/smart/DashboardAlertsFeed.tsx
'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Info, MessageSquare, X } from 'lucide-react'
import { computeRecoveryAlerts, type CheckinData } from '@/lib/client/smart/recoveryAlerts'
import type { GenericAlert } from './SmartAlertsFeed'
import type { Notification } from '../NotificationsBar'
import type { NutritionMacros } from './SmartNutritionWidget'

type UnifiedAlert = {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  body?: string
}

function toUnified(a: GenericAlert): UnifiedAlert {
  return { id: a.code, severity: a.severity, title: a.title, body: a.body }
}

const SEVERITY_STYLE: Record<string, { bg: string; text: string; Icon: React.ElementType }> = {
  critical: { bg: 'bg-red-500/10',   text: 'text-red-400',   Icon: AlertCircle },
  warning:  { bg: 'bg-amber-500/10', text: 'text-amber-400', Icon: AlertTriangle },
  info:     { bg: 'bg-cyan-500/10',  text: 'text-cyan-400',  Icon: Info },
  coach:    { bg: 'bg-[#ffe01e]/10', text: 'text-[#ffe01e]', Icon: MessageSquare },
}

export type DashboardAlertsFeedProps = {
  coachNotifications: Notification[]
  morningCheckin: CheckinData | null
  workoutAlerts: GenericAlert[]
  consumed: NutritionMacros
  target: NutritionMacros
  plannedSessionToday: boolean
}

export default function DashboardAlertsFeed({
  coachNotifications,
  morningCheckin,
  workoutAlerts,
  consumed,
  target,
  plannedSessionToday,
}: DashboardAlertsFeedProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const key = `dashboard_alerts_dismissed_${new Date().toISOString().split('T')[0]}`
    try {
      const stored = localStorage.getItem(key)
      if (stored) setDismissed(new Set(JSON.parse(stored)))
    } catch { /* ignore */ }
  }, [])

  function dismiss(id: string) {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    const key = `dashboard_alerts_dismissed_${new Date().toISOString().split('T')[0]}`
    localStorage.setItem(key, JSON.stringify(Array.from(next)))
  }

  // ── Build unified alert list ────────────────────────────────────────────────
  const alerts: (UnifiedAlert & { dismissable?: boolean })[] = []

  // 1. Coach notifications (highest priority)
  for (const n of coachNotifications) {
    alerts.push({ id: `coach_${n.id}`, severity: 'info' as const, title: n.title, body: n.body ?? undefined, dismissable: false })
  }

  // 2. Recovery alerts
  const recoveryAlerts = computeRecoveryAlerts(morningCheckin, plannedSessionToday)
  for (const r of recoveryAlerts) {
    if (r.type === 'recovery_ok' || r.type === 'optimal') continue
    alerts.push({ id: r.id, severity: r.severity, title: r.title, body: r.body, dismissable: true })
  }

  // 3. Workout alerts
  for (const a of workoutAlerts) {
    alerts.push({ ...toUnified(a), dismissable: true })
  }

  // 4. Nutrition alerts (inline computation)
  const hour = new Date().getHours()
  if (hour >= 14 && target.protein_g > 0 && consumed.protein_g < target.protein_g * 0.5) {
    alerts.push({
      id: 'nutrition_protein_late',
      severity: 'warning',
      title: 'Protéines en retard',
      body: `${Math.round(consumed.protein_g)}g / ${target.protein_g}g — pense à une source protéinée`,
      dismissable: true,
    })
  }
  if (hour >= 12 && target.water_ml > 0 && consumed.water_ml < target.water_ml * 0.4) {
    alerts.push({
      id: 'nutrition_water_low',
      severity: 'warning',
      title: 'Hydratation faible',
      body: `${(consumed.water_ml / 1000).toFixed(1)}L / ${(target.water_ml / 1000).toFixed(1)}L`,
      dismissable: true,
    })
  }

  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  const shown = expanded ? visible : visible.slice(0, 4)
  const remaining = visible.length - 4

  return (
    <div className="space-y-2">
      {shown.map(a => {
        const isCoach = a.id.startsWith('coach_')
        const cfg = SEVERITY_STYLE[isCoach ? 'coach' : a.severity]
        return (
          <div
            key={a.id}
            className="bg-[#161616] rounded-2xl border border-white/[0.08] p-3 flex items-start gap-3"
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
              <cfg.Icon size={15} className={cfg.text} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white leading-tight">{a.title}</p>
              {a.body && <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{a.body}</p>}
            </div>
            {a.dismissable && (
              <button
                onClick={() => dismiss(a.id)}
                className="shrink-0 w-6 h-6 flex items-center justify-center text-white/20 hover:text-white/50 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}
      {!expanded && remaining > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-center text-[10px] font-bold uppercase tracking-[0.1em] text-white/30 hover:text-white/60 py-1 transition-colors"
        >
          +{remaining} alerte{remaining > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "DashboardAlertsFeed"
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/DashboardAlertsFeed.tsx
git commit -m "feat(dashboard): DashboardAlertsFeed — alertes unifiées (coach + recovery + workout + nutrition)"
```

---

### Task 3: SmartWorkoutWidget — supprimer prop compact

**Files:**
- Modify: `components/client/smart/SmartWorkoutWidget.tsx`

- [ ] **Step 1: Supprimer `compact` prop et toute logique conditionnelle**

Remplacer le contenu entier de `SmartWorkoutWidget.tsx` :

```tsx
// components/client/smart/SmartWorkoutWidget.tsx
'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import BodyMap from '../BodyMap'
import type { MuscleGroup } from '@/lib/client/muscleDetection'

export type SmartWorkoutWidgetProps = {
  state: 'scheduled' | 'rest' | 'no_program'
  session?: {
    id: string
    sessionLogHref: string
    name: string
    exerciseCount: number
    estimatedMinutes: number
    primaryMuscles: MuscleGroup[]
    secondaryMuscles: MuscleGroup[]
    musclePills: string[]
  }
}

export default function SmartWorkoutWidget({ state, session }: SmartWorkoutWidgetProps) {
  if (state === 'rest') {
    return (
      <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-5">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/30 mb-2">Séance du jour</div>
        <p className="text-[14px] font-semibold text-white/50">Repos 💤</p>
        <p className="text-[11px] text-white/30 mt-1">Profite de la récupération</p>
        <Link href="/client" className="inline-block mt-3 text-[10px] text-[#ffe01e] uppercase tracking-[0.1em] font-bold">+ Activité →</Link>
      </div>
    )
  }

  if (state === 'no_program' || !session) {
    return (
      <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-5">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/30 mb-2">Séance du jour</div>
        <p className="text-[14px] font-semibold text-white/50">Pas de programme.</p>
        <p className="text-[11px] text-white/30 mt-1">Contacte ton coach.</p>
      </div>
    )
  }

  return (
    <Link
      href="/client/programme"
      className="block bg-[#161616] rounded-2xl border border-white/[0.08] p-5 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/30">Séance du jour</span>
        <ChevronRight size={14} className="text-white/30" />
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-white leading-tight">{session.name}</div>
          <div className="text-[11px] text-white/40 mt-1">{session.exerciseCount} ex · ~{session.estimatedMinutes}min</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {session.musclePills.slice(0, 3).map(p => (
              <span key={p} className="bg-[#ffe01e]/10 text-[#ffe01e] text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-md">{p}</span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between w-full h-9 rounded-xl bg-[#ffe01e]/10 border border-[#ffe01e]/20 px-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#ffe01e]">Démarrer</span>
            <ChevronRight size={13} className="text-[#ffe01e]" />
          </div>
        </div>
        <div className="w-20 shrink-0 flex items-center justify-center">
          <BodyMap
            primaryGroups={new Set(session.primaryMuscles)}
            secondaryGroups={new Set(session.secondaryMuscles)}
            className="w-20 h-[120px]"
          />
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "SmartWorkoutWidget"
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/SmartWorkoutWidget.tsx
git commit -m "refactor(dashboard): SmartWorkoutWidget — full-width, suppr compact prop"
```

---

### Task 4: SmartNutritionWidget — supprimer compact, ajouter régularités

**Files:**
- Modify: `components/client/smart/SmartNutritionWidget.tsx`

- [ ] **Step 1: Ajouter prop `proteinStreakDays` et supprimer `compact`**

Remplacer le contenu entier de `SmartNutritionWidget.tsx` :

```tsx
// components/client/smart/SmartNutritionWidget.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import QuickWaterModal from '../QuickWaterModal'

export type NutritionMacros = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_ml: number
}

export type SmartNutritionWidgetProps = {
  consumed: NutritionMacros
  target: NutritionMacros
  proteinStreakDays?: number  // jours consécutifs (sur 7) où protéines ≥ 80% cible
}

const MACROS = [
  { key: 'protein_g',  label: 'Protéines', color: '#4a90e2' },
  { key: 'carbs_g',    label: 'Glucides',  color: '#22c55e' },
  { key: 'fat_g',      label: 'Lipides',   color: '#f59e0b' },
] as const

export default function SmartNutritionWidget({ consumed, target, proteinStreakDays }: SmartNutritionWidgetProps) {
  const [waterOpen, setWaterOpen] = useState(false)
  const [waterDelta, setWaterDelta] = useState(0)
  const effectiveWaterMl = consumed.water_ml + waterDelta

  const kcalPct = target.kcal > 0 ? Math.min(1, consumed.kcal / target.kcal) : 0
  const r = 80
  const arcTotal = Math.PI * r
  const arcOffset = arcTotal * (1 - kcalPct)

  return (
    <>
      <QuickWaterModal
        open={waterOpen}
        onClose={() => setWaterOpen(false)}
        onLogged={ml => setWaterDelta(d => d + ml)}
      />
      <Link
        href="/client/nutrition"
        className="block bg-[#161616] rounded-2xl border border-white/[0.08] p-5 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-baseline justify-between mb-3">
          <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/30">Nutrition</span>
          <span className="text-[10px] font-semibold text-[#ffe01e]">→</span>
        </div>

        {/* Arc demi-cercle */}
        <div className="relative" style={{ height: 110 }}>
          <svg viewBox="0 0 200 110" className="w-full h-full">
            <path
              d={`M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={12}
              strokeLinecap="round"
            />
            <path
              d={`M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`}
              fill="none"
              stroke="#ffe01e"
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={arcTotal}
              strokeDashoffset={arcOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <div className="font-black leading-none text-white tabular-nums text-[28px]">
              {Math.round(consumed.kcal)}
            </div>
            <div className="text-[10px] text-white/40 tabular-nums">/ {target.kcal} kcal</div>
          </div>
        </div>

        {/* Barres macros */}
        <div className="flex flex-col gap-2 mt-3">
          {MACROS.map(m => {
            const c = (consumed[m.key] as number) ?? 0
            const tg = (target[m.key] as number) ?? 0
            const pct = tg > 0 ? Math.min(100, (c / tg) * 100) : 0
            return (
              <div key={m.key}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-white/50 uppercase tracking-[0.1em] font-bold">{m.label}</span>
                  <span className="text-white font-bold tabular-nums">{Math.round(c)}/{tg}g</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.color, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Eau */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/[0.06]">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white/50 uppercase tracking-[0.1em] font-bold">Hydratation</span>
              <span className="text-white font-bold tabular-nums">
                {(effectiveWaterMl / 1000).toFixed(1)} / {(target.water_ml / 1000).toFixed(1)} L
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 rounded-full"
                style={{
                  width: `${target.water_ml > 0 ? Math.min(100, (effectiveWaterMl / target.water_ml) * 100) : 0}%`,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
          <button
            onClick={e => { e.preventDefault(); setWaterOpen(true) }}
            className="w-9 h-9 rounded-xl bg-[#ffe01e] flex items-center justify-center text-[#0d0d0d] active:scale-95 transition-transform shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Régularité protéines — seulement si données disponibles */}
        {proteinStreakDays !== undefined && target.protein_g > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <div className="flex justify-between text-[10px] mb-1.5">
              <span className="text-white/40 uppercase tracking-[0.1em] font-bold">Régularité protéines</span>
              <span className="text-white/60 tabular-nums font-bold">{proteinStreakDays}/7j</span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#ffe01e]"
                style={{ width: `${(proteinStreakDays / 7) * 100}%`, transition: 'width 0.6s ease' }}
              />
            </div>
          </div>
        )}
      </Link>
    </>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "SmartNutritionWidget"
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/SmartNutritionWidget.tsx
git commit -m "refactor(dashboard): SmartNutritionWidget — full-width, suppr compact, ajout régularité protéines"
```

---

### Task 5: page.tsx — nouveau layout + queries + props

**Files:**
- Modify: `app/client/page.tsx`

- [ ] **Step 1: Ajouter la query nutrition 7 derniers jours**

Dans le bloc `Promise.allSettled`, après `morningCheckinResult`, ajouter :

```ts
// Nutrition des 7 derniers jours (pour régularité protéines)
svc()
  .from('nutrition_meals')
  .select('physiological_date, total_protein_g')
  .eq('client_id', clientId)
  .gte('physiological_date', (() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]
  })())
  .order('physiological_date', { ascending: true }),
```

Nommer le résultat `nutritionWeekResult` dans le destructuring.

- [ ] **Step 2: Ajouter les imports manquants en haut de page.tsx**

```ts
import DashboardHeroSnapshot from '@/components/client/smart/DashboardHeroSnapshot'
import DashboardAlertsFeed from '@/components/client/smart/DashboardAlertsFeed'
```

- [ ] **Step 3: Calculer `proteinStreakDays` après les fetches**

Après le bloc `// ── Workout widget`, ajouter :

```ts
// ── Protein regularity streak ───────────────────────────────────────────────
const nutritionWeekRows = nutritionWeekResult.status === 'fulfilled'
  ? (nutritionWeekResult.value.data ?? [])
  : []

// Group by date, sum protein
const proteinByDate: Record<string, number> = {}
for (const row of nutritionWeekRows as any[]) {
  const d = row.physiological_date as string
  proteinByDate[d] = (proteinByDate[d] ?? 0) + Number(row.total_protein_g ?? 0)
}
const proteinStreakDays = target.protein_g > 0
  ? Object.values(proteinByDate).filter(p => p >= target.protein_g * 0.8).length
  : undefined
```

- [ ] **Step 4: Calculer `kcalRemaining` et `sessionState` pour le Hero**

Après `proteinStreakDays`, ajouter :

```ts
// ── Hero snapshot data ───────────────────────────────────────────────────────
const kcalRemaining = target.kcal > 0 ? target.kcal - consumed.kcal : null

type SessionState = 'scheduled' | 'completed' | 'rest' | 'no_program'
const sessionState: SessionState = (() => {
  if (workoutProps.state === 'no_program') return 'no_program'
  if (workoutProps.state === 'rest') return 'rest'
  // Check if completed today
  if (sessionRow) return 'completed'
  return 'scheduled'
})()

const sessionNameForHero = workoutProps.state === 'scheduled' || sessionState === 'completed'
  ? (workoutProps.session?.name ?? null)
  : null

const heroDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: 'numeric', month: 'short',
}).format(new Date())

// Streak from sessionList (already computed above — use streak variable)
```

- [ ] **Step 5: Remplacer le JSX return**

Remplacer le bloc `return (...)` entier par :

```tsx
return (
  <>
    <ClientTopBar section="AUJOURD'HUI" title={todayLabel} />
    <main className="min-h-screen bg-[#0d0d0d] p-4 pt-[72px] pb-24 max-w-[480px] mx-auto space-y-3">

      {/* Bloc 1 — Hero Snapshot */}
      <DashboardHeroSnapshot
        kcalRemaining={kcalRemaining}
        sessionState={sessionState}
        sessionName={sessionNameForHero}
        waterMl={consumed.water_ml}
        waterTargetMl={target.water_ml}
        streak={streak}
        date={heroDate}
      />

      {/* Bloc 2 — Alertes prioritaires */}
      <DashboardAlertsFeed
        coachNotifications={notifications}
        morningCheckin={morningCheckin}
        workoutAlerts={workoutAlerts}
        consumed={consumed}
        target={target}
        plannedSessionToday={workoutProps.state === 'scheduled'}
      />

      {/* Bloc 3 — Séance du jour */}
      <SmartWorkoutWidget {...workoutProps} />

      {/* Bloc 4 — Nutrition */}
      <SmartNutritionWidget
        consumed={consumed}
        target={target}
        proteinStreakDays={proteinStreakDays}
      />

      {/* Bloc 5 — Timeline */}
      <SmartAgendaTimeline entries={timelineEntries} />

    </main>
  </>
)
```

- [ ] **Step 6: Supprimer les imports devenus inutiles**

Retirer de `page.tsx` :
```ts
import NotificationsBar, { type Notification } from "@/components/client/smart/NotificationsBar";
import RecoveryStatusWidget from "@/components/client/smart/RecoveryStatusWidget";
```

Note : `Notification` type est encore utilisé dans `normalizeNotificationType` — garder l'import du type uniquement si besoin, sinon supprimer la fonction et simplifier.

- [ ] **Step 7: Vérifier TypeScript — zéro erreur nouvelle**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -30
```

Comparer avec les erreurs pré-existantes. Aucune nouvelle erreur attendue.

- [ ] **Step 8: Mettre à jour CHANGELOG.md**

Ajouter en tête de la section `## 2026-05-20` :

```
FEATURE: Dashboard client redesign — layout full-width vertical, Hero Snapshot 4 stats, DashboardAlertsFeed unifié, SmartWorkoutWidget+SmartNutritionWidget full-width
```

- [ ] **Step 9: Commit**

```bash
git add app/client/page.tsx CHANGELOG.md
git commit -m "feat(dashboard): full-width layout — hero, alertes, séance, nutrition, timeline"
```

---

## Self-Review

- [x] Spec: Hero Snapshot 4 stats → Task 1 ✅
- [x] Spec: Alertes regroupées (coach + recovery + workout + nutrition) → Task 2 ✅
- [x] Spec: SmartWorkoutWidget full-width, suppr compact → Task 3 ✅
- [x] Spec: SmartNutritionWidget full-width + régularités → Task 4 ✅
- [x] Spec: page.tsx layout + query nutrition 7j → Task 5 ✅
- [x] Types cohérents : `NutritionMacros` exporté depuis `SmartNutritionWidget`, importé dans `DashboardAlertsFeed` et `page.tsx` ✅
- [x] `Notification` type importé de `NotificationsBar` dans `DashboardAlertsFeed` ✅
- [x] `GenericAlert` importé de `SmartAlertsFeed` dans `DashboardAlertsFeed` ✅
- [x] `CheckinData` importé de `recoveryAlerts` dans `DashboardAlertsFeed` ✅
- [x] `streak` variable déjà calculée dans `page.tsx` via `calculateStreaks` ✅
- [x] `sessionRow` déjà disponible dans `page.tsx` pour détecter séance complétée aujourd'hui ✅
- [x] `workoutAlerts` déjà calculé dans `page.tsx` ✅
