# Codex SaaS Landing Workflow

A reusable Codex workflow for creating, refactoring, or auditing high-quality SaaS landing pages.

This pack combines five layers:

1. **Discovery & Briefing**  
   Extract product, market, user, visual direction, proof, constraints, and repository context.

2. **SaaS Landing Structure**  
   Build the conversion architecture: hero, problem, proof, solution, demo, pricing/access, FAQ, CTA.

3. **Design Intelligence & Visual Direction**  
   Use `ui-ux-pro-max` to generate and challenge the design-system choices, then use the landing visual skill to translate them into a product-first direction.

4. **Motion & Material**  
   Use Framer Motion for restrained React motion. Use Liquid Glass only when the approved brief explicitly calls for it, on a few small surfaces with a fallback.

5. **Codex Execution & Visual QA**  
   Force Codex to inspect the repo, respect `AGENTS.md`, implement clean code, open the result, check desktop/tablet/mobile, and iterate.

## Skill stack and order

1. `landing-workflow-orchestrator` — coordinates the phases and protects proof integrity.
2. `landing-discovery-brief` — audits the repo and produces `LANDING_BRIEF.md`.
3. `saas-landing-structure` — defines the conversion architecture.
4. `ui-ux-pro-max` — generates a stack-aware design-system recommendation and checks UI/UX anti-patterns. It informs the direction but never overrides the existing product design, `AGENTS.md`, or approved brief.
5. `landing-visual-ui-motion` — turns the approved direction into a premium, product-first composition.
6. `liquid-glass` — optional material layer for one or two small surfaces only; use only if the brief or user explicitly requests it.
7. Framer Motion — default React runtime for purposeful entrance, state, and layout motion. Use GSAP only for a genuinely advanced scroll sequence and only when its matching skill is available.
8. `codex-ui-execution-qa` — runs implementation discipline and visual QA.

Installed project skills:

- `.codex/skills/ui-ux-pro-max/SKILL.md`
- `.codex/skills/liquid-glass/SKILL.md`
- `.agents/skills/gsap-*/SKILL.md` when GSAP is needed

Framer Motion is already a project dependency. Do not add an animation library unless the repository lacks the capability required by the approved brief.

## Recommended usage

Start with:

```text
Use the landing-workflow-orchestrator skill. First audit the repository and existing site if present. Then ask me only the missing questions needed to create the landing brief. Do not implement yet.
```

Then, after the brief is approved:

```text
Use the approved landing brief, AGENTS.md, and the landing-workflow-orchestrator skill. Implement the landing page. Run available checks and perform visual QA at desktop, tablet, and mobile sizes.
```

If the brief asks for a glass treatment, add this constraint:

```text
Use the liquid-glass skill only for the approved surfaces. Keep Framer Motion restrained, preserve reduced-motion behavior, and verify the Safari/Firefox fallback.
```

## Files

- `skills/landing-workflow-orchestrator/SKILL.md`
- `skills/landing-discovery-brief/SKILL.md`
- `skills/saas-landing-structure/SKILL.md`
- `skills/landing-visual-ui-motion/SKILL.md`
- `skills/codex-ui-execution-qa/SKILL.md`
- `.codex/skills/ui-ux-pro-max/SKILL.md`
- `.codex/skills/liquid-glass/SKILL.md`
- `templates/AGENTS.template.md`
- `templates/LANDING_BRIEF.template.md`
- `prompts/01_start_discovery.md`
- `prompts/02_create_or_update_agents.md`
- `prompts/03_implement_landing.md`
- `prompts/04_visual_qa_iteration.md`
- `qa/LANDING_ACCEPTANCE_CHECKLIST.md`
