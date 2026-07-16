# Nutrition Calorie Smoothing V1

Date: 2026-06-29
Status: Validated design
Scope: Client PWA nutrition page, coach notifications, coach nutrition data supervision

## Goal

Add an intelligent calorie smoothing system on the client nutrition page so a client can redistribute a meaningful calorie surplus or deficit across upcoming days without mutating the coach's base nutrition protocol.

The feature must:

- stay coach-compatible with the existing 4-week nutrition protocol model
- respect the current calculation order already used on the client nutrition page
- notify the coach when a client activates a smoothing plan
- expose the plan in coach-facing nutrition data views
- allow the coach to modify, cancel, and annotate the plan

## Existing Context

### Coach nutrition model

The coach already configures nutrition days in Nutrition Studio across a 4-week repeating schedule. A coach can assign arbitrary day strategies and targets, including but not limited to:

- on
- off
- high
- low
- cheat meal
- hypercut
- fasting
- custom named days

This schedule is already reflected on the client nutrition page through the shared protocol and schedule slot system.

### Client nutrition model

The client nutrition page already computes a daily target from:

1. shared coach nutrition protocol
2. day override logic when applicable
3. cycle sync runtime adjustment when enabled

The smoothing system must be applied after those layers, as a temporary overlay.

Final target resolution order:

1. coach protocol target
2. cycle sync adjustment
3. calorie smoothing overlay

## Product Intent

This is not a punishment mechanic.

The framing is:

"You were above or below target today. We can gently rebalance the next days to stay on trajectory."

The UI and wording must remain premium, healthy, and coach-like.

## Functional Rules

### Trigger threshold

The smoothing proposal appears only when the calorie delta exits a symmetric tolerance zone.

- threshold: 50 kcal
- no proposal if delta is between -50 and +50 kcal inclusive
- proposal for surplus if delta is above +50 kcal
- proposal for deficit if delta is below -50 kcal

### Smoothable budget

The smoothable budget is computed beyond the threshold, not from the full delta.

Examples:

- target 1930, consumed 2341, raw delta +411, smoothable delta +361
- target 1930, consumed 1630, raw delta -300, smoothable delta -250

### Client flow

The feature is semi-automatic with explicit confirmation.

When triggered:

- the nutrition hero extends vertically
- a contextual explanation appears
- a recommended duration is preselected
- the client can confirm immediately
- or the client can modify the duration before confirming
- or the client can ignore the proposal

If the client chooses to modify:

- present a finite duration selector
- show a daily preview before confirmation

V1 recommended duration options:

- 3 days
- 4 days
- 5 days
- 7 days
- 10 days

### Macro redistribution

Protein remains fixed in V1.

The smoothing delta is redistributed only across:

- carbohydrates
- fats

V1 conversion recommendation:

- default ratio: 70 percent carbs
- default ratio: 30 percent fats

This ratio can become more adaptive later, but V1 should stay deterministic and easy to explain.

### Existing active smoothing plan

If a smoothing plan is already active and a new eligible delta appears, the client must choose one of:

- add to current plan
- replace current plan
- ignore

No silent stacking is allowed.

## Intelligent Distribution Rules

### Principle

The coach's nutrition structure remains primary.

The smoothing system must not flatten upcoming days uniformly if future days already have intentional differences.

### Priority

Distribution priority is:

1. coach-defined day structure
2. neutral fallback if no meaningful structure is available

### Practical V1 interpretation

Because coach day labels are free-form, the smoothing engine should not depend only on hard-coded labels like "high" or "low".

Instead, V1 should derive an internal absorption bucket from the future day's nutritional profile relative to nearby scheduled days.

Recommended internal buckets:

- protected_day
- neutral_day
- absorbent_day

Suggested behavior:

- higher-calorie or more protected days absorb less of a deficit correction
- lower-calorie or more absorbent days absorb more of a deficit correction
- the inverse applies when reinjecting calories after under-eating

If V1 day bucketing is too ambiguous for some protocols, fallback to a neutral weighted split instead of overfitting labels.

## Guardrails

The engine must refuse dangerous or incoherent daily adjustments.

Recommended V1 guardrails:

- maximum daily adjustment as a percentage of the pre-smoothing daily target
- daily floor calories must remain respected
- no protein reduction through smoothing
- if the proposed duration violates guardrails, recommend a longer duration
- if no safe distribution is possible, do not allow immediate confirmation with the unsafe shape

Guardrail tuning should be configurable in code, even if not coach-editable in V1.

## Data Model

### Guiding principle

Do not mutate the coach protocol itself.

Smoothing must be stored as a temporary, auditable overlay.

### Table 1: nutrition_smoothing_plans

One row per smoothing plan.

Suggested fields:

- id
- client_id
- coach_id
- source_date
- source_target_kcal
- source_consumed_kcal
- threshold_kcal
- raw_delta_kcal
- smoothable_delta_kcal
- direction: surplus | deficit
- duration_days
- strategy: recommended | manual
- status: active | completed | cancelled | replaced
- created_by: client | coach
- client_decision: confirmed | modified | ignored
- replaced_by_plan_id
- coach_note
- coach_note_updated_at
- coach_last_action: modified | cancelled | noted | null
- created_at
- updated_at

### Table 2: nutrition_smoothing_plan_days

One row per impacted future day.

Suggested fields:

