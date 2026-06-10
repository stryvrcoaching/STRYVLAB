---
name: dashboard-ux
description: UX principles and patterns for the STRYVR coach dashboard
---

## Coach dashboard principles

The coach dashboard is a **professional tool** for building science-based programs. It must be:

- **Efficient**: coaches manage multiple clients — minimize clicks
- **Data-dense**: show relevant information without overwhelming
- **Keyboard-friendly**: power users navigate with keyboard
- **Accurate**: training data displayed with correct units and precision

## Information architecture

```
Dashboard (client list)
  └── Client Profile
        ├── Overview (anthropometry, constraints, priorities)
        ├── Programs
        │   └── Program Builder
        │       ├── Volume allocation (targets + sets)
        │       └── Session builder (exercises, sets, reps, load)
        ├── Progress (body metrics, photos, performance graphs)
        └── MorphoPro (analysis history)
```

## Client list page

- Show per client: name, last active, current program status, next session date
- Sort: last active (default), alphabetical, program status
- Quick actions: open program builder, add session log
- Search: filter by name or tag

## Program builder UX

The program builder is the core coach workflow. Key UX decisions:

1. **Volume allocation first** — show target/priority matrix before exercises
2. **Visual budget indicator** — show used vs allocated sets per target (progress bar)
3. **Exercise card** — shows sets, reps, load, target contribution at a glance
4. **Inline editing** — edit sets/reps/load without opening a modal
5. **Substitution quick-replace** — one click to swap an exercise for its best substitute

## Volume visualization

```
Target: Quadriceps    [PRIORITY]
████████████░░░░  14/20 sets this week

Target: Hamstrings    [MODERATE]
████████░░░░░░░░   8/12 sets this week
```

Progress bar + text label — never color alone.

## Numeric precision

| Data | Display format |
|------|---------------|
| Weight | `85.0 kg` (1 decimal) |
| Reps | `8` or `8-12` (integer, range) |
| Sets | `4` (integer) |
| Volume coefficient | `0.85` or `85%` |
| Body weight | `78.5 kg` |
| Body fat % | `15.2%` |

Always `font-mono` for these values.

## Empty program state

When a program has 0 sessions:
```
[Icon: calendar with +]
"No sessions yet."
"Start by reviewing your client's target priorities."
[Button: Review Priorities]
```

Actionable empty states — always tell the coach what to do next.

## Performance over aesthetics

- No loading animations that delay data display
- Skeleton screens, not spinners, for data loading
- Optimistic updates where safe (toggle exercise active/inactive)
- Prefetch client data when hovering over a client in the list
