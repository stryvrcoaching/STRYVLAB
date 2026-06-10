# Metrics Tab Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `/client/metrics` into a 3-tab PWA page (Données corporelles / Mensurations / Vitalité) with expand-inline charts, a body silhouette SVG navigator, and vitality trends from daily check-ins.

**Architecture:** Single `MetricsClientPage` client component fetches both APIs on mount via `Promise.all`, switches tabs client-side with zero re-fetch. Generic `MetricCard` component handles expand-inline state locally. `BodySilhouette` SVG is purely presentational — all data comes from props.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS (DS v4.0 tokens), SVG (no external chart lib — pure SVG inline), Supabase service role for server-side auth bypass.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `app/api/client/body-data/route.ts` | Add `bodyFatSeries`, `leanMassSeries`, `measuresByBilan`, `annotations` |
| Create | `app/api/client/vitality/route.ts` | Fetch check-ins, compute vitality score + trend |
| Create | `components/client/metrics/MetricCard.tsx` | Generic card: value + sparkline + expand-inline |
| Create | `components/client/metrics/MetricExpandedChart.tsx` | Full SVG chart with bilan markers + annotations |
| Create | `components/client/metrics/BodyDataTab.tsx` | 3 MetricCards (weight, body fat, lean mass) |
| Create | `components/client/metrics/BodySilhouette.tsx` | SVG body outline + bilan date nav + annotation lines |
| Create | `components/client/metrics/MesurationsTab.tsx` | BodySilhouette + 4 measurement MetricCards |
| Create | `components/client/metrics/VitalityScoreHero.tsx` | Aggregated score card with progress bar |
| Create | `components/client/metrics/VitalityTab.tsx` | Hero score + 4 vitality MetricCards |
| Modify | `components/client/MetricsClientPage.tsx` | Tab bar + Promise.all fetch + wire all tabs |
| Modify | `app/client/metrics/page.tsx` | Pass props to MetricsClientPage (minor) |

---

## Task 1 — Extend `/api/client/body-data`

**Files:**
- Modify: `app/api/client/body-data/route.ts`

- [ ] **Replace the route with extended version:**

```typescript
// app/api/client/body-data/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface BilanMeasures {
  bilanIndex: number
  date: string
  waist_cm:  number | null
  hips_cm:   number | null
  arm_cm:    number | null
  chest_cm:  number | null
}

export interface BodyDataResponse {
  // existing
  weightSeries:   { date: string; value: number; bilanIndex: number }[]
  bodyFatSeries:  { date: string; value: number; bilanIndex: number }[]
  leanMassSeries: { date: string; value: number; bilanIndex: number }[]
  composition:    { body_fat_pct: number | null; lean_mass_kg: number | null; muscle_mass_kg: number | null }
  measures:       { waist_cm: number | null; hips_cm: number | null; arm_cm: number | null; chest_cm: number | null }
  latestWeight:   number | null
  measuresByBilan: BilanMeasures[]
  annotations:    { date: string; label: string }[]
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = svc()
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const clientId = (client as any).id as string

  const [submissionsRes, annotationsRes] = await Promise.all([
    service
      .from('assessment_submissions')
      .select('id, bilan_date, submitted_at, assessment_responses(field_key, value_number)')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .order('bilan_date', { ascending: true })
      .limit(20),
    service
      .from('metric_annotations')
      .select('annotation_date, label')
      .eq('client_id', clientId)
      .not('label', 'is', null)
      .neq('event_type', 'injury')
      .order('annotation_date', { ascending: true }),
  ])

  const empty: BodyDataResponse = {
    weightSeries: [], bodyFatSeries: [], leanMassSeries: [],
    composition: { body_fat_pct: null, lean_mass_kg: null, muscle_mass_kg: null },
    measures: { waist_cm: null, hips_cm: null, arm_cm: null, chest_cm: null },
    latestWeight: null, measuresByBilan: [], annotations: [],
  }

  const submissions = submissionsRes.data
  if (!submissions || submissions.length === 0) {
    return NextResponse.json(empty)
  }

  const weightSeries:   { date: string; value: number; bilanIndex: number }[] = []
  const bodyFatSeries:  { date: string; value: number; bilanIndex: number }[] = []
  const leanMassSeries: { date: string; value: number; bilanIndex: number }[] = []
  const measuresByBilan: BilanMeasures[] = []
  const latestValues: Record<string, number> = {}

  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i] as any
    const bilanIndex = i + 1
    const date = sub.bilan_date ?? sub.submitted_at?.split('T')[0] ?? ''
    const responses = sub.assessment_responses as { field_key: string; value_number: number | null }[]
    if (!responses) continue

    const bilanValues: Record<string, number> = {}
    for (const r of responses) {
      if (r.value_number == null) continue
      bilanValues[r.field_key] = r.value_number
      latestValues[r.field_key] = r.value_number
    }

    if (bilanValues['weight_kg'] != null)
      weightSeries.push({ date, value: bilanValues['weight_kg'], bilanIndex })
    if (bilanValues['body_fat_pct'] != null)
      bodyFatSeries.push({ date, value: bilanValues['body_fat_pct'], bilanIndex })
    if (bilanValues['lean_mass_kg'] != null)
      leanMassSeries.push({ date, value: bilanValues['lean_mass_kg'], bilanIndex })

    measuresByBilan.push({
      bilanIndex,
      date,
      waist_cm: bilanValues['waist_cm'] ?? null,
      hips_cm:  bilanValues['hips_cm']  ?? null,
      arm_cm:   bilanValues['arm_cm']   ?? null,
      chest_cm: bilanValues['chest_cm'] ?? null,
    })
  }

  const annotations = (annotationsRes.data ?? []).map((a: any) => ({
    date: a.annotation_date,
    label: a.label,
  }))

  return NextResponse.json({
    weightSeries,
    bodyFatSeries,
    leanMassSeries,
    composition: {
      body_fat_pct:   latestValues['body_fat_pct']   ?? null,
      lean_mass_kg:   latestValues['lean_mass_kg']   ?? null,
      muscle_mass_kg: latestValues['muscle_mass_kg'] ?? null,
    },
    measures: {
      waist_cm: latestValues['waist_cm'] ?? null,
      hips_cm:  latestValues['hips_cm']  ?? null,
      arm_cm:   latestValues['arm_cm']   ?? null,
      chest_cm: latestValues['chest_cm'] ?? null,
    },
    latestWeight: weightSeries.length > 0 ? weightSeries[weightSeries.length - 1].value : null,
    measuresByBilan,
    annotations,
  } satisfies BodyDataResponse)
}
```

