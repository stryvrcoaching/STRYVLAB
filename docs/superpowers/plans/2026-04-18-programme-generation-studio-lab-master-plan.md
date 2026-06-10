# Programme Generation Studio-Lab — Master Plan

> **Complete roadmap for STRYVR programme builder redesign and optimization.**
> 
> Updated: 2026-04-18
> 
> This document tracks all phases: MorphoPro Bridge → Phase 1 UI → Phase 2 Biomechanics → Phase 3 ML → Phase 4 Export/Webhooks

---

## Mission

Transform the STRYVR programme generation system into a **studio-lab grade tool** with:
- Optimal UX (dual-pane layout, real-time intelligence feedback)
- Morphology-informed stimulus coefficients
- Rule-based progression engine (not ML)
- Performance feedback loops for auto-adjustment
- Lab mode for experimentation and A/B testing

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   COACH INTERFACE (Phase 1)                 │
│  Dual-Pane: Navigator (16%) | Editor (54%) | Intelligence  │
│  Real-time scoring, Lab Mode, A/B variants                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│          MorphoPro Bridge (Pre-Phase 1)                      │
│  OpenAI Vision → body composition, dimensions, asymmetries   │
│  Stimulus adjustments per pattern (0.8–1.2 range)            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│        Phase 2: Biomechanics Engine (Rule-Based)             │
│  SRA windows, stimulus balance, muscle distribution          │
│  Client profile integration (injuries, equipment)            │
│  Real-time alerts (redundancy, imbalance, specificity)       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│   Phase 3: Performance Feedback Loops & Auto-Adjustment      │
│  Client logs actual RIR/reps → system predicts next week     │
│  Morpho timeline tracking (progression vs morpho changes)    │
│  Progressive overload recommendations (volume, intensity)    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│      Phase 4: Export & Automation                            │
│  Programme export (PDF, CSV, app-native format)              │
│  Inngest jobs: programme completed, performance update       │
│  Analytics dashboard: adherence, trends, morpho progression  │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 0: MorphoPro Bridge (Pre-Phase 1)

### Goals
- Store versioned morpho analyses per client (timeline)
- Derive morpho-informed stimulus coefficients per movement pattern
- Feed morpho data into scoring engine
- Coach can trigger analysis via UI + see results

### Key Deliverables

#### 1. Data Model
- `morpho_analyses` table (versioned, indexed by client_id + date)
- Stores: raw OpenAI Vision payload, body composition, dimensions, asymmetries, stimulus adjustments
- RLS policies (coach read/write own clients, client read own)

#### 2. API Routes
- `POST /api/clients/[clientId]/morpho/analyze` — trigger job
- `GET /api/clients/[clientId]/morpho/latest` — fetch for scoring
- `GET /api/clients/[clientId]/morpho/analyses` — timeline view
- `POST /api/clients/[clientId]/morpho/job-status` — poll progress

#### 3. Async Job Pipeline
- `analyzeMorphoJob()` — orchestrates OpenAI Vision calls, parsing, metrics merging
- `parseM orphoResponses()` — extract body_fat, muscle_mass, dimensions, asymmetries from vision
- `calculateStimulusAdjustments()` — derive morpho-informed coefficients per pattern

#### 4. Scoring Integration
- `buildIntelligenceResult()` accepts optional `clientId` + `morphoAnalysisId` (lab mode override)
- `scoreSpecificity()` uses morpho adjustments
- `scoreRedundancy()` uses morpho adjustments

#### 5. Coach Workflow
- Profil tab: new "Morpho Analysis" section
- `[Analyser Morpho]` button → triggers job after bilan completion
- Status display: "Queued", "Completed", "Failed"
- View timeline of all analyses

### Success Criteria
- ✅ morpho_analyses table + RLS
- ✅ All 4 API routes working
- ✅ OpenAI Vision integration working
- ✅ Job queue + async execution
- ✅ Stimulus adjustments applied to scoring
- ✅ Coach UI for triggering analysis
- ✅ Job status polling + error handling
- ✅ CHANGELOG + project-state updated

### Timeline
**Estimated: 1.5–2 weeks** (depends on OpenAI Vision API complexity + queue setup)

**Implementation Mode:** subagent-driven-development (fresh agent per task, two-stage review)

---

## Phase 1: UI Redesign — Studio-Lab Grade

