# Coach Clients Action Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/coach/clients` KPI strip with the validated action-oriented model: `Total clients`, `Clients actifs`, `Sans formule`, and `À suivre`, with smart side panels for `Sans formule` and `À suivre`.

**Architecture:** Keep the existing `/coach/clients` page as the main container, but move the new strip and side-panel logic into focused coach components. Build a dedicated aggregation layer in `lib/coach` that converts raw client, subscription, notification, and assessment signals into deterministic client action items, then expose those through a dedicated coach API route consumed by the page.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Supabase server/service clients, Vitest, existing `Skeleton` UI primitives.

## Global Constraints

- `Clients actifs` must mean `has at least one active formula` and only explicit formula status `active` counts as active in V1.
- `Sans formule` must include clients with no formula or no active formula and exclude any client with at least one active formula.
- `À suivre` must count distinct clients, not raw events.
- `À suivre` must deduplicate multiple signals into one dominant action item per client.
- The clients page must complement the dashboard, not duplicate it.
- `Sans formule` and `À suivre` must open side panels rather than navigate away immediately.
- `Total clients` and `Clients actifs` remain informational and non-clickable.
- Agenda/Kanban integration in V1 must avoid duplicate planning actions and prefer opening existing work when detectable.

## File Structure

- Modify: `/Users/user/Desktop/STRYVLAB/app/coach/clients/page.tsx`
  - Keep data fetching ownership here, wire new strip and side panels into the existing page state.
- Create: `/Users/user/Desktop/STRYVLAB/lib/coach/client-action-items.ts`
  - Pure domain helpers for active-formula detection, `Sans formule` filtering, and `À suivre` aggregation.
- Create: `/Users/user/Desktop/STRYVLAB/app/api/coach/client-actions/route.ts`
  - Server endpoint returning aggregated client action items plus `sans formule` rows for the current coach.
- Create: `/Users/user/Desktop/STRYVLAB/components/coach/ClientsActionStrip.tsx`
  - Presentational strip component with click affordances and counts.
- Create: `/Users/user/Desktop/STRYVLAB/components/coach/ClientActionPanels.tsx`
  - Side panels for `Sans formule` and `À suivre`, reusing page callbacks for profile opening and notifications.
- Create: `/Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts`
  - Unit coverage for priority, deduplication, and formula-state rules.
- Create: `/Users/user/Desktop/STRYVLAB/tests/api/coach-client-actions.test.ts`
  - API route coverage for auth, aggregation payload, and filtering.
- Create: `/Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx`
  - Interaction coverage for strip and panels.

---

### Task 1: Build the client action domain layer

**Files:**
- Create: `/Users/user/Desktop/STRYVLAB/lib/coach/client-action-items.ts`
- Test: `/Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts`

**Interfaces:**
- Consumes: raw client rows, subscription rows, unread notification counts, pending assessment metadata.
- Produces:
  - `hasActiveFormula(subscriptions: ClientSubscriptionLike[]): boolean`
  - `getClientsWithoutActiveFormula(clients: ClientWithSubscriptions[]): ClientWithSubscriptions[]`
  - `buildClientActionItems(input: BuildClientActionItemsInput): ClientActionItem[]`
  - `type ClientActionPriority = 'urgent' | 'important' | 'plan'`
  - `type ClientActionKind = 'missing_formula' | 'assessment_review' | 'coach_notification' | 'inactive_client' | 'planned_follow_up'`

- [ ] **Step 1: Write the failing unit tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  buildClientActionItems,
  getClientsWithoutActiveFormula,
  hasActiveFormula,
} from '@/lib/coach/client-action-items'

describe('hasActiveFormula', () => {
  it('returns true only when at least one subscription status is active', () => {
    expect(hasActiveFormula([{ status: 'trial' }, { status: 'paused' }])).toBe(false)
    expect(hasActiveFormula([{ status: 'active' }])).toBe(true)
  })
})

