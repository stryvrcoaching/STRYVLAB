# Plan Gating V1

**Date:** 2026-06-26  
**Status:** Approved  
**Scope:** Product gating for `Solo`, `Pro`, and `Studio`, with `STRYVR` reserved for `Pro+`

## Understanding Summary

- `Solo` must remain a coherent coach-only delivery system, not a crippled version of `Pro`.
- `Pro` must unlock the real differentiator: the active client experience in `STRYVR`.
- `Studio` must represent team coordination and shared operations, not just a larger client quota.
- Plan value is defined by system depth; client limits only express intensity of usage.
- The primary product boundary is `PDF and coach workspace` in `Solo` versus `client app activation` in `Pro`.
- Gating must be enforced in both UI and server logic, with server enforcement as the source of truth.

## Assumptions

- The current codebase already separates coach surfaces and client app surfaces clearly enough to implement a first gating layer without refactoring the whole product.
- `coach_profiles` is the best first home for plan metadata because it is already the per-coach profile table.
- Stripe and CRM integrations may later become the source for billing synchronization, but not for first capability resolution.
- Existing invited client accounts may exist before gating is introduced; V1 must still block app usage when the owning coach is not entitled.

## Non-Goals

- Full billing automation with Stripe products mapped to plans
- Team seat accounting in V1
- Dynamic feature flags per coach outside of plan-derived capabilities
- Full Studio implementation
- Usage-based billing calculations in product UI

## Decision Log

1. **Decision:** Store plan metadata in `coach_profiles`.  
   **Alternatives considered:** dedicated billing table, Stripe-only source of truth, auth metadata.  
   **Why chosen:** fastest path, existing coach identity table, easy server lookup.

2. **Decision:** Derive capabilities from plan in code instead of storing them in database rows.  
   **Alternatives considered:** persisted entitlement rows, feature flag table.  
   **Why chosen:** simpler V1, lower migration cost, easier reasoning.

3. **Decision:** Use `Solo = no STRYVR`, `Pro = STRYVR enabled` as the primary product boundary.  
   **Alternatives considered:** partial client app in `Solo`, soft restrictions only.  
   **Why chosen:** strongest commercial distinction and simplest product logic.

4. **Decision:** Enforce gating on invitation, client app pages, and client app APIs first.  
   **Alternatives considered:** UI-only gating, broad all-at-once gating.  
   **Why chosen:** highest impact with lowest implementation spread.

5. **Decision:** Treat client limits as secondary to plan depth.  
   **Alternatives considered:** defining `Pro` mainly by volume.  
   **Why chosen:** a coach may need `Pro` for experience depth even with few clients.

## Plan Model

### Plans

- `solo`
- `pro`
- `studio`

### Recommended default limits

- `solo`: `5` active clients
- `pro`: `30` active clients included
- `studio`: custom

### Recommended commercial usage logic

- `Pro` may extend beyond `30` active clients with a per-client surcharge.
- `Studio` becomes relevant for multi-coach operations, team permissions, or larger organizational needs.

## Database Changes

### Existing table

- [`coach_profiles`](/Users/user/Desktop/STRYVLAB/supabase/migrations/20260407_coach_profiles.sql)

### New migration

- `/Users/user/Desktop/STRYVLAB/supabase/migrations/20260626_coach_plan_gating.sql`

### SQL skeleton

```sql
ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS client_limit integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS team_seats integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

ALTER TABLE public.coach_profiles
  ADD CONSTRAINT coach_profiles_plan_check
  CHECK (plan IN ('solo', 'pro', 'studio'));

ALTER TABLE public.coach_profiles
  ADD CONSTRAINT coach_profiles_billing_status_check
  CHECK (billing_status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled'));
```

### Optional backfill

If you want a first commercial preset:

```sql
UPDATE public.coach_profiles
SET
  plan = COALESCE(plan, 'solo'),
  billing_status = COALESCE(billing_status, 'inactive'),
  client_limit = CASE
    WHEN plan = 'solo' THEN 5
    WHEN plan = 'pro' THEN 30
    ELSE client_limit
  END;
```

## Code Files To Create

### 1. Plan definitions

- `/Users/user/Desktop/STRYVLAB/lib/billing/plans.ts`