- [ ] **Run TSC — 0 errors:**
```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**
```bash
git add app/api/client/body-data/route.ts
git commit -m "feat(metrics): extend body-data API with bilan series, measuresByBilan, annotations"
```

---

## Task 2 — Create `/api/client/vitality`

**Files:**
- Create: `app/api/client/vitality/route.ts`

**Vitality score formula** (each metric normalised 0–1 before weighting):
- `energy_level` (1–5): `(v-1)/4` → weight +1.5
- `sleep_quality` (1–4): `(v-1)/3` → weight +1.5
- `stress_level` (1–5): `1-(v-1)/4` → weight +1.0 (inverted — high stress = bad)
- `muscle_soreness` (1–4): `1-(v-1)/3` → weight +0.5 (inverted)
- Total weight divisor: 4.5 → score = weighted_sum / 4.5 × 100, clamped 0–100

- [ ] **Create the route:**

```typescript
// app/api/client/vitality/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface VitalityTrendPoint {
  date: string
  energy:   number | null
  sleep:    number | null
  stress:   number | null
  soreness: number | null
}

export interface VitalityResponse {
  score:         number | null
  checkinCount:  number
  trend:         VitalityTrendPoint[]
}

export function computeVitalityScore(
  energy: number | null,
  sleep: number | null,
  stress: number | null,
  soreness: number | null,
): number | null {
  if (energy == null && sleep == null && stress == null) return null
  let weighted = 0
  let divisor = 0

  if (energy != null) {
    weighted += ((energy - 1) / 4) * 1.5
    divisor  += 1.5
  }
  if (sleep != null) {
    weighted += ((sleep - 1) / 3) * 1.5
    divisor  += 1.5
  }
  if (stress != null) {
    weighted += (1 - (stress - 1) / 4) * 1.0
    divisor  += 1.0
  }
  if (soreness != null) {
    weighted += (1 - (soreness - 1) / 3) * 0.5
    divisor  += 0.5
  }

  if (divisor === 0) return null
  return Math.round(Math.min(100, Math.max(0, (weighted / divisor) * 100)))
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = svc()
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().split('T')[0]

  const { data: rows } = await service
    .from('client_daily_checkins')
    .select('date, energy_level, sleep_quality, stress_level, muscle_soreness')
    .eq('client_id', (client as any).id)
    .gte('date', sinceStr)
    .order('date', { ascending: true })

  if (!rows || rows.length === 0) {
    return NextResponse.json({ score: null, checkinCount: 0, trend: [] } satisfies VitalityResponse)
  }

  // Merge morning + evening for same date — take best available values
  const byDate = new Map<string, VitalityTrendPoint>()
  for (const r of rows as any[]) {
    const key = r.date as string
    const existing = byDate.get(key)
    byDate.set(key, {
      date:     key,
      energy:   r.energy_level   ?? existing?.energy   ?? null,
      sleep:    r.sleep_quality  ?? existing?.sleep    ?? null,
      stress:   r.stress_level   ?? existing?.stress   ?? null,
      soreness: r.muscle_soreness ?? existing?.soreness ?? null,
    })
  }

  const trend = Array.from(byDate.values())

  // Overall score = average of per-day scores (last 7 days with data)
  const recent = trend.slice(-7)
  const scores = recent
    .map(d => computeVitalityScore(d.energy, d.sleep, d.stress, d.soreness))
    .filter((s): s is number => s != null)
  const score = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null

  return NextResponse.json({
    score,
    checkinCount: trend.length,
    trend,
  } satisfies VitalityResponse)
}
```

- [ ] **Run TSC — 0 errors:**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**
```bash
git add app/api/client/vitality/route.ts
git commit -m "feat(metrics): add /api/client/vitality route with score formula"
```

---

## Task 3 — Create `MetricCard` + `MetricExpandedChart`

**Files:**
- Create: `components/client/metrics/MetricCard.tsx`
- Create: `components/client/metrics/MetricExpandedChart.tsx`

- [ ] **Create `MetricExpandedChart.tsx`:**

```typescript
// components/client/metrics/MetricExpandedChart.tsx
'use client'

interface DataPoint {
  date: string
  value: number
  bilanIndex?: number
}

interface Annotation {
  date: string
  label: string
}

interface Props {
  series: DataPoint[]
  annotations?: Annotation[]
  unit: string
}

