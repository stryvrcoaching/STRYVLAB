# STRYVR Design System v2.0 — Quick Reference

> **Condensed version** — essentials only.
> **Full reference** → see `DESIGN_SYSTEM_V2.0_REFERENCE.md` for complete specs.

## Philosophie

**Flat. Dark. Sans bruit.**
- Pas de bordures ni ombres
- Hiérarchie : nuances de couleur + opacité texte
- Unique background : `#121212`

---

## Couleurs Essentielles

| Rôle | Valeur | Usage |
|------|--------|-------|
| **App bg** | `#121212` | Fond unique — jamais intermediate |
| **Card bg** | `bg-white/[0.02]` | Overlays sur fond |
| **Input bg** | `#0a0a0a` | Champs texte |
| **Accent** | `#1f8a65` | CTA, actif, progress |
| **Accent hover** | `#217356` | Hover uniquement |
| **Border** | `border-[0.3px] border-white/[0.06]` | Tous éléments |
| **Text white** | `text-white` | Titres |
| **Text muted** | `text-white/60` | Corps |
| **Text subtle** | `text-white/40` | Labels section |

---

## Typographie

| Niveau | Classes | Quand |
|--------|---------|-------|
| **H1** | `text-[2.4rem] font-black` | Page hero |
| **H2** | `text-xl font-semibold` | Titre bloc |
| **Body** | `text-[13px] text-white/60` | Contenu |
| **Field** | `text-[10px] font-bold uppercase tracking-[0.18em]` | Label input |
| **Small** | `text-[11px] text-white/45` | Descriptions |
| **Data** | `font-mono` | Nombres (poids, reps) |

---

## Boutons & Inputs

```tsx
// Input
<input className="w-full rounded-xl bg-[#0a0a0a] px-4 h-[52px] text-white placeholder:text-white/20 focus:outline-none" />

// Bouton CTA
<button className="rounded-xl bg-[#1f8a65] text-white hover:bg-[#217356] active:scale-[0.99]">Label</button>

// Bouton secondaire
<button className="rounded-xl bg-white/[0.04] text-white/55 hover:bg-white/[0.08]">Label</button>
```

---

## Arrondis

| Contexte | Classe |
|----------|--------|
| Blocs | `rounded-2xl` |
| Cards, inputs | `rounded-xl` |
| Chips | `rounded-lg` |
| Badges | `rounded-full` |

---

## Espacements

- **Padding bloc** : `p-8` à `p-12`
- **Gap sections** : `mb-6` à `mb-8`
- **Padding inputs** : `px-4 h-[52px]`
- **Card padding** : `p-4` à `p-5`

---

## TopBar & Navigation

**TopBar = Unique Navigation/Header**
- Use `useSetTopBar(topBarLeft, topBarRight)` hook
- TopBarLeft: section label (`text-[9px] text-white/30`) + title (`text-[13px] text-white`)
- TopBarRight: action buttons (usually "+ Nouveau" style)
- NEVER duplicate header in main content
- `<main>` MUST use `bg-[#121212]`

**BottomNav** (client app)
- 5–6 fixed items bottom screen
- Icons + labels, active highlight `#1f8a65`
- Buttons in TopBar style: `h-8 rounded-lg text-[12px] font-bold`

---

## Loading States

**Always use `<Skeleton>`** — never spinner-only for page/section load.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

<Skeleton className="h-4 w-32" />  // generic shimmer
<Skeleton className="w-9 h-9 rounded-lg" />  // icon placeholder
```

---

## Règles Non-Négociables

1. ✅ `#121212` bg app, jamais `#181818` en principal
2. ✅ `border-[0.3px] border-white/[0.06]` sur tous les blocs
3. ✅ Pas d'ombres (`shadow-*`) — jamais
4. ✅ Pas de hex hardcodés — utiliser les tokens DS
5. ✅ Opacités texte : 100, 90, 60, 45, 40, 20 (jamais autres valeurs)
6. ✅ Accent vert `#1f8a65` uniquement (pas bleu, rouge, autre)

---

**See `DESIGN_SYSTEM_V2.0_REFERENCE.md` for components, animations, and detailed specs.**
