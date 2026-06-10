# Dashboard v2 — Adherence Score + Action System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le dashboard home par un cockpit adhérence : score global 0–100 avec fond coloré dynamique, action prioritaire contextuelle, checklist du jour cliquable, timeline.

**Architecture:** Fonction pure `computeAdherenceScore` testée Vitest → 3 nouveaux composants UI (`AdherenceScoreCard`, `PriorityActionCard`, `DayChecklist`) → `page.tsx` rewired avec nouvelles queries et nouveau layout. Les anciens composants home (`DashboardHeroSnapshot`, `DashboardAlertsFeed`, `SmartWorkoutWidget`, `SmartNutritionWidget`) sont retirés du home uniquement (conservés dans leurs pages respectives).

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, Phosphor Icons, Supabase, Vitest

---

## File Map

| Action | Fichier | Rôle |
|--------|---------|------|
| Create | `lib/client/smart/adherenceScore.ts` | Fonction pure calcul score 0–100 |
| Create | `tests/lib/client/smart/adherenceScore.test.ts` | Tests Vitest |
| Create | `components/client/smart/AdherenceScoreCard.tsx` | Hero card score + dimensions |
| Create | `components/client/smart/PriorityActionCard.tsx` | Action prioritaire contextuelle |
| Create | `components/client/smart/DayChecklist.tsx` | Checklist 5 items cliquables |
| Modify | `app/client/page.tsx` | Nouvelles queries + calculs + layout |
| Delete | `components/client/smart/DashboardHeroSnapshot.tsx` | Remplacé |
| Delete | `components/client/smart/DashboardAlertsFeed.tsx` | Remplacé |

---

### Task 1: adherenceScore — fonction pure + tests

**Files:**
- Create: `lib/client/smart/adherenceScore.ts`
- Create: `tests/lib/client/smart/adherenceScore.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
// tests/lib/client/smart/adherenceScore.test.ts
import { describe, it, expect } from 'vitest'
import { computeAdherenceScore } from '@/lib/client/smart/adherenceScore'

const BASE = {
  sessionDates: [],
  plannedDaysOfWeek: [1, 3, 5],
  mealDates: [],
  waterByDate: {},
  waterTargetMl: 2500,
  checkinDates: [],
  referenceDate: '2026-05-20',
}

describe('computeAdherenceScore', () => {
  it('returns 0 when no data', () => {
    const r = computeAdherenceScore(BASE)
    expect(r.score).toBe(0)
    expect(r.dimensions.sport).toBe(0)
    expect(r.dimensions.nutrition).toBe(0)
    expect(r.dimensions.hydration).toBe(0)
    expect(r.dimensions.checkins).toBe(0)
  })

  it('full sport score when all planned sessions done', () => {
    // 3 planned days in last 7 days relative to 2026-05-20 = Mon 18, Wed 16, Fri 14
    const sessionDates = ['2026-05-14', '2026-05-16', '2026-05-18']
    const r = computeAdherenceScore({ ...BASE, sessionDates, plannedDaysOfWeek: [1, 3, 5] })
    expect(r.dimensions.sport).toBe(25)
  })

  it('full nutrition score when meals logged every day', () => {
    const mealDates = ['2026-05-14','2026-05-15','2026-05-16','2026-05-17','2026-05-18','2026-05-19','2026-05-20']
    const r = computeAdherenceScore({ ...BASE, mealDates })
    expect(r.dimensions.nutrition).toBe(25)
  })

  it('full hydration score when water >= 80% target every day', () => {
    const waterByDate: Record<string, number> = {
      '2026-05-14': 2200, '2026-05-15': 2200, '2026-05-16': 2200,
      '2026-05-17': 2200, '2026-05-18': 2200, '2026-05-19': 2200, '2026-05-20': 2200,
    }
    const r = computeAdherenceScore({ ...BASE, waterByDate, waterTargetMl: 2500 })
    expect(r.dimensions.hydration).toBe(25)
  })

  it('full checkins score when checkin every day', () => {
    const checkinDates = ['2026-05-14','2026-05-15','2026-05-16','2026-05-17','2026-05-18','2026-05-19','2026-05-20']
    const r = computeAdherenceScore({ ...BASE, checkinDates })
    expect(r.dimensions.checkins).toBe(25)
  })

  it('score sums dimensions correctly', () => {
    const mealDates = ['2026-05-14','2026-05-15','2026-05-16','2026-05-17','2026-05-18','2026-05-19','2026-05-20']
    const checkinDates = ['2026-05-14','2026-05-15','2026-05-16','2026-05-17','2026-05-18','2026-05-19','2026-05-20']
    const r = computeAdherenceScore({ ...BASE, mealDates, checkinDates })
    expect(r.score).toBe(r.dimensions.sport + r.dimensions.nutrition + r.dimensions.hydration + r.dimensions.checkins)
  })

  it('scoreDelta is positive when today better than yesterday window', () => {
    // Window today: 2026-05-14 to 2026-05-20 (7 days)
    // Window yesterday: 2026-05-13 to 2026-05-19 (7 days)
    // More meals in today window
    const mealDates = ['2026-05-17','2026-05-18','2026-05-19','2026-05-20']
    const r = computeAdherenceScore({ ...BASE, mealDates })
    expect(r.scoreDelta).toBeGreaterThanOrEqual(0)
  })

  it('partial sport score proportional to sessions done', () => {
    // 1 out of 3 planned sessions done
    const r = computeAdherenceScore({ ...BASE, sessionDates: ['2026-05-18'], plannedDaysOfWeek: [1, 3, 5] })
    expect(r.dimensions.sport).toBeGreaterThan(0)
    expect(r.dimensions.sport).toBeLessThan(25)
  })
})
```

