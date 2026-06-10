# STRYVR — Design System V3.0 — Native Premium App

> **Source de référence** pour le design system STRYVR Native (iOS/Android).
> Couvre : Light Mode (défaut) + Dark Mode (premium).
> App native premium haut de gamme — chaque décision vise la clarté, la densité et l'élégance.

**Dernière mise à jour : 2026-05-16 (v3.2 — radius doctrine + Optical & Material System)**

> ### Distinction App Native vs Landing Web
>
> Ce document couvre l'**app mobile native** (Expo/React Native) uniquement.
>
> La **landing web** `/stryvr` utilise une DA distincte :
> - Fond `#0a0a0a` (noir pur, pas `#F3F3F3`)
> - Accent `#F5D800` **jaune** (DA Technogym — pas `#FF6116` orange)
> - Style industriel uppercase, grille gap-1px
>
> → Référence landing : `docs/superpowers/specs/2026-05-14-stryvr-beta-landing-design.md`
>
> L'accent `#FF6116` orange ci-dessous est valide **pour l'app native uniquement**.

---

## 1. Philosophie

**Signal. Précision. Respiration.**

- Les données biométriques sont le contenu principal — le chrome UI disparaît
- Les chiffres dominent : grandes valeurs numériques, hiérarchie typographique forte
- L'accent orange (#FF6116) est réservé aux métriques actives et états positifs/critiques
- Le noir (#000000) est un accent fort, jamais fond dominant en light mode
- Zéro décoration : pas de gradients ornementaux, zéro shadow portée, zéro bordure épaisse
- Densité informationnelle élevée mais jamais oppressante — whitespace généreux
- Motion : fonctionnel uniquement (arcs, transitions) — jamais gratuit

---

## 2. Palette de Couleurs

### 2.1 Couleurs Primaires (invariantes light + dark)

| Token | Valeur | Usage |
|-------|--------|-------|
| `accent-primary` | `#FF6116` | Arcs actifs, deltas positifs, barres positives, Awake sleep, CTA |
| `accent-secondary` | `rgba(255,97,22,0.30)` | Dot plots, glows, états secondaires |
| `black` | `#000000` | Texte primaire light, tab active light, barre delta négatif |
| `white` | `#FFFFFF` | Surfaces light, texte dark, tab active dark |

### 2.2 Light Mode (défaut)

| Token | Valeur | Usage |
|-------|--------|-------|
| `surface-base` | `#F3F3F3` | Fond app principal |
| `surface-card` | `#FFFFFF` | Cards — différenciées du fond par contraste seul, zéro bordure |
| `surface-tab-bar` | `rgba(235,235,235,0.92)` | Fond tab bar + blur — légèrement plus gris que surface-card |
| `surface-elevated` | `#EBEBEB` | Inputs, chevron container, éléments surélevés |
| `surface-overlay` | `rgba(0,0,0,0.03)` | Fond cellule grille sparklines |
| `text-primary` | `#000000` | Valeurs numériques héros, titres, labels forts |
| `text-secondary` | `#767676` | Labels section, unités, qualificatifs, descriptions |
| `text-tertiary` | `#ABABAB` | Placeholders, timestamps, metadata très discrets |
| `border-subtle` | `rgba(0,0,0,0.06)` | Séparateurs internes (entre stress/recovery dans card) |
| `arc-track` | `#D8D8D8` | Arc fond (portion non atteinte) — PAS rgba noir, gris visible |
| `tab-active-bg` | `#000000` | Background tab active (rectangle radius-sm) |
| `tab-active-icon` | `#FFFFFF` | Icône sur tab active |
| `tab-inactive-icon` | `#767676` | Icônes tabs inactives |

### 2.3 Dark Mode (premium)

| Token | Valeur | Usage |
|-------|--------|-------|
| `surface-base` | `#0A0A0A` | Fond app principal |
| `surface-card` | `#141414` | Cards |
| `surface-tab-bar` | `rgba(14,14,14,0.92)` | Fond tab bar + blur |
| `surface-elevated` | `#1E1E1E` | Inputs, hover, éléments surélevés |
| `text-primary` | `#FFFFFF` | Valeurs numériques, titres |
| `text-secondary` | `#8A8A8A` | Labels, unités |
| `text-tertiary` | `#4A4A4A` | Placeholders, metadata |
| `border-subtle` | `rgba(255,255,255,0.06)` | Séparateurs, contours cards |
| `arc-track` | `rgba(255,255,255,0.12)` | Arc fond dark |
| `tab-active-bg` | `#FFFFFF` | Background tab active (rectangle radius-sm) |
| `tab-active-icon` | `#000000` | Icône sur tab active dark |
| `tab-inactive-icon` | `#5A5A5A` | Icônes tabs inactives dark |

### 2.4 Couleurs Sémantiques

| Token | Valeur | Usage |
|-------|--------|-------|
| `status-good` | `#34C759` | Scores Good |
| `status-warning` | `#FF9F0A` | Scores Fair |
| `status-critical` | `#FF3B30` | Scores Poor |
| `delta-positive` | `#FF6116` | Delta +% sparklines, barre orange |
| `delta-negative` | `#000000` | Delta -% sparklines, barre noire |

### 2.5 Couleurs Sleep Stages

| Token | Valeur | Usage |
|-------|--------|-------|
| `sleep-awake` | `#FF6116` | Phase éveil — orange accent |
| `sleep-rem` | `#1A1A1A` | Phase REM — quasi noir |
| `sleep-light` | `#767676` | Sommeil léger — gris moyen |
| `sleep-deep` | `#3A3A3A` | Sommeil profond — gris sombre |

---

## 3. Typographie

### 3.1 Police : Urbanist (exclusive)

```
font-family: 'Urbanist'
Fallback iOS: SF Pro Display
Fallback Android: Roboto
```

Géométrique sans-serif, formes ouvertes. Utilisée pour TOUTE l'interface sans exception.
`font-variant-numeric: tabular-nums` sur toutes les valeurs numériques.

### 3.2 Échelle Typographique

| Nom | Taille | Poids | Usage |
|-----|--------|-------|-------|
| `metric-hero` | ~60-72px | **300–400** | Scores principaux (83, 48) — la taille fait la présence, jamais le gras |
| `metric-large` | 40-48px | **300–400** | Valeurs importantes (37.7°C, 8.1h) |
| `metric-medium` | 32px | **400** | Valeurs grille secondaires |
| `metric-small` | 22px | **400–500** | Valeurs mini sparklines |
| `heading-page` | 17px | 500 | Titre page centré ("Vitals") |
| `heading-section` | 15px | 400 | Label section top-left card ("Readiness", "Sleep") |
| `label-primary` | 15px | 500 | Valeurs quali secondaires ("Medium", "High") |
| `label-secondary` | 11-13px | 400 | Labels sous-valeurs quali ("Stress Level") |
| `label-small` | 11px | 400 | Delta %, légendes, axes |
| `unit` | 17px | 400 | Unité inline après valeur ("h", "C", "ms") — `text-secondary` |
| `qualifier` | 17px | 400 | Qualificatif inline ("Good", "Fair") — `text-secondary`, même ligne que métrique |
| `date-active` | 13px | 500 | Date picker item actif |
| `date-inactive` | 13px | 400 | Date picker items inactifs |

**Doctrine typographique** :
> La présence vient de la **taille**, du **contraste** et de l'**espace** — jamais du poids.
> `font-weight: 700` ou `800` = destruction immédiate du registre clinique premium.
> Maximum autorisé sur métriques : `400`. Maximum autorisé sur labels actifs : `500–600`.

### 3.3 Patterns Typographiques Observés

**Pattern 1 — Métrique + Qualificatif inline (même ligne) :**
```
[metric-hero: #000, left]  [qualifier: #767676, 17px/400, inline à droite]
Exemple : "83  Good"   "8.1  h/Good"   "37.7  C"
```
⚠️ Le qualificatif n'est PAS en dessous — il est sur la même ligne, décalé à droite.

**Pattern 2 — Label section top-left :**
```
[heading-section: #000, 15px/400, top-left de la card]
Exemple : "Readiness"   "Sleep"   "Body Temperature"
```
Label `weight: 400` — pas bold, pas uppercase.

**Pattern 3 — Micro-métriques (Stress/Recovery) :**
```
[label-secondary: #767676, 11px]   ← "Stress Level"
[label-primary: #000, 15px/600]    ← "Medium"
────── séparateur 0.5px rgba(0,0,0,0.06) ──────
[label-secondary: #767676, 11px]   ← "Recovery Index"
[label-primary: #000, 15px/600]    ← "High"
```

**Pattern 4 — Sparkline mini :**
```
[metric-small: #000, 22px/700]     ← valeur "83"
[delta: #FF6116 ou #000, 11px]     ← "+3%" ou "-2%"
[barre rect 3px: orange ou noir]   ← indicateur direction
[ECG path derrière: rgba stroke]
```

---

## 4. Iconographie

- **Stroke uniquement** — jamais filled sauf tab active
- Stroke weight : `1.5px` standard, `2px` sur tab active
- Terminaisons : `round` (strokeLinecap + strokeLinejoin)
- Taille tab bar : `22px`
- Taille actions inline : `18px`
- Couleur inactive : `#767676` (~60% opacity)

**Tabs de l'app — 5 icônes dans l'ordre :**
1. Home — maison
2. Reports/Data — document/fichier
3. **Vitals** — cœur + mains (tab centrale, active par défaut sur screenshots)
4. Charts/Analytics — barres verticales
5. Settings — engrenage

---

## 5. Espacements & Grille

### 5.1 Unité de base : 4px

| Token | Valeur | Usage |
|-------|--------|-------|
| `space-1` | 4px | Micro (icône ↔ label) |
| `space-2` | 8px | Interne compact |
| `space-3` | 12px | Gap entre cards |
| `space-4` | 16px | Padding standard, marges page |
| `space-5` | 20px | Padding card standard |
| `space-6` | 24px | Padding card spacieux |
| `space-8` | 32px | Entre sections |
| `space-10` | 40px | Grands séparateurs |

### 5.2 Marges de Page

- Horizontal : `16-20px`
- Gap entre cards : `12px`
- Layout : vertical empilé, scroll — pas de grille multi-colonnes sur la page principale

### 5.3 Arrondis — Doctrine Radicale

**Le radius n'est PAS un élément identitaire de STRYVR.**

Le système est **industriel, architectural, quasi hardware**. La perception de douceur vient de la lumière, du blur, des opacités et du spacing — jamais des coins arrondis.

**Distribution réelle observée dans les mockups :**

| Élément | Radius réel |
|---------|-------------|
| Charts, barres, timelines, segments | **0px** |
| Cards métriques | **0px** — séparation par contraste seul |
| Containers sections | **0px** |
| Glass overlays / panels | **0px** |
| Inputs, champs | **0px** |
| Boutons CTA | **0px** |
| Tab active | **0–4px max** — quasi carré |
| Chips / tags courts | **0–2px** |
| Dots de statut / avatars | **50%** (cercle natif) |
| Phone frame (hardware) | **radius naturel du device** — exception unique |

**Règle absolue** :
> 95% des éléments UI sont à **0px**. Le radius est l'exception, jamais la règle.
> La douceur perçue doit venir de : blur · lumière · contraste · spacing · opacités.
> Jamais des coins arrondis.

**Ce qui détruirait immédiatement l'esthétique** :
- `rounded-xl`, `rounded-2xl`, `rounded-3xl` sur des cards → effet "SaaS wellness générique"
- Pills sur boutons CTA → "app fitness moderne"
- Radius > 4px sur tabs → "iOS Consumer App"

**Tokens conservés (usage ultra-restreint)** :

| Token | Valeur | Usage autorisé |
|-------|--------|----------------|
| `radius-0` | 0px | Tout — valeur par défaut universelle |
| `radius-hairline` | 2px | Chips très courts, tags inline — éviter les artefacts visuels uniquement |
| `radius-sm` | 4px | Tab active, date picker active — dernier recours |
| `radius-hardware` | Natif device | Phone frame uniquement — jamais en UI |
| `radius-circle` | 50% | Dots, avatars, arcs SVG — natif géométrique |

---

## 6. Composants — Patterns Universels

> Chaque section définit un **pattern réutilisable**, pas une instance spécifique.
> Tout nouveau composant doit s'identifier à l'un de ces patterns et hériter de ses règles.

---

### 6.1 Pattern : CARD MÉTRIQUE

**Quand l'utiliser** : affichage d'une valeur principale + contexte secondaire. Readiness, Sleep, HRV Balance, Body Temperature, Calories, etc.

```
background: #FFFFFF (light) / #141414 (dark)
border-radius: 0px — séparation par contraste seul
padding: 20px horizontal, 16-24px vertical
border: AUCUNE — contraste fond/card suffit
shadow: AUCUNE
gap entre cards: 12px
```

**Structure universelle** :
```
┌──────────────────────────────────────────┐
│ [label-section 15px/400]        [action] │  ← top row
│                                          │
│ [VALEUR metric-hero]  [unit/qualifier]   │  ← métrique principale, inline
│                                          │
│ [données secondaires ou visualisation]   │  ← optionnel, bas de card
└──────────────────────────────────────────┘
```

**Variante 2 colonnes** (quand il y a des métriques secondaires) :
```
│ [VALEUR hero]    │  [label secondaire]  │
│                  │  [valeur secondaire] │
│                  │  ──────────────────  │
│                  │  [label secondaire]  │
│                  │  [valeur secondaire] │
```

**Action top-right** = toujours le pattern SELECTOR ACTIF (voir 6.5) en mode chevron.

---

### 6.2 Pattern : MÉTRIQUE + UNITÉ/QUALIFICATIF

**Quand l'utiliser** : toute valeur numérique avec unité ou état qualitatif. S'applique partout : cards, headers, listes.

```
[VALEUR metric-hero/large/medium #000]  [unité/qualificatif 17px/400 #767676]
```

- Valeur et qualificatif sur **la même ligne** — jamais sur deux lignes
- Séparateur entre valeur et unité : espace simple
- Si unité et qualificatif simultanés : fusionnés `"h/Good"`, `"ms/Good"`, `"°C"`
- Valeur = toujours `font-weight 700`, `#000000`
- Unité/qualificatif = toujours `font-weight 400`, `#767676`

**Variante avec séparateur** (quand un état secondaire suit) :
```
[VALEUR]  [unité]
──────────────────  ← ligne 0.5px rgba(0,0,0,0.06)
[état/label]
```

---

### 6.3 Pattern : ARC DE PROGRESSION

**Quand l'utiliser** : tout score ou progression sur une plage (0-100, 0-10, pourcentage). Sleep score, readiness, calories consommées, objectif hydratation, etc.

```
SVG arc semi-circulaire 180°
Arc fond  : stroke #D8D8D8 (light) / rgba(255,255,255,0.12) (dark) — VISIBLE, pas transparent
Arc actif : stroke #FF6116, strokeLinecap round
Stroke width : 6-8px selon taille
Dot terminal : cercle 8-10px #FF6116 au bout de l'arc actif
```

**Position de la valeur** : TOUJOURS sous l'arc, jamais au centre dedans.
```
  ╭──[arc orange]──╮
╭─╯  [arc gris]    ╰─╮
         48            ← chiffre ici, centré horizontalement sous le demi-cercle
```

**Variante mini** (dans header, targets bar) : même règles, dimensions réduites, strokeWidth 2-3px.

---

### 6.4 Pattern : JAUGE VERTICALE (FILL GAUGE)

**Quand l'utiliser** : toute donnée avec une plage verticale graduée. Température, pression, niveau d'énergie, intensité.

```
Layout : [valeur texte à gauche] + [jauge à droite]

Jauge (deux colonnes côte à côte, ZÉRO radius, ZÉRO container) :
  Colonne fill  : couleur accent (#FF6116 ou couleur sémantique), remplissage depuis le bas
  Colonne fond  : #1A1A1A (light) / #2A2A2A (dark), pleine hauteur
  Les deux colonnes se touchent — pas de bordure entre elles
  
Graduations : lignes horizontales 1px blanches, ~5-6px de long, sur la colonne fond
Labels axe  : 11px/400, #767676, alignés à droite de la colonne fond

Valeur texte (gauche) :
  [metric-large : valeur principale]  [unité 17px/400 #767676]
  ──── séparateur 0.5px ────
  [qualifier 13px/400 #767676]
```

**Règle universelle** : jamais de container arrondi autour de la jauge — les colonnes sont nues.

---

### 6.5 Pattern : SELECTOR ACTIF (rectangle)

**Quand l'utiliser** : tout élément qui indique un état sélectionné/actif dans une navigation ou timeline. Tab active, date active, filtre actif, step actif.

```
background : #000000 (light) / #FFFFFF (dark)
border-radius : 4-6px — rectangle quasi-carré, PAS pill
contenu : centré (icône seule OU texte seul, jamais les deux)
couleur contenu : inversée (#FFFFFF light / #000000 dark)
animation : spring scale 0.97 → 1.0, 200ms
```

**Élément inactif** : background transparent, contenu `#767676`.

**Interdit** : `border-radius: 9999px` (pill) sur tout selector actif de navigation.

---

### 6.6 Pattern : GRILLE DE MINI-MÉTRIQUES

**Quand l'utiliser** : comparaison de plusieurs valeurs du même type sur une période. HRV multi-jours, progression hebdomadaire, comparaison sessions.

```
Layout : N colonnes égales, gap 8px, pas de bordure entre colonnes

Chaque cellule :
  [valeur metric-small 22px/700 #000]
  [delta label-small 11px : #FF6116 si + / #000 si -]
  [barre indicatrice : rect height 3px, radius-0
    → #FF6116 si delta positif
    → #000000 si delta négatif]
  [visualisation derrière : optionnel, opacity faible]
```

**Règle delta** : couleur ET barre doivent être cohérentes — orange = positif partout, noir = négatif partout. Jamais de rouge pour négatif dans ce pattern.

---

### 6.7 Pattern : CHART SEGMENTÉ HORIZONTAL

**Quand l'utiliser** : représentation d'une donnée décomposée en phases/segments contigus. Sommeil (Awake/REM/Light/Deep), macros (P/L/G), zones de FC, répartition temporelle.

```
Type : barres rectangulaires contiguës
border-radius : 0 — rectangles purs, ZÉRO arrondi
height : fixe selon contexte (16-24px)
Espacement inter-segments : 0 (jointifs)
Labels : texte blanc 11px sur chaque segment si largeur > 40px, sinon omis
```

**Couleurs par type de donnée** :
- Données sommeil : Awake `#FF6116` / REM `#1A1A1A` / Light `#767676` / Deep `#3A3A3A`
- Données nutrition : P bleu / L amber / G vert (tokens sémantiques)
- Autres : utiliser l'échelle des gris + `#FF6116` pour l'accent principal

---

### 6.8 Pattern : VISUALISATION ECG / STEP-LINE

**Quand l'utiliser** : données biométriques en série temporelle. HRV, fréquence cardiaque, activité, variations de poids.

```
Type : SVG path en step-function (angles droits 90°) — PAS une courbe sinusoïdale lisse
Stroke : rgba(0,0,0,0.15) (light) / rgba(255,255,255,0.15) (dark)
Stroke width : 1px
Fill : none
Dot accent : cercle 6-8px #FF6116 sur le dernier point ou point actif
radius-0 sur tout élément de la visualisation
```

**Forme step** : lignes horizontales et verticales uniquement — transitions à angle droit. Signal ECG stylisé, pas une courbe interpolée.

---

### 6.9 Pattern : DOT RADIAL (score circulaire)

**Quand l'utiliser** : score global ou métrique composite sans direction temporelle. Score de readiness global, score de cohérence, score d'équilibre.

```
Points : 28-36 dots distribués sur 360°
Dot size : 4-8px variable selon intensité
Dot color : #FF6116
Tiges : lignes 1px depuis le centre, rgba(0,0,0,0.15)
Longueur tiges : 20-40px variable
Valeur : metric-hero centrée dans le cercle
Qualificatif : label-secondary centré sous la valeur
Animation : apparition staggered 15ms/dot, ease-out
```

---

### 6.10 Pattern : NAVIGATION BAR (tab bar)

**Quand l'utiliser** : navigation principale de l'app, persistante en bas d'écran.

```
height : 60px + safe area iOS
background : rgba(235,235,235,0.92) + blur(20px) light
             rgba(14,14,14,0.92) + blur(20px) dark
  ⚠️ Légèrement plus gris que surface-card — PAS blanc pur
séparateur haut : 0.5px border-subtle
padding horizontal : 8px

Tab active → Pattern SELECTOR ACTIF (6.5) : rectangle 4-6px, fond #000
Tab inactive : transparent, icône stroke 1.5px, #767676
Icônes : stroke uniquement, 22px, AUCUN label texte
```

---

### 6.11 Pattern : PICKER HORIZONTAL

**Quand l'utiliser** : sélection dans une liste scrollable horizontale. Dates, filtres, catégories, périodes.

```
scroll horizontal, snap-to-item
Item actif → Pattern SELECTOR ACTIF (6.5) : rectangle 4-6px, fond #000
Item inactif : transparent, texte 13px/400, #767676
Pas de séparateur entre items
```

---

### 6.12 Pattern : ACTION CHIP (drill-down, filtre, chevron)

**Quand l'utiliser** : tout élément interactif compact qui ouvre un détail ou applique une action. Chevron de card, bouton filtre, tag cliquable.

```
background : #EBEBEB (surface-elevated) light / #1E1E1E dark
border-radius : radius-sm (4-6px)
size : 28×28px (icône seule) ou padding 4px 10px (texte)
contenu : icône 12px stroke 2px #767676 OU texte label-small
touch target : 44×44px minimum
```

**Interdit** : `border-radius: 9999px` sur un chip d'action. Réservé aux badges informatifs uniquement.

---

### 6.13 Pattern : BADGE / PILL INFORMATIF

**Quand l'utiliser** : étiquette non-interactive portant un statut, une catégorie, un label. Badge "Bêta", tag phase, label statut.

```
border-radius : radius-full (9999px) — seul usage autorisé de radius-full hors avatar/dot
padding : 2px 8px
text : label-small 11px/700, uppercase si court (≤6 chars)
background : couleur sémantique à 10% opacité
text color : couleur sémantique pleine
border : 1px couleur sémantique à 20% opacité (optionnel)
```

**Distinction avec Action Chip** : badge = informatif, non-cliquable. Chip = interactif, cliquable.

---

### 6.14 Pattern : PAGE HEADER

**Quand l'utiliser** : en-tête de chaque écran principal.

```
layout : [titre centré] + [avatar/action top-right]
titre : 17px/600, #000000, centré horizontalement
avatar : 32px, radius-full, photo réelle
background : transparent (se fond sur surface-base)
```

---

## 7. Patterns d'Interaction

### 7.1 Press / Release

```
Press: scale(0.97), 100ms ease-in
Release: scale(1.0), 200ms spring
Haptic: light sur sélections
```

### 7.2 Animations de Données

```
Arc progress: 0 → cible, 800ms ease-out
Counter hero: count-up 0 → valeur, 600ms ease-out
Sparklines ECG: draw path, 500ms ease-out, delay 200ms
Dot radial: stagger 15ms/dot, ease-out
Sleep stages: expand gauche→droite, stagger 50ms/barre
```

### 7.3 Transitions Navigation

```
Push: slide horizontal, 350ms, cubic-bezier(0.25, 0.46, 0.45, 0.94)
Modal: slide depuis bas, 400ms, spring damping 0.8
Tab switch: cross-dissolve, 200ms
```

---

## 8. Structure Écrans

### 8.1 Tab Bar — 5 tabs dans l'ordre

```
[Home] [Reports] [Vitals ← active] [Charts] [Settings]
  🏠      📄         ♡↔️              📊        ⚙
```

Vitals = 3ème tab, centrale. Tab active par défaut sur les screenshots.

### 8.2 Vitals Screen — Layout Complet

```
┌─────────────────────────────────────┐
│ Vitals (centré)              [avatar]│  ← header
├─────────────────────────────────────┤
│ [Today ▪] [Thu 12] [Fri 13] [Yest.]│  ← date picker horizontal scroll
├─────────────────────────────────────┤
│ CARD Readiness                  [›] │
│  83  Good    Stress Level           │
│              Medium                 │
│              ───────                │
│              Recovery Index         │
│              High                   │
├─────────────────────────────────────┤
│ GRILLE SPARKLINES (4 col)           │
│  77    78    80    83               │
│  -2%  -3%  -4%   +3% ← orange      │
│  ▬     ▬    ▬    ▬ ← barres         │
│  ECG  ECG  ECG   ECG                │
├─────────────────────────────────────┤
│ CARD Sleep                      [›] │
│  8.1  h/Good                        │
│  [arc orange + fond gris]           │
│       48                            │
│  [Awake][REM][Light][Deep]          │
├─────────────────────────────────────┤
│ CARD Body Temperature           [›] │
│  37.7 C     [thermo orange/noir]    │
│  ─────                              │
│  High                               │
└─────────────────────────────────────┘
       [Home][Reports][■Vitals■][Charts][Settings]
```

---

## 9. Règles Non-Négociables

### DO
```
✓ Urbanist partout — aucune autre police
✓ tabular-nums sur toutes valeurs numériques
✓ Valeur metric-hero LEFT-ALIGNED dans la card, qualificatif inline à droite
✓ Score arc = SOUS l'arc, pas centré dedans
✓ Arc fond = #D8D8D8 visible (light), pas transparent
✓ Sleep stages = radius-0, rectangles purs
✓ Tab active = rectangle radius-sm 8px, quasi-carré
✓ Date picker active = rectangle radius-sm 8px
✓ Delta positif = #FF6116, delta négatif = #000000
✓ Tab bar bg = rgba(235,235,235,0.92) — légèrement plus gris que cards
✓ Cards = zéro bordure, zéro shadow — contraste seul
✓ Chevron container = rectangle radius-sm #EBEBEB
✓ touch targets ≥ 44px
```

### DON'T
```
✗ Jamais pill/rounded-full sur tab active ou date picker
✗ Jamais score centré DANS l'arc (il est SOUS)
✗ Jamais arc fond transparent ou rgba(0,0,0,0.08) — utiliser #D8D8D8
✗ Jamais radius sur sleep stages bars
✗ Jamais #FF6116 sur texte courant
✗ Jamais de shadow portée
✗ Jamais de gradient décoratif
✗ Jamais Inter ou System font — Urbanist seule
✗ Jamais fond cards = fond app (contraste nul)
✗ Jamais de label texte visible sur tab active
✗ En dark: jamais #181818 en surface-base
```

---

## 10. Dark Mode

| Élément | Light | Dark |
|---------|-------|------|
| Fond app | `#F3F3F3` | `#0A0A0A` |
| Cards | `#FFFFFF` | `#141414` |
| Tab bar bg | `rgba(235,235,235,0.92)` | `rgba(14,14,14,0.92)` |
| Texte primaire | `#000000` | `#FFFFFF` |
| Texte secondaire | `#767676` | `#8A8A8A` |
| Arc fond | `#D8D8D8` | `rgba(255,255,255,0.12)` |
| Tab active bg | `#000000` | `#FFFFFF` |
| Tab active icon | `#FFFFFF` | `#000000` |
| Accent orange | `#FF6116` | `#FF6116` *(inchangé)* |
| Sleep Awake | `#FF6116` | `#FF6116` |
| Sleep REM | `#1A1A1A` | `#2A2A2A` |
| Delta positif | `#FF6116` | `#FF6116` |
| Delta négatif | `#000000` | `#FFFFFF` |
| Sparkline ECG | `rgba(0,0,0,0.15)` | `rgba(255,255,255,0.15)` |

---

## 11. Accessibilité

- Touch targets : 44×44px minimum
- Contraste `#767676` / `#FFFFFF` = 4.48:1 ✓ (WCAG AA)
- `#FF6116` / `#FFFFFF` = 3.02:1 — graphiques/grandes valeurs uniquement
- `prefers-reduced-motion` : désactiver count-up, arc animation, stagger
- Daltonisme : valeur numérique toujours présente avec l'arc (couleur jamais seule comme signal)
- `accessibilityLabel` sur tous les graphiques SVG

---

## 12. Tokens CSS — Implémentation

```css
:root {
  /* Accent */
  --accent: #FF6116;
  --accent-soft: rgba(255, 97, 22, 0.30);

  /* Surfaces light */
  --surface-base: #F3F3F3;
  --surface-card: #FFFFFF;
  --surface-tab-bar: rgba(235, 235, 235, 0.92);
  --surface-elevated: #EBEBEB;

  /* Texte light */
  --text-primary: #000000;
  --text-secondary: #767676;
  --text-tertiary: #ABABAB;

  /* Bordures */
  --border-subtle: rgba(0, 0, 0, 0.06);
  --arc-track: #D8D8D8;

  /* Navigation */
  --tab-active-bg: #000000;
  --tab-active-icon: #FFFFFF;
  --tab-inactive-icon: #767676;

  /* Sleep */
  --sleep-awake: #FF6116;
  --sleep-rem: #1A1A1A;
  --sleep-light: #767676;
  --sleep-deep: #3A3A3A;

  /* Radius */
  --radius-0: 0px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-base: #0A0A0A;
    --surface-card: #141414;
    --surface-tab-bar: rgba(14, 14, 14, 0.92);
    --surface-elevated: #1E1E1E;
    --text-primary: #FFFFFF;
    --text-secondary: #8A8A8A;
    --text-tertiary: #4A4A4A;
    --border-subtle: rgba(255, 255, 255, 0.06);
    --arc-track: rgba(255, 255, 255, 0.12);
    --tab-active-bg: #FFFFFF;
    --tab-active-icon: #000000;
    --tab-inactive-icon: #5A5A5A;
    --sleep-rem: #2A2A2A;
    --sleep-light: #5A5A5A;
    --sleep-deep: #3A3A3A;
    /* --accent: #FF6116 — inchangé */
  }
}
```

---

## 13. Relation DS v2.0 / DS v3.0

| Aspect | DS v2.0 (Coach Web Next.js) | DS v3.0 (Client Native Expo) |
|--------|-----------------------------|-----------------------------|
| Fond | `#121212` permanent | `#F3F3F3` / `#0A0A0A` |
| Accent | `#1f8a65` vert | `#FF6116` orange |
| Police | Lufga | Urbanist |
| Cards | `bg-white/[0.02]` | `#FFFFFF` / `#141414` |
| Mode | Dark uniquement | Light (défaut) + Dark |
| Tab active | TopBar sticky | Rectangle radius-sm |
| Cible | Coaches desktop | Clients mobile native |

**Ne jamais mélanger les tokens des deux systèmes.**

---

---

## 14. Optical & Material System — Couche Perceptive

> Cette section complète le DS fonctionnel.
> Elle définit **comment les surfaces se comportent optiquement** — pas quels composants existent.
> C'est la différence entre "interface propre" et "interface physiologique atmosphérique vivante".

---

### 14.1 Diagnostic Perceptif

| Domaine | Niveau actuel |
|---------|---------------|
| Fidélité structurelle | 9/10 |
| Fidélité composant | 9/10 |
| Fidélité cognitive | 9.5/10 |
| Fidélité perceptive | 6.5/10 |
| Fidélité atmosphérique | 5.5/10 |
| Fidélité optique | 5/10 |

Le DS comprend très bien les **formes**. Il ne capture pas encore totalement la **matière**.

---

### 14.2 Le vrai moteur esthétique : la lumière diffuse

L'interface STRYVR n'est pas un "flat design system".
C'est un **système de lumière diffuse sur surfaces industrielles**.

Le "soft" perçu ne vient pas des radius.
Il vient de :
- **transitions tonales** entre surfaces
- **flou atmosphérique** (blur)
- **transparence hiérarchique**
- **gradients très subtils** (quasi imperceptibles)
- **espace négatif généreux**
- **anti-aliasing visuel**

---

### 14.3 Hiérarchie Optique des Surfaces

Les surfaces ne sont PAS toutes équivalentes optiquement.
Chaque couche a un comportement lumineux distinct :

| Niveau | Surface | Comportement optique |
|--------|---------|---------------------|
| L0 — Fond atmosphérique | `#F3F3F3` + gradient subtil | Absorbe la lumière ambiante — légèrement chaud |
| L1 — Plaques flottantes | `rgba(255,255,255,0.72–0.85)` + blur(20–28px) | Semi-transparentes — laissent passer le fond |
| L2 — Surfaces contaminées | `rgba(255,255,255,0.50)` + blur(16px) | Absorbent un peu de l'environnement — légèrement teintées |
| L3 — Overlay atmosphérique | `rgba(255,255,255,0.25–0.35)` | Presque disparaissent — présence perceptive uniquement |
| L4 — Orange glow | `rgba(255,97,22,0.05–0.10)` | Contamination chromatique subtile — signal sans couleur |

**Règle** : plus une surface est profonde dans la hiérarchie, plus elle absorbe son environnement.

---

### 14.4 Glassmorphism Industriel (pas Dribbble 2021)

Ce n'est **pas** :
- `rgba(255,255,255,0.20)` ultra-translucide
- Saturé, cyberpunk, néon
- Effets excessifs visibles comme "glassmorphism"

C'est :
```
background: rgba(255,255,255,0.72);
backdrop-filter: blur(24–28px);
border: 1px solid rgba(255,255,255,0.35–0.40);
```

**Caractéristiques exactes :**
- Opacité forte (0.70–0.85) — le verre est presque opaque
- Blur large mais doux (20–32px)
- Border quasi invisible — séparation perceptive, pas explicite
- Combiné avec noise subtil (~2–3% opacity) sur le fond

---

### 14.5 Contamination Chromatique

Les surfaces "absorbent" légèrement leur environnement.

**En light mode :**
- Cards sur fond gris chaud → légèrement teintées warm
- Zones proches d'éléments orange → `rgba(255,97,22,0.03–0.05)` de contamination
- Le fond global n'est pas `#F3F3F3` neutre — il a des micro-variations de température

**En dark mode :**
- Glow orange en `radial-gradient` très subtil derrière les éléments actifs
- `rgba(255,97,22,0.06–0.08)` positionné en `position: absolute` derrière le contenu

**Pattern fond atmosphérique light :**
```css
background:
  radial-gradient(ellipse 80% 60% at 20% 10%, rgba(240,238,235,1) 0%, transparent 60%),
  radial-gradient(ellipse 60% 50% at 80% 80%, rgba(235,233,230,1) 0%, transparent 60%),
  radial-gradient(ellipse 100% 100% at 50% 50%, rgba(245,243,241,1) 0%, #ECEAE7 100%);
```

---

### 14.6 Texture Noise

Imperceptible directement — perçue comme "matérialité" de la surface.

```css
/* SVG feTurbulence overlay sur le fond */
opacity: 0.025;  /* 2.5% — sous le seuil de perception consciente */
filter: url(#noise);
/* baseFrequency: 0.65, numOctaves: 3, stitchTiles: stitch */
```

**Règle** : si on peut "voir" le noise, c'est trop fort.

---

### 14.7 Règles de Lumière

```
"Le relief doit venir de la lumière, pas de la géométrie."
```

| Ce qui crée la profondeur | Ce qui NE doit PAS créer la profondeur |
|---------------------------|----------------------------------------|
| Blur (backdrop-filter) | Radius élevés |
| Opacités hiérarchiques | Box-shadows portées |
| Gradients atmosphériques | Borders épaisses |
| Espace négatif | Décorations géométriques |
| Contraste tonal | Couleurs multiples |
| Noise texture | Effets ostentatoires |

---

### 14.8 Composition vs Composant

Le système original est **éditorial** — pas rigidement composantisé.

La même métrique peut :
- Changer d'alignement selon le contexte
- Changer de respiration (spacing)
- Changer de proportion
- Changer de hiérarchie visuelle

**Anti-pattern à éviter** : appliquer un "pattern universel strict" à toutes les instances.

**Pattern recommandé** : composition dynamique contrôlée — chaque écran est une composition unique qui respecte les règles tonales et de hiérarchie, mais adapte la mise en page au contenu.

---

### 14.9 Ce qui détruirait immédiatement le système

| Action | Conséquence |
|--------|-------------|
| `rounded-xl` ou `rounded-2xl` sur des cards | Effet "SaaS wellness générique" |
| `font-weight: 700+` sur métriques | Destruction du registre clinique |
| Couleurs secondaires (bleu, vert, violet) | Perte d'identité chromatique |
| Box-shadows portées | Regression vers "Material Design" |
| Gradients saturés | Effet "app fitness 2019" |
| Bordures opaques épaisses | Régression vers "Enterprise UI" |
| Blur trop fort (>40px) visible | Glassmorphism Dribbble kitsch |
| Noise > 5% opacity | Texture agressive |

---

### 14.10 Style à nommer

Ce système n'est pas :
- Neumorphism
- Glassmorphism classique
- SaaS Minimalism
- Wellness Bubble UI

C'est :

**"Physiological Industrial Minimalism"**

ou :

**"Luxury Biometric Interface System"**

Références implicites :
- Hardware UI / instrumentation Apple
- Braun / Dieter Rams
- Interfaces médicales premium
- UI biométriques éditoriales
- Post-iOS 16 instrumentation language

---

*DS v3.0 — v3.2 — 2026-05-15 — Optical & Material System ajouté*
