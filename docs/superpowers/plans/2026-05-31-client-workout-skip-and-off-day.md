# Client Workout Skip + Off Day Override — Implementation Plan

> **For agentic workers:** Follow the feature-slice workflow: identify entities, define schema changes, implement service, add minimal UI, add validation, ensure consistency. Steps use checkbox syntax for tracking.

**Goal:** Add a client-side workout skip flow that is allowed only before session start, notifies the coach in `coach inbox`, and requalifies the skipped date as a `global off day` so nutrition and day-type dependent experiences switch from training-day logic to off-day logic.

**Architecture:** One new workout skip record + one new day override record. A dedicated client API route performs the transactional behavior: validate ownership and pre-start condition, insert skip record, insert day override, insert coach notification. The client programme page reads the skip/override state to adjust the workout CTA. Nutrition and other day-type consumers read the override before falling back to the training week schedule.

**Tech Stack:** Next.js App Router, Supabase, TypeScript strict, DS v3.0 client, existing `coach_notifications` inbox, existing `training-week-schedule` nutrition logic.

---

## File Map

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/20260531_client_workout_skips.sql` |
| CREATE | `lib/client/day-kind.ts` |
| CREATE | `app/api/client/programme/skip/route.ts` |
| MODIFY | `app/client/programme/page.tsx` |
| MODIFY | `app/client/programme/ProgrammeClientPage.tsx` |
| MODIFY | `app/api/client/timeline/today/route.ts` |
| MODIFY | `app/api/clients/[clientId]/nutrition-data/route.ts` |
| MODIFY | `lib/nutrition/training-week-schedule.ts` |
| MODIFY | `app/api/coach/inbox/route.ts` |
| MODIFY | `lib/notifications/sendCoachNotification.ts` or equivalent coach notification utility usage |

---

## Task 1 — Schema: skips + off day override

**Files:**
- Create: `supabase/migrations/20260531_client_workout_skips.sql`

- [ ] Create `client_workout_skips`

Recommended columns:

```sql
id uuid primary key default gen_random_uuid(),
client_id uuid not null references coach_clients(id) on delete cascade,
program_id uuid references programs(id) on delete set null,
program_session_id uuid not null references program_sessions(id) on delete cascade,
scheduled_date date not null,
status text not null check (status in ('skipped')),
skip_reason_key text not null,
skip_note text,
skipped_at timestamptz not null default now(),
created_at timestamptz not null default now(),
unique (client_id, program_session_id, scheduled_date)
```

- [ ] Create `client_day_overrides`

Recommended columns:

```sql
id uuid primary key default gen_random_uuid(),
client_id uuid not null references coach_clients(id) on delete cascade,
date date not null,
kind text not null check (kind in ('off')),
source text not null check (source in ('session_skip')),
linked_program_session_id uuid references program_sessions(id) on delete set null,
linked_skip_id uuid references client_workout_skips(id) on delete set null,
created_at timestamptz not null default now(),
unique (client_id, date, source)
```

- [ ] Add indexes

Recommended:
- `client_workout_skips (client_id, scheduled_date desc)`
- `client_day_overrides (client_id, date desc)`

- [ ] Add RLS or keep server-only writes

For V1, writes can stay server-side only if all mutations go through authenticated route handlers. Reads may also stay server-side if current pages already use service-role fetching.

---

## Task 2 — Shared day-kind resolver

**Files:**
- Create: `lib/client/day-kind.ts`
- Modify: `lib/nutrition/training-week-schedule.ts`

- [ ] Add a shared resolver for effective day kind

The project already computes training/rest from weekly programme structure. V1 needs a function that resolves:

1. explicit day override for date
2. otherwise programme weekday schedule
3. otherwise undefined

Suggested API:

```ts
export type EffectiveDayKind = 'training' | 'rest' | 'rest_with_activity' | 'off_override' | 'undefined'

