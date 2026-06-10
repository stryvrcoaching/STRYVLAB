---
name: design-system
description: Apply and extend the STRYVR design system — tokens, components, and patterns
---

> **Source de vérité complète** → `docs/DESIGN_SYSTEM_V3.0_STRYVR_NATIVE.md`
>
> Ce skill est un résumé rapide. Pour toute implémentation UI, lire le doc complet.

## Contexte : deux design systems coexistent

| Contexte | DS | Police | Accent | Mode |
|----------|----|--------|--------|------|
| Coach dashboard (web Next.js) | DS v2.0 | Lufga | `#1f8a65` vert | Dark uniquement |
| Client app (native Expo) | DS v3.0 | Urbanist | `#FF6116` orange | Light (défaut) + Dark |

**Ne jamais mélanger les tokens des deux systèmes.**

---

## DS v3.0 — Client App Native

### Couleurs — Light Mode (défaut)

```typescript
// constants/colors.ts
export const COLORS = {
  accent: '#FF6116',           // arcs, CTA, métriques actives
  accentSoft: 'rgba(255,97,22,0.30)',

  surfaceBase: '#F3F3F3',      // fond app
  surfaceCard: '#FFFFFF',      // cards
  surfaceElevated: '#EBEBEB',  // inputs, hover

  textPrimary: '#000000',      // valeurs numériques, titres
  textSecondary: '#767676',    // labels, unités
  textTertiary: '#ABABAB',     // placeholders, metadata

  borderSubtle: 'rgba(0,0,0,0.06)',

  tabActiveBg: '#000000',
  tabActiveText: '#FFFFFF',
  tabInactiveText: '#767676',
} as const
```

### Couleurs — Dark Mode

```typescript
export const COLORS_DARK = {
  // accent: '#FF6116' — inchangé
  surfaceBase: '#0A0A0A',
  surfaceCard: '#141414',
  surfaceElevated: '#1E1E1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#8A8A8A',
  textTertiary: '#4A4A4A',
  borderSubtle: 'rgba(255,255,255,0.06)',
  tabActiveBg: '#FFFFFF',
  tabActiveText: '#000000',
  tabInactiveText: '#5A5A5A',
} as const
```

### Typographie — Urbanist

```typescript
// Police: Urbanist partout — SF Pro fallback iOS, Roboto Android
// tabular-nums sur toutes les valeurs numériques

const FONT = {
  metricHero:    { fontSize: 72, fontWeight: '700', lineHeight: 72 },
  metricLarge:   { fontSize: 48, fontWeight: '700', lineHeight: 52 },
  metricMedium:  { fontSize: 32, fontWeight: '600' },
  heading1:      { fontSize: 28, fontWeight: '700' },
  heading2:      { fontSize: 22, fontWeight: '600' },
  labelPrimary:  { fontSize: 15, fontWeight: '500' },
  labelSecondary:{ fontSize: 13, fontWeight: '400' },
  unit:          { fontSize: 15, fontWeight: '400', color: COLORS.textSecondary },
  tabLabel:      { fontSize: 11, fontWeight: '500' },
}
```

**Pattern métrique signature** : `[metric-hero noir] [unit gris] / [qualificatif gris]`
Ex : `"79  ms/Good"`, `"8.1  h/Good"`, `"37.7  C"`

### Espacement & Arrondis

```typescript
// Multiples de 4 uniquement
const SPACING = { 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 8:32, 10:40, 12:48 }

const RADIUS = {
  none: 0,    // sleep stages bars UNIQUEMENT
  sm:   8,    // tab active, date picker, chevron container, bouton inner icon
  md:   12,   // inputs, boutons principaux, cards petites
  lg:   16,   // cards standards, icon container features
  xl:   20,   // cards larges, CTA navbar
  '2xl': 24,  // cards hero, success card, panels principaux
  full: 9999, // badges pill (Bêta), dots indicateurs, avatars — PAS sur boutons ni cards
}
```

**S'applique identiquement app native ET landing web** — la landing est le miroir de l'app.

**`radius-full` = badges pill texte, dots, avatars UNIQUEMENT** — jamais sur CTA, jamais sur cards.

### Patterns de composants (universels)

> Tout composant = un pattern. Identifier le pattern avant d'implémenter.

