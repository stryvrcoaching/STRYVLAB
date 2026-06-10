# SYSTEM PROMPT — Phase 1 Consolidation Session

> **Copy this entire prompt into a new Claude session to continue Phase 1 consolidation work.**
>
> This prompt gives the next session complete context on what's broken, why, and what to fix.

---

## 🎯 YOUR MISSION

You are helping consolidate **STRYVR Phase 1** before moving to Phase 2.

**Current situation**: Phase 1 features exist but are **not production-ready**. 13 issues have been identified across 3 tiers. Your job is to **fix them systematically over 4 weeks**.

**Success = v1 that's solid enough for 50 real coaches + clients.**

---

## 📋 READ THESE DOCUMENTS FIRST (In Order)

1. **`docs/CONSOLIDATION_EXECUTIVE_BRIEF.md`** (1 page, 3 min)
   - High-level overview: situation, plan, ROI
   - **Read this first to understand the "why"**

2. **`docs/PHASE_1_CONSOLIDATION_PLAN.md`** (2,000+ words, 20 min)
   - Detailed audit of all 13 issues
   - Root causes, impact, fix estimate for each
   - 4-week roadmap with specific tasks
   - Validation checklist
   - **Read this to understand what's broken and why**

3. **`docs/CONSOLIDATION_TRACKER.md`** (1,500 words, 15 min)
   - Daily progress dashboard (47 tasks across 4 weeks)
   - Task-by-task tracking template
   - Success metrics to monitor
   - **Use this to track progress daily**

4. **`docs/DECISION_FRAMEWORK_VISION_ALIGNMENT.md`** (3,500 words, reference)
   - When in doubt about prioritization, use the 3-second test
   - Helps decide if something is core or nice-to-have
   - **Reference doc, don't read start-to-finish now**

5. **`.claude/rules/project-state.md`** (reference)
   - Current state of all Phase 1 features
   - Latest implementations, gotchas, next steps
   - **Reference for understanding what exists**

---

## 🚨 THE 13 PROBLEMS (Quick Reference)

### TIER A — CRITICAL (Fix Week 1, 12-16h total)

```
#1. CRITICAL: Data Accuracy — Training Config Shows Wrong Values
   Location: Nutrition Studio, ClientIntelligencePanel
   Problem: weeklyFrequency shows 85 instead of 3-5 → breaks nutrition math
   Impact: Coach makes wrong recommendations based on bad data
   Fix: 1-2h (audit coach_clients table, validate on edit, clean data)

#2. CRITICAL: Protocol Pipeline Broken
   Location: Nutrition protocols → client view
   Problem: Coach shares protocol → client never sees it (no notification)
   Impact: Clients don't know they have a protocol to follow
   Fix: 2-3h (add Web Push notification, BottomNav badge, home CTA)

#3. CRITICAL: Session History Missing
   Location: Coach view
   Problem: Client completes session → coach never sees it
   Impact: Coach can't give feedback, doesn't know what client did
   Fix: 3-4h (add session history view, timeline, drill-down)

#4. CRITICAL: Performance Feedback Loop Broken
   Location: PerformanceFeedbackPanel → program adjustment → client
   Problem: Coach approves recommendation → change never reaches client
   Impact: Auto-adjustments don't reach client, loop breaks
   Fix: 2-3h (verify apply logic, add notification, show diff)

#5. CRITICAL: Session Logger Mobile UX
   Location: SessionLogger.tsx (client app)
   Problem: Not responsive; number inputs tiny; keyboard covers fields
   Impact: Client struggles to log on phone (core friction, breaks 5-min goal)
   Fix: 3-4h (responsive design, scroll to input, larger tappable areas)
```

### TIER B — HIGH PRIORITY (Fix Week 2, 12-17h total)

```
#6. HIGH: Nutrition Studio Not Mobile Responsive
   Location: NutritionStudio.tsx (3-column layout)
   Problem: Col 2 squishes on mobile, day editor needs scroll
   Impact: Mobile users (most common) have poor UX
   Fix: 4-6h (mobile breakpoint, stack columns, responsive fonts)

#7. HIGH: Coach Builder Not Mobile Responsive
   Location: ProgramTemplateBuilder.tsx (3-pane layout)
   Problem: Breaks on < 1280px screens
   Impact: Coaches on smaller laptops can't use builder
   Fix: 2-3h (responsive breakpoint, tab view, test viewports)

#8. HIGH: Session Logs Volume = 0 (Edge Cases)
   Location: Performance tracking, recap page
   Problem: Already fixed but edge cases remain
   Impact: Client sees "0 reps" on recap (motivation killer)
   Fix: 1-2h (test 10 random sessions, verify API returns correct volume)

#9. HIGH: Muscle Tracking Inconsistent
   Location: BodyMap (client app)
   Problem: Primary/secondary muscles inconsistent or missing
   Impact: BodyMap shows wrong muscles
   Fix: 2-3h (verify 458 exercises have primary_muscles, test BodyMap)

#10. HIGH: Error Handling (Silent Failures)
   Location: Throughout app
   Problem: API fails → no error message to user
   Impact: Users don't know what went wrong, can't recover
   Fix: 2-3h (add toast notifications, timeout handler, error boundary)
```

