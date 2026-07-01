# Coach Clients Action Strip V1

**Date:** 2026-07-01  
**Status:** Proposed  
**Primary Route:** `/coach/clients`

## Understanding Summary

- The KPI strip on the coach clients page currently mixes outdated semantics and redundant metrics.
- `Actifs` must no longer depend on invitation, app access, or legacy client status heuristics.
- A client is considered active only when they have at least one active formula.
- `Avec formule` becomes redundant if `Clients actifs` already means `has active formula`.
- `En attente` is too vague and overlaps conceptually with the coach notifications header.
- The clients page should complement the dashboard, not duplicate it.
- The page should help the coach decide which clients need attention now, while the dashboard remains the global planning and organization surface.
- The most valuable replacement is an action-oriented `À suivre` surface powered by smart client prioritization.

## Problem Statement

The current strip on `/coach/clients` exposes four metrics:
- `Total clients`
- `Actifs`
- `Avec formule`
- `En attente`

This has three product problems:

1. **Semantic inconsistency**
   - `Actifs` is currently calculated from `client.status === "active"`.
   - `Avec formule` is currently calculated from `has active subscription`.
   - Product logic has changed: active should now mean `has an active formula`.

2. **Redundancy**
   - Once `Clients actifs` means `has active formula`, `Avec formule` no longer adds independent value.

3. **Weak actionability**
   - `En attente` is ambiguous.
   - It sounds like raw notification count, but the coach already has notifications elsewhere.
   - The clients page needs decision support, not another unread badge.

## Goals

- Redefine `Clients actifs` using the new business rule.
- Replace redundant and vague strip metrics with action-oriented ones.
- Make the strip complement the dashboard by focusing on per-client prioritization.
- Turn the strip into an entry point for coach actions, not just passive reporting.
- Connect client-level prioritization with existing dashboard planning surfaces such as Agenda and Kanban.

## Non-Goals

- Redesign the main dashboard itself in this iteration.
- Replace the coach notifications system.
- Introduce a fully generic workflow engine for all coach operations.
- Rebuild client cards or the full clients page information architecture.

## Assumptions

- `formula active` is the canonical definition of client activity for this product area.
- Some business/economic formulas may not include app access.
- Therefore app access cannot be used as a proxy for active status.
- The dashboard remains the global execution and planning space.
- The clients page is the portfolio-level decision surface.
- V1 should support smart prioritization from day one, not a flat pending list.

## Decision Log

1. **Decision:** Redefine `Clients actifs` as `clients with at least one active formula`.  
   **Alternatives considered:** keep `client.status`, hybrid status, app-access-based activity.  
   **Why chosen:** aligns with current business model and removes ambiguity.

2. **Decision:** Replace `Avec formule` with `Sans formule`.  
   **Alternatives considered:** keep `Avec formule`, show `Avec accès app`, show `Inactifs`.  
   **Why chosen:** `Sans formule` is complementary to active clients and directly action-oriented.

3. **Decision:** Replace `En attente` with `À suivre`.  
   **Alternatives considered:** `Alertes`, `Relances`, `À traiter`, `Notifications`.  
   **Why chosen:** broader, clearer, and compatible with multi-source smart prioritization.

4. **Decision:** Make `Sans formule` and `À suivre` interactive.  
   **Alternatives considered:** keep all strip items passive, full-page navigation instead of panel.  
   **Why chosen:** supports fast triage without losing clients-page context.

5. **Decision:** Use a client-centric priority model for `À suivre`.  
   **Alternatives considered:** raw event count, raw notifications count, dashboard duplication.  
   **Why chosen:** the coach needs one dominant action per client, not fragmented signals.

## Final Strip Design

The strip on `/coach/clients` becomes:

- `Total clients`
- `Clients actifs`
- `Sans formule`
- `À suivre`

### Tile Behavior

#### `Total clients`
- Informational only.
- Not clickable.
- Represents the total portfolio size.

#### `Clients actifs`
- Informational only.
- Not clickable.
- Represents clients with at least one active formula.
- Card-level badges remain the local visual confirmation.

#### `Sans formule`
- Clickable.
- Opens a side panel rather than hard navigation.
- Lists clients without an active formula.
- Each row must allow:
  - open profile
  - optional direct `Attribuer une formule` action

#### `À suivre`
- Clickable.
- Opens a priority side panel.
- Displays action-oriented client items, not raw events.
- Each row must allow:
  - open profile
  - one smart primary action
  - optional secondary open-to-agenda or open-to-kanban action

## Domain Rules

### `Clients actifs`
A client is active if and only if they have at least one active formula.

Included:
- client with one active formula
- client with multiple formulas where at least one is active

Excluded:
- client with no formula
- client with only expired formulas
- client with only cancelled formulas
- client with only trial formulas
- client with only paused/inactive formulas

### `Sans formule`
A client belongs to `Sans formule` if they have no active formula.

Included:
- no formula at all
- formula history exists, but no active formula remains

Excluded:
- any client with at least one active formula

### `À suivre`
`À suivre` counts the number of distinct clients with at least one open coach action.

Important:
- this is a count of clients, not a count of events
- one client appears once even if several signals exist
- the UI shows one dominant action item per client

## `À suivre` Action Model

### Core Entity
Use a conceptual entity equivalent to:
- `client action item`
- one row = one client + one dominant reason + one highest priority + one recommended action

