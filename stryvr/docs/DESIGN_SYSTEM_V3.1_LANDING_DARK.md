# DESIGN SYSTEM V3.1 — STRYVR Landing Dark
> Extension du DS v3.0 native pour le web landing `/app/stryvr/`
> Dernière mise à jour : 2026-05-16
>
> ⚠️ **OBSOLÈTE — DA TECHNOGYM ADOPTÉE (2026-05-16)**
>
> Ce document décrivait la DA v3.1 (zinc dark, `#111115`, orange `#FF6116`).
> La DA a été remplacée par la **DA Technogym** :
> - Fond `#0a0a0a` (noir pur, pas zinc)
> - Accent `#F5D800` (jaune, pas orange)
> - Grille industrielle `gap-1px`
> - Typo uppercase bold 800-900
>
> **Source de vérité actuelle** → spec `docs/superpowers/specs/2026-05-14-stryvr-beta-landing-design.md`
> **Implémentation** → `app/stryvr/components/BetaLandingClient.tsx` (commit `e9d7b20`)
>
> Ce fichier est conservé à titre d'historique uniquement.

---

> ~~Aligné shadcn/ui dark zinc canonique (oklch source)~~ — abandonné 2026-05-16

---

## 1. Palette — tokens canoniques

```ts
// Surfaces — zinc dark, jamais noir pur
const BG    = '#111115';  // background — oklch ≈ 0.16, légèrement réchauffé
const CARD  = '#1c1c20';  // card — oklch ≈ 0.205
const MUTED = '#2a2a2e';  // muted / input / secondary surface — oklch ≈ 0.269

// Text
const FG    = '#fafafa';  // foreground — oklch(0.985 0 0)
const MFG   = '#a1a1aa';  // muted-foreground — oklch(0.708 0 0)
const SFG   = '#71717a';  // subtle (zinc-500) — usage très limité

// Borders
const BD    = 'rgba(255,255,255,0.10)';  // border standard — oklch(1 0 0 / 10%)
const BDI   = 'rgba(255,255,255,0.06)';  // border internal (rows, dividers)

// Accent — orange FF6116, usage CHIRURGICAL (max 7 points par page)
const AC    = '#FF6116';
const ACR   = 'rgba(255,97,22,0.12)';   // tint très discret (badge bg uniquement)
const ACBR  = '1px solid rgba(255,97,22,0.25)'; // border accent
```

### Règle fond : jamais #000000 ni #09090b
Le fond doit toujours être `#111115` minimum. Pas de noir pur.

---

## 2. Radius — système 2 niveaux

```ts
const R  = 6;   // card, container, tableau, ComposerDemo, input bloc
const RS = 4;   // small — badges, chips, boutons, items rows, pills
```

### Règles d'application
- **Grilles `gap-px`** : `borderRadius: R` + `overflow: 'hidden'` sur le **wrapper** uniquement — jamais sur les cells internes
- **Éléments standalone** : `R` si surface principale, `RS` si élément secondaire/badge
- **Barres de données** : `borderRadius: RS` — les barres de progression ont du radius
- **Séparateurs `height: 1`** : aucun radius — ce sont des lignes, pas des surfaces

---

## 3. Surfaces — hiérarchie

| Niveau | Token | Hex | Usage |
|--------|-------|-----|-------|
| Page | `BG` | `#111115` | Fond de page, wrapper principal |
| Card | `CARD` | `#1c1c20` | Cards standalone, sections alternées |
| Muted | `MUTED` | `#2a2a2e` | Inputs, surfaces secondaires, hover state |
| Elevated | `BD` (10% white) | semi-transparent | Borders sur toutes les surfaces |

### Sections alternées
Alterner `BG` et `CARD` pour distinguer les sections sans couleur. Pas de dégradés décoratifs.

---

## 4. Glass — usage unique : navbar

```ts
const navbarGlass = {
  backgroundColor: 'rgba(17,17,21,0.90)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  borderBottom: `1px solid ${BD}`,
};
```

**Règle absolue** : `backdropFilter: blur()` uniquement sur la navbar sticky. Jamais sur les cards de contenu.

---

## 5. Orange — 7 usages max par page

L'orange `#FF6116` est une couleur signal, pas décorative.