### TIER C — MEDIUM PRIORITY (Fix Week 3, 4-6h total)

```
#11. MEDIUM: Form Validation Gaps
   Location: Various forms (age, weight, etc.)
   Problem: Age can be 0 or 200, weight can be negative
   Impact: Bad data enters system, breaks calculations
   Fix: 1-2h (Zod schemas, validation, error messages)

#12. MEDIUM: Scoring Performance
   Location: useProgramIntelligence hook
   Problem: Large programs (50+ exercises) take > 1s to score
   Impact: Coach waits for spinner, frustrating
   Fix: 2h (profile with DevTools, optimize bottleneck)

#13. MEDIUM: Image Loading Optimization
   Location: Client app (exercise images, morpho photos)
   Problem: Large GIFs load slowly, no skeleton loaders
   Impact: App feels slow
   Fix: 1-2h (Next.js Image optimization, skeleton loaders, compress)
```

---

## 📅 THE 4-WEEK PLAN

### WEEK 1: Fix All Tier A (Critical Flows)

**Goal**: All pipelines working end-to-end
**Effort**: 12-16 hours
**Tasks**: 17 specific tasks (see PHASE_1_CONSOLIDATION_PLAN.md)

```
Day 1-2: Fix data accuracy (training config bug)
Day 3-5: Implement protocol assignment notifications
Day 1-4: Implement session history for coaches
Day 4-5: Connect performance feedback loop
End of week: Internal alpha test (team uses app end-to-end)
```

### WEEK 2: Fix All Tier B (Mobile + UX)

**Goal**: Mobile responsive, error handling
**Effort**: 12-17 hours
**Tasks**: 14 specific tasks

```
Day 1-2: Session logger mobile responsive
Day 2-3: Nutrition Studio mobile responsive
Day 3-4: Coach builder responsive
Day 4-5: Error handling + toast notifications
End of week: QA alpha test (all flows work smoothly)
```

### WEEK 3: Fix All Tier C + Optimize

**Goal**: Performance, polish, final prep
**Effort**: 4-6 hours
**Tasks**: 8 specific tasks

```
Day 1: Form validation (all forms)
Day 2: Scoring performance optimization
Day 3: Image loading optimization
Day 4-5: Beta prep (user guide, support process)
End of week: Ready for beta launch
```

### WEEK 4: Beta Launch

**Goal**: 50 real coaches + clients using app
**Effort**: Support focus (hourly)

```
Onboard 50 beta coaches
Daily monitoring (crashes, error rates)
Support channel (fast-fix process)
Weekly metrics report
```

---

## ✅ SUCCESS METRICS (Target for Week 4)

| Metric                           | Target  | Why                                     |
| -------------------------------- | ------- | --------------------------------------- |
| **Daily active users (clients)** | 60%+    | Clients logging = personalization works |
| **Data entry time**              | < 5 min | No friction = adherence                 |
| **Error rate**                   | < 1%    | Reliability = trust                     |
| **Coach NPS**                    | > 40    | Coaches recommend to peers              |
| **Client NPS**                   | > 50    | Clients love the app                    |
| **Zero crashes**                 | Yes     | Stability = trust                       |
| **Core flows 100%**              | Yes     | Real end-to-end usage                   |

**Phase 2 greenlight = all metrics ✅**

---

## 🛠️ HOW TO USE THIS IN YOUR SESSION

### Daily Workflow

1. **Morning**: Open `docs/CONSOLIDATION_TRACKER.md`
2. **Identify task(s)** for the day from the current week
3. **Read task details** in `docs/PHASE_1_CONSOLIDATION_PLAN.md`
4. **Fix the issue** (write code, test, commit)
5. **Update tracker**: Mark task as done, update progress %
6. **Log blockers/bugs** in tracker's daily log section
7. **Commit with atomic message** (use `git-atomic-commits` skill)
8. **Update CHANGELOG.md** (always, after every change)
9. **Evening**: Push changes, note next day's focus

