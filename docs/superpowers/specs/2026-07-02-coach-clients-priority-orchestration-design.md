# Coach Clients Priority Orchestration V1

**Date:** 2026-07-02  
**Status:** Proposed  
**Primary Route:** `/coach/clients`  
**Related Routes:** `/dashboard`, `/coach/clients/[clientId]`

## Understanding Summary

- The coach clients page must become an execution surface, not only a directory with passive filters.
- The dashboard already owns global planning via Agenda, Kanban, and 24h reminders.
- The clients page should complement that dashboard by surfacing per-client priorities that require a real action.
- Purely informative items must not pollute the `À suivre` rail.
- Each priority card should expose one best immediate action and a secondary overflow menu.
- Organizational actions must reuse existing systems: Agenda, Kanban, coach notifications, client profile, formulas, and assessments.
- Priorities must support explicit lifecycle states so the coach can remove treated work from the flow.

## Problem Statement

The current `À suivre` concept is still too close to a generic alert list.

That creates three product issues:

1. **Low signal density**
   - informational signals and action-required signals can look similar
   - the coach still has to interpret what deserves work now

2. **Fragmented execution**
   - the coach has client cards on one page and organization tools on another
   - moving something into Agenda or Kanban is not yet first-class from the clients page

3. **No explicit completion model**
   - once a coach sees a priority, there is no structured way to mark it as planned or treated
   - the same item risks reappearing as noise

## Goals

- Make `À suivre` a list of action-required client priorities only.
- Connect client actions directly to existing dashboard systems.
- Rank priorities with a deterministic multi-factor score.
- Give each priority one best CTA for immediate execution.
- Support secondary actions through an overflow menu without overloading the card.
- Persist whether a priority is still open, already planned, or explicitly treated.
- Keep the clients page and the dashboard complementary rather than duplicative.

## Non-Goals

- Redesign the dashboard information architecture.
- Replace the current notifications system globally.
- Introduce a generic workflow engine for every coach object.
- Build an AI-generated prioritization engine in V1.
- Replace the existing client profile or client cards.

## Assumptions

- Existing Agenda and Kanban systems remain the source of truth for organization objects.
- The coach clients page can create or open those objects but should not reimplement them.
- V1 should favor explicit rules over opaque automation.
- The `Sans formule` panel remains a separate commercial action surface.
- A priority can be represented as a product-layer aggregation object even if its underlying source lives elsewhere.

## Decision Log

1. **Decision:** `À suivre` includes only items that require a concrete action.  
   **Alternatives considered:** include informational alerts, unread-only feed, all dashboard-linked events.  
   **Why chosen:** improves signal-to-noise and keeps the rail operational.

2. **Decision:** Priorities are ranked by a mixed score, not by a single dimension.  
   **Alternatives considered:** time-only sorting, business-only sorting, manual pinned lists.  
   **Why chosen:** coach work spans commercial, client-care, and scheduling concerns.

3. **Decision:** Each card exposes one visible primary CTA plus an overflow menu.  
   **Alternatives considered:** multiple visible CTAs, open-profile only, fully inline action bars.  
   **Why chosen:** preserves clarity while still allowing diverse actions.

4. **Decision:** Priority states are `open`, `planned`, and `treated`.  
   **Alternatives considered:** open/closed only, implicit completion from source objects.  
   **Why chosen:** distinguishes “I scheduled it” from “this is done.”

5. **Decision:** The clients page dispatches work into existing Agenda and Kanban systems.  
   **Alternatives considered:** local-only reminders, separate client action tracker.  
   **Why chosen:** avoids fragmentation and leverages current organization tooling.

## Product Model

### Core Entity
Use a dedicated product-layer entity:

- `ClientPriorityItem`

Each item represents:
- one client
- one dominant actionable reason
- one highest-priority execution path
- one current lifecycle state

Suggested shape:

```ts
type ClientPriorityItem = {
  id: string
  clientId: string
  clientName: string
  kind:
    | 'missing_formula'
    | 'coach_notification_action'
    | 'assessment_review'
    | 'follow_up_to_schedule'
    | 'upcoming_event_preparation'
    | 'kanban_blocker'
  source: 'formulas' | 'notifications' | 'assessments' | 'agenda' | 'kanban'
  score: number
  priority: 'urgent' | 'important' | 'plan'
  reason: string
  primaryAction:
    | 'assign_formula'
    | 'open_notifications'
    | 'open_assessment'
    | 'create_alert'
    | 'create_kanban_task'
    | 'create_alert_and_task'
    | 'open_kanban_item'
    | 'open_profile'
  secondaryActions: Array<
    | 'open_profile'
    | 'open_source'
    | 'create_alert'
    | 'create_kanban_task'
    | 'create_alert_and_task'
    | 'mark_treated'
  >
  state: 'open' | 'planned' | 'treated'
  plannedContext?: {
    agendaEventId?: string
    kanbanTaskId?: string
    label?: string
  }
  metadata?: Record<string, unknown>
}
```

## Inclusion Rules

A client priority item appears in `À suivre` only if:
- a human coach action is expected
- the next action can be named clearly
- the item is not already treated

Examples included:
- active follow-up missing commercial coverage
- unread coach notification that needs a decision or reply
- assessment waiting for review
- event in the next 24h that still requires preparation
- client-related kanban blocker still unresolved
- follow-up not yet scheduled

Examples excluded:
- informational notification with no action expected
- reminder already completed and acknowledged
- historical dashboard event with no pending work
- pure analytics signals without an actionable next step

