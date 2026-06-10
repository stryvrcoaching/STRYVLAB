# Phase 1 Consolidation Tracker

> **Live progress dashboard for the 4-week consolidation sprint**
> 
> Update this daily. This is your north star for Phase 1 → v1 readiness.
> 
> Updated: 2026-04-26

---

## 🎯 WEEK 1: TIER A — CRITICAL FIXES

### Goal: All critical flows working (12-16 hours of work)

| Issue | Task | Status | Owner | Start | Done | Notes |
|-------|------|--------|-------|-------|------|-------|
| **#1** | Data accuracy: Fix training config (85 bug) | ✅ Done | Claude | 2026-04-26 | 2026-04-26 | Added bounds validation (1-7) + migration |
| **#1** | Data: Add validation (age, weight bounds) | ⏳ Not started | — | — | — | Server + client validation |
| **#7** | Protocol pipeline: Implement notification on share | ⏳ Not started | — | — | — | Web Push API |
| **#7** | Protocol pipeline: Client app badge "New Protocol" | ⏳ Not started | — | — | — | BottomNav Nutrition badge |
| **#7** | Protocol pipeline: Home page CTA "Your coach shared" | ⏳ Not started | — | — | — | Banner on `/client` home |
| **#7** | Test E2E: Coach create → share → client sees | ⏳ Not started | — | — | — | Manual testing |
| **#8** | Coach: Add "Session History" view per client | ⏳ Not started | — | — | — | Timeline of completed sessions |
| **#8** | Coach: Show last 5 sessions + metrics | ⏳ Not started | — | — | — | Volume, RIR, completion % |
| **#8** | Coach: Link to performance analytics | ⏳ Not started | — | — | — | Click session → drill down |
| **#8** | Test E2E: Coach assigns → sees session data | ⏳ Not started | — | — | — | Manual testing |
| **#9** | Backend: Verify program-adjustments apply correctly | ⏳ Not started | — | — | — | Test approval flow |
| **#9** | Backend: Add notification on program change | ⏳ Not started | — | — | — | Client sees diff |
| **#9** | Test E2E: Feedback loop end-to-end | ⏳ Not started | — | — | — | Coach approve → client sees |
| **#5** | Mobile: Session logger responsive (number inputs) | ⏳ Not started | — | — | — | Larger tappable inputs |
| **#5** | Mobile: Session logger scroll behavior | ⏳ Not started | — | — | — | Scroll to input on keyboard |
| **#5** | Mobile: RIR selector buttons responsive | ⏳ Not started | — | — | — | Horizontal scroll on mobile |
| **#5** | Test mobile: Log 10 sets on iPhone < 5 scrolls | ⏳ Not started | — | — | — | Real device testing |

**Week 1 Progress**: 1/17 tasks completed (6%)

---

## 🎨 WEEK 2: TIER B — HIGH PRIORITY FIXES

### Goal: Mobile UX smooth, no friction (12-17 hours of work)

| Issue | Task | Status | Owner | Start | Done | Notes |
|-------|------|--------|-------|-------|------|-------|
| **#4** | Nutrition Studio: Mobile breakpoint (< 1024px) | ⏳ Not started | — | — | — | Stack columns vertically |
| **#4** | Nutrition Studio: Responsive font sizes | ⏳ Not started | — | — | — | Smaller on mobile |
| **#4** | Nutrition Studio: Day editor horizontal scroll | ⏳ Not started | — | — | — | Fallback for mobile |
| **#4** | Test mobile: Nutrition Studio on iPhone 12 | ⏳ Not started | — | — | — | Real device |
| **#4** | Test mobile: Nutrition Studio on Pixel 5 | ⏳ Not started | — | — | — | Real device |
| **#6** | Coach builder: Responsive breakpoints (< 1280px) | ⏳ Not started | — | — | — | Tab view or stacked |
| **#6** | Test: 1280px, 1024px, 768px screen widths | ⏳ Not started | — | — | — | All viewports work |
| **#2** | QA: Test session logs show correct volume | ⏳ Not started | — | — | — | 10 random sessions |
| **#3** | Data: Verify all 458 exercises have primary_muscles | ⏳ Not started | — | — | — | Catalog completeness |
| **#3** | Data: Check muscle tracking (BodyMap) | ⏳ Not started | — | — | — | 10 random exercises |
| **#11** | Frontend: Add toast error notifications | ⏳ Not started | — | — | — | Network failures, API errors |
| **#11** | Frontend: Add timeout handler | ⏳ Not started | — | — | — | "Connection lost, retrying..." |
| **#11** | Frontend: Add error boundary on pages | ⏳ Not started | — | — | — | Catch render errors |
| **#11** | Test: Turn off internet, see helpful error | ⏳ Not started | — | — | — | Manual testing |