### When in Doubt

- **Is this task critical?** → Check PHASE_1_CONSOLIDATION_PLAN.md tier
- **Should we fix this?** → Use `DECISION_FRAMEWORK_VISION_ALIGNMENT.md` 3-second test
- **What's the current state?** → Check `.claude/rules/project-state.md`
- **How's progress?** → Check `CONSOLIDATION_TRACKER.md` % complete

---

## 🎯 KEY FILES YOU'LL TOUCH

### By Week

**Week 1 (Critical Flows)**:

- `lib/health/healthMath.ts` (data validation for age, weight)
- `components/nutrition/studio/*` (notification system)
- New route: Coach session history view
- `lib/performance/analyzer.ts` + feedback loop wiring

**Week 2 (Mobile + UX)**:

- `app/client/programme/session/[sessionId]/SessionLogger.tsx` (mobile responsive)
- `components/nutrition/studio/NutritionStudio.tsx` (responsive)
- `components/programs/ProgramTemplateBuilder.tsx` (responsive)
- Error handling throughout (toast notifications)

**Week 3 (Optimization)**:

- All form components (validation)
- `lib/programs/intelligence/scoring.ts` (performance)
- Image loading (Image optimization)

**Week 4 (Beta)**:

- Support channel setup
- Daily monitoring scripts
- Metrics dashboard

---

## 📞 QUICK REFERENCE CARDS

### The 3-Second Decision Test

```
1. Does this help clients stick longer?    YES / NO
2. Does this remove friction?              YES / NO
3. Does it feed the flywheel?              YES / NO

All YES → Core feature, do it
Some YES → Nice-to-have, lower priority
All NO → Skip for now
```

### When to Ask for Help

- **Architecture question?** → Use `DECISION_FRAMEWORK_VISION_ALIGNMENT.md`
- **Database pattern?** → Check `.claude/rules/database-patterns.md`
- **Design system?** → Check `docs/DESIGN_SYSTEM_V2.0_REFERENCE.md`
- **Git commits?** → Use `git-atomic-commits` skill

### Team Coordination

- **Daily standup**: Report progress + blockers
- **Weekly**: Update `CONSOLIDATION_TRACKER.md` metrics
- **Blockers**: Log in tracker, escalate if blocking week's progress
- **Wins**: Celebrate ✅ each week's completion

---

## 🚨 COMMON MISTAKES TO AVOID

```
❌ Skip reading the consolidation plan (it has all the answers)
✅ Read PHASE_1_CONSOLIDATION_PLAN.md thoroughly

❌ Implement features beyond the 13 issues (scope creep)
✅ Stick to the 47 tasks, nothing more

❌ Fix Tier C before Tier A (priorities matter)
✅ Tier A Week 1 → Tier B Week 2 → Tier C Week 3

❌ Commit without updating CONSOLIDATION_TRACKER.md
✅ Update tracker every time you complete a task

❌ Forget to test (unit test + manual test)
✅ Every fix includes test case

❌ Go dark (no communication on progress)
✅ Update tracker daily, standup regularly
```

---

## 💡 THE BIG PICTURE

**Why consolidate instead of jumping to Phase 2?**

```
Cost of consolidation:    €1.5-2k (50h engineering)
Cost of broken v1:        €10k+ in lost revenue + churn
ROI:                      5-10x return

4 weeks of solid engineering = rock-solid foundation for Phase 2
```

**After Week 4 (beta launch), you'll have**:

- ✅ Real user feedback (50 coaches + clients)
- ✅ Proven metrics (60%+ DAU, NPS scores)
- ✅ Zero critical bugs (validated)
- ✅ Mobile-first app (works on phones)
- ✅ Investor-ready traction

**Then Phase 2 becomes a growth play, not a survival play.**

---

## 📖 DOCUMENTS YOU'RE USING

| Document                                 | Purpose                 | When to Read            |
| ---------------------------------------- | ----------------------- | ----------------------- |
| `CONSOLIDATION_EXECUTIVE_BRIEF.md`       | High-level why/what/how | Session start (3 min)   |
| `PHASE_1_CONSOLIDATION_PLAN.md`          | Detailed audit + plan   | Session start (20 min)  |
| `CONSOLIDATION_TRACKER.md`               | Daily progress tracking | Every morning + evening |
| `DECISION_FRAMEWORK_VISION_ALIGNMENT.md` | Prioritization rules    | When in doubt           |
| `project-state.md`                       | Current feature state   | Reference as needed     |
| `DESIGN_SYSTEM_V2.0_REFERENCE.md`        | UI design rules         | When building UI        |
| `database-patterns.md`                   | DB best practices       | When touching DB        |

