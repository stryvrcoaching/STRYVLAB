# Tempo Preset Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text tempo input in ExerciseCard with a select of documented presets + conditional manual input, with the ECC–PB–CON–PH convention in the label.

**Architecture:** Single file change — `components/programs/studio/ExerciseCard.tsx`. Inline `TEMPO_PRESETS` constant + `TempoSelector` logic (no new file). `parseTempo` from `lib/training/tempo.ts` reused for manual validation.

**Tech Stack:** React, TypeScript strict, Tailwind, existing `parseTempo` + `ExerciseData` types.

---

## File Map

| File | Action |
|------|--------|
| `components/programs/studio/ExerciseCard.tsx` | Modify — replace lines 382–395 (tempo block) |

---

## Task 1: Replace tempo input with preset selector

**Files:**
- Modify: `components/programs/studio/ExerciseCard.tsx`

- [ ] **Step 1: Add `parseTempo` import**

At the top of `components/programs/studio/ExerciseCard.tsx`, find the existing imports. Add `parseTempo` to the tempo import (or add a new import line if not yet imported):

```typescript
import { parseTempo } from '@/lib/training/tempo'
```

Check if `lib/training/tempo` is already imported — if so, add `parseTempo` to the existing import destructuring. If not, add the line after the last import.

- [ ] **Step 2: Add TEMPO_PRESETS constant**

After the existing constants in the file (after `SUPERSET_COLORS`, before the component function), add:

```typescript
const TEMPO_PRESETS = [
  {
    label: 'Hypertrophie standard',
    value: '3-1-2-0',
    note: 'ECC lent (3s) → étirement (1s) → CON contrôlé (2s) → pas de pause haut',
  },
  {
    label: 'Hypertrophie excentrique',
    value: '4-0-2-0',
    note: 'ECC très lent (4s) → CON rapide (2s) — tension excentrique maximale',
  },
  {
    label: 'Force / Puissance',
    value: '2-0-X-0',
    note: 'ECC contrôlé (2s) → CON explosif (X) — recrutement neuromusculaire max',
  },
  {
    label: 'Endurance / Cardio',
    value: '2-0-2-0',
    note: 'Tempo modéré, soutenable sur hautes répétitions',
  },
  {
    label: 'Explosif pur',
    value: 'X-0-X-0',
    note: 'Toutes phases aussi vite que possible — puissance athlétique',
  },
  {
    label: 'Manuel',
    value: '__manual__',
    note: '',
  },
] as const

function detectPreset(tempo: string | null): string {
  if (!tempo) return '3-1-2-0'
  const match = TEMPO_PRESETS.find(p => p.value === tempo && p.value !== '__manual__')
  return match ? match.value : '__manual__'
}
```

- [ ] **Step 3: Add local state for tempo selector in ExerciseCard**

The ExerciseCard component is a function component. It needs local state for:
1. The selected preset value (derived from `exercise.tempo` on mount / when `exercise.tempo` changes)
2. The manual input string (used only when preset is `__manual__`)
3. Manual input validity

Find where the component destructures its props and has its local state (around the `useSortable` call). Add after the existing `const isInSuperset = ...` line:

```typescript
const [selectedPreset, setSelectedPreset] = useState<string>(() => detectPreset(exercise.tempo))
const [manualValue, setManualValue]         = useState<string>(exercise.tempo ?? '')
const [manualError, setManualError]         = useState(false)

// Sync if exercise.tempo changes from outside (e.g. initial load)
useEffect(() => {
  setSelectedPreset(detectPreset(exercise.tempo))
  if (exercise.tempo && !TEMPO_PRESETS.find(p => p.value === exercise.tempo)) {
    setManualValue(exercise.tempo)
  }
}, [exercise.tempo])
```

This requires `useState` and `useEffect` to be imported. Check the existing React import at the top of the file — add them if not already present.

- [ ] **Step 4: Replace the tempo block in the JSX**

Find and replace the entire `{/* Tempo d'exécution */}` block (lines 382–395):