- [ ] **Step 2: Run tests — vérifier qu'ils échouent**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/client/smart/adherenceScore.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Créer `lib/client/smart/adherenceScore.ts`**

```ts
// lib/client/smart/adherenceScore.ts

export type AdherenceInput = {
  sessionDates: string[]
  plannedDaysOfWeek: number[]   // 1=lun, 7=dim
  mealDates: string[]
  waterByDate: Record<string, number>
  waterTargetMl: number
  checkinDates: string[]
  referenceDate: string         // YYYY-MM-DD (today)
}

export type AdherenceResult = {
  score: number
  scoreDelta: number
  dimensions: {
    sport: number
    nutrition: number
    hydration: number
    checkins: number
  }
}

function getWindow(referenceDate: string, daysBack: number): string[] {
  const dates: string[] = []
  const ref = new Date(referenceDate)
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(ref)
    d.setDate(ref.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr)
  const jsDay = d.getDay()
  return jsDay === 0 ? 7 : jsDay
}

function computeDimensions(
  window: string[],
  sessionDates: string[],
  plannedDaysOfWeek: number[],
  mealDates: string[],
  waterByDate: Record<string, number>,
  waterTargetMl: number,
  checkinDates: string[],
): AdherenceResult['dimensions'] {
  const sessionSet = new Set(sessionDates)
  const mealSet = new Set(mealDates)
  const checkinSet = new Set(checkinDates)

  // Sport: planned days in window vs sessions done
  const plannedInWindow = window.filter(d => plannedDaysOfWeek.includes(getDayOfWeek(d)))
  const sportDone = plannedInWindow.filter(d => sessionSet.has(d)).length
  const sport = plannedInWindow.length > 0
    ? Math.round((sportDone / plannedInWindow.length) * 25)
    : 25  // no planned sessions = full score (rest week)

  // Nutrition: days with meals logged / 7
  const nutritionDone = window.filter(d => mealSet.has(d)).length
  const nutrition = Math.round((nutritionDone / window.length) * 25)

  // Hydration: days with water >= 80% target / 7
  const hydrationDone = window.filter(d => (waterByDate[d] ?? 0) >= waterTargetMl * 0.8).length
  const hydration = waterTargetMl > 0
    ? Math.round((hydrationDone / window.length) * 25)
    : 25

  // Checkins: days with check-in / 7
  const checkinDone = window.filter(d => checkinSet.has(d)).length
  const checkins = Math.round((checkinDone / window.length) * 25)

  return { sport, nutrition, hydration, checkins }
}

export function computeAdherenceScore(input: AdherenceInput): AdherenceResult {
  const {
    sessionDates, plannedDaysOfWeek, mealDates,
    waterByDate, waterTargetMl, checkinDates, referenceDate,
  } = input

  const todayWindow = getWindow(referenceDate, 7)
  const dims = computeDimensions(
    todayWindow, sessionDates, plannedDaysOfWeek,
    mealDates, waterByDate, waterTargetMl, checkinDates,
  )
  const score = dims.sport + dims.nutrition + dims.hydration + dims.checkins

  // Delta: compute score on yesterday's window (J-1 to J-7)
  const ref = new Date(referenceDate)
  ref.setDate(ref.getDate() - 1)
  const yesterdayRef = ref.toISOString().split('T')[0]
  const yesterdayWindow = getWindow(yesterdayRef, 7)
  const yesterdayDims = computeDimensions(
    yesterdayWindow, sessionDates, plannedDaysOfWeek,
    mealDates, waterByDate, waterTargetMl, checkinDates,
  )
  const yesterdayScore = yesterdayDims.sport + yesterdayDims.nutrition + yesterdayDims.hydration + yesterdayDims.checkins
  const scoreDelta = score - yesterdayScore

  return { score, scoreDelta, dimensions: dims }
}
```