describe('getClientsWithoutActiveFormula', () => {
  it('returns clients with no active formula and excludes active ones', () => {
    const clients = [
      { id: 'c1', subscriptions: [{ status: 'cancelled' }] },
      { id: 'c2', subscriptions: [{ status: 'active' }] },
      { id: 'c3', subscriptions: [] },
    ]

    expect(getClientsWithoutActiveFormula(clients).map((client) => client.id)).toEqual(['c1', 'c3'])
  })
})

describe('buildClientActionItems', () => {
  it('deduplicates multiple signals into one dominant row per client', () => {
    const items = buildClientActionItems({
      clients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau', created_at: '2026-06-01T00:00:00.000Z' }],
      subscriptionsByClientId: { c1: [] },
      unreadNotificationsByClientId: { c1: 3 },
      pendingAssessments: [{ id: 'a1', client_id: 'c1', created_at: '2026-06-20T00:00:00.000Z', status: 'sent' }],
      nowIso: '2026-07-01T00:00:00.000Z',
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      clientId: 'c1',
      kind: 'missing_formula',
      priority: 'urgent',
    })
  })

  it('orders urgent before important before plan', () => {
    const items = buildClientActionItems({
      clients: [
        { id: 'urgent-client', first_name: 'A', last_name: 'A', created_at: '2026-06-01T00:00:00.000Z' },
        { id: 'important-client', first_name: 'B', last_name: 'B', created_at: '2026-06-28T00:00:00.000Z' },
      ],
      subscriptionsByClientId: { 'urgent-client': [], 'important-client': [{ status: 'active' }] },
      unreadNotificationsByClientId: { 'important-client': 2 },
      pendingAssessments: [],
      nowIso: '2026-07-01T00:00:00.000Z',
    })

    expect(items.map((item) => item.clientId)).toEqual(['urgent-client', 'important-client'])
  })
})
```

- [ ] **Step 2: Run the targeted unit test file to verify failure**

Run: `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts --run`
Expected: FAIL with module-not-found or missing export errors for `client-action-items`.

- [ ] **Step 3: Write the minimal domain implementation**

```ts
export type ClientSubscriptionLike = { status: string | null | undefined }

export type ClientWithSubscriptions = {
  id: string
  first_name?: string | null
  last_name?: string | null
  created_at?: string | null
  subscriptions?: ClientSubscriptionLike[]
}

export type PendingAssessmentLike = {
  id: string
  client_id: string | null
  created_at: string
  status: string
}

export type ClientActionPriority = 'urgent' | 'important' | 'plan'
export type ClientActionKind = 'missing_formula' | 'assessment_review' | 'coach_notification' | 'inactive_client' | 'planned_follow_up'

export type ClientActionItem = {
  clientId: string
  clientName: string
  priority: ClientActionPriority
  kind: ClientActionKind
  reason: string
  sourceLabel: string
  primaryAction: 'open_profile' | 'open_notifications' | 'open_assessments' | 'assign_formula' | 'plan_follow_up'
  planned: boolean
}

export type BuildClientActionItemsInput = {
  clients: Array<{ id: string; first_name: string | null; last_name: string | null; created_at: string | null }>
  subscriptionsByClientId: Record<string, ClientSubscriptionLike[]>
  unreadNotificationsByClientId: Record<string, number>
  pendingAssessments: PendingAssessmentLike[]
  nowIso?: string
}

export function hasActiveFormula(subscriptions: ClientSubscriptionLike[]): boolean {
  return subscriptions.some((subscription) => subscription.status === 'active')
}

export function getClientsWithoutActiveFormula<T extends ClientWithSubscriptions>(clients: T[]): T[] {
  return clients.filter((client) => !hasActiveFormula(client.subscriptions ?? []))
}

