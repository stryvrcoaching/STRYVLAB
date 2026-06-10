# Decision Framework — Vision Alignment Checklist

> **How to decide whether a feature, change, or pivot aligns with STRYVR's founding vision**
> 
> Use this framework when:
> - Deciding what to build next
> - Reviewing a pull request's product impact
> - Evaluating partnership opportunities
> - Dealing with conflicting priorities
> 
> Date : 2026-04-26

---

## THE QUICK TEST: 3 Questions

Before doing **anything**, ask these 3 questions:

1. **Does this help clients adhere longer?**
   - If no → probably not our feature
   - If yes → investigate further

2. **Does this remove friction from the client or coach?**
   - If no → probably not now (Phase 2+)
   - If yes → investigate further

3. **Does this reinforce the unique fingerprint (personalization loop)?**
   - If no → nice-to-have, not core
   - If yes → build it

**If all 3 = YES** → Feature passes the smell test. Now do full review below.

---

## FULL DECISION MATRIX

### DIMENSION 1: Impact on Adherence

**Question**: Does this feature help clients stick longer?

| Score | Example | Action |
|-------|---------|--------|
| **9-10** | Daily data entry (5-min, beautiful) | BUILD FIRST |
| **7-8** | Wearables integration (auto data entry) | BUILD PHASE 2 |
| **5-6** | Export feature (client sharing) | BUILD PHASE 3 |
| **3-4** | Dark mode toggle | NICE-TO-HAVE |
| **1-2** | Custom avatar for profile | SKIP |
| **0** | Social leaderboards (gamification dark pattern) | **REJECT** |

### DIMENSION 2: Friction Reduction

**Question**: Does this save the user time/clicks/confusion?

| Metric | Good | Bad |
|--------|------|-----|
| **Clicks to goal** | < 3 | > 5 |
| **Cognitive load** | < 3 decisions | > 5 options |
| **Time to completion** | < 2 min (coach), < 5 min (client) | > 3 min (coach), > 8 min (client) |
| **Errors per user** | < 5% | > 20% |
| **Abandonment mid-flow** | < 10% | > 30% |

**Decision rule**:
- If all "Good" → Build
- If any "Bad" → Redesign or reject

### DIMENSION 3: Personalization Flywheel

**Question**: Does this feed the unique fingerprint loop?

```
Data collection → Intelligence → Personalized recommendation → Client adheres → More data
                                           ↑
                        Does this feature live here?
```

| Feature | Contributes to Flywheel? | Example |
|---------|--------------------------|---------|
| **Daily logging UI** | YES (core) | Session logger, weight entry, mood |
| **Auto-calculation** | YES (intel) | TDEE computation, protein recommendations |
| **Personalized protocol** | YES (adapt) | Macros adjusted by RIR trend |
| **Wearables sync** | YES (data) | Auto-populate sleep, steps, HR |
| **Coach recommends swap** | YES (coach in loop) | "Try this exercise instead" |
| **Push notifications** | **NO** (breaks trust) | "You missed logging!" |
| **Social sharing** | MAYBE (extends network) | Client shares results, recruits friends |
| **Leaderboards** | **NO** (wrong motivation) | Compare progress to others |

**Decision rule**:
- YES features → Prioritize
- NO features → Skip
- MAYBE features → Only if user demand

---

## ANTI-PATTERN DETECTOR

### Red Flags (Reject immediately)

```
🚫 "We can show ads to coaches to drive engagement"
   → REJECT. Coaches trust us. Ads = conflict of interest.

🚫 "Let's require a photo daily to unlock nutrition tips"
   → REJECT. Invasive + guilt-driven. Breaks trust.

🚫 "Free tier only gets basic data, Pro gets advanced analytics"
   → REJECT. This isn't a paywall on nice-to-haves; it's on core data.
   → Paywall should be on "bulk operations" or "advanced Lab mode," not on insights.

🚫 "Let's gamify with streak counter + loss aversion notifications"
   → REJECT. Works short-term, breeds resentment. Anti-founder philosophy.

🚫 "Push notification at 6am if they didn't log yesterday"
   → REJECT. Disrespectful, manipulative. Client loses trust immediately.

🚫 "Require sign-up via email + phone to get started"
   → REJECT. Friction before value. Demos are free, no email required.

🚫 "Track user behavior and sell to fitness influencers"
   → REJECT. Fundamentally breaks data trust. Legal + ethical disaster.

🚫 "Remove manual data entry, make it mandatory wearable only"
   → REJECT. Excludes budget-conscious users. Accessibility fails.

🚫 "Paywall basic protocol building (coaches need Pro)"
   → REJECT. Coaches are our customers. All core coach features = free or transparent pricing.

🚫 "Create a separate "elite coaches" tier with private community"
   → REJECT. Creates elitism. Platform should feel equal.
```

