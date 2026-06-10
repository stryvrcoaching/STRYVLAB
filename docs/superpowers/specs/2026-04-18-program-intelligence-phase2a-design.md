# Program Intelligence Phase 2A — Client Profile Integration

> Design spec for integrating client restrictions, equipment, and fitness profile into the Program Intelligence engine.

---

## Goal

Allow the intelligence engine to factor in client-specific data — injuries, equipment availability, fitness level, goal — when scoring a program. Coaches can declare restrictions on the client page; clients can declare their own in their profile.

---

## Data Model

### `metric_annotations` — two new columns

```sql
ALTER TABLE metric_annotations
  ADD COLUMN body_part text,         -- normalized slug: shoulder_right, knee_left, lower_back, etc.
  ADD COLUMN severity   text         -- 'avoid' | 'limit' | 'monitor'
  CHECK (severity IN ('avoid', 'limit', 'monitor'));
```

Existing `event_type: 'injury'` annotations are the target rows. The new columns are nullable — existing rows are unaffected.

**`body_part` slug vocabulary:**
`shoulder_right`, `shoulder_left`, `elbow_right`, `elbow_left`, `wrist_right`, `wrist_left`, `knee_right`, `knee_left`, `hip_right`, `hip_left`, `lower_back`, `upper_back`, `neck`, `ankle_right`, `ankle_left`

**`severity` semantics:**
- `avoid` — exercise targeting this zone is forbidden (INJURY_CONFLICT critical alert)
- `limit` — exercise targeting this zone triggers a warning (INJURY_CONFLICT warning alert)
- `monitor` — exercise targeting this zone triggers an info alert

### `coach_clients` — one new column

```sql
ALTER TABLE coach_clients
  ADD COLUMN equipment text[] DEFAULT '{}';
```

Slugs match the existing equipment vocabulary used in the alternatives engine (`ARCHETYPE_EQUIPMENT`).

### No new tables

Both restriction sources (coach-entered and client-entered) write to `metric_annotations` with `event_type: 'injury'`. The `source` is implicit from which API route wrote it (coach route vs. client route).

---

## API Routes

### `GET /api/clients/[clientId]/intelligence-profile`

Aggregates all profile data for the intelligence engine. Coach-authenticated.

**Response:**
```typescript
interface IntelligenceProfile {
  injuries: Array<{
    bodyPart: string
    severity: 'avoid' | 'limit' | 'monitor'
    label: string
    note?: string
  }>
  equipment: string[]
  fitnessLevel?: string
  goal?: string
}
```

Fetches from:
- `coach_clients` → `training_goal`, `fitness_level`, `equipment`
- `metric_annotations` WHERE `event_type = 'injury'` AND `body_part IS NOT NULL`

### `GET /api/client/restrictions`

Returns current client's injury annotations. Client-authenticated (no clientId in URL).

### `POST /api/client/restrictions`

Creates a new injury annotation for the authenticated client.

**Body:**
```typescript
{
  bodyPart: string
  severity: 'avoid' | 'limit' | 'monitor'
  label: string
  note?: string
  annotationDate?: string  // ISO date, defaults to today
}
```

### `DELETE /api/client/restrictions/[annotationId]`

Deletes a restriction owned by the authenticated client.

---

## Intelligence Engine Changes

### New type: `IntelligenceProfile`

Added to `lib/programs/intelligence/types.ts`:

```typescript
export interface InjuryRestriction {
  bodyPart: string
  severity: 'avoid' | 'limit' | 'monitor'
}

export interface IntelligenceProfile {
  injuries: InjuryRestriction[]
  equipment: string[]
  fitnessLevel?: string
  goal?: string
}
```

### `buildIntelligenceResult` signature change

```typescript
// Before
function buildIntelligenceResult(sessions: BuilderSession[], meta: TemplateMeta): IntelligenceResult

// After
function buildIntelligenceResult(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile
): IntelligenceResult
```

`profile` is optional — existing callers without a client context are unaffected.

### `useProgramIntelligence` signature change

```typescript
// After
function useProgramIntelligence(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile
): { result: IntelligenceResult; alertsFor: (si: number, ei: number) => IntelligenceAlert[] }
```

### Scoring changes

**`scoreSpecificity()` — injury penalty**

For each exercise, if any of its `primary_muscles` or `secondary_muscles` maps to an injured `body_part`:
- `avoid` → subtract 30 from specificity base score, emit `INJURY_CONFLICT` critical alert
- `limit` → subtract 15, emit `INJURY_CONFLICT` warning alert
- `monitor` → emit `INJURY_CONFLICT` info alert, no score penalty