---

## 🎬 SESSION START CHECKLIST

Before you start coding, verify:

- [ ] Read `CONSOLIDATION_EXECUTIVE_BRIEF.md` (understand the situation)
- [ ] Read `PHASE_1_CONSOLIDATION_PLAN.md` (understand what's broken)
- [ ] Opened `CONSOLIDATION_TRACKER.md` (today's tasks)
- [ ] Identified which week we're in
- [ ] Identified which Tier A/B/C task to work on
- [ ] Read the task details in the plan
- [ ] Ran `npx tsc --noEmit` (confirm 0 errors before starting)

**Then**: Pick a task, fix it, test it, commit it, update tracker.

---

## 🚀 READY TO START?

**Week 1 begins Monday 2026-04-29.**

The plan is clear:

1. **Week 1**: Fix critical pipelines (data, notifications, feedback loop)
2. **Week 2**: Polish mobile UX (responsive, error handling)
3. **Week 3**: Optimize + validate (performance, forms)
4. **Week 4**: Launch beta (50 coaches + clients)

**Success = 4 weeks → production-ready v1 → Phase 2 confidence.**

Let's build it right. 🎯

---

## 📞 QUESTIONS?

| Question                         | Answer                                                    |
| -------------------------------- | --------------------------------------------------------- |
| **Which task first?**            | Task #1 (data accuracy bug) in `CONSOLIDATION_TRACKER.md` |
| **How long should this take?**   | ~50 hours over 4 weeks (1-2 devs)                         |
| **When can we move to Phase 2?** | Week 5, if all success metrics hit                        |
| **What if we find more bugs?**   | Update tracker, assess if Tier A/B/C, reprioritize        |
| **How do we track progress?**    | Daily update to `CONSOLIDATION_TRACKER.md`                |

---

**Good luck. Consolidate well. Phase 2 awaits. 🚀**

📋 RÉSUMÉ: Plan de Consolidation Phase 1
Vous aviez raison. Phase 1 n'est pas prête pour Phase 2. Voici ce que j'ai créé pour vous :

📄 3 Nouveaux Documents
PHASE_1_CONSOLIDATION_PLAN.md (2,000+ mots)

Audit complet de ce qui ne marche pas
13 problèmes détectés (5 critiques, 5 haute priorité, 3 medium)
4 semaines de roadmap avec tâches assignées
Checklist de validation (alpha test, beta test)
Risques et mitigations
CONSOLIDATION_TRACKER.md (1,500 mots)

Tableau de bord vivant (à mettre à jour chaque jour)
47 tâches réparties sur 4 semaines
Template de log quotidien
Metrics de succès à tracker
Matrice de décision pour savoir quand lancer Phase 2
CONSOLIDATION_EXECUTIVE_BRIEF.md (1 page)

Résumé exécutif pour vous, l'équipe, investisseurs
Qu'est-ce qui est cassé (TL;DR)
Le plan en 4 semaines
ROI (5-10x return on investment)
Décision finale: Consolidate or bust
🚨 LES 13 PROBLÈMES IDENTIFIÉS
TIER A — CRITIQUES (Week 1: 12-16h)

1. 🔴 Training config shows 85 (should be 3-5) → Breaks nutrition
2. 🔴 Protocol assignment → Client never sees it (no notification)
3. 🔴 Session logging → Coach never sees it (no history view)
4. 🔴 Performance feedback → Changes don't reach client
5. 🔴 Session logger not mobile responsive (critical friction)
   TIER B — HAUTE PRIORITÉ (Week 2: 12-17h)

6. 🟠 Nutrition Studio not mobile responsive
7. 🟠 Coach builder not mobile responsive
8. 🟠 Session logs volume showing 0 (edge cases)
9. 🟠 Muscle tracking inconsistent
10. 🟠 Error handling (silent failures)
    TIER C — MEDIUM (Week 3: 4-6h)

11. 🟡 Form validation gaps (age 0, negative weight)
12. 🟡 Scoring performance on large programs
13. 🟡 Image loading optimization

FICHIERS À UTILISER
PHASE_1_CONSOLIDATION_PLAN.md ← Audit technique complet
CONSOLIDATION_TRACKER.md ← Daily progress dashboard
CONSOLIDATION_EXECUTIVE_BRIEF.md ← Pitch to stakeholders
DECISION_FRAMEWORK_VISION_ALIGNMENT.md ← Priorités claires
