# STRYVR — Quick Start Guide for Claude Sessions

> **How to quickly understand and contribute to STRYVR in your next session**
>
> Use this as your checklist when you start working on STRYVR.

---

## 🚀 FIRST 5 MINUTES: Context Loading

### 1. Read the Strategic North Star (2 min)
Start with **one of these**:
- **For product/feature work**: `docs/STRYVR_STRATEGIC_VISION_2026.md` (full vision)
- **For architecture/tech work**: `docs/EXECUTIVE_SUMMARY_STRYVR_2026.md` (1-page summary)
- **For quick reference**: `docs/STRATEGIC_DOCS_INDEX.md` (master index)

### 2. Check Current State (1 min)
Read `.claude/rules/project-state.md` — what was built last, what's next.

### 3. Understand the Philosophy (1 min)
Skim `.claude/CLAUDE.md` — stack, rules, non-negotiables.

### 4. Verify Your Task Aligns (1 min)
Use `docs/DECISION_FRAMEWORK_VISION_ALIGNMENT.md` to check:
- Does this help adherence?
- Does this remove friction?
- Does it feed the personalization flywheel?

---

## 📚 KEY DOCUMENTS (by Task Type)

### If You're Building a Feature
1. **Vision alignment**: `docs/DECISION_FRAMEWORK_VISION_ALIGNMENT.md`
2. **Design rules**: `docs/PRODUCT_PHILOSOPHY_ANTI_FRUSTRATION.md`
3. **Technical foundation**: `.claude/rules/database-patterns.md`
4. **Commit conventions**: `.claude/rules/git-atomic-commits.md` (skill)

### If You're Reviewing Code
1. **Design system**: `docs/DESIGN_SYSTEM_V2.0_REFERENCE.md`
2. **Product philosophy**: `docs/PRODUCT_PHILOSOPHY_ANTI_FRUSTRATION.md`
3. **Code rules**: `.claude/CLAUDE.md`
4. **Use review skill**: `code-review` (skill)

### If You're Planning the Roadmap
1. **Strategic vision**: `docs/STRYVR_STRATEGIC_VISION_2026.md`
2. **Decision framework**: `docs/DECISION_FRAMEWORK_VISION_ALIGNMENT.md`
3. **Current state**: `.claude/rules/project-state.md`

### If You're Evaluating a Partnership/Investor Question
1. **Impact statement**: `docs/IMPACT_STATEMENT_STRYVR.md`
2. **Executive summary**: `docs/EXECUTIVE_SUMMARY_STRYVR_2026.md`
3. **Strategic vision**: `docs/STRYVR_STRATEGIC_VISION_2026.md` (deep dive)

---

## ⚡ THE 3-SECOND DECISION TEST

Before working on **anything**, ask:

```
1. Does this help clients adhere longer?    YES / NO
2. Does this remove friction?               YES / NO
3. Does it feed the flywheel (data→intel→personalize)?  YES / NO
```

- **All YES** → Core feature, prioritize
- **Some YES** → Tier 2/3, nice-to-have
- **All NO** → Probably not our focus now

---

## 🎯 QUICK REFERENCE: The Three Pillars

### Pillar 1: Coaching Platform
- **For whom**: Coaches (beginners to experts)
- **What**: Protocol builder + intelligence + analytics
- **Key features**: Templates, Lab mode, AI recommendations
- **Reference**: MacroFactor (nutrition), Stronger by Science (science)

### Pillar 2: Client App
- **For whom**: Fitness clients
- **What**: Daily data entry (< 5 minutes, beautiful)
- **Key features**: Session logging, weight tracking, performance trending
- **Success metric**: 60%+ daily active users

### Pillar 3: Ecosystem (Future)
- **2026**: Wearables integration
- **2027**: Smart restaurants (meals customized to macros)
- **2028+**: Sport centers + live coaching

---

## 🚫 ANTI-PATTERNS (Never Do These)

```
❌ Dark patterns (guilt notifications, fear-driven streaks)
❌ Features that add friction to client data entry
❌ Removing coach judgment (always augment, never replace)
❌ Hiding data from users (vendor lock-in)
❌ Paywall on essential data (paywall on nice-to-have features only)
❌ Neglecting accessibility (WCAG 2.1 AA is non-negotiable)
❌ Over-engineering before shipping (speed > perfection)
❌ Committing code without TypeScript strict mode (0 errors required)
```

---

## ✅ ALWAYS DO THESE

```
✅ Start with data model (schema first, UI second)
✅ Use TypeScript strict mode (npx tsc --noEmit)
✅ Update CHANGELOG.md after every change
✅ Update project-state.md after every feature
✅ Test features on real coaches + clients
✅ Measure impact on daily engagement metrics
✅ Design for beginner first, unlock depth second
✅ Make every coach feature = measurable client impact
```

---

## 📊 SUCCESS METRICS (What We Measure)

| Metric | Target | Why |
|--------|--------|-----|
| **Daily active users (clients)** | 60%+ | If clients log daily, personalization works |
| **Client NPS** | > 60 | Clients love the app |
| **Coach NPS** | > 50 | Coaches recommend to peers |
| **Protocol adherence rate** | > 70% | Clients finish assigned protocols |
| **Monthly churn (coaches)** | < 5% | Coaches stay |
| **Onboarding time (coaches)** | < 15 min | Easy to get started |
| **Data entry time (clients)** | < 5 min | Frictionless |

