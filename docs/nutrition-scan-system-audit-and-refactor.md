# Nutrition Scan System Audit and Refactor

## Status

Validated design baseline for a full system audit and refactor of the nutrition scan flow.

## Implementation update — 2026-07-15

The scanner now treats every upload as neutral evidence until vision classifies its real role. A photo is no longer assumed to be a top view, side view, or scale close-up because of its position in the upload sequence.

Supported session families:

- plated meal or tray
- packaging and nutrition label
- barcode-led product
- receipt or restaurant order
- hybrid evidence session combining plate, receipt, packaging, label, barcode, user note, and separate weigh-ins

Implemented reliability rules:

- all photos in one session describe one final consumption
- receipt and tray evidence are fused without duplicate counting
- each readable scale display is attached to its source photo
- meal-total weight and per-component weight are distinct signals
- separate ingredient weigh-ins never trigger global plate rescaling
- serving-based receipt items remain editable as servings in the review UI
- private uploaded photos receive short-lived preview URLs without persisting public access
- interrupted drafts restore session, photos, note, meal type, and manual weight
- the client and storage enforce the same 10 MB per-photo limit and a 16-photo session cap

## Intent

Stabilize the nutrition scanner as a complete product system, not as a sequence of isolated bug fixes.

The target is:

- nutritionally strict
- operational across simple products and simple plates
- benchmarked against premium external models
- observable stage by stage
- capable of clarifying instead of hallucinating

## Understanding Summary

- The scanner must be reviewed as a full pipeline from image capture to final nutrition validation.
- The audit must cover both input families and pipeline stages.
- The product strategy is balanced: direct validation only when guardrails pass, otherwise targeted clarification.
- Premium external models are used as benchmarking references, not as absolute truth.
- Initial disagreement handling is manual arbitration so a reliable internal gold standard can be built.
- The final judge is strict nutritional accuracy, not just perceived UX smoothness.
- Phase 1 must produce a structured diagnostic, refactor specification, and prioritized implementation backlog.

## Confirmed Decisions

- Audit axes: `input type × pipeline stage`
- Input priority V1: simple products + simple plates
- Reliability policy: strict but pragmatic
- Latency target: `2–5 seconds`
- Retention policy: strict configurable retention
- Benchmark mode: compare by stage and final output
- Conflict resolution at start: manual arbitration
- Refactor strategy: hybrid, benchmark-driven, pipeline-first

## Assumptions

- A scanner can still be considered operational even if it asks for clarification on ambiguous cases.
- External models are strong references but can be wrong.
- Current failures on eggs, whey, cereals, packaging, and Red Bull expose systemic pipeline weaknesses.
- The system currently mixes several distinct scan modes too early or too opaquely.

## Non-Goals

- Chasing one-off case fixes without system observability
- Optimizing only for apparent confidence
- Treating benchmark model output as product truth
- Expanding to complex restaurant meals before simple products and simple plates are stable

## Audit Framework

### Axis A — Input Types

- simple plate
- atypical plate
- packaging
- drink
- supplement
- barcode
- hybrid

### Axis B — Pipeline Stages

- capture
- image transport
- mode classification
- vision and OCR
- product or food identification
- quantity resolution
- macro computation
- validation and clarification behavior

Each session under audit must be scored against both axes.

## Canonical Pipeline Contract

Every stage must emit:

- typed output
- local confidence score
- evidence list
- explicit failure reason

### Stage 1 — Capture

Expected outputs:

- ordered views
- file metadata
- capture context

Failure examples:

- unusable blur
- missing required angle
- unreadable label framing

### Stage 2 — Image Transport

Expected outputs:

- valid upload
- model-readable image access
- stable signed access or materialized payload

Failure examples:

- signed URL expiry
- remote file head or fetch failures
- oversized or malformed images

### Stage 3 — Mode Classification

Allowed modes:

- `plate`
- `packaging`
- `barcode`
- `hybrid`
- `drink`

Failure examples:

- packaging treated as plate
- hybrid supplement flow treated as simple meal

### Stage 4 — Perception

Expected outputs:

- OCR extraction
- label parsing
- visible quantity cues
- optional scale reading

Failure examples:

- product recognized but nutrition table not parsed
- plate recognized but composition unresolved

### Stage 5 — Business Resolution

Expected outputs:

- canonical product or food item
- resolved quantity
- unit source
- evidence provenance

Failure examples:

- recognized Red Bull but unresolved nutrition entry
- single-yolk egg assumption on atypical whites-heavy plate

### Stage 6 — Macro Computation

Expected outputs:

- kcal
- protein
- carbs
- fats
- explicit source mapping

Failure examples:

- non-zero product with zero macros
- quantity resolved but macros computed from wrong base

### Stage 7 — Validation Policy

Allowed states:

- `ready_to_log`
- `needs_clarification`
- `hard_fail`

Failure examples:

- direct validation on ambiguous composition
- silent pass-through despite macro inconsistency

## Product Decision Policy

### `ready_to_log`

Allowed only if all are true:

- mode correctly resolved
- main food or product resolved
- quantity sufficiently reliable
- macros coherent and non-null unless genuinely null
- no major business inconsistency

### `needs_clarification`

Required if:

- composition is plausible but incomplete
- quantity is underdetermined
- product recognized but nutrition resolution uncertain
- image evidence suggests atypical preparation

### `hard_fail`

Required if:

- transport or analysis pipeline breaks
- stage contracts are missing
- outputs are mutually inconsistent

