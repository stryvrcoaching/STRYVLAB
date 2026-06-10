---
name: client-app-ux
description: UX principles and patterns for the STRYVR client mini-app
---

## Client app principles

The client mini-app is a **motivational companion**, not a professional tool. It must be:

- **Simple**: one clear action at a time
- **Motivating**: celebrate progress, not complexity
- **Mobile-first**: clients use this on their phone at the gym
- **Fast**: loads quickly on mobile networks

## Information architecture

```
Client App
  ├── Today's Session (primary view)
  │   └── Exercise list → Set logging
  ├── My Program (week view)
  ├── Progress
  │   ├── Performance graphs
  │   ├── Body metrics
  │   └── Photos
  └── Weekly Feedback (form)
```

## Today's session — primary view

This is the screen clients see most. Design it for the gym:

- Large touch targets (min 44px)
- Current exercise prominently displayed
- Previous performance shown for reference ("Last time: 80kg × 8")
- Quick log: tap sets to mark as done
- Rest timer integrated (optional)

## Set logging UX

Minimal friction to log a working set:

```
Exercise: Barbell Squat
Target: 4 × 8 @ 80 kg

Set 1: [80 kg] [8 reps] ✓ Done
Set 2: [80 kg] [8 reps] ✓ Done
Set 3: [  ?  ] [  ?  ] → Tap to log
Set 4: [  —  ] [  —  ]
```

- Pre-fill weight from prescribed load
- Confirm or override
- Never require clients to type unnecessarily

## Progress visualization

- Line graphs for strength progression (not tables)
- Body weight trend (smooth 7-day rolling average)
- Photos: before/after side by side
- Week-over-week volume summary (simple bar chart)

Keep it encouraging: show improvement, not gaps.

## Weekly feedback form

Simple, focused:

1. Energy level this week (1–5)
2. Sleep quality (1–5)
3. Soreness level (1–5)
4. Open comment (optional)
5. Submit

This feeds into `WeeklyFeedback` and adjusts future volume recommendations.

## Mobile-first rules

- Touch targets ≥ 44px
- No hover-only interactions
- Bottom navigation or floating action button (not top tabs)
- Avoid modals that obscure the full screen on small phones
- Test on 375px width (iPhone SE) as minimum

## Visual design — DS v3.0

Client app uses **DS v3.0** (see `docs/DESIGN_SYSTEM_V3.0_STRYVR_NATIVE.md`):

- **Light mode default** : `#F3F3F3` fond, `#FFFFFF` cards, `#000000` texte — gym lighting est souvent fort
- **Dark mode** : `#0A0A0A` fond, `#141414` cards, `#FFFFFF` texte — toggle système
- **Accent** : `#FF6116` — arcs de progression, métriques actives, CTA
- **Police** : Urbanist — grandes métriques numériques (72px bold) + labels
- **Pattern métrique** : `[valeur hero noir] [unité gris] / [qualificatif gris]` — ex: `"83  Good"`

Grandes valeurs numériques (`metric-hero`, 72px) pour les scores de readiness, sleep, etc.
Arc semi-circulaire SVG `#FF6116` comme composant signature de progression.
Tab active : pill `#000000` light / `#FFFFFF` dark — jamais souligné ou coloré.

## Privacy

- Client photos are sensitive — display only in authenticated views
- Never show one client's data to another client
- Log all photo access server-side
