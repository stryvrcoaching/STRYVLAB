# Client PWA — Design System v4.0 : Dark Gray Minimal

> **Date** : 2026-05-21  
> **Scope** : App client `/client` + composants `components/client/` uniquement  
> **Ne touche pas** : DS v2.0 coach (`/coach`), landing (`/stryvr`)

---

## Philosophie

Ultra-minimaliste. Hiérarchie par nuances de gris uniquement. Zéro bordure. Zéro couleur d'accent UI. Zéro ombre. Séparation visuelle = saut de niveau de surface. Inspiré : Raycast, Linear dark, Things 3.

---

## 1. Palette — Gray Scale (Neutral pur)

| Token Tailwind | Hex | CSS Var | Usage |
|----------------|-----|---------|-------|
| `gray-950` | `#080808` | `--c-bg` | App background — fond app |
| `gray-900` | `#111111` | `--c-surface-1` | Surface L1 — cards, sheets |
| `gray-800` | `#1a1a1a` | `--c-surface-2` | Surface L2 — elevated cards |
| `gray-700` | `#222222` | `--c-surface-3` | Surface L3 — inputs, interactifs |
| `gray-600` | `#2e2e2e` | `--c-hover` | Hover state |
| `gray-500` | `#404040` | `--c-active` | Active / pressed |
| `gray-400` | `#5a5a5a` | `--c-icon-disabled` | Icônes disabled |
| `gray-300` | `#808080` | `--c-text-muted` | Text muted (secondary) |
| `gray-200` | `#b0b0b0` | `--c-text-body` | Text body (primary) |
| `gray-100` | `#e0e0e0` | `--c-text-heading` | Headings |
| `gray-50` | `#f2f2f2` | `--c-text-emphasis` | Emphase max / bouton primary bg |

**Règles fondamentales :**
- Aucune `border-*` dans les composants client
- Aucune `shadow-*`
- Aucun gradient coloré
- Séparation visuelle = delta de `--c-surface-*` uniquement

---

## 2. Data Colors (charts/graphiques uniquement)

Ces 3 couleurs ne doivent **jamais** apparaître en UI — uniquement dans les SVG/recharts de métriques, nutrition, progression.

| Token | Hex | Nom | Usage |
|-------|-----|-----|-------|
| `--data-copper` | `#9d7052` | Cuivre mat | Macro protéines, courbe 1 |
| `--data-gold` | `#a89060` | Or antique | Macro glucides, courbe 2 |
| `--data-petrol` | `#3d7070` | Pétrole | Macro lipides, courbe 3 |

Remplacent dans les charts : `#3b82f6` (bleu), `#e85d04` (orange), `#2d9a4e` (vert), `#d4a017` (ambre), `#ffe01e` (jaune).

---

## 3. Actions / Primary

Pas d'accent coloré. Bouton primary = contraste maximal monochrome.

| État | Classes |
|------|---------|
| Primary button | `bg-[#f2f2f2] text-[#080808] font-bold` |
| Primary hover | `bg-[#e0e0e0]` |
| Secondary button | `bg-[#1a1a1a] text-[#b0b0b0]` |
| Secondary hover | `bg-[#222222]` |
| Ghost / text | `text-[#808080] hover:text-[#b0b0b0]` |
| Destructive | `bg-[#222222] text-[#e0e0e0]` — jamais rouge vif |

---

## 4. Typographie (inchangée)

| Font | Usage |
|------|-------|
| `font-barlow` | Body, textes courants |
| `font-barlow-condensed` | Labels uppercase, nav, tags |

Opacités texte : `#f2f2f2` (100%), `#e0e0e0` (heading), `#b0b0b0` (body), `#808080` (muted), `#5a5a5a` (disabled). Pas d'`opacity-*` sur le texte — utiliser les valeurs hex directement.

---

## 5. Composants — Tableau de correspondance

### Layout

| Composant | Changement |
|-----------|-----------|
| `app/client/layout.tsx` | `bg-[#0d0d0d]` → `bg-[#080808]` |
| `app/globals.css` — bloc client | Ajouter variables `--c-*` + `--data-*` |
| `tailwind.config.ts` | Ajouter gray scale `50`→`950` custom + data colors |