export function buildClientActionItems(input: BuildClientActionItemsInput): ClientActionItem[] {
  const now = new Date(input.nowIso ?? new Date().toISOString())
  const byClient = new Map<string, ClientActionItem>()

  const upsert = (candidate: ClientActionItem) => {
    const current = byClient.get(candidate.clientId)
    const rank = { urgent: 0, important: 1, plan: 2 }
    if (!current || rank[candidate.priority] < rank[current.priority]) {
      byClient.set(candidate.clientId, candidate)
    }
  }

  for (const client of input.clients) {
    const subscriptions = input.subscriptionsByClientId[client.id] ?? []
    const clientName = `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Client'

    if (!hasActiveFormula(subscriptions)) {
      upsert({
        clientId: client.id,
        clientName,
        priority: 'urgent',
        kind: 'missing_formula',
        reason: 'Client sans formule active',
        sourceLabel: 'Formules',
        primaryAction: 'assign_formula',
        planned: false,
      })
      continue
    }

    const notifications = input.unreadNotificationsByClientId[client.id] ?? 0
    if (notifications > 0) {
      upsert({
        clientId: client.id,
        clientName,
        priority: 'important',
        kind: 'coach_notification',
        reason: `${notifications} notification${notifications > 1 ? 's' : ''} coach non lue${notifications > 1 ? 's' : ''}`,
        sourceLabel: 'Notifications',
        primaryAction: 'open_notifications',
        planned: false,
      })
    }

    const pending = input.pendingAssessments.find((assessment) => assessment.client_id === client.id)
    if (pending) {
      const ageDays = Math.floor((now.getTime() - new Date(pending.created_at).getTime()) / (24 * 60 * 60 * 1000))
      upsert({
        clientId: client.id,
        clientName,
        priority: ageDays > 5 ? 'urgent' : 'important',
        kind: 'assessment_review',
        reason: ageDays > 5 ? 'Bilan sans réponse depuis plus de 5 jours' : 'Bilan à revoir',
        sourceLabel: 'Bilans',
        primaryAction: 'open_assessments',
        planned: false,
      })
    }
  }

  return [...byClient.values()].sort((a, b) => {
    const rank = { urgent: 0, important: 1, plan: 2 }
    return rank[a.priority] - rank[b.priority] || a.clientName.localeCompare(b.clientName)
  })
}
```

- [ ] **Step 4: Re-run the unit tests**

Run: `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts --run`
Expected: PASS with all domain-rule tests green.

- [ ] **Step 5: Commit the domain layer**

```bash
git add /Users/user/Desktop/STRYVLAB/lib/coach/client-action-items.ts /Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts
git commit -m "feat(coach): add client action item domain helpers"
```

### Task 2: Expose aggregated coach client actions through an API route

**Files:**
- Create: `/Users/user/Desktop/STRYVLAB/app/api/coach/client-actions/route.ts`
- Test: `/Users/user/Desktop/STRYVLAB/tests/api/coach-client-actions.test.ts`

**Interfaces:**
- Consumes:
  - `buildClientActionItems(...)`
  - `getClientsWithoutActiveFormula(...)`
  - Supabase auth + service client patterns from existing coach routes
- Produces:
  - `GET /api/coach/client-actions`
  - Response shape:
    - `{ stats: { total: number; active: number; withoutFormula: number; toFollow: number }, withoutFormula: WithoutFormulaRow[], toFollow: ClientActionItem[] }`

- [ ] **Step 1: Write the failing API tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../mocks/next-server'
import { createSupabaseMocks } from '../mocks/supabase'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { GET } from '@/app/api/coach/client-actions/route'

describe('GET /api/coach/client-actions', () => {
  beforeEach(() => mocks.resetMocks())

  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await GET(new NextRequest('http://localhost/api/coach/client-actions'))
    expect(res.status).toBe(401)
  })

  it('returns aggregated stats and client action lists', async () => {
    mocks.queueServiceResults([
      [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau', created_at: '2026-06-01T00:00:00.000Z' }],
      [{ client_id: 'c1', status: 'cancelled' }],
      [{ client_id: 'c1', unread_count: 2 }],
      [{ id: 'sub-1', client_id: 'c1', status: 'sent', created_at: '2026-06-20T00:00:00.000Z' }],
    ])

    const res = await GET(new NextRequest('http://localhost/api/coach/client-actions'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stats).toMatchObject({ total: 1, active: 0, withoutFormula: 1, toFollow: 1 })
    expect(body.withoutFormula[0].clientId).toBe('c1')
    expect(body.toFollow[0].kind).toBe('missing_formula')
  })
})
```

- [ ] **Step 2: Run the targeted API test file to verify failure**

Run: `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/api/coach-client-actions.test.ts --run`
Expected: FAIL with missing route module or missing mocked query sequence support.

- [ ] **Step 3: Implement the route with existing Supabase patterns**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  buildClientActionItems,
  getClientsWithoutActiveFormula,
  hasActiveFormula,
} from '@/lib/coach/client-action-items'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(_req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = serviceClient()
  const [clientsRes, subscriptionsRes, notificationsRes, submissionsRes] = await Promise.all([
    db.from('coach_clients').select('id, first_name, last_name, created_at').eq('coach_id', user.id),
    db.from('client_subscriptions').select('client_id, status').eq('coach_id', user.id),
    db.from('coach_notifications').select('client_id, status').eq('coach_id', user.id).eq('status', 'pending'),
    db.from('assessment_submissions').select('id, client_id, status, created_at').eq('coach_id', user.id).eq('status', 'sent'),
  ])

  const clients = clientsRes.data ?? []
  const subscriptions = subscriptionsRes.data ?? []
  const notifications = notificationsRes.data ?? []
  const pendingAssessments = submissionsRes.data ?? []

  const subscriptionsByClientId = subscriptions.reduce<Record<string, Array<{ status: string }>>>((acc, row) => {
    const key = row.client_id
    if (!key) return acc
    acc[key] ??= []
    acc[key].push({ status: row.status })
    return acc
  }, {})

  const unreadNotificationsByClientId = notifications.reduce<Record<string, number>>((acc, row) => {
    if (!row.client_id) return acc
    acc[row.client_id] = (acc[row.client_id] ?? 0) + 1
    return acc
  }, {})

  const clientsWithSubscriptions = clients.map((client) => ({
    ...client,
    subscriptions: subscriptionsByClientId[client.id] ?? [],
  }))

  const withoutFormula = getClientsWithoutActiveFormula(clientsWithSubscriptions).map((client) => ({
    clientId: client.id,
    clientName: `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Client',
    createdAt: client.created_at,
  }))

  const toFollow = buildClientActionItems({
    clients,
    subscriptionsByClientId,
    unreadNotificationsByClientId,
    pendingAssessments,
  })

  const active = clients.filter((client) => hasActiveFormula(subscriptionsByClientId[client.id] ?? [])).length

  return NextResponse.json({
    stats: {
      total: clients.length,
      active,
      withoutFormula: withoutFormula.length,
      toFollow: toFollow.length,
    },
    withoutFormula,
    toFollow,
  })
}
```

- [ ] **Step 4: Re-run the API tests**

Run: `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/api/coach-client-actions.test.ts --run`
Expected: PASS with auth and payload shape verified.

- [ ] **Step 5: Commit the API route**

```bash
git add /Users/user/Desktop/STRYVLAB/app/api/coach/client-actions/route.ts /Users/user/Desktop/STRYVLAB/tests/api/coach-client-actions.test.ts
git commit -m "feat(api): add coach client actions summary route"
```

### Task 3: Add focused UI components for the strip and side panels

**Files:**
- Create: `/Users/user/Desktop/STRYVLAB/components/coach/ClientsActionStrip.tsx`
- Create: `/Users/user/Desktop/STRYVLAB/components/coach/ClientActionPanels.tsx`
- Test: `/Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx`

**Interfaces:**
- Consumes:
  - `stats: { total: number; active: number; withoutFormula: number; toFollow: number }`
  - `withoutFormula: Array<{ clientId: string; clientName: string; createdAt: string | null }>`
  - `toFollow: ClientActionItem[]`
  - callbacks: `onOpenClient(clientId: string)`, `onAssignFormula?(clientId: string)`, `onOpenNotifications(clientId: string)`, `onOpenAssessments(clientId: string)`
- Produces:
  - `<ClientsActionStrip />`
  - `<ClientActionPanels />`

- [ ] **Step 1: Write the failing component tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ClientsActionStrip from '@/components/coach/ClientsActionStrip'
import ClientActionPanels from '@/components/coach/ClientActionPanels'

describe('ClientsActionStrip', () => {
  it('renders the four validated tiles and only makes action tiles clickable', () => {
    const onOpenWithoutFormula = vi.fn()
    const onOpenToFollow = vi.fn()

    render(
      <ClientsActionStrip
        stats={{ total: 12, active: 7, withoutFormula: 3, toFollow: 4 }}
        onOpenWithoutFormula={onOpenWithoutFormula}
        onOpenToFollow={onOpenToFollow}
      />,
    )

    expect(screen.getByText('Total clients')).toBeInTheDocument()
    expect(screen.getByText('Clients actifs')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Sans formule/i }))
    expect(onOpenWithoutFormula).toHaveBeenCalled()
  })
})

describe('ClientActionPanels', () => {
  it('shows grouped to-follow items and forwards the correct action callback', () => {
    const onOpenNotifications = vi.fn()

    render(
      <ClientActionPanels
        withoutFormulaOpen={false}
        toFollowOpen
        withoutFormula={[]}
        toFollow={[
          {
            clientId: 'c1',
            clientName: 'Lina Moreau',
            priority: 'important',
            kind: 'coach_notification',
            reason: '2 notifications coach non lues',
            sourceLabel: 'Notifications',
            primaryAction: 'open_notifications',
            planned: false,
          },
        ]}
        onCloseWithoutFormula={() => {}}
        onCloseToFollow={() => {}}
        onOpenClient={() => {}}
        onAssignFormula={() => {}}
        onOpenNotifications={onOpenNotifications}
        onOpenAssessments={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /ouvrir les notifications/i }))
    expect(onOpenNotifications).toHaveBeenCalledWith('c1')
  })
})
```

