---
name: codex-ui-execution-qa
description: Use this skill to execute UI work in Codex with repository context, AGENTS.md, focused prompts, visual QA, responsive checks, and production-grade delivery.
---

# Codex UI Execution QA Skill

## Purpose

Use this skill when implementing or refactoring a landing page in a real codebase.

This skill defines how Codex should work:

- read project context;
- follow `AGENTS.md`;
- use skills intentionally;
- implement in small coherent steps;
- inspect the result visually;
- correct visible issues;
- verify responsiveness;
- run checks;
- report clearly.

---

# 1. Context setup

Before writing code:

1. Read `AGENTS.md` if present.
2. Read project README or docs.
3. Identify framework and routing.
4. Identify design system and UI components.
5. Inspect existing landing page.
6. Inspect global styles and tokens.
7. Inspect assets and media.
8. Identify available scripts:
   - lint;
   - typecheck;
   - test;
   - build;
   - dev.

If `AGENTS.md` does not exist, propose creating one.

---

# 2. First implementation prompt discipline

Do not use vague prompts.

Bad:

> Make it look better.

Good:

> Refactor the landing page hero to use a two-column product-first layout. Preserve the existing stack and components. Use the approved landing brief. Keep the primary CTA consistent. Do not invent proof. Make the section responsive. Then run lint and visually inspect desktop and mobile.

---

# 3. Work in coherent slices

Prefer slices such as:

1. structure and content;
2. hero and nav;
3. product visuals;
4. proof and problem sections;
5. solution and how-it-works;
6. pricing/access and FAQ;
7. motion and polish;
8. responsive QA;
9. accessibility and performance pass.

Avoid changing the entire codebase blindly.

---

# 4. Visual QA loop

After coding, inspect the rendered page.

Check:

- desktop;
- tablet;
- mobile;
- long page scroll;
- hero above the fold;
- CTA visibility;
- typography;
- spacing;
- alignment;
- contrast;
- product image readability;
- animation behavior;
- reduced-motion behavior;
- footer and legal links.

If the UI is not responsive, fix it before final delivery.

Do not claim visual quality without inspecting the rendered result.

---

# 5. Annotation-style iteration

When a specific area is weak, target that exact area.

Examples:

- “In the hero, increase headline contrast and reduce paragraph width.”
- “In the pricing section, align plan cards and make the recommended plan more distinct without adding fake urgency.”
- “In mobile, collapse the three-column feature grid into stacked cards with better vertical spacing.”
- “In the chart mockup, add readable axes and tooltips.”
- “In the testimonial block, reduce visual weight and improve spacing.”

Avoid broad commands such as:

- “make it premium”;
- “make it modern”;
- “improve UI”.

---

# 6. Responsive requirements

Minimum breakpoints:

- mobile;
- tablet;
- desktop.

Rules:

- nav collapses cleanly;
- hero stacks correctly;
- product screenshots remain readable;
- feature grids collapse;
- pricing cards stack;
- CTAs stay accessible;
- no horizontal scroll;
- no clipped text;
- no unreadable overlays.

---

# 7. Accessibility requirements

Implement:

- semantic sections;
- accessible buttons and links;
- focus states;
- alt text;
- labels where needed;
- sufficient contrast;
- reduced motion;
- no keyboard traps;
- no content that only appears on hover.

---

# 8. Performance requirements

Check for:

- oversized images;
- unoptimized video;
- blocking animation scripts;
- unnecessary dependencies;
- layout shift;
- heavy assets above the fold.

Optimize:

- images;
- lazy-loading;
- poster frames;
- critical CSS when relevant;
- dependency usage.

---

# 9. Testing and commands

Run available commands:

- lint;
- typecheck;
- test;
- build.

Use the commands defined in the project.

If a command is unavailable, say so.

If a command fails, report:

- command;
- error summary;
- likely cause;
- whether it is related to this task;
- what was fixed or what remains.

---

# 10. Final report

The final report must include:

- changed files;
- sections created/updated;
- design direction implemented;
- proof omitted because unavailable;
- commands run;
- visual QA performed;
- responsive state;
- accessibility considerations;
- performance considerations;
- remaining risks/TODOs.

---

# Hard rules

Do not:

- invent product facts;
- invent customer proof;
- invent pricing;
- claim tests passed if they did not run;
- claim visual QA if the page was not opened or inspected;
- add dependencies without justification;
- copy inspiration screens directly;
- ship placeholders;
- leave broken links or CTAs.