### Navigation

| Composant | Avant | Après |
|-----------|-------|-------|
| `ClientTopBar` | `bg-[#ffe01e]` | `bg-[#080808]` — flush avec fond |
| `ClientTopBar` title | `text-[#0d0d0d]` | `text-[#e0e0e0]` |
| `ClientTopBar` section | `text-[#0d0d0d]/50` | `text-[#5a5a5a]` |
| `ClientTopBar` back btn | `bg-black/[0.10] text-[#0d0d0d]` | `bg-[#222222] text-[#b0b0b0]` |
| `BottomNav` bg | `bg-[#0d0d0d] border-t border-white/[0.06]` | `bg-[#080808]` — pas de border |
| `BottomNav` active | `text-[#ffe01e]` | `text-[#f2f2f2]` |
| `BottomNav` inactive | `text-white/30` | `text-[#5a5a5a]` |

### Chat

| Composant | Avant | Après |
|-----------|-------|-------|
| `ChatBubble` user | `bg-[#ffe01e] text-[#0d0d0d]` | `bg-[#f2f2f2] text-[#080808]` |
| `ChatBubble` bot | `bg-[#161616] border border-white/[0.06]` | `bg-[#111111]` |
| `ChatBubble` avatar | `bg-[#161616] border border-white/[0.08]` | `bg-[#1a1a1a]` |
| `ChatBubble` avatar letter | `text-[#ffe01e]` | `text-[#b0b0b0]` |
| `ChatConversation` typing dots | `bg-white/30` | `bg-[#404040]` |
| `ChatConversation` typing bubble | `bg-[#161616] border border-white/[0.06]` | `bg-[#111111]` |
| `ChatConversation` separator | `bg-white/[0.06]` lines | supprimé — juste `text-[#5a5a5a]` centré |
| `ChatPage` quick suggestions | pills jaunes | `bg-[#1a1a1a] text-[#808080]` |
| `ChatInputBar` | surfaces colorées | `bg-[#111111]` send btn `bg-[#f2f2f2]` |
| `ChatTodayStrip` pills | `#ffe01e` highlights | `bg-[#1a1a1a] text-[#808080]` |

### Workout / Programme

| Composant | Avant | Après |
|-----------|-------|-------|
| `SessionLogger` CTA terminer | `bg-[#ffe01e]` | `bg-[#f2f2f2] text-[#080808]` |
| `SessionLogger` valider set | jaune | `bg-[#f2f2f2] text-[#080808]` |
| `SetRow` validé | highlight jaune | `bg-[#222222]` |
| `SetRow` swipe | couleur accent | `bg-[#2e2e2e]` |
| `ExerciseBlock` PR badge | `bg-[#ffe01e]` | `bg-[#f2f2f2] text-[#080808]` |
| `ExerciseBlock` cards | borders | supprimées — `bg-[#111111]` |
| `SmartWorkoutHero` | surfaces jaunes | `bg-[#080808]` |
| `ExerciseSwapSheet` | accent jaune | `bg-[#111111]`, btn primary blanc |
| `TempoGuideModal` | `#FFB800` | `#e0e0e0` — neutre |

### Nutrition

| Composant | Avant | Après |
|-----------|-------|-------|
| `NutritionWidget` arc overflow | `#ffe01e` | `--data-copper` |
| `NutritionWidget` macro bars | couleurs vives | `--data-copper`, `--data-gold`, `--data-petrol` |
| `SmartNutritionWidget` | highlights jaunes | surfaces grises |
| `NutritionMealsList` | accents colorés | `bg-[#111111]`, text `#b0b0b0]` |
| `MealLogSheet` | CTA jaune | `bg-[#f2f2f2] text-[#080808]` |
| `VoiceLogSheet` | accent jaune | btn `bg-[#f2f2f2]`, waveform `#404040` |
| `VoiceEntryFab` | `bg-[#ffe01e]` | `bg-[#f2f2f2] text-[#080808]` |

### Métriques / Profil

