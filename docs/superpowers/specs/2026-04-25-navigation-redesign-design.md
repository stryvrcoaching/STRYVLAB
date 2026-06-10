# Navigation Redesign — Spec Design

**Date :** 2026-04-25  
**Statut :** Approuvé — prêt pour implémentation  
**Contexte :** Remplacement du `UnifiedDock` actuel (trop chargé, peu intuitif, mauvaise hiérarchie) par un système à deux barres superposées, plus clair et plus cohérent.

---

## Problèmes du système actuel

- Trop d'éléments dans une seule barre horizontale (SectionA + SectionB scrollable + SectionC)
- La `ContextPill` flottante crée de la confusion visuelle
- Le système de "clients ouverts en tabs" est trop complexe et peu utilisé
- Pas de hiérarchie claire entre navigation globale et navigation contextuelle
- Le bouton `+` ouvre un menu même quand il n'y a qu'une seule action

---

## Architecture — Deux barres superposées

```
┌──────────────────────────────────────┐  ← Rangée A : sous-nav contextuelle (conditionnelle)
│  [Profil]  [Data ▾]  [Protocoles ▾] │    h-9, rounded-xl, visible uniquement si contexte
└──────────────────────────────────────┘
        gap: 6px
┌────────────────────────────────────────────────┐  ← Rangée B : nav globale (toujours visible)
│  [🏠] [🧪] [📐] [💼] [👤]  |  [CTA]           │    h-14, rounded-2xl, toujours présente
└────────────────────────────────────────────────┘
```

Les deux barres sont centrées horizontalement (`left-1/2 -translate-x-1/2`), fixes en bas (`bottom-6`), `z-[60]`.

---

## Rangée B — Navigation globale

**Toujours visible, jamais masquée.**

### Style
- `h-14 rounded-2xl`
- Background : `bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]`

### Items (5 destinations globales)

| ID | Label | Icône | Route | Match |
|----|-------|-------|-------|-------|
| `accueil` | Accueil | `LayoutDashboard` | `/coach/organisation` | `=== /coach/organisation` |
| `lab` | Lab | `FlaskConical` | `/coach/clients` | `startsWith /coach/clients` |
| `studio` | Studio | `Layers` | `/coach/programs/templates` | `startsWith /coach/programs` ou `/coach/assessments` |
| `business` | Business | `Briefcase` | `/coach/comptabilite` | `startsWith /coach/comptabilite` ou `/coach/formules` |
| `compte` | Mon compte | `UserCircle` | `/coach/settings` | `startsWith /coach/settings` |

Séparateur `w-px h-6 bg-white/[0.07]` entre les 5 items et le CTA.

### Style items
- Inactif : `text-white/40`, icône 15px `strokeWidth 1.75`, label `text-[8px]`
- Actif : `bg-[#1f8a65]/20 border-[#1f8a65]/30 text-[#1f8a65]`, icône `strokeWidth 2`

---

## Rangée A — Sous-navigation contextuelle

**Conditionnelle : absente sur Accueil, liste clients, Settings.**

### Style
- `h-9 rounded-xl`
- Background : `bg-white/[0.03] backdrop-blur-xl border-[0.3px] border-white/[0.06]`
- Padding : `px-2`

### Style boutons
- Inactif : `text-white/40 text-[11px] font-medium px-3 h-7 rounded-lg`
- Actif (ou sous-page active) : `bg-[#1f8a65]/10 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/20`
- Chevron `▾` sur les boutons avec dropdown : `ChevronDown` 10px

### Contenu selon contexte

#### Dans un client (`/coach/clients/[clientId]/*`)

3 boutons :
1. **Profil** → `/coach/clients/[clientId]/profil` (lien direct, pas de dropdown)
2. **Data ▾** → dropdown avec : Métriques, Bilans, Performances, MorphoPro
3. **Protocoles ▾** → dropdown avec : Nutrition, Entraînement, Cardio, Composition

Le bouton parent est actif si la route courante est l'une de ses sous-pages.  
Ex : sur `/data/metriques` → bouton "Data" est en vert.

#### Studio (`/coach/programs/*` ou `/coach/assessments/*`)

3 boutons directs (pas de dropdown, assez court) :
- **Programmes** → `/coach/programs/templates`
- **Bilans** → `/coach/assessments`
- **Nutrition** → `/coach/programs/nutrition`

#### Business (`/coach/comptabilite/*`, `/coach/formules/*`)

3 boutons directs :
- **Comptabilité** → `/coach/comptabilite`
- **Formules** → `/coach/formules`
- **Organisation** → `/coach/organisation`

#### Absent (Rangée A non rendue)
- `/coach/organisation` (Accueil)
- `/coach/clients` (liste clients)
- `/coach/settings`

---

## Dropdowns (Rangée A + CTA)

### Style commun
- Position : `bottom-full mb-2`, centré sur le bouton déclencheur
- Container : `bg-[#181818] border-[0.3px] border-white/[0.08] rounded-xl overflow-hidden min-w-[160px]`
- Items : `px-4 py-2.5 text-[12px] font-medium text-white/70 hover:bg-white/[0.05] hover:text-white`
- Item actif : `text-[#1f8a65] bg-[#1f8a65]/05`
- Fermeture : overlay invisible `fixed inset-0 z-[-1]` + clic extérieur