```tsx
{/* Tempo d'exécution */}
{(() => {
  const activePreset = TEMPO_PRESETS.find(p => p.value === selectedPreset)
  return (
    <div>
      <label className="block text-[9px] text-white/30 mb-0.5">
        Tempo (ECC – PB – CON – PH)
      </label>
      <select
        value={selectedPreset}
        onChange={e => {
          const v = e.target.value
          setSelectedPreset(v)
          setManualError(false)
          if (v !== '__manual__') {
            onUpdate({ tempo: v })
          }
        }}
        className="w-full bg-[#0a0a0a] rounded-md border-[0.3px] border-white/[0.06] text-[11px] text-white/80 px-1.5 py-1 outline-none appearance-none cursor-pointer"
      >
        {TEMPO_PRESETS.map(p => (
          <option key={p.value} value={p.value} className="bg-[#0a0a0a]">
            {p.value === '__manual__' ? 'Manuel...' : `${p.label}  ·  ${p.value}`}
          </option>
        ))}
      </select>
      {activePreset && activePreset.note && (
        <p className="text-[9px] text-white/25 leading-relaxed mt-0.5">
          {activePreset.note}
        </p>
      )}
      {selectedPreset === '__manual__' && (
        <div className="mt-1">
          <input
            type="text"
            value={manualValue}
            onChange={e => {
              setManualValue(e.target.value)
              setManualError(false)
            }}
            onBlur={() => {
              const v = manualValue.trim().toUpperCase()
              if (!v) {
                onUpdate({ tempo: null })
                setManualError(false)
                return
              }
              if (parseTempo(v) !== null) {
                onUpdate({ tempo: v })
                setManualValue(v)
                setManualError(false)
              } else {
                setManualError(true)
              }
            }}
            placeholder="ex: 3-1-2-0"
            className={`w-full bg-[#0a0a0a] rounded-md border-[0.3px] text-[11px] text-white/80 placeholder:text-white/20 px-1.5 py-1 outline-none font-mono ${
              manualError
                ? 'border-red-500/40'
                : 'border-white/[0.06]'
            }`}
          />
          {manualError && (
            <p className="text-[9px] text-red-400/60 mt-0.5">
              Format attendu : 3-1-2-0  (chiffre ou X par phase)
            </p>
          )}
        </div>
      )}
    </div>
  )
})()}
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "ExerciseCard"
```

Expected: no output (no errors in ExerciseCard).

- [ ] **Step 6: Run all tests**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 7: Update CHANGELOG**

In `CHANGELOG.md`, under `## 2026-05-16`, add at the top:

```
FEATURE: Tempo preset selector — dropdown coach avec 5 presets documentés (Hypertrophie/Force/Endurance/Explosif/Manuel) + convention ECC–PB–CON–PH dans le label + validation Manuel via parseTempo
```

- [ ] **Step 8: Commit**

```bash
git add components/programs/studio/ExerciseCard.tsx CHANGELOG.md
git commit -m "feat(tempo): preset selector in ExerciseCard — 5 presets documented, convention ECC–PB–CON–PH, manual validation"
```

---

## Self-Review

### Spec coverage

| Requirement | Step |
|-------------|------|
| Select avec presets documentés | Step 4 (`<select>` + `TEMPO_PRESETS`) |
| Convention ECC–PB–CON–PH dans le label | Step 4 (label text) |
| Note dynamique sous le select | Step 4 (`activePreset.note`) |
| Option Manuel → input texte libre | Step 4 (conditional input) |
| Validation Manuel via `parseTempo` au blur | Step 4 (`onBlur` handler) |
| Feedback visuel invalide (border rouge + message) | Step 4 (`manualError` state) |
| Détection preset au chargement | Step 2 (`detectPreset`) + Step 3 (`useState(() => detectPreset(...))`) |
| `__manual__` jamais persisté en DB | Step 4 (guard: `if (v !== '__manual__')`) |
| `exercise.tempo === null` → select sur hypertrophie standard | Step 2 (`detectPreset` returns `'3-1-2-0'` for null) |
| Sync si `exercise.tempo` change depuis l'extérieur | Step 3 (`useEffect`) |

### Placeholder scan

None.

### Type consistency

- `selectedPreset: string` — `detectPreset` returns `string` ✓
- `manualValue: string` — initialized from `exercise.tempo ?? ''` ✓
- `onUpdate({ tempo: v })` — `v` is `string`, matches `ExerciseData.tempo: string | null` ✓
- `onUpdate({ tempo: null })` — matches nullable type ✓
- `parseTempo` returns `ParsedTempo | null` — null check used correctly ✓
- `TEMPO_PRESETS` is `as const` — `.find()` returns `typeof TEMPO_PRESETS[number] | undefined` — `activePreset?.note` handles undefined ✓