### Yellow Flags (Investigate)

```
⚠️ "Let's add social features (friends, followers, comments)"
   → Investigate: Does this support adherence or distract?
   → Safe version: Coach-only community (coaches share templates, not clients comparing)
   → Reject: Client-to-client leaderboards

⚠️ "Push notifications for protein targets missed"
   → Investigate: Is the client opting in? Can they customize timing?
   → Safe version: Optional daily digest email, client controls frequency
   → Reject: Automatic 6am push if they miss targets

⚠️ "Let's charge for wearables integration"
   → Investigate: Is this a premium feature or core?
   → Safe version: Wearables = core (free), advanced ML from wearables = Pro
   → Reject: Hiding data integration behind paywall

⚠️ "New feature: AI generates personalized motivational quotes daily"
   → Investigate: Does this help adherence or feel manipulative?
   → Safe version: One-time onboarding profile → show relevant science facts
   → Reject: Daily "you're awesome!" messages (breaks trust)

⚠️ "Dashboard shows client's calorie deficit and % to goal"
   → Investigate: Does this motivate or trigger guilt?
   → Safe version: Show trend (calories stable, decreasing, increasing) with context
   → Reject: "You're 15% above your deficit target!" (guilt-driven)
```

---

## PRIORITIZATION FRAMEWORK (When Everything is a YES)

### Tier 1 (DO FIRST)
Must do it; no product exists without it.

- [ ] Client app < 5-min daily entry (core)
- [ ] Session logging with RIR tracking
- [ ] Weight + body composition tracking
- [ ] Coach protocol building (templates to custom)
- [ ] Nutrition protocol builder (macros + hydratation)
- [ ] Program intelligence panel (SRA, balance, specificity)
- [ ] MorphoPro bridge (OpenAI Vision → adjustments)

**Timeline**: Now - June 2026

### Tier 2 (DO NEXT)
Unlocks next $1M ARR; required for Seed funding.

- [ ] Wearables integration (Apple Health, Oura)
- [ ] Real-time intelligence updates (< 300ms)
- [ ] Coach onboarding guided flow
- [ ] Performance feedback loops (RIR trends → recommendations)
- [ ] Export feature (PDF, JSON)
- [ ] Analytics dashboard (coach business metrics)
- [ ] Coach AI assistant (bulk protocol generation)

**Timeline**: July - Dec 2026

### Tier 3 (DO LATER)
Nice-to-have; doesn't impact core metrics.

- [ ] Mobile app (iOS/Android native)
- [ ] Video form coaching (Vision API integration)
- [ ] Smart restaurant partnerships (pilot with 2-3)
- [ ] Sport center integrations (5-10 gyms)
- [ ] Advanced ML predictions (individual response curves)
- [ ] International expansion (FR, ES)
- [ ] B2B licensing for gym chains

**Timeline**: 2027+

---

## WHEN TO SAY NO (Decision Rules)

### Say NO if...

1. **It adds friction to client data entry**
   - Test: "Would I personally want to click this daily?"
   - If no → reject

2. **It requires coaching judgment to be removed**
   - Platform should augment coach, never replace
   - AI can suggest, coach decides
   - Reject auto-apply changes without coach approval

3. **It creates walled-garden lock-in**
   - Client should be able to export data anytime
   - Coach should be able to export protocols, client list, metrics
   - Reject features that hide data from users

