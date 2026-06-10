# Client PWA — Design System v4.0 Dark Gray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the entire client app color system with a pure dark-gray palette (no borders, no yellow accent, no green accent) — gray scale #080808→#f2f2f2 as the only UI colors, 3 muted data colors for charts only.

**Architecture:** CSS variables layer first (globals.css + tailwind.config.ts), then high-impact navigation components, then chat, then workout, then nutrition, then remaining components in batches. No borders anywhere. Separation through surface-level gray differences only.

**Tech Stack:** Next.js App Router, Tailwind CSS v3, shadcn/ui, Framer Motion, Phosphor Icons, Barlow/Barlow Condensed fonts.

**Spec:** `docs/superpowers/specs/2026-05-21-client-pwa-design-system-v4-dark-gray.md`

---

## Color Substitution Reference (use throughout all tasks)

| Old value | New value | Context |
|-----------|-----------|---------|
| `#ffe01e` / `#FFE01E` | `#f2f2f2` | UI accent → primary emphasis |
| `#ffe01e` | `var(--data-copper)` | chart overflow only |
| `#FFB800` | `#e0e0e0` | TempoGuideModal accent |
| `#0d0d0d` (app bg) | `#080808` | background |
| `#161616` (surface) | `#111111` | surface L1 |
| `#1a1a1a` (surface) | `#1a1a1a` | surface L2 — keep |
| `#1e1e1e` | `#222222` | surface L3 |
| `text-[#0d0d0d]` | `text-[#080808]` | text on light bg |
| `text-[#0d0d0d]/50` | `text-[#5a5a5a]` | muted text |
| `text-white/30` | `text-[#5a5a5a]` | inactive/muted |
| `bg-white/[0.05]` | `bg-[#1a1a1a]` | subtle surface |
| `border border-white/[0.06]` | `` (remove) | no borders |
| `border border-white/[0.08]` | `` (remove) | no borders |
| `border-t border-white/[0.06]` | `` (remove) | no borders |
| `border-b border-white/[0.06]` | `` (remove) | no borders |
| `border-[0.3px] border-white/[0.06]` | `` (remove) | no borders |
| `border border-[#ffe01e]/20` | `` (remove) | no borders |
| `#3b82f6` (chart blue) | `var(--data-petrol)` | charts |
| `#e85d04` (chart orange) | `var(--data-copper)` | charts |
| `#2d9a4e` (chart green) | `var(--data-gold)` | charts |
| `#d4a017` (chart amber) | `var(--data-gold)` | charts |
| `#4da6ff` (water blue) | `var(--data-petrol)` | water progress |
| `#1f8a65` in client | `#f2f2f2` (btn) or `#808080` (text) | context |

---

## Task 1: Foundation — CSS Variables + Tailwind Config + Manifest

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `public/manifest.json`
- Modify: `app/client/layout.tsx`

- [ ] **Step 1: Add DS v4.0 client token block to globals.css**

In `app/globals.css`, after the existing `:root {` block, add a new comment section (do NOT remove the existing coach tokens — they are used by `/coach`):

```css
/* ═══════════════════════════════════════════════════════════════════════════
   DS v4.0 — Client PWA : Dark Gray Minimal
   Pure neutral gray scale. No borders. No colored accent.
   Data colors used in charts ONLY.
   ═══════════════════════════════════════════════════════════════════════════ */

:root {
  /* ── Gray scale ─────────────────────────────────────────── */
  --c-bg:         #080808;  /* App background */
  --c-surface-1:  #111111;  /* Cards, sheets — L1 */
  --c-surface-2:  #1a1a1a;  /* Elevated cards — L2 */
  --c-surface-3:  #222222;  /* Inputs, interactive — L3 */
  --c-hover:      #2e2e2e;  /* Hover state */
  --c-active:     #404040;  /* Active / pressed */
  --c-icon-off:   #5a5a5a;  /* Icons disabled / inactive nav */
  --c-text-muted: #808080;  /* Text muted */
  --c-text-body:  #b0b0b0;  /* Text body */
  --c-text-head:  #e0e0e0;  /* Headings */
  --c-text-emph:  #f2f2f2;  /* Emphasis / primary btn bg */

  /* ── Data colors (charts/SVG only — never in UI) ─────────── */
  --data-copper:  #9d7052;
  --data-gold:    #a89060;
  --data-petrol:  #3d7070;
}
```

- [ ] **Step 2: Update tailwind.config.ts — add gray scale + data colors**

Replace the existing `colors:` block inside `theme.extend` with:

```ts
colors: {
  // ── DS v4.0 client gray scale ──────────────────────────
  "c-bg":        "#080808",
  "c-surface-1": "#111111",
  "c-surface-2": "#1a1a1a",
  "c-surface-3": "#222222",
  "c-hover":     "#2e2e2e",
  "c-active":    "#404040",
  "c-icon-off":  "#5a5a5a",
  "c-text-muted":"#808080",
  "c-text-body": "#b0b0b0",
  "c-text-head": "#e0e0e0",
  "c-text-emph": "#f2f2f2",
  // ── DS v4.0 data colors ────────────────────────────────
  "data-copper": "#9d7052",
  "data-gold":   "#a89060",
  "data-petrol": "#3d7070",
  // ── DS v2.0 coach tokens (keep — used by /coach) ───────
  background: "#121212",
  surface: "#141414",
  "surface-alt": "#141414",
  "surface-light": "#141414",
  "surface-raised": "#141414",
  dark: "#141414",
  primary: "#EDEDED",
  main: "var(--text-main)",
  "on-dark": "#FFFFFF",
  secondary: "#8A8A8A",
  muted: "#8A8A8A",
  accent: "#1F8A65",
  "accent-hover": "#217356",
  "accent-secondary": "#217356",
  "accent-tertiary": "#1F4637",
  subtle: "#2A2A2A",
  active: "#3F3F3F",
  success: "#1F8A65",
  danger: "#ef4444",
  warning: "#f59e0b",
},
```

- [ ] **Step 3: Update manifest.json themeColor**

In `public/manifest.json`, change:
```json
"theme_color": "#0d0d0d",
"background_color": "#0d0d0d"
```
to:
```json
"theme_color": "#080808",
"background_color": "#080808"
```

- [ ] **Step 4: Update viewport themeColor in app/client/layout.tsx**

In `app/client/layout.tsx`, change:
```ts
export const viewport: Viewport = {
  themeColor: '#0d0d0d',
```
to:
```ts
export const viewport: Viewport = {
  themeColor: '#080808',
```

Also update the layout div:
```tsx
// Before:
<div className="min-h-screen bg-[#0d0d0d] font-barlow">
// After:
<div className="min-h-screen bg-[#080808] font-barlow">
```

- [ ] **Step 5: Commit**

```bash
git add app/globals.css tailwind.config.ts public/manifest.json app/client/layout.tsx
git commit -m "feat(ds4): add gray scale tokens, data colors, update manifest bg"
```

---