function formatDate(d: string): string {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function MetricExpandedChart({ series, annotations = [], unit }: Props) {
  if (series.length === 0) return null

  const W = 280
  const H = 110
  const PAD_X = 16
  const PAD_Y = 12

  const values = series.map(p => p.value)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const range = maxV - minV || 1

  function toX(i: number) {
    return PAD_X + (i / Math.max(series.length - 1, 1)) * (W - PAD_X * 2)
  }
  function toY(v: number) {
    return PAD_Y + (1 - (v - minV) / range) * (H - PAD_Y * 2)
  }

  const polylinePoints = series.map((p, i) => `${toX(i)},${toY(p.value)}`).join(' ')

  const minV2 = Math.min(...values)
  const maxV2 = Math.max(...values)
  const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10

  // annotation lines: find series points close in date
  const annotationLines = annotations.map(ann => {
    const idx = series.findIndex(p => p.date >= ann.date)
    if (idx < 0) return null
    return { x: toX(idx), label: ann.label }
  }).filter(Boolean) as { x: number; label: string }[]

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 110 }} preserveAspectRatio="none">
        {/* annotation vertical lines */}
        {annotationLines.map((a, i) => (
          <g key={i}>
            <line
              x1={a.x} y1={4} x2={a.x} y2={H - 4}
              stroke="rgba(255,255,255,0.2)" strokeWidth="1"
              strokeDasharray="3,3"
            />
            <text x={a.x + 3} y={10} fontSize="6" fill="rgba(255,255,255,0.3)">{a.label}</text>
          </g>
        ))}

        {/* main polyline */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="rgba(242,242,242,0.6)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* bilan dots + labels */}
        {series.map((p, i) => {
          const x = toX(i)
          const y = toY(p.value)
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="#f2f2f2" />
              {p.bilanIndex != null && (
                <text
                  x={x} y={H - 2} textAnchor="middle"
                  fontSize="7" fill="rgba(255,255,255,0.3)"
                >
                  B{p.bilanIndex}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* min / avg / max */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          { label: 'MIN', value: `${minV2}${unit}` },
          { label: 'MOY', value: `${avg}${unit}` },
          { label: 'MAX', value: `${maxV2}${unit}` },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a]">{label}</p>
            <p className="text-[11px] font-bold text-[#a0a0a0]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Create `MetricCard.tsx`:**

```typescript
// components/client/metrics/MetricCard.tsx
'use client'

import { useState } from 'react'
import MetricExpandedChart from './MetricExpandedChart'

interface DataPoint {
  date: string
  value: number
  bilanIndex?: number
}

interface Annotation {
  date: string
  label: string
}

interface Props {
  label: string
  value: string
  delta?: string
  deltaGood?: boolean   // true = neutral color, false = red
  series: DataPoint[]
  unit: string
  annotations?: Annotation[]
}

function Sparkline({ series, good }: { series: DataPoint[]; good: boolean }) {
  if (series.length < 2) return null
  const values = series.map(p => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 200; const H = 40
  const pts = series.map((p, i) => {
    const x = (i / (series.length - 1)) * W
    const y = H - ((p.value - min) / range) * (H - 6) - 3
    return `${x},${y}`
  }).join(' ')
  const color = good ? 'rgba(242,242,242,0.5)' : 'rgba(239,68,68,0.5)'
  const last = series[series.length - 1]
  const lx = W
  const ly = H - ((last.value - min) / range) * (H - 6) - 3
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  )
}

export default function MetricCard({ label, value, delta, deltaGood = true, series, unit, annotations }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className="w-full text-left bg-[#161616] rounded-2xl p-4 space-y-2 transition-all duration-300 active:opacity-80"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a]">
          {label}
        </span>
        <div className="text-right">
          <span className="text-[20px] font-black text-[#f2f2f2] leading-none">{value}</span>
          {delta && (
            <p className={`text-[10px] font-medium mt-0.5 ${deltaGood ? 'text-[#a0a0a0]' : 'text-red-400'}`}>
              {delta}
            </p>
          )}
        </div>
      </div>

      {!expanded && <Sparkline series={series} good={deltaGood} />}

      {expanded && (
        <MetricExpandedChart series={series} annotations={annotations} unit={unit} />
      )}
    </button>
  )
}
```

- [ ] **Run TSC — 0 errors:**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**
```bash
git add components/client/metrics/MetricCard.tsx components/client/metrics/MetricExpandedChart.tsx
git commit -m "feat(metrics): add MetricCard with expand-inline chart + MetricExpandedChart SVG"
```

---

## Task 4 — Create `BodyDataTab`

**Files:**
- Create: `components/client/metrics/BodyDataTab.tsx`

- [ ] **Create `BodyDataTab.tsx`:**

```typescript
// components/client/metrics/BodyDataTab.tsx
'use client'

import MetricCard from './MetricCard'
import type { BodyDataResponse } from '@/app/api/client/body-data/route'

interface Props {
  data: BodyDataResponse
}

function formatDelta(series: { value: number }[], unit: string): { delta: string; deltaGood: boolean } | undefined {
  if (series.length < 2) return undefined
  const diff = series[series.length - 1].value - series[0].value
  const sign = diff > 0 ? '+' : ''
  // For body metrics: weight/fat loss = good (negative diff), lean mass gain = good (positive diff)
  return { delta: `${sign}${diff.toFixed(1)}${unit}`, deltaGood: diff <= 0 }
}

function formatLeanDelta(series: { value: number }[]): { delta: string; deltaGood: boolean } | undefined {
  if (series.length < 2) return undefined
  const diff = series[series.length - 1].value - series[0].value
  const sign = diff >= 0 ? '+' : ''
  // For lean mass: gain = good (positive diff)
  return { delta: `${sign}${diff.toFixed(1)} kg`, deltaGood: diff >= 0 }
}

export default function BodyDataTab({ data }: Props) {
  const hasAny = data.weightSeries.length > 0 || data.bodyFatSeries.length > 0 || data.leanMassSeries.length > 0

  if (!hasAny) {
    return (
      <p className="text-[12px] text-[#5a5a5a] leading-relaxed py-4 text-center">
        Aucune donnée corporelle enregistrée.{'\n'}Votre coach doit compléter un bilan.
      </p>
    )
  }

  const weightDelta = formatDelta(data.weightSeries, ' kg')
  const fatDelta    = formatDelta(data.bodyFatSeries, '%')
  const leanDelta   = formatLeanDelta(data.leanMassSeries)

  const latest = data.weightSeries[data.weightSeries.length - 1]
  const latestFat  = data.bodyFatSeries[data.bodyFatSeries.length - 1]
  const latestLean = data.leanMassSeries[data.leanMassSeries.length - 1]

  return (
    <div className="space-y-3">
      {latest && (
        <MetricCard
          label="Poids"
          value={`${latest.value} kg`}
          series={data.weightSeries}
          unit=" kg"
          annotations={data.annotations}
          {...(weightDelta ?? {})}
        />
      )}
      {latestFat && (
        <MetricCard
          label="Masse grasse"
          value={`${latestFat.value.toFixed(1)}%`}
          series={data.bodyFatSeries}
          unit="%"
          annotations={data.annotations}
          {...(fatDelta ?? {})}
        />
      )}
      {latestLean && (
        <MetricCard
          label="Masse maigre"
          value={`${latestLean.value.toFixed(1)} kg`}
          series={data.leanMassSeries}
          unit=" kg"
          annotations={data.annotations}
          {...(leanDelta ?? {})}
        />
      )}
    </div>
  )
}
```

- [ ] **Run TSC — 0 errors:**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**
```bash
git add components/client/metrics/BodyDataTab.tsx
git commit -m "feat(metrics): add BodyDataTab with 3 metric cards"
```

---

## Task 5 — Create `BodySilhouette`

**Files:**
- Create: `components/client/metrics/BodySilhouette.tsx`

The SVG uses `viewBox="0 0 280 460"`. Body centered at x=140. Left annotation area x=0–70, body x=80–200, right annotation area x=210–280.

Measurement anchor points (in viewBox coordinates):
- Chest: y=130, left body edge x=80, right x=200
- Waist: y=195, left edge x=96, right x=184
- Hips: y=240, left edge x=83, right x=197
- Arm (left only): y=158, left arm outer edge x=44

- [ ] **Create `BodySilhouette.tsx`:**

```typescript
// components/client/metrics/BodySilhouette.tsx
'use client'

import { useState } from 'react'
import type { BilanMeasures } from '@/app/api/client/body-data/route'

interface Props {
  bilanList: BilanMeasures[]
}

const FILL   = 'rgba(255,255,255,0.05)'
const STROKE = 'rgba(255,255,255,0.16)'
const LINE   = 'rgba(255,255,255,0.18)'
const TEXT   = '#a0a0a0'
const DELTA  = '#5a5a5a'

// Measurement anchor coords in viewBox "0 0 280 460"
const ANCHORS = {
  chest_cm:  { y: 130, lx: 80, rx: 200 },
  waist_cm:  { y: 195, lx: 96, rx: 184 },
  hips_cm:   { y: 240, lx: 83, rx: 197 },
  arm_cm:    { y: 158, lx: 44, rx: null },  // left arm only
}

function formatVal(v: number | null): string {
  return v != null ? `${v}` : '—'
}

function formatDelta(cur: number | null, prev: number | null): { text: string; color: string } | null {
  if (cur == null || prev == null) return null
  const diff = cur - prev
  if (diff === 0) return null
  const sign = diff > 0 ? '+' : ''
  const color = diff < 0 ? '#6aab8e' : '#ef4444'
  return { text: `${sign}${diff}cm`, color }
}

export default function BodySilhouette({ bilanList }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(bilanList.length - 1)

  if (bilanList.length === 0) return null

  const selected = bilanList[selectedIdx]
  const prev = selectedIdx > 0 ? bilanList[selectedIdx - 1] : null

  return (
    <div className="space-y-3">
      {/* Bilan selector — hidden if only 1 bilan */}
      {bilanList.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {bilanList.map((b, i) => {
            const active = i === selectedIdx
            const dt = new Date(b.date + 'T00:00:00')
            const label = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            return (
              <button
                key={b.bilanIndex}
                onClick={() => setSelectedIdx(i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] transition-colors ${
                  active
                    ? 'bg-[#f2f2f2] text-[#080808]'
                    : 'bg-white/[0.06] text-[#5a5a5a]'
                }`}
              >
                B{b.bilanIndex} · {label}
              </button>
            )
          })}
        </div>
      )}

      {/* SVG body + annotations */}
      <svg
        viewBox="0 0 280 460"
        className="w-full max-w-[220px] mx-auto"
        style={{ height: 'auto' }}
        aria-label="Silhouette corporelle avec mensurations"
      >
        {/* ── Body silhouette outline ── */}
        {/* Head */}
        <ellipse cx="140" cy="32" rx="26" ry="30" fill={FILL} stroke={STROKE} strokeWidth="1.2" />
        {/* Neck */}
        <path d="M 126,60 L 126,76 Q 140,80 154,76 L 154,60" fill={FILL} stroke={STROKE} strokeWidth="1.2" />

        {/* Full body outline: shoulders → arms → reconnect torso → hips → legs → feet */}
        <path
          d={`
            M 126,76
            C 100,80 76,90 60,102
            C 44,114 38,132 38,154
            C 38,170 40,186 44,200
            C 46,210 48,220 50,228
            L 58,222
            C 68,216 80,212 92,210
            C 88,224 84,238 82,252
            C 80,268 80,285 82,305
            C 83,323 84,340 84,358
            C 84,373 84,386 85,398
            C 85,412 84,426 84,440
            L 78,446 L 72,450
            L 108,452 L 110,446
            L 134,446
            L 146,446
            L 170,446 L 172,452
            L 208,450 L 202,446
            C 196,426 196,412 196,398
            C 196,386 196,373 196,358
            C 196,340 197,323 198,305
            C 200,285 200,268 198,252
            C 196,238 192,224 188,210
            C 200,212 212,216 222,222
            L 230,228
            C 232,220 234,210 236,200
            C 240,186 242,170 242,154
            C 242,132 236,114 220,102
            C 204,90 180,80 154,76
            Z
          `}
          fill={FILL}
          stroke={STROKE}
          strokeWidth="1.2"
        />

        {/* ── Measurement annotation lines ── */}

        {/* Chest (both sides) */}
        <line x1={ANCHORS.chest_cm.lx} y1={ANCHORS.chest_cm.y} x2="8" y2={ANCHORS.chest_cm.y}
          stroke={LINE} strokeWidth="0.8" strokeDasharray="3,3" />
        <line x1={ANCHORS.chest_cm.rx} y1={ANCHORS.chest_cm.y} x2="272" y2={ANCHORS.chest_cm.y}
          stroke={LINE} strokeWidth="0.8" strokeDasharray="3,3" />
        <text x="6" y={ANCHORS.chest_cm.y - 3} textAnchor="end" fontSize="9" fill={TEXT} fontFamily="Barlow Condensed, sans-serif" fontWeight="700">
          {formatVal(selected.chest_cm)}
        </text>
        <text x="6" y={ANCHORS.chest_cm.y + 8} textAnchor="end" fontSize="7" fill={TEXT} fontFamily="sans-serif">
          cm
        </text>
        {formatDelta(selected.chest_cm, prev?.chest_cm) && (
          <text x="6" y={ANCHORS.chest_cm.y + 18} textAnchor="end" fontSize="7" fill={formatDelta(selected.chest_cm, prev?.chest_cm)!.color}>
            {formatDelta(selected.chest_cm, prev?.chest_cm)!.text}
          </text>
        )}
        <text x="274" y={ANCHORS.chest_cm.y - 3} textAnchor="start" fontSize="8" fill={DELTA} fontFamily="sans-serif">
          Poitrine
        </text>

        {/* Waist (both sides) */}
        <line x1={ANCHORS.waist_cm.lx} y1={ANCHORS.waist_cm.y} x2="8" y2={ANCHORS.waist_cm.y}
          stroke={LINE} strokeWidth="0.8" strokeDasharray="3,3" />
        <line x1={ANCHORS.waist_cm.rx} y1={ANCHORS.waist_cm.y} x2="272" y2={ANCHORS.waist_cm.y}
          stroke={LINE} strokeWidth="0.8" strokeDasharray="3,3" />
        <text x="6" y={ANCHORS.waist_cm.y - 3} textAnchor="end" fontSize="9" fill={TEXT} fontFamily="Barlow Condensed, sans-serif" fontWeight="700">
          {formatVal(selected.waist_cm)}
        </text>
        <text x="6" y={ANCHORS.waist_cm.y + 8} textAnchor="end" fontSize="7" fill={TEXT} fontFamily="sans-serif">
          cm
        </text>
        {formatDelta(selected.waist_cm, prev?.waist_cm) && (
          <text x="6" y={ANCHORS.waist_cm.y + 18} textAnchor="end" fontSize="7" fill={formatDelta(selected.waist_cm, prev?.waist_cm)!.color}>
            {formatDelta(selected.waist_cm, prev?.waist_cm)!.text}
          </text>
        )}
        <text x="274" y={ANCHORS.waist_cm.y - 3} textAnchor="start" fontSize="8" fill={DELTA} fontFamily="sans-serif">
          Taille
        </text>

        {/* Hips (both sides) */}
        <line x1={ANCHORS.hips_cm.lx} y1={ANCHORS.hips_cm.y} x2="8" y2={ANCHORS.hips_cm.y}
          stroke={LINE} strokeWidth="0.8" strokeDasharray="3,3" />
        <line x1={ANCHORS.hips_cm.rx} y1={ANCHORS.hips_cm.y} x2="272" y2={ANCHORS.hips_cm.y}
          stroke={LINE} strokeWidth="0.8" strokeDasharray="3,3" />
        <text x="6" y={ANCHORS.hips_cm.y - 3} textAnchor="end" fontSize="9" fill={TEXT} fontFamily="Barlow Condensed, sans-serif" fontWeight="700">
          {formatVal(selected.hips_cm)}
        </text>
        <text x="6" y={ANCHORS.hips_cm.y + 8} textAnchor="end" fontSize="7" fill={TEXT} fontFamily="sans-serif">
          cm
        </text>
        {formatDelta(selected.hips_cm, prev?.hips_cm) && (
          <text x="6" y={ANCHORS.hips_cm.y + 18} textAnchor="end" fontSize="7" fill={formatDelta(selected.hips_cm, prev?.hips_cm)!.color}>
            {formatDelta(selected.hips_cm, prev?.hips_cm)!.text}
          </text>
        )}
        <text x="274" y={ANCHORS.hips_cm.y - 3} textAnchor="start" fontSize="8" fill={DELTA} fontFamily="sans-serif">
          Hanches
        </text>

        {/* Arm (left side only) */}
        <line x1={ANCHORS.arm_cm.lx} y1={ANCHORS.arm_cm.y} x2="8" y2={ANCHORS.arm_cm.y}
          stroke={LINE} strokeWidth="0.8" strokeDasharray="3,3" />
        <text x="6" y={ANCHORS.arm_cm.y - 3} textAnchor="end" fontSize="9" fill={TEXT} fontFamily="Barlow Condensed, sans-serif" fontWeight="700">
          {formatVal(selected.arm_cm)}
        </text>
        <text x="6" y={ANCHORS.arm_cm.y + 8} textAnchor="end" fontSize="7" fill={TEXT} fontFamily="sans-serif">
          cm
        </text>
        {formatDelta(selected.arm_cm, prev?.arm_cm) && (
          <text x="6" y={ANCHORS.arm_cm.y + 18} textAnchor="end" fontSize="7" fill={formatDelta(selected.arm_cm, prev?.arm_cm)!.color}>
            {formatDelta(selected.arm_cm, prev?.arm_cm)!.text}
          </text>
        )}
        <text x="274" y={ANCHORS.arm_cm.y - 3} textAnchor="start" fontSize="8" fill={DELTA} fontFamily="sans-serif">
          Bras
        </text>
      </svg>
    </div>
  )
}
```

- [ ] **Run TSC — 0 errors:**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**
```bash
git add components/client/metrics/BodySilhouette.tsx
git commit -m "feat(metrics): add BodySilhouette SVG with bilan navigator and measurement annotations"
```

---

## Task 6 — Create `MesurationsTab`

**Files:**
- Create: `components/client/metrics/MesurationsTab.tsx`

- [ ] **Create `MesurationsTab.tsx`:**

```typescript
// components/client/metrics/MesurationsTab.tsx
'use client'

