# Dashboard Home Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionner `/dashboard` et `/coach/organisation` en une unique page d'accueil coach avec welcome header progressif (3 étapes), résumé collapsible, et vues Kanban/Agenda switchables via sub-nav.

**Architecture:** `app/dashboard/page.tsx` réécrit comme orchestrateur. Composants Kanban/Agenda/DashboardTab extraits de `app/coach/organisation/page.tsx` vers `components/dashboard/`. Nouveaux composants : `WelcomeHeader`, `SummaryPanel`, `DashboardSubNav`. `/coach/organisation` redirige → `/dashboard`.

**Tech Stack:** Next.js App Router, React, Tailwind, Framer Motion, @dnd-kit, localStorage pour persistance vue/collapsed.

---

## File Map

**Créer :**
- `components/dashboard/WelcomeHeader.tsx` — onboarding 3 étapes progressif
- `components/dashboard/SummaryPanel.tsx` — résumé collapsible (expanded + collapsed)
- `components/dashboard/DashboardSubNav.tsx` — pills Résumé/Kanban/Agenda
- `components/dashboard/DashboardKanban.tsx` — extrait de organisation/page.tsx
- `components/dashboard/DashboardAgenda.tsx` — wrapper AgendaCalendar
- `components/dashboard/OrgSummary.tsx` — extrait DashboardTab de organisation/page.tsx
- `app/api/dashboard/onboarding/route.ts` — 3 counts en parallèle

**Modifier :**
- `app/dashboard/page.tsx` — réécrit complet
- `app/coach/organisation/page.tsx` — remplacé par redirect
- `components/layout/NavDock/NavRowB.tsx` — href Accueil → `/dashboard`
- `components/layout/NavDock/useNavConfig.ts` — condition pathname dashboard
- `components/layout/DockLeft.tsx` — vérifier href (déjà `/dashboard`)

---

## Task 1 : API onboarding — 3 counts

**Files:**
- Create: `app/api/dashboard/onboarding/route.ts`

- [ ] **Step 1 : Créer la route**

```typescript
// app/api/dashboard/onboarding/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(_req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = serviceClient()
  const coachId = user.id

  const [clientsRes, templatesRes, formulasRes] = await Promise.all([
    db.from('coach_clients').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
    db.from('assessment_templates').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
    db.from('coach_formulas').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
  ])

  return NextResponse.json({
    hasClient: (clientsRes.count ?? 0) > 0,
    hasTemplate: (templatesRes.count ?? 0) > 0,
    hasFormula: (formulasRes.count ?? 0) > 0,
  })
}
```

- [ ] **Step 2 : Tester manuellement**

```bash
curl http://localhost:3000/api/dashboard/onboarding
# Attendu (nouveau coach) : { hasClient: false, hasTemplate: false, hasFormula: false }
```

- [ ] **Step 3 : Commit**

```bash
git add app/api/dashboard/onboarding/route.ts
git commit -m "feat(dashboard): add onboarding counts API route"
```

---

## Task 2 : WelcomeHeader — onboarding progressif

