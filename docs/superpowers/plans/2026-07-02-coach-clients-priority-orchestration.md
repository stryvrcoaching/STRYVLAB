# Coach Clients Priority Orchestration V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `/coach/clients` `À suivre` rail into a true action-orchestration layer that surfaces only actionable client priorities, ranks them with a deterministic score, dispatches work into existing Agenda/Kanban systems, and supports explicit `planned` / `treated` lifecycle states.

**Architecture:** Keep `/coach/clients` as the client portfolio shell. Extend the existing `lib/coach/client-action-items.ts` aggregation layer to merge multiple domain signals into `ClientPriorityItem`s, then add a small persistence layer for coach decisions (`planned`, `treated`, linked artifacts). Expose orchestration APIs that can create agenda reminders, kanban tasks, or both using the current dashboard systems rather than duplicating them locally.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Supabase tables/RLS, existing organization APIs for Agenda/Kanban, Vitest.

## Global Constraints

- `À suivre` must include only priorities requiring a concrete coach action.
- Purely informational items must be excluded from the queue.
- Priority ranking must be deterministic and explainable.
- Existing dashboard systems remain the source of truth for planning objects.
- Each card has one visible primary CTA and an overflow menu.
- Priority lifecycle states must distinguish `open`, `planned`, and `treated`.
- Treated items must stay hidden unless the underlying source changes materially.
- UI must remain consistent with the current `/coach/clients` design system.

## File Structure

- Modify: `/Users/user/Desktop/STRYVLAB/lib/coach/client-action-items.ts`
  - Extend the current aggregation model to support multi-signal scoring, actionability filtering, source linkage, and lifecycle-aware rendering.
- Create: `/Users/user/Desktop/STRYVLAB/lib/coach/client-priority-state.ts`
  - Persistence helpers for reading and writing `open/planned/treated` states.
- Create: `/Users/user/Desktop/STRYVLAB/supabase/migrations/YYYYMMDD_coach_client_priority_states.sql`
  - Add the state table and indexes.
- Modify: `/Users/user/Desktop/STRYVLAB/app/api/coach/client-actions/route.ts`
  - Return the enriched priority payload, including linked planning state.
- Create: `/Users/user/Desktop/STRYVLAB/app/api/coach/client-actions/[priorityKey]/plan/route.ts`
  - Create agenda reminder, kanban task, or both for a priority.
- Create: `/Users/user/Desktop/STRYVLAB/app/api/coach/client-actions/[priorityKey]/treat/route.ts`
  - Mark a priority as treated.
- Modify: `/Users/user/Desktop/STRYVLAB/components/coach/ClientActionPanels.tsx`
  - Add per-card overflow actions, planned-state display, and orchestration callbacks.
- Modify: `/Users/user/Desktop/STRYVLAB/app/coach/clients/page.tsx`
  - Wire orchestration actions and optimistic state refresh.
- Create: `/Users/user/Desktop/STRYVLAB/tests/lib/coach/client-priority-state.test.ts`
- Modify/Create: `/Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts`
- Create: `/Users/user/Desktop/STRYVLAB/tests/api/coach-client-priority-plan.test.ts`
- Create: `/Users/user/Desktop/STRYVLAB/tests/api/coach-client-priority-treat.test.ts`

---

### Task 1: Formalize the actionable priority domain

**Files:**
- Modify: `/Users/user/Desktop/STRYVLAB/lib/coach/client-action-items.ts`
- Modify: `/Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts`

- [ ] Add `ClientPriorityItem` fields for `priorityKey`, `score`, `state`, `plannedContext`, `secondaryActions`, and richer `metadata`.
- [ ] Introduce an `isActionable` gate so unread-but-informational signals never enter `À suivre`.
- [ ] Add explicit scoring helpers for time urgency, client impact, business impact, and execution friction.
- [ ] Define merge rules for same-client/same-action signals versus same-client/different-action signals.
- [ ] Ensure current kinds (`missing_formula`, `assessment_review`, `coach_notification`) still work while adding new kinds such as `follow_up_to_schedule`, `upcoming_event_preparation`, and `kanban_blocker`.
- [ ] Add tests covering:
  - exclusion of informational items
  - score ordering across mixed source types
  - merge vs split behavior for same client
  - suppression of treated items when the source fingerprint has not changed

### Task 2: Persist coach decisions on priorities

**Files:**
- Create: `/Users/user/Desktop/STRYVLAB/supabase/migrations/YYYYMMDD_coach_client_priority_states.sql`
- Create: `/Users/user/Desktop/STRYVLAB/lib/coach/client-priority-state.ts`
- Create: `/Users/user/Desktop/STRYVLAB/tests/lib/coach/client-priority-state.test.ts`

- [ ] Add `coach_client_priority_states` with fields for `coach_id`, `client_id`, `priority_key`, `kind`, `state`, `action_taken`, linked agenda/kanban IDs, timestamps, and metadata.
- [ ] Add a unique constraint on `(coach_id, priority_key)`.
- [ ] Implement helpers to:
  - read states for a coach
  - upsert `planned`
  - upsert `treated`
  - compare existing state with new source fingerprints
