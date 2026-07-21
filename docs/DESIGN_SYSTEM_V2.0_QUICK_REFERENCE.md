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

- **Pas de bordure sur les boutons** : utiliser uniquement des nuances de fond.
- **Inputs noir profond** : fond `#0a0a0a` avec bordure très fine.

```tsx
// Input standard
<input className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-4 h-[52px] text-white placeholder:text-white/20 focus:outline-none" />

// Bouton CTA Principal
<button className="rounded-xl bg-[#1f8a65] text-white hover:bg-[#217356] active:scale-[0.99] transition-all duration-150">Label</button>

// Bouton CTA Secondaire (sans bordure, fond subtil)
<button className="rounded-xl bg-white/[0.04] text-white/55 hover:bg-white/[0.08] active:scale-[0.99] transition-all duration-150">Label</button>

// Bouton Discret / Icône seule
<button className="flex items-center justify-center w-8 h-8 rounded-md text-white/25 hover:text-white/55 hover:bg-white/[0.05] transition-all duration-150">Icon</button>
```

---

## Modales d'Information (InfoTooltip / Popovers)

Pour les explications contextuelles (ex: calculs de normes ou détails de métriques) :
- **Bouton déclencheur** : Icône `Info` discrète (11px, `text-white/25 hover:text-white/55 hover:bg-white/[0.05]`).
- **Corps de la modal** :
  - Fond noir très sombre `#0e0e0e`.
  - Bordure ultra-fine `0.5px solid rgba(255,255,255,0.08)`.
  - Ombres portées autorisées uniquement ici pour détacher le popover : `boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)'`.
  - Police de description : `text-[11px] text-white/70 leading-[1.65]`.
  - Section source (si applicable) : bordure haute fine + `text-[9px] text-white/25`.
  - Fermeture automatique au clic en dehors (click-outside listener).

---

## Nuances de Gris & Layouts

La hiérarchie visuelle repose sur le contraste des surfaces sombres sans charger l'interface de lignes ou d'effets superflus :
- **Fond unique** : `#121212` (Flat Dark).
- **Cartes & Blocs de premier niveau** : `bg-white/[0.02]` (ou `#181818`) avec bordure fine `border-[0.3px] border-white/[0.06]`.
- **Surfaces internes & pliables** : bordure fine `border-white/[0.06]` ou `border-white/[0.015]` pour séparer les sous-zones.
- **Champs de saisie & tables** : fond noir `#0a0a0a` ou `#0d0d0d` pour creuser la profondeur.

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
2. ✅ `border-[0.3px] border-white/[0.06]` sur tous les blocs (bordure ultra-fine)
3. ✅ Pas d'ombres (`shadow-*`) — sauf sur les popovers/tooltips d'info pour les détacher
4. ✅ Pas de hex hardcodés — utiliser les tokens DS
5. ✅ Opacités texte : 100, 90, 60, 45, 40, 20 (jamais autres valeurs)
6. ✅ Accent vert `#1f8a65` uniquement (pas bleu, rouge, autre)
7. ✅ Pas de bordure sur les boutons (CTA principal/secondaire)


---

**See `DESIGN_SYSTEM_V2.0_REFERENCE.md` for components, animations, and detailed specs.**