| Usage autorisé | Élément |
|----------------|---------|
| CTA principal | Bouton "Rejoindre la bêta" (navbar + section finale) |
| H1 accent | `"Pas toi."` — mot de tension unique |
| H2 span | 1 mot en orange par titre de section max |
| Data viz | Barre STRYVR 24h (comparaison coach) |
| Composer | Progress bar + item actif |
| Badge produit | Badge "Bêta" navbar |

**Interdit** : textes courants, labels de step, timestamps, valeurs métriques, backgrounds de section, radial glows décoratifs.

---

## 6. Typographie

```
Police : Urbanist (Google Fonts) — var(--font-urbanist, system-ui)
```

| Rôle | Taille | Poids | Couleur |
|------|--------|-------|---------|
| H1 hero | clamp(44px, 6.5vw, 72px) | 300 / 400 | FG |
| H2 section | clamp(28px, 4vw, 44px) | 300 | FG |
| Section label | 10px | 600 | SFG |
| Body | 14-15px | 300-400 | FG / MFG |
| Meta / sub | 10-11px | 400 | MFG / SFG |
| Badge / chip | 9-10px | 500-600 | MFG |

### Règles
- `fontWeight: 300` pour les descriptions — jamais 700+ sur le texte courant
- `letterSpacing: '-0.025em'` sur les H2, `'-0.035em'` sur les H1
- `fontVariantNumeric: 'tabular-nums'` sur toutes les valeurs numériques
- `whiteSpace: 'pre-line'` pour les labels multi-lignes dans les cards

---

## 7. Composants tokens

### Card standard
```ts
const card = {
  backgroundColor: CARD,
  border: `1px solid ${BD}`,
  borderRadius: R,
};
```

### Card muted (hover state, secondary)
```ts
const cardMuted = {
  backgroundColor: MUTED,
  border: `1px solid ${BD}`,
  borderRadius: R,
};
```

### Badge / chip
```ts
const chip = {
  backgroundColor: MUTED,
  border: `1px solid ${BDI}`,
  borderRadius: RS,
  padding: '4px 10px',
  fontSize: 10,
  fontWeight: 500,
  color: SFG,
};
```

### Bouton CTA orange
```ts
const ctaButton = {
  backgroundColor: AC,       // #FF6116
  color: '#FFFFFF',
  borderRadius: RS,
  height: 34,
  padding: '0 14px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};
```

### Grille gap-px (tableau multi-colonnes)
```tsx
// Wrapper
<div className="grid grid-cols-N gap-px" style={{
  border: `1px solid ${BD}`,
  backgroundColor: BD,
  borderRadius: R,
  overflow: 'hidden',
}}>
  // Cells — aucun borderRadius sur les enfants
  <div style={{ backgroundColor: CARD, padding: '...' }} />
</div>
```

---

## 8. Animations

```ts
// Entrée — fade + slide up
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] },
  }),
};

// whileInView standard
initial={{ opacity: 0, y: 10 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true }}
transition={{ duration: 0.6, delay: i * 0.07 }}

// Barres animées
initial={{ width: 0 }}
whileInView={{ width: `${pct * 100}%` }}
viewport={{ once: true }}
transition={{ duration: 1.0, ease: 'easeOut' }}
```

---

## 9. Texture noise

```tsx
// SVG noise — opacity 0.03, ID unique via useId() pour StrictMode
<svg style={{ position: 'fixed', opacity: 0.03 }}>
  <filter id={filterId}>
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
  <rect width="100%" height="100%" filter={`url(#${filterId})`} />
</svg>
```

---

## 10. Anti-patterns — JAMAIS

```
✗ backgroundColor: '#000000' ou '#09090b' — trop noir
✗ backdropFilter: blur() sur les cards de contenu
✗ radial-gradient orange décoratif
✗ linear-gradient de fondu entre sections
✗ borderRadius sur cells internes d'une grille gap-px
✗ orange sur texte courant, labels, valeurs métriques
✗ plus de 7 usages orange par page
✗ fontWeight: 700+ sur descriptions et body
✗ rgba(0,0,0,...) sur fond dark — utiliser rgba(255,255,255,...) pour superpositions
✗ glassmorphism sur les cards — réservé navbar uniquement
```