## Scoring Model

V1 uses explicit weighted scoring.

### Score Dimensions

1. **Time urgency**
   - overdue
   - due today
   - due within 24h
   - upcoming but not immediate

2. **Client impact**
   - blocks coaching follow-up
   - blocks progression review
   - blocks expected coach response

3. **Business impact**
   - revenue or conversion risk
   - formula continuity risk
   - commercial follow-up needed

4. **Execution friction**
   - quick wins may be surfaced earlier when impact is meaningful
   - high-friction actions still rank high if urgency/impact is critical

### Recommended V1 Behavior

- `missing_formula` usually scores high on business impact and low on friction.
- `assessment_review` scores high on client impact, with urgency raised by age or a linked upcoming event.
- `coach_notification_action` only enters the rail if a real coach action is inferred.
- `upcoming_event_preparation` scores high when the next 24h window is close and no planning artifact exists.
- `kanban_blocker` rises when tied to an overdue or important client task.

### Priority Bands

- `urgent` — should be acted on now
- `important` — should be handled soon
- `plan` — should be organized, not necessarily executed immediately

## Deduplication and Dominance Rules

A single client may emit multiple signals.

V1 rules:
- if several signals map to the same next action, merge them into one item
- if several signals map to different actions, keep distinct items when both are materially actionable
- within the same client, sort by score descending
- the strip counter reflects the number of open or planned items, not the total raw signals

This preserves clarity without flattening meaningful work.

## Card Behavior

Each `À suivre` card shows:
- client name
- short action-oriented reason
- source label
- priority badge
- optional `Déjà planifié` signal
- one primary CTA
- one overflow menu `…`

### Primary CTA Principle

The visible CTA answers:
> “What should the coach do now?”

Examples:
- `Attribuer une formule`
- `Ouvrir les notifications`
- `Voir le bilan`
- `Créer une alerte`
- `Créer alerte + tâche`
- `Ouvrir le kanban`

### Overflow Menu Actions

Recommended V1 actions:
- `Ouvrir le profil`
- `Ouvrir la source`
- `Ajouter au kanban`
- `Créer une alerte`
- `Créer alerte + tâche`
- `Marquer comme traité`

The menu content is contextual by item kind.

## Lifecycle States

### `open`
- nothing has been scheduled yet
- work is still pending

### `planned`
- the coach created an Agenda reminder, a Kanban task, or both
- the priority remains visible but visually downgraded
- card should show a contextual hint such as `Déjà planifié`

### `treated`
- the coach explicitly considers the priority handled
- the item leaves the active rail
- the treatment is persisted and auditable

Persist at minimum:
- `priority_item_id` or derived dedupe key
- `coach_id`
- `state`
- `treated_at` / `planned_at`
- optional `action_taken`
- optional linked `agenda_event_id` / `kanban_task_id`

## Relationship With Dashboard

### Product Boundary
- **Dashboard:** macro organization, planning, daily operations overview
- **Clients page:** execution by client and dispatch of action-required work

### Interaction Rules

From the clients page:
- `create_alert` creates a dashboard agenda reminder/event
- `create_kanban_task` creates a dashboard kanban task
- `create_alert_and_task` creates both when appropriate
- `open_source` routes to the most relevant existing object

From the dashboard back to clients:
- agenda or kanban items linked to a client should route back to that client when opened
- if a linked planning artifact already exists, `À suivre` should prefer `open` behavior over duplicate creation

## UX Notes

- `À suivre` remains a side panel on the clients page.
- It should feel like a decision queue, not a notification inbox.
- The panel should remain visually aligned with the same dark DS already used on `/coach/clients`.
- Planned items should remain visible but less visually urgent than open items.
- Treated items should disappear from the active queue immediately after confirmation.

## Data and Persistence Strategy

### V1 recommendation

Split logic into two layers:

1. **Aggregation layer**
   - computes actionable priorities from formulas, notifications, assessments, agenda, and kanban
   - deterministic and recomputable

2. **State layer**
   - stores coach decisions about those priorities
   - `planned`, `treated`, linked agenda/kanban IDs, timestamps

This avoids persisting every priority as a permanent source-of-truth object while still remembering coach actions.

## Suggested Schema Additions

### `coach_client_priority_states`

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
coach_id UUID NOT NULL,
client_id UUID NOT NULL,
priority_key TEXT NOT NULL,
kind TEXT NOT NULL,
state TEXT NOT NULL CHECK (state IN ('open', 'planned', 'treated')),
action_taken TEXT,
agenda_event_id UUID NULL,
kanban_task_id UUID NULL,
metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
treated_at TIMESTAMPTZ NULL,
planned_at TIMESTAMPTZ NULL
```

Unique index recommendation:
- `(coach_id, priority_key)`

`priority_key` is a deterministic dedupe key derived from source kind + client + source reference.

## Validation Rules

- Do not create a priority state for non-actionable items.
- Do not allow duplicate `planned` artifacts when an open linked artifact already exists.
- Do not mark an item `treated` without a stable priority key.
- Do not re-surface `treated` items unless the source changed materially enough to emit a new priority key.

## Success Criteria

- `À suivre` contains only action-required items.
- Coaches can turn a client priority into Agenda/Kanban work in one or two clicks.
- Coaches can explicitly clear treated work.
- The queue gets smaller through action, not through passive reading.
- The dashboard and clients page feel connected, not duplicated.
