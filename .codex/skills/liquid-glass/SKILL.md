---
name: liquid-glass
description: Apply a restrained Apple-style liquid glass refraction effect to small web surfaces. Use when the user explicitly asks for liquid glass, real glass refraction, iOS-style glass, or a premium frosted-glass treatment for a navigation bar, card, modal, or CTA.
---

# Liquid Glass

Use this skill only after the page hierarchy, copy, accessibility, and responsive layout are already sound. Liquid glass is a material treatment, never a substitute for product visuals or visual hierarchy.

## Source and asset

- Upstream: `https://github.com/deepika-builds/liquid-glass` (MIT).
- Bundled module: `assets/liquid-glass.js`.
- The module provides real rim refraction in Chromium and an automatic frosted-blur fallback in Safari and Firefox.

## Decision rules

- Apply it only when explicitly requested or when the approved visual direction names it.
- Restrict it to one or two small, non-essential surfaces per view: a nav, floating CTA, modal, or premium plan callout.
- Never use it for primary copy, dense forms, product screenshots, every card, or any surface larger than roughly `800px` per side.
- Do not use it where the background is too flat to make the refraction legible; a restrained translucent surface is preferable.
- Preserve the no-glass direction when `AGENTS.md` or the approved landing brief excludes glass effects.

## Next.js / React integration

1. Copy `assets/liquid-glass.js` into the target project, for example `public/vendor/liquid-glass.js`, and retain the MIT license notice.
2. Load it only in a client component, then call `window.liquidGlass(ref.current, options)` inside `useEffect`.
3. Always call `destroy()` in the cleanup function.
4. Keep visual dressing in CSS: border radius, subtle tint, an inner highlight, and a readable foreground.
5. Verify Chromium plus Safari/Firefox fallback and mobile performance before delivery.

Use subtle defaults for a marketing page:

```ts
{ scale: -60, chroma: 4, blur: 4, saturate: 1.15, fallbackBlur: 14 }
```

Reduce `scale` or `chroma` if text smears; increase `border` or `blur` before making the surface opaque. Do not reimplement the SVG filter: reuse the bundled module, which already sets the required `color-interpolation-filters="sRGB"` attribute.

## Motion and accessibility

- Refraction must never communicate meaning or gate an interaction.
- Do not animate the element’s size while the effect is active; position-only transforms are acceptable.
- Respect `prefers-reduced-motion`: keep the static surface and disable decorative motion around it.
- Preserve keyboard focus, contrast, visible labels, and all controls in the fallback state.
- Ensure the surface remains usable without `backdrop-filter` support.

## Required QA

- Inspect the surface against a real page background in Chromium.
- Check Safari/Firefox fallback visually or through feature simulation.
- Check a mobile width and confirm no horizontal overflow or degraded text contrast.
- Confirm that only intentional surfaces use the effect and that no screenshots, forms, or core content are blurred.
