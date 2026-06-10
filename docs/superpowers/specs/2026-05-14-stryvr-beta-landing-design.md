# STRYVR Beta Landing Page — Design Spec

**Date initiale:** 2026-05-14
**Mise à jour DA:** 2026-05-16 — Refonte complète DA Technogym
**Produit:** STRYVR (app mobile native, sous-projet de STRYVLAB)
**Route:** `/stryvr` dans le repo STRYVLAB (Next.js App Router)
**Statut:** ✅ IMPLÉMENTÉ — commit `e9d7b20`

---

## Contexte

STRYVR est l'app mobile native (React Native/Expo) — moteur physiologique intelligent. Pas un tracker de calories. Un moteur qui comprend la biologie de l'utilisateur et adapte chaque recommandation (nutrition, entraînement, récupération, cycle féminin, safety layer) en temps réel.

Landing page = capture email bêta testeurs. Public cible : clients finaux (Belgique + France).

---

## Direction Artistique — DA Technogym (2026-05-16)

**Référence :** technogym.com/fr-BE/

### Palette

| Token | Valeur | Usage |
|-------|--------|-------|
| Fond | `#0a0a0a` | Noir pur — toute la page |
| Card | `#161616` | Surfaces élevées |
| Border | `rgba(255,255,255,0.08)` | Contours, séparateurs |
| Divider | `rgba(255,255,255,0.05)` | Séparateurs internes |
| FG | `#ffffff` | Texte primaire |
| MFG | `rgba(255,255,255,0.45)` | Texte secondaire |
| SFG | `rgba(255,255,255,0.25)` | Texte tertiaire |
| **Accent** | **`#F5D800`** | **Jaune — CTA + marqueurs actifs UNIQUEMENT** |
| Accent bg | `rgba(245,216,0,0.08)` | Fond badge accent |
| Accent border | `rgba(245,216,0,0.25)` | Bordure badge accent |

⚠️ L'accent jaune est **chirurgical** : CTA principal, badges statut, numéros de feature, barres actives dans le mockup. Jamais utilisé sur le texte courant ou les backgrounds de sections.

### Typographie

- Police : **Urbanist** (Google Fonts) — chargé via `next/font/google`
- Style : **uppercase, bold/extrabold (800-900), `letterSpacing: '-0.03em'` à `-0.04em'`**
- Headlines : `clamp(28px, 4vw, 48px)` à `clamp(42px, 6vw, 72px)`, weight 900
- Labels/eyebrow : 9-10px, weight 700, `letterSpacing: '0.14em'`, uppercase
- Body : 13-15px, weight 400, `rgba(255,255,255,0.45)`, `lineHeight: 1.65`
- Données mockup : `fontVariantNumeric: 'tabular-nums'`

### Composants industriels

**Grille gap-1px :** `display: grid; gap: 1; backgroundColor: 'rgba(255,255,255,0.08)'` — les cellules `backgroundColor: '#0a0a0a'` créent l'effet de grille séparée par une ligne 1px.

**Bouton CTA (jaune) :**
```
backgroundColor: #F5D800, color: #0a0a0a
fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', uppercase
hover: #ffe040
```

**Bouton outline (secondaire) :**
```
border: '1px solid rgba(255,255,255,0.35)', color: #ffffff
hover: borderColor = #ffffff
```

**Badge :**
```
border: '1px solid rgba(245,216,0,0.25)', backgroundColor: 'rgba(245,216,0,0.08)'
fontSize: 9, fontWeight: 800, color: #F5D800
```

---

## Structure de la Page

### 1. Navbar (sticky)
- Fond `rgba(10,10,10,0.92)` + `backdropFilter: 'blur(16px)'`
- Logo "STRYVR" weight 900 + badge "BÊTA" jaune outline
- CTA "› ACCÈS BÊTA" fond jaune, texte noir — caché sur mobile

### 2. Hero (above the fold)
- Grid `1fr 1fr` desktop, 1 col mobile
- **Gauche** : badge géo `🇧🇪 BELGIQUE · FRANCE`, headline `PAS UN TRACKER. TON MOTEUR PHYSIO.` avec `<span>TON MOTEUR</span>` en jaune, sous-titre gris, `BetaForm`, compteur social
- **Droite** : `HeroPhoneStack` — 2 phones en perspective CSS (front=agenda, back=training, opacité 0.7)

### 3. Stats Bar
- Grid 3 colonnes séparées par `border-right: 1px solid rgba(255,255,255,0.08)`
- Chiffres `52px / weight 900`, labels `10px uppercase jaune`, sub `11px rgba(255,255,255,0.3)`
- Valeurs : `95%` / `5 MIN` / `20`