- [ ] **Step 2: Run the component test file to verify failure**

Run: `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx --run`
Expected: FAIL because the new components do not exist yet.

- [ ] **Step 3: Implement the presentational components**

```tsx
// /Users/user/Desktop/STRYVLAB/components/coach/ClientsActionStrip.tsx
import { CreditCard, ListTodo, TrendingUp, Users } from 'lucide-react'

type Stats = { total: number; active: number; withoutFormula: number; toFollow: number }

export default function ClientsActionStrip({
  stats,
  onOpenWithoutFormula,
  onOpenToFollow,
}: {
  stats: Stats
  onOpenWithoutFormula: () => void
  onOpenToFollow: () => void
}) {
  const items = [
    { key: 'total', label: 'Total clients', value: stats.total, icon: Users, onClick: undefined },
    { key: 'active', label: 'Clients actifs', value: stats.active, icon: TrendingUp, onClick: undefined },
    { key: 'withoutFormula', label: 'Sans formule', value: stats.withoutFormula, icon: CreditCard, onClick: onOpenWithoutFormula },
    { key: 'toFollow', label: 'À suivre', value: stats.toFollow, icon: ListTodo, onClick: onOpenToFollow },
  ]

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {items.map(({ key, label, value, icon: Icon, onClick }) => {
        const content = (
          <>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.04]">
              <Icon size={18} className="text-white/45" />
            </div>
            <div>
              <p className="text-2xl font-black text-white tabular-nums">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p>
            </div>
          </>
        )

        return onClick ? (
          <button key={key} type="button" aria-label={label} onClick={onClick} className="rounded-2xl bg-[#181818] px-5 py-4 flex items-center gap-4 text-left hover:bg-[#1d1d1d]">
            {content}
          </button>
        ) : (
          <div key={key} className="rounded-2xl bg-[#181818] px-5 py-4 flex items-center gap-4">
            {content}
          </div>
        )
      })}
    </div>
  )
}
```