### Goals
- Transform ProgramTemplateBuilder into professional, dense UI
- Real-time intelligence feedback (as coach edits)
- Lab Mode for experimentation (variants, biomechanics debug, rule transparency)
- Modular Intelligence Panel (dock/undock/float/minimize)
- Morpho-informed scoring visible throughout

### Key Architecture

#### Layout (Desktop-First)
```
TopBar: Coach name, org, [+ Nouveau] [Settings]
├─ Navigator Pane (16%)
│  ├─ Session list (draggable, collapsible)
│  ├─ Exercise tree (click to select)
│  └─ [+ Add Session]
│
├─ Editor Pane (54%)
│  ├─ Session header + metadata
│  ├─ Exercise cards (2-column: image + details)
│  ├─ Real-time intelligence updates
│  └─ Lab Mode section (collapsed by default)
│
└─ Intelligence Panel (30%, modular)
   ├─ Global Score (animated)
   ├─ Subscores bar
   ├─ Muscle distribution radar
   ├─ Pattern distribution pie
   └─ Alerts feed (3 visible, expandable)
```

#### Key Features
1. **Real-Time Intelligence** — as coach edits exercises, scores update live (debounce 300ms)
2. **Lab Mode (Visible by Default)**
   - Variant manager (create v1_experiment, compare scores)
   - Biomechanics debug (stimulus coeff, recovery windows, fatigue heatmap)
   - Rule transparency (why each subscore = X/100)
   - Morpho controls (select different morpho date, see impact)
3. **Modular Intelligence Panel**
   - Dock left/right (default right)
   - Float (detachable window)
   - Minimize (compact icon bar)
   - Fullscreen (dedicated deep analysis)
4. **Drag-Drop**
   - Reorder sessions, exercises
   - Visual feedback, instant save
5. **Alternatives Drawer**
   - Scored, filterable (same/other equipment, easier/harder)
   - Click to replace instantly

#### Components
- `ProgramTemplateBuilder` — main orchestrator
- `NavigatorPane` — session list, tree, actions
- `EditorPane` — exercise cards, real-time updates
- `IntelligencePanel` — modular, floating, dockable
- `ExerciseCard` — 2-column layout (image + details)
- `LabModeSection` — variants, biomechanics, rules, morpho
- `AlertsBadge` — inline alerts on exercises
- `AlternativesDrawer` — scored alternatives

#### Design Tokens (DS v2.0 Studio-Grade)
- Background: `#121212`
- Cards: `bg-white/[0.02]`
- Inputs: `#0a0a0a`
- Accent: `#1f8a65`
- Lab Mode: `#8b5cf6` (purple, distinct)
- Typography: Lufga (titles), Mono (data)
- Spacing: `p-4`, `gap-4` (tight for studio density)
- Borders: `border-white/[0.06]`

### Success Criteria
- ✅ Dual-pane layout responsive + performant
- ✅ Real-time Intelligence scoring integrates client data
- ✅ Lab Mode visible by default, toggle-hideable
- ✅ A/B variant manager with comparison
- ✅ Biomechanics transparency (stimulus, recovery, fatigue)
- ✅ Rule transparency (why each subscore = X/100)
- ✅ Drag-drop functional (sessions, exercises)
- ✅ Alternatives Drawer scored, filterable, instant replace
- ✅ Modular Intelligence Panel (dock/undock/float/minimize)
- ✅ DS v2.0 studio-grade applied throughout
- ✅ Mobile fallback (tab interface)
- ✅ Zero TypeScript errors
- ✅ CHANGELOG + project-state updated

### Timeline
**Estimated: 2–3 weeks** (layout refactor + component refactoring + Lab Mode implementation)

**Implementation Mode:** subagent-driven-development

---

## Phase 2: Biomechanics Engine — Rule-Based Progression

### Goals
- Implement rule-based scoring engine (NO generative AI)
- Integrate client profile (injuries, equipment restrictions, fitness level)
- Real-time alerts for imbalance, redundancy, low recovery
- Auto-suggestions for exercise alternatives based on rules

### Key Components

#### 1. Scoring Subscores (Existing + Enhanced)
- **SRA (Specific Recovery Ability)** — recovery windows by muscle group
  - Alert if exercise recovers <50% of required window
  - Heatmap showing fatigue accumulation over 4 weeks