4. **It violates data trust**
   - No selling user data
   - No tracking beyond what's needed
   - No guilt-driven notifications
   - Reject if your grandmother would feel uncomfortable

5. **It doesn't measurably improve adherence**
   - Adherence = north star
   - If feature doesn't move this metric, it's not core
   - Can be nice-to-have, but not Tier 1

6. **It takes > 2 weeks to ship**
   - Speed beats perfection
   - If it's taking 4 weeks, you're probably overbuilding
   - MVP → measure → iterate

### Say YES if...

1. **It directly removes friction from the 5-min data entry loop**
   - Example: Smart defaults, one-tap submission, offline-first

2. **It helps coaches save time on repetitive work**
   - Example: Bulk protocol generation, template library

3. **It feeds the personalization flywheel**
   - Example: Wearables data, RIR tracking, body comp trends

4. **It improves coach or client NPS**
   - Measure it; if NPS goes up, it's worth doing

5. **It's measurably cheaper to build with us than alternatives**
   - Example: In-house nutrition engine vs. API

6. **Coaches or clients are explicitly asking for it**
   - Wait for demand; don't anticipate

---

## QUARTERLY REVIEW (Track Alignment)

Every quarter, review:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Client daily active** | 60%+ | ? | 🟢/🟡/🔴 |
| **Client NPS** | > 60 | ? | 🟢/🟡/🔴 |
| **Coach NPS** | > 50 | ? | 🟢/🟡/🔴 |
| **Adherence improvement** | 10x baseline | ? | 🟢/🟡/🔴 |
| **Data entry time** | < 5 min avg | ? | 🟢/🟡/🔴 |
| **Session to save time** | < 300ms | ? | 🟢/🟡/🔴 |
| **Churn rate** | < 5% monthly | ? | 🟢/🟡/🔴 |

If any metric is 🔴 → investigate → adjust priorities.

---

## EXAMPLE: Feature Proposal

### Case Study: "Let's add a leaderboard so coaches can compete"

**Evaluation**:

1. **Quick test**:
   - Helps adherence? NO (leaderboards distract from personal goals)
   - Removes friction? NO (adds UI complexity)
   - Feeds personalization loop? NO (compares externally, not internally)
   → **FAIL → REJECT**

2. **Anti-pattern check**:
   - Is this manipulation? YES (loss aversion, social proof)
   - Does it break trust? YES (promotes unhealthy competition)
   → **REJECT**

3. **Decision**:
   - **FINAL: REJECT**
   - Instead: "Coach community for sharing templates" (collaboration, not competition)

---

## EXAMPLE: Feature Proposal (Good)

### Case Study: "Let's auto-populate weight from Apple Health"

**Evaluation**:

1. **Quick test**:
   - Helps adherence? YES (removes daily weight entry, easier to stick)
   - Removes friction? YES (1 less daily input)
   - Feeds personalization loop? YES (better data quality, more frequent updates)
   → **PASS → INVESTIGATE**

2. **Friction check**:
   - Clicks to goal: 0 (automatic) ✅
   - Cognitive load: 0 (transparent) ✅
   - Time to completion: 0 (instant) ✅
   - Errors: 0 (trusted source) ✅
   → **PASS**

3. **Flywheel check**:
   - Data collection: YES (auto sync)
   - Intelligence: YES (more data → better patterns)
   - Personalization: YES (daily weight enables real-time macro adjust)
   → **PASS**

4. **Adherence impact**:
   - Will this help clients stick 2+ years? YES
   - Measure: % daily active before/after
   → **PASS**

5. **Decision**:
   - **TIER 2 (Q3 2026)** — Seed funding feature, required for Series A

---

## FINAL RULE: THE FOUNDING PRINCIPLE TEST

Before greenlight any feature, ask:

**"Would the coach-founder personally use this daily, or would they think it's unnecessary friction?"**

- Founder = experienced coach
- Founder = values simplicity
- Founder = hates manipulation

If you can't honestly say "yes, founder would use this," → probably not core.

---

## DOCUMENT CONTROL

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | Coach Founder | Initial decision framework |

**Next Review** : 2026-07-31 (post-Tier 1 completion)

**Steward** : Product Lead + Coach Founder
