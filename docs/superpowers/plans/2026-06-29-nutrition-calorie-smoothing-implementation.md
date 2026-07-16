# Nutrition Calorie Smoothing V1 - Implementation Plan

Spec: `docs/superpowers/specs/2026-06-29-nutrition-calorie-smoothing-design.md`
Date: 2026-06-29
Goal: implement client-side calorie smoothing with coach notifications, coach supervision, and coach intervention workflows

## Architecture Summary

The implementation is split into four blocks:

1. persistent smoothing domain model
2. client nutrition page UX and APIs
3. coach notifications integration
4. coach nutrition data visibility and actions

The system must reuse the current client nutrition target pipeline and the existing `coach_notifications` infrastructure where possible.

## Existing Integration Points

### Client nutrition page

- `app/client/nutrition/page.tsx`
- `app/client/nutrition/NutritionClientPage.tsx`
- `components/client/smart/SmartNutritionHero.tsx`
- `app/api/client/nutrition/today/route.ts`
- `app/api/client/nutrition/today-progress/route.ts`

### Protocol and day resolution

- `lib/nutrition/protocol-schedule.ts`
- `lib/client/day-kind.ts`

### Coach notifications

- `lib/notifications/sendCoachNotification.ts`
- `app/api/coach/inbox/route.ts`
- `app/api/coach/inbox/[notificationId]/route.ts`
- existing direct inserts in:
  - `app/api/client/nutrition/preps/[id]/log/route.ts`
  - `app/api/client/checkin/route.ts`
  - `app/api/client/programme/skip/route.ts`

### Coach nutrition data

- `app/api/clients/[clientId]/nutrition-data/route.ts`

## Block 1 - Data Model And Domain Logic

### 1.1 Add database tables

Create a new Supabase migration for:

- `nutrition_smoothing_plans`
- `nutrition_smoothing_plan_days`

Include:

- foreign keys to `coach_clients`
- `coach_id` duplication for fast notification ownership queries
- status checks
- timestamps
- indexes on `client_id`, `status`, `source_date`
- RLS for client self-read and coach owner read/write

Optional but recommended:

- explicit revision support fields

### 1.2 Add shared domain types

Create a shared type module, likely under:

- `lib/nutrition/smoothing.ts`
or
- `lib/nutrition/smoothing/types.ts`

Define:

- plan direction
- plan status
- plan strategy
- day status
- payload shapes for plan creation, merge, replace, cancel, modify

### 1.3 Add smoothing computation helpers

Create pure helpers for:

- threshold gating
- smoothable budget computation
- recommended duration selection
- duration guardrail validation
- day bucketing and weighting
- kcal-to-macros conversion with fixed protein
- plan day generation

Recommended module split:

- `lib/nutrition/smoothing/rules.ts`
- `lib/nutrition/smoothing/weights.ts`
- `lib/nutrition/smoothing/compute-plan.ts`

### 1.4 Add final target overlay resolver

Add a helper that can apply active smoothing plan day deltas onto the already resolved daily target.

This should integrate after the existing cycle sync overlay.

Potential module:

- `lib/nutrition/smoothing/apply-overlay.ts`

## Block 2 - Client APIs And UX

### 2.1 Extend daily nutrition payloads

Update the client data sources used by the nutrition page so they can expose:

- detected delta state
- eligibility for smoothing
- currently active smoothing plan affecting the displayed date
- recommended new plan proposal when applicable

Primary candidates:

- `app/api/client/nutrition/today/route.ts`
- `app/client/nutrition/page.tsx`

If needed, create a dedicated smoothing status endpoint instead of overloading `today-progress`.

### 2.2 Create client smoothing API routes

Add API routes for:

- create plan
- merge into existing plan
- replace existing plan
- cancel plan
- fetch active plan detail

Suggested route family:

- `app/api/client/nutrition/smoothing/route.ts`
- `app/api/client/nutrition/smoothing/[planId]/route.ts`

Operations:

- `POST` create
- `PATCH` modify or merge intent
- `DELETE` cancel
- `GET` fetch detail

### 2.3 Update client nutrition page UI

Patch:

- `components/client/smart/SmartNutritionHero.tsx`
- possibly `app/client/nutrition/NutritionClientPage.tsx`

Add:

- inline extension under the hero
- contextual copy for surplus or deficit
- recommended duration display
- actions: confirm, modify, ignore
- active-plan state
- coach-updated state
- coach note display

If inline complexity becomes high, extract:

- `components/client/nutrition/CalorieSmoothingCard.tsx`
- `components/client/nutrition/CalorieSmoothingSheet.tsx`

### 2.4 Handle active-plan conflict flow

When a new eligible delta is detected while an active plan exists:

- fetch active plan summary
- show choice:
  - add to current plan
  - replace current plan
  - ignore