```ts
export type CoachPlan = 'solo' | 'pro' | 'studio'

export type BillingStatus =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'

export type Capability =
  | 'coach_dashboard_access'
  | 'client_management'
  | 'assessments_and_questionnaires'
  | 'nutrition_protocols'
  | 'training_programs'
  | 'pdf_exports'
  | 'client_app_access'
  | 'client_checkins'
  | 'client_routines'
  | 'client_progress_dashboard'
  | 'adherence_signals'
  | 'smart_recommendations'
  | 'coach_quick_actions'
  | 'team_workspace'
  | 'roles_and_permissions'
  | 'multi_coach_reporting'

export const PLAN_LIMITS: Record<CoachPlan, { clientLimit: number | null; teamSeats: number | null }> = {
  solo: { clientLimit: 5, teamSeats: 1 },
  pro: { clientLimit: 30, teamSeats: 1 },
  studio: { clientLimit: null, teamSeats: null },
}

export const PLAN_CAPABILITIES: Record<CoachPlan, Capability[]> = {
  solo: [
    'coach_dashboard_access',
    'client_management',
    'assessments_and_questionnaires',
    'nutrition_protocols',
    'training_programs',
    'pdf_exports',
  ],
  pro: [
    'coach_dashboard_access',
    'client_management',
    'assessments_and_questionnaires',
    'nutrition_protocols',
    'training_programs',
    'pdf_exports',
    'client_app_access',
    'client_checkins',
    'client_routines',
    'client_progress_dashboard',
    'adherence_signals',
    'smart_recommendations',
    'coach_quick_actions',
  ],
  studio: [
    'coach_dashboard_access',
    'client_management',
    'assessments_and_questionnaires',
    'nutrition_protocols',
    'training_programs',
    'pdf_exports',
    'client_app_access',
    'client_checkins',
    'client_routines',
    'client_progress_dashboard',
    'adherence_signals',
    'smart_recommendations',
    'coach_quick_actions',
    'team_workspace',
    'roles_and_permissions',
    'multi_coach_reporting',
  ],
}

export function getCapabilities(plan: CoachPlan): Set<Capability> {
  return new Set(PLAN_CAPABILITIES[plan] ?? PLAN_CAPABILITIES.solo)
}

export function hasCapability(plan: CoachPlan, capability: Capability): boolean {
  return getCapabilities(plan).has(capability)
}
```

### 2. Coach plan resolver

- `/Users/user/Desktop/STRYVLAB/lib/billing/getCoachPlan.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { PLAN_LIMITS, getCapabilities, type BillingStatus, type CoachPlan } from '@/lib/billing/plans'

export interface CoachPlanState {
  plan: CoachPlan
  billingStatus: BillingStatus
  clientLimit: number | null
  teamSeats: number | null
  capabilities: Set<import('@/lib/billing/plans').Capability>
}

export async function getCoachPlan(
  db: SupabaseClient,
  coachId: string,
): Promise<CoachPlanState> {
  const { data } = await db
    .from('coach_profiles')
    .select('plan, billing_status, client_limit, team_seats')
    .eq('coach_id', coachId)
    .maybeSingle()

  const plan = (data?.plan ?? 'solo') as CoachPlan
  const defaults = PLAN_LIMITS[plan] ?? PLAN_LIMITS.solo

  return {
    plan,
    billingStatus: (data?.billing_status ?? 'inactive') as BillingStatus,
    clientLimit: data?.client_limit ?? defaults.clientLimit,
    teamSeats: data?.team_seats ?? defaults.teamSeats,
    capabilities: getCapabilities(plan),
  }
}
```

### 3. Client app entitlement guard

- `/Users/user/Desktop/STRYVLAB/lib/billing/assertClientAppEnabled.ts`

```ts
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getCoachPlan } from '@/lib/billing/getCoachPlan'
import { hasCapability } from '@/lib/billing/plans'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function assertClientAppEnabledForCoach(coachId: string) {
  const db = service()
  const planState = await getCoachPlan(db, coachId)

  if (!hasCapability(planState.plan, 'client_app_access')) {
    const error = new Error('Client app access is not enabled for this coach plan.')
    ;(error as Error & { status?: number }).status = 403
    throw error
  }

  return planState
}
```

### 4. Client limit helper

- `/Users/user/Desktop/STRYVLAB/lib/billing/clientLimits.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCoachPlan } from '@/lib/billing/getCoachPlan'

export async function getActiveClientCount(db: SupabaseClient, coachId: string): Promise<number> {
  const { count, error } = await db
    .from('coach_clients')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('status', 'active')

  if (error) throw error
  return count ?? 0
}

export async function assertCoachClientCapacity(db: SupabaseClient, coachId: string) {
  const planState = await getCoachPlan(db, coachId)
  if (planState.clientLimit == null) return planState

  const activeCount = await getActiveClientCount(db, coachId)
  if (activeCount >= planState.clientLimit) {
    const error = new Error('Client limit reached for the current plan.')
    ;(error as Error & { status?: number }).status = 403
    throw error
  }

  return planState
}
```

