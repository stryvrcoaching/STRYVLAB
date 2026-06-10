# MorphoPro Bridge — Backend Design Specification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backend bridge to analyze client morphology via OpenAI Vision API, store versioned analyses, and inform exercise stimulus coefficients in the programme scoring engine.

**Architecture:** Async job queue (lightweight, non-blocking). Coach triggers analysis → job runs in background → results inform real-time scoring in Phase 1 UI.

**Tech Stack:** Next.js (API routes), Prisma, Supabase (PostgreSQL), OpenAI Vision API, async queue (Supabase cron or Bull).

---

## 1. Data Model

### Table: `morpho_analyses`

```sql
CREATE TABLE morpho_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  assessment_submission_id UUID REFERENCES assessment_submissions(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  analysis_date DATE NOT NULL, -- date when photos/measurements were taken
  
  -- Raw & Extracted Data
  raw_payload JSONB, -- entire OpenAI Vision response (for audit + future parsing)
  body_composition JSONB, -- { body_fat_pct: number, muscle_mass_kg: number, visceral_fat_level: number, bone_mass_kg: number, body_water_pct: number }
  dimensions JSONB, -- { waist_cm: number, hips_cm: number, chest_cm: number, arm_cm_l: number, arm_cm_r: number, leg_cm_l: number, leg_cm_r: number, thigh_cm_l: number, thigh_cm_r: number, calf_cm_l: number, calf_cm_r: number }
  asymmetries JSONB, -- { arm_diff_cm: number, leg_diff_cm: number, shoulder_imbalance_cm: number, hip_imbalance_cm: number, posture_notes: string }
  
  -- Derived: Stimulus Coefficients (morpho-informed)
  stimulus_adjustments JSONB, -- Record<pattern_slug, adjustment_factor> e.g., { "horizontal_push": 0.92, "vertical_pull": 1.08, "squat": 1.0 }
  
  -- Job Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  job_id TEXT, -- reference to async job (for retries, status checks)
  error_message TEXT, -- populated if status='failed'
  
  -- Audit
  analyzed_by UUID REFERENCES auth.users(id), -- coach who triggered analysis
  
  CONSTRAINT unique_submission_analysis UNIQUE(assessment_submission_id, analysis_date)
);

CREATE INDEX morpho_analyses_client_date ON morpho_analyses(client_id, analysis_date DESC);
CREATE INDEX morpho_analyses_client_latest ON morpho_analyses(client_id) WHERE status = 'completed';
```

### RLS Policies

```sql
-- Coach can read/write morpho analyses for their own clients
CREATE POLICY "coach_read_own_client_morpho" ON morpho_analyses
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "coach_create_own_client_morpho" ON morpho_analyses
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

-- Client can read their own morpho analyses
CREATE POLICY "client_read_own_morpho" ON morpho_analyses
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );
```

---

## 2. API Routes

### POST `/api/clients/[clientId]/morpho/analyze`

**Purpose:** Coach triggers morpho analysis for a client.

**Request:**
```typescript
{
  submission_id?: UUID // optional, defaults to latest submitted assessment
}
```

**Response (success):**
```typescript
{
  job_id: string,
  status: 'queued',
  morpho_analysis_id: UUID,
  eta_seconds: 30
}
```

**Response (error):**
```typescript
{
  error: string // "Client not found", "No photos in submission", "Unauthorized", etc.
}
```

**Handler Logic:**
1. Authenticate coach + verify ownership of client
2. Fetch `assessment_submission` (latest or specified)
3. Verify submission status = 'completed'
4. Verify submission has ≥1 photo response (type='photo')
5. Create `morpho_analyses` record with status='pending'
6. Queue async job: `analyzeMorphoJob(morpho_analysis_id)`
7. Return `{ job_id, status, morpho_analysis_id, eta_seconds: 30 }`

**Error Cases:**
- 404: Client not found
- 403: Coach doesn't own client
- 422: Submission not found / incomplete / no photos
- 429: Rate limit (max 1 analysis per client per day, or similar)

