---
name: client-sheet-design-system
description: Canonical STRYVR client-app bottom-sheet design and implementation rules. Use whenever creating, restyling, or reviewing a client sheet, modal drawer, quick action panel, input sheet, or conversation sheet in the client application.
---

# Client Sheet Design System

Use this skill as the source of truth for client-app sheets. Read `references/client-sheet-reference.md` when implementing or reviewing a sheet.

## Required implementation

- Render global sheets with a portal into `document.body` so they are not trapped by dashboard stacking contexts or hidden behind the client bottom navigation.
- Use `z-[60]` for the backdrop and `z-[70]` for the sheet. Do not place the sheet below the client bottom navigation (`BottomNav` uses `z-40`).
- Lock body scrolling while the sheet is open with `useBodyScrollLock`.
- Use a bottom-anchored sheet: `fixed left-0 right-0 bottom-0`, `rounded-t-[28px]`, `background: #0d0d0d`, `max-height: 88dvh`, column flex layout.
- Add safe-area padding: `paddingBottom: max(env(safe-area-inset-bottom), 16px)`.
- Add the centered drag handle: `mt-2 h-1 w-10 rounded-full bg-white/[0.10]`.
- Use the standard header: `px-5 pt-5 pb-4`, condensed uppercase title at `15px`, `font-barlow-condensed`, `font-bold`, `tracking-[0.12em]`, white; close button `w-8 h-8`, `rounded-xl`, `bg-white/[0.06]`, muted icon.
- Keep content scrollable with `flex-1 min-h-0 overflow-y-auto`; keep the action/input footer `shrink-0` so it remains visible.
- Use `bg-white/[0.03]` / `bg-white/[0.045]` surfaces, white-opacity text, and existing Phosphor/Lucide icons. Avoid introducing a new visual language.
- Close on backdrop tap and close button. Preserve safe-area and keyboard visibility for text inputs.

## Conversation sheets

- Use the same sheet shell as `QuickWaterModal`.
- Put the conversation body in `flex-1 min-h-0 overflow-y-auto`.
- Put the composer in a `shrink-0` footer with a top border; never let it scroll underneath the bottom navigation.
- Use a dedicated notification payload/action to open the sheet instead of routing to `/client`.
- Keep automated AI/system messages distinguishable from human coach messages; only human coach messages should open the coach-message sheet.