## Files To Modify

### 1. Invite route

- [`/Users/user/Desktop/STRYVLAB/app/api/clients/[clientId]/invite/route.ts`](/Users/user/Desktop/STRYVLAB/app/api/clients/[clientId]/invite/route.ts)

Add before any invitation flow:

```ts
import { getCoachPlan } from '@/lib/billing/getCoachPlan'
import { hasCapability } from '@/lib/billing/plans'

const planState = await getCoachPlan(db, user.id)
if (!hasCapability(planState.plan, 'client_app_access')) {
  return NextResponse.json(
    { error: 'L’accès client STRYVR est disponible à partir du plan Pro.' },
    { status: 403 },
  )
}
```

### 2. Client app root page

- [`/Users/user/Desktop/STRYVLAB/app/client/page.tsx`](/Users/user/Desktop/STRYVLAB/app/client/page.tsx)

After resolving the client, fetch `coach_id` as well:

```ts
const cc = await resolveClientFromUser(user.id, user.email, db, 'id, first_name, coach_id')
```

Then guard:

```ts
if (cc?.coach_id) {
  await assertClientAppEnabledForCoach(String(cc.coach_id))
}
```

For V1, redirect or render a minimal blocked state:

```tsx
return (
  <div className="mx-auto max-w-lg px-6 py-20 text-center text-white">
    <h1 className="text-2xl font-semibold">Espace client non active</h1>
    <p className="mt-3 text-white/70">
      L’espace client n’est pas active pour ce suivi.
    </p>
  </div>
)
```

### 3. Client resolver

- [`/Users/user/Desktop/STRYVLAB/lib/client/resolve-client.ts`](/Users/user/Desktop/STRYVLAB/lib/client/resolve-client.ts)

No logic change required immediately, but V1 usage should consistently request `coach_id` from this helper wherever client gating is needed.

### 4. Client API routes

Start with the highest-value routes under:

- `/Users/user/Desktop/STRYVLAB/app/api/client/chat/messages/route.ts`
- `/Users/user/Desktop/STRYVLAB/app/api/client/checkin/route.ts`
- `/Users/user/Desktop/STRYVLAB/app/api/client/checkin/respond/route.ts`
- `/Users/user/Desktop/STRYVLAB/app/api/client/nutrition/today/route.ts`
- `/Users/user/Desktop/STRYVLAB/app/api/client/nutrition/today-progress/route.ts`
- `/Users/user/Desktop/STRYVLAB/app/api/client/programme/skip/route.ts`

Pattern:

```ts
const client = await resolveClientFromUser(user.id, user.email, db, 'id, coach_id')
if (!client?.coach_id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

try {
  await assertClientAppEnabledForCoach(String(client.coach_id))
} catch (error) {
  const status = (error as { status?: number }).status ?? 403
  return NextResponse.json(
    { error: 'L’espace client n’est pas activé pour ce suivi.' },
    { status },
  )
}
```

## UI Gating Targets

These UI surfaces should be gated in `Solo`:

- invite / re-invite client CTA
- “open client app” CTA
- app-linked check-in setup
- adherence-specific signals if they rely on STRYVR data

These should remain available in `Solo`:

- client creation
- assessments
- nutrition protocol authoring
- training plan authoring
- exports / PDF sharing

## Upgrade Messages

### Solo to Pro

- `Activez STRYVR pour offrir à vos clients une vraie expérience de suivi, de routines et d’adhérence.`

### Pro to Studio

- `Passez en Studio pour piloter plusieurs coaches dans un même système.`

### Client blocked state

- `L’espace client n’est pas activé pour ce suivi.`

## Recommended Implementation Order

1. Add migration for plan metadata on `coach_profiles`
2. Create `lib/billing/plans.ts`
3. Create `lib/billing/getCoachPlan.ts`
4. Gate `invite/route.ts`
5. Gate `app/client/page.tsx`
6. Gate core `app/api/client/*` routes
7. Add UI upsell states in coach surfaces
8. Add client limit checks on creation and invitation flows

## Minimal V1 Slice

If implementation time must stay low, ship only this first:

- plan columns in `coach_profiles`
- capabilities helper
- invitation blocked in `Solo`
- client app pages and APIs blocked when `client_app_access` is absent

That alone makes the `Solo` versus `Pro` product boundary real.