---

### GET `/api/clients/[clientId]/morpho/latest`

**Purpose:** Fetch latest completed morpho analysis (used by scoring engine).

**Response (success):**
```typescript
{
  id: UUID,
  client_id: UUID,
  analysis_date: Date,
  status: 'completed',
  body_composition: {...},
  dimensions: {...},
  asymmetries: {...},
  stimulus_adjustments: {...}
}
```

**Response (no analysis):**
```typescript
{
  id: null, // or 404 — TBD based on API pattern
  status: 'not_analyzed'
}
```

**Handler Logic:**
1. Verify auth (coach owns client OR client is auth user)
2. `SELECT * FROM morpho_analyses WHERE client_id = ? AND status = 'completed' ORDER BY analysis_date DESC LIMIT 1`
3. Return record (no raw_payload — exclude for size)

---

### GET `/api/clients/[clientId]/morpho/analyses`

**Purpose:** Fetch all morpho analyses (timeline view for coach).

**Query Params:**
- `limit?: number` (default 10)
- `offset?: number` (default 0)

**Response:**
```typescript
{
  analyses: [
    {
      id: UUID,
      analysis_date: Date,
      status: 'completed' | 'failed',
      body_composition: {...},
      asymmetries: {...},
      error_message?: string
    },
    ...
  ],
  total_count: number
}
```

**Handler Logic:**
1. Verify coach owns client
2. `SELECT id, analysis_date, status, body_composition, asymmetries, error_message FROM morpho_analyses WHERE client_id = ? ORDER BY analysis_date DESC LIMIT ? OFFSET ?`
3. Return paginated results

---

### POST `/api/clients/[clientId]/morpho/job-status`

**Purpose:** Poll async job status (coach checks if analysis done).

**Request:**
```typescript
{
  job_id: string
}
```

**Response:**
```typescript
{
  status: 'pending' | 'completed' | 'failed',
  morpho_analysis_id?: UUID,
  error_message?: string,
  result?: { body_composition, dimensions, asymmetries, stimulus_adjustments }
}
```

**Handler Logic:**
1. Query job queue / job status table
2. Return current status
3. If completed, also return morpho_analysis result

---

## 3. Async Job: `analyzeMorphoJob`

**Trigger:** Queued by `POST /api/clients/[clientId]/morpho/analyze`

**Execution:**
```typescript
async function analyzeMorphoJob(morpho_analysis_id: UUID) {
  try {
    // 1. Fetch morpho record + submission + responses
    const analysis = await prisma.morphoAnalysis.findUnique({
      where: { id: morpho_analysis_id },
      include: {
        client: true,
        assessmentSubmission: { include: { responses: true } }
      }
    });

    // 2. Extract photo URLs from responses (type='photo')
    const photoResponses = analysis.assessmentSubmission.responses.filter(
      r => r.field_type === 'photo'
    );
    const photoUrls = photoResponses.map(r => r.value_text); // signed Supabase URLs

    // 3. Call OpenAI Vision API (parallel)
    const visionResults = await Promise.all(
      photoUrls.map(url => analyzePhotoWithOpenAI(url))
    );

    // 4. Parse vision responses
    const extracted = parseMorphoResponses(visionResults);

    // 5. Fetch client's latest biometrics (from assessment_submissions)
    const biometrics = await getLatestClientBiometrics(analysis.client_id);

    // 6. Merge extracted + biometrics
    const metrics = mergeMorphoData(extracted, biometrics);

    // 7. Calculate stimulus adjustments
    const adjustments = calculateStimulusAdjustments(metrics, analysis.client);

    // 8. Update morpho_analysis with results
    await prisma.morphoAnalysis.update({
      where: { id: morpho_analysis_id },
      data: {
        body_composition: metrics.body_composition,
        dimensions: metrics.dimensions,
        asymmetries: metrics.asymmetries,
        stimulus_adjustments: adjustments,
        raw_payload: visionResults,
        status: 'completed',
        updated_at: new Date()
      }
    });

  } catch (error) {
    // Update with error
    await prisma.morphoAnalysis.update({
      where: { id: morpho_analysis_id },
      data: {
        status: 'failed',
        error_message: error.message,
        updated_at: new Date()
      }
    });
    
    // Optionally: implement retry logic (3 retries, exponential backoff)
  }
}
```

