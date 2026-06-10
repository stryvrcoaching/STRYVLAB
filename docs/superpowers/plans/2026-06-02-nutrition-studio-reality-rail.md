# Nutrition Studio Reality Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact `Nutrition Reality` rail above the `Protocol Canvas` in `Nutrition Studio`, powered by the existing coach nutrition hub endpoint.

**Architecture:** Reuse the existing `/api/clients/[clientId]/nutrition-hub` endpoint and derive a compact studio-specific view with only `3j / 7j`, top insights, and the 3 latest days. Keep the rail fully separated from `ProtocolCanvas` so the right column remains `context first, protocol second`, without duplicating analytics logic.

**Tech Stack:** Next.js App Router, React, TypeScript, existing coach nutrition hub endpoint, Vitest

---

## File Structure

### Create

- `components/nutrition/studio/useNutritionReality.ts` — compact fetch/transform hook for the studio rail
- `components/nutrition/studio/NutritionRealityRail.tsx` — main compact rail block
- `components/nutrition/studio/NutritionRealityMiniDay.tsx` — latest day row card for the rail
- `tests/lib/nutrition/studio/useNutritionReality.test.ts` — hook transformation tests
- `tests/components/nutrition-studio-reality-rail.test.ts` — compact UI rendering tests

### Modify

- `components/nutrition/studio/NutritionStudio.tsx` — mount the rail above `ProtocolCanvas`
- `components/clients/NutritionHub.tsx` — only if shared types extraction becomes necessary
- `app/api/clients/[clientId]/nutrition-hub/route.ts` — only if the rail needs one missing compact field that does not already exist

---

### Task 1: Create The Studio Data Hook

**Files:**
- Create: `components/nutrition/studio/useNutritionReality.ts`
- Test: `tests/lib/nutrition/studio/useNutritionReality.test.ts`

- [ ] **Step 1: Write the failing hook transformation test**

```ts
import { describe, expect, it } from "vitest";
import { deriveNutritionRealityView } from "@/components/nutrition/studio/useNutritionReality";

describe("deriveNutritionRealityView", () => {
  it("keeps only top 3 insights and latest 3 days", () => {
    const result = deriveNutritionRealityView({
      summary: {
        adherenceCalories: 0.9,
        adherenceProtein: 0.8,
        adherenceCarbs: 0.7,
        adherenceFat: 0.85,
        adherenceHydration: 0.75,
        nutritionScore: 0.82,
        validDays: 7,
      },
      trend: {
        window: 7,
        points: [],
      },
      insights: [
        { id: "1", severity: "alert", title: "A", message: "a" },
        { id: "2", severity: "watch", title: "B", message: "b" },
        { id: "3", severity: "watch", title: "C", message: "c" },
        { id: "4", severity: "good", title: "D", message: "d" },
      ],
      agenda: [
        { date: "2026-05-30", status: "under", mealCount: 3, dayKind: "training", consumed: { calories: 1800, protein_g: 120, carbs_g: 150, fat_g: 60, hydration_ml: 1800 }, target: { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, hydration_ml: 3000 } },
        { date: "2026-05-31", status: "over", mealCount: 4, dayKind: "off", consumed: { calories: 2400, protein_g: 140, carbs_g: 210, fat_g: 80, hydration_ml: 2100 }, target: { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, hydration_ml: 3000 } },
        { date: "2026-06-01", status: "under", mealCount: 3, dayKind: "training", consumed: { calories: 1900, protein_g: 145, carbs_g: 170, fat_g: 55, hydration_ml: 2200 }, target: { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, hydration_ml: 3000 } },
        { date: "2026-06-02", status: "partial", mealCount: 2, dayKind: "training", consumed: { calories: 1300, protein_g: 90, carbs_g: 110, fat_g: 40, hydration_ml: 900 }, target: { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, hydration_ml: 3000 } },
      ],
      dataQuality: {
        validDays: 7,
        partialDays: 1,
        missingMealDays: 0,
        missingHydrationDays: 1,
      },
      availableWindows: [3, 7, 14, 30],
    });

    expect(result.topInsights).toHaveLength(3);
    expect(result.recentDays).toHaveLength(3);
    expect(result.availableWindows).toEqual([3, 7]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/nutrition/studio/useNutritionReality.test.ts`

Expected: FAIL with `Cannot find module '@/components/nutrition/studio/useNutritionReality'`

- [ ] **Step 3: Implement the minimal hook and transformer**