**Files:**
- Create: `components/dashboard/WelcomeHeader.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/dashboard/WelcomeHeader.tsx
'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type OnboardingState = {
  hasClient: boolean
  hasTemplate: boolean
  hasFormula: boolean
}

const STEPS = [
  {
    id: 'client',
    label: 'Ajouter ton premier client',
    key: 'hasClient' as keyof OnboardingState,
    href: '/coach/clients',
    cta: 'Créer un client',
  },
  {
    id: 'template',
    label: 'Créer un template de bilan',
    key: 'hasTemplate' as keyof OnboardingState,
    href: '/coach/assessments/templates/new',
    cta: 'Créer un bilan',
  },
  {
    id: 'formula',
    label: 'Créer ta première formule',
    key: 'hasFormula' as keyof OnboardingState,
    href: '/coach/formules',
    cta: 'Créer une formule',
  },
]

const TITLES: Record<number, string> = {
  0: 'Bienvenue dans la nouvelle ère du coaching.',
  1: 'Premier client ajouté — crée ton premier bilan.',
  2: 'Presque prêt — définis ta première formule.',
}

export default function WelcomeHeader({ state }: { state: OnboardingState }) {
  const router = useRouter()
  const completedCount = STEPS.filter(s => state[s.key]).length

  // Disparaît si tout complété
  if (completedCount === 3) return null

  // Première étape non complétée = active
  const activeIndex = STEPS.findIndex(s => !state[s.key])

  return (
    <div className="mb-6 rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-6">
      {/* Titre */}
      <div className="mb-5">
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em] mb-1.5">
          Espace Coach
        </p>
        <h2 className="text-white text-xl font-bold tracking-tight">
          {TITLES[completedCount]}
        </h2>
      </div>

      {/* Étapes */}
      <div className="space-y-2 mb-5">
        {STEPS.map((step, i) => {
          const done = state[step.key]
          const active = i === activeIndex
          const locked = !done && i > activeIndex

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center justify-between rounded-xl px-4 py-3 transition-colors',
                done && 'bg-[#1f8a65]/5',
                active && 'bg-white/[0.03] border-[0.3px] border-[#1f8a65]/20',
                locked && 'opacity-40',
              )}
            >
              <div className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 size={16} className="text-[#1f8a65] shrink-0" />
                ) : (
                  <Circle size={16} className={cn('shrink-0', active ? 'text-[#1f8a65]' : 'text-white/20')} />
                )}
                <span className={cn(
                  'text-[13px] font-medium',
                  done ? 'text-white/30 line-through' : 'text-white/80',
                )}>
                  {step.label}
                </span>
              </div>

              {active && (
                <button
                  onClick={() => router.push(step.href)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f8a65] text-white rounded-lg text-[11px] font-bold hover:bg-[#217356] transition-colors active:scale-[0.97]"
                >
                  {step.cta}
                  <ArrowRight size={11} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Barre progression */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-white/30">
          <span>Progression</span>
          <span>{completedCount}/3</span>
        </div>
        <div className="h-[3px] w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#1f8a65] transition-all duration-700"
            style={{ width: `${(completedCount / 3) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/dashboard/WelcomeHeader.tsx
git commit -m "feat(dashboard): add WelcomeHeader onboarding component"
```

---

## Task 3 : SummaryPanel — résumé collapsible

**Files:**
- Create: `components/dashboard/SummaryPanel.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/dashboard/SummaryPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react'
import type { DashboardCoachData } from '@/components/dashboard/types'

const STORAGE_KEY = 'dashboard_summary_collapsed'

function KpiCard({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-1.5">{label}</p>
      <p className={`text-xl font-black leading-none ${accent ? 'text-[#1f8a65]' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function OrgCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-1.5">{label}</p>
      <p className="text-2xl font-black text-white leading-none">{value}</p>
      {sub && <p className="text-[11px] text-white/35 mt-1">{sub}</p>}
    </div>
  )
}

export default function SummaryPanel({ data }: { data: DashboardCoachData }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  const criticalAlerts = data.alerts.filter(a => a.type === 'critical').length

  // ── Mini-barre collapsed ────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] px-5 h-12">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[9px] text-white/30 uppercase tracking-[0.12em]">MRR </span>
            <span className="text-[13px] font-bold text-white">{data.financial.mrr.toFixed(0)} €</span>
          </div>
          <div>
            <span className="text-[9px] text-white/30 uppercase tracking-[0.12em]">Clients </span>
            <span className="text-[13px] font-bold text-white">{data.hero.activeClients}</span>
          </div>
          {criticalAlerts > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-amber-400" />
              <span className="text-[13px] font-bold text-amber-400">{criticalAlerts} alerte{criticalAlerts > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronDown size={14} />
          Voir le résumé
        </button>
      </div>
    )
  }

  // ── Expanded ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-4 rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-5 space-y-4">
      {/* Row 1 — KPIs Business */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-3">Business</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="MRR" value={`${data.financial.mrr.toFixed(0)} €`} accent />
          <KpiCard label="Clients actifs" value={data.hero.activeClients} />
          <KpiCard label="En attente" value={`${data.financial.pendingAmount.toFixed(0)} €`} />
          <KpiCard label="Ce mois" value={`${data.financial.monthRevenue.toFixed(0)} €`} />
        </div>
      </div>

      {/* Row 2 — Organisation */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-3">Organisation du jour</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <OrgSummaryCard data={data} />
        </div>
      </div>

      {/* Row 3 — Coaching */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-3">Activité coaching</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <OrgCard label="Bilans sans réponse" value={data.hero.pendingSubmissions} sub="> 5 jours" />
          <OrgCard label="Clients inactifs" value={data.hero.inactiveClients} sub="> 14 jours" />
          <OrgCard label="Séances cette semaine" value={data.hero.weekSessions ?? 0} />
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/60 transition-colors mx-auto"
      >
        <ChevronUp size={13} />
        Réduire le résumé
      </button>
    </div>
  )
}

function OrgSummaryCard({ data }: { data: DashboardCoachData }) {
  return (
    <>
      <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-2">Aujourd'hui</p>
        <p className="text-[13px] text-white/50">Voir l'agenda →</p>
      </div>
      <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-2">Kanban</p>
        <p className="text-[13px] text-white/50">Voir les tâches →</p>
      </div>
      <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-2">À venir (24h)</p>
        <p className="text-[13px] text-white/50">Voir l'agenda →</p>
      </div>
    </>
  )
}
```

- [ ] **Step 2 : Vérifier que `DashboardCoachData` a les champs utilisés**

```bash
grep -n "pendingSubmissions\|inactiveClients\|weekSessions\|monthRevenue\|pendingAmount\|mrr" components/dashboard/types.ts
```

Si `weekSessions`, `monthRevenue`, ou `pendingAmount` manquent → ajouter dans `types.ts` avec valeur `0` par défaut dans l'API. Sinon passer à l'étape suivante.

- [ ] **Step 3 : Adapter types si nécessaire**

Ouvrir `components/dashboard/types.ts`. Si `DashboardHero` manque `weekSessions` :

```typescript
// Ajouter dans DashboardHero
weekSessions?: number
```

Si `DashboardFinancial` manque `monthRevenue` ou `pendingAmount` :

```typescript
// Ajouter dans DashboardFinancial
monthRevenue: number
pendingAmount: number
```

Vérifier que `app/api/dashboard/coach/route.ts` les calcule et les retourne. Si non, ajouter calcul dans la route.

- [ ] **Step 4 : Commit**

```bash
git add components/dashboard/SummaryPanel.tsx components/dashboard/types.ts
git commit -m "feat(dashboard): add SummaryPanel collapsible component"
```

---

## Task 4 : DashboardSubNav — pills de navigation

**Files:**
- Create: `components/dashboard/DashboardSubNav.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// components/dashboard/DashboardSubNav.tsx
'use client'

import { cn } from '@/lib/utils'

export type DashboardView = 'resume' | 'kanban' | 'agenda'

const VIEWS: { id: DashboardView; label: string }[] = [
  { id: 'resume', label: 'Résumé' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'agenda', label: 'Agenda' },
]

export default function DashboardSubNav({
  active,
  onChange,
}: {
  active: DashboardView
  onChange: (v: DashboardView) => void
}) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {VIEWS.map(v => (
        <button
          key={v.id}
          onClick={() => onChange(v.id)}
          className={cn(
            'px-3 h-7 rounded-lg text-[11px] font-semibold transition-all duration-150',
            active === v.id
              ? 'bg-[#1f8a65]/15 text-[#1f8a65]'
              : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/dashboard/DashboardSubNav.tsx
git commit -m "feat(dashboard): add DashboardSubNav pills component"
```

---

## Task 5 : Extraire DashboardKanban et DashboardAgenda

**Files:**
- Create: `components/dashboard/DashboardKanban.tsx`
- Create: `components/dashboard/DashboardAgenda.tsx`
- Create: `components/dashboard/OrgSummary.tsx`

- [ ] **Step 1 : Créer DashboardKanban**

Copier tout le contenu du bloc Kanban de `app/coach/organisation/page.tsx` (boards, SortableBoardSection, logique DnD) dans un nouveau composant :

```tsx
// components/dashboard/DashboardKanban.tsx
'use client'

// Copier exactement les imports et la logique kanban depuis app/coach/organisation/page.tsx
// Les fonctions : SortableBoardSection, logique boards CRUD, DnD handlers
// Props exposées : aucune (gère son propre état)
// Exporter : export default function DashboardKanban()
```

Contenu exact : lignes 1-192 et 417-750 de `app/coach/organisation/page.tsx` (tout sauf DashboardTab et AgendaTab).

- [ ] **Step 2 : Créer DashboardAgenda**

```tsx
// components/dashboard/DashboardAgenda.tsx
'use client'

import { useState, useCallback } from 'react'
import AgendaCalendar, { type AgendaEvent } from '@/components/ui/AgendaCalendar'
import { useSetTopBar } from '@/components/layout/useSetTopBar'

export default function DashboardAgenda() {
  const [agendaModalOpen, setAgendaModalOpen] = useState(false)
  const openNewEvent = useCallback(() => setAgendaModalOpen(true), [])

  return (
    <AgendaCalendar
      modalOpen={agendaModalOpen}
      onModalClose={() => setAgendaModalOpen(false)}
      onNewEvent={openNewEvent}
    />
  )
}
```

- [ ] **Step 3 : Créer OrgSummary (DashboardTab extrait)**

```tsx
// components/dashboard/OrgSummary.tsx
'use client'

// Copier exactement la fonction DashboardTab depuis app/coach/organisation/page.tsx (lignes 193-415)
// Renommer en OrgSummary
// Garder les mêmes imports (Calendar, KanbanBoard types, AgendaEvent, fetch /api/organisation/*)
// Props : { boards: KanbanBoardType[] }
// Export : export default function OrgSummary({ boards }: { boards: KanbanBoardType[] })
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/DashboardKanban\|dashboard/DashboardAgenda\|dashboard/OrgSummary"
```

Corriger toute erreur avant de continuer.

- [ ] **Step 5 : Commit**

```bash
git add components/dashboard/DashboardKanban.tsx components/dashboard/DashboardAgenda.tsx components/dashboard/OrgSummary.tsx
git commit -m "feat(dashboard): extract Kanban, Agenda, OrgSummary components"
```

---

## Task 6 : Réécrire app/dashboard/page.tsx

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1 : Réécrire la page**

```tsx
// app/dashboard/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useSetTopBar } from '@/components/layout/useSetTopBar'
import { Skeleton } from '@/components/ui/skeleton'

import WelcomeHeader from '@/components/dashboard/WelcomeHeader'
import SummaryPanel from '@/components/dashboard/SummaryPanel'
import DashboardSubNav, { type DashboardView } from '@/components/dashboard/DashboardSubNav'
import DashboardKanban from '@/components/dashboard/DashboardKanban'
import DashboardAgenda from '@/components/dashboard/DashboardAgenda'
import type { DashboardCoachData } from '@/components/dashboard/types'

const VIEW_STORAGE_KEY = 'dashboard_active_view'

function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardCoachData | null>(null)
  const [onboarding, setOnboarding] = useState<{ hasClient: boolean; hasTemplate: boolean; hasFormula: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<DashboardView>('resume')

  // Restaurer vue depuis localStorage
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as DashboardView | null
    if (stored && ['resume', 'kanban', 'agenda'].includes(stored)) {
      setView(stored)
    }
  }, [])

  const handleViewChange = (v: DashboardView) => {
    setView(v)
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }

      Promise.all([
        fetch('/api/dashboard/coach').then(r => r.json()),
        fetch('/api/dashboard/onboarding').then(r => r.json()),
      ])
        .then(([dashJson, onboardingJson]) => {
          if (dashJson.success && dashJson.data) setData(dashJson.data)
          setOnboarding(onboardingJson)
        })
        .catch(() => { /* silent */ })
        .finally(() => setLoading(false))
    })
  }, [router])

  const topBarLeft = useMemo(() => (
    <div className="flex flex-col leading-tight">
      <p className="text-[9px] font-medium text-white/30 uppercase tracking-[0.14em]">Espace Coach</p>
      <p className="text-[13px] font-semibold text-white">Accueil</p>
    </div>
  ), [])

  useSetTopBar(topBarLeft)

  if (loading) return <DashboardSkeleton />

  return (
    <main className="bg-[#121212] min-h-screen">
      <div className="p-6 max-w-[1200px] mx-auto">
        {/* Welcome header onboarding */}
        {onboarding && <WelcomeHeader state={onboarding} />}

        {/* Résumé collapsible — toujours visible */}
        {data && <SummaryPanel data={data} />}

        {/* Sub-nav vues */}
        <DashboardSubNav active={view} onChange={handleViewChange} />

        {/* Vue active */}
        {view === 'resume' && (
          <div className="rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-6 text-center">
            <p className="text-[13px] text-white/30">Tout est sous contrôle.</p>
          </div>
        )}
        {view === 'kanban' && <DashboardKanban />}
        {view === 'agenda' && <DashboardAgenda />}
      </div>
    </main>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/page"
```

- [ ] **Step 3 : Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(dashboard): rewrite page — WelcomeHeader + SummaryPanel + SubNav + views"
```

---

## Task 7 : Redirection /coach/organisation → /dashboard

**Files:**
- Modify: `app/coach/organisation/page.tsx`

- [ ] **Step 1 : Remplacer par redirect**

```tsx
// app/coach/organisation/page.tsx
import { redirect } from 'next/navigation'

export default function OrganisationPage() {
  redirect('/dashboard')
}
```

- [ ] **Step 2 : Commit**

```bash
git add app/coach/organisation/page.tsx
git commit -m "feat(dashboard): redirect /coach/organisation → /dashboard"
```

---

## Task 8 : Corriger la navigation

**Files:**
- Modify: `components/layout/NavDock/NavRowB.tsx`
- Modify: `components/layout/NavDock/useNavConfig.ts`

- [ ] **Step 1 : Corriger NavRowB.tsx**

Ligne 18 — changer href :

```typescript
// Avant
href: "/coach/organisation",
match: (p: string) => p === "/coach/organisation" || p === "/dashboard",

// Après
href: "/dashboard",
match: (p: string) => p === "/dashboard",
```

- [ ] **Step 2 : Corriger useNavConfig.ts**

```typescript
// Avant (ligne 26)
if (pathname === "/coach/organisation" || pathname === "/dashboard") {

// Après
if (pathname === "/dashboard") {
```

- [ ] **Step 3 : Vérifier DockLeft.tsx**

```bash
grep "href.*dashboard\|href.*organisation" components/layout/DockLeft.tsx
```

Si `href: "/coach/organisation"` présent → remplacer par `"/dashboard"`. Si déjà `/dashboard` → rien à faire.

- [ ] **Step 4 : Vérifier TypeScript final**

```bash
npx tsc --noEmit 2>&1 | head -20
```

0 erreurs nouvelles requises.

- [ ] **Step 5 : Commit**

```bash
git add components/layout/NavDock/NavRowB.tsx components/layout/NavDock/useNavConfig.ts components/layout/DockLeft.tsx
git commit -m "fix(nav): Accueil → /dashboard partout, supprimer référence /coach/organisation"
```

---

## Task 9 : Nettoyer le log temporaire + CHANGELOG

**Files:**
- Modify: `app/auth/login/actions.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1 : Supprimer le log de debug signup**

Dans `app/auth/login/actions.ts`, supprimer la ligne :

```typescript
console.log("[signup] supabase result:", { error: error?.message ?? null });
```

- [ ] **Step 2 : Mettre à jour CHANGELOG.md**

Ajouter sous `## 2026-05-04` :

```
FEATURE: Dashboard home — WelcomeHeader onboarding 3 étapes, SummaryPanel collapsible, sub-nav Résumé/Kanban/Agenda
REFACTOR: /coach/organisation redirige → /dashboard, nav Accueil unifiée
FIX: nav Accueil pointait vers /coach/organisation au lieu de /dashboard
```

- [ ] **Step 3 : Commit final**

```bash
git add app/auth/login/actions.ts CHANGELOG.md
git commit -m "chore: remove debug log, update CHANGELOG"
```
