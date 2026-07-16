---
name: landing-workflow-orchestrator
description: Use this skill to orchestrate the complete workflow for creating, refactoring, or auditing a SaaS landing page with strong structure, premium UI, motion, and production-grade Codex execution.
---

# Landing Workflow Orchestrator

## Purpose

Use this skill as the main entry point for any SaaS landing page project.

It coordinates the full workflow:

1. Discovery
2. Repository audit
3. Landing brief
4. Design direction
5. Conversion structure
6. Visual UI / motion direction
7. Implementation
8. Visual QA
9. Final delivery report

The goal is to prevent generic AI output and create landing pages that are:

- structurally strong;
- visually distinctive;
- conversion-oriented;
- maintainable in the existing codebase;
- responsive;
- accessible;
- performance-aware.

---

## Core principle

Do not start designing or coding before the product, user, conversion goal, proof, and visual direction are clear.

If a repository exists, inspect it before asking questions. Use the repo as the first source of truth.

---

# Workflow

## Phase 1 — Repo and context audit

Before asking the user questions, inspect the project.

Look for:

- framework and routing structure;
- existing landing page;
- design system;
- components;
- tokens;
- typography;
- colors;
- layout patterns;
- animation libraries;
- images and media;
- existing copy;
- product naming;
- routes;
- CTA destinations;
- analytics setup;
- accessibility patterns;
- README, docs, `AGENTS.md`, design notes, product specs.

If `AGENTS.md` exists, read it and follow it.

If `AGENTS.md` does not exist, propose creating one using the template from this workflow.

Do not scan unrelated folders outside the project context.

---

## Phase 2 — Discovery questions

After the repo audit, ask only the missing questions.

Limit to the smallest useful set.

Required discovery fields:

1. Product name
2. Target user
3. Main problem
4. Desired outcome
5. Core product mechanism
6. Primary CTA
7. Secondary CTA, if any
8. SaaS type:
   - self-serve;
   - demo-led B2B;
   - early-stage;
   - complex platform.
9. Product maturity
10. Available proof:
   - testimonials;
   - logos;
   - usage numbers;
   - case studies;
   - beta users;
   - founder credibility;
   - product demo;
   - screenshots.
11. Pricing or access model
12. Visual direction
13. Inspiration references, if any
14. Hard constraints
15. What must be avoided

If the user cannot answer everything, create explicit assumptions and mark them as assumptions.

---

## Phase 3 — Create the landing brief

Produce a `LANDING_BRIEF.md` or equivalent summary before implementation.

The brief must include:

- positioning;
- target user;
- conversion goal;
- CTA strategy;
- messaging hierarchy;
- section structure;
- proof available;
- proof missing;
- design direction;
- motion direction;
- accessibility constraints;
- performance constraints;
- implementation plan;
- open questions or assumptions.

Ask for approval before implementation unless the user explicitly asked to proceed directly.

---

## Phase 4 — Choose skills

Use the following specialized skills:

1. `landing-discovery-brief`  
   For intake, repo audit, questions, and brief creation.

2. `saas-landing-structure`  
   For conversion architecture and section order.

3. `landing-visual-ui-motion`  
   For visual direction, premium UI, layout, spacing, motion, and “wow effect”.

4. `codex-ui-execution-qa`  
   For implementation discipline, visual review, responsive checks, and final QA.

---

## Phase 5 — Implementation

Implement only after the brief is clear.

Rules:

- Respect the existing stack.
- Do not add dependencies unless necessary.
- Preserve project conventions.
- Use reusable components when appropriate.
- Keep content maintainable.
- Use semantic HTML.
- Optimize media.
- Respect accessibility.
- Avoid fake proof.
- Avoid unsupported claims.
- Keep CTA logic consistent.

---

## Phase 6 — Visual QA loop

After implementation:

1. Open the page locally.
2. Capture or inspect desktop.
3. Capture or inspect tablet.
4. Capture or inspect mobile.
5. Check layout, hierarchy, spacing, typography, motion, CTA visibility, and readability.
6. Fix visible issues.
7. Repeat until the page is visually coherent.

Do not rely only on code review. A landing page must be reviewed visually.

---

## Phase 7 — Final delivery report

Return a concise report:

- sections created or changed;
- files changed;
- design assumptions;
- proof intentionally omitted;
- commands run;
- visual QA performed;
- known limitations;
- next recommended step.

---

# Hard rules

Never invent:

- testimonials;
- customer logos;
- user numbers;
- ratings;
- revenue claims;
- performance claims;
- compliance claims;
- pricing;
- guarantees.

Never prioritize motion over:

1. message clarity;
2. readability;
3. conversion;
4. accessibility;
5. performance.

Never ship:

- placeholder text;
- broken CTA;
- unreadable mobile UI;
- non-responsive layouts;
- decorative motion without fallback;
- copied inspiration design.
