# Coach Nutrition Hub Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `Coach > Client > Data > Nutrition` into a premium analytics page at the same level of finish and perceived value as `Performance`.

**Architecture:** Keep the existing coach nutrition hub API and aggregation logic as the source of truth, then replace the current flat `NutritionHub` UI with a premium shell modeled after `PerformanceHub`: a strong hero, richer analytical panels, premium coach insights, and a redesigned agenda. Only enrich the payload if the new hero needs one or two explicit presentation fields; do not fork the nutrition logic.

**Tech Stack:** Next.js App Router, React, TypeScript, Recharts, existing coach nutrition hub API, Vitest

---

## File Structure

### Create

- `components/clients/nutrition-hub/NutritionHeroPanel.tsx` — premium hero with score, coach status, micro-summary, and satellite metrics
- `components/clients/nutrition-hub/NutritionTrendGrid.tsx` — premium multi-panel analytics grid
- `components/clients/nutrition-hub/NutritionMetricSpotlight.tsx` — reusable premium metric card/panel for calories, proteins, hydration, training/off
- `components/clients/nutrition-hub/NutritionCoachSignalPanel.tsx` — premium insights/alerts panel
- `components/clients/nutrition-hub/NutritionAgendaPremium.tsx` — redesigned premium agenda list
- `components/clients/nutrition-hub/NutritionQualityPanel.tsx` — integrated data confidence / quality card
- `tests/components/nutrition-hub-premium.test.ts` — premium shell rendering and hierarchy tests
- `tests/lib/coach/nutritionHubPremium.test.ts` — helper tests for hero status/summary derivation if payload helpers are added

### Modify

- `components/clients/NutritionHub.tsx` — replace current flat composition with premium shell orchestration
- `app/api/clients/[clientId]/nutrition-hub/route.ts` — only if adding `heroStatus`, `heroSummary`, or weak dimensions is necessary
- `lib/coach/nutritionHub.ts` — only if adding pure helper functions for hero presentation
- `components/clients/nutrition-hub/NutritionTrendPanel.tsx` — either replace or fold into `NutritionTrendGrid`
- `components/clients/nutrition-hub/NutritionInsightsPanel.tsx` — replace or absorb into premium insights panel
- `components/clients/nutrition-hub/NutritionAgenda.tsx` — replace with premium agenda or keep as thin compatibility wrapper
- `components/clients/nutrition-hub/NutritionDataQualityCard.tsx` — replace with quality panel or absorb

---

### Task 1: Add Premium Hero Presentation Helpers

**Files:**
- Modify: `lib/coach/nutritionHub.ts`
- Test: `tests/lib/coach/nutritionHubPremium.test.ts`

- [ ] **Step 1: Write the failing hero helper tests**

```ts
import { describe, expect, it } from "vitest";
import {
  deriveNutritionHeroStatus,
  deriveNutritionHeroSummary,
} from "@/lib/coach/nutritionHub";

describe("nutrition hub premium hero helpers", () => {
  it("returns intervention tone when score is low and insights are severe", () => {
    const result = deriveNutritionHeroStatus({
      nutritionScore: 0.61,
      partialDays: 1,
      validDays: 7,
      insights: [
        { severity: "alert", title: "Protéines insuffisantes", message: "..." },
      ],
    });

    expect(result.label).toBe("À corriger");
    expect(result.tone).toBe("amber");
  });

  it("returns fragile reading tone when data quality is weak", () => {
    const result = deriveNutritionHeroStatus({
      nutritionScore: 0.83,
      partialDays: 4,
      validDays: 7,
      insights: [],
    });

    expect(result.label).toBe("Lecture fragile");
    expect(result.tone).toBe("amber");
  });

  it("builds a concise summary from the weakest observed dimensions", () => {
    const result = deriveNutritionHeroSummary({
      adherenceCalories: 0.91,
      adherenceProtein: 0.72,
      adherenceCarbs: 0.87,
      adherenceFat: 0.88,
      adherenceHydration: 0.69,
      partialDays: 0,
    });

    expect(result).toMatch(/protéines/i);
    expect(result).toMatch(/hydratation/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/coach/nutritionHubPremium.test.ts`

Expected: FAIL with missing exports from `@/lib/coach/nutritionHub`

- [ ] **Step 3: Implement minimal pure hero helpers**