- **Balance** — push/pull/legs/core ratio by goal
  - Alert if ratios deviate >10% from target
  - Visual pie chart
- **Specificity** — stimulus coefficient aligned with goal
  - Morpho-adjusted coefficients apply here
  - Alert if avg stimulus <0.7 for goal
- **Progression** — RIR, volume, density over time
  - Alert if RIR=0 in week 1 (too easy)
  - Alert if RIR too high (stall risk)
- **Redundancy** — duplicate exercises (same pattern + muscles)
  - Morpho asymmetries make redundancy less redundant
  - Alert if >20% redundancy
- **Completeness** — required patterns by goal (missing patterns)
  - Goal=hypertrophy requires push, pull, legs, core
  - Alert if pattern missing

#### 2. Client Profile Integration
- **Injury Restrictions** — body_part + severity (avoid, limit, monitor)
  - MUSCLE_TO_BODY_PART mapping
  - Alert: INJURY_CONFLICT (critical if avoid, warning if limit)
  - Penalty: -30 pts (avoid), -15 pts (limit)
- **Equipment Availability** — equipment array on coach_clients
  - Filter exercises by available equipment
  - Alert: EQUIPMENT_MISMATCH for required patterns
- **Fitness Level** — fitnessLevel from client profile
  - Modulate SRA windows by level (beginner wider windows)
  - Adjust progression expectations

#### 3. Morpho Integration (Phase 0 output)
- **Stimulus Adjustments** — per pattern (0.8–1.2 range)
  - Specificity uses adjusted coefficients
  - Redundancy assessment uses adjusted coefficients
- **Asymmetry Handling** — unilateral exercises become more valuable
  - If arm asymmetry >2cm: unilateral patterns get +15%
  - Reduces redundancy between unilateral ↔ bilateral

#### 4. Real-Time Alerts
- Critical (red): Low SRA, missing pattern, injury conflict
- Warning (amber): Imbalance, redundancy, progression stall
- Info (blue): Equipment mismatch, asymmetry opportunity

### Success Criteria
- ✅ All 6 subscores implemented + tested
- ✅ Client profile (injuries, equipment, fitness level) integrated
- ✅ Morpho stimulus adjustments applied correctly
- ✅ Real-time alerts accurate + actionable
- ✅ SRA heatmap shows fatigue accumulation
- ✅ Rule transparency (why each score = X/100)
- ✅ Coach can override coefficients in Lab Mode
- ✅ Zero TypeScript errors
- ✅ Unit tests for all scoring logic
- ✅ CHANGELOG + project-state updated

### Timeline
**Estimated: 2–2.5 weeks** (scoring refactor + profile integration + tests)

**Implementation Mode:** subagent-driven-development

---

## Phase 3: Performance Feedback Loops & Auto-Adjustment

### Goals
- Client logs actual RIR/reps in SessionLogger
- System predicts next week's volume/intensity based on performance
- Morpho timeline tracking (how does body comp change affect program?)
- Progressive overload automation

### Key Features

#### 1. Actual Performance Capture
- Client logs per set: RIR (perceived recovery ability)
- SessionLogger already has structure (client_set_logs)
- Coach reviews actual vs planned (in session recap)

#### 2. Performance Analysis (New)
- **RIR Tracking** — client RIR per exercise per week
  - If avg RIR >3: exercise too easy → recommend volume increase
  - If avg RIR <1: exercise too hard → recommend intensity decrease
- **Completion Rate** — did client hit planned reps?
  - 100%: on track
  - 80-99%: slightly fatigued, watch recovery
  - <80%: overreaching, reduce volume next week
- **Progression Velocity** — is weight/reps improving each week?
  - If stalled >2 weeks: alert coach

#### 3. Auto-Recommendations
- Volume adjustments: +1 set or -1 set per exercise
- Intensity adjustments: ±5% weight for next week
- Exercise swaps: if completion rate low, suggest easier alternative
- Recovery extension: if SRA windows not met, add rest day

#### 4. Morpho-Performance Correlation
- Compare morpho snapshots vs performance metrics
- Example: "Client added 2kg muscle → squats improved 10%" (visualization)
- Coach can see: morpho changes → program outcome

#### 5. Weekly Auto-Adjust Option
- Coach can enable "Auto-Adjust" mode
- System suggests adjustments each week based on performance
- Coach reviews + approves before applying