import BodySilhouette from './BodySilhouette'
import MetricCard from './MetricCard'
import type { BodyDataResponse } from '@/app/api/client/body-data/route'

interface Props {
  data: BodyDataResponse
}

const MEASURE_CONFIG = [
  { key: 'waist_cm' as const, label: 'Tour de taille', unit: ' cm' },
  { key: 'hips_cm'  as const, label: 'Hanches',        unit: ' cm' },
  { key: 'arm_cm'   as const, label: 'Bras',           unit: ' cm' },
  { key: 'chest_cm' as const, label: 'Poitrine',       unit: ' cm' },
]

function buildMeasureSeries(measuresByBilan: BodyDataResponse['measuresByBilan'], key: keyof BodyDataResponse['measures']) {
  return measuresByBilan
    .filter(b => b[key] != null)
    .map(b => ({ date: b.date, value: b[key] as number, bilanIndex: b.bilanIndex }))
}

function measureDelta(series: { value: number }[]): { delta: string; deltaGood: boolean } | undefined {
  if (series.length < 2) return undefined
  const diff = series[series.length - 1].value - series[0].value
  const sign = diff > 0 ? '+' : ''
  return { delta: `${sign}${diff} cm`, deltaGood: diff <= 0 }
}

export default function MesurationsTab({ data }: Props) {
  const hasSilhouette = data.measuresByBilan.length > 0
  const hasCards = MEASURE_CONFIG.some(c => buildMeasureSeries(data.measuresByBilan, c.key).length > 0)

  if (!hasSilhouette && !hasCards) {
    return (
      <p className="text-[12px] text-[#5a5a5a] leading-relaxed py-4 text-center">
        Aucune mensuration enregistrée. Votre coach doit compléter un bilan.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {hasSilhouette && (
        <div>
          <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a] mb-3">
            Silhouette
          </p>
          <BodySilhouette bilanList={data.measuresByBilan} />
        </div>
      )}

      {hasCards && (
        <div className="space-y-3">
          <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a]">
            Évolution
          </p>
          {MEASURE_CONFIG.map(({ key, label, unit }) => {
            const series = buildMeasureSeries(data.measuresByBilan, key)
            if (series.length === 0) return null
            const latest = series[series.length - 1]
            const d = measureDelta(series)
            return (
              <MetricCard
                key={key}
                label={label}
                value={`${latest.value}${unit}`}
                series={series}
                unit={unit}
                {...(d ?? {})}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Run TSC — 0 errors:**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**
```bash
git add components/client/metrics/MesurationsTab.tsx
git commit -m "feat(metrics): add MesurationsTab with BodySilhouette + 4 measurement cards"
```

---

## Task 7 — Create `VitalityScoreHero` + `VitalityTab`

**Files:**
- Create: `components/client/metrics/VitalityScoreHero.tsx`
- Create: `components/client/metrics/VitalityTab.tsx`

- [ ] **Create `VitalityScoreHero.tsx`:**

```typescript
// components/client/metrics/VitalityScoreHero.tsx
'use client'

interface Props {
  score: number | null
  checkinCount: number
}

function scoreLabel(s: number): string {
  if (s >= 90) return 'Excellent'
  if (s >= 70) return 'Bonne forme'
  if (s >= 50) return 'Attention'
  return 'À surveiller'
}

export default function VitalityScoreHero({ score, checkinCount }: Props) {
  if (score == null || checkinCount === 0) {
    return (
      <div className="bg-[#161616] rounded-2xl p-4">
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a] mb-2">
          Score forme
        </p>
        <p className="text-[12px] text-[#5a5a5a]">
          Complétez vos check-ins quotidiens pour voir votre score de forme.
        </p>
      </div>
    )
  }

  const pct = score
  return (
    <div className="bg-[#161616] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#5a5a5a]">
          Score forme
        </p>
        <span className="text-[20px] font-black text-[#f2f2f2] leading-none">
          {score}
          <span className="text-[11px] font-medium text-[#5a5a5a] ml-1">/ 100</span>
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-[#222222] overflow-hidden">
        <div
          className="h-full bg-[#f2f2f2] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-[11px] text-[#a0a0a0]">
        {scoreLabel(score)} · {checkinCount} check-in{checkinCount > 1 ? 's' : ''} ce mois
      </p>
    </div>
  )
}
```

- [ ] **Create `VitalityTab.tsx`:**

```typescript
// components/client/metrics/VitalityTab.tsx
'use client'

import VitalityScoreHero from './VitalityScoreHero'
import MetricCard from './MetricCard'
import type { VitalityResponse } from '@/app/api/client/vitality/route'

interface Props {
  data: VitalityResponse
}

const VITALITY_CONFIG = [
  { key: 'energy'   as const, label: 'Énergie',      unit: '/ 5', positiveIsUp: true  },
  { key: 'sleep'    as const, label: 'Sommeil',       unit: '/ 4', positiveIsUp: true  },
  { key: 'stress'   as const, label: 'Stress',        unit: '/ 5', positiveIsUp: false },
  { key: 'soreness' as const, label: 'Courbatures',   unit: '/ 4', positiveIsUp: false },
]

type VitalKey = 'energy' | 'sleep' | 'stress' | 'soreness'

function buildVitalSeries(trend: VitalityResponse['trend'], key: VitalKey) {
  return trend
    .filter(d => d[key] != null)
    .map(d => ({ date: d.date, value: d[key] as number }))
}

function avg7(series: { value: number }[]): number | null {
  const recent = series.slice(-7)
  if (recent.length === 0) return null
  return Math.round((recent.reduce((a, b) => a + b.value, 0) / recent.length) * 10) / 10
}

function vitalDelta(series: { value: number }[], positiveIsUp: boolean): { delta: string; deltaGood: boolean } | undefined {
  const prev = avg7(series.slice(0, -7))
  const curr = avg7(series.slice(-7))
  if (prev == null || curr == null) return undefined
  const diff = curr - prev
  if (Math.abs(diff) < 0.1) return undefined
  const sign = diff > 0 ? '+' : ''
  const deltaGood = positiveIsUp ? diff > 0 : diff < 0
  return { delta: `${sign}${diff.toFixed(1)} pts`, deltaGood }
}

export default function VitalityTab({ data }: Props) {
  return (
    <div className="space-y-3">
      <VitalityScoreHero score={data.score} checkinCount={data.checkinCount} />

      {data.trend.length === 0 ? null : (
        <div className="space-y-3 pt-1">
          {VITALITY_CONFIG.map(({ key, label, unit, positiveIsUp }) => {
            const series = buildVitalSeries(data.trend, key)
            if (series.length === 0) return null
            const latestAvg = avg7(series)
            if (latestAvg == null) return null
            const d = vitalDelta(series, positiveIsUp)
            return (
              <MetricCard
                key={key}
                label={label}
                value={`${latestAvg} ${unit}`}
                series={series}
                unit={` ${unit}`}
                {...(d ?? {})}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Run TSC — 0 errors:**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**
```bash
git add components/client/metrics/VitalityScoreHero.tsx components/client/metrics/VitalityTab.tsx
git commit -m "feat(metrics): add VitalityScoreHero and VitalityTab"
```

---

## Task 8 — Refactor `MetricsClientPage` with tab bar + Promise.all

**Files:**
- Modify: `components/client/MetricsClientPage.tsx`

- [ ] **Replace `MetricsClientPage.tsx` entirely:**

```typescript
// components/client/MetricsClientPage.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gear } from '@phosphor-icons/react'
import BodyDataTab from './metrics/BodyDataTab'
import MesurationsTab from './metrics/MesurationsTab'
import VitalityTab from './metrics/VitalityTab'
import type { BodyDataResponse } from '@/app/api/client/body-data/route'
import type { VitalityResponse } from '@/app/api/client/vitality/route'

type Tab = 'corps' | 'mensurations' | 'vitalite'

const TABS: { id: Tab; label: string }[] = [
  { id: 'corps',        label: 'Données corporelles' },
  { id: 'mensurations', label: 'Mensurations' },
  { id: 'vitalite',     label: 'Vitalité' },
]

interface Props {
  clientName: string
  clientEmail: string
  avatarInitials: string
  avatarUrl?: string | null
  streak: number
}

export default function MetricsClientPage({ clientName, clientEmail, avatarInitials, avatarUrl, streak }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('corps')
  const [bodyData, setBodyData] = useState<BodyDataResponse | null>(null)
  const [vitalityData, setVitalityData] = useState<VitalityResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/client/body-data').then(r => r.ok ? r.json() : null),
      fetch('/api/client/vitality').then(r => r.ok ? r.json() : null),
    ]).then(([body, vitality]) => {
      setBodyData(body)
      setVitalityData(vitality)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col min-h-full bg-[#080808]">

      {/* TopBar */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 shrink-0">
        <div>
          <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">
            MON PROFIL
          </p>
          <p className="text-[13px] font-barlow font-semibold text-white">Métriques</p>
        </div>
        <button
          onClick={() => router.push('/client/profil')}
          className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40 active:bg-white/[0.08] transition-colors"
          aria-label="Paramètres"
        >
          <Gear size={16} />
        </button>
      </div>

      {/* Hero */}
      <div className="flex items-center gap-3 px-4 pb-4 shrink-0">
        <div className="w-12 h-12 rounded-full bg-[#111111] shrink-0 overflow-hidden flex items-center justify-center">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={clientName} className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <span className="text-[16px] font-barlow-condensed font-bold text-[#f2f2f2] uppercase">
              {avatarInitials}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-barlow font-semibold text-white truncate">{clientName}</p>
          <p className="text-[11px] text-white/40 truncate">{clientEmail}</p>
        </div>
        {streak > 0 && (
          <div className="px-2.5 py-1 bg-[#222222] rounded-full shrink-0">
            <span className="text-[11px] font-barlow-condensed font-bold text-[#f2f2f2]">
              🔥 {streak}j
            </span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] transition-colors ${
              tab === t.id
                ? 'bg-[#f2f2f2] text-[#080808]'
                : 'bg-white/[0.06] text-[#5a5a5a]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-24">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-white/[0.04] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {tab === 'corps' && bodyData && <BodyDataTab data={bodyData} />}
            {tab === 'mensurations' && bodyData && <MesurationsTab data={bodyData} />}
            {tab === 'vitalite' && vitalityData && <VitalityTab data={vitalityData} />}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Update `app/client/metrics/page.tsx`** to import `MetricsClientPage` (rename guard):

```typescript
// app/client/metrics/page.tsx
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import MetricsClientPage from "@/components/client/MetricsClientPage"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function MetricsRoute() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const db = service()
  const cc = await resolveClientFromUser(
    user.id, user.email, db,
    'id, first_name, last_name, email, profile_photo_url'
  )
  if (!cc) return null

  const firstName = (cc as any).first_name ?? ""
  const lastName  = (cc as any).last_name  ?? ""
  const initials  = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?"

  const { data: streakRow } = await db
    .from('client_streaks')
    .select('current_streak')
    .eq('client_id', cc.id)
    .maybeSingle()

  return (
    <MetricsClientPage
      clientName={`${firstName} ${lastName}`.trim()}
      clientEmail={(cc as any).email ?? user.email ?? ""}
      avatarInitials={initials}
      avatarUrl={(cc as any).profile_photo_url ?? null}
      streak={(streakRow as any)?.current_streak ?? 0}
    />
  )
}
```

- [ ] **Run TSC — 0 errors:**
```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Commit:**
```bash
git add components/client/MetricsClientPage.tsx app/client/metrics/page.tsx
git commit -m "feat(metrics): refactor MetricsClientPage with 3-tab nav and Promise.all data fetch"
```

---

## Task 9 — CHANGELOG + project-state + final TSC

- [ ] **Update `CHANGELOG.md`** — add at top under today's date:

```
## 2026-05-21

FEATURE: Metrics page refactored with 3-tab navigation (Données corporelles / Mensurations / Vitalité)
FEATURE: MetricCard component with expand-inline chart, bilan markers, coach annotations
FEATURE: BodySilhouette SVG with bilan date navigator and measurement annotation lines
FEATURE: VitalityTab with aggregated wellness score from client_daily_checkins
FEATURE: /api/client/vitality route (score formula: energy × 1.5, sleep × 1.5, −stress, −soreness × 0.5)
FEATURE: /api/client/body-data extended with bodyFatSeries, leanMassSeries, measuresByBilan, annotations
```

- [ ] **Update `.claude/rules/project-state.md`** — add to "Dernières Avancées":

```markdown
### 2026-05-21 — Metrics Tab Navigation — 3-tab client PWA

- `app/api/client/body-data/route.ts` — extended: `bodyFatSeries`, `leanMassSeries`, `measuresByBilan[]`, `annotations[]`
- `app/api/client/vitality/route.ts` — new route: score agrégé check-ins, trend 30j (energy/sleep/stress/soreness)
- `components/client/metrics/MetricCard.tsx` — generic card: value + sparkline + expand-inline SVG chart + bilan markers + coach annotations
- `components/client/metrics/MetricExpandedChart.tsx` — full SVG chart, MIN/MOY/MAX stats
- `components/client/metrics/BodyDataTab.tsx` — 3 cards: poids, masse grasse, masse maigre
- `components/client/metrics/BodySilhouette.tsx` — SVG front view + bilan pills navigator + dashed annotation lines (chest/waist/hips/arm) + deltas
- `components/client/metrics/MesurationsTab.tsx` — silhouette + 4 measurement cards
- `components/client/metrics/VitalityScoreHero.tsx` — score bar 0-100 + label (Excellent/Bonne forme/Attention/À surveiller)
- `components/client/metrics/VitalityTab.tsx` — hero + 4 vitality cards (7j avg vs previous 7j)
- `components/client/MetricsClientPage.tsx` — full refactor: tab bar + Promise.all fetch + tab routing
- Score formula: `(energy_norm×1.5 + sleep_norm×1.5 + stress_inv×1 + soreness_inv×0.5) / 4.5 × 100`
- Points de vigilance: `BodySilhouette` SVG paths may need visual tuning (bezier curves approximate); annotations from `metric_annotations` require `event_type != 'injury'` and `label IS NOT NULL`
```

- [ ] **Final TSC:**
```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 new errors.

- [ ] **Commit:**
```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for metrics tab navigation"
```

---

## Self-Review Checklist

| Spec requirement | Task |
|-----------------|------|
| 3 tabs: Corps / Mensurations / Vitalité | Task 8 (MetricsClientPage tab bar) |
| MetricCard expand-inline | Task 3 |
| Charts with bilan markers + coach annotations | Task 3 (MetricExpandedChart) |
| BodySilhouette SVG + bilan nav | Task 5 |
| MesurationsTab: silhouette + 4 cards | Task 6 |
| VitalityScoreHero score 0-100 | Task 7 |
| VitalityTab: hero + 4 cards | Task 7 |
| `/api/client/body-data` extended | Task 1 |
| `/api/client/vitality` new route | Task 2 |
| Promise.all fetch single mount | Task 8 |
| Empty state for 0 bilans / 0 checkins | Tasks 4, 6, 7 |
| DS v4.0 tokens (#080808, #161616, #f2f2f2) | All tasks |
| CHANGELOG + project-state | Task 9 |