export function resolveEffectiveDayKind(args: {
  date: string
  weekdayKind: WeekdayKind | null
  overrideKind: 'off' | null
}): EffectiveDayKind
```

- [ ] Add helper to map override into nutrition-compatible day kind

For nutrition, an off override should resolve to rest-like behavior.

Suggested helper:

```ts
export function toNutritionWeekdayKind(kind: EffectiveDayKind): WeekdayKind
```

---

## Task 3 — Client skip API

**Files:**
- Create: `app/api/client/programme/skip/route.ts`

- [ ] Implement request validation

Body:

```json
{
  "programSessionId": "uuid",
  "scheduledDate": "YYYY-MM-DD",
  "reasonKey": "fatigue_recovery",
  "note": "optional"
}
```

Validate:
- authenticated client exists
- session belongs to one of the client’s active programs or visible program context
- no completed or started `client_session_logs` exist for that session/date
- no existing skip for same session/date already exists

- [ ] Insert skip + day override + coach notification

The route should:

1. resolve authenticated `coach_clients.id`
2. load owning `coach_id`
3. verify session ownership
4. detect if session already started that day
5. insert `client_workout_skips`
6. insert `client_day_overrides`
7. insert `coach_notifications` with category/subcategory for workout skip
8. return success payload with refreshed day state

- [ ] Notification payload recommendation

Use `coach_notifications` because `/api/coach/inbox` already reads it.

Recommended values:
- `category = 'engagement'`
- `subcategory = 'session_skip'`
- `priority = 3` or `4`
- `status = 'pending'`

If needed, extend coach inbox enrichment to include structured metadata from a new payload column or a short excerpt pattern.

---

## Task 4 — Programme page UI

**Files:**
- Modify: `app/client/programme/page.tsx`
- Modify: `app/client/programme/ProgrammeClientPage.tsx`

- [ ] Fetch skip state and day override for today

The programme page already loads today’s completed logs. Extend it to also load:
- skip rows for `todayIso`
- day override row for `todayIso`

- [ ] Add CTA on non-started session card

Display only when:
- session is planned for selected day
- selected day is today
- session not completed
- session not skipped
- session not started

UI recommendation:
- primary button remains `Démarrer`
- secondary text button `Je ne peux pas faire cette séance`

- [ ] Add bottom sheet

Minimal UI:
- title
- helper copy
- 5 reason buttons
- note textarea
- confirm CTA
- cancel CTA

- [ ] Refresh local state after success

After success:
- mark session as skipped
- show passive state copy
- prevent launch CTA
- optionally show `Jour off activé` helper tag

---

## Task 5 — Nutrition integration

**Files:**
- Modify: `app/api/clients/[clientId]/nutrition-data/route.ts`
- Possibly modify: nutrition consumer routes or components that infer day type

- [ ] Inject override into nutrition day-type response

The nutrition data route already returns `trainingWeekSchedule`. Extend it to also return:
- today or anchor-date override
- effective day kind for that date

Suggested response fields:

```ts
dayOverride: { date: string; kind: 'off'; source: 'session_skip' } | null
effectiveDayKind: 'training' | 'rest' | 'rest_with_activity' | 'off_override' | 'undefined'
```

- [ ] Make nutrition day selection prefer override

Wherever nutrition day naming currently uses `suggestNutritionDayName(entry.kind, protocolDayNames)`, it should use:
- override-derived rest/off kind if present
- otherwise schedule-derived weekday kind

Expected result:
- if protocol has `jour off / repos / rest / off`
- and the session was skipped that date
- nutrition day selection uses the off-day config

- [ ] Fallback behavior

If no off-day nutrition config exists:
- do not block skip
- keep current nutrition display
- optionally expose `effectiveDayKind` so UI can show `jour off déclaré`

---

## Task 6 — Timeline and smart surfaces

**Files:**
- Modify: `app/api/client/timeline/today/route.ts`
- Potentially modify any widget route that labels the day as training/rest

- [ ] Read day override in timeline route

Return extra metadata so the UI can understand that the day is off even if a workout was planned:

```ts
dayKind: 'training' | 'rest' | 'off_override' | 'undefined'
sessionSkipped: boolean
```

- [ ] Keep V1 pragmatic

No need to rebuild every widget now. The minimum consistent slice is:
- programme page
- nutrition day selection
- timeline/day summary surfaces

Other smart widgets can adopt the same helper later.

---

## Task 7 — Coach inbox visibility

**Files:**
- Modify: `app/api/coach/inbox/route.ts`

- [ ] Make skip notifications readable

`coach_notifications` currently supports category, subcategory, priority, and optional chat message excerpt. Add display mapping for:
- `category = engagement`
- `subcategory = session_skip`

Recommended enriched output:
- `clientName`
- `category`
- `subcategory`
- `messageExcerpt` or dedicated `summary`
- `createdAt`

Suggested summary:

`{clientName} a skippé "{sessionName}" prévue aujourd'hui`

If a free note exists, expose it as excerpt.

---

## Task 8 — Validation and consistency

- [ ] Prevent duplicate skip
- [ ] Prevent skip after session log creation
- [ ] Ensure off-day override is idempotent for same date/source
- [ ] Ensure coach badge count increases through existing inbox summary endpoint
- [ ] Ensure day override reads are timezone-safe using the same physiological/local date logic already used by nutrition and timeline

---

## Task 9 — Tests

**Suggested coverage:**

- [ ] API: skip succeeds before start
- [ ] API: skip rejected after session start
- [ ] API: duplicate skip rejected
- [ ] API: skip creates coach notification
- [ ] API: skip creates day override
- [ ] Helper: effective day kind prefers override over schedule
- [ ] Nutrition: off-day protocol selected when override exists

---

## Recommended Delivery Order

1. Schema
2. Shared day-kind helper
3. Skip API
4. Programme UI
5. Nutrition integration
6. Timeline/day summary integration
7. Coach inbox enrichment
8. Tests and polish

---

## Notes

- Keep V1 focused: `skip exceptionnel` only, no replanification.
- Treat `session skip` as a product event and `off day override` as a day-state event.
- Reuse existing local date / physiological date utilities to avoid day-boundary bugs.
- Prefer one shared day-kind resolver over scattered conditionals in nutrition, programme, and timeline code.