| Composant | Avant | Après |
|-----------|-------|-------|
| `MetricsPage` charts | couleurs vives | data colors uniquement |
| `ExerciseProgressionChart` | ligne accent | `--data-petrol` |
| `AdherenceScoreCard` | highlight jaune | `text-[#f2f2f2]` |
| `ProfilAccordion` | accents jaunes | `bg-[#111111]` surfaces |
| `AccordionSection` | border + accent | `bg-[#111111]` → `bg-[#1a1a1a]` ouvert |
| `DayChecklist` | checks jaunes | `text-[#f2f2f2]` |

### Modals / Sheets

| Composant | Avant | Après |
|-----------|-------|-------|
| `QuickWaterModal` | CTA jaune | `bg-[#f2f2f2] text-[#080808]` |
| `CheckinModal` | accents colorés | surfaces grises |
| `ClientAlternativesSheet` | border + accent | `bg-[#111111]` |
| `FreeActivitySheet` | jaune | primary btn blanc |
| `SetTypeSelector` | sélection jaune | `bg-[#2e2e2e] text-[#e0e0e0]` |

### Pages app/client

| Page | Changement principal |
|------|---------------------|
| `app/client/login/page.tsx` | btn jaune → `bg-[#f2f2f2]` |
| `app/client/onboarding/page.tsx` | accents jaunes → gris |
| `app/client/bilans/page.tsx` | highlights → neutres |
| `app/client/nutrition/page.tsx` | surfaces → gray scale |
| `app/client/programme/...` | CTA + active states |

---

## 6. Règles de remplacement mécanique

Substitutions directes applicables par script sur les fichiers client :

| Chercher | Remplacer par | Contexte |
|----------|--------------|---------|
| `#ffe01e` (accent UI) | `#f2f2f2` | CTA, active nav |
| `#ffe01e` (chart) | `var(--data-copper)` | charts uniquement |
| `bg-[#0d0d0d]` | `bg-[#080808]` | fond app |
| `bg-[#161616]` | `bg-[#111111]` | surface L1 |
| `bg-[#1e1e1e]` | `bg-[#222222]` | surface L3 |
| `border border-white/[0.06]` | `` (supprimé) | toutes occurrences |
| `border border-white/[0.08]` | `` (supprimé) | toutes occurrences |
| `border-t border-white/[0.06]` | `` (supprimé) | toutes occurrences |
| `border-[0.3px] border-white/[0.06]` | `` (supprimé) | toutes occurrences |
| `text-[#0d0d0d]/50` | `text-[#5a5a5a]` | text muted |
| `text-[#0d0d0d]` | `text-[#080808]` | text sur surface light |
| `text-white/30` | `text-[#5a5a5a]` | nav inactive |
| `text-white/[0.06]` | `` | separators à supprimer |

Substitutions contextuelles (revue manuelle) :
- Toute couleur chart (`#3b82f6`, `#e85d04`, `#2d9a4e`, `#d4a017`) → data colors
- `#1f8a65` dans composants client → `#f2f2f2` (si bouton) ou `#808080` (si text)

---

## 7. Fichiers à modifier (60+ fichiers)

**Priorité 1 — Impact visuel maximal**
- `app/globals.css` — tokens CSS vars
- `tailwind.config.ts` — gray scale + data colors
- `app/client/layout.tsx`
- `components/client/ClientTopBar.tsx`
- `components/client/BottomNav.tsx`
- `components/client/ChatBubble.tsx`
- `components/client/ChatPage.tsx`
- `app/client/programme/session/[sessionId]/SessionLogger.tsx`

**Priorité 2 — Composants smart/nutrition**
- `components/client/smart/` (tous les fichiers)
- `components/client/NutritionWidget.tsx`
- `components/client/MetricsPage.tsx`

**Priorité 3 — Modals, sheets, pages**
- `components/client/` (modals restantes)
- `app/client/` (pages)

---

## 8. Hors scope

- DS v2.0 coach (`/coach`, `components/`) — inchangé
- Landing `/stryvr` — inchangé
- `public/manifest.json` themeColor → update `#080808` ✅
- `app/client/layout.tsx` viewport themeColor → `#080808` ✅

---

## 9. Validation

Après implémentation :
- `npx tsc --noEmit` — 0 erreurs
- Revue visuelle : TopBar flush fond, BottomNav pas de ligne séparatrice, user bubbles blancs, charts data colors, zéro jaune, zéro border visible