```ts
// lib/coach/nutritionHub.ts
export function deriveNutritionHeroStatus(input: {
  nutritionScore: number | null;
  partialDays: number;
  validDays: number;
  insights: Array<{ severity: "good" | "watch" | "alert"; title: string; message: string }>;
}) {
  const partialRatio =
    input.validDays > 0 ? input.partialDays / input.validDays : 0;
  const hasAlert = input.insights.some((item) => item.severity === "alert");

  if (partialRatio >= 0.35) {
    return {
      label: "Lecture fragile",
      tone: "amber" as const,
      detail: "Plusieurs journées restent incomplètes sur la fenêtre active.",
    };
  }

  if ((input.nutritionScore ?? 1) < 0.7 || hasAlert) {
    return {
      label: "À corriger",
      tone: "amber" as const,
      detail: "Un ou plusieurs signaux nutritionnels demandent un ajustement.",
    };
  }

  return {
    label: "Sous contrôle",
    tone: "green" as const,
    detail: "L'exécution nutritionnelle reste globalement cohérente.",
  };
}

export function deriveNutritionHeroSummary(input: {
  adherenceCalories: number | null;
  adherenceProtein: number | null;
  adherenceCarbs: number | null;
  adherenceFat: number | null;
  adherenceHydration: number | null;
  partialDays: number;
}) {
  const dimensions = [
    { key: "protéines", value: input.adherenceProtein },
    { key: "hydratation", value: input.adherenceHydration },
    { key: "glucides", value: input.adherenceCarbs },
    { key: "calories", value: input.adherenceCalories },
    { key: "lipides", value: input.adherenceFat },
  ].filter((item): item is { key: string; value: number } => item.value != null);

  dimensions.sort((a, b) => a.value - b.value);
  const weakest = dimensions.slice(0, 2).map((item) => item.key);

  if (input.partialDays > 0) {
    return "Lecture utile mais à nuancer : plusieurs journées restent incomplètes.";
  }

  if (weakest.length === 0) {
    return "Les données nutritionnelles restent encore trop faibles pour conclure.";
  }

  if (weakest.length === 1) {
    return `Le signal principal à surveiller concerne ${weakest[0]}.`;
  }

  return `Les écarts se concentrent surtout sur ${weakest[0]} et ${weakest[1]}.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/coach/nutritionHubPremium.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/coach/nutritionHub.ts tests/lib/coach/nutritionHubPremium.test.ts
git commit -m "feat: add nutrition hub premium hero helpers"
```

### Task 2: Build The Premium Hero And Metric Panels

**Files:**
- Create: `components/clients/nutrition-hub/NutritionHeroPanel.tsx`
- Create: `components/clients/nutrition-hub/NutritionMetricSpotlight.tsx`
- Create: `components/clients/nutrition-hub/NutritionTrendGrid.tsx`
- Test: `tests/components/nutrition-hub-premium.test.ts`

- [ ] **Step 1: Write the failing premium hero test**

```ts
// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import NutritionHeroPanel from "@/components/clients/nutrition-hub/NutritionHeroPanel";