### 4. Features (numérotées)
- Eyebrow jaune + H2 majuscule
- Grid 3 colonnes `gap-1px` industrielle
- Numéro `01/02/03` jaune, titre uppercase, description gris

### 5. App Section (training)
- Grid `1fr 1fr` — mockup training gauche, texte + tableau clé/valeur droite
- Tableau = grille 2 col gap-1px, col gauche gris/opaque, col droite `#161616`

### 6. Nutrition Section
- Grid `1fr 1fr` — texte + 4 couches Composer gauche, mockup agenda droite
- 4 couches : number jaune sur `#161616`, titre uppercase, sous-titre gris

### 7. Safety Layer (grille 2×2)
- TCA / GLP-1 / CYCLE / RED-S
- Badge code jaune outline par item, titre uppercase, description gris

### 8. CTA Final (pleine largeur jaune)
- Section `backgroundColor: #F5D800`
- H2 `#0a0a0a` massif, texte `rgba(0,0,0,0.55)`
- Form dark intégré : fond `#0a0a0a` padding 32px

### 9. Footer (4 colonnes)
- Brand + tagline + réseaux sociaux uppercase
- 3 colonnes liens (PRODUIT / SUPPORT / LÉGAL)
- Barre bottom : copyright + géolocalisation

---

## Mockups

### AgendaScreen
- Fond `#0a0a0a`
- Header : date + titre + score arc SVG (fond `#2a2a2a`, actif `#F5D800`)
- Macro bars : barres 2px flat (fond `#2a2a2a`, actif `#F5D800`)
- Events : `borderLeft: '2px solid #F5D800'` si actif, carré jaune 6×6 dot
- Phase strip : carré jaune + texte uppercase

### TrainingScreen
- Fond `#0a0a0a` / `#0f0f0f`
- Courbe sinusoïdale SVG bézier (`stroke: rgba(255,255,255,0.15)`, strokeWidth 8)
- Balle blanche sur la courbe, losanges `#F5D800` aux points cibles (fill=none, stroke=#F5D800)
- Barres verticales : jaune si actives, `#2a2a2a` si reste — `borderRadius: 0` (style Technogym)
- Stats 3 colonnes : REPS en jaune, CHARGE + TEMPS en blanc

### HeroPhoneStack
- Phone front : `AgendaScreen`, position relative z-index 2
- Phone back : `TrainingScreen`, position absolute droite +40px top, scale 0.88, opacity 0.7
- Glow : `radial-gradient(rgba(245,216,0,0.08))` derrière
- Frame iPhone : `#0a0a0a`, `borderRadius: 32`, `perspective(1200px) rotateY(-4deg) rotateX(2deg)`
- Dynamic island : `width: 56, height: 14, borderRadius: 8`

---

## BetaForm

- Inputs : `backgroundColor: '#161616'`, pas de bordure, `fontSize: 12`, `fontWeight: 600`, uppercase placeholder
- Gap `1px` entre inputs + bouton (technique gap industriel)
- CTA : `backgroundColor: '#F5D800'`, `color: '#0a0a0a'`, `fontSize: 12`, `fontWeight: 800`, uppercase
- État success : border `rgba(245,216,0,0.3)`, bg `rgba(245,216,0,0.06)`, label jaune uppercase
- État erreur : `#ef4444` inline sans border

---

## Backend

- Table : `beta_waitlist` (Supabase) — `id`, `first_name`, `email`, `created_at`, `source`
- Unique index : `lower(email)` — dedup insensible à la casse
- RLS : anon INSERT, authenticated SELECT
- Server Actions : `joinWaitlist(formData)` + `getBetaCount()` → `app/stryvr/actions.ts`
- `getBetaCount()` arrondit à la dizaine inférieure

---

## Responsive

- Mobile (< 768px) : hero 1 colonne, `HeroPhoneStack` masqué, form pleine largeur
- Desktop : grid 2 colonnes hero + 3 colonnes features + 3 colonnes stats
- Media query inline dans `BetaLandingClient` (pas de classes Tailwind — tout en `style` React)

---

## Historique DA

| Date | Changement |
|------|-----------|
| 2026-05-14 | Version initiale — light mode `#FAFAFA`, orange `#1F8A65` (vert DS v2.0) — ABANDONNÉ |
| 2026-05-14 | DS V3.0 — light mode `#FAFAFA`, orange `#FF6116` — ABANDONNÉ |
| 2026-05-16 | **DA Technogym — dark `#0a0a0a`, jaune `#F5D800`** ← VERSION ACTUELLE |