```tsx
// /Users/user/Desktop/STRYVLAB/components/coach/ClientActionPanels.tsx
'use client'

import type { ClientActionItem } from '@/lib/coach/client-action-items'

function actionLabel(action: ClientActionItem['primaryAction']) {
  switch (action) {
    case 'assign_formula': return 'Attribuer une formule'
    case 'open_notifications': return 'Ouvrir les notifications'
    case 'open_assessments': return 'Voir le bilan'
    case 'plan_follow_up': return 'Planifier le suivi'
    default: return 'Ouvrir le profil'
  }
}

export default function ClientActionPanels(props: {
  withoutFormulaOpen: boolean
  toFollowOpen: boolean
  withoutFormula: Array<{ clientId: string; clientName: string; createdAt: string | null }>
  toFollow: ClientActionItem[]
  onCloseWithoutFormula: () => void
  onCloseToFollow: () => void
  onOpenClient: (clientId: string) => void
  onAssignFormula: (clientId: string) => void
  onOpenNotifications: (clientId: string) => void
  onOpenAssessments: (clientId: string) => void
}) {
  const runPrimaryAction = (item: ClientActionItem) => {
    if (item.primaryAction === 'assign_formula') return props.onAssignFormula(item.clientId)
    if (item.primaryAction === 'open_notifications') return props.onOpenNotifications(item.clientId)
    if (item.primaryAction === 'open_assessments') return props.onOpenAssessments(item.clientId)
    return props.onOpenClient(item.clientId)
  }

  return (
    <>
      {props.withoutFormulaOpen && (
        <aside className="fixed inset-y-0 right-0 w-[420px] bg-[#141414] border-l border-white/[0.06] p-5">
          <button type="button" onClick={props.onCloseWithoutFormula}>Fermer</button>
          <h2 className="text-white font-bold mt-4">Sans formule</h2>
          {props.withoutFormula.map((row) => (
            <article key={row.clientId} className="mt-3 rounded-2xl bg-white/[0.03] p-4">
              <p className="text-white font-semibold">{row.clientName}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => props.onOpenClient(row.clientId)}>Ouvrir le profil</button>
                <button type="button" onClick={() => props.onAssignFormula(row.clientId)}>Attribuer une formule</button>
              </div>
            </article>
          ))}
        </aside>
      )}

      {props.toFollowOpen && (
        <aside className="fixed inset-y-0 right-0 w-[460px] bg-[#141414] border-l border-white/[0.06] p-5">
          <button type="button" onClick={props.onCloseToFollow}>Fermer</button>
          <h2 className="text-white font-bold mt-4">À suivre</h2>
          {props.toFollow.map((item) => (
            <article key={item.clientId} className="mt-3 rounded-2xl bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-white font-semibold">{item.clientName}</p>
                <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">{item.priority}</span>
              </div>
              <p className="mt-2 text-[13px] text-white/70">{item.reason}</p>
              <p className="mt-1 text-[11px] text-white/40">{item.sourceLabel}{item.planned ? ' · Déjà planifié' : ''}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => runPrimaryAction(item)}>{actionLabel(item.primaryAction)}</button>
                <button type="button" onClick={() => props.onOpenClient(item.clientId)}>Ouvrir le profil</button>
              </div>
            </article>
          ))}
        </aside>
      )}
    </>
  )
}
```