The client must never trigger silent merging.

## Block 3 - Coach Notifications Integration

### 3.1 Reuse persistent coach notifications

Use `coach_notifications` instead of inventing a new storage layer.

Preferred implementation:

- centralize inserts through `lib/notifications/sendCoachNotification.ts`

If the helper is too narrow today, extend it so smoothing can pass:

- category
- subcategory
- title
- body
- payload
- priority

### 3.2 Define smoothing notification taxonomy

Add a consistent category and subcategory pair.

Recommended:

- category: `nutrition_trend`
- subcategory: `calorie_smoothing_activated`

Possible follow-ups later:

- `calorie_smoothing_modified`
- `calorie_smoothing_cancelled`

### 3.3 Expose notifications in coach reading flow

The product need is not only badge count.

Make sure smoothing notifications are visible through the coach notification reading surface already backed by:

- `app/api/coach/inbox/route.ts`

Then connect the athlete-card experience to a filtered client notification list if not already supported.

This may require:

- adding client-filter support to coach inbox query
- or a lightweight client-scoped notification route

### 3.4 Athlete card interaction

Identify the athlete card component currently showing the notification badge and patch it so the badge becomes actionable.

Expected outcome:

- click badge
- open modal or drawer
- show client-scoped notifications
- allow navigation to nutrition data if notification is smoothing-related

## Block 4 - Coach Nutrition Data Visibility And Actions

### 4.1 Enrich nutrition data API

Extend:

- `app/api/clients/[clientId]/nutrition-data/route.ts`

Add smoothing information for:

- source day
- impacted future days
- active remaining debt or credit
- coach intervention state

This likely needs:

- joining current smoothing plan rows
- or fetching plan rows in parallel and overlaying them in the response mapper

### 4.2 Add coach UI badges and detail

Patch the coach-side nutrition data interface so day rows can display:

- smoothing active
- adjusted day
- debt remaining
- credit remaining
- coach modified
- coach cancelled

The exact component path depends on the existing nutrition data rendering layer once identified during implementation.

### 4.3 Add coach action endpoints

Add coach-authorized routes for:

- modify plan
- cancel plan
- attach note

Suggested route family:

- `app/api/clients/[clientId]/nutrition-smoothing/[planId]/route.ts`

Potential operations:

- `PATCH` modify or note
- `DELETE` cancel

### 4.4 Client feedback after coach intervention

When a coach modifies or cancels a plan:

- persist the change
- expose it in the client smoothing payload
- optionally create a client-facing notification if needed later

V1 minimum:

- client nutrition page reflects coach intervention status and note

## Suggested Execution Order

### Phase 1

Schema and pure domain logic

- migration
- shared types
- compute helpers
- overlay resolver

### Phase 2

Client creation flow

- client APIs
- hero UI
- duration selection
- active-plan conflict flow

### Phase 3

Coach notification loop

- smoothing notification inserts
- coach inbox visibility
- athlete-card click-through

### Phase 4

Coach nutrition supervision

- nutrition-data enrichment
- badges
- plan detail
- coach modify, cancel, note

## Testing Strategy

### Unit tests

Add tests for pure helpers:

- threshold gating
- smoothable budget
- duration recommendation
- guardrail enforcement
- day weighting
- macro redistribution
- overlay application order

Suggested location:

- `tests/lib/nutrition/smoothing/*.test.ts`

### API tests

Add route tests for:

- client plan creation
- merge and replace behavior
- coach modify and cancel behavior
- notification emission

Suggested location:

- `tests/api/client-nutrition-smoothing*.test.ts`
- `tests/api/coach-nutrition-smoothing*.test.ts`

### UI tests

Add focused component coverage for:

- hero proposal state
- modify state
- active-plan conflict prompt
- coach note rendering

### Regression checks

Verify that:

- base protocol targets stay unchanged
- cycle sync still applies before smoothing
- nutrition data still works without any smoothing plan present
- unread coach notification counts continue to aggregate correctly

## Open Implementation Notes

### Notification storage choice

Use existing `coach_notifications` unless a concrete blocker appears.

Do not create a parallel smoothing-specific notification table.

### Day bucketing detail

The free-form coach day labels make day-type parsing risky.

Start V1 with:

- profile-based bucketing from actual daily calorie targets
- optional light label heuristics only as a soft hint

### Revision strategy

Coach modification history must remain understandable.

If full revisions are too expensive for V1:

- use replacement semantics and keep linkage via `replaced_by_plan_id`

## Deliverables Checklist

- migration for smoothing plans and days
- pure smoothing engine helpers
- client smoothing APIs
- client nutrition hero UX
- coach notification creation
- coach notification reading path for athlete context
- nutrition data overlay
- coach modify, cancel, note flow
- tests for rules and routes