**Week 2 Progress**: 0/14 tasks completed (0%)

---

## ⚡ WEEK 3: TIER C — MEDIUM PRIORITY + OPTIMIZATION

### Goal: Performance, polish, final prep (4-6 hours of work)

| Issue | Task | Status | Owner | Start | Done | Notes |
|-------|------|--------|-------|-------|------|-------|
| **#10** | Backend: Add form validation (Zod schemas) | ⏳ Not started | — | — | — | Age, weight, calories bounds |
| **#10** | Frontend: Server-side validation errors | ⏳ Not started | — | — | — | Red badges on fields |
| **#10** | Test: Try entering bad data, see error | ⏳ Not started | — | — | — | Age -50, weight 0 |
| **#12** | Profile: Scoring performance (DevTools) | ⏳ Not started | — | — | — | Find bottleneck |
| **#12** | Optimize: Large program scoring (50+ exercises) | ⏳ Not started | — | — | — | < 500ms target |
| **#13** | Frontend: Add Next.js Image optimization | ⏳ Not started | — | — | — | All exercise images |
| **#13** | Frontend: Add skeleton loaders | ⏳ Not started | — | — | — | While images load |
| **#13** | Test: Images appear < 500ms | ⏳ Not started | — | — | — | Performance check |

**Week 3 Progress**: 0/8 tasks completed (0%)

---

## 🚀 WEEK 4: BETA LAUNCH + MONITORING

### Goal: 50 real coaches + clients using app (support focus)

| Task | Status | Owner | Start | Done | Notes |
|------|--------|-------|-------|------|-------|
| **Prep**: Create beta user guide (PDF) | ⏳ Not started | — | — | — | How to use STRYVR |
| **Prep**: Set up support channel (Slack/Discord) | ⏳ Not started | — | — | — | Beta users report bugs |
| **Prep**: Onboard 50 beta coaches (1:1 calls) | ⏳ Not started | — | — | — | ~30 min each = 25h |
| **Monitor**: Error rate tracking | ⏳ Not started | — | — | — | Target: < 1% |
| **Monitor**: Daily crash reports | ⏳ Not started | — | — | — | Zero tolerance |
| **Monitor**: Weekly metrics report | ⏳ Not started | — | — | — | DAU, NPS, feedback |
| **Support**: Daily feedback collection | ⏳ Not started | — | — | — | Slack reviews |
| **Support**: Critical bugs fixed within 24h | ⏳ Not started | — | — | — | Hot-fix process |

**Week 4 Progress**: 0/8 tasks completed (0%)

---

## 📊 HEALTH METRICS

### Weekly Summary

| Week | Status | Tasks Done | % Complete | Notes |
|------|--------|-----------|------------|-------|
| **Week 1** | ⏳ Not started | 0/17 | 0% | Focus: Critical flows |
| **Week 2** | ⏳ Pending | 0/14 | 0% | Focus: Mobile UX |
| **Week 3** | ⏳ Pending | 0/8 | 0% | Focus: Polish + optimize |
| **Week 4** | ⏳ Pending | 0/8 | 0% | Focus: Beta launch |
| **TOTAL** | ⏳ In Progress | 1/47 | 2% | **ETA: Week 4 of May** |

---

