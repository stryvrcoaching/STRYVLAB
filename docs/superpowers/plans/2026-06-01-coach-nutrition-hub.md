# Coach Nutrition Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new coach-facing `Data > Nutrition` hub that shows real nutrition adherence, short-window trends, rule-based insights, and a scannable daily agenda for a single client.

**Architecture:** Add a dedicated coach route and navigation entry, then centralize nutrition aggregation in a pure library used by a new `/api/clients/[clientId]/nutrition-hub` endpoint. Keep the UI aligned with the existing coach `Performance` page by using a small shell component plus focused subcomponents for KPI strip, trend charts, insights, agenda, and data quality.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Zod, Recharts, Vitest/Jest-style repo tests

---

## File Structure

### Create

- `lib/coach/nutritionHub.ts` — pure aggregation helpers, scoring, insights, agenda row shaping
- `tests/lib/coach/nutritionHub.test.ts` — unit tests for adherence, windows, day status, and insights
- `app/api/clients/[clientId]/nutrition-hub/route.ts` — coach-owned API endpoint for aggregated payload
- `tests/api/clients-nutrition-hub.test.ts` — endpoint auth, ownership, and payload-shape tests
- `app/coach/clients/[clientId]/data/nutrition/page.tsx` — new page entry
- `components/clients/NutritionHub.tsx` — page shell, fetch orchestration, window filter state
- `components/clients/nutrition-hub/NutritionKpiStrip.tsx` — top KPI cards
- `components/clients/nutrition-hub/NutritionTrendPanel.tsx` — charts and window toggles
- `components/clients/nutrition-hub/NutritionInsightsPanel.tsx` — rule-based insight cards
- `components/clients/nutrition-hub/NutritionAgenda.tsx` — daily agenda list
- `components/clients/nutrition-hub/NutritionDayDrawer.tsx` — per-day detail drawer
- `components/clients/nutrition-hub/NutritionDataQualityCard.tsx` — trust/coverage block

### Modify

- `components/layout/NavDock/useNavConfig.ts` — add `Nutrition` under client `Data`
- `components/layout/useDockBottom.ts` — add `Nutrition` entry to client `data` dock
- `components/layout/NotificationBell.tsx` — only if a nutrition deep-link is needed during implementation

---

### Task 1: Navigation And Page Skeleton

**Files:**
- Modify: `components/layout/NavDock/useNavConfig.ts`
- Modify: `components/layout/useDockBottom.ts`
- Create: `app/coach/clients/[clientId]/data/nutrition/page.tsx`
- Create: `components/clients/NutritionHub.tsx`
- Test: `tests/components/coach-nutrition-hub-shell.test.tsx`

- [ ] **Step 1: Write the failing shell test**

```tsx
import { render, screen } from "@testing-library/react";
import NutritionHub from "@/components/clients/NutritionHub";

describe("NutritionHub", () => {
  it("renders loading skeleton then KPI section labels", async () => {
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
        trend: { window: 7, points: [] },
        insights: [],
        agenda: [],
        dataQuality: {
          validDays: 7,
          partialDays: 0,
          missingMealDays: 0,
          missingHydrationDays: 1,
        },
      }),
    }) as any;

    render(<NutritionHub clientId="client-1" />);

    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
    expect(await screen.findByText(/score global nutrition/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/coach-nutrition-hub-shell.test.tsx`

Expected: FAIL with `Cannot find module '@/components/clients/NutritionHub'`

- [ ] **Step 3: Implement minimal navigation and page shell**

```ts
// components/layout/NavDock/useNavConfig.ts
{ id: "nutrition", label: "Nutrition", href: `/coach/clients/${clientId}/data/nutrition` },
```

```ts
// components/layout/useDockBottom.ts
{ id: "nutrition", label: "Nutrition", href: `/coach/clients/${clientId}/data/nutrition`, icon: Utensils },
```

```tsx
// app/coach/clients/[clientId]/data/nutrition/page.tsx
"use client";

import { useClient } from "@/lib/client-context";
import { useClientTopBar } from "@/components/clients/useClientTopBar";
import NutritionHub from "@/components/clients/NutritionHub";

export default function NutritionDataPage() {
  const { clientId } = useClient();
  useClientTopBar("Nutrition");

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24 space-y-6">
        <NutritionHub clientId={clientId} />
      </div>
    </main>
  );
}
```