### Animation Framer Motion
```ts
initial: { opacity: 0, y: 6, scale: 0.97 }
animate: { opacity: 1, y: 0, scale: 1 }
exit:    { opacity: 0, y: 6, scale: 0.97 }
transition: { duration: 0.15, ease: "easeOut" }
```

---

## Bouton CTA

### Logique selon la page

| Page | Nb actions | Comportement | Label / Icône |
|------|-----------|--------------|---------------|
| `/coach/clients` | 3 | Menu | `+` (icône seule) |
| `/coach/clients/[id]/profil` | 1 | Action directe | `Inviter` |
| `/coach/clients/[id]/data/metriques` | 2 | Menu | `+` |
| `/coach/clients/[id]/data/bilans` | 2 | Menu | `+` |
| `/coach/clients/[id]/data/performances` | 0 | **Absent** | — |
| `/coach/clients/[id]/data/morphopro` | 1 | Action directe | `Analyser` |
| `/coach/clients/[id]/protocoles/nutrition` | 0 | **Absent** | — |
| `/coach/clients/[id]/protocoles/entrainement` | 0 | **Absent** | — |
| `/coach/clients/[id]/protocoles/cardio` | 0 | **Absent** | — |
| `/coach/clients/[id]/protocoles/composition` | 0 | **Absent** | — |
| `/coach/programs/templates` | 3 | Menu | `+` |
| `/coach/organisation` | 2 | Menu | `+` |
| `/coach/settings` | 0 | **Absent** | — |

### Contenu des menus CTA

**`/coach/clients`**
- `+ Nouveau client` → actionKey `NEW_CLIENT`
- `Filtres` → actionKey `TOGGLE_FILTERS`
- `Vue grille / liste` → actionKey `TOGGLE_VIEW`

**`/coach/clients/[id]/data/metriques`**
- `+ Saisie manuelle` → actionKey `ADD_METRIC`
- `Import CSV` → actionKey `IMPORT_CSV`

**`/coach/clients/[id]/data/bilans`**
- `+ Nouveau bilan` → actionKey `NEW_BILAN`
- `Renvoyer par email` → actionKey `SEND_BILAN`

**`/coach/programs/templates`**
- `+ Nouveau template` → actionKey `NEW_TEMPLATE`
- `Filtres` → actionKey `TOGGLE_FILTERS`
- `Vue grille / liste` → actionKey `TOGGLE_VIEW`

**`/coach/organisation`**
- `+ Tâche` → actionKey `ADD_TASK`
- `+ Événement` → actionKey `ADD_EVENT`

### Style CTA

- **Action directe** (label textuel) : `bg-[#1f8a65] text-white text-[11px] font-bold px-4 h-9 rounded-xl hover:bg-[#217356]`
- **Menu** (icône `+`) : même style vert, icône `Plus` 16px
- **Absent** : composant non rendu, pas de placeholder

### Wiring des actions
Les pages enregistrent leurs handlers via `registerDockAction(key, handler)` au mount et les désenregistrent au unmount — même pattern que l'actuel `dockActionRegistry`. Aucun changement d'API pour les pages existantes.

---

## Suppression

Les composants suivants sont supprimés ou remplacés :

| Composant | Sort |
|-----------|------|
| `DockBottom.tsx` | Supprimé |
| `ClientTabsBar.tsx` | Supprimé |
| `ContextPill.tsx` | Supprimé |
| `DockSectionB.tsx` | Supprimé (logique absorbée par Rangée A) |
| `useDockBottom.ts` | Supprimé |
| `useDockScroll.ts` | Supprimé (plus de masquage au scroll) |
| `DockSectionA.tsx` | Remplacé par nouvelle Rangée B |
| `DockSectionC.tsx` | Remplacé par nouveau CTA |
| `useDockConfig.ts` | Remplacé par `useNavConfig.ts` |
| `UnifiedDock.tsx` | Remplacé par `NavDock.tsx` |
| Système "clients ouverts en tabs" dans `DockContext` | Simplifié — garde uniquement `activeClientId` |

---

## Nouveaux fichiers

```
components/layout/NavDock/
  NavDock.tsx           ← orchestrateur (Rangée A + Rangée B)
  NavRowB.tsx           ← nav globale permanente
  NavRowA.tsx           ← sous-nav contextuelle conditionnelle
  NavDropdown.tsx       ← dropdown réutilisable (Rangée A + CTA)
  NavCTA.tsx            ← bouton CTA intelligent
  useNavConfig.ts       ← config par route (remplace useDockConfig)
  index.ts              ← exports publics
```

`CoachShell.tsx` remplace `<UnifiedDock />` par `<NavDock />`.

---

## Invariants

- La Rangée B est **toujours rendue**, jamais conditionnelle
- La Rangée A est rendue uniquement si `navConfig.rowA !== null`
- Un seul dropdown peut être ouvert à la fois (fermeture mutuelle)
- Le CTA est absent (`null`) si `navConfig.cta.actions.length === 0`
- Le CTA déclenche directement si `navConfig.cta.actions.length === 1`
- `pb-28` sur le contenu principal si Rangée A absente, `pb-36` si Rangée A présente
- Aucun `useDockScroll` — les barres ne se masquent pas au scroll
