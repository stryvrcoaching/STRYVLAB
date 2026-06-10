# Visual Bugs Fix — Intelligence Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 visual bugs in ProgramIntelligencePanel: invisible PieChart donut, panel content overflow/scroll, incorrect muscle bar percentages per session, and tiny unreadable pattern pill labels.

**Architecture:** All fixes are pure frontend — no DB, no API changes. The PieChart issue is a Recharts SSR/hydration bug requiring a `useEffect`-gated render. The panel overflow requires `overflow-y-auto max-h` on the wrapper. The % bars need recalculation relative to total session volume (not just top-3 muscles). Pattern pills need larger font.

**Tech Stack:** Next.js App Router, TypeScript strict, Recharts, Tailwind CSS DS v2.0.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `components/programs/ProgramIntelligencePanel.tsx` | Modify | Fix donut render, panel scroll, bar %, pill labels |

---

## Task 1: Fix PieChart donut — SSR hydration guard

**Files:**
- Modify: `components/programs/ProgramIntelligencePanel.tsx`

**Context:** Recharts `ResponsiveContainer` fails to calculate dimensions during SSR and on first client render in some flex contexts. The fix: gate the PieChart render behind a `useEffect`-driven `mounted` state so it only renders after the DOM has laid out. This is the canonical Recharts fix for "invisible chart in flex column".

- [ ] **Step 1: Add mounted state**

In `ProgramIntelligencePanel.tsx`, add `useEffect` to the import and a `mounted` state:

```typescript
import { useState, useEffect } from 'react'
```

Add near the top of the component function body (after existing useState declarations):

```typescript
const [mounted, setMounted] = useState(false)
useEffect(() => { setMounted(true) }, [])
```

- [ ] **Step 2: Gate both charts behind mounted**

Find the Radar chart section (starts with `{Object.keys(result.distribution).length > 0 && (`). Change the condition:

```tsx
{mounted && Object.keys(result.distribution).length > 0 && (
  <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">Distribution musculaire</p>
    <div style={{ width: '100%', height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis dataKey="muscle" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.4)' }} />
          <Radar
            name="Volume"
            dataKey="volume"
            stroke="#1f8a65"
            fill="#1f8a65"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  </div>
)}
```

Find the PieChart section (starts with `{donutData.length > 0 && (`). Change the condition:

```tsx
{mounted && donutData.length > 0 && (
  <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">Répartition patterns</p>
    <div style={{ width: '100%', height: 100 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={donutData}
            cx="50%"
            cy="50%"
            innerRadius={28}
            outerRadius={44}
            dataKey="value"
            strokeWidth={0}
          >
            {donutData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#0f0f0f', border: 'none', borderRadius: 8, fontSize: 10 }}
            itemStyle={{ color: 'rgba(255,255,255,0.7)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {donutData.map((d, i) => (
        <div key={d.name} className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
          <span className="text-[9px] text-white/40">{d.name}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ProgramIntelligencePanel" | head -10
```

Expected: 0 lines.

- [ ] **Step 4: Commit**

```bash
git add components/programs/ProgramIntelligencePanel.tsx
git commit -m "fix(ui): gate Recharts charts behind mounted state — fixes invisible PieChart/RadarChart"
```

---

## Task 2: Fix panel overflow — scrollable inner content

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

**Context:** The wrapper div for the intelligence panel in `ProgramTemplateBuilder` is `sticky top-[96px] self-start`. When the panel content is taller than the available viewport height, it overflows below the fold with no scroll. Fix: add `max-h-[calc(100vh-112px)] overflow-y-auto` on the wrapper. 112px = 96px topbar + 16px bottom breathing room.

- [ ] **Step 1: Update the panel wrapper**

Find in `ProgramTemplateBuilder.tsx` (around line 1047):

```tsx
<div className="w-[280px] shrink-0 sticky top-[96px] self-start flex flex-col gap-2">
```

Replace with:

```tsx
<div className="w-[280px] shrink-0 sticky top-[96px] self-start flex flex-col gap-2 max-h-[calc(100vh-112px)] overflow-y-auto scrollbar-none">
```

- [ ] **Step 2: Add scrollbar-none utility to Tailwind config if not already present**

Check `tailwind.config.ts` — if `scrollbar-none` is not configured, add the CSS directly via a className alternative. Replace `scrollbar-none` with a style prop instead:

```tsx
<div
  className="w-[280px] shrink-0 sticky top-[96px] self-start flex flex-col gap-2 max-h-[calc(100vh-112px)] overflow-y-auto"
  style={{ scrollbarWidth: 'none' }}
>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ProgramTemplateBuilder" | head -10
```

Expected: 0 lines.