---

## 4. Helper Functions

### `analyzePhotoWithOpenAI(photoUrl: string): Promise<string>`

Calls OpenAI Vision API to analyze a single photo.

**Prompt:** (TBD — should be detailed, asking for body composition, posture, asymmetries)

**Returns:** Raw text response from OpenAI (e.g., "Client appears to be 18% body fat, left shoulder higher than right by ~2cm, ...")

---

### `parseMorphoResponses(visionResults: string[]): MorphoExtracted`

Parses OpenAI Vision responses into structured metrics.

**Input:** Array of vision response texts (one per photo)

**Output:**
```typescript
{
  body_fat_pct: number,
  estimated_muscle_mass_kg: number, // derived from client weight
  visceral_fat_level: number, // 1-10 scale if detectable
  
  dimensions: {
    waist_cm?: number,
    hips_cm?: number,
    chest_cm?: number,
    arm_cm_l?: number,
    arm_cm_r?: number,
    leg_cm_l?: number,
    leg_cm_r?: number,
    // etc.
  },
  
  asymmetries: {
    arm_diff_cm?: number, // |R - L|
    leg_diff_cm?: number,
    shoulder_imbalance_cm?: number, // higher side
    hip_imbalance_cm?: number,
    posture_notes?: string
  }
}
```

**Logic:** Use regex/NLP to extract numbers from vision text. Conservative defaults if ambiguous.

---

### `calculateStimulusAdjustments(metrics: MorphoExtracted, client: Coach_Client): Record<string, number>`

Derives morpho-informed stimulus coefficients.

**Example Logic:**
```typescript
const adjustments: Record<string, number> = {};

// Base adjustment: 1.0 (no change)

// Arm asymmetry (>2cm) → unilateral patterns more valuable
if (metrics.asymmetries.arm_diff_cm && metrics.asymmetries.arm_diff_cm > 2) {
  adjustments['unilateral_push'] = 1.15; // +15%
  adjustments['unilateral_pull'] = 1.15;
}

// Shoulder imbalance → horizontal patterns adjusted
if (metrics.asymmetries.shoulder_imbalance_cm) {
  const imbalance = metrics.asymmetries.shoulder_imbalance_cm;
  if (imbalance > 2) {
    adjustments['horizontal_push'] = 0.90; // slightly less effective
    adjustments['horizontal_pull'] = 1.10; // slightly more effective (balancing)
  }
}

// Long limbs (arm/leg length) → pull patterns more effective
if (metrics.dimensions.arm_cm_l && metrics.dimensions.arm_cm_l > 80) {
  adjustments['vertical_pull'] = 1.12;
}

// Short limbs → push patterns more effective
if (metrics.dimensions.arm_cm_l && metrics.dimensions.arm_cm_l < 70) {
  adjustments['horizontal_push'] = 1.10;
}

// Default all patterns to 1.0 if not adjusted
for (const pattern of MOVEMENT_PATTERNS) {
  if (!adjustments[pattern.slug]) {
    adjustments[pattern.slug] = 1.0;
  }
}

return adjustments; // Range: 0.80–1.20 per pattern
```

---

## 5. Integration with Scoring Engine

### Modified `buildIntelligenceResult()`