**CARD MÉTRIQUE** — `bg #FFFFFF`, `radius-xl 20px`, `padding 20px`, zéro bordure, zéro shadow.
Structure : `[label 15px/400]` + `[action chip]` → `[valeur hero + qualifier inline]` → `[viz optionnelle]`

**MÉTRIQUE + UNITÉ/QUALIFICATIF** — même ligne toujours. `[valeur 700 #000] [unité 400 #767676]`
Fusionner si besoin : `"8.1 h/Good"`, `"79 ms/Good"`, `"37.7 C"`. Jamais sur 2 lignes.

**ARC DE PROGRESSION** — SVG 180°, fond `#D8D8D8` VISIBLE, actif `#FF6116`, strokeWidth 6-8px, round.
Score = **SOUS l'arc**, PAS au centre dedans. Dot terminal `#FF6116` 8-10px.

**JAUGE VERTICALE (fill gauge)** — 2 colonnes côte à côte, `radius-0`, ZÉRO container.
Fill `#FF6116` | Fond `#1A1A1A`. Graduations blanches 1px sur fond noir. Valeur texte à gauche.

**SELECTOR ACTIF** (tab, date, filtre) — rectangle `4-6px radius`, fond `#000000` light / `#FFFFFF` dark.
Contenu centré, couleur inversée. JAMAIS pill/rounded-full. Inactif = transparent + `#767676`.

**CHART SEGMENTÉ** (sleep, macros, zones) — barres contiguës, `radius-0` ABSOLU.
Awake `#FF6116` / REM `#1A1A1A` / Light `#767676` / Deep `#3A3A3A`.

**STEP-LINE / ECG** — path SVG angles droits 90°, PAS courbe lisse. Stroke `rgba(0,0,0,0.15)` 1px.
Dot accent `#FF6116` sur point actif.

**GRILLE MINI-MÉTRIQUES** — N colonnes, gap 8px, pas de bordure.
Delta+ = `#FF6116` + barre orange. Delta- = `#000000` + barre noire. Cohérence obligatoire.

**DOT RADIAL** — 28-36 dots `#FF6116` sur 360°, tiges `rgba(0,0,0,0.15)`. Valeur centrée.

**ACTION CHIP** (chevron, filtre cliquable) — `#EBEBEB`, `radius-sm 4-6px`, 28×28px. PAS radius-full.

**BADGE PILL INFORMATIF** (non-cliquable) — `radius-full` UNIQUEMENT ici. Couleur sémantique 10% bg.

**TAB BAR** — bg `rgba(235,235,235,0.92)` + blur, PAS blanc. Tabs = SELECTOR ACTIF. Icône seule, stroke 1.5px.

**Interactions** :
- Press : `scale(0.97)`, 100ms ease-in
- Release : `scale(1.0)`, 200ms spring
- Haptic : light sélections, medium actions

### Règles strictes

```
DO
✓ Urbanist partout
✓ #FF6116 arcs, delta+, barres positives, Awake sleep
✓ tabular-nums sur toutes valeurs numériques
✓ Cards #FFFFFF sur fond #F3F3F3 — zéro bordure, zéro shadow
✓ Score arc = SOUS l'arc, pas dedans
✓ Arc fond = #D8D8D8 visible (pas transparent)
✓ Sleep stages = radius-0
✓ Tab/date-picker active = rectangle radius-sm 8px
✓ stroke icons, touch targets ≥ 44px

DON'T
✗ Jamais pill/rounded-full sur tab ou date picker
✗ Jamais score centré dans l'arc
✗ Jamais arc fond transparent ou rgba noir
✗ Jamais radius sur sleep stages
✗ Jamais gradient décoratif, shadow portée, bordure > 0.5px
✗ Jamais #FF6116 sur texte courant
✗ En dark: jamais #181818 en surface-base
```

---

## DS v2.0 — Coach Dashboard Web

> Voir `.Codex/rules/ui-design-system.md` et `docs/DESIGN_SYSTEM_V2.0_REFERENCE.md`

- Fond : `#121212` (TOUJOURS, jamais intermédiaire)
- Cards : `bg-white/[0.02]`
- Accent : `#1f8a65`
- Police : Lufga
- Composants : primitives HTML natives + Tailwind, pas shadcn