### Success Criteria
- ✅ RIR + completion rate tracking from client logs
- ✅ Auto-recommendation engine (volume, intensity, swaps)
- ✅ Coach review + approval UI
- ✅ Morpho-performance correlation dashboard
- ✅ Weekly performance heatmap (RIR, reps, weight by exercise)
- ✅ Coach can enable/disable auto-adjust per program
- ✅ Zero TypeScript errors
- ✅ CHANGELOG + project-state updated

### Timeline
**Estimated: 2 weeks** (performance analysis + auto-adjust logic + UI)

**Implementation Mode:** subagent-driven-development

---

## Phase 4: Export & Integration Webhooks

### Goals
- Coach exports program (multiple formats)
- Webhook notifications to n8n (e.g., program completed)
- Analytics dashboard (client adherence, performance trends)

### Key Features

#### 1. Programme Export
- **PDF Export** — formatted programme (sessions, exercises, sets, images)
- **CSV Export** — structured data (coach can import to spreadsheet)
- **JSON Export** — full programme + scoring metadata (for archival, API)
- **App-Native Format** — formatted for mobile client app (SessionLogger)

#### 2. Webhook Triggers
- Programme completed → POST to n8n webhook
- Client performance update → POST to n8n
- Morpho analysis completed → POST to n8n
- Payload: programme_id, client_id, metrics, timestamp

#### 3. Analytics Dashboard
- Client adherence (% sessions completed)
- Performance trends (RIR, reps, weight over time)
- Morpho progression (body composition timeline)
- Programme impact (before/after metrics)

### Success Criteria
- ✅ PDF export works (styling, layout)
- ✅ CSV + JSON exports working
- ✅ Webhook POST calls to n8n endpoint
- ✅ Analytics dashboard functional + responsive
- ✅ Zero TypeScript errors
- ✅ CHANGELOG + project-state updated

### Timeline
**Estimated: 1.5 weeks** (export logic + webhooks + dashboard)

**Implementation Mode:** subagent-driven-development

---

## Overall Project Timeline

| Phase | Scope | Timeline | Start | End |
|-------|-------|----------|-------|-----|
| **Phase 0** | MorphoPro Bridge | 1.5–2 weeks | 2026-04-18 | ~2026-05-02 |
| **Phase 1** | UI Redesign | 2–3 weeks | 2026-05-03 | ~2026-05-24 |
| **Phase 2** | Biomechanics | 2–2.5 weeks | 2026-05-24 | ~2026-06-07 |
| **Phase 3** | Feedback Loops | 2 weeks | 2026-06-07 | ~2026-06-21 |
| **Phase 4** | Export/Webhooks | 1.5 weeks | 2026-06-21 | ~2026-07-05 |
| **TOTAL** | **Full Studio-Lab Tool** | **~9–10.5 weeks** | 2026-04-18 | ~2026-07-05 |

---

## Success Criteria (Overall Project)

### Functionality
- ✅ MorphoPro: Coach can analyze client morpho, see results + timeline
- ✅ Phase 1 UI: Studio-lab builder with dual-pane, Lab Mode, real-time intelligence
- ✅ Biomechanics: Rule-based scoring + alerts + profile integration
- ✅ Feedback Loops: Auto-adjust recommendations based on performance
- ✅ Export: Multiple formats + webhook notifications
- ✅ Mobile fallback: Tab interface functional on <1200px

### Code Quality
- ✅ Zero TypeScript errors (strict mode)
- ✅ Unit tests for scoring engine (Vitest)
- ✅ Integration tests for API routes
- ✅ All API routes validated with Zod
- ✅ No hardcoded values (all from DB or config)

### Documentation
- ✅ CHANGELOG.md updated after each phase
- ✅ project-state.md updated with architecture + next steps
- ✅ Phase design specs saved (this document + individual phase specs)
- ✅ API route documentation (JSDoc comments)
- ✅ Schema documentation (Prisma comments)

### Performance
- ✅ Real-time Intelligence updates within 300ms (debounce)
- ✅ Scoring recalc <100ms (optimized queries)
- ✅ No unoptimized N+1 queries
- ✅ Image loading lazy (client cards)
- ✅ Lab Mode doesn't impact main scoring performance

---

## Decision Log

