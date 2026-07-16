---
name: landing-discovery-brief
description: Use this skill to initiate a SaaS landing page project, audit the repository, ask the right questions, and produce a reusable landing brief before design or implementation.
---

# Landing Discovery Brief Skill

## Purpose

Use this skill at the beginning of a landing page project.

The output is a clear landing brief that can be used by Codex to create, refactor, or audit the landing page.

This skill is intentionally used before coding.

---

# Step 1 — Repository audit

If a repository exists, inspect it first.

Look for:

- current landing page route;
- app framework;
- component structure;
- design system;
- reusable UI components;
- global CSS;
- theme/tokens;
- fonts;
- color palette;
- animation patterns;
- media assets;
- product copy;
- CTA links;
- pricing page;
- auth/onboarding route;
- analytics;
- previous design decisions;
- `AGENTS.md`.

Summarize what already exists.

Do not ask questions that the repo already answers.

---

# Step 2 — Product discovery

Gather the minimum necessary product context.

## Required fields

- Product name
- Product category
- Target user
- Main problem
- Desired outcome
- Current alternative or competitor
- Why existing alternatives are insufficient
- Core product mechanism
- Differentiation
- Product maturity
- Proof available
- Pricing/access model
- CTA goal
- Technical constraints
- Visual references
- Brand constraints

## Optional but useful fields

- ICP segments
- Use cases
- Objections
- Competitors
- SEO keywords
- Tone of voice
- Compliance constraints
- Supported languages
- Analytics events
- Launch deadline

---

# Step 3 — Ask questions

Ask only the missing questions.

Good discovery questions:

1. Who is the landing page for?
2. What is the main action you want the visitor to take?
3. What painful problem must the hero communicate?
4. What proof can we legally and honestly use?
5. Is the product self-serve, demo-led, waitlist-based, or enterprise?
6. Do we have real product screenshots or should we build mockups?
7. What visual direction should be avoided?
8. What existing sites should inspire the direction without being copied?

Limit the first question set to 5–8 questions.

---

# Step 4 — Create `LANDING_BRIEF.md`

The brief must include:

## 1. Context

- Product
- SaaS type
- Product maturity
- Existing repo findings

## 2. Target user

- Primary ICP
- Secondary ICP, if relevant
- User sophistication level

## 3. Problem

- Main pain
- Current workflow
- Cost of inaction
- Trigger moment

## 4. Desired result

- Functional result
- Emotional/business result
- Measurable result if available

## 5. Positioning

- One-sentence positioning
- Main differentiator
- Category framing

## 6. CTA strategy

- Primary CTA
- Secondary CTA
- CTA destination
- Microcopy
- Conversion risk

## 7. Proof

Separate:

- real proof available now;
- weak but honest credibility;
- proof missing;
- proof forbidden.

## 8. Page structure

List the recommended sections in order.

## 9. Visual direction

- mood;
- typography direction;
- color direction;
- layout direction;
- motion direction;
- interaction direction;
- examples to reference;
- examples to avoid.

## 10. Technical plan

- files likely affected;
- components to create;
- assets needed;
- dependencies;
- testing commands;
- risks.

## 11. Assumptions

List assumptions clearly.

## 12. Open questions

List only questions that truly block implementation.

---

# Step 5 — Approval gate

Before implementing, present the brief and ask for approval unless the user explicitly asked to continue without review.

If approval is given, pass the brief to:

- `saas-landing-structure`;
- `landing-visual-ui-motion`;
- `codex-ui-execution-qa`.
