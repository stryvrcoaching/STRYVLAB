# STRYVR — Visual Cheatsheet

> **One-page visual reference** for the three pillars, philosophy, and roadmap.
> Print this and stick it on your monitor. 📌

---

## THE PROBLEM & SOLUTION

```
PROBLEM:
┌─────────────────────────────────────────┐
│  95% of fitness clients quit in 12 wks  │
│  Because:                               │
│  • Protocols are generic                │
│  • Apps create friction                 │
│  • No real-time feedback                │
│  • Coaches lack intelligence            │
└─────────────────────────────────────────┘
         ↓↓↓ STRYVR SOLVES THIS ↓↓↓
         
SOLUTION:
┌─────────────────────────────────────────┐
│  Real-time Personalization Loop         │
│                                         │
│  Data (daily) → Intel → Personalize    │
│       ↑___________________|            │
│                                         │
│  More data = Better AI = Better results│
│  Client sticks 2+ years (vs 12 weeks)  │
└─────────────────────────────────────────┘
```

---

## THE THREE PILLARS

```
┌──────────────────────────────────────────────────────────────────────┐
│                        🏗️ STRYVR ARCHITECTURE                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  PILLAR 1: COACHING PLATFORM          PILLAR 2: CLIENT APP           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ━━━━━━━━━━━━━━━━━━━━━━━      │
│  For: Coaches (all levels)             For: Fitness clients          │
│  What: Protocol builder + Intel        What: Daily data entry        │
│                                                                       │
│  🟢 Templates (beginners)              🟢 Session logging             │
│  🟣 Lab mode (experts)                 🟢 Weight tracking            │
│  🟡 AI recommendations                 🟢 Nutrition entry           │
│  🟠 Performance analytics              🟢 Wellness tracking          │
│                                        🟢 < 5 minutes/day           │
│  Ref: MacroFactor, SBS                 Ref: Lift Smarter            │
│                                                                       │
│                    PILLAR 3: ECOSYSTEM                              │
│                    ━━━━━━━━━━━━━━━━━━━━━━                          │
│                    For: Closed loop                                  │
│                    What: Connected services                          │
│                                                                       │
│                    🟢 2026: Wearables                               │
│                    🟢 2027: Smart restaurants                        │
│                    🟢 2028+: Sport centers                           │
│                    🟢 Moat: Network effects                          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## ANTI-FRUSTRATION PHILOSOPHY (TL;DR)

```
✅ DO THIS                              ❌ DON'T DO THIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Single-tap entry                        Multi-step forms
Smart defaults                          "Required" fields
Real-time feedback (< 300ms)            Spinners > 5s
Visual > verbal (charts)                Walls of text
Coach empowers client                   Coach replaces client
Data is sacred                          Data is product
Beginner → Expert depth                 All power at once
Transparent + trustworthy               Manipulative + dark patterns
```

---

## DECISION MATRIX (3-Second Test)

```
┌─────────────────────────────────────────────────────────────┐
│ Question 1: Helps adherence?     YES / NO                   │
│ Question 2: Removes friction?    YES / NO                   │
│ Question 3: Feeds flywheel?      YES / NO                   │
├─────────────────────────────────────────────────────────────┤
│ ✅ All YES    → TIER 1 (Build first)                        │
│ 🟡 Some YES   → TIER 2 (Build after)                        │
│ ❌ All NO     → Skip / Low priority                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 18-MONTH ROADMAP

```
Q2 2026 (APR-JUN)          Q3 2026 (JUL-SEP)         Q4 2026 (OCT-DEC)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MVP ✅                     TIER 2 📈                 ECOSYSTEM 🌐
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Program builder        ✅ Wearables               ✅ Restaurant MVP
✅ Client app            ✅ AI recommendations      ✅ 2-3 partners
✅ Nutrition protocols   ✅ Export (PDF/JSON)       ✅ Closed loop test
✅ MorphoPro            ✅ Analytics dashboard
✅ Intelligence         ✅ Coach AI assistant

GOAL:                    GOAL:                      GOAL:
50 coaches              150 coaches                250 coaches
5k clients              15k clients                25k clients
€500 MRR                €3k MRR                    €8.75k MRR

2027: Scale ecosystem (50+ restaurants, 20+ gyms)
2028+: Moat formation (network effects, data flywheel)
```

---

## SUCCESS METRICS (What We Measure)

```
┌─────────────────────────────────┬────────┬─────────────────────┐
│ Metric                          │ Target │ Why Important?      │
├─────────────────────────────────┼────────┼─────────────────────┤
│ Daily active users (clients)    │  60%+  │ Personalization ✅  │
│ Client NPS                      │  > 60  │ Love the app ✅     │
│ Coach NPS                       │  > 50  │ Recommend ✅        │
│ Protocol adherence rate         │  > 70% │ Finish programs ✅  │
│ Client onboarding time          │ < 15m  │ Easy start ✅       │
│ Data entry time                 │ < 5m   │ Frictionless ✅     │
│ Monthly churn (coaches)         │ < 5%   │ Retention ✅        │
│ API response time               │ < 300m │ Real-time feel ✅   │
└─────────────────────────────────┴────────┴─────────────────────┘
```

---

## STACK (Tech Stack at a Glance)

```
FRONTEND              BACKEND              DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next.js              Next.js API          PostgreSQL
TypeScript strict    Prisma ORM           Supabase
Tailwind CSS v3      Inngest              RLS (multi-tenant)
Framer Motion        OpenAI Vision        Seeds (idempotent)
React Query          Zod validation       Audit trail

DESIGN: DS v2.0 (Dark, flat, minimal)
COLOR: #121212 (background) | #1f8a65 (accent)
```

---

## QUICK LINKS (Bookmark These)

```
🎯 STRATEGIC DOCS:
   • STRYVR_STRATEGIC_VISION_2026.md (main)
   • PRODUCT_PHILOSOPHY_ANTI_FRUSTRATION.md (principles)
   • DECISION_FRAMEWORK_VISION_ALIGNMENT.md (priorities)
   • EXECUTIVE_SUMMARY_STRYVR_2026.md (investors)
   • IMPACT_STATEMENT_STRYVR.md (why we matter)

📖 QUICK REFS:
   • STRATEGIC_DOCS_INDEX.md (master index)
   • QUICK_START_SESSION_GUIDE.md (onboarding)
   • VISUAL_CHEATSHEET.md (this file!)

⚙️ TECHNICAL:
   • CLAUDE.md (stack + rules)
   • .claude/rules/project-state.md (current state)
   • .claude/rules/database-patterns.md (DB rules)

🎨 DESIGN:
   • DESIGN_SYSTEM_V2.0_REFERENCE.md (colors, tokens)
```

---

## THE FOUNDER'S PHILOSOPHY (In One Sentence)

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  "Everyone deserves a coach who understands     │
│   them. Personalization at scale is now         │
│   possible."                                     │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## WHEN IN DOUBT...

```
Does this HELP CLIENTS STICK LONGER?
   → YES = Build it
   → NO = Probably not now

Does this REMOVE FRICTION?
   → YES = Build it
   → NO = Maybe later

Does this FEED THE FLYWHEEL?
   → YES = Build it now
   → NO = Nice-to-have

STUCK? → Read DECISION_FRAMEWORK_VISION_ALIGNMENT.md
```

---

## PRINT ME! 📌

- Stick on your monitor
- Reference during planning
- Share with new team members
- Update quarterly (next: 2026-07-31)

---

**Last Updated**: 2026-04-26  
**Audience**: Developers, designers, product managers, stakeholders