- id
- plan_id
- date
- sequence_index
- resolved_bucket
- source_day_label
- day_weight
- base_target_kcal
- cycle_synced_target_kcal
- kcal_delta
- protein_delta_g
- carbs_delta_g
- fat_delta_g
- status: pending | applied | skipped | overridden
- created_at
- updated_at

### Optional table or revision strategy

Coach interventions should not silently destroy history.

Recommended approaches:

- either add a revisions table
- or preserve revision lineage on the plan table with replacement semantics

V1 requirement:

- a coach modification must remain traceable

## Notification Model

### Coach notifications

The repo already uses persistent coach notifications through `coach_notifications` and a coach inbox.

This feature must reuse that path instead of introducing a separate notification system.

When a client activates a smoothing plan:

- create a coach notification
- category should stay aligned with existing nutrition alerting semantics
- include enough payload to reconstruct the source day and plan

Minimum payload:

- smoothing_plan_id
- source_date
- direction
- raw_delta_kcal
- smoothable_delta_kcal
- duration_days

Desired coach notification summary:

- "Nutrition - smoothing activated (+361 kcal over 4 days)"
- "Nutrition - smoothing activated (-250 kcal over 5 days)"

### Athlete card badge

The existing athlete notification badge already aggregates unread client-specific notifications.

This feature must ensure smoothing notifications increment that count naturally.

### Notification reading UX

The user need is explicit: the coach must be able to click from the athlete card and inspect notifications for that client in a readable modal or navigable panel.

V1 requirement:

- smoothing notifications must be visible from the coach-side notification reading flow

Whether that is implemented as:

- a per-client modal
- a filtered inbox drawer
- or a client-scoped inbox route

is an implementation choice, but the behavior must exist.

## Coach Supervision

### Data Nutrition visibility

The plan must appear inside coach nutrition data views.

At minimum:

- the source day row must show that smoothing was activated
- impacted future rows must show that they carry a smoothing adjustment
- the coach must be able to inspect the remaining debt or credit across the plan

Recommended badges:

- smoothing active
- debt remaining
- credit remaining
- coach modified
- coach cancelled

### Coach actions

The coach must be able to:

- modify a smoothing plan
- cancel a smoothing plan
- leave a note

The note must become visible to the client.

### Client visibility after coach intervention

If the coach changes the plan:

- the client must see that the plan was adjusted by the coach
- the client must see the coach note when one exists

Recommended client copy:

- "Ton coach a ajusté ce lissage."
- "Ton coach a annulé ce lissage."

## UX Surfaces

### Client nutrition page

Target surface:

- current hero section on the client nutrition page

Behavior:

- hero extends when threshold is exceeded
- contextual message appears
- recommendation appears
- confirm, modify, ignore actions appear inline

If the client chooses modify:

- show a small sheet or inline expansion
- allow duration selection
- preview per impacted day:
  - date
  - resolved day bucket or day label
  - kcal delta
  - carbs delta
  - fats delta

### Coach athlete page

Target surface:

- athlete card notification badge

Behavior:

- count increases when smoothing notifications are unread
- coach can open the relevant client notification list

### Coach nutrition data

Target surface:

- nutrition data day lines and day details

Behavior:

- source row shows smoothing origin
- impacted rows show carried adjustments
- detail view shows full plan context and coach actions

## Edge Cases

### New delta while plan active

Prompt the client:

- add to current plan
- replace current plan
- ignore

### Future day target later changes

In V1, already persisted smoothing day rows should remain explainable and stable.

Recommendation:

- do not silently re-simulate historical plan rows after creation

### Day under- or over-performed during the smoothing window

Do not build a constantly self-rebalancing accounting engine in V1.

V1 should prioritize clarity over perfect mathematical re-optimization.

### Female cycle sync

No ambiguity:

- cycle sync resolves first
- smoothing applies last

## Non-Goals for V1

- no fully automatic smoothing without confirmation
- no infinite day-by-day recalculation after every food log
- no hidden stacking of multiple smoothing plans
- no mutation of the coach protocol as the source of truth
- no over-optimized macro heuristics beyond fixed-protein and carbs-fat redistribution

## Decision Log

### Decision 1

Use an event-based persisted smoothing plan model.

Alternatives considered:

- compute at render time only
- write directly into future daily targets

Why chosen:

- required for traceability, notifications, coach actions, and nutrition data supervision

### Decision 2

Keep coach protocol immutable.

Alternatives considered:

- direct mutation of future targets

Why chosen:

- avoids confusion and preserves a clear base target versus temporary overlay

### Decision 3

Use a symmetric threshold of 50 kcal.

Alternatives considered:

- asymmetric thresholds
- no threshold

Why chosen:

- simple, clear, and aligned with the intended healthy tolerance zone

### Decision 4

Apply smoothing after cycle sync.

Alternatives considered:

- apply before cycle sync
- disable smoothing when cycle sync is active

Why chosen:

- preserves physiological adjustments while still enabling client correction overlays

### Decision 5

Keep protein fixed and shift carbs plus fats only.

Alternatives considered:

- distribute across all macros

Why chosen:

- keeps recovery and satiety logic more stable and easier to explain

### Decision 6

Coach can modify, cancel, and annotate plans.

Alternatives considered:

- coach read-only supervision

Why chosen:

- aligns with the product's coaching model and keeps the coach in control