## 🎯 SUCCESS METRICS (Target for Week 4)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Daily Active Users (clients)** | 60%+ | ? | ⏳ Measure Week 4 |
| **Data Entry Time (avg)** | < 5 min | ? | ⏳ Measure Week 4 |
| **Error Rate** | < 1% | ? | ⏳ Measure Week 4 |
| **Coach NPS** | > 40 | ? | ⏳ Measure Week 4 |
| **Client NPS** | > 50 | ? | ⏳ Measure Week 4 |
| **Zero Crashes** | Yes | ? | ⏳ Monitor Week 4 |
| **Core Flows Work E2E** | Yes | No (broken) | ❌ Fix Week 1 |

---

## 🚨 BLOCKERS & RISKS

| Blocker | Status | Impact | Mitigation |
|---------|--------|--------|-----------|
| **Data accuracy (training config bug)** | 🔴 | Can't validate nutrition | Fix first (Day 1-2 Week 1) |
| **Protocol pipeline incomplete** | 🔴 | Clients don't see protocols | Fix Day 3-5 Week 1 |
| **Mobile UX broken** | 🔴 | Clients can't log on phone | Fix Week 2 |
| **Session history missing** | 🔴 | Coach can't see what client did | Fix Day 1-4 Week 1 |

---

## 📝 DAILY LOG (Template)

### Day 1 (2026-04-26) — Early Start

**Tasks Completed**:
- [x] Fix training config data validation — added bounds checking (1-7) to nutrition-data API endpoint
- [x] Add server-side validation to PATCH /api/clients/[clientId] — returns 400 on invalid weekly_frequency
- [x] Create migration to clean up existing bad values and add CHECK constraint
- [x] Update CHANGELOG.md + consolidation tracker

**Bugs Found**:
- None

**Blockers**:
- None

**Next Day Focus**:
- Implement protocol assignment notifications (#7 — Web Push API)
- Coach: Add "Session History" view per client (#8)

---

### Day 2 (2026-04-30)

**Tasks Completed**:
- [ ] Task 3
- [ ] Task 4

**Bugs Found**:
- Issue X (root cause: Y, fix: Z)

**Blockers**:
- Blocked on data audit (waiting for DB access)

**Next Day Focus**:
- Task 5, Task 6

---

## 📞 DECISION MATRIX

**When should we move to Phase 2?**

| Criterion | Must Have | Nice to Have | Can Skip |
|-----------|-----------|-------------|----------|
| All Tier A issues fixed | ✅ YES | — | ❌ NO |
| All Tier B issues fixed | ✅ YES | — | ❌ NO |
| 50 beta users active | ✅ YES | — | ❌ NO |
| 60%+ daily active | ✅ YES | — | ❌ NO |
| Coach NPS > 40 | ✅ YES | — | ❌ NO |
| < 1% error rate | ✅ YES | — | ❌ NO |
| All Tier C done | ❌ NO | ✅ NICE | ✅ CAN SKIP |
| Client NPS > 50 | ❌ NO | ✅ NICE | ✅ CAN SKIP |

**Phase 2 Launch Criteria**: ALL must-haves, at least 1 nice-to-have.

---

## 🎓 LEARNINGS & ITERATIONS

### What's Working Well
- (To be filled as consolidation progresses)

### What Needs Improvement
- (To be filled as issues emerge)

### What We'd Do Differently
- (To be filled with retrospective)

---

## DOCUMENT CONTROL

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | Coach Founder | Initial tracker created |

**Last Updated**: 2026-04-26  
**Next Update**: Daily (end of each workday)  
**Owner**: Engineering Lead + Product Lead

---

## HOW TO USE THIS TRACKER

1. **Daily**: Update task status (⏳ → 🟡 → ✅)
2. **Daily**: Log blockers and bugs
3. **Weekly**: Update summary % complete
4. **Weekly**: Measure success metrics
5. **Weekly**: Adjust priorities if needed
6. **End of Week**: Publish weekly report to stakeholders

**This tracker is your accountability tool.**

---

**Ready to consolidate Phase 1?**

Let's go. Week 1 starts Monday.