## Benchmark and Scorecard

Each audited case must include:

- raw inputs
- our outputs by stage
- benchmark outputs by stage when available
- benchmark final output
- manual arbitration decision
- retained reference truth
- final macro error

### Per-Case Scorecard

Score each case on:

- mode classification
- OCR and packaging read
- product or food identification
- quantity resolution
- final macros
- final product behavior

### Core KPIs

- correct `ready_to_log` rate
- justified clarification rate
- false-positive nutrition rate
- average kcal error
- average protein error
- average carbs error
- average fat error
- technical failure rate
- median and p95 latency

## Priority Refactor Blocks

### Block 1 — Observability and Contracts

Deliver:

- structured stage logs
- confidence and evidence tracing
- explicit failure codes

Why first:

- without this, later fixes remain guesswork

### Block 2 — Mode Separation

Separate flows for:

- plate
- packaging
- barcode
- drink
- supplement
- hybrid

Why second:

- many current failures are likely caused by over-shared pipeline logic

### Block 3 — Nutrition Resolution Layer

Refactor:

- canonical mapping
- quantity source resolution
- macro source binding

Why third:

- this is where correct detection currently collapses into wrong nutrition

### Block 4 — Clarification Policy

Add:

- ambiguity rules
- mode-specific clarification prompts
- hard stop rules for invalid direct logging

Why fourth:

- this closes the loop on product-safe behavior

## Phase 1 Deliverables

### 1. Real Case Inventory

Initial real corpus includes:

- whey packaging
- cereals with scale
- atypical egg plate
- Red Bull can
- additional recent simple cases

### 2. Synthetic Case Inventory

Synthetic expansion includes:

- cans and bottles
- readable packaging
- simple plates
- controlled ambiguous cases

### 3. Audit Scorecard

Standard record for every case:

- inputs
- pipeline outputs by stage
- benchmark outputs
- retained truth
- nutrition error
- final verdict
- root cause

### 4. Failure Map

Must expose:

- top failures by stage
- top failures by input type
- top false positives
- top technical breaks

### 5. Refactor Specification

Must define:

- target stage contracts
- validation state machine
- mode boundaries
- forbidden and allowed fallbacks

### 6. Prioritized Backlog

Must include:

- quick wins
- structural refactors
- blocking failure classes
- non-regression tests

## Implementation Plan

### Track 1 — Audit Harness

1. Define a normalized audit case schema
2. Add persistent scorecard storage
3. Build benchmark runner interfaces
4. Add arbitration fields and verdict recording

### Track 2 — Pipeline Instrumentation

1. Add stage-level logs and confidence outputs
2. Add failure code taxonomy
3. Add evidence capture per stage
4. Expose debug traces for internal replay

### Track 3 — Mode Architecture

1. Audit current mode selection logic
2. Split mode-specific decision branches
3. Define per-mode allowed outputs and required evidence
4. Add mode-specific tests

### Track 4 — Nutrition Resolution

1. Audit product-to-macro mapping
2. Audit quantity resolution logic
3. Add source-of-truth provenance for every macro result
4. Prevent valid identification from collapsing into zero macros

### Track 5 — Clarification Rules

1. Define ambiguity heuristics
2. Add targeted prompts per failure class
3. Block direct logging on known unresolved classes
4. Measure clarification quality and false positive reduction

### Track 6 — Validation Gates

1. Define exact thresholds for direct logging
2. Add coherence checks
3. Add hard-fail rules for broken stage chains
4. Add non-regression benchmark checks

## Suggested Execution Order

### Wave 1

- audit harness
- instrumentation
- failure taxonomy

### Wave 2

- packaging, drinks, supplements
- canonical mapping
- macro source binding

### Wave 3

- simple plates
- quantity heuristics
- clarification rules

### Wave 4

- hybrid cases
- latency optimization
- benchmark hardening

## Immediate Next Tasks

1. Define the audit case schema
2. Inventory existing real cases already observed in the repo and screenshots
3. Trace current pipeline files and map them to the target stage model
4. Produce the first prioritized defect map
5. Open the implementation backlog for Wave 1

## Decision Log

### Decision 1

- Decision: audit the system on two axes, `input type × pipeline stage`
- Alternatives: bug-by-bug audit, flow-only audit
- Why: isolates root causes and prevents local patch drift

### Decision 2

- Decision: impose stage contracts with `output + confidence + evidence + failure reason`
- Alternatives: final-output-only diagnosis
- Why: makes the system benchmarkable and debuggable

### Decision 3

- Decision: use product states `ready_to_log`, `needs_clarification`, `hard_fail`
- Alternatives: permissive pre-analysis plus manual correction
- Why: reduces silent false positives

### Decision 4

- Decision: benchmark by stage and by final output
- Alternatives: compare only final outputs
- Why: final-only comparison hides root causes

### Decision 5

- Decision: start with real cases, then expand with synthetic corpus
- Alternatives: synthetic-only dataset
- Why: real failures must drive the refactor order

### Decision 6

- Decision: use manual arbitration at the start when benchmark and system disagree
- Alternatives: always trust benchmark output
- Why: external models are strong references but not absolute truth

### Decision 7

- Decision: prioritize strict nutritional accuracy over perceived fluency
- Alternatives: UX-first permissive logging
- Why: product trust depends on macro correctness

### Decision 8

- Decision: refactor in four blocks: observability, mode separation, nutrition resolution, clarification policy
- Alternatives: isolated direct bug fixes
- Why: maximizes long-term stability
