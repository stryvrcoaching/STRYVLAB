# Workout Cycles and Program Audit — Architecture Design

**Date:** 2026-07-12  
**Status:** Multi-week cycles and deterministic mesocycle generator implemented

## Objective

Extend Workout Studio with explicit multi-week programming, deterministic mesocycle generation, and AI-assisted program audits without replacing or weakening the existing Smart Fit, Morpho Pro, progression, performance, assignment, and client workout systems.

## Existing contracts to preserve

- `programs.weeks` currently describes planned duration, not stored week variants.
- `session_mode = day | cycle` controls weekday scheduling versus free session ordering. It is not a mesocycle flag.
- Programs without explicit week rows must continue to expose their existing sessions.
- `client_workout_program_assignments` is the analytical source of truth for activation windows.
- Completed session and set logs must remain readable after a programme is edited.
- Smart Fit remains the deterministic real-time construction analysis.

## Terminology

- **Microcycle:** one explicit programme week.
- **Mesocycle:** an ordered sequence of microcycles.
- **Schedule mode:** existing `day | cycle` session scheduling behavior.
- **Completion behavior:** `repeat | hold_last | stop` after planned duration.
- **Program audit:** persisted analysis combining construction, execution, client fit, and data confidence.

## Target data model

### Program weeks

Add `program_weeks` with:

- `id`
- `program_id`
- zero-based `position`
- coach-facing `label`
- `week_type`: base, build, overload, deload, peak, custom
- optional `source_week_id` for duplication traceability
- timestamps

Add nullable `program_week_id` to `program_sessions`.

Compatibility rule: sessions with no `program_week_id` are the legacy repeated base week. Existing programs are not expanded or duplicated during migration. Conversion to explicit weeks is an intentional, transactional operation in Workout Studio.

Templates receive a mirrored `coach_program_template_weeks` structure so assignment and save-as-template flows preserve cycles.

### Stable identities

Sessions and exercises require stable lineage identifiers. Duplicating a week creates new row IDs while retaining lineage, allowing performance comparisons across week variants without confusing database identity with exercise identity.

The current full-delete/full-reinsert save path must be replaced before multi-week editing is enabled.

### Assignment schedule

Add an optional local `schedule_start_date` to workout assignments. When absent, reads fall back to the physiological date derived from `started_at` and the client timezone.

### Historical execution context

New session logs should capture:

- workout assignment ID
- program week ID and position
- cycle iteration
- prescription snapshot used when the session started

Historical logs must never depend on the current mutable programme definition.

## Week resolution

All client and analytical consumers use one pure resolver. Inputs are already-normalized local ISO dates, explicit week count, duration, and completion behavior. The resolver never performs timezone conversion.

Legacy programs return no explicit week position, preserving the existing session set. Explicit programs resolve by elapsed seven-day blocks from the assignment schedule start.

## Required read-side integrations

- Client programme page and session logger
- Client dashboard and Smart Workout
- Today timeline and AI coach facts
- Workout skip and alert routes
- Check-in and chat workout context
- Nutrition training-week alignment
- Coach performance analytics
- PDF and preview generation
- Progression evaluation

## Deterministic mesocycle engine

The generator accepts a versioned configuration and produces a previewable patch:

- source weeks and output duration
- volume strategy
- RIR strategy
- optional deload placement
- exercise or muscle-group scope
- safety constraints

The engine owns all arithmetic and validation. Generative AI may propose configuration values but does not directly mutate prescriptions.

### Implemented v1 contract

- Engine version: `mesocycle-v1`
- One active source week or all existing weeks can seed the output sequence.
- Output duration is constrained to 2–12 weeks.
- Volume can remain stable or progress linearly from a start to an end percentage.
- RIR progresses deterministically in 0.5 increments.
- An optional final deload applies its own volume percentage and target RIR.
- Per-exercise set limits prevent uncontrolled volume expansion.
- Time/RPE and distance/RPE prescriptions are preserved unchanged.
- The coach receives a complete preview before the apply action is enabled.
- Applying a preview stages new weeks, then performs an atomic database swap. A failed generation leaves the existing cycle intact.

## Program audit architecture

### Layer 1 — Construction

Reuse and extend Smart Fit outputs: volume, balance, SRA, specificity, redundancy, joint load, coordination, progression logic, and mesocycle coherence.

### Layer 2 — Execution reality

Compare planned and observed sessions, sets, repetitions, loads, RIR, completion, regularity, progression, stagnation, and fatigue over the active assignment window.

### Layer 3 — Client fit

Cross construction and execution with Morpho Pro, restrictions, level, objective, recovery, check-ins, and nutrition data when available.

### Layer 4 — AI synthesis

The language model receives normalized metrics, evidence references, and data-quality metadata. It produces structured findings labeled as fact, inference, or recommendation. It never calculates authoritative metrics from raw prose and never applies changes directly.

### Persisted reports

Store immutable reports keyed by program version, assignment window, analysis period, engine version, model version, and input hash. Cached reports may be reused when the input hash is unchanged.

## Delivery order

1. Characterization tests and dependency map
2. Pure week resolver
3. Additive schema and legacy fallback
4. Stable transactional programme writes
5. Workout Studio week controls
6. Client and analytical read migration
7. Deterministic mesocycle generator
8. Persisted deterministic audit
9. AI synthesis and adjustment proposals
10. Full AI programme generation

## Non-negotiable safeguards

- No destructive backfill of existing programs
- No silent programme mutation by AI
- No historical log attribution by session name alone when stronger identity exists
- No use of menstrual-cycle naming or data for training-cycle internals
- No single score presented without data coverage and evidence
- Coach approval before applying generated changes