---

## 🛠 COMMON TASKS & QUICK LINKS

### "I need to add a coach feature"
1. Check alignment: Does it save coach time or enable better coaching?
2. Read: `docs/PRODUCT_PHILOSOPHY_ANTI_FRUSTRATION.md` (progressive disclosure)
3. Design: Start with 3 UI elements max
4. Review: Use `code-review` skill before merging

### "I need to fix a client app UX issue"
1. Check: Is this removing friction from data entry?
2. Read: `docs/DESIGN_SYSTEM_V2.0_REFERENCE.md` (tokens, components)
3. Measure: Will this increase daily active users?
4. Test: On real mobile device before merge

### "I'm adding a new data model entity"
1. Design schema first (DB = runtime truth)
2. Use `prisma-schema` skill for safe migration
3. Add RLS policies (multi-tenant isolation)
4. Seed with idempotent upserts
5. Update project-state.md

### "I'm implementing a major feature"
1. Use `superpowers:writing-plans` skill to plan it
2. Use `feature-slice` skill to ensure complete implementation
3. Use `code-review` skill before merging
4. Update project-state.md with implementation details

---

## 🎓 LEARNING RESOURCES

### For Product Understanding
- **Vision**: `docs/STRYVR_STRATEGIC_VISION_2026.md` (30 min)
- **Philosophy**: `docs/PRODUCT_PHILOSOPHY_ANTI_FRUSTRATION.md` (20 min)
- **Decision rules**: `docs/DECISION_FRAMEWORK_VISION_ALIGNMENT.md` (15 min)

### For Technical Foundations
- **Stack**: `.claude/CLAUDE.md` (5 min)
- **Database patterns**: `.claude/rules/database-patterns.md` (10 min)
- **Inngest**: `.claude/rules/inngest-patterns.md` (5 min)
- **Feature delivery**: `.claude/rules/feature-delivery.md` (5 min)

### For Design System
- **DS v2.0**: `docs/DESIGN_SYSTEM_V2.0_REFERENCE.md` (20 min)
- **UI patterns**: `docs/ui-design-system.md` (10 min)

---

## 🔄 WORKFLOW CHECKLIST (Every Session)

- [ ] Read strategic vision (5 min)
- [ ] Check project-state.md for latest work
- [ ] Verify task aligns with vision (3-second test)
- [ ] Run `npx tsc --noEmit` before working
- [ ] Make changes
- [ ] Run `npx tsc --noEmit` after changes
- [ ] Update CHANGELOG.md
- [ ] Update project-state.md (if feature)
- [ ] Commit with atomic message
- [ ] Don't push until reviewed (if team context)

---

## 🎯 WHEN IN DOUBT

### Which document should I read?
→ `docs/STRATEGIC_DOCS_INDEX.md` (master index)

### Is this feature aligned with vision?
→ Use the **3-second decision test** (above)

### How should I design this?
→ `docs/PRODUCT_PHILOSOPHY_ANTI_FRUSTRATION.md`

### Should we build this now or later?
→ `docs/DECISION_FRAMEWORK_VISION_ALIGNMENT.md` (prioritization tiers)

### What's the tech stack?
→ `.claude/CLAUDE.md` (imports section)

### What's the current state?
→ `.claude/rules/project-state.md` (living state)

### How do I write a good commit?
→ Use `git-atomic-commits` skill before committing

### How do I know my code is good?
→ Use `code-review` skill or `superpowers:verification-before-completion` skill

---

## 🎬 START YOUR NEXT SESSION

**Copy this checklist:**

```
[ ] Read docs/STRYVR_STRATEGIC_VISION_2026.md (north star)
[ ] Check .claude/rules/project-state.md (current state)
[ ] Read CLAUDE.md (stack, rules)
[ ] Use 3-second test on my task
[ ] Run `npx tsc --noEmit`
[ ] Make my changes
[ ] Update CHANGELOG.md
[ ] Update project-state.md (if feature)
[ ] Commit with atomic message
[ ] Ready to go!
```

---

## 📞 QUESTIONS?

| Question | Answer Location |
|----------|-----------------|
| What's the vision? | `docs/STRYVR_STRATEGIC_VISION_2026.md` |
| What's the philosophy? | `docs/PRODUCT_PHILOSOPHY_ANTI_FRUSTRATION.md` |
| Is this feature aligned? | `docs/DECISION_FRAMEWORK_VISION_ALIGNMENT.md` |
| What's the impact? | `docs/IMPACT_STATEMENT_STRYVR.md` |
| What's the tech stack? | `.claude/CLAUDE.md` |
| What was built last? | `.claude/rules/project-state.md` |
| How do I design this? | `docs/DESIGN_SYSTEM_V2.0_REFERENCE.md` |
| Is my code good? | Use `code-review` skill |
| How do I commit? | Use `git-atomic-commits` skill |

---

## ONE-LINER TO REMEMBER

**"STRYVR = Anti-friction coaching platform + frictionless client app + closed ecosystem = 10x adherence."**

---

**Happy building! 🚀**

Last updated: 2026-04-26