This is a product-layer aggregation model. It may be materialized in memory in V1 rather than persisted immediately.

### Input Sources
`À suivre` may aggregate signals from:
- coach notifications
- pending or newly received assessments / bilans / check-ins
- formula/commercial state issues
- inactivity or drop-off heuristics
- reminder/planning context from the dashboard ecosystem
- existing Agenda or Kanban linkage indicating work already planned

### Priority Levels
Three priority bands:

- `Urgent`
- `Important`
- `À planifier`

#### `Urgent`
Used when immediate coach attention is required.
Examples:
- active-client flow broken by missing valid commercial coverage according to final chosen business rule
- critical health / adherence / recovery signal
- heavily overdue coach review checkpoint

#### `Important`
Used when prompt action is useful but not crisis-level.
Examples:
- assessment received and waiting for review
- high-value unread coach notification
- active client showing recent disengagement

#### `À planifier`
Used for useful but non-blocking work.
Examples:
- follow-up touchpoint
- routine review
- commercial relaunch
- organization item better converted into agenda/kanban work

## Deduplication Rules

- Multiple notifications for the same client do not create multiple action rows.
- Multiple signal sources can feed the same client action item.
- The chosen visible row uses:
  1. highest priority available
  2. then most actionable reason
  3. then most relevant smart CTA

This prevents the side panel from becoming a second noisy inbox.

## Relationship With Dashboard, Agenda, and Kanban

### Product Boundary
- **Dashboard:** global operations and planning view.
- **Clients page:** portfolio and decision view by client.
- **`À suivre`:** intelligent bridge between the two.

### Operational Rule
The clients page must not mirror all dashboard objects directly.
Instead it should expose only client-relevant synthesized actions.

### Agenda / Kanban Interaction
If a client action is already represented in an execution system:
- display `Déjà planifié` or equivalent state
- prefer `Ouvrir` over `Créer`
- avoid duplicate planning actions

If the action is immediate:
- primary CTA should be direct execution
  - `Voir le bilan`
  - `Attribuer une formule`
  - `Envoyer un message`
  - `Ouvrir les notifications`

If the action is organizational:
- primary or secondary CTA may be:
  - `Planifier dans l'agenda`
  - `Ajouter au Kanban`
  - `Ouvrir la tâche`

## Interaction Design

### Side Panel Choice
Use side panels rather than navigation-first behavior.

Why:
- preserves coach context on the clients page
- enables rapid triage across several clients
- avoids unnecessary route switching for lightweight actions

### `Sans formule` Panel
Each row should show at minimum:
- client name
- contextual status summary
- optional entry date / recent context
- CTA: `Ouvrir le profil`
- optional CTA: `Attribuer une formule`

### `À suivre` Panel
Recommended row structure:
- client name
- priority pill
- dominant reason
- source label
- age / lateness indicator if relevant
- primary smart action
- profile access
- optional plan-state indicator (`Déjà planifié`)

Recommended grouping order:
- `Urgent`
- `Important`
- `À planifier`

## Edge Cases

### Client with expired formula
- not active
- included in `Sans formule`
- may also appear in `À suivre` if a follow-up or relaunch is relevant

### Client with business formula but no app access
- can still be active
- app access does not determine active state

### Client with many weak notifications
- should not automatically inflate `À suivre`
- only decision-worthy signals should produce action items

### Client already planned in Agenda/Kanban
- keep visible in `À suivre` only if still unresolved
- mark as planned
- open existing work rather than recreate it

### Client with multiple simultaneous issues
- appears once in `À suivre`
- row shows dominant issue
- secondary reasons may be visible on expand or in detail

## Implementation Shape for V1

### UI Scope
- Update strip labels and calculations in `/coach/clients`
- Add click behavior to `Sans formule` and `À suivre`
- Add two side panels:
  - `Sans formule`
  - `À suivre`

### Logic Scope
- Recompute `Clients actifs` from active formulas only
- Recompute `Sans formule` as complement of active-formula presence
- Build a V1 aggregation layer for `À suivre`
- Deduplicate by client before rendering
- Integrate existing dashboard planning state where available

### Delivery Strategy
Implement as a focused V1 without introducing unnecessary persistence unless required by complexity or performance.
Start with aggregation from existing sources and keep the action taxonomy explicit and readable.

## Testing Considerations

- verify `Clients actifs` and `Sans formule` are mathematically coherent against mixed formula states
- verify one client cannot appear several times in `À suivre`
- verify priority ordering is stable and deterministic
- verify `Déjà planifié` state blocks duplicate planning CTA paths
- verify direct CTA paths open the correct destination or action target
- verify side panels preserve page context and do not break navigation flow

## Explicit Status Rule For V1

For this page, only formula status `active` counts as active.

Excluded from `Clients actifs` in V1:
- `trial`
- `paused`
- `cancelled`
- `expired`
- any missing or unknown status

If product rules change later, this rule must be updated centrally and reused consistently across all coach-facing surfaces.

## Recommended Outcome

This redesign turns the clients page strip from a passive KPI row into a decision layer:
- `Total clients` describes portfolio size
- `Clients actifs` reflects the new business truth
- `Sans formule` exposes commercial gaps
- `À suivre` converts distributed signals into prioritized client actions

The result is complementary to the dashboard rather than duplicative:
- dashboard = global organization
- clients page = client-level prioritization
- `À suivre` = smart bridge between both
