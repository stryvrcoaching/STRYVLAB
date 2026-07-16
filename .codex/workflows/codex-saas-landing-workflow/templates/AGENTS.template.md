# AGENTS.md — Landing Page Design & Execution Rules

## Project identity

Product name: `<fill>`
Product category: `<fill>`
Target user: `<fill>`
Primary CTA: `<fill>`
Secondary CTA: `<fill or none>`

## Product positioning

Describe the product in one sentence:

> `<Product>` helps `<target user>` achieve `<desired result>` by `<core mechanism>`.

## Visual direction

Use this direction:

- `<premium / minimal / editorial / technical / playful / enterprise / etc.>`
- `<light / dark / mixed>`
- `<product-first / cinematic / data-heavy / content-led / etc.>`

The UI should feel:

- clear;
- specific;
- intentional;
- modern;
- trustworthy;
- non-generic.

## Brand tone

The copy should be:

- direct;
- concrete;
- benefit-driven;
- free from hype;
- easy to understand.

Avoid:

- vague startup claims;
- excessive buzzwords;
- fake urgency;
- unsupported guarantees.

## Typography

Preferred font direction:

- modern sans-serif;
- strong heading hierarchy;
- readable body copy;
- controlled line length.

Type scale guidance:

- H1: 56–88px desktop, 38–48px mobile
- H2: 40–64px desktop, 30–40px mobile
- H3: 24–32px
- Body: 16–18px
- Small: 13–15px

## Color system

Define tokens before styling:

- background
- surface
- text-primary
- text-secondary
- border
- accent
- accent-hover
- success
- warning
- error

Do not use arbitrary colors outside the palette.

## Layout and spacing

Use a consistent spacing scale:

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

- align sections to a consistent container;
- keep text widths readable;
- use whitespace intentionally;
- avoid cramped card grids;
- collapse layouts cleanly on mobile.

## Components

Reuse existing components when available.

If creating new components:

- keep them small;
- name them clearly;
- make them reusable when appropriate;
- avoid one giant page component.

## Motion

Motion is allowed only when it supports comprehension or polish.

Allowed:

- subtle entrance animations;
- hover states;
- product reveal;
- scroll-progress storytelling;
- short demo animation.

Forbidden:

- scroll hijacking;
- distracting infinite loops;
- animation that hides text;
- heavy motion without fallback.

Always support `prefers-reduced-motion`.

Use Framer Motion as the default React motion layer. Use GSAP only for an
approved advanced scroll sequence, and never let both libraries animate the
same element or CSS property.

## Material treatment

Liquid Glass is opt-in, never a default visual style.

If the approved brief selects it:

- limit it to one or two small, non-essential surfaces;
- keep forms, screenshots, dense content, and core copy free of refraction;
- provide the Safari/Firefox frosted fallback;
- preserve a legible static surface and verify mobile performance.

If the brief does not select it, do not add glass merely for decoration.

## Product visuals

Prefer:

1. real product screenshots;
2. realistic product mockups;
3. annotated UI;
4. workflow diagrams;
5. abstract visuals only when necessary.

Do not use fake customer data unless clearly marked as sample data.

## Proof rules

Never invent:

- testimonials;
- customer logos;
- reviews;
- ratings;
- usage numbers;
- revenue claims;
- compliance claims.

If proof is missing, use honest credibility:

- beta;
- waitlist;
- founder/domain expertise;
- product walkthrough;
- pilot users if true.

## Accessibility

Required:

- semantic HTML;
- alt text;
- focus states;
- keyboard accessibility;
- sufficient contrast;
- readable mobile text;
- reduced motion;
- no content conveyed only through color or animation.

## Responsive rules

Check:

- mobile;
- tablet;
- desktop.

Required:

- no horizontal scroll;
- readable product visuals;
- stacked mobile sections;
- usable nav;
- visible CTA;
- unclipped text.

## Performance

Avoid unnecessary dependencies.

Optimize:

- images;
- video;
- font loading;
- lazy-loaded below-the-fold media;
- heavy animations.

## Do

- sell outcomes before features;
- keep CTA logic consistent;
- show the product early;
- use real proof only;
- perform visual QA;
- run available checks.

## Do not

- create generic SaaS template UI;
- use random gradients;
- overuse glassmorphism;
- apply Liquid Glass without explicit brief approval;
- add fake testimonials;
- add fake logos;
- use placeholder text in production;
- ship without mobile QA;
- claim checks passed if not run.