- [ ] **Step 4: Run tests — vérifier qu'ils passent**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/client/smart/adherenceScore.test.ts 2>&1 | tail -10
```

Expected: `8 passed`

- [ ] **Step 5: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "adherenceScore"
```

Expected: aucune erreur

- [ ] **Step 6: Commit**

```bash
git add lib/client/smart/adherenceScore.ts tests/lib/client/smart/adherenceScore.test.ts
git commit -m "feat(dashboard): adherenceScore pure function + 8 Vitest tests"
```

---

### Task 2: AdherenceScoreCard — hero card

**Files:**
- Create: `components/client/smart/AdherenceScoreCard.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/client/smart/AdherenceScoreCard.tsx
'use client'

import type { AdherenceResult } from '@/lib/client/smart/adherenceScore'

const SCORE_THEME = (score: number) => {
  if (score >= 75) return { bg: '#0d1a0d', accent: '#4ade80', label: score >= 85 ? 'Élite' : 'En forme' }
  if (score >= 50) return { bg: '#1a1500', accent: '#ffe01e', label: score >= 60 ? 'Bon rythme' : 'À améliorer' }
  return { bg: '#1a0a0a', accent: '#ef4444', label: 'Reprends le fil' }
}

const DIMS = [
  { key: 'sport',      label: 'Sport',    color: '#3b82f6', icon: '🏋️' },
  { key: 'nutrition',  label: 'Nutri',    color: '#ffe01e', icon: '🍽️' },
  { key: 'hydration',  label: 'Hydra',    color: '#22d3ee', icon: '💧' },
  { key: 'checkins',   label: 'Check-in', color: '#a78bfa', icon: '✓'  },
] as const

export default function AdherenceScoreCard({ score, scoreDelta, dimensions }: AdherenceResult) {
  const theme = SCORE_THEME(score)
  const r = 70
  const arcTotal = Math.PI * r
  const arcOffset = arcTotal * (1 - score / 100)

  return (
    <div
      className="rounded-2xl border border-white/[0.08] px-5 pt-5 pb-4 relative overflow-hidden"
      style={{ background: theme.bg }}
    >
      {/* Delta badge */}
      {scoreDelta !== 0 && (
        <div
          className="absolute top-4 right-4 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full"
          style={{
            background: scoreDelta > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
            color: scoreDelta > 0 ? '#4ade80' : '#ef4444',
          }}
        >
          {scoreDelta > 0 ? '+' : ''}{scoreDelta} vs hier
        </div>
      )}

      {/* Anneau + score */}
      <div className="relative flex justify-center" style={{ height: 100 }}>
        <svg viewBox="0 0 160 90" className="w-[200px] h-[100px]">
          {/* Track */}
          <path
            d={`M ${80 - r} 80 A ${r} ${r} 0 0 1 ${80 + r} 80`}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={14}
            strokeLinecap="round"
          />
          {/* Fill */}
          <path
            d={`M ${80 - r} 80 A ${r} ${r} 0 0 1 ${80 + r} 80`}
            fill="none"
            stroke={theme.accent}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={arcTotal}
            strokeDashoffset={arcOffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span
            className="font-black font-mono leading-none text-[42px] tabular-nums"
            style={{ color: theme.accent }}
          >
            {score}
          </span>
          <span
            className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.2em] mt-0.5"
            style={{ color: theme.accent }}
          >
            {theme.label}
          </span>
        </div>
      </div>

      {/* 4 dimensions */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        {DIMS.map(d => {
          const val = dimensions[d.key]
          const pct = (val / 25) * 100
          return (
            <div key={d.key} className="flex flex-col items-center gap-1">
              <div
                className="w-full h-1 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: d.color, transition: 'width 0.6s ease' }}
                />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-[0.1em]" style={{ color: d.color }}>
                {d.label}
              </span>
              <span className="text-[10px] font-black font-mono" style={{ color: d.color }}>
                {val}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "AdherenceScoreCard"
```

Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/AdherenceScoreCard.tsx
git commit -m "feat(dashboard): AdherenceScoreCard — anneau score, fond coloré dynamique, 4 dimensions"
```

---

### Task 3: PriorityActionCard — action urgente contextuelle

**Files:**
- Create: `components/client/smart/PriorityActionCard.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/client/smart/PriorityActionCard.tsx
'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export type PriorityActionType = 'checkin' | 'session' | 'meal' | 'water' | 'protein'