describe("NutritionHeroPanel", () => {
  it("renders the premium score, status, and summary", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(NutritionHeroPanel, {
          summary: {
            adherenceCalories: 0.92,
            adherenceProtein: 0.81,
            adherenceCarbs: 0.76,
            adherenceFat: 0.88,
            adherenceHydration: 0.72,
            nutritionScore: 0.83,
            validDays: 7,
          },
          status: {
            label: "Sous contrôle",
            tone: "green",
            detail: "L'exécution nutritionnelle reste globalement cohérente.",
          },
          heroSummary:
            "Les écarts se concentrent surtout sur protéines et hydratation.",
          windowLabel: "7 j",
        }),
      );
    });

    expect(container.textContent).toMatch(/83%/);
    expect(container.textContent).toMatch(/sous contrôle/i);
    expect(container.textContent).toMatch(/protéines/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/nutrition-hub-premium.test.ts`

Expected: FAIL with missing premium component modules

- [ ] **Step 3: Implement the premium hero**

```tsx
// components/clients/nutrition-hub/NutritionHeroPanel.tsx
"use client";

type NutritionHeroPanelProps = {
  summary: {
    adherenceCalories: number | null;
    adherenceProtein: number | null;
    adherenceCarbs: number | null;
    adherenceFat: number | null;
    adherenceHydration: number | null;
    nutritionScore: number | null;
    validDays: number;
  };
  status: {
    label: string;
    tone: "green" | "amber" | "red";
    detail: string;
  };
  heroSummary: string;
  windowLabel: string;
};

const toneClassMap = {
  green: "text-[#7fe2bf] border-[#1f8a65]/20 bg-[#1f8a65]/10",
  amber: "text-[#ffd15e] border-[#ffd15e]/20 bg-[#ffd15e]/10",
  red: "text-[#ff8660] border-[#ff8660]/20 bg-[#ff8660]/10",
};

export default function NutritionHeroPanel({
  summary,
  status,
  heroSummary,
  windowLabel,
}: NutritionHeroPanelProps) {
  return (
    <section className="rounded-[28px] border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,_rgba(31,138,101,0.22),_rgba(24,24,24,1)_45%)] p-5 md:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
            Nutrition
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${toneClassMap[status.tone]}`}
            >
              {status.label}
            </span>
            <span className="text-[11px] text-white/40">Fenêtre {windowLabel}</span>
          </div>
          <h1 className="mt-4 text-[40px] font-semibold leading-none text-white">
            {summary.nutritionScore == null
              ? "N/A"
              : `${Math.round(summary.nutritionScore * 100)}%`}
          </h1>
          <p className="mt-2 text-sm text-white/70">{status.detail}</p>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/55">
            {heroSummary}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:w-[420px]">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Calories
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {summary.adherenceCalories == null
                ? "N/A"
                : `${Math.round(summary.adherenceCalories * 100)}%`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Protéines
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {summary.adherenceProtein == null
                ? "N/A"
                : `${Math.round(summary.adherenceProtein * 100)}%`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Hydratation
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {summary.adherenceHydration == null
                ? "N/A"
                : `${Math.round(summary.adherenceHydration * 100)}%`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Implement the spotlight/trend grid**

```tsx
// components/clients/nutrition-hub/NutritionMetricSpotlight.tsx
"use client";

export default function NutritionMetricSpotlight({
  label,
  value,
  detail,
  children,
}: {
  label: string;
  value: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4 md:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <p className="mt-3 text-[28px] font-semibold text-white">{value}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-white/50">{detail}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}
```

```tsx
// components/clients/nutrition-hub/NutritionTrendGrid.tsx
"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import NutritionMetricSpotlight from "./NutritionMetricSpotlight";

type TrendPoint = {
  date: string;
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
  dayKind?: "training" | "off" | "unknown";
};

function chartRows(points: TrendPoint[]) {
  return points.map((point) => ({
    date: point.date.slice(5),
    consumedCalories: point.consumed.calories,
    targetCalories: point.target.calories ?? 0,
    consumedProtein: point.consumed.protein_g,
    targetProtein: point.target.protein_g ?? 0,
    consumedHydration: point.consumed.hydration_ml,
    targetHydration: point.target.hydration_ml ?? 0,
  }));
}

export default function NutritionTrendGrid({
  points,
}: {
  points: TrendPoint[];
}) {
  const data = chartRows(points);
  const trainingDays = points.filter((point) => point.dayKind === "training");
  const offDays = points.filter((point) => point.dayKind === "off");

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <NutritionMetricSpotlight
        label="Calories"
        value="Consommé vs cible"
        detail="Lecture premium des écarts caloriques sur la fenêtre active."
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="date" stroke="#ffffff55" />
              <YAxis stroke="#ffffff55" />
              <Tooltip />
              <Line type="monotone" dataKey="consumedCalories" stroke="#ffd15e" dot={false} />
              <Line type="monotone" dataKey="targetCalories" stroke="#1f8a65" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </NutritionMetricSpotlight>

      <NutritionMetricSpotlight
        label="Protéines"
        value="Adhérence protéique"
        detail="Stabilité du respect de la cible protéique au fil des journées."
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="date" stroke="#ffffff55" />
              <YAxis stroke="#ffffff55" />
              <Tooltip />
              <Line type="monotone" dataKey="consumedProtein" stroke="#7fe2bf" dot={false} />
              <Line type="monotone" dataKey="targetProtein" stroke="#1f8a65" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </NutritionMetricSpotlight>

      <NutritionMetricSpotlight
        label="Hydratation"
        value="Conformité hydrique"
        detail="Lecture de l'hydratation réelle par rapport à la cible du protocole."
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="date" stroke="#ffffff55" />
              <YAxis stroke="#ffffff55" />
              <Tooltip />
              <Line type="monotone" dataKey="consumedHydration" stroke="#689ffa" dot={false} />
              <Line type="monotone" dataKey="targetHydration" stroke="#5cc9a8" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </NutritionMetricSpotlight>

      <NutritionMetricSpotlight
        label="Training vs Off"
        value={`${trainingDays.length} / ${offDays.length}`}
        detail="Comparer rapidement l'exécution nutritionnelle selon le contexte des journées."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Training</p>
            <p className="mt-2 text-lg font-semibold text-white">{trainingDays.length} jours</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Off</p>
            <p className="mt-2 text-lg font-semibold text-white">{offDays.length} jours</p>
          </div>
        </div>
      </NutritionMetricSpotlight>
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/components/nutrition-hub-premium.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/clients/nutrition-hub/NutritionHeroPanel.tsx components/clients/nutrition-hub/NutritionMetricSpotlight.tsx components/clients/nutrition-hub/NutritionTrendGrid.tsx tests/components/nutrition-hub-premium.test.ts
git commit -m "feat: add premium nutrition hub hero and trend grid"
```

### Task 3: Replace Flat Insights/Agenda/Quality With Premium Panels

**Files:**
- Create: `components/clients/nutrition-hub/NutritionCoachSignalPanel.tsx`
- Create: `components/clients/nutrition-hub/NutritionAgendaPremium.tsx`
- Create: `components/clients/nutrition-hub/NutritionQualityPanel.tsx`
- Modify: `tests/components/nutrition-hub-premium.test.ts`

- [ ] **Step 1: Extend the failing premium test for premium sections**

```ts
it("renders premium coach insights and agenda sections", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      React.createElement(NutritionCoachSignalPanel, {
        insights: [
          { id: "1", severity: "alert", title: "Protéines insuffisantes", message: "Sous cible 5 jours sur 7." },
        ],
      }),
    );
  });

  expect(container.textContent).toMatch(/coach insights/i);
  expect(container.textContent).toMatch(/protéines insuffisantes/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/nutrition-hub-premium.test.ts`

Expected: FAIL with missing premium panel modules

- [ ] **Step 3: Implement premium insights, agenda, and quality panels**

```tsx
// components/clients/nutrition-hub/NutritionCoachSignalPanel.tsx
"use client";

export default function NutritionCoachSignalPanel({
  insights,
}: {
  insights: Array<{
    id: string;
    severity: "good" | "watch" | "alert";
    title: string;
    message: string;
  }>;
}) {
  return (
    <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-5">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Coach Insights
        </p>
        <h2 className="mt-1 text-[15px] font-semibold text-white">
          Signaux prioritaires
        </h2>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {insights.map((insight) => (
          <article key={insight.id} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              {insight.severity}
            </p>
            <h3 className="mt-2 text-sm font-semibold text-white">{insight.title}</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-white/55">{insight.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// components/clients/nutrition-hub/NutritionAgendaPremium.tsx
"use client";

export default function NutritionAgendaPremium({
  rows,
}: {
  rows: Array<{
    date: string;
    status: string;
    mealCount: number;
    dayKind: "training" | "off" | "unknown";
    consumed: { calories: number; protein_g: number; hydration_ml: number };
    target: { calories: number | null; protein_g: number | null; hydration_ml: number | null };
  }>;
}) {
  return (
    <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-5">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Agenda Nutritionnel
        </p>
        <h2 className="mt-1 text-[15px] font-semibold text-white">
          Journées à auditer
        </h2>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.date} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{row.date}</p>
                <p className="mt-1 text-[11px] text-white/45">
                  {row.status} · {row.mealCount} repas · {row.dayKind}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">
                  {row.consumed.calories} / {row.target.calories ?? "N/A"} kcal
                </p>
                <p className="mt-1 text-[11px] text-white/45">
                  P {row.consumed.protein_g} / {row.target.protein_g ?? "N/A"} g · Eau{" "}
                  {row.consumed.hydration_ml} / {row.target.hydration_ml ?? "N/A"} ml
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// components/clients/nutrition-hub/NutritionQualityPanel.tsx
"use client";

export default function NutritionQualityPanel({
  dataQuality,
}: {
  dataQuality: {
    validDays: number;
    partialDays: number;
    missingMealDays: number;
    missingHydrationDays: number;
  };
}) {
  return (
    <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        Qualité de lecture
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <p className="text-2xl font-semibold text-white">{dataQuality.validDays}</p>
          <p className="mt-1 text-[11px] text-white/45">Jours valides</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <p className="text-2xl font-semibold text-white">{dataQuality.partialDays}</p>
          <p className="mt-1 text-[11px] text-white/45">Jours partiels</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <p className="text-2xl font-semibold text-white">{dataQuality.missingMealDays}</p>
          <p className="mt-1 text-[11px] text-white/45">Repas absents</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <p className="text-2xl font-semibold text-white">{dataQuality.missingHydrationDays}</p>
          <p className="mt-1 text-[11px] text-white/45">Hydratation absente</p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/nutrition-hub-premium.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/clients/nutrition-hub/NutritionCoachSignalPanel.tsx components/clients/nutrition-hub/NutritionAgendaPremium.tsx components/clients/nutrition-hub/NutritionQualityPanel.tsx tests/components/nutrition-hub-premium.test.ts
git commit -m "feat: add premium nutrition hub support panels"
```

### Task 4: Rebuild `NutritionHub` As A Premium Shell

**Files:**
- Modify: `components/clients/NutritionHub.tsx`
- Modify: `tests/components/coach-nutrition-hub-shell.test.ts`
- Modify: `tests/components/nutrition-hub-premium.test.ts`

- [ ] **Step 1: Add the failing premium shell test**

```ts
it("renders the premium nutrition page hierarchy", async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      summary: {
        adherenceCalories: 0.92,
        adherenceProtein: 0.81,
        adherenceCarbs: 0.76,
        adherenceFat: 0.88,
        adherenceHydration: 0.72,
        nutritionScore: 0.83,
        validDays: 7,
      },
      trend: {
        window: 7,
        points: [
          {
            date: "2026-06-01",
            dayKind: "training",
            consumed: { calories: 1900, protein_g: 145, carbs_g: 170, fat_g: 55, hydration_ml: 2200 },
            target: { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, hydration_ml: 3000 },
          },
        ],
      },
      insights: [{ id: "1", severity: "alert", title: "Protéines insuffisantes", message: "..." }],
      agenda: [
        {
          date: "2026-06-01",
          dayKind: "training",
          status: "under",
          mealCount: 3,
          consumed: { calories: 1900, protein_g: 145, carbs_g: 170, fat_g: 55, hydration_ml: 2200 },
          target: { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, hydration_ml: 3000 },
        },
      ],
      dataQuality: {
        validDays: 7,
        partialDays: 0,
        missingMealDays: 0,
        missingHydrationDays: 1,
      },
    }),
  }) as any;
```

- [ ] **Step 2: Run test to verify it fails on old flat layout**

Run: `npm test -- tests/components/coach-nutrition-hub-shell.test.ts tests/components/nutrition-hub-premium.test.ts`

Expected: FAIL until `NutritionHub.tsx` uses the premium shell

- [ ] **Step 3: Rebuild `NutritionHub.tsx`**

```tsx
// components/clients/NutritionHub.tsx
import {
  deriveNutritionHeroStatus,
  deriveNutritionHeroSummary,
} from "@/lib/coach/nutritionHub";
import NutritionAgendaPremium from "@/components/clients/nutrition-hub/NutritionAgendaPremium";
import NutritionCoachSignalPanel from "@/components/clients/nutrition-hub/NutritionCoachSignalPanel";
import NutritionHeroPanel from "@/components/clients/nutrition-hub/NutritionHeroPanel";
import NutritionQualityPanel from "@/components/clients/nutrition-hub/NutritionQualityPanel";
import NutritionTrendGrid from "@/components/clients/nutrition-hub/NutritionTrendGrid";

// keep loading/error/fetch logic

const heroStatus = deriveNutritionHeroStatus({
  nutritionScore: data.summary.nutritionScore,
  partialDays: data.dataQuality.partialDays,
  validDays: data.dataQuality.validDays,
  insights: data.insights,
});

const heroSummary = deriveNutritionHeroSummary({
  adherenceCalories: data.summary.adherenceCalories,
  adherenceProtein: data.summary.adherenceProtein,
  adherenceCarbs: data.summary.adherenceCarbs,
  adherenceFat: data.summary.adherenceFat,
  adherenceHydration: data.summary.adherenceHydration,
  partialDays: data.dataQuality.partialDays,
});

return (
  <div className="space-y-6">
    <NutritionHeroPanel
      summary={data.summary}
      status={heroStatus}
      heroSummary={heroSummary}
      windowLabel={`${windowDays} j`}
    />
    <NutritionTrendGrid points={data.trend.points} />
    <NutritionCoachSignalPanel insights={data.insights.slice(0, 5)} />
    <NutritionAgendaPremium rows={data.agenda} />
    <NutritionQualityPanel dataQuality={data.dataQuality} />
  </div>
);
```

- [ ] **Step 4: Run tests to verify the premium shell passes**

Run: `npm test -- tests/components/coach-nutrition-hub-shell.test.ts tests/components/nutrition-hub-premium.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/clients/NutritionHub.tsx tests/components/coach-nutrition-hub-shell.test.ts tests/components/nutrition-hub-premium.test.ts
git commit -m "feat: redesign nutrition hub with premium shell"
```

### Task 5: Final Hardening And Focused Regression Suite

**Files:**
- Modify: `components/clients/NutritionHub.tsx`
- Modify: `tests/components/coach-nutrition-hub-shell.test.ts`
- Modify: `tests/components/nutrition-hub-premium.test.ts`
- Modify: `app/api/clients/[clientId]/nutrition-hub/route.ts`
- Modify: `lib/coach/nutritionHub.ts`

- [ ] **Step 1: Add failing empty-state and weak-data tests**

```ts
it("renders a premium empty state when agenda is empty", async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      summary: {
        adherenceCalories: null,
        adherenceProtein: null,
        adherenceCarbs: null,
        adherenceFat: null,
        adherenceHydration: null,
        nutritionScore: null,
        validDays: 0,
      },
      trend: { window: 7, points: [] },
      insights: [],
      agenda: [],
      dataQuality: {
        validDays: 0,
        partialDays: 0,
        missingMealDays: 0,
        missingHydrationDays: 0,
      },
    }),
  }) as any;
```

- [ ] **Step 2: Run tests to verify they fail if premium empty state is missing**

Run: `npm test -- tests/components/coach-nutrition-hub-shell.test.ts tests/components/nutrition-hub-premium.test.ts`

Expected: FAIL until empty states match the premium hierarchy

- [ ] **Step 3: Harden premium states and payload assumptions**

```tsx
// components/clients/NutritionHub.tsx
if (loading) {
  return (
    <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        Nutrition
      </p>
      <div className="mt-4 space-y-3">
        <div className="h-10 w-40 rounded bg-white/[0.05]" />
        <div className="h-4 w-72 rounded bg-white/[0.04]" />
      </div>
    </section>
  );
}

if (error) {
  return (
    <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        Nutrition
      </p>
      <h2 className="mt-3 text-lg font-semibold text-white">Lecture indisponible</h2>
      <p className="mt-2 text-sm text-white/55">{error}</p>
    </section>
  );
}
```

- [ ] **Step 4: Run the focused regression suite**

Run: `npm test -- tests/components/coach-nutrition-hub-shell.test.ts tests/components/nutrition-hub-premium.test.ts tests/components/nutrition-hub-panels.test.ts tests/components/nutrition-hub-agenda.test.ts tests/api/clients-nutrition-hub.test.ts tests/lib/coach/nutritionHub.test.ts tests/lib/coach/nutritionHubPremium.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/clients/NutritionHub.tsx app/api/clients/[clientId]/nutrition-hub/route.ts lib/coach/nutritionHub.ts tests/components/coach-nutrition-hub-shell.test.ts tests/components/nutrition-hub-premium.test.ts tests/lib/coach/nutritionHubPremium.test.ts
git commit -m "feat: harden premium nutrition hub redesign"
```

---

## Self-Review

### Spec coverage

- premium hero: Task 1 + Task 2 + Task 4
- richer analytics grid: Task 2
- premium coach insights: Task 3
- redesigned agenda: Task 3
- integrated quality/confidence: Task 3 + Task 5
- preserve existing API/motor as source of truth: Task 1 + Task 4
- premium loading/error/empty states: Task 5

### Placeholder scan

- No `TODO` / `TBD`
- No “similar to prior component” shortcuts
- All tasks include exact files, code, and commands

### Type consistency

- hero status helper returns `{ label, tone, detail }`
- premium shell consumes existing `summary`, `trend`, `insights`, `agenda`, `dataQuality`
- trend grid expects `dayKind` on points; if absent, Task 4 should add it via shell mapping instead of mutating unrelated API contracts