## Task 2: Navigation — ClientTopBar + BottomNav

**Files:**
- Modify: `components/client/ClientTopBar.tsx`
- Modify: `components/client/BottomNav.tsx`

- [ ] **Step 1: Rewrite ClientTopBar — remove yellow, go dark**

Replace the entire content of `components/client/ClientTopBar.tsx` with:

```tsx
'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface Props {
  left?: React.ReactNode
  section?: string
  title?: string
  backHref?: string
  right?: React.ReactNode
  hideCoachButton?: boolean
}

export default function ClientTopBar({ left, section, title, backHref, right }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-[#080808] px-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {left ?? (
          <>
            {backHref && (
              <Link
                href={backHref}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#222222] text-[#b0b0b0] hover:bg-[#2e2e2e] transition-colors shrink-0"
              >
                <ChevronLeft size={16} />
              </Link>
            )}
            <div className="min-w-0">
              {section && (
                <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.22em] text-[#5a5a5a] leading-none mb-0.5">
                  {section}
                </p>
              )}
              {title && (
                <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#e0e0e0] leading-tight truncate">
                  {title}
                </p>
              )}
            </div>
          </>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {right && <>{right}</>}
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Rewrite BottomNav — remove yellow, remove border-t**

Replace the entire content of `components/client/BottomNav.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatCircle, Barbell, ForkKnife, ChartLine } from "@phosphor-icons/react";
import { useClientT } from "./ClientI18nProvider";
import { useTour } from "./TourContext";
import type { ClientDictKey } from "@/lib/i18n/clientTranslations";