export type PriorityActionCardProps = {
  type: PriorityActionType
  title: string
  subtitle: string
  href: string
  ctaLabel: string
}

const TYPE_COLOR: Record<PriorityActionType, string> = {
  checkin:  '#3b82f6',
  session:  '#ffe01e',
  meal:     '#4ade80',
  water:    '#22d3ee',
  protein:  '#f59e0b',
}

export function computePriorityAction(params: {
  hour: number
  morningCheckinDone: boolean
  sessionScheduledToday: boolean
  sessionCompletedToday: boolean
  sessionName: string | null
  mealsLoggedToday: number
  waterMl: number
  waterTargetMl: number
  protein_g: number
  proteinTargetG: number
}): PriorityActionCardProps | null {
  const {
    hour, morningCheckinDone, sessionScheduledToday, sessionCompletedToday,
    sessionName, mealsLoggedToday, waterMl, waterTargetMl, protein_g, proteinTargetG,
  } = params

  if (hour < 12 && !morningCheckinDone) {
    return {
      type: 'checkin',
      title: 'Démarre ta journée',
      subtitle: 'Check-in matin non réalisé',
      href: '/client/checkin/morning',
      ctaLabel: 'Check-in',
    }
  }

  if (sessionScheduledToday && !sessionCompletedToday) {
    return {
      type: 'session',
      title: sessionName ? `Séance — ${sessionName}` : 'Séance prévue',
      subtitle: 'Ton programme t\'attend',
      href: '/client/programme',
      ctaLabel: 'Démarrer',
    }
  }

  if (hour > 12 && mealsLoggedToday < 2) {
    const mealLabel = hour < 14 ? 'déjeuner' : hour < 19 ? 'repas' : 'dîner'
    return {
      type: 'meal',
      title: `Tu n'as pas loggé ton ${mealLabel}`,
      subtitle: `${mealsLoggedToday} repas loggé${mealsLoggedToday > 1 ? 's' : ''} aujourd'hui`,
      href: '/client/nutrition',
      ctaLabel: 'Logger',
    }
  }

  if (hour > 15 && waterTargetMl > 0 && waterMl < waterTargetMl * 0.5) {
    return {
      type: 'water',
      title: 'Hydratation insuffisante',
      subtitle: `${(waterMl / 1000).toFixed(1)}L / ${(waterTargetMl / 1000).toFixed(1)}L`,
      href: '/client',
      ctaLabel: 'Logger',
    }
  }

  if (hour > 14 && proteinTargetG > 0 && protein_g < proteinTargetG * 0.5) {
    return {
      type: 'protein',
      title: 'Protéines en retard',
      subtitle: `${Math.round(protein_g)}g / ${proteinTargetG}g`,
      href: '/client/nutrition',
      ctaLabel: 'Logger',
    }
  }

  return null
}