Muscle → body_part mapping is a static lookup table in `catalog-utils.ts`:
```typescript
const MUSCLE_TO_BODY_PART: Record<string, string[]> = {
  'deltoide_anterieur': ['shoulder_right', 'shoulder_left'],
  'deltoide_lateral': ['shoulder_right', 'shoulder_left'],
  'coiffe_rotateurs': ['shoulder_right', 'shoulder_left'],
  'biceps': ['elbow_right', 'elbow_left'],
  'triceps': ['elbow_right', 'elbow_left'],
  'quadriceps': ['knee_right', 'knee_left'],
  'ischio_jambiers': ['knee_right', 'knee_left', 'hip_right', 'hip_left'],
  'fessiers': ['hip_right', 'hip_left'],
  'lombaires': ['lower_back'],
  'erecteurs_spinaux': ['lower_back', 'upper_back'],
  'trapeze': ['upper_back', 'neck'],
  // ... full map
}
```

Since restrictions often affect only one side (e.g. `shoulder_right`), the engine checks if the specific side is restricted OR if neither side is specified (restriction applies to both).

**`scoreCompleteness()` — equipment filter**

If `profile.equipment` is non-empty, required patterns are only flagged MISSING if there exists at least one catalog exercise for that pattern matching the available equipment. If no equipment-compatible exercise exists for a pattern, the pattern is silently excluded from required patterns (can't be held against the program).

**New alert codes:**
- `INJURY_CONFLICT` — exercise targets a restricted body part
- `EQUIPMENT_MISMATCH` — exercise requires equipment not in profile (warning only, not a score penalty)

### New alert: `INJURY_CONFLICT`

```typescript
{
  code: 'INJURY_CONFLICT',
  severity: 'critical' | 'warning' | 'info',  // mirrors restriction severity
  title: 'Conflit blessure',
  explanation: 'Cet exercice sollicite [zone] qui est [évitée/limitée/surveillée].',
  suggestion: 'Voir les alternatives pour cette zone musculaire.',
  sessionIndex: number,
  exerciseIndex: number,
}
```

---

## UI Components

### A. RestrictionsWidget (Coach)

**Location:** `/coach/clients/[clientId]` — onglet Profil, section distincte après les infos générales.

**File:** `components/clients/RestrictionsWidget.tsx`

**Behavior:**
- Lists existing injury annotations as cards
- Each card: body_part (human label), severity pill (Éviter/Limiter/Surveiller), optional note, date, delete button
- Inline add form (no modal): body_part dropdown, severity pills, note textarea, date input, Save/Cancel buttons
- Saves via `POST /api/clients/[clientId]/annotations` with `event_type: 'injury'`
- Deletes via `DELETE /api/clients/[clientId]/annotations/[annotationId]`

**Equipment section** (same component, separate subsection):
- Pill selector for available equipment (same slugs as ExerciseAlternativesDrawer filters)
- Saves via `PATCH /api/clients/[clientId]` updating `equipment` column

### B. ClientRestrictionsSection (Client)

**Location:** `/client/profil` — section "Mes restrictions physiques" with visual separator

**File:** `components/client/ClientRestrictionsSection.tsx`

**Behavior:**
- Same list/add/delete UX as coach widget
- Labels simplified: "Je ne peux pas faire..." maps to `severity: 'avoid'`, "J'ai des douleurs à..." maps to `severity: 'limit'`, "Je surveille..." maps to `severity: 'monitor'`
- API: `GET/POST/DELETE /api/client/restrictions`
- Fully translated (FR/EN/ES) via `clientTranslations`

### C. ProgramTemplateBuilder — profile mode

**File:** `components/programs/ProgramTemplateBuilder.tsx`

New optional prop `clientId?: string`. When present:
- Fetches `IntelligenceProfile` from `/api/clients/[clientId]/intelligence-profile` on mount
- Passes `profile` to `useProgramIntelligence`
- Shows a "Profil client appliqué" chip near the intelligence panel header

The builder remains fully functional without a `clientId` (template mode, no profile).

---

## Body Part → Muscle Mapping

Static bidirectional lookup in `catalog-utils.ts`. Covers all body parts in the vocabulary. Used by `scoreSpecificity()` to check if an exercise's muscles conflict with a restriction.

The mapping is conservative: when in doubt, include the body part. A false positive (warning on a safe exercise) is less harmful than a false negative (missing a conflict).

---

## Invariants

1. `profile` is always optional — `buildIntelligenceResult(sessions, meta)` without profile behaves identically to Phase 1
2. `INJURY_CONFLICT` alerts are per-exercise, not per-session
3. Equipment filter in `scoreCompleteness` never increases the score — it can only prevent false MISSING_PATTERN alerts
4. Client-entered restrictions have the same weight as coach-entered restrictions in the engine — source is not exposed to the scoring logic
5. Bilateral restrictions (`shoulder_right` AND `shoulder_left` both present) collapse into one alert per exercise
6. `severity: 'avoid'` is the only severity that affects the global score

---

## Out of Scope (Phase 2B+)

- Supersets detection and scoring
- Performance predictions from session history
- Automatic restriction detection from bilan text (NLP)
- Restriction expiry / healing tracking