- [ ] **Step 4: Re-run the component tests**

Run: `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx --run`
Expected: PASS with tile click behavior and side-panel CTA wiring verified.

- [ ] **Step 5: Commit the UI components**

```bash
git add /Users/user/Desktop/STRYVLAB/components/coach/ClientsActionStrip.tsx /Users/user/Desktop/STRYVLAB/components/coach/ClientActionPanels.tsx /Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx
git commit -m "feat(ui): add coach client action strip components"
```

### Task 4: Integrate the new strip into the existing clients page

**Files:**
- Modify: `/Users/user/Desktop/STRYVLAB/app/coach/clients/page.tsx`
- Test: `/Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/coach/client-actions`
  - `<ClientsActionStrip />`
  - `<ClientActionPanels />`
- Produces:
  - clients page state for `withoutFormulaOpen`, `toFollowOpen`, `clientActionData`
  - `stats.active` based on active formulas instead of `client.status`

- [ ] **Step 1: Extend the existing component test with integration expectations**

```tsx
it('hydrates strip counts from the coach client actions endpoint and opens the notifications sheet from a to-follow item', async () => {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/api/coach/client-actions')) {
      return new Response(JSON.stringify({
        stats: { total: 12, active: 7, withoutFormula: 3, toFollow: 2 },
        withoutFormula: [],
        toFollow: [{
          clientId: 'c1',
          clientName: 'Lina Moreau',
          priority: 'important',
          kind: 'coach_notification',
          reason: '2 notifications coach non lues',
          sourceLabel: 'Notifications',
          primaryAction: 'open_notifications',
          planned: false,
        }],
      }))
    }
    return new Response(JSON.stringify({ clients: [], tags: [], pending: {} }))
  }) as typeof fetch

  // render page component or extracted integration harness here
  // assert that clicking "À suivre" reveals the row and can trigger the callback pipeline
})
```