const NAV: { href: string; labelKey: ClientDictKey; Icon: React.ElementType }[] = [
  { href: "/client",           labelKey: "nav.chat",      Icon: ChatCircle },
  { href: "/client/programme", labelKey: "nav.programme", Icon: Barbell },
  { href: "/client/nutrition", labelKey: "nav.nutrition", Icon: ForkKnife },
  { href: "/client/metrics",   labelKey: "nav.metrics",   Icon: ChartLine },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useClientT();
  const { highlightedNavIndex } = useTour();

  function isActive(href: string) {
    if (href === "/client") return pathname === "/client";
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#080808]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-[62px] px-2">
        {NAV.map(({ href, labelKey, Icon }, i) => {
          const active = isActive(href) || highlightedNavIndex === i;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-[5px] flex-1 h-full transition-all duration-200 active:scale-[0.92] ${
                active ? "text-[#f2f2f2]" : "text-[#5a5a5a] hover:text-[#808080]"
              }`}
            >
              <Icon size={active ? 26 : 23} weight={active ? "fill" : "regular"} />
              <span
                className={`text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] leading-none transition-all duration-200 ${
                  active ? "text-[#f2f2f2]" : "text-[#5a5a5a]"
                }`}
              >
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: 0 new errors from these files.

- [ ] **Step 4: Commit**

```bash
git add components/client/ClientTopBar.tsx components/client/BottomNav.tsx
git commit -m "feat(ds4): navigation — dark TopBar, borderless BottomNav, gray active states"
```

---

## Task 3: Chat System

**Files:**
- Modify: `components/client/ChatBubble.tsx`
- Modify: `components/client/ChatConversation.tsx`
- Modify: `components/client/ChatInputBar.tsx`
- Modify: `components/client/ChatTodayStrip.tsx`
- Modify: `components/client/ChatPage.tsx`

- [ ] **Step 1: Update ChatBubble**

Replace full content of `components/client/ChatBubble.tsx`:

```tsx
"use client"

import Image from "next/image"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  message_type: string
  created_at: string
}

interface ChatBubbleProps {
  message: ChatMessage
  coachAvatarUrl?: string | null
}

export default function ChatBubble({ message, coachAvatarUrl }: ChatBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-[#1a1a1a] flex items-center justify-center">
          {coachAvatarUrl ? (
            <Image src={coachAvatarUrl} alt="Coach" width={28} height={28} className="object-cover" />
          ) : (
            <span className="text-[10px] font-barlow-condensed font-bold text-[#808080] uppercase tracking-wider">
              S
            </span>
          )}
        </div>
      )}

      <div
        className={`max-w-[75%] px-3.5 py-2.5 text-[13px] leading-[1.5] ${
          isUser
            ? "bg-[#f2f2f2] text-[#080808] font-medium rounded-2xl rounded-tr-sm"
            : "bg-[#111111] text-[#b0b0b0] rounded-2xl rounded-tl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update ChatConversation — remove separator lines, update typing indicator**

In `components/client/ChatConversation.tsx`:

Change the separator render from:
```tsx
<div key={item.key} className="flex items-center gap-2 py-1">
  <div className="flex-1 h-px bg-white/[0.06]" />
  <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/30">
    {item.label}
  </span>
  <div className="flex-1 h-px bg-white/[0.06]" />
</div>
```
to:
```tsx
<div key={item.key} className="flex items-center justify-center py-2">
  <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[#5a5a5a]">
    {item.label}
  </span>
</div>
```

Change the typing indicator bubble from:
```tsx
<div className="bg-[#161616] border border-white/[0.06] rounded-2xl rounded-tl-sm px-3.5 py-3 flex gap-1.5">
  {[0, 1, 2].map(i => (
    <span
      key={i}
      className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
```
to:
```tsx
<div className="bg-[#111111] rounded-2xl rounded-tl-sm px-3.5 py-3 flex gap-1.5">
  {[0, 1, 2].map(i => (
    <span
      key={i}
      className="w-1.5 h-1.5 rounded-full bg-[#404040] animate-bounce"
```

Change the avatar in typing indicator:
```tsx
// Before:
<div className="w-7 h-7 rounded-full bg-[#161616] border border-white/[0.08] shrink-0" />
// After:
<div className="w-7 h-7 rounded-full bg-[#1a1a1a] shrink-0" />
```

- [ ] **Step 3: Update ChatInputBar**

Replace full content of `components/client/ChatInputBar.tsx`:

```tsx
"use client"

import { useState } from "react"
import { ArrowRight, Microphone } from "@phosphor-icons/react"
import dynamic from "next/dynamic"

const VoiceLogSheet = dynamic(() => import("@/components/client/smart/VoiceLogSheet"), { ssr: false })

interface ChatInputBarProps {
  onSend: (content: string, type?: string) => void
  disabled?: boolean
}

export default function ChatInputBar({ onSend, disabled }: ChatInputBarProps) {
  const [value, setValue] = useState("")
  const [voiceOpen, setVoiceOpen] = useState(false)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed, "text")
    setValue("")
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleVoiceSuccess(transcript: string) {
    setVoiceOpen(false)
    if (transcript.trim()) onSend(transcript.trim(), "voice")
  }

  return (
    <>
      <div className="shrink-0 bg-[#080808] px-3 py-2.5 flex items-center gap-2">
        <button
          onClick={() => setVoiceOpen(true)}
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-[#1a1a1a] text-[#5a5a5a] active:bg-[#222222] transition-colors shrink-0"
          aria-label="Saisie vocale"
        >
          <Microphone size={18} />
        </button>

        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Écrire un message..."
          disabled={disabled}
          className="flex-1 min-w-0 bg-[#111111] rounded-xl px-3.5 py-2 text-[13px] font-barlow text-[#e0e0e0] placeholder-[#5a5a5a] outline-none transition-colors disabled:opacity-50"
        />

        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-[#f2f2f2] text-[#080808] disabled:opacity-30 active:scale-95 transition-all shrink-0"
          aria-label="Envoyer"
        >
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>

      {voiceOpen && (
        <VoiceLogSheet
          open={voiceOpen}
          onClose={() => setVoiceOpen(false)}
          onSuccess={() => setVoiceOpen(false)}
          onTranscriptOnly={handleVoiceSuccess}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Update ChatTodayStrip — remove all borders, replace yellow/blue accents**

Replace full content of `components/client/ChatTodayStrip.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Barbell, ForkKnife, Drop, CheckCircle, Circle } from "@phosphor-icons/react"
import dynamic from "next/dynamic"

const QuickWaterModal = dynamic(() => import("@/components/client/QuickWaterModal"), { ssr: false })

interface TodayStrip {
  sessions: { id: string; name: string }[]
  calories: { logged: number; target: number }
  water: { logged: number; target: number }
  checkin: { morning: boolean; evening: boolean }
}

interface ChatTodayStripProps {
  onCheckinClick?: () => void
}

export default function ChatTodayStrip({ onCheckinClick }: ChatTodayStripProps) {
  const router = useRouter()
  const [data, setData] = useState<TodayStrip | null>(null)
  const [waterOpen, setWaterOpen] = useState(false)

  function refresh() {
    fetch("/api/client/chat/today-strip")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }

  useEffect(() => { refresh() }, [])

  if (!data) {
    return (
      <div className="shrink-0 h-[44px] bg-[#080808] flex items-center px-4 gap-2">
        {[80, 120, 100].map(w => (
          <div key={w} className="h-[26px] bg-[#111111] rounded-xl animate-pulse" style={{ width: w }} />
        ))}
      </div>
    )
  }

  const checkinDone = data.checkin.morning
  const calPct = data.calories.target > 0 ? Math.min(data.calories.logged / data.calories.target, 1) : 0
  const waterPct = data.water.target > 0 ? Math.min(data.water.logged / data.water.target, 1) : 0

  return (
    <>
      <div className="shrink-0 bg-[#080808]">
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-none">

          {/* Check-in */}
          <button
            onClick={onCheckinClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 active:opacity-70 transition-all ${
              checkinDone ? "bg-[#222222]" : "bg-[#1a1a1a]"
            }`}
          >
            {checkinDone
              ? <CheckCircle size={13} weight="fill" className="text-[#f2f2f2]" />
              : <Circle size={13} className="text-[#808080]" />
            }
            <span className={`text-[11px] font-barlow font-semibold whitespace-nowrap ${checkinDone ? "text-[#f2f2f2]" : "text-[#808080]"}`}>
              {checkinDone ? "Check-in ✓" : "Check-in"}
            </span>
          </button>

          {/* Sessions du jour */}
          {data.sessions.map(s => (
            <button
              key={s.id}
              onClick={() => router.push("/client/programme")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#111111] shrink-0 active:opacity-70"
            >
              <Barbell size={13} className="text-[#5a5a5a]" />
              <span className="text-[11px] font-barlow font-medium text-[#808080] whitespace-nowrap max-w-[100px] truncate">
                {s.name}
              </span>
            </button>
          ))}

          {/* Calories */}
          <button
            onClick={() => router.push("/client/nutrition")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#111111] shrink-0 active:opacity-70"
          >
            <ForkKnife size={13} className="text-[#5a5a5a]" />
            <span className="text-[11px] font-barlow font-medium text-[#808080] whitespace-nowrap">
              {data.calories.logged} <span className="text-[#5a5a5a]">/ {data.calories.target}</span>
            </span>
            <div className="w-10 h-1 bg-[#2e2e2e] rounded-full overflow-hidden">
              <div className="h-full bg-[#b0b0b0] rounded-full transition-all" style={{ width: `${calPct * 100}%` }} />
            </div>
          </button>

          {/* Eau */}
          <button
            onClick={() => setWaterOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#111111] shrink-0 active:opacity-70"
          >
            <Drop size={13} className="text-[#5a5a5a]" />
            <span className="text-[11px] font-barlow font-medium text-[#808080] whitespace-nowrap">
              {(data.water.logged / 1000).toFixed(1)}<span className="text-[#5a5a5a]">L / {data.water.target / 1000}L</span>
            </span>
            <div className="w-8 h-1 bg-[#2e2e2e] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${waterPct * 100}%`, backgroundColor: 'var(--data-petrol)' }} />
            </div>
          </button>

        </div>
      </div>

      <QuickWaterModal
        open={waterOpen}
        onClose={() => { setWaterOpen(false); refresh() }}
      />
    </>
  )
}
```

- [ ] **Step 5: Update ChatPage — empty state avatar + quick suggestions**

In `components/client/ChatPage.tsx`, make the following targeted changes:

```tsx
// Avatar circle — before:
className="w-[72px] h-[72px] rounded-full bg-[#161616] border border-white/[0.08] flex items-center justify-center"
// After:
className="w-[72px] h-[72px] rounded-full bg-[#111111] flex items-center justify-center"

// Avatar letter — before:
<span className="text-[26px] font-barlow-condensed font-bold text-[#ffe01e]">S</span>
// After:
<span className="text-[26px] font-barlow-condensed font-bold text-[#b0b0b0]">S</span>

// Greeting subtitle — before:
<p className="text-[13px] text-white/40 font-barlow mt-1">
// After:
<p className="text-[13px] text-[#5a5a5a] font-barlow mt-1">

// Quick suggestion pills — before:
className="px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-[12px] font-barlow text-white/60 active:bg-white/[0.10] active:text-white transition-all"
// After:
className="px-3 py-2 bg-[#1a1a1a] rounded-xl text-[12px] font-barlow text-[#808080] active:bg-[#222222] active:text-[#e0e0e0] transition-all"

// Rate limit banner — before:
className="px-4 py-2 text-center text-[11px] text-white/30 font-barlow bg-white/[0.02] border-t border-white/[0.04]"
// After:
className="px-4 py-2 text-center text-[11px] text-[#5a5a5a] font-barlow bg-[#111111]"
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 7: Commit**

```bash
git add components/client/ChatBubble.tsx components/client/ChatConversation.tsx components/client/ChatInputBar.tsx components/client/ChatTodayStrip.tsx components/client/ChatPage.tsx
git commit -m "feat(ds4): chat — white user bubbles, borderless surfaces, gray palette"
```

---

## Task 4: SessionLogger

**Files:**
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

This is the most complex file (~1250 lines). Apply changes as targeted edits.

- [ ] **Step 1: Replace all inline style yellow CTA buttons**

In `SessionLogger.tsx`, replace every instance of:
```tsx
style={{ backgroundColor: '#ffe01e', color: '#0d0d0d' }}
```
with:
```tsx
style={{ backgroundColor: '#f2f2f2', color: '#080808' }}
```

Also replace:
```tsx
className="flex-1 py-2.5 rounded-xl bg-[#ffe01e] text-[#0d0d0d] text-[13px] font-bold uppercase hover:bg-[#ffd000] disabled:opacity-50 transition-colors"
```
with:
```tsx
className="flex-1 py-2.5 rounded-xl bg-[#f2f2f2] text-[#080808] text-[13px] font-bold uppercase hover:bg-[#e0e0e0] disabled:opacity-50 transition-colors"
```

- [ ] **Step 2: Replace app background and border-b header**

```tsx
// Before (app bg):
<div className="min-h-screen bg-[#0d0d0d] font-sans">
// After:
<div className="min-h-screen bg-[#080808] font-sans">

// Before (sticky header):
<header className="sticky top-0 z-40 bg-[#0d0d0d] border-b border-white/[0.06]">
// After:
<header className="sticky top-0 z-40 bg-[#080808]">
```

- [ ] **Step 3: Replace superset label + context menu refs**

```tsx
// Superset badge — before:
className="text-[#ffe01e]/70"
// After:
className="text-[#808080]"

// Superset "Surensemble" text — before:
<span className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[#ffe01e]/80">Surensemble</span>
// After:
<span className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[#808080]">Surensemble</span>

// Superset icon btn — before:
className="h-7 w-7 flex items-center justify-center rounded-lg text-[#ffe01e]/40 hover:text-[#ffe01e]/70"
// After:
className="h-7 w-7 flex items-center justify-center rounded-lg text-[#5a5a5a] hover:text-[#808080]"
```

- [ ] **Step 4: Replace section tab progress bar + "allDone" button**

```tsx
// Progress bar fill — before:
className="absolute inset-0 bg-[#ffe01e]/40 origin-left"
// After:
className="absolute inset-0 bg-[#e0e0e0]/20 origin-left"

// Tab "allDone" state — before:
className={`... ${allDone ? 'bg-[#ffe01e] text-[#0d0d0d]' : 'bg-white/[0.06] text-white/50'}`}
// After:
className={`... ${allDone ? 'bg-[#f2f2f2] text-[#080808]' : 'bg-[#1a1a1a] text-[#5a5a5a]'}`}
```

- [ ] **Step 5: Replace PR flash + session complete banner + rest timer accent**

```tsx
// PR flash banner — before:
className="fixed top-24 left-4 right-4 z-50 px-4 py-2.5 bg-[#ffe01e]/10 border border-[#ffe01e]/30 rounded-xl ..."
// After:
className="fixed top-24 left-4 right-4 z-50 px-4 py-2.5 bg-[#222222] rounded-xl ..."

// Rest timer — before (accentColor):
const accentColor = isOvertime ? (restElapsed > (restPrescribed ?? 0) + 30 ? '#ef4444' : '#f97316') : '#ffe01e'
// After:
const accentColor = isOvertime ? (restElapsed > (restPrescribed ?? 0) + 30 ? '#ef4444' : '#f97316') : '#f2f2f2'

// Next set info text — before:
<span className="font-barlow-condensed font-bold text-[#ffe01e]/70">{nextEx.sets} × {nextEx.reps}</span>
// After:
<span className="font-barlow-condensed font-bold text-[#b0b0b0]">{nextEx.sets} × {nextEx.reps}</span>
```

- [ ] **Step 6: Replace all surface cards with borders → borderless**

```tsx
// Exercise note textareas — before:
className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 ..."
// After:
className="w-full bg-[#111111] rounded-xl px-3 py-2 ..."

// Bottom sheet panel — before:
className="fixed bottom-0 left-0 right-0 z-[70] bg-[#161616] rounded-t-2xl border-t border-white/[0.08] pb-8"
// After:
className="fixed bottom-0 left-0 right-0 z-[70] bg-[#111111] rounded-t-2xl pb-8"

// Rest timer card — before:
<div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-6 w-full max-w-sm">
// After:
<div className="bg-[#111111] rounded-2xl p-6 w-full max-w-sm">

// Info cards — before:
<div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-3 ...">
// After:
<div className="bg-[#111111] rounded-xl px-5 py-3 ...">

// Superset container border — before:
className={ei > 0 ? 'border-t border-white/[0.05]' : ''}
// After:
className=""
```

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 8: Commit**

```bash
git add "app/client/programme/session/[sessionId]/SessionLogger.tsx"
git commit -m "feat(ds4): SessionLogger — gray palette, white CTA, no borders, gray superset"
```

---

## Task 5: Workout Sub-components — SetRow + ExerciseBlock + ExerciseSwapSheet

**Files:**
- Modify: `components/client/smart/SetRow.tsx`
- Modify: `components/client/smart/ExerciseBlock.tsx`
- Modify: `app/client/programme/session/[sessionId]/ExerciseSwapSheet.tsx`
- Modify: `components/client/smart/SmartWorkoutHero.tsx`
- Modify: `components/client/smart/SmartWorkoutWidget.tsx`
- Modify: `components/client/smart/ExerciseContextMenu.tsx`
- Modify: `components/client/smart/SupersetContextMenu.tsx`

- [ ] **Step 1: SetRow — replace yellow CTA + PR badge + border + input border**

In `components/client/smart/SetRow.tsx`:

```tsx
// Validate button — before:
className="w-full h-14 flex items-center justify-center bg-[#ffe01e] text-[#0d0d0d] ..."
// After:
className="w-full h-14 flex items-center justify-center bg-[#f2f2f2] text-[#080808] ..."

// PR badge — before:
<span className="bg-[#ffe01e] text-[#0d0d0d] text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0">PR</span>
// After:
<span className="bg-[#f2f2f2] text-[#080808] text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0">PR</span>

// CheckCircle2 icon — before:
className="text-[#ffe01e] shrink-0"
// After:
className="text-[#f2f2f2] shrink-0"

// Row container — before:
className="relative rounded-xl border border-white/[0.08] bg-[#1a1a1a] cursor-pointer"
// After:
className="relative rounded-xl bg-[#1a1a1a] cursor-pointer"

// Weight input — before:
className="w-full bg-white/[0.04] rounded-xl text-[26px] font-black text-white text-center outline-none h-12 border border-white/[0.08]"
// After:
className="w-full bg-[#222222] rounded-xl text-[26px] font-black text-white text-center outline-none h-12"

// Tempo icon btn — before:
className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg bg-[#FFB800]/10 text-[#FFB800]/70 ..."
// After:
className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg bg-[#222222] text-[#808080] ..."
```

- [ ] **Step 2: ExerciseBlock — remove border on card**

In `components/client/smart/ExerciseBlock.tsx`, find and change:
```tsx
// Before:
className="bg-[#161616] rounded-2xl border border-white/[0.08] overflow-hidden"
// After:
className="bg-[#111111] rounded-2xl overflow-hidden"
```

- [ ] **Step 3: ExerciseSwapSheet — replace yellow highlights**

In `app/client/programme/session/[sessionId]/ExerciseSwapSheet.tsx`, replace any `#ffe01e` references:

```tsx
// "Recommandé" badge — before:
className="... bg-[#ffe01e]/10 text-[#ffe01e] ..."
// After:
className="... bg-[#222222] text-[#f2f2f2] ..."

// Select button — before:
className="... bg-[#ffe01e] text-[#0d0d0d] ..."
// After:
className="... bg-[#f2f2f2] text-[#080808] ..."

// Sheet bg — before (if present):
style={{ background: '#0d0d0d' }}
// After:
style={{ background: '#080808' }}
```

- [ ] **Step 4: SmartWorkoutHero + SmartWorkoutWidget — remove yellow**

In `components/client/smart/SmartWorkoutHero.tsx` and `SmartWorkoutWidget.tsx`:

```tsx
// Any #ffe01e text → text-[#f2f2f2]
// Any #ffe01e bg → bg-[#f2f2f2] text-[#080808]
// Any bg-[#0d0d0d] → bg-[#080808]
// Any bg-[#161616] → bg-[#111111]
// Remove border-* classes
```

- [ ] **Step 5: ExerciseContextMenu + SupersetContextMenu — remove borders**

In both context menu components, remove any `border border-white/[0.06]` or `border-t border-white/[0.06]` classes. Replace bg with `bg-[#111111]`.

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 7: Commit**

```bash
git add components/client/smart/SetRow.tsx components/client/smart/ExerciseBlock.tsx "app/client/programme/session/[sessionId]/ExerciseSwapSheet.tsx" components/client/smart/SmartWorkoutHero.tsx components/client/smart/SmartWorkoutWidget.tsx components/client/smart/ExerciseContextMenu.tsx components/client/smart/SupersetContextMenu.tsx
git commit -m "feat(ds4): workout components — gray surfaces, white CTAs, no borders"
```

---

## Task 6: Nutrition Components

**Files:**
- Modify: `components/client/NutritionWidget.tsx`
- Modify: `components/client/smart/SmartNutritionWidget.tsx`
- Modify: `components/client/smart/SmartNutritionHero.tsx`
- Modify: `components/client/smart/NutritionMealsList.tsx`
- Modify: `components/client/smart/NutritionStreakCard.tsx`
- Modify: `components/client/smart/MealLogSheet.tsx`
- Modify: `components/client/smart/VoiceLogSheet.tsx`
- Modify: `components/client/smart/VoiceEntryFab.tsx`
- Modify: `app/client/nutrition/log/NutritionLogContent.tsx`
- Modify: `app/client/nutrition/page.tsx`

- [ ] **Step 1: NutritionWidget — replace COLORS constant + surfaces**

In `components/client/NutritionWidget.tsx`, replace the `COLORS` constant:

```tsx
// Before:
const COLORS = {
  cal:  '#3b82f6',
  prot: '#e85d04',
  carb: '#2d9a4e',
  fat:  '#d4a017',
  over: '#ffe01e',
  track: 'rgba(255,255,255,0.07)',
}
// After:
const COLORS = {
  cal:  'var(--data-petrol)',
  prot: 'var(--data-copper)',
  carb: 'var(--data-gold)',
  fat:  'var(--data-gold)',
  over: 'var(--data-copper)',
  track: 'rgba(255,255,255,0.05)',
}
```

Also in the widget:
```tsx
// Container — before:
<div className="flex flex-col min-h-full bg-[#0d0d0d]">
// After:
<div className="flex flex-col min-h-full bg-[#080808]">

// Avatar circle — before:
<div className="w-14 h-14 rounded-full bg-[#161616] border border-white/[0.08] ...">
// After:
<div className="w-14 h-14 rounded-full bg-[#1a1a1a] ...">

// Avatar letter — before:
<span className="text-[18px] font-barlow-condensed font-bold text-[#ffe01e] uppercase">
// After:
<span className="text-[18px] font-barlow-condensed font-bold text-[#b0b0b0] uppercase">

// Protocol pill — before:
<div className="px-2.5 py-1 bg-[#ffe01e]/10 border border-[#ffe01e]/20 rounded-full ...">
  <span className="... text-[#ffe01e]">
// After:
<div className="px-2.5 py-1 bg-[#222222] rounded-full ...">
  <span className="... text-[#b0b0b0]">
```

- [ ] **Step 2: VoiceLogSheet — replace yellow + remove borders**

In `components/client/smart/VoiceLogSheet.tsx`:

```tsx
// Sheet wrapper — before:
className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl border-t border-white/[0.08]"
style={{ background: '#0d0d0d', ... }}
// After:
className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl"
style={{ background: '#080808', ... }}

// Waveform bar active — before:
backgroundColor: isActive ? "#ffe01e" : "rgba(255,255,255,0.13)"
// After:
backgroundColor: isActive ? "#f2f2f2" : "#2e2e2e"

// Timer color — before:
color: timeWarning ? '#ef4444' : isActive ? '#ffe01e' : 'rgba(255,255,255,0.18)'
// After:
color: timeWarning ? '#ef4444' : isActive ? '#f2f2f2' : '#5a5a5a'

// Phase toggle btn — before:
background: isActive ? '#161616' : '#ffe01e',
border: isActive ? '1.5px solid #ffe01e' : 'none',
// color (inner span) — before:
color: isActive ? '#ffe01e' : '#0d0d0d',
// After:
background: isActive ? '#222222' : '#f2f2f2',
border: 'none',
// color (inner span):
color: isActive ? '#f2f2f2' : '#080808',

// Spinner — before:
className="h-10 w-10 border-2 border-white/10 border-t-[#ffe01e] rounded-full animate-spin"
// After:
className="h-10 w-10 border-2 border-[#2e2e2e] border-t-[#f2f2f2] rounded-full animate-spin"

// Input field — before:
className="... border border-white/[0.08] ... focus:border-[#ffe01e]/40"
// After:
className="... bg-[#111111] ... focus:outline-none"

// Item card — before:
<div className="rounded-xl border border-white/[0.06] p-3 ...">
// After:
<div className="rounded-xl bg-[#111111] p-3 ...">

// Log button — before:
style={{ background: '#ffe01e', color: '#0d0d0d' }}
// After:
style={{ background: '#f2f2f2', color: '#080808' }}
```

- [ ] **Step 3: VoiceEntryFab — replace yellow**

In `components/client/smart/VoiceEntryFab.tsx`:
```tsx
// Before: bg-[#ffe01e] text-[#0d0d0d]
// After: bg-[#f2f2f2] text-[#080808]
```

- [ ] **Step 4: MealLogSheet + NutritionMealsList + SmartNutritionWidget + SmartNutritionHero + NutritionStreakCard**

For each file, apply the pattern:
- `bg-[#ffe01e]` → `bg-[#f2f2f2]`, paired `text-[#0d0d0d]` → `text-[#080808]`
- `text-[#ffe01e]` → `text-[#f2f2f2]` (emphasis) or `text-[#b0b0b0]` (label)
- `bg-[#161616]` → `bg-[#111111]`
- `bg-[#0d0d0d]` → `bg-[#080808]`
- Remove all `border border-white/[0.06]`, `border border-white/[0.08]`, `border-t border-white/[0.06]`
- Chart/progress colors: use `var(--data-copper)`, `var(--data-gold)`, `var(--data-petrol)`

- [ ] **Step 5: NutritionLogContent + app/client/nutrition/page.tsx**

Same pattern as step 4. Remove borders, replace yellow, update surfaces.

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 7: Commit**

```bash
git add components/client/NutritionWidget.tsx components/client/smart/SmartNutritionWidget.tsx components/client/smart/SmartNutritionHero.tsx components/client/smart/NutritionMealsList.tsx components/client/smart/NutritionStreakCard.tsx components/client/smart/MealLogSheet.tsx components/client/smart/VoiceLogSheet.tsx components/client/smart/VoiceEntryFab.tsx app/client/nutrition/log/NutritionLogContent.tsx app/client/nutrition/page.tsx
git commit -m "feat(ds4): nutrition — data colors in charts, white CTAs, borderless surfaces"
```

---

## Task 7: Metrics + Charts

**Files:**
- Modify: `components/client/MetricsPage.tsx`
- Modify: `components/client/smart/ExerciseProgressionChart.tsx`
- Modify: `components/client/smart/TdeeChart.tsx`
- Modify: `components/client/smart/MacroWeekGrid.tsx`
- Modify: `components/client/smart/WeeklyTrendStrip.tsx`
- Modify: `components/client/smart/AdherenceScoreCard.tsx`
- Modify: `components/client/smart/DeloadAlertBanner.tsx`
- Modify: `components/client/smart/RecoveryStatusWidget.tsx`
- Modify: `components/client/smart/VolumeCoverageWidget.tsx`
- Modify: `components/client/smart/OneRMWidget.tsx`

- [ ] **Step 1: MetricsPage — replace chart colors + surfaces**

In `components/client/MetricsPage.tsx`:
- Replace `#ffe01e` used in chart lines/fills → `var(--data-copper)` (primary metric)
- Replace `#3b82f6` → `var(--data-petrol)`
- Replace `#2d9a4e` → `var(--data-gold)`
- Replace `#e85d04` → `var(--data-copper)`
- Remove borders, replace surfaces `#161616` → `#111111`, `#0d0d0d` → `#080808`

- [ ] **Step 2: ExerciseProgressionChart — replace line colors**

In `components/client/smart/ExerciseProgressionChart.tsx`:
- Any Recharts `stroke="#ffe01e"` or `fill="#ffe01e"` → `stroke="var(--data-copper)" fill="var(--data-copper)"`
- Remove surface borders

- [ ] **Step 3: TdeeChart + MacroWeekGrid + WeeklyTrendStrip**

Same pattern:
- Chart colors → data vars (`--data-copper`, `--data-gold`, `--data-petrol`)
- `#ffe01e` accent → `#f2f2f2`
- `bg-[#161616]` → `bg-[#111111]`
- Remove borders

- [ ] **Step 4: AdherenceScoreCard + DeloadAlertBanner + RecoveryStatusWidget + VolumeCoverageWidget + OneRMWidget**

Apply pattern:
- `#ffe01e` badge/label → `text-[#f2f2f2]` or `bg-[#f2f2f2] text-[#080808]`
- Alert backgrounds: replace `bg-[#ffe01e]/10 border border-[#ffe01e]/20` → `bg-[#222222]`
- Surfaces → gray scale
- Remove borders

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add components/client/MetricsPage.tsx components/client/smart/ExerciseProgressionChart.tsx components/client/smart/TdeeChart.tsx components/client/smart/MacroWeekGrid.tsx components/client/smart/WeeklyTrendStrip.tsx components/client/smart/AdherenceScoreCard.tsx components/client/smart/DeloadAlertBanner.tsx components/client/smart/RecoveryStatusWidget.tsx components/client/smart/VolumeCoverageWidget.tsx components/client/smart/OneRMWidget.tsx
git commit -m "feat(ds4): metrics — data colors, gray surfaces, no borders"
```

---

## Task 8: Modals + Sheets

**Files:**
- Modify: `components/client/QuickWaterModal.tsx`
- Modify: `components/client/CheckinModal.tsx`
- Modify: `components/client/ClientAlternativesSheet.tsx`
- Modify: `components/client/TempoGuideModal.tsx`
- Modify: `components/client/smart/SetTypeSelector.tsx`
- Modify: `components/client/smart/FreeActivitySheet.tsx`
- Modify: `components/client/smart/DayChecklist.tsx`
- Modify: `components/client/PrepTimeModal.tsx`

- [ ] **Step 1: QuickWaterModal — replace yellow CTA + border**

In `components/client/QuickWaterModal.tsx`:
```tsx
// Bottom sheet — before:
className="fixed bottom-[90px] left-4 right-4 z-[90] max-w-[400px] mx-auto bg-[#161616] border border-white/[0.08] rounded-2xl p-5 ..."
// After:
className="fixed bottom-[90px] left-4 right-4 z-[90] max-w-[400px] mx-auto bg-[#111111] rounded-2xl p-5 ..."

// Option buttons selected — before:
'bg-white/[0.12] border-white/[0.20] text-white'
// After:
'bg-[#2e2e2e] text-white'

// Option buttons default — before:
'bg-white/[0.04] border-white/[0.06] text-white/50'
// After:
'bg-[#1a1a1a] text-[#808080]'

// Selected option class (remove border-*):
// Before: 'bg-white/[0.08] text-white/70 border border-white/[0.10]'
// After: 'bg-[#222222] text-[#e0e0e0]'

// Log button — before:
className="... bg-[#ffe01e] text-[#0d0d0d] ..."
// After:
className="... bg-[#f2f2f2] text-[#080808] ..."
```

- [ ] **Step 2: TempoGuideModal — replace yellow counter**

In `components/client/TempoGuideModal.tsx`, replace the two inline style color references:
```tsx
// Rep counter — before (both instances):
color: currentRep >= reps ? 'rgba(255,255,255,0.5)' : '#ffe01e'
// After:
color: currentRep >= reps ? '#5a5a5a' : '#f2f2f2'

// Card container — before:
className="bg-[#161616] rounded-2xl border border-white/[0.08] overflow-hidden"
// After:
className="bg-[#111111] rounded-2xl overflow-hidden"
```

- [ ] **Step 3: SetTypeSelector — replace selected state**

In `components/client/smart/SetTypeSelector.tsx`:
```tsx
// Selected type — before:
className="... bg-[#ffe01e] text-[#0d0d0d] ..."
// After:
className="... bg-[#f2f2f2] text-[#080808] ..."

// Unselected — before:
className="... bg-white/[0.04] text-white/60 border border-white/[0.06] ..."
// After:
className="... bg-[#1a1a1a] text-[#808080] ..."
```

- [ ] **Step 4: CheckinModal + ClientAlternativesSheet + FreeActivitySheet + DayChecklist + PrepTimeModal**

Apply the pattern uniformly:
- `bg-[#ffe01e]` → `bg-[#f2f2f2]`, text `text-[#0d0d0d]` → `text-[#080808]`
- `text-[#ffe01e]` → `text-[#f2f2f2]`
- `bg-[#161616]` / `bg-[#0d0d0d]` → `bg-[#111111]` / `bg-[#080808]`
- Remove all `border border-white/[...]` classes
- DayChecklist check icons: `text-[#ffe01e]` → `text-[#f2f2f2]`

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add components/client/QuickWaterModal.tsx components/client/CheckinModal.tsx components/client/ClientAlternativesSheet.tsx components/client/TempoGuideModal.tsx components/client/smart/SetTypeSelector.tsx components/client/smart/FreeActivitySheet.tsx components/client/smart/DayChecklist.tsx components/client/PrepTimeModal.tsx
git commit -m "feat(ds4): modals/sheets — gray surfaces, white CTAs, no borders"
```

---

## Task 9: Profile Components

**Files:**
- Modify: `components/client/profile/ProfilAccordion.tsx`
- Modify: `components/client/profile/AccordionSection.tsx`
- Modify: `components/client/profile/BodyDataSection.tsx`
- Modify: `components/client/profile/ProfileForm.tsx`
- Modify: `components/client/profile/PreferencesForm.tsx`
- Modify: `components/client/profile/PortionScalingForm.tsx`
- Modify: `components/client/profile/ProfilePhotoUpload.tsx`
- Modify: `components/client/ClientRestrictionsSection.tsx`
- Modify: `app/client/profil/page.tsx` (if present)

- [ ] **Step 1: ProfilAccordion + AccordionSection — remove border, replace surfaces**

In `AccordionSection.tsx`:
```tsx
// Closed state — before:
className="... bg-[#161616] border border-white/[0.06] ..."
// After:
className="... bg-[#111111] ..."

// Open state — before:
className="... bg-[#1a1a1a] ..."
// After (keep — this is surface L2, correct)
className="... bg-[#1a1a1a] ..."
```

In `ProfilAccordion.tsx`: Replace `#ffe01e` streak pill → `bg-[#222222] text-[#f2f2f2]`.

- [ ] **Step 2: ProfileForm + PreferencesForm + PortionScalingForm + BodyDataSection**

Apply pattern:
- `#ffe01e` → `#f2f2f2` / `#080808`
- `bg-[#161616]` → `bg-[#111111]`
- `bg-[#0d0d0d]` → `bg-[#080808]`
- Remove borders
- BodyDataSection SVG sparkline stroke: replace `#ffe01e` → `var(--data-petrol)`

- [ ] **Step 3: ClientRestrictionsSection**

```tsx
// Severity badges — replace any yellow bg with gray
// Selected option — bg-[#ffe01e] → bg-[#f2f2f2] text-[#080808]
// Unselected options — bg-[#161616] → bg-[#111111]
// Remove border-* classes
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add components/client/profile/ components/client/ClientRestrictionsSection.tsx app/client/profil/page.tsx
git commit -m "feat(ds4): profile — gray accordion, data sparklines, no borders"
```

---

## Task 10: Pages Sweep — app/client

**Files:**
- Modify: `app/client/login/page.tsx`
- Modify: `app/client/onboarding/page.tsx`
- Modify: `app/client/bilans/page.tsx`
- Modify: `app/client/bilans/[submissionId]/page.tsx`
- Modify: `app/client/checkin/schedule/page.tsx`
- Modify: `app/client/programme/ProgrammeClientPage.tsx`
- Modify: `app/client/programme/recap/[sessionLogId]/page.tsx`
- Modify: `app/client/offline/page.tsx`
- Modify: `app/client/acces-suspendu/page.tsx`
- Modify: `app/client/access/expired/page.tsx`
- Modify: `app/client/access/invalid/page.tsx`
- Modify: `app/client/checkin/onboarding/page.tsx`

- [ ] **Step 1: Batch sed sweep on all app/client pages**

Run this from the project root to replace the most common mechanical substitutions across all client pages:

```bash
# Replace bg colors
find app/client -name "*.tsx" -exec sed -i '' \
  -e 's/bg-\[#0d0d0d\]/bg-[#080808]/g' \
  -e 's/bg-\[#161616\]/bg-[#111111]/g' \
  -e 's/text-\[#0d0d0d\]/text-[#080808]/g' \
  {} +

# Replace ffe01e in className strings (bg → f2f2f2)
find app/client -name "*.tsx" -exec sed -i '' \
  -e 's/bg-\[#ffe01e\]/bg-[#f2f2f2]/g' \
  -e 's/text-\[#ffe01e\]/text-[#f2f2f2]/g' \
  {} +

# Remove border classes
find app/client -name "*.tsx" -exec sed -i '' \
  -e 's/ border border-white\/\[0\.06\]//g' \
  -e 's/ border border-white\/\[0\.08\]//g' \
  -e 's/ border-t border-white\/\[0\.06\]//g' \
  -e 's/ border-b border-white\/\[0\.06\]//g' \
  {} +
```

- [ ] **Step 2: Manual review — inline styles in login + onboarding**

Open `app/client/login/page.tsx` and `app/client/onboarding/page.tsx`. Find any `style={{ backgroundColor: '#ffe01e' }}` or `style={{ color: '#ffe01e' }}` inline styles and replace:
- `#ffe01e` (bg) → `#f2f2f2`
- `#ffe01e` (text) → `#f2f2f2`
- `#0d0d0d` (text on yellow) → `#080808`

- [ ] **Step 3: ProgrammeClientPage — replace streak pill + tab active**

In `app/client/programme/ProgrammeClientPage.tsx`:
```tsx
// Streak pill — before:
className="... bg-[#ffe01e]/10 text-[#ffe01e] ..."
// After:
className="... bg-[#222222] text-[#f2f2f2] ..."

// Active tab — before:
className="... bg-[#ffe01e] text-[#0d0d0d] ..."
// After:
className="... bg-[#f2f2f2] text-[#080808] ..."

// Heatmap active cells — before (any #ffe01e):
// After: use '#404040' for medium, '#f2f2f2' for max intensity
```

- [ ] **Step 4: Recap page — replace accent**

In `app/client/programme/recap/[sessionLogId]/page.tsx`:
```tsx
// Any #ffe01e → #f2f2f2 (PR, stats emphasis)
// Surfaces #161616 → #111111
// Remove borders
```

- [ ] **Step 5: Bilans pages — replace accent**

In both bilans pages: `#ffe01e` → `#f2f2f2`, `bg-[#161616]` → `bg-[#111111]`, remove borders.

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 7: Commit**

```bash
git add app/client/
git commit -m "feat(ds4): pages sweep — gray palette across all app/client routes"
```

---

## Task 11: Remaining Smart Components + Final Sweep

**Files:**
- Modify: `components/client/smart/SmartAgendaTimeline.tsx`
- Modify: `components/client/smart/NotificationsBar.tsx`
- Modify: `components/client/smart/PriorityActionCard.tsx`
- Modify: `components/client/smart/FeedbackThread.tsx`
- Modify: `components/client/smart/CoachProtocolCard.tsx`
- Modify: `components/client/smart/SmartAlertsFeed.tsx`
- Modify: `components/client/smart/RemainingBreakdown.tsx`
- Modify: `components/client/smart/RecentSessionsStrip.tsx`
- Modify: `components/client/ExerciseListDisclosure.tsx`
- Modify: `components/client/OnboardingTour.tsx`
- Modify: `components/client/NewProtocolBanner.tsx`
- Modify: `components/client/SplashScreen.tsx`
- Modify: `components/client/BodyMap.tsx`

- [ ] **Step 1: Batch sed sweep on all remaining client components**

```bash
find components/client -name "*.tsx" -exec sed -i '' \
  -e 's/bg-\[#0d0d0d\]/bg-[#080808]/g' \
  -e 's/bg-\[#161616\]/bg-[#111111]/g' \
  -e 's/bg-\[#ffe01e\]/bg-[#f2f2f2]/g' \
  -e 's/text-\[#ffe01e\]/text-[#f2f2f2]/g' \
  -e 's/text-\[#0d0d0d\]/text-[#080808]/g' \
  {} +

find components/client -name "*.tsx" -exec sed -i '' \
  -e 's/ border border-white\/\[0\.06\]//g' \
  -e 's/ border border-white\/\[0\.08\]//g' \
  -e 's/ border-t border-white\/\[0\.06\]//g' \
  -e 's/ border-b border-white\/\[0\.06\]//g' \
  -e 's/ border-\[0\.3px\] border-white\/\[0\.06\]//g' \
  {} +
```

- [ ] **Step 2: Fix inline styles missed by sed (JS template literals)**

Search for remaining occurrences:

```bash
grep -rn "#ffe01e\|#FFE01E" components/client/ --include="*.tsx" | grep -v "//.*#ffe01e"
```

For each result, manually replace:
- In `style={{ }}` objects: `'#ffe01e'` → `'#f2f2f2'` (bg) or `'#f2f2f2'` (color)
- In template literals: same replacements

- [ ] **Step 3: BodyMap — replace primary muscle color**

In `components/client/BodyMap.tsx`, the primary muscle highlight color is currently `#1f8a65`. Replace with `#f2f2f2` (white-gray emphasis) and secondary with `#404040`:

```tsx
// Before:
// Primaire #1f8a65 / Secondaire rgba(31,138,101,0.28) / Inactif gris
// After:
// Primaire #e0e0e0 / Secondaire #404040 / Inactif #2e2e2e
```

- [ ] **Step 4: SplashScreen — replace logo accent**

In `components/client/SplashScreen.tsx`:
```tsx
// Logo letter color — before: text-[#ffe01e]
// After: text-[#f2f2f2]
// bg — before: bg-[#0d0d0d]
// After: bg-[#080808]
```

- [ ] **Step 5: OnboardingTour + NewProtocolBanner**

Replace `#ffe01e` → `#f2f2f2`, borders → removed, surfaces → gray scale.

- [ ] **Step 6: Final grep verification**

```bash
# Should return 0 results from client files:
grep -rn "#ffe01e\|#FFE01E" components/client/ app/client/ --include="*.tsx" | grep -v "var(--data"
```

If any results remain, fix them manually.

- [ ] **Step 7: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS"
```

Expected: 0 new errors (pre-existing errors in stripe/webhook etc. are unrelated).

- [ ] **Step 8: Commit**

```bash
git add components/client/
git commit -m "feat(ds4): final sweep — remaining smart components, BodyMap, SplashScreen, no yellow"
```

---

## Task 12: CHANGELOG + Project State + Docs

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add at the top of CHANGELOG.md under today's date:

```markdown
## 2026-05-21

REFACTOR: Client PWA — Design System v4.0 dark gray minimal (DS v4.0)
REFACTOR: Remove all #ffe01e yellow accent from client app
REFACTOR: Remove all border-white/* borders from client components
REFACTOR: Add --data-copper, --data-gold, --data-petrol data colors for charts
REFACTOR: Gray scale #080808→#f2f2f2 as sole UI color system in /client
CHORE: Update manifest.json + viewport themeColor to #080808
```

- [ ] **Step 2: Update project-state.md**

In `.claude/rules/project-state.md`, update the **Design System v3.0** module status entry:

```markdown
| **Design System v4.0** | ✅ Dark gray minimal — zéro couleur accent, zéro border, gray scale pur | 2026-05-21 |
```

Add a new entry under **Dernières Avancées**:

```markdown
### 2026-05-21 — Design System v4.0 — Dark Gray Minimal Client PWA

- `app/globals.css` — tokens `--c-*` (gray scale) + `--data-copper/gold/petrol` (charts)
- `tailwind.config.ts` — gray scale + data color Tailwind tokens ajoutés
- `components/client/ClientTopBar.tsx` — fond `#080808`, texte `#e0e0e0` (plus de jaune)
- `components/client/BottomNav.tsx` — actif `#f2f2f2`, inactif `#5a5a5a`, pas de border-t
- 60+ composants `/client` et `app/client` — suppression totale `#ffe01e`, borders, surfaces mises à jour
- Data colors `--data-copper/gold/petrol` — uniquement dans charts/SVG
- Boutons primary : `bg-[#f2f2f2] text-[#080808]`
- Points de vigilance : BodyMap primary muscle = `#e0e0e0` (was green); charts recharts utilisent `var(--data-*)` via style inline, pas className
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: DS v4.0 — update CHANGELOG and project-state"
```

---

## Self-Review Checklist

- [x] Spec section 1 (Gray Scale) → Task 1 covers CSS vars + Tailwind config
- [x] Spec section 2 (Data Colors) → Task 1 + Tasks 6-7 apply data colors to charts
- [x] Spec section 3 (Actions/Primary) → All CTA buttons updated in Tasks 2-10
- [x] Spec section 4 (No borders) → Borders removed in all tasks via sed + manual
- [x] Spec section 5 (Component table) → All listed components covered in Tasks 2-11
- [x] Spec section 6 (Replacement rules) → Color substitution reference at top of plan
- [x] Spec section 7 (60+ files) → All priority files covered; batch sed catches remainder
- [x] Spec section 8 (manifest + viewport) → Task 1
- [x] Spec section 9 (Validation) → TSC check in each task + final grep in Task 11