- [ ] Add validation rules to prevent duplicate open planning links.
- [ ] Add tests for idempotent upsert behavior and material-change reopening logic.

### Task 3: Connect aggregation to dashboard planning sources

**Files:**
- Modify: `/Users/user/Desktop/STRYVLAB/app/api/coach/client-actions/route.ts`
- Modify: `/Users/user/Desktop/STRYVLAB/lib/coach/client-action-items.ts`
- Relevant sources likely include current organization APIs and models used by:
  - `/Users/user/Desktop/STRYVLAB/components/dashboard/OrgSummary.tsx`
  - `/Users/user/Desktop/STRYVLAB/components/ui/KanbanBoard.tsx`
  - `/Users/user/Desktop/STRYVLAB/components/ui/AgendaCalendar.tsx`

- [ ] Load enough agenda data to detect upcoming client-linked events inside the next 24h.
- [ ] Load enough kanban data to detect unresolved client-linked blockers or already-planned work.
- [ ] Feed linked agenda/kanban artifacts into the priority aggregation so items can show `Déjà planifié`.
- [ ] Prefer `open existing` semantics over `create duplicate` when a matching artifact is already linked.
- [ ] Extend tests to verify that planned artifacts downgrade or relabel the visible priority behavior.

### Task 4: Add orchestration endpoints

**Files:**
- Create: `/Users/user/Desktop/STRYVLAB/app/api/coach/client-actions/[priorityKey]/plan/route.ts`
- Create: `/Users/user/Desktop/STRYVLAB/app/api/coach/client-actions/[priorityKey]/treat/route.ts`
- Create: `/Users/user/Desktop/STRYVLAB/tests/api/coach-client-priority-plan.test.ts`
- Create: `/Users/user/Desktop/STRYVLAB/tests/api/coach-client-priority-treat.test.ts`

- [ ] Implement `plan` endpoint that accepts a mode:
  - `agenda`
  - `kanban`
  - `both`
- [ ] Reuse existing organization write flows instead of duplicating agenda/kanban creation logic.
- [ ] Persist returned linked IDs into `coach_client_priority_states` as `planned`.
- [ ] Implement `treat` endpoint that marks the item as `treated` with audit metadata.
- [ ] Add API tests for auth, invalid priority keys, duplicate planning prevention, and successful treat flow.

### Task 5: Upgrade the clients page interaction model

**Files:**
- Modify: `/Users/user/Desktop/STRYVLAB/components/coach/ClientActionPanels.tsx`
- Modify: `/Users/user/Desktop/STRYVLAB/app/coach/clients/page.tsx`
- Modify/Create: `/Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx`

- [ ] Keep the current drawer layout and DS alignment intact.
- [ ] Add an overflow menu per `À suivre` card with contextual secondary actions.
- [ ] Add planned-state copy such as `Déjà planifié`, `Lié au kanban`, or `Rappel actif`.
- [ ] Wire the primary CTA to the smart action returned by the API.
- [ ] Add optimistic refresh behavior after `plan` or `treat` actions so the queue updates immediately.
- [ ] Add UI tests covering:
  - primary CTA execution path
  - overflow action trigger
  - treated item disappearing from the list
  - planned item staying visible with downgraded styling

### Task 6: Finalize decision quality and consistency

**Files:**
- Review all touched files

- [ ] Verify that `À suivre` does not regress into a notification mirror.
- [ ] Verify that non-actionable items are excluded consistently across all sources.
- [ ] Verify that linked planning artifacts are reopened rather than recreated.
- [ ] Confirm that `treated` items only return when a materially new source fingerprint appears.
- [ ] Re-run focused tests for domain logic, API routes, and clients page interactions.

## Validation Commands

Run focused tests first:
- `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts --run`
- `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/lib/coach/client-priority-state.test.ts --run`
- `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/api/coach-client-actions.test.ts /Users/user/Desktop/STRYVLAB/tests/api/coach-client-priority-plan.test.ts /Users/user/Desktop/STRYVLAB/tests/api/coach-client-priority-treat.test.ts --run`
- `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx --run`

Then run the combined slice validation:
- `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/lib/coach/client-action-items.test.ts /Users/user/Desktop/STRYVLAB/tests/lib/coach/client-priority-state.test.ts /Users/user/Desktop/STRYVLAB/tests/api/coach-client-actions.test.ts /Users/user/Desktop/STRYVLAB/tests/api/coach-client-priority-plan.test.ts /Users/user/Desktop/STRYVLAB/tests/api/coach-client-priority-treat.test.ts /Users/user/Desktop/STRYVLAB/tests/components/coach-clients-action-strip.test.tsx --run`

## Rollout Notes

- Ship behind the existing `/coach/clients` surface without route changes.
- Keep V1 scoring deterministic and inspectable.
- Log planned/treated transitions so product review can measure queue quality after launch.
- Defer any ML/AI prioritization until manual rule quality is validated in production.