```ts
// components/nutrition/studio/useNutritionReality.ts
import { useEffect, useState } from "react";

export type NutritionRealityPayload = {
  summary: {
    adherenceCalories: number | null;
    adherenceProtein: number | null;
    adherenceCarbs: number | null;
    adherenceFat: number | null;
    adherenceHydration: number | null;
    nutritionScore: number | null;
    validDays: number;
  };
  trend: {
    window: 3 | 7 | 14 | 30;
    points: Array<unknown>;
  };
  insights: Array<{
    id: string;
    severity: "good" | "watch" | "alert";
    title: string;
    message: string;
  }>;
  agenda: Array<{
    date: string;
    dayKind: "training" | "off" | "unknown";
    status: string;
    mealCount: number;
    consumed: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      hydration_ml: number;
    };
    target: {
      calories: number | null;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
      hydration_ml: number | null;
    };
  }>;
  dataQuality: {
    validDays: number;
    partialDays: number;
    missingMealDays: number;
    missingHydrationDays: number;
  };
  availableWindows: number[];
};

export function deriveNutritionRealityView(payload: NutritionRealityPayload) {
  return {
    summary: payload.summary,
    topInsights: payload.insights.slice(0, 3),
    recentDays: payload.agenda.slice(-3).reverse(),
    availableWindows: payload.availableWindows.filter(
      (value): value is 3 | 7 => value === 3 || value === 7,
    ),
  };
}

export function useNutritionReality(clientId: string, windowDays: 3 | 7) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<NutritionRealityPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/clients/${clientId}/nutrition-hub?window=${windowDays}`,
        );
        const json = await response.json();
        if (!active) return;

        if (!response.ok) {
          setError(json?.error ?? "Erreur serveur");
          setPayload(null);
          return;
        }

        setPayload(json);
      } catch {
        if (!active) return;
        setError("Erreur réseau");
        setPayload(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [clientId, windowDays]);

  return {
    loading,
    error,
    payload,
    view: payload ? deriveNutritionRealityView(payload) : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/nutrition/studio/useNutritionReality.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/nutrition/studio/useNutritionReality.ts tests/lib/nutrition/studio/useNutritionReality.test.ts
git commit -m "feat: add nutrition studio reality data hook"
```

### Task 2: Build The Compact Reality Rail UI

**Files:**
- Create: `components/nutrition/studio/NutritionRealityMiniDay.tsx`
- Create: `components/nutrition/studio/NutritionRealityRail.tsx`
- Test: `tests/components/nutrition-studio-reality-rail.test.ts`

- [ ] **Step 1: Write the failing UI test**

```ts
// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import NutritionRealityRail from "@/components/nutrition/studio/NutritionRealityRail";

describe("NutritionRealityRail", () => {
  it("renders title, score, window toggles, and hub CTA", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(NutritionRealityRail, {
          loading: false,
          error: null,
          activeWindow: 7,
          onWindowChange: () => {},
          onOpenHub: () => {},
          view: {
            summary: {
              adherenceCalories: 0.92,
              adherenceProtein: 0.81,
              adherenceCarbs: 0.76,
              adherenceFat: 0.88,
              adherenceHydration: 0.72,
              nutritionScore: 0.83,
              validDays: 7,
            },
            topInsights: [
              { id: "1", severity: "alert", title: "Protéines insuffisantes", message: "..." },
            ],
            recentDays: [
              {
                date: "2026-06-02",
                dayKind: "training",
                status: "under",
                mealCount: 3,
                consumed: { calories: 1900, protein_g: 145, carbs_g: 170, fat_g: 55, hydration_ml: 2200 },
                target: { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, hydration_ml: 3000 },
              },
            ],
            availableWindows: [3, 7],
          },
        }),
      );
    });

    expect(container.textContent).toMatch(/nutrition reality/i);
    expect(container.textContent).toMatch(/83%/);
    expect(container.textContent).toMatch(/ouvrir le hub/i);
    expect(container.textContent).toMatch(/3j/i);
    expect(container.textContent).toMatch(/7j/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/nutrition-studio-reality-rail.test.ts`

Expected: FAIL with `Cannot find module '@/components/nutrition/studio/NutritionRealityRail'`

- [ ] **Step 3: Implement the mini day row**

```tsx
// components/nutrition/studio/NutritionRealityMiniDay.tsx
"use client";

type RealityMiniDayProps = {
  day: {
    date: string;
    status: string;
    consumed: {
      calories: number;
      protein_g: number;
      hydration_ml: number;
    };
    target: {
      calories: number | null;
      protein_g: number | null;
      hydration_ml: number | null;
    };
  };
};

export default function NutritionRealityMiniDay({ day }: RealityMiniDayProps) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-white">{day.date}</p>
        <p className="text-[9px] uppercase tracking-[0.14em] text-white/40">
          {day.status}
        </p>
      </div>
      <p className="mt-1 text-[10px] text-white/55">
        {day.consumed.calories} / {day.target.calories ?? "N/A"} kcal
      </p>
      <p className="mt-1 text-[10px] text-white/45">
        P {day.consumed.protein_g} / {day.target.protein_g ?? "N/A"} g · Eau{" "}
        {day.consumed.hydration_ml} / {day.target.hydration_ml ?? "N/A"} ml
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Implement the main rail**

```tsx
// components/nutrition/studio/NutritionRealityRail.tsx
"use client";

import NutritionRealityMiniDay from "./NutritionRealityMiniDay";

type NutritionRealityRailProps = {
  loading: boolean;
  error: string | null;
  activeWindow: 3 | 7;
  onWindowChange: (window: 3 | 7) => void;
  onOpenHub: () => void;
  view: {
    summary: {
      nutritionScore: number | null;
      validDays: number;
    };
    topInsights: Array<{
      id: string;
      severity: "good" | "watch" | "alert";
      title: string;
      message: string;
    }>;
    recentDays: Array<{
      date: string;
      status: string;
      consumed: {
        calories: number;
        protein_g: number;
        hydration_ml: number;
      };
      target: {
        calories: number | null;
        protein_g: number | null;
        hydration_ml: number | null;
      };
    }>;
    availableWindows: Array<3 | 7>;
  } | null;
};

export default function NutritionRealityRail({
  loading,
  error,
  activeWindow,
  onWindowChange,
  onOpenHub,
  view,
}: NutritionRealityRailProps) {
  return (
    <section className="border-b border-white/[0.04] px-4 pt-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            Nutrition Reality
          </p>
          <p className="mt-1 text-[11px] text-white/45">Réalité observée</p>
        </div>
        <button
          onClick={onOpenHub}
          className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60 transition-colors hover:text-white/80"
        >
          Ouvrir le hub
        </button>
      </div>

      {loading && <p className="mt-4 text-[11px] text-white/45">Chargement…</p>}
      {error && <p className="mt-4 text-[11px] text-red-300/80">{error}</p>}

      {!loading && !error && view && (
        <>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                Score global nutrition
              </p>
              <p className="mt-1 text-[30px] font-semibold text-white">
                {view.summary.nutritionScore == null
                  ? "N/A"
                  : `${Math.round(view.summary.nutritionScore * 100)}%`}
              </p>
            </div>
            <div className="flex gap-2">
              {view.availableWindows.map((windowValue) => (
                <button
                  key={windowValue}
                  onClick={() => onWindowChange(windowValue)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    activeWindow === windowValue
                      ? "bg-[#1f8a65] text-white"
                      : "bg-white/[0.04] text-white/55"
                  }`}
                >
                  {windowValue}j
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {view.topInsights.map((insight) => (
              <div key={insight.id} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
                <p className="text-[11px] font-semibold text-white">{insight.title}</p>
                <p className="mt-1 text-[10px] text-white/50">{insight.message}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {view.recentDays.map((day) => (
              <NutritionRealityMiniDay key={day.date} day={day} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/components/nutrition-studio-reality-rail.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/nutrition/studio/NutritionRealityMiniDay.tsx components/nutrition/studio/NutritionRealityRail.tsx tests/components/nutrition-studio-reality-rail.test.ts
git commit -m "feat: add nutrition studio reality rail ui"
```

### Task 3: Integrate The Rail Into Nutrition Studio

**Files:**
- Modify: `components/nutrition/studio/NutritionStudio.tsx`
- Modify: `components/nutrition/studio/NutritionRealityRail.tsx`
- Test: `tests/components/nutrition-studio-reality-rail.test.ts`

- [ ] **Step 1: Add the failing studio integration test**

```ts
// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/nutrition/studio/useNutritionReality", () => ({
  useNutritionReality: () => ({
    loading: false,
    error: null,
    payload: {},
    view: {
      summary: { nutritionScore: 0.83, validDays: 7 },
      topInsights: [{ id: "1", severity: "alert", title: "Protéines insuffisantes", message: "..." }],
      recentDays: [],
      availableWindows: [3, 7],
    },
  }),
}));
```

- [ ] **Step 2: Run test to verify it fails on missing integration**

Run: `npm test -- tests/components/nutrition-studio-reality-rail.test.ts`

Expected: FAIL until `NutritionStudio` mounts the rail

- [ ] **Step 3: Wire the rail above `ProtocolCanvas`**

```tsx
// components/nutrition/studio/NutritionStudio.tsx
import NutritionRealityRail from "./NutritionRealityRail";
import { useNutritionReality } from "./useNutritionReality";

const [realityWindow, setRealityWindow] = useState<3 | 7>(7);
const nutritionReality = useNutritionReality(clientId, realityWindow);
```

```tsx
// inside Col 3
<div
  style={{
    flexGrow: col3Width,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 240,
    overflow: "hidden",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  }}
>
  <NutritionRealityRail
    loading={nutritionReality.loading}
    error={nutritionReality.error}
    activeWindow={realityWindow}
    onWindowChange={setRealityWindow}
    onOpenHub={() => router.push(`/coach/clients/${clientId}/data/nutrition`)}
    view={nutritionReality.view}
  />
  <ProtocolCanvas
    loading={studio.clientLoading}
    protocolName={studio.protocolName}
    onProtocolNameChange={studio.setProtocolName}
    days={studio.days}
    activeDayIndex={studio.activeDayIndex}
    onActiveDayChange={studio.setActiveDayIndex}
    onUpdateDay={studio.updateDay}
    onAddDay={studio.addDay}
    onRemoveDay={studio.removeDay}
    onInjectMacros={studio.injectMacrosToDay}
    onInjectHydration={studio.injectHydrationToDay}
    onInjectAll={studio.injectAllToDay}
    hasMacroResult={studio.macroResult !== null}
    hasHydration={studio.hydrationLiters !== null}
    coherenceScore={studio.coherenceScore}
    shareIssues={studio.shareIssues}
    trainingWeekSchedule={studio.trainingWeekSchedule}
    selectedScheduleDow={studio.selectedScheduleDow}
    onSelectScheduleDow={studio.setSelectedScheduleDow}
    scheduleSlots={studio.scheduleSlots}
    onScheduleSlotsChange={studio.setScheduleSlots}
  />
</div>
```

- [ ] **Step 4: Run test to verify the rail still passes and studio compiles**

Run: `npm test -- tests/components/nutrition-studio-reality-rail.test.ts tests/lib/nutrition/studio/useNutritionReality.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/nutrition/studio/NutritionStudio.tsx components/nutrition/studio/NutritionRealityRail.tsx tests/components/nutrition-studio-reality-rail.test.ts
git commit -m "feat: integrate nutrition reality rail into studio"
```

### Task 4: Empty/Error States And Final Regression Pass

**Files:**
- Modify: `components/nutrition/studio/NutritionRealityRail.tsx`
- Modify: `components/nutrition/studio/useNutritionReality.ts`
- Modify: `tests/components/nutrition-studio-reality-rail.test.ts`

- [ ] **Step 1: Add failing empty-state test**

```ts
it("renders a compact empty state when no reality view is available", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      React.createElement(NutritionRealityRail, {
        loading: false,
        error: null,
        activeWindow: 7,
        onWindowChange: () => {},
        onOpenHub: () => {},
        view: null,
      }),
    );
  });

  expect(container.textContent).toMatch(/pas encore assez de données/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/nutrition-studio-reality-rail.test.ts`

Expected: FAIL until the empty state is implemented

- [ ] **Step 3: Implement compact empty state**

```tsx
// components/nutrition/studio/NutritionRealityRail.tsx
{!loading && !error && !view && (
  <div className="mt-4 rounded-xl bg-white/[0.03] px-3 py-3">
    <p className="text-[11px] font-semibold text-white">
      Pas encore assez de données nutritionnelles
    </p>
    <p className="mt-1 text-[10px] leading-relaxed text-white/50">
      Les journées réelles apparaîtront ici dès que le client loguera repas et hydratation.
    </p>
  </div>
)}
```

- [ ] **Step 4: Run full targeted regression suite**

Run: `npm test -- tests/lib/nutrition/studio/useNutritionReality.test.ts tests/components/nutrition-studio-reality-rail.test.ts tests/components/coach-nutrition-hub-shell.test.ts tests/components/nutrition-hub-panels.test.ts tests/components/nutrition-hub-agenda.test.ts tests/api/clients-nutrition-hub.test.ts tests/lib/coach/nutritionHub.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/nutrition/studio/NutritionRealityRail.tsx components/nutrition/studio/useNutritionReality.ts tests/components/nutrition-studio-reality-rail.test.ts
git commit -m "feat: harden nutrition studio reality rail states"
```

---

## Self-Review

### Spec coverage

- rail above `ProtocolCanvas`: Task 3
- compact `3j / 7j` only: Task 1 + Task 2
- top 3 insights only: Task 1
- 3 latest days only: Task 1 + Task 2
- hub CTA: Task 2 + Task 3
- no duplicated analytics logic: Task 1
- graceful loading/error/empty states: Task 4

### Placeholder scan

- No `TODO` / `TBD`
- No vague “add tests later”
- Every task has concrete code, files, and commands

### Type consistency

- windows remain `3 | 7`
- rail consumes `summary`, `topInsights`, `recentDays`, `availableWindows`
- `recentDays` structure stays aligned with existing hub `agenda` rows