```typescript
export async function buildIntelligenceResult(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
  clientId?: UUID, // NEW
  morphoAnalysisId?: UUID // NEW (lab mode override)
): Promise<IntelligenceResult> {
  // 1. Fetch morpho data if provided
  let morphoData = null;
  if (clientId) {
    morphoData = morphoAnalysisId
      ? await prisma.morphoAnalysis.findUnique({ where: { id: morphoAnalysisId } })
      : await prisma.morphoAnalysis.findFirst({
          where: { client_id: clientId, status: 'completed' },
          orderBy: { analysis_date: 'desc' }
        });
  }

  const stimulusAdjustments = morphoData?.stimulus_adjustments || {};

  // 2. Run scoring subscores (pass adjustments)
  const scores = {
    sra: scoreSRA(sessions, meta, profile),
    balance: scoreBalance(sessions, meta, profile),
    specificity: scoreSpecificity(sessions, meta, profile, stimulusAdjustments), // NEW
    progression: scoreProgression(sessions, meta, profile),
    redundancy: scoreRedundancy(sessions, meta, profile, stimulusAdjustments), // NEW
    completeness: scoreCompleteness(sessions, meta, profile)
  };

  // 3. Build result with morpho metadata
  const result = buildResult(scores, sessions);
  result.morphoData = morphoData; // attach for UI display
  return result;
}
```

### Modified `scoreSpecificity()`

```typescript
function scoreSpecificity(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
  stimulusAdjustments?: Record<string, number>
): number {
  let totalScore = 0;
  let exerciseCount = 0;

  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const baseCoeff = getStimulusCoeff(exercise.slug, exercise.pattern, exercise.is_compound);
      const morphoAdjustment = stimulusAdjustments?.[exercise.pattern] || 1.0;
      const effectiveCoeff = baseCoeff * morphoAdjustment;

      const stimulusScore = Math.min(100, effectiveCoeff * 100);
      totalScore += stimulusScore;
      exerciseCount++;
    }
  }

  return exerciseCount > 0 ? Math.round(totalScore / exerciseCount) : 0;
}
```

### Modified `scoreRedundancy()`

```typescript
function scoreRedundancy(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
  stimulusAdjustments?: Record<string, number>
): number {
  const pairs: RedundantPair[] = [];

  for (let i = 0; i < allExercises.length; i++) {
    for (let j = i + 1; j < allExercises.length; j++) {
      const ex1 = allExercises[i];
      const ex2 = allExercises[j];

      if (ex1.pattern !== ex2.pattern) continue;
      if (!musclesOverlap(ex1.muscles, ex2.muscles)) continue;

      const coeff1 = getStimulusCoeff(ex1.slug, ex1.pattern, ex1.is_compound);
      const coeff2 = getStimulusCoeff(ex2.slug, ex2.pattern, ex2.is_compound);

      // Apply morpho adjustments
      const adj1 = stimulusAdjustments?.[ex1.pattern] || 1.0;
      const adj2 = stimulusAdjustments?.[ex2.pattern] || 1.0;
      const effectiveCoeff1 = coeff1 * adj1;
      const effectiveCoeff2 = coeff2 * adj2;

      const coeffDiff = Math.abs(effectiveCoeff1 - effectiveCoeff2);

      // If morpho adjustments differ between patterns, redundancy reduces
      if (adj1 !== adj2) {
        // Exercises become less redundant (one is better for this client)
        // e.g., pull-ups vs lat-pulldown less redundant if client has arm asymmetry
        // (unilateral pull-ups get +15%, lat-pulldown stays 1.0)
        pairs.push({ exercise1: ex1.id, exercise2: ex2.id, redundancyScore: coeffDiff });
      } else if (coeffDiff < 0.20) {
        pairs.push({ exercise1: ex1.id, exercise2: ex2.id, redundancyScore: 1.0 });
      }
    }
  }

  return pairs.length > 0 ? Math.max(0, 100 - pairs.length * 15) : 100;
}
```

---

## 6. Coach Workflow (UI Integration)

### Profil Tab `/coach/clients/[clientId]`

**New Section: Morpho Analysis**

