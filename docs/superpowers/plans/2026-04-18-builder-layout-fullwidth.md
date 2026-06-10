# Builder Layout Full-Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the program template builder to use full available width — template column left (~55%), intelligence panel right (~45%) with a 2-column internal grid — eliminating the large empty gutters on both sides.

**Architecture:** The page wrapper changes from `max-w-3xl mx-auto px-8` to `px-6` (full width minus sidebar padding). Inside `ProgramTemplateBuilder`, the flex layout changes so the intelligence column grows from fixed `w-[280px]` to `w-[420px]` and uses a 2-column internal grid for subscores + KPIs. The same change applies to the edit page.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS DS v2.0.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/coach/programs/templates/new/page.tsx` | Modify | Remove max-w-3xl, use full width |
| `app/coach/programs/templates/[templateId]/edit/page.tsx` | Modify | Same change for edit page |
| `components/programs/ProgramTemplateBuilder.tsx` | Modify | Widen intelligence column to 420px |
| `components/programs/ProgramIntelligencePanel.tsx` | Modify | 2-column grid for subscores + KPIs inside wider panel |

---

## Task 1: Remove max-w constraint from page wrappers

**Files:**
- Modify: `app/coach/programs/templates/new/page.tsx`
- Modify: `app/coach/programs/templates/[templateId]/edit/page.tsx`

**Context:** Both pages wrap `ProgramTemplateBuilder` in `<main className="max-w-3xl mx-auto px-8 py-6">`. Removing `max-w-3xl mx-auto` and reducing padding to `px-6` lets the builder use all available horizontal space (the sidebar itself is already `w-52` or `w-16` collapsed, handled by `CoachShell`).

- [ ] **Step 1: Update new template page**

In `app/coach/programs/templates/new/page.tsx`, find:

```tsx
<main className="max-w-3xl mx-auto px-8 py-6">
```

Replace with:

```tsx
<main className="px-6 py-6">
```

- [ ] **Step 2: Update edit template page**

Find the same pattern in `app/coach/programs/templates/[templateId]/edit/page.tsx` and apply the same change:

```tsx
<main className="px-6 py-6">
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "templates/new\|templates/\[templateId\]" | head -10
```

Expected: 0 lines.

- [ ] **Step 4: Commit**

```bash
git add "app/coach/programs/templates/new/page.tsx" "app/coach/programs/templates/[templateId]/edit/page.tsx"
git commit -m "feat(layout): remove max-w-3xl from template builder pages — full width layout"
```

---

## Task 2: Widen intelligence column in ProgramTemplateBuilder

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

**Context:** The intelligence panel wrapper is currently `w-[280px]`. Widening to `w-[420px]` gives enough room for a 2-column internal grid. The main template column uses `flex-1` so it fills remaining space automatically.

- [ ] **Step 1: Update the panel wrapper width**

Find in `ProgramTemplateBuilder.tsx` (around line 1047):

```tsx
<div className="w-[280px] shrink-0 sticky top-[96px] self-start flex flex-col gap-2 max-h-[calc(100vh-112px)] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
```

Replace with:

```tsx
<div className="w-[420px] shrink-0 sticky top-[96px] self-start flex flex-col gap-2 max-h-[calc(100vh-112px)] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ProgramTemplateBuilder" | head -10
```

Expected: 0 lines.

- [ ] **Step 3: Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(layout): intelligence panel width 280px → 420px to fill available right space"
```

---

## Task 3: 2-column internal grid in ProgramIntelligencePanel

**Files:**
- Modify: `components/programs/ProgramIntelligencePanel.tsx`

**Context:** With 420px width, the panel can fit two columns of content side by side. The layout change: subscores (currently 2-col grid) becomes 3-col grid; KPIs "Volume programme" becomes 4-col single row; the Radar + Donut charts sit side by side in a 2-col grid; "Détail par séance" and "Alertes" remain full-width below.

- [ ] **Step 1: Update the Props type — add width awareness**

No prop change needed. The component adapts via the wider container.

- [ ] **Step 2: Update subscores grid from 2-col to 3-col**