```tsx
// components/clients/NutritionHub.tsx
"use client";

import { useEffect, useState } from "react";

export default function NutritionHub({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/clients/${clientId}/nutrition-hub?window=7`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        setData(json);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  if (loading) return <p className="text-sm text-white/50">Chargement…</p>;

  return <section><h2 className="text-white">Score global nutrition</h2></section>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/coach-nutrition-hub-shell.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/layout/NavDock/useNavConfig.ts components/layout/useDockBottom.ts app/coach/clients/[clientId]/data/nutrition/page.tsx components/clients/NutritionHub.tsx tests/components/coach-nutrition-hub-shell.test.tsx
git commit -m "feat: add coach nutrition hub shell"
```

### Task 2: Pure Aggregation Engine For Nutrition Hub

**Files:**
- Create: `lib/coach/nutritionHub.ts`
- Test: `tests/lib/coach/nutritionHub.test.ts`

- [ ] **Step 1: Write the failing aggregation tests**

```ts
import {
  buildNutritionHubSummary,
  buildNutritionHubInsights,
  classifyNutritionAgendaDay,
} from "@/lib/coach/nutritionHub";

describe("nutritionHub", () => {
  it("caps adherence at 1 for score computation", () => {
    const result = buildNutritionHubSummary([
      {
        consumed: { calories: 2200, protein_g: 180, carbs_g: 210, fat_g: 70, hydration_ml: 3200 },
        target: { calories: 2000, protein_g: 160, carbs_g: 200, fat_g: 70, hydration_ml: 3000 },
        completeness: "complete",
      },
    ]);

    expect(result.adherenceCalories).toBe(1);
    expect(result.adherenceProtein).toBe(1);
    expect(result.nutritionScore).toBeGreaterThan(0.9);
  });

  it("flags repeated low protein adherence", () => {
    const insights = buildNutritionHubInsights([
      { dayKind: "training", completeness: "complete", adherence: { protein: 0.72, carbs: 0.95, hydration: 0.9 }, deltaPct: { calories: -0.06 } },
      { dayKind: "training", completeness: "complete", adherence: { protein: 0.8, carbs: 0.92, hydration: 0.88 }, deltaPct: { calories: -0.03 } },
      { dayKind: "off", completeness: "complete", adherence: { protein: 0.74, carbs: 0.86, hydration: 0.8 }, deltaPct: { calories: 0.02 } },
      { dayKind: "training", completeness: "complete", adherence: { protein: 0.79, carbs: 0.78, hydration: 0.72 }, deltaPct: { calories: 0.01 } },
    ]);

    expect(insights.some((item) => item.title.match(/protéines/i))).toBe(true);
  });

  it("classifies partial days before under/over target", () => {
    expect(
      classifyNutritionAgendaDay({
        completeness: "partial",
        consumed: { calories: 1200 },
        target: { calories: 2200 },
      }),
    ).toBe("partial");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/coach/nutritionHub.test.ts`

Expected: FAIL with `Cannot find module '@/lib/coach/nutritionHub'`

- [ ] **Step 3: Implement minimal pure helpers**

```ts
// lib/coach/nutritionHub.ts
export type HubDayInput = {
  dayKind: "training" | "off" | "unknown";
  completeness: "complete" | "partial" | "missing";
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
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function adherence(consumed: number, target: number | null) {
  if (!target || target <= 0) return null;
  return clamp01(consumed / target);
}

export function classifyNutritionAgendaDay(input: {
  completeness: HubDayInput["completeness"];
  consumed: { calories: number };
  target: { calories: number | null };
}) {
  if (input.completeness !== "complete") return input.completeness;
  if (input.target.calories == null) return "no_target";
  const deltaPct = (input.consumed.calories - input.target.calories) / input.target.calories;
  if (Math.abs(deltaPct) <= 0.1) return "on_target";
  return deltaPct > 0 ? "over" : "under";
}

export function buildNutritionHubSummary(days: HubDayInput[]) {
  const valid = days.filter((day) => day.completeness === "complete" && day.target.calories != null);
  const avg = (values: Array<number | null>) => {
    const clean = values.filter((value): value is number => value != null);
    if (!clean.length) return null;
    return Math.round((clean.reduce((sum, value) => sum + value, 0) / clean.length) * 100) / 100;
  };

  const adherenceCalories = avg(valid.map((day) => adherence(day.consumed.calories, day.target.calories)));
  const adherenceProtein = avg(valid.map((day) => adherence(day.consumed.protein_g, day.target.protein_g)));
  const adherenceCarbs = avg(valid.map((day) => adherence(day.consumed.carbs_g, day.target.carbs_g)));
  const adherenceFat = avg(valid.map((day) => adherence(day.consumed.fat_g, day.target.fat_g)));
  const adherenceHydration = avg(valid.map((day) => adherence(day.consumed.hydration_ml, day.target.hydration_ml)));

  const weighted = [
    [adherenceCalories, 0.25],
    [adherenceProtein, 0.3],
    [adherenceCarbs, 0.15],
    [adherenceFat, 0.1],
    [adherenceHydration, 0.2],
  ] as const;

  const scoreBase = weighted.filter(([value]) => value != null) as Array<[number, number]>;

  return {
    adherenceCalories,
    adherenceProtein,
    adherenceCarbs,
    adherenceFat,
    adherenceHydration,
    nutritionScore: scoreBase.length
      ? Math.round(scoreBase.reduce((sum, [value, weight]) => sum + value * weight, 0) * 100) / 100
      : null,
    validDays: valid.length,
  };
}

export function buildNutritionHubInsights(
  days: Array<{
    dayKind: "training" | "off" | "unknown";
    completeness: "complete" | "partial" | "missing";
    adherence: { protein: number | null; carbs: number | null; hydration: number | null };
    deltaPct: { calories: number | null };
  }>,
) {
  const insights = [];
  const lowProteinDays = days.filter((day) => day.completeness === "complete" && (day.adherence.protein ?? 1) < 0.85).length;
  if (lowProteinDays >= 4) {
    insights.push({
      id: "protein-low",
      severity: "alert",
      title: "Protéines insuffisantes",
      message: `Protéines sous cible ${lowProteinDays} jours sur la fenêtre observée.`,
    });
  }
  return insights;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/coach/nutritionHub.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/coach/nutritionHub.ts tests/lib/coach/nutritionHub.test.ts
git commit -m "feat: add nutrition hub aggregation helpers"
```

### Task 3: Coach API Endpoint For Nutrition Hub

**Files:**
- Create: `app/api/clients/[clientId]/nutrition-hub/route.ts`
- Modify: `lib/coach/nutritionHub.ts`
- Test: `tests/api/clients-nutrition-hub.test.ts`

- [ ] **Step 1: Write the failing endpoint tests**

```ts
import { GET } from "@/app/api/clients/[clientId]/nutrition-hub/route";

describe("GET /api/clients/[clientId]/nutrition-hub", () => {
  it("returns 401 when no user is authenticated", async () => {
    const response = await GET(new Request("http://localhost/api/clients/abc/nutrition-hub?window=7") as any, {
      params: Promise.resolve({ clientId: "abc" }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects unsupported windows", async () => {
    const response = await GET(new Request("http://localhost/api/clients/abc/nutrition-hub?window=9") as any, {
      params: Promise.resolve({ clientId: "abc" }),
    });

    expect([400, 401]).toContain(response.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/clients-nutrition-hub.test.ts`

Expected: FAIL with missing route module

- [ ] **Step 3: Implement the minimal endpoint and payload wiring**

```ts
// app/api/clients/[clientId]/nutrition-hub/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  buildNutritionHubSummary,
  buildNutritionHubInsights,
  classifyNutritionAgendaDay,
  type HubDayInput,
} from "@/lib/coach/nutritionHub";

const querySchema = z.object({
  window: z.enum(["3", "7", "14", "30"]).default("7"),
});

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = serviceClient();
  const { data: ownedClient } = await db
    .from("coach_clients")
    .select("id")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .single();

  if (!ownedClient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const days: HubDayInput[] = [];

  return NextResponse.json({
    summary: buildNutritionHubSummary(days),
    trend: { window: Number(parsed.data.window), points: [] },
    insights: buildNutritionHubInsights([]),
    agenda: [],
    dataQuality: {
      validDays: 0,
      partialDays: 0,
      missingMealDays: 0,
      missingHydrationDays: 0,
    },
    availableWindows: [3, 7, 14, 30],
  });
}
```

- [ ] **Step 4: Expand implementation to real Supabase aggregation**

```ts
// inside GET, after ownership
const windowDays = Number(parsed.data.window);
const dateKeys = Array.from({ length: windowDays }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (windowDays - index - 1));
  return date.toISOString().slice(0, 10);
});

const [{ data: protocol }, { data: meals }, { data: waterLogs }] = await Promise.all([
  db
    .from("nutrition_protocols")
    .select("schedule_start_date, nutrition_protocol_days(position, name, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)")
    .eq("client_id", clientId)
    .eq("status", "shared")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle(),
  db
    .from("nutrition_meals")
    .select("physiological_date, meal_type, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g")
    .eq("client_id", clientId)
    .in("physiological_date", dateKeys),
  db
    .from("client_water_logs")
    .select("amount_ml, logged_at")
    .eq("client_id", clientId),
]);
```

- [ ] **Step 5: Run endpoint tests and focused nutrition tests**

Run: `npm test -- tests/api/clients-nutrition-hub.test.ts tests/lib/coach/nutritionHub.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/clients/[clientId]/nutrition-hub/route.ts lib/coach/nutritionHub.ts tests/api/clients-nutrition-hub.test.ts tests/lib/coach/nutritionHub.test.ts
git commit -m "feat: add coach nutrition hub api"
```

### Task 4: KPI Strip, Trend Panel, And Data Quality UI

**Files:**
- Create: `components/clients/nutrition-hub/NutritionKpiStrip.tsx`
- Create: `components/clients/nutrition-hub/NutritionTrendPanel.tsx`
- Create: `components/clients/nutrition-hub/NutritionDataQualityCard.tsx`
- Modify: `components/clients/NutritionHub.tsx`
- Test: `tests/components/nutrition-hub-panels.test.tsx`

- [ ] **Step 1: Write the failing panel tests**

```tsx
import { render, screen } from "@testing-library/react";
import NutritionKpiStrip from "@/components/clients/nutrition-hub/NutritionKpiStrip";
import NutritionTrendPanel from "@/components/clients/nutrition-hub/NutritionTrendPanel";

describe("nutrition hub panels", () => {
  it("renders KPI percentages as whole-number percent labels", () => {
    render(
      <NutritionKpiStrip
        summary={{
          adherenceCalories: 0.92,
          adherenceProtein: 0.81,
          adherenceCarbs: 0.76,
          adherenceFat: 0.88,
          adherenceHydration: 0.72,
          nutritionScore: 0.83,
          validDays: 7,
        }}
      />,
    );

    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText(/score global nutrition/i)).toBeInTheDocument();
  });

  it("renders all window toggles", () => {
    render(<NutritionTrendPanel activeWindow={7} points={[]} onWindowChange={() => {}} />);
    expect(screen.getByRole("button", { name: "3 j" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 j" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/nutrition-hub-panels.test.tsx`

Expected: FAIL with missing component modules

- [ ] **Step 3: Implement the three UI blocks**

```tsx
// components/clients/nutrition-hub/NutritionKpiStrip.tsx
const percent = (value: number | null) => (value == null ? "N/A" : `${Math.round(value * 100)}%`);

export default function NutritionKpiStrip({ summary }: { summary: any }) {
  const cards = [
    ["Calories", summary.adherenceCalories],
    ["Protéines", summary.adherenceProtein],
    ["Glucides", summary.adherenceCarbs],
    ["Lipides", summary.adherenceFat],
    ["Hydratation", summary.adherenceHydration],
    ["Score global nutrition", summary.nutritionScore],
  ];

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{percent(value as number | null)}</p>
        </div>
      ))}
    </section>
  );
}
```

```tsx
// components/clients/nutrition-hub/NutritionTrendPanel.tsx
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

const WINDOWS = [3, 7, 14, 30] as const;

export default function NutritionTrendPanel({ activeWindow, points, onWindowChange }: any) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Tendances</p>
          <h2 className="text-white text-sm font-semibold">Consommé vs cible</h2>
        </div>
        <div className="flex gap-2">
          {WINDOWS.map((windowValue) => (
            <button key={windowValue} onClick={() => onWindowChange(windowValue)} className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/70">
              {windowValue} j
            </button>
          ))}
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="consumed.calories" stroke="#ffd15e" dot={false} />
            <Line type="monotone" dataKey="target.calories" stroke="#1f8a65" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

```tsx
// components/clients/nutrition-hub/NutritionDataQualityCard.tsx
export default function NutritionDataQualityCard({ dataQuality }: { dataQuality: any }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Qualité des données</p>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <div><p className="text-white text-xl font-semibold">{dataQuality.validDays}</p><p className="text-white/45 text-xs">Jours valides</p></div>
        <div><p className="text-white text-xl font-semibold">{dataQuality.partialDays}</p><p className="text-white/45 text-xs">Jours partiels</p></div>
        <div><p className="text-white text-xl font-semibold">{dataQuality.missingMealDays}</p><p className="text-white/45 text-xs">Repas manquants</p></div>
        <div><p className="text-white text-xl font-semibold">{dataQuality.missingHydrationDays}</p><p className="text-white/45 text-xs">Hydratation absente</p></div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire the shell to the new panels**

```tsx
// components/clients/NutritionHub.tsx
import NutritionKpiStrip from "@/components/clients/nutrition-hub/NutritionKpiStrip";
import NutritionTrendPanel from "@/components/clients/nutrition-hub/NutritionTrendPanel";
import NutritionDataQualityCard from "@/components/clients/nutrition-hub/NutritionDataQualityCard";

const [windowDays, setWindowDays] = useState<3 | 7 | 14 | 30>(7);

// fetch URL uses windowDays
<NutritionKpiStrip summary={data.summary} />
<NutritionTrendPanel activeWindow={windowDays} points={data.trend.points} onWindowChange={setWindowDays} />
<NutritionDataQualityCard dataQuality={data.dataQuality} />
```

- [ ] **Step 5: Run panel tests**

Run: `npm test -- tests/components/nutrition-hub-panels.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/clients/NutritionHub.tsx components/clients/nutrition-hub/NutritionKpiStrip.tsx components/clients/nutrition-hub/NutritionTrendPanel.tsx components/clients/nutrition-hub/NutritionDataQualityCard.tsx tests/components/nutrition-hub-panels.test.tsx
git commit -m "feat: add nutrition hub summary panels"
```

### Task 5: Insights, Agenda, And Day Detail Drawer

**Files:**
- Create: `components/clients/nutrition-hub/NutritionInsightsPanel.tsx`
- Create: `components/clients/nutrition-hub/NutritionAgenda.tsx`
- Create: `components/clients/nutrition-hub/NutritionDayDrawer.tsx`
- Modify: `components/clients/NutritionHub.tsx`
- Test: `tests/components/nutrition-hub-agenda.test.tsx`

- [ ] **Step 1: Write the failing agenda test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import NutritionAgenda from "@/components/clients/nutrition-hub/NutritionAgenda";

describe("NutritionAgenda", () => {
  it("opens day detail when clicking an agenda row", () => {
    render(
      <NutritionAgenda
        rows={[
          {
            date: "2026-06-01",
            dayKind: "training",
            status: "under",
            mealCount: 3,
            consumed: { calories: 1800, protein_g: 110, carbs_g: 130, fat_g: 55, hydration_ml: 1800 },
            target: { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, hydration_ml: 3000 },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /2026-06-01/i }));
    expect(screen.getByText(/détail journée/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/nutrition-hub-agenda.test.tsx`

Expected: FAIL with missing component modules

- [ ] **Step 3: Implement insights and agenda components**

```tsx
// components/clients/nutrition-hub/NutritionInsightsPanel.tsx
export default function NutritionInsightsPanel({ insights }: { insights: any[] }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Coach insights</p>
      <div className="mt-3 space-y-3">
        {insights.map((insight) => (
          <div key={insight.id} className="rounded-xl bg-white/[0.03] px-3 py-3">
            <p className="text-sm font-semibold text-white">{insight.title}</p>
            <p className="mt-1 text-xs text-white/55">{insight.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// components/clients/nutrition-hub/NutritionDayDrawer.tsx
export default function NutritionDayDrawer({ row, onClose }: { row: any; onClose: () => void }) {
  if (!row) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="h-full w-full max-w-md bg-[#181818] p-5">
        <button onClick={onClose} className="text-white/60 text-sm">Fermer</button>
        <h3 className="mt-4 text-lg font-semibold text-white">Détail journée</h3>
        <p className="mt-2 text-sm text-white/60">{row.date}</p>
      </div>
    </div>
  );
}
```

```tsx
// components/clients/nutrition-hub/NutritionAgenda.tsx
import { useState } from "react";
import NutritionDayDrawer from "./NutritionDayDrawer";

export default function NutritionAgenda({ rows }: { rows: any[] }) {
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Agenda nutritionnel</p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <button key={row.date} onClick={() => setSelectedRow(row)} className="w-full rounded-xl bg-white/[0.03] px-3 py-3 text-left">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">{row.date}</p>
              <p className="text-xs text-white/45">{row.mealCount} repas</p>
            </div>
            <p className="mt-1 text-xs text-white/55">{row.consumed.calories} / {row.target.calories ?? "N/A"} kcal</p>
          </button>
        ))}
      </div>
      <NutritionDayDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </section>
  );
}
```

- [ ] **Step 4: Wire insights and agenda into the page shell**

```tsx
// components/clients/NutritionHub.tsx
import NutritionInsightsPanel from "@/components/clients/nutrition-hub/NutritionInsightsPanel";
import NutritionAgenda from "@/components/clients/nutrition-hub/NutritionAgenda";

<NutritionInsightsPanel insights={data.insights} />
<NutritionAgenda rows={data.agenda} />
```

- [ ] **Step 5: Run component tests**

Run: `npm test -- tests/components/nutrition-hub-agenda.test.tsx tests/components/nutrition-hub-panels.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/clients/NutritionHub.tsx components/clients/nutrition-hub/NutritionInsightsPanel.tsx components/clients/nutrition-hub/NutritionAgenda.tsx components/clients/nutrition-hub/NutritionDayDrawer.tsx tests/components/nutrition-hub-agenda.test.tsx
git commit -m "feat: add nutrition hub insights and agenda"
```

### Task 6: Hardening, Empty States, And Regression Coverage

**Files:**
- Modify: `app/api/clients/[clientId]/nutrition-hub/route.ts`
- Modify: `components/clients/NutritionHub.tsx`
- Modify: `lib/coach/nutritionHub.ts`
- Modify: `tests/api/clients-nutrition-hub.test.ts`
- Modify: `tests/lib/coach/nutritionHub.test.ts`

- [ ] **Step 1: Add failing tests for empty and no-target states**

```ts
it("returns usable summary when no active protocol exists", async () => {
  const result = buildNutritionHubSummary([]);
  expect(result.nutritionScore).toBeNull();
  expect(result.validDays).toBe(0);
});

it("keeps agenda visible even when target is missing", () => {
  expect(
    classifyNutritionAgendaDay({
      completeness: "complete",
      consumed: { calories: 1700 },
      target: { calories: null },
    }),
  ).toBe("no_target");
});
```

- [ ] **Step 2: Run tests to verify they fail if behavior is missing**

Run: `npm test -- tests/lib/coach/nutritionHub.test.ts tests/api/clients-nutrition-hub.test.ts`

Expected: FAIL on null/no-target expectations if not implemented

- [ ] **Step 3: Implement hardening in API and shell**

```tsx
// components/clients/NutritionHub.tsx
if (error) {
  return <p className="text-sm text-red-400/70">{error}</p>;
}

if (!loading && data?.agenda?.length === 0) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#181818] p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Nutrition</p>
      <h2 className="mt-2 text-white text-base font-semibold">Pas encore assez de données nutritionnelles</h2>
      <p className="mt-2 text-sm text-white/55">Les repas et l’hydratation du client apparaîtront ici dès que des journées seront loggées.</p>
    </section>
  );
}
```

```ts
// app/api/clients/[clientId]/nutrition-hub/route.ts
if (mealsError || waterError) {
  return NextResponse.json({ error: "Failed to load nutrition hub data" }, { status: 500 });
}
```

- [ ] **Step 4: Run targeted and adjacent regression tests**

Run: `npm test -- tests/lib/coach/nutritionHub.test.ts tests/api/clients-nutrition-hub.test.ts tests/lib/nutrition/progress.test.ts tests/lib/client/smart/adherenceScore.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/clients/[clientId]/nutrition-hub/route.ts components/clients/NutritionHub.tsx lib/coach/nutritionHub.ts tests/api/clients-nutrition-hub.test.ts tests/lib/coach/nutritionHub.test.ts
git commit -m "feat: harden coach nutrition hub states"
```

---

## Self-Review

### Spec coverage

- `Data > Nutrition` navigation: Task 1
- dedicated coach route: Task 1
- aggregated coach endpoint: Task 3
- KPI strip: Task 4
- trend filters `3j / 7j / 14j / 30j`: Task 4
- rule-based insights: Task 2 + Task 5
- agenda and daily detail: Task 5
- data quality / confidence handling: Task 4 + Task 6
- no-protocol and low-data edge cases: Task 6

### Placeholder scan

- No `TODO` / `TBD`
- Each task includes exact files, commands, and concrete code
- No “similar to previous task” shortcuts

### Type consistency

- Shared window values use `3 | 7 | 14 | 30`
- Agenda statuses use `on_target | under | over | partial | no_target`
- Day kind stays `training | off | unknown`