```
┌─────────────────────────────────────┐
│ 📊 Morpho Analysis                  │
├─────────────────────────────────────┤
│                                     │
│ Latest Analysis: 2026-04-18         │
│ Status: ✓ Completed                 │
│                                     │
│ Body Composition:                   │
│ • Body Fat: 18%                     │
│ • Muscle Mass: 42kg                 │
│ • Visceral Fat: 8                   │
│ • Body Water: 58%                   │
│                                     │
│ Dimensions:                         │
│ • Waist: 78cm                       │
│ • Hips: 92cm                        │
│ • Chest: 98cm                       │
│ • [View full dimensions]            │
│                                     │
│ Asymmetries:                        │
│ • Arm Diff: 1.2cm (R > L)           │
│ • Leg Diff: 0.8cm                   │
│ • Shoulder Imbalance: 2.5cm         │
│                                     │
│ Stimulus Adjustments (Morpho Impact)│
│ • horizontal_push: ×0.92            │
│ • vertical_pull: ×1.08              │
│ • [etc.]                            │
│                                     │
│ [📈 View Timeline] [Analyser]       │
└─────────────────────────────────────┘
```

**Button: `[Analyser Morpho]`**
- Available only after a completed bilan submission
- Click → triggers `POST /api/clients/[clientId]/morpho/analyze`
- Status shows: "Queued (analyzing...)" with spinner
- Polls job status every 3s
- After completion (or error): display results or error message
- Allow retry if failed

---

## 7. Lab Mode Integration (Phase 1 UI)

### In Programme Builder (Editor pane)

**Lab Mode Section: Morpho Controls**

```
┌─ [LAB MODE] Morpho
│
├─ Current Morpho: Latest (2026-04-18)
│  └─ [Change Date ▼] → dropdown of all analyses
│
├─ Stimulus Adjustments Applied:
│  ├─ horizontal_push: ×0.92
│  ├─ vertical_pull: ×1.08
│  └─ [etc.]
│
├─ Affected Subscores:
│  ├─ Specificity: ↑ (pull bonus)
│  ├─ Redundancy: ↓ (asymmetry reduces redundancy)
│  └─ Overall Delta: +2 pts
│
└─ [Compare Morphos] (A/B test across dates)
```

**Behavior:**
- Select different morpho date → Intelligence Panel recalculates live
- Coach can A/B test: "Would program differ if client was different morphology?"

---

## 8. Error Handling & Reliability

**Job Failure Cases:**
- OpenAI Vision API error → store error_message, status='failed'
- No photos in submission → immediate 422 error (sync)
- Photo URL invalid → vision call fails, stored in error_message
- Timeout (>60s) → retry with exponential backoff (3 attempts)

**Retry Strategy:**
- Automatic retry on transient errors (500s, timeouts)
- Manual retry button in UI if persistent failure
- Log all errors for debugging

**Rate Limiting:**
- Max 1 analysis per client per day (prevent abuse)
- Or: max X analyses per organization per hour
- Return 429 if exceeded

---

## 9. Success Criteria (Implementation Complete)

✅ `morpho_analyses` table migrated and RLS configured
✅ All 4 API routes implemented and tested
✅ `analyzeMorphoJob()` async function works end-to-end
✅ OpenAI Vision API integration working (photo analysis)
✅ `parseMorphoResponses()` accurately extracts metrics
✅ `calculateStimulusAdjustments()` derives morpho-informed coefficients
✅ Scoring engine integrates `stimulusAdjustments` (specificity + redundancy)
✅ Coach Profil UI shows latest morpho + `[Analyser]` button
✅ Lab Mode selector works (change morpho date, recalculate scores)
✅ Job status polling works (coach sees "Queued" → "Completed")
✅ Error handling + retry logic functional
✅ Zero TypeScript errors
✅ CHANGELOG.md + project-state.md updated

---

## 10. Future Enhancements (Post-Phase 1)

- [ ] Advanced morpho timeline visualization (graphs)
- [ ] Bi-directional asymmetry correction (auto-select unilateral variants)
- [ ] Morpho-based client matching (recommend similar body types for benchmarking)
- [ ] Integration with MorphoPro actual service (if licensing/API available)
- [ ] ML model to predict performance based on morpho (Phase 3)