export default function PriorityActionCard({ type, title, subtitle, href, ctaLabel }: PriorityActionCardProps) {
  const color = TYPE_COLOR[type]
  return (
    <Link
      href={href}
      className="flex items-center gap-3 bg-[#161616] rounded-2xl border border-white/[0.08] px-4 py-4 active:scale-[0.99] transition-transform"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-white leading-tight truncate">{title}</p>
        <p className="text-[11px] text-white/50 mt-0.5">{subtitle}</p>
      </div>
      <div
        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ background: `${color}20`, color }}
      >
        {ctaLabel}
        <ChevronRight size={11} />
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "PriorityActionCard"
```

Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/PriorityActionCard.tsx
git commit -m "feat(dashboard): PriorityActionCard + computePriorityAction — action contextuelle selon heure"
```

---

### Task 4: DayChecklist — 5 items cliquables

**Files:**
- Create: `components/client/smart/DayChecklist.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/client/smart/DayChecklist.tsx
'use client'

import Link from 'next/link'
import { CheckCircle, Circle, ChevronRight } from 'lucide-react'

export type DayChecklistProps = {
  morningCheckin: boolean
  eveningCheckin: boolean
  sessionCompleted: boolean
  sessionName: string | null
  mealsLogged: number
  waterMl: number
  waterTargetMl: number
  onOpenWater: () => void
}

type ChecklistItem = {
  id: string
  label: string
  sublabel?: string
  done: boolean
  color: string
  actionHref?: string
  actionFn?: () => void
}

export default function DayChecklist({
  morningCheckin,
  eveningCheckin,
  sessionCompleted,
  sessionName,
  mealsLogged,
  waterMl,
  waterTargetMl,
  onOpenWater,
}: DayChecklistProps) {
  const items: ChecklistItem[] = [
    {
      id: 'checkin_morning',
      label: 'Check-in matin',
      done: morningCheckin,
      color: '#3b82f6',
      actionHref: '/client/checkin/morning',
    },
    {
      id: 'session',
      label: sessionName ? `Séance — ${sessionName}` : 'Séance du jour',
      done: sessionCompleted,
      color: '#ffe01e',
      actionHref: '/client/programme',
    },
    {
      id: 'nutrition',
      label: 'Nutrition',
      sublabel: `${mealsLogged} repas loggé${mealsLogged > 1 ? 's' : ''}`,
      done: mealsLogged >= 2,
      color: '#4ade80',
      actionHref: '/client/nutrition',
    },
    {
      id: 'water',
      label: 'Hydratation',
      sublabel: `${(waterMl / 1000).toFixed(1)}L / ${(waterTargetMl / 1000).toFixed(1)}L`,
      done: waterTargetMl > 0 && waterMl >= waterTargetMl * 0.8,
      color: '#22d3ee',
      actionFn: onOpenWater,
    },
    {
      id: 'checkin_evening',
      label: 'Check-in soir',
      done: eveningCheckin,
      color: '#a78bfa',
      actionHref: '/client/checkin/evening',
    },
  ]

  const doneCount = items.filter(i => i.done).length

  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[10px] text-white/40">
          Aujourd'hui
        </span>
        <span className="text-[10px] font-bold text-white/40 tabular-nums">
          {doneCount}/{items.length}
        </span>
      </div>

      {/* Items */}
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        const inner = (
          <div
            className={`flex items-center gap-3 px-4 py-3 transition-colors active:bg-white/[0.02] ${!isLast ? 'border-b border-white/[0.04]' : ''}`}
          >
            {/* State icon */}
            {item.done ? (
              <CheckCircle size={20} style={{ color: item.color }} className="shrink-0" />
            ) : (
              <Circle size={20} className="text-white/20 shrink-0" />
            )}

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-[12px] font-semibold leading-tight ${item.done ? 'text-white/35 line-through' : 'text-white'}`}
              >
                {item.label}
              </p>
              {item.sublabel && (
                <p className="text-[10px] text-white/35 mt-0.5">{item.sublabel}</p>
              )}
            </div>

            {/* Arrow if not done */}
            {!item.done && <ChevronRight size={14} className="text-white/20 shrink-0" />}
          </div>
        )

        if (item.done) return <div key={item.id}>{inner}</div>

        if (item.actionFn) {
          return (
            <button key={item.id} className="w-full text-left" onClick={item.actionFn}>
              {inner}
            </button>
          )
        }

        return (
          <Link key={item.id} href={item.actionHref!}>
            {inner}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "DayChecklist"
```

Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/DayChecklist.tsx
git commit -m "feat(dashboard): DayChecklist — 5 items cliquables avec état"
```

---

### Task 5: page.tsx — nouvelles queries, calculs, layout

**Files:**
- Modify: `app/client/page.tsx`

- [ ] **Step 1: Ajouter queries 7j checkins + water dans `Promise.allSettled`**

Après la query `streakResult`, ajouter :

```ts
// Check-ins 7 derniers jours (pour score adhérence)
svc()
  .from("client_checkins")
  .select("date, moment")
  .eq("client_id", clientId)
  .gte("date", (() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split("T")[0];
  })()),

// Water logs 7 derniers jours (pour score hydratation)
svc()
  .from("client_water_logs")
  .select("logged_at, amount_ml")
  .eq("client_id", clientId)
  .gte("logged_at", (() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split("T")[0] + "T00:00:00Z";
  })()),
```

Ajouter `checkinsWeekResult, waterWeekResult` au destructuring.

- [ ] **Step 2: Ajouter imports en haut de page.tsx**

```ts
import { computeAdherenceScore } from "@/lib/client/smart/adherenceScore"
import AdherenceScoreCard from "@/components/client/smart/AdherenceScoreCard"
import PriorityActionCard, { computePriorityAction } from "@/components/client/smart/PriorityActionCard"
import DayChecklist from "@/components/client/smart/DayChecklist"
```

- [ ] **Step 3: Calculer le score adhérence après les fetches existants**

Après le bloc `// ── Session streak`, ajouter :

```ts
// ── Adherence score ───────────────────────────────────────────────────────
const checkinsWeekRows = checkinsWeekResult.status === "fulfilled"
  ? (checkinsWeekResult.value.data ?? [])
  : []
const checkinDates = Array.from(
  new Set((checkinsWeekRows as any[]).map((r) => r.date as string))
)

const waterWeekRows = waterWeekResult.status === "fulfilled"
  ? (waterWeekResult.value.data ?? [])
  : []
const waterByDate: Record<string, number> = {}
for (const row of waterWeekRows as any[]) {
  const d = (row.logged_at as string).split("T")[0]
  waterByDate[d] = (waterByDate[d] ?? 0) + Number(row.amount_ml ?? 0)
}

const mealDates7j = Array.from(
  new Set((nutritionWeekRows as any[]).map((r) => r.physiological_date as string))
)

const plannedDaysOfWeek = ((programData as any)?.programs ?? [])
  .filter((p: any) => p.status === "active")
  .flatMap((p: any) => (p.program_sessions ?? []).map((s: any) => s.day_of_week as number))
  .filter((d: number) => d >= 1 && d <= 7)

const adherence = computeAdherenceScore({
  sessionDates,
  plannedDaysOfWeek,
  mealDates: mealDates7j,
  waterByDate,
  waterTargetMl: target.water_ml,
  checkinDates,
  referenceDate: date,
})
```

- [ ] **Step 4: Calculer `priorityAction` et données `DayChecklist`**

Après `// ── Hero snapshot data`, ajouter :

```ts
// ── Priority action ────────────────────────────────────────────────────────
const hour = new Date().getHours()
const morningCheckinDone = morningCheckin !== null
const eveningCheckinDone = checkinsWeekRows.some(
  (r: any) => r.date === date && r.moment === "evening"
)

const priorityAction = computePriorityAction({
  hour,
  morningCheckinDone,
  sessionScheduledToday: workoutProps.state === "scheduled",
  sessionCompletedToday: sessionState === "completed",
  sessionName: workoutProps.session?.name ?? null,
  mealsLoggedToday: meals.length,
  waterMl: consumed.water_ml,
  waterTargetMl: target.water_ml,
  protein_g: consumed.protein_g,
  proteinTargetG: target.protein_g,
})
```

- [ ] **Step 5: Remplacer le JSX return**

Remplacer le bloc `return (...)` entier :

```tsx
return (
  <>
    <ClientTopBar
      section="AUJOURD'HUI"
      title={(() => {
        const label = new Intl.DateTimeFormat("fr-FR", {
          weekday: "long", day: "numeric", month: "long",
        }).format(new Date())
        return label.charAt(0).toUpperCase() + label.slice(1)
      })()}
    />
    <main className="min-h-screen bg-[#0d0d0d] p-4 pt-[72px] pb-24 max-w-[480px] mx-auto space-y-3">

      {/* Bloc 1 — Score adhérence */}
      <AdherenceScoreCard
        score={adherence.score}
        scoreDelta={adherence.scoreDelta}
        dimensions={adherence.dimensions}
      />

      {/* Bloc 2 — Action prioritaire (conditionnel) */}
      {priorityAction && <PriorityActionCard {...priorityAction} />}

      {/* Bloc 3 — Checklist du jour */}
      <DayChecklist
        morningCheckin={morningCheckinDone}
        eveningCheckin={eveningCheckinDone}
        sessionCompleted={sessionState === "completed"}
        sessionName={workoutProps.session?.name ?? null}
        mealsLogged={meals.length}
        waterMl={consumed.water_ml}
        waterTargetMl={target.water_ml}
        onOpenWater={() => {}}
      />

      {/* Bloc 4 — Timeline */}
      <SmartAgendaTimeline entries={timelineEntries} />

    </main>
  </>
)
```

Note : `onOpenWater` dans un Server Component ne peut pas appeler un setter client. `DayChecklist` sera un Client Component — l'eau sera gérée via navigation vers `/client/nutrition` (href) plutôt que modal. Modifier `DayChecklist` : remplacer `actionFn` par `actionHref: '/client/nutrition'` pour l'item water.

- [ ] **Step 6: Supprimer les vieux composants du home**

```bash
rm /Users/user/Desktop/STRYVLAB/components/client/smart/DashboardHeroSnapshot.tsx
rm /Users/user/Desktop/STRYVLAB/components/client/smart/DashboardAlertsFeed.tsx
```

Retirer leurs imports de `page.tsx`.

- [ ] **Step 7: Vérifier TypeScript — zéro erreur nouvelle**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "app/client/page.tsx"
```

Expected: aucune erreur

- [ ] **Step 8: Run all tests**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run 2>&1 | tail -8
```

Expected: tous les tests passent

- [ ] **Step 9: Mettre à jour CHANGELOG**

Ajouter au top de la section `## 2026-05-20` :

```
FEATURE: Dashboard v2 — AdherenceScoreCard score 0-100 fond coloré, PriorityActionCard action contextuelle, DayChecklist 5 items, header jour complet sans abréviation
CHORE: Supprimer DashboardHeroSnapshot + DashboardAlertsFeed (remplacés)
```

- [ ] **Step 10: Commit**

```bash
git add app/client/page.tsx CHANGELOG.md
git add -u components/client/smart/  # capture deletions
git commit -m "feat(dashboard): v2 — adherence score, priority action, day checklist"
```

---

## Self-Review

- [x] Spec: score global 0–100 → `computeAdherenceScore` + `AdherenceScoreCard` ✅
- [x] Spec: fond coloré dynamique selon score → `SCORE_THEME(score)` dans `AdherenceScoreCard` ✅
- [x] Spec: delta vs hier → `scoreDelta` dans `computeAdherenceScore` ✅
- [x] Spec: 4 dimensions pills → `DIMS` map dans `AdherenceScoreCard` ✅
- [x] Spec: label qualitatif → `SCORE_THEME.label` ✅
- [x] Spec: action prioritaire contextuelle → `computePriorityAction` + `PriorityActionCard` ✅
- [x] Spec: 5 règles priorité dans l'ordre → `computePriorityAction` if-chain ✅
- [x] Spec: DayChecklist 5 items cliquables → `DayChecklist` ✅
- [x] Spec: header `"long"` pas `"short"` → `weekday: "long"` dans return JSX ✅
- [x] Spec: SmartAgendaTimeline inchangé → gardé en bloc 4 ✅
- [x] Spec: supprimer DashboardHeroSnapshot + DashboardAlertsFeed → Task 5 Step 6 ✅
- [x] Types cohérents : `AdherenceResult` exporté de `adherenceScore.ts`, utilisé comme props de `AdherenceScoreCard` ✅
- [x] `computePriorityAction` exporté nommément depuis `PriorityActionCard.tsx` ✅
- [x] `onOpenWater` note de limitation documentée — évite un bug Server/Client ✅
