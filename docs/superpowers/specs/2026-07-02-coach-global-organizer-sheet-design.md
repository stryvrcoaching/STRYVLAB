# Coach Global Organizer Sheet V1

**Date:** 2026-07-02  
**Status:** Proposed  
**Primary Surface:** Global coach header (`CoachShell`)  
**Related Routes:** `/dashboard`, all `/coach/*`

## Understanding Summary

- Coaches need a permanent one-click way to organize work from anywhere in the coach space.
- The existing header already contains a persistent notification bell and is the right global anchor.
- The new control must open a lateral sheet, not redirect or open a heavy modal workflow.
- The sheet must create an agenda alert, a kanban task, or both.
- The default mode must be `Les deux`.
- Client selection must be first-class and required in the flow.
- The sheet must feed the existing dashboard systems rather than creating a parallel organization layer.

## Problem Statement

Today, quick organization actions are fragmented:
- some planning happens from dashboard views
- some planning is now possible from client-specific priority flows
- but there is no permanent global shortcut from the header

This creates three issues:

1. **Interruptive organization**
   - the coach must navigate into dashboard or local page actions before creating structured work

2. **Inconsistent entry points**
   - organization exists, but not as a stable product primitive available everywhere

3. **Lost intent**
   - when the coach wants to capture a follow-up immediately, friction increases the chance the task is not created

## Goals

- Add a permanent `Organiser` action in the global coach header.
- Make the sheet available on every coach page.
- Let the coach create `alerte`, `tâche`, or `les deux` in one fast flow.
- Require client association at creation time.
- Default to `les deux`.
- Reuse agenda and kanban systems already powering the dashboard.
- Keep the interaction lightweight and visually consistent with the coach design system.

## Non-Goals

- Turn the header into a mini dashboard.
- Rebuild the agenda or kanban editors.
- Add advanced board/column configuration in V1.
- Support unassigned/non-client organization objects in this first version.
- Replace page-level planning actions already implemented elsewhere.

## Assumptions

- Coach pages all render inside `CoachShell`.
- The first kanban board and first column are acceptable as V1 defaults.
- Client-linked organization is more valuable than freeform organization for this surface.
- A shared orchestration endpoint is preferable to duplicating agenda and kanban creation logic in the client.

## Decision Log

1. **Decision:** The organizer entry point lives in the permanent global header.  
   **Alternatives considered:** only on dashboard, only on client pages, floating action button.  
   **Why chosen:** it maximizes availability and reduces navigation friction.

2. **Decision:** Use a side sheet instead of a centered modal.  
   **Alternatives considered:** popover, full page, modal.  
   **Why chosen:** side sheets match the existing coach interaction model and preserve page context.

3. **Decision:** Client is mandatory.  
   **Alternatives considered:** optional client, separate personal task mode.  
   **Why chosen:** the main value is impacting client-related organization and dashboard execution.

4. **Decision:** Mode defaults to `Les deux`.  
   **Alternatives considered:** agenda first, kanban first, no default.  
   **Why chosen:** it best supports “capture now, organize fully” behavior.

5. **Decision:** Kanban destination is implicit in V1.  
   **Alternatives considered:** expose board/column selectors immediately.  
   **Why chosen:** this surface optimizes speed, not configuration depth.

## UX Model

### Header Control

A new button appears in the right side of the global top bar, just before `NotificationBell`.

Label recommendation:
- `Organiser`

Visual behavior:
- same compact scale as other top-bar actions
- subtle neutral resting state
- active state when the sheet is open

### Side Sheet

Right-side global sheet, visually aligned with current dark coach drawers.

Contents:
- header title
- short helper copy
- client selector (required)
- mode selector:
  - `Alerte`
  - `Tâche`
  - `Les deux` (default)
- title input
- date input
- time input (primarily for agenda)
- note / description
- submit CTA

### Smart Defaults

- Mode defaults to `Les deux`.
- Submit is disabled until a client is selected.
- If title is empty after client selection, show a default suggestion such as:
  - `Suivi {client}`
  - `Point coaching {client}`
  - `Relance {client}`
- If time is omitted:
  - agenda receives a sensible default time
  - kanban still creates successfully

### Creation Results

- `Alerte` → creates agenda event
- `Tâche` → creates kanban task
- `Les deux` → creates both and links them

After success:
- close sheet or reset for a second quick entry (final choice implementation detail)
- show a subtle success confirmation

## Data Model

### Core Request Shape

```ts
type GlobalOrganizerRequest = {
  clientId: string
  clientName?: string
  mode: 'agenda' | 'kanban' | 'both'
  title?: string
  note?: string
  date: string
  time?: string | null
}
```

### Response Shape

```ts
type GlobalOrganizerResponse = {
  ok: true
  agendaEventId?: string | null
  kanbanTaskId?: string | null
}
```

## Service Boundary

Add a dedicated orchestration endpoint for the header sheet rather than piggybacking on the priority endpoint.

Reason:
- this flow is global, not tied to an existing `priorityKey`
- it should stay reusable by future surfaces

Recommended route:
- `POST /api/coach/organizer`

Responsibilities:
- validate payload
- resolve default title if omitted
- resolve default kanban target
- create agenda event when needed
- create kanban task when needed
- link both when mode is `both`

## Validation Rules

- client is required
- mode must be one of `agenda`, `kanban`, `both`
- date is required
- title may be auto-derived if omitted
- time is optional
- note is optional
- if no kanban board/column exists and mode requires kanban, return a clear error

## Non-Functional Defaults

- **Performance:** fast enough for frequent daily use; one round-trip orchestration endpoint.
- **Reliability:** partial failure must be explicit; avoid silently pretending both creations succeeded when only one did.
- **Security:** standard coach auth only; all created objects belong to current coach.
- **Maintenance:** share logic patterns with the existing priority planning endpoint when sensible.

## Success Criteria

- Coaches can create organization items from any coach page in one flow.
- The flow reliably lands in dashboard-backed systems.
- Client selection is fast and obvious.
- The header remains clean and stable.
- This does not introduce a second organization model outside Agenda/Kanban.