Find:

```tsx
<div className="grid grid-cols-2 gap-1.5">
  {Object.entries(result.subscores).map(([key, val]) => (
```

Replace with:

```tsx
<div className="grid grid-cols-3 gap-1.5">
  {Object.entries(result.subscores).map(([key, val]) => (
```

- [ ] **Step 3: Update KPIs grid from 2×2 to 1×4**

Find the "Volume programme" section:

```tsx
<div className="grid grid-cols-2 gap-1.5">
  <div className="bg-white/[0.02] rounded-xl p-2">
    <p className="text-[16px] font-black text-white leading-none">{result.programStats.totalSets}</p>
    <p className="text-[8px] text-white/40 mt-0.5">séries / sem.</p>
  </div>
  <div className="bg-white/[0.02] rounded-xl p-2">
    ...reps...
  </div>
  <div className="bg-white/[0.02] rounded-xl p-2">
    ...exercices uniques...
  </div>
  <div className="bg-white/[0.02] rounded-xl p-2">
    ...exos/séance...
  </div>
</div>
```

Replace with a 4-column single row:

```tsx
<div className="grid grid-cols-4 gap-1.5">
  <div className="bg-white/[0.02] rounded-xl p-2">
    <p className="text-[15px] font-black text-white leading-none">{result.programStats.totalSets}</p>
    <p className="text-[8px] text-white/40 mt-0.5">séries / sem.</p>
  </div>
  <div className="bg-white/[0.02] rounded-xl p-2">
    <p className="text-[15px] font-black text-white leading-none">
      {result.programStats.totalEstimatedReps >= 1000
        ? `${(result.programStats.totalEstimatedReps / 1000).toFixed(1)}k`
        : result.programStats.totalEstimatedReps}
    </p>
    <p className="text-[8px] text-white/40 mt-0.5">reps est.</p>
  </div>
  <div className="bg-white/[0.02] rounded-xl p-2">
    <p className="text-[15px] font-black text-white leading-none">{result.programStats.totalExercises}</p>
    <p className="text-[8px] text-white/40 mt-0.5">exercices</p>
  </div>
  <div className="bg-white/[0.02] rounded-xl p-2">
    <p className="text-[15px] font-black text-white leading-none">{result.programStats.avgExercisesPerSession}</p>
    <p className="text-[8px] text-white/40 mt-0.5">exos/séance</p>
  </div>
</div>
```

- [ ] **Step 4: Place Radar + Donut side by side**

Find the two chart sections (Radar and Donut). Wrap them in a 2-column grid:

```tsx
{/* Radar + Donut côte à côte */}
{(mounted && Object.keys(result.distribution).length > 0) || (mounted && donutData.length > 0) ? (
  <div className="grid grid-cols-2 gap-2">
    {/* Radar musculaire */}
    {mounted && Object.keys(result.distribution).length > 0 && (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">Distribution</p>
        <div style={{ width: '100%', height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="muscle" tick={{ fontSize: 7, fill: 'rgba(255,255,255,0.4)' }} />
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

    {/* Donut patterns */}
    {mounted && donutData.length > 0 && (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">Patterns</p>
        <div style={{ width: '100%', height: 100 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={24}
                outerRadius={40}
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
        <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1">
          {donutData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-[8px] text-white/40">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
) : null}
```

Remove the old standalone Radar and Donut sections (they are now inside the grid above).

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ProgramIntelligencePanel" | head -10
```

Expected: 0 lines.

- [ ] **Step 6: Commit**

```bash
git add components/programs/ProgramIntelligencePanel.tsx
git commit -m "feat(layout): intelligence panel 2-col grid — 3-col subscores, 4-col KPIs, radar+donut side by side"
```

---

## Task 4: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG**

Add at top under `## 2026-04-18`:

```
FEATURE: Template builder pages — remove max-w-3xl, full width layout (px-6)
FEATURE: Intelligence panel width 280px → 420px — uses full right column
FEATURE: ProgramIntelligencePanel — 3-col subscores, 4-col KPIs row, radar+donut side by side
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for builder layout full-width"
```
