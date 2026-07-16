---
name: landing-visual-ui-motion
description: Use this skill to define premium UI, UX, visual direction, layout, and motion for a modern SaaS landing page without sacrificing clarity, accessibility, or performance.
---

# Landing Visual UI Motion Skill

## Purpose

Use this skill after the landing structure is clear.

This skill adds visual distinction, premium UI, product storytelling, and controlled motion.

It must never override message clarity or conversion logic.

Priority order:

1. Message clarity
2. Visual hierarchy
3. Conversion
4. Accessibility
5. Performance
6. Brand distinction
7. Motion / wow effect

---

# Visual direction principles

## 1. Strong first impression

A modern SaaS landing page should feel intentional immediately.

Use:

- strong hero composition;
- confident typography;
- product-first visuals;
- clean spacing;
- controlled contrast;
- distinct but restrained motion.

Avoid:

- generic AI cards;
- random gradients;
- template SaaS look;
- decorative icons everywhere;
- fake glassmorphism;
- excessive glow effects;
- motion that hides the message.

---

## 2. Product-first design

Show the product or workflow early.

Prioritize:

1. real product screenshots;
2. realistic product mockups;
3. annotated interface;
4. interactive walkthrough;
5. workflow visualization;
6. abstract visuals only when product visuals are unavailable.

The landing should make the product feel real.

---

## 3. Hero composition

Possible hero patterns:

### Split hero

- copy left;
- product visual right;
- best for clear SaaS positioning.

### Centered editorial hero

- large headline;
- CTA below;
- product visual underneath;
- best for strong brand pages.

### Cinematic hero

- video or animated visual;
- text layered carefully;
- best for premium launches.

### Dashboard hero

- large product UI preview;
- short headline;
- proof strip;
- best for B2B SaaS.

Choose the pattern based on product and target user.

---

# Design system rules

## Typography

Use a clear type scale.

Recommended default:

- H1: 56–88px desktop, 38–48px mobile
- H2: 40–64px desktop, 30–40px mobile
- H3: 24–32px
- Body: 16–18px
- Small: 13–15px

Rules:

- strong contrast between headings and body;
- avoid too many font weights;
- avoid all-uppercase long text;
- body text must remain readable;
- line length should be controlled.

## Spacing

Use a consistent spacing scale.

Example:

- 4
- 8
- 12
- 16
- 24
- 32
- 48
- 64
- 96
- 128

Rules:

- sections need breathing room;
- related elements should be closer;
- unrelated sections need larger separation;
- desktop spacing must collapse intelligently on mobile.

## Layout

Use:

- max-width containers;
- clear grids;
- intentional asymmetry only when controlled;
- responsive stacking;
- strong above-the-fold layout.

Avoid:

- random card grids;
- inconsistent alignment;
- cramped mobile layouts;
- over-wide paragraphs.

## Color

Use a small palette:

- background;
- primary text;
- secondary text;
- border;
- surface;
- accent;
- success/warning/error if needed.

Rules:

- accent color should guide attention, not decorate everything;
- contrast must remain accessible;
- avoid rainbow cards;
- avoid arbitrary gradients.

## Cards and surfaces

Use cards only when they clarify grouping.

Good cards:

- feature modules;
- pricing plans;
- proof blocks;
- product annotations.

Bad cards:

- decorative blocks with no role;
- identical cards everywhere;
- cards with vague copy.

---

# Motion rules

Motion is allowed only if it supports comprehension, focus, or perceived quality.

Good motion:

- subtle entrance animations;
- product walkthrough reveal;
- sticky product preview;
- scroll-progress storytelling;
- hover states;
- micro-interactions;
- video demo;
- before/after transition.

Bad motion:

- motion that delays reading;
- motion that hides CTAs;
- scroll hijacking;
- constant background movement;
- heavy parallax;
- effects with no purpose.

## Scroll-tied video

Allowed only if:

- it supports the product story;
- text remains readable;
- fallback exists;
- mobile performance is acceptable;
- reduced-motion mode is respected;
- the video is optimized.

## Required reduced motion fallback

Implement `prefers-reduced-motion`.

If the user prefers reduced motion:

- disable scroll-tied animation;
- show static frames;
- keep content accessible;
- avoid forced autoplay motion.

---

# Visual inspiration rules

References can guide style, but must not be copied.

Extract:

- layout principles;
- hierarchy;
- density;
- spacing;
- contrast;
- motion rhythm;
- product presentation style.

Do not copy:

- exact layout;
- brand identity;
- wording;
- illustrations;
- proprietary visuals;
- customer logos;
- distinctive composition.

---

# Mobile UX rules

Mobile is not a compressed desktop page.

Mobile must:

- show value proposition quickly;
- keep CTA accessible;
- avoid tiny product screenshots;
- simplify grids;
- stack content intentionally;
- reduce motion;
- keep text readable;
- avoid horizontal scroll.

For complex product screenshots, use:

- cropped focused views;
- carousel;
- stacked annotations;
- simplified mockups.

---

# Accessibility rules

Required:

- semantic HTML;
- alt text;
- keyboard accessible buttons/links;
- focus states;
- sufficient contrast;
- readable font sizes;
- reduced-motion support;
- no content conveyed only through animation;
- no autoplay audio.

---

# Performance rules

A premium landing must still load fast.

Rules:

- optimize images;
- use modern formats when possible;
- lazy-load below-the-fold media;
- preload critical hero media only if necessary;
- compress video;
- use poster images;
- avoid heavy JS animation libraries unless already present;
- avoid adding dependencies for one-off effects.

Performance risk must be reported if using:

- background video;
- scroll-linked animation;
- large image sequences;
- 3D assets;
- heavy canvas/WebGL.

---

# Design QA checklist

Before final delivery, inspect:

## Hero

- Is the headline immediately readable?
- Is the product/category clear?
- Is CTA visible?
- Is the visual supporting the message?

## Hierarchy

- Are section priorities obvious?
- Are titles stronger than body?
- Are paragraphs too long?

## Layout

- Is spacing consistent?
- Are columns aligned?
- Are grids balanced?
- Does mobile stack correctly?

## Motion

- Does motion support comprehension?
- Does reduced-motion fallback work?
- Is anything distracting?

## Conversion

- Are CTAs consistent?
- Is proof near high-friction points?
- Are objections handled?

## Finish

- Does it look custom, not AI-generated?
- Are there placeholders?
- Are visual details polished?