### 1. Backend-Only MorphoPro (No n8n)
- **Decided:** Phase 0 MorphoPro is backend-only (API routes + async jobs)
- **Rationale:** More control, cleaner architecture, no external service dependency
- **Alternative:** n8n webhook flow (rejected: less reliable, harder to debug)

### 2. OpenAI Vision API (Not Custom ML)
- **Decided:** Use OpenAI Vision API for photo analysis
- **Rationale:** Fast to implement, accurate, scalable
- **Alternative:** Custom ML model (rejected: too slow for MVP, requires training data)

### 3. Rule-Based Scoring (Not Generative AI)
- **Decided:** Phase 2 uses rule-based formulas (SRA windows, stimulus coefficients, etc.)
- **Rationale:** Transparent, debuggable, no "black box", faster, cheaper
- **Alternative:** ML-based scoring (deferred to Phase 3+ only if value proven)

### 4. Morpho-Informed Stimulus (0.8–1.2 Range)
- **Decided:** Morpho adjustments scale stimulus coefficients by 0.8–1.2 per pattern
- **Rationale:** Preserves base coefficient logic, morpho becomes modifier
- **Alternative:** Rebuild all coefficients from scratch (too risky, loses calibration)

### 5. Lab Mode Visible by Default
- **Decided:** Lab Mode visible by default in Phase 1 UI, coach can toggle off
- **Rationale:** Studio-lab tool should expose internals; coach can hide if distracting
- **Alternative:** Lab Mode hidden by default (rejected: defeats studio-grade purpose)

### 6. Async Job Queue for MorphoPro
- **Decided:** Analyze morpho asynchronously (non-blocking)
- **Rationale:** Coach doesn't wait for OpenAI API (10+ seconds), better UX
- **Alternative:** Synchronous morpho analysis (rejected: timeout risk, blocking)

### 7. Dual-Pane Layout (16/54/30 Proportions)
- **Decided:** Navigator 16%, Editor 54%, Intelligence 30%
- **Rationale:** Editor is primary workspace (54%), Intelligence is feedback (30%), Navigator is reference (16%)
- **Alternative:** Tabbed interface (rejected: context switching, studio-grade needs always-visible)

### 8. Real-Time Intelligence Updates (300ms Debounce)
- **Decided:** Scores update live as coach edits (debounce 300ms)
- **Rationale:** Continuous feedback loop, coach sees impact immediately
- **Alternative:** Manual "Save & Recalculate" button (rejected: broken feedback loop)

---

## Risk Mitigation

### Risk: OpenAI Vision API Costs
- **Mitigation:** Monitor usage, set API spending limits, cache results
- **Plan B:** If costs exceed budget, switch to local image processing (Phase 2)

### Risk: Real-Time Scoring Laggy
- **Mitigation:** Debounce 300ms, run scoring on web worker (if needed)
- **Plan B:** Async scoring updates if main thread blocked

### Risk: Lab Mode Confuses Coaches
- **Mitigation:** Lab Mode collapsible by default, onboarding docs + tooltips
- **Plan B:** A/B test UI with/without Lab Mode visibility

### Risk: Async Job Queue Reliability
- **Mitigation:** Retry logic (3 attempts, exponential backoff), error logging
- **Plan B:** Switch to Supabase cron or external job service (Bull, Temporal)

### Risk: Morpho Stimulus Adjustments Don't Improve Outcomes
- **Mitigation:** Track correlation in Phase 3 (performance feedback loops)
- **Plan B:** Disable morpho adjustments if no measurable benefit

---

## Known Limitations (MVP)

- **Phase 0:** MorphoPro analysis quality depends on photo quality + OpenAI Vision accuracy
- **Phase 1:** Mobile fallback (tabs) not optimized for salle (portrait mode may be cramped)
- **Phase 2:** Rule-based scoring doesn't account for individual recovery capacity (genetic variation)
- **Phase 3:** Auto-adjust recommendations are conservative (require coach approval)
- **Phase 4:** Webhook integrations limited to n8n (no Zapier, Make, etc. yet)

---

## Next Steps (Immediate)

1. **Phase 0 Start:** Approve MorphoPro spec → spawn subagents for:
   - Task 1: Database migration + RLS
   - Task 2: API routes
   - Task 3: Async job + OpenAI integration
   - Task 4: Scoring integration
   - Task 5: Coach UI