- [ ] **Step 4: Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "fix(ui): intelligence panel wrapper scrollable with max-h — content no longer overflows viewport"
```

---

## Task 3: Fix muscle bar % — relative to total session volume

**Files:**
- Modify: `components/programs/ProgramIntelligencePanel.tsx`

**Context:** Currently the bars compute `pct = vol / totalSessionVol` where `totalSessionVol` is the sum of only the top-3 muscles' volume. This makes the bars always sum to ~100% among themselves and makes them misleading. The correct approach: show each muscle's % of **all muscles in that session** (from `result.distribution` filtered to muscles present in the session).

Each `SessionStats` has `topMuscles: string[]`. The session's full muscle distribution is in `result.distribution` (global). We need to compute total volume per session. Since `result.distribution` is global (aggregated across all sessions), we can't directly split it per session. 

The correct fix: pass session-level distribution from `programStats.sessionsStats`. We need to add `muscleVolumes: Record<string, number>` to `SessionStats` in types and compute it in `buildIntelligenceResult`.

- [ ] **Step 1: Add muscleVolumes to SessionStats type**

In `lib/programs/intelligence/types.ts`, update `SessionStats`:

```typescript
export interface SessionStats {
  name: string
  exerciseCount: number
  totalSets: number
  estimatedReps: number
  patterns: string[]
  topMuscles: string[]
  muscleVolumes: Record<string, number>  // ← add this: slug FR → weighted volume in THIS session
}
```

- [ ] **Step 2: Populate muscleVolumes in buildIntelligenceResult**

In `lib/programs/intelligence/scoring.ts`, in the `sessionsStats` map (inside `buildIntelligenceResult`), update the `musVol` computation:

```typescript
const sessionsStats: SessionStats[] = filteredSessions.map(session => {
  const exs = session.exercises
  const totalSets = exs.reduce((acc, e) => acc + e.sets, 0)
  const estimatedReps = exs.reduce((acc, e) => acc + e.sets * parseRepsLow(e.reps), 0)
  const patterns = Array.from(new Set(exs.map(e => e.movement_pattern).filter((p): p is string => !!p)))

  const muscleVolumes: Record<string, number> = {}
  for (const ex of exs) {
    const vol = weightedVolume(ex)
    ex.primary_muscles.forEach(m => {
      const norm = normalizeMuscleSlug(m)
      muscleVolumes[norm] = (muscleVolumes[norm] ?? 0) + vol
    })
  }

  const topMuscles = Object.entries(muscleVolumes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([m]) => m)

  return {
    name: session.name,
    exerciseCount: exs.length,
    totalSets,
    estimatedReps,
    patterns,
    topMuscles,
    muscleVolumes,
  }
})
```

- [ ] **Step 3: Fix bar % calculation in ProgramIntelligencePanel**

Find the "Stats par séance" section in `ProgramIntelligencePanel.tsx`. Replace the bar calculation:

```tsx
{result.programStats.sessionsStats.map((s, i) => {
  const sessionTotalVol = Object.values(s.muscleVolumes).reduce((a, b) => a + b, 0)

  return (
    <div key={i} className="border-t border-white/[0.04] pt-2.5 first:border-0 first:pt-0">
      {/* En-tête séance */}
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold text-white/70 truncate max-w-[140px]">
          {s.name || `Séance ${i + 1}`}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] text-white/40 font-mono">{s.totalSets} s.</span>
          <span className="text-[9px] text-white/25">·</span>
          <span className="text-[9px] text-white/40 font-mono">{s.exerciseCount} ex.</span>
        </div>
      </div>

      {/* Barres muscles top 3 */}
      {s.topMuscles.length > 0 && (
        <div className="flex flex-col gap-1 mb-1.5">
          {s.topMuscles.map(muscle => {
            const vol = s.muscleVolumes[muscle] ?? 0
            const pct = sessionTotalVol > 0 ? Math.round((vol / sessionTotalVol) * 100) : 0
            return (
              <div key={muscle} className="flex items-center gap-1.5">
                <span className="text-[9px] text-white/35 w-[56px] shrink-0 truncate">
                  {MUSCLE_LABEL_FR[muscle] ?? muscle}
                </span>
                <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1f8a65]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[9px] text-white/25 font-mono w-7 text-right">{pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Patterns présents */}
      {s.patterns.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {s.patterns.slice(0, 4).map(p => (
            <span
              key={p}
              className="text-[9px] font-medium text-white/35 bg-white/[0.04] px-1.5 py-0.5 rounded"
            >
              {PATTERN_LABEL_FR[p] ?? p}
            </span>
          ))}
          {s.patterns.length > 4 && (
            <span className="text-[9px] text-white/20">+{s.patterns.length - 4}</span>
          )}
        </div>
      )}
    </div>
  )
})}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ProgramIntelligencePanel\|scoring\.ts\|types\.ts" | head -10
```

Expected: 0 lines.

- [ ] **Step 5: Commit**

```bash
git add components/programs/ProgramIntelligencePanel.tsx lib/programs/intelligence/types.ts lib/programs/intelligence/scoring.ts
git commit -m "fix(ui): muscle bar % now relative to total session volume — muscleVolumes added to SessionStats"
```

---

## Task 4: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG**

Add at top under `## 2026-04-18`:

```
FIX: ProgramIntelligencePanel — gate Recharts charts behind mounted state, fixes invisible PieChart/RadarChart
FIX: ProgramIntelligencePanel wrapper — max-h + overflow-y-auto, panel content no longer cut off below viewport
FIX: SessionStats.muscleVolumes — per-session muscle volume map, fixes incorrect bar % in Détail par séance
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for visual bugs fix"
```