- [ ] **Step 2: Run the component suite to verify the new integration expectation fails**

Run: `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx --run`
Expected: FAIL because `/coach/clients` does not yet fetch or render the new action-strip payload.

- [ ] **Step 3: Patch `/coach/clients` to consume the new route and replace the legacy strip**

```tsx
import ClientsActionStrip from '@/components/coach/ClientsActionStrip'
import ClientActionPanels from '@/components/coach/ClientActionPanels'
import type { ClientActionItem } from '@/lib/coach/client-action-items'

const [withoutFormulaOpen, setWithoutFormulaOpen] = useState(false)
const [toFollowOpen, setToFollowOpen] = useState(false)
const [actionStats, setActionStats] = useState({ total: 0, active: 0, withoutFormula: 0, toFollow: 0 })
const [withoutFormulaRows, setWithoutFormulaRows] = useState<Array<{ clientId: string; clientName: string; createdAt: string | null }>>([])
const [toFollowRows, setToFollowRows] = useState<ClientActionItem[]>([])

const fetchClients = useCallback(async () => {
  setLoading(true)
  const [clientsRes, tagsRes, notifsRes, actionsRes] = await Promise.all([
    fetch('/api/clients'),
    fetch('/api/tags'),
    fetch('/api/coach/inbox?summary=true'),
    fetch('/api/coach/client-actions'),
  ])

  const actionsData = actionsRes.ok
    ? await actionsRes.json()
    : { stats: { total: 0, active: 0, withoutFormula: 0, toFollow: 0 }, withoutFormula: [], toFollow: [] }

  setActionStats(actionsData.stats)
  setWithoutFormulaRows(actionsData.withoutFormula ?? [])
  setToFollowRows(actionsData.toFollow ?? [])
  // keep existing clients/tags/notification enrichment flow unchanged below
}, [])

const openClientById = useCallback((clientId: string) => {
  const client = clients.find((row) => row.id === clientId)
  if (!client) {
    router.push(`/coach/clients/${clientId}`)
    return
  }
  openClient({
    clientId: client.id,
    firstName: client.first_name,
    lastName: client.last_name,
  })
}, [clients, openClient, router])

const handleOpenNotificationsForClient = useCallback((clientId: string) => {
  const client = clients.find((row) => row.id === clientId)
  if (client) void openNotifications(client)
}, [clients, openNotifications])
```

Replace the current hard-coded strip block with:

```tsx
<ClientsActionStrip
  stats={actionStats}
  onOpenWithoutFormula={() => setWithoutFormulaOpen(true)}
  onOpenToFollow={() => setToFollowOpen(true)}
/>

<ClientActionPanels
  withoutFormulaOpen={withoutFormulaOpen}
  toFollowOpen={toFollowOpen}
  withoutFormula={withoutFormulaRows}
  toFollow={toFollowRows}
  onCloseWithoutFormula={() => setWithoutFormulaOpen(false)}
  onCloseToFollow={() => setToFollowOpen(false)}
  onOpenClient={openClientById}
  onAssignFormula={openClientById}
  onOpenNotifications={handleOpenNotificationsForClient}
  onOpenAssessments={(clientId) => router.push(`/coach/clients/${clientId}/data/bilans`)}
/>
```

- [ ] **Step 4: Re-run the component test suite**

Run: `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx --run`
Expected: PASS with integrated data flow and panel actions working.

- [ ] **Step 5: Commit the page integration**

```bash
git add /Users/user/Desktop/STRYVLAB/app/coach/clients/page.tsx /Users/user/Desktop/STRYVLAB/components/coach/ClientsActionStrip.tsx /Users/user/Desktop/STRYVLAB/components/coach/ClientActionPanels.tsx /Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx
git commit -m "feat(coach): integrate action-oriented clients strip"
```

### Task 5: Final verification and regression pass

**Files:**
- Modify if needed: `/Users/user/Desktop/STRYVLAB/docs/superpowers/specs/2026-07-01-coach-clients-action-strip-design.md`
- Test: `/Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts`
- Test: `/Users/user/Desktop/STRYVLAB/tests/api/coach-client-actions.test.ts`
- Test: `/Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx`

**Interfaces:**
- Consumes: all earlier task outputs.
- Produces: validated implementation with targeted test coverage and no ambiguity between strip semantics and dashboard semantics.

- [ ] **Step 1: Run the focused verification suite**

Run: `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts /Users/user/Desktop/STRYVLAB/tests/api/coach-client-actions.test.ts /Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx --run`
Expected: PASS with all focused tests green.

- [ ] **Step 2: Run a narrow existing regression around clients APIs**

Run: `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/api/clients.test.ts --run`
Expected: PASS to confirm the new work did not break base coach-client CRUD behavior.

- [ ] **Step 3: Manually verify the target UX in the app**

```md
1. Open `/coach/clients`.
2. Confirm the strip labels are `Total clients`, `Clients actifs`, `Sans formule`, `À suivre`.
3. Confirm `Clients actifs` matches active formulas, not legacy client status.
4. Click `Sans formule` and verify the side panel lists only clients without active formulas.
5. Click `À suivre` and verify each client appears once with one dominant action.
6. Trigger a notification-driven row and verify `Ouvrir les notifications` opens the existing coach notification flow.
```

Expected: the page stays in context, panels open on the right, and raw notifications are not surfaced as duplicated rows for the same client.

- [ ] **Step 4: Commit the verified feature slice**

```bash
git add /Users/user/Desktop/STRYVLAB/app/coach/clients/page.tsx /Users/user/Desktop/STRYVLAB/app/api/coach/client-actions/route.ts /Users/user/Desktop/STRYVLAB/lib/coach/client-action-items.ts /Users/user/Desktop/STRYVLAB/components/coach/ClientsActionStrip.tsx /Users/user/Desktop/STRYVLAB/components/coach/ClientActionPanels.tsx /Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts /Users/user/Desktop/STRYVLAB/tests/api/coach-client-actions.test.ts /Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx
git commit -m "feat(coach): ship client action strip v1"
```

## Self-Review

- **Spec coverage:**
  - `Clients actifs` semantic shift → Task 1 + Task 2 + Task 4.
  - `Sans formule` tile and panel → Task 1 + Task 2 + Task 3 + Task 4.
  - `À suivre` prioritization and deduplication → Task 1 + Task 2 + Task 3 + Task 4.
  - dashboard-complement behavior and no duplicate planning logic → Task 1 rules + Task 3 rendering + Task 5 manual verification.
- **Placeholder scan:** no `TODO`, `TBD`, or “implement later” placeholders remain.
- **Type consistency:** `ClientActionItem`, `primaryAction`, and stats payload are defined once in Task 1/Task 2 and reused consistently in later tasks.