2. **Phase 1 Start** (after Phase 0 ≈ 2026-05-03):
   - Approve Phase 1 UI spec → refactor ProgramTemplateBuilder
   - Spawn subagents for layout, components, Lab Mode, interactions

3. **Phase 2 Start** (after Phase 1 ≈ 2026-05-24):
   - Enhance scoring engine with full profile integration
   - Add alerts + recommendations

4. **Ongoing:**
   - Update CHANGELOG after each phase
   - Update project-state.md after each sprint
   - Monitor performance + costs
   - Gather coach feedback on UI/UX

---

## Document Maintenance

**Last Updated:** 2026-04-18

**Next Review:** After Phase 0 completion (≈ 2026-05-02)

**Reviewers:** User, Coach, Development Team

---

## Appendix A: File Structure (Phase 0–4)

```
src/
├── app/
│   └── api/
│       ├── clients/[clientId]/
│       │   ├── morpho/analyze/route.ts (Phase 0)
│       │   ├── morpho/latest/route.ts (Phase 0)
│       │   ├── morpho/analyses/route.ts (Phase 0)
│       │   └── morpho/job-status/route.ts (Phase 0)
│       └── dashboard/
│           └── export/route.ts (Phase 4)
│
├── components/programs/
│   ├── ProgramTemplateBuilder.tsx (Phase 1 refactor)
│   ├── NavigatorPane.tsx (Phase 1 new)
│   ├── EditorPane.tsx (Phase 1 new)
│   ├── IntelligencePanel.tsx (Phase 1 refactor)
│   ├── LabModeSection.tsx (Phase 1 new)
│   └── AlternativesDrawer.tsx (existing, Phase 1 enhance)
│
├── components/clients/
│   ├── MorphoAnalysisSection.tsx (Phase 0 new)
│   └── MetricsSection.tsx (existing)
│
├── lib/
│   ├── morpho/
│   │   ├── analyze.ts (Phase 0 new)
│   │   ├── parse.ts (Phase 0 new)
│   │   └── adjustments.ts (Phase 0 new)
│   │
│   ├── programs/intelligence/
│   │   ├── scoring.ts (Phase 2 enhance)
│   │   ├── catalog-utils.ts (existing)
│   │   ├── alternatives.ts (existing)
│   │   └── profile-integration.ts (Phase 2 new)
│   │
│   └── health/
│       └── useBiometrics.ts (existing, Phase 0 enhance)
│
├── jobs/
│   └── morpho/
│       └── analyzeMorphoJob.ts (Phase 0 new)
│
└── prisma/
    └── schema.prisma (update: morpho_analyses table in Phase 0)

tests/
├── lib/intelligence/
│   ├── scoring.test.ts (Phase 2 enhance)
│   └── morpho.test.ts (Phase 0 new)
│
└── api/
    └── morpho.test.ts (Phase 0 new)
```

---

## Appendix B: Design System (DS v2.0 Studio-Grade)

**Colors:**
- Background: `#121212`
- Surface: `bg-white/[0.02]`
- Input: `#0a0a0a`
- Accent: `#1f8a65`
- Lab: `#8b5cf6`

**Typography:**
- H1: Lufga `text-lg font-semibold`
- Body: Lufga `text-[12px] text-white/60`
- Data: Mono `font-mono text-[12px]`

**Spacing:** `p-4`, `gap-4`, `mb-4`

**Borders:** `border-white/[0.06]`

**Animations:** Framer Motion (300–500ms)

---

## Appendix C: Success Metrics (Quarterly)

**After Phase 0 (≈ 2026-05-02):**
- Coaches able to analyze client morpho + see timeline
- Stimulus adjustments applied to scoring
- No data loss, job queue reliable

**After Phase 1 (≈ 2026-05-24):**
- Coach feedback: "UI is intuitive, Lab Mode is powerful"
- Real-time scoring responsive (<300ms updates)
- No performance regressions

**After Phase 2 (≈ 2026-06-07):**
- Alerts accurate + actionable
- Coach feedback: "Program intelligence caught issues we missed"

**After Phase 3 (≈ 2026-06-21):**
- Client performance tracked automatically
- Coach feedback: "Auto-adjust recommendations are spot-on"

**After Phase 4 (≈ 2026-07-05):**
- Export formats working, webhooks firing
- Integration with external systems functional
