# Client Sheet Reference

Canonical source files:

- `components/client/QuickLogSheet.tsx`
- `components/client/QuickWaterModal.tsx`
- `components/client/BottomNav.tsx`

## Shell

- Backdrop: `fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]`.
- Sheet: `fixed left-0 right-0 bottom-0 z-[70] rounded-t-[28px] bg-[#0d0d0d] shadow-2xl`.
- Height: `max-height: 88dvh`; use a column flex layout.
- Bottom inset: `max(env(safe-area-inset-bottom), 16px)`.
- Drag handle: `mx-auto mt-2 h-1 w-10 rounded-full bg-white/[0.10]`.
- Render through `createPortal(..., document.body)` for global overlays.

## Header

- Horizontal padding `px-5`.
- Top/bottom spacing `pt-5 pb-4`.
- Title: `text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white`.
- Close control: `w-8 h-8 rounded-xl bg-white/[0.06] text-white/40`, with active state `bg-white/[0.08]`.

## Content and footer

- Content: `flex-1 min-h-0 overflow-y-auto`.
- Footer/input: `shrink-0`, never inside scrolling content.
- Standard surfaces: `rounded-xl` or `rounded-2xl`, `bg-white/[0.03]` to `bg-white/[0.045]`.
- Muted labels use condensed uppercase typography around `10px`, `text-white/32` to `text-white/40`.
- Keep the footer above the safe-area and keyboard; do not use a fixed footer outside the sheet.

## Interaction

- Animate the sheet from `y: "100%"` with a spring around stiffness `300`, damping `30` when using Framer Motion.
- Close when tapping the backdrop or close button.
- Keep bottom navigation below the overlay; `BottomNav` is `z-40`, so sheet layers must remain `z-60`/`z-70`.
