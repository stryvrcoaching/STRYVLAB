# Spec — Unified Dock Navigation (Apple-Style)

**Date :** 2026-04-20  
**Statut :** Draft — en attente de validation  
**Scope :** Refonte complète de la navigation coach — suppression Header + DockLeft + DockBottom, remplacement par un seul dock unifié en bas de l'écran.

---

## 1. Objectif

Centraliser 100 % de la navigation et des actions dans un dock unique flottant en bas de l'écran. Supprimer toute navigation verticale gauche et tout header. Inspiré du pattern Apple dock + référence CommandPalette.

---

## 2. Architecture Générale

### Composant principal : `UnifiedDock`

Pill flottante fixe en bas de l'écran :

```
position: fixed bottom-6 left-1/2 -translate-x-1/2
style: backdrop-blur-2xl bg-white/[0.04] border border-white/[0.08]
       shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]
       rounded-2xl z-[60]
```

Structure interne :

```
[ Section A : 5 icônes ] | [ Section B : items contextuels + ClientTabs ] | [ Section C : actions ]
```

Séparateurs `w-px h-6 bg-white/[0.07]` entre les 3 zones.

---

## 3. Section A — Navigation Principale (Statique)

5 icônes permanentes, toujours visibles :

| Label | Icône Lucide | Route | Match |
|-------|-------------|-------|-------|
| Accueil | `LayoutDashboard` | `/coach/organisation` | `/coach/organisation` ou `/dashboard` |
| Lab | `FlaskConical` | `/coach/clients` | `/coach/clients/*` |
| Studio | `Layers` | `/coach/programs/templates` | `/coach/programs/*` ou `/coach/assessments/*` |
| Business | `Briefcase` | `/coach/comptabilite` | `/coach/comptabilite/*` ou `/coach/formules/*` ou `/coach/organisation/*` |
| Mon compte | `UserCircle` | `/coach/settings` | `/coach/settings/*` |

**DockButton — états visuels :**
- Inactif : `text-white/40 bg-white/[0.06] border border-white/[0.06]`
- Actif : `text-[#1f8a65] bg-[#1f8a65]/20 border border-[#1f8a65]/30` + glow `0 0 12px rgba(31,138,101,0.4)`
- Hover : `scale-110` + tooltip au-dessus
- Tooltip : `bg-black/90 text-white/90 backdrop-blur-sm border border-white/[0.08] rounded-lg text-[11px]`

---

## 4. Section B — Navigation Contextuelle (Adaptative)

Items affichés selon la route active. Scrollable horizontalement si débordement.

### Accueil
`Vue Kanban | Vue Calendrier`

### Lab (sans client actif)
Filtres statut clients :
`Tous | Actifs | Inactifs | Archivés`

### Lab (client actif)
Items à plat, scrollables :
`Profil | Métriques | Bilans | Performances | MorphoPro | Nutrition ↓ | Entraînement ↓ | Cardio ↓ | Composition ↓`

Items avec `↓` ouvrent un **pop-over CommandPalette** vers le haut listant les outils disponibles.

### Studio
`Programmes | Bilans | Nutrition`

### Business
`Comptabilité | Formules | Organisation`

### Mon compte
`Profil | Préférences | Notifications`

---

### ClientTabs

Quand plusieurs clients sont ouverts (via `DockContext`), des pills scrollables s'affichent à gauche de la Section B :

- Client actif : `bg-[#1f8a65]/10 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/20`
- Client inactif : `bg-white/[0.03] text-white/40`
- Bouton `×` par tab pour fermer
- Maximum 3 tabs visibles, scroll horizontal si plus
- Séparateur `w-px h-6 bg-white/[0.07]` entre ClientTabs et items Section B

---

## 5. Section C — Actions Contextuelles

Règle : **maximum 3 boutons**, un bouton = une action directe, zéro confirmation intermédiaire.

Style bouton action :
- Primaire (`+`) : `bg-[#1f8a65] text-white rounded-xl h-8 px-3 text-[11px] font-bold hover:bg-[#217356]`
- Secondaire (vue, recherche) : `bg-white/[0.06] text-white/40 border border-white/[0.06] rounded-xl h-8 px-3 hover:bg-white/[0.09] hover:text-white/70`
- Actif (filtre/vue sélectionnés) : `bg-[#1f8a65]/20 text-[#1f8a65] border border-[#1f8a65]/30` + glow vert

### Table complète des injections

| Page | Actions | États / Badges |
|------|---------|----------------|
| Accueil › Kanban | `+ Tâche` | — |
| Accueil › Calendrier | `+ Événement` | — |
| Lab (liste clients) | `Recherche` · `Vue` · `+ Nouveau client` | Recherche : glow vert si filtre actif · Vue : actif selon mode |
| Lab › Profil | `Inviter` | Glow amber si jamais invité · badge ✓ si déjà actif |
| Lab › Métriques | `+ Saisie manuelle` · `Import CSV` · `Vue` | Vue : actif selon mode tableau/graphique |
| Lab › Bilans | `+ Nouveau bilan` · `Envoyer` | Badge rouge sur Envoyer si bilan complété non lu |
| Lab › Performances | `Vue` · `Export` | Vue : actif selon mode |
| Lab › MorphoPro | `Analyser` | Glow violet si analyse en cours · badge spinner |
| Lab › Nutrition | `Valider protocole` | Glow vert si modifié non sauvegardé |
| Lab › Entraînement | `+ Assigner` · `+ Nouveau` | Badge nombre de programmes assignés actifs |
| Lab › Cardio | `Valider protocole` | Glow vert si modifié non sauvegardé |
| Lab › Composition | `Valider protocole` | Glow vert si modifié non sauvegardé |
| Studio › Programmes | `Recherche` · `Vue` · `+ Nouveau` | Recherche : glow si filtre actif |
| Studio › Bilans | `Recherche` · `Vue` · `+ Nouveau` | — |
| Studio › Nutrition | `Recherche` · `Vue` · `+ Nouveau` | — |
| Business › Comptabilité | `Recherche` · `Vue` · `+ Nouvelle facture` | Badge rouge si paiements en retard |
| Business › Formules | `+ Nouvelle formule` | — |
| Business › Organisation | *(vide)* | — |
| Mon compte | *(vide)* | — |

---

## 6. Pill Contextuelle (Breadcrumb Flottant)

Pill flottante centrée au-dessus du dock :

```
position: fixed, centré horizontalement
bottom: dock_height + 12px
style: bg-white/[0.04] backdrop-blur-sm rounded-full px-3 py-1
       border-[0.3px] border-white/[0.06] text-[11px] text-white/50
```

Contenu :
- Sans client actif : label section simple (`"Lab"`, `"Studio"`, etc.)
- Avec client actif : breadcrumb complet `"Lab › Marie Dupont › Métriques"`
- Comportement scroll : `opacity-0 translate-y-1` au scroll bas, réapparaît au scroll haut (hook `useDockScroll`)

---

## 7. CommandPalette (Pop-over Recherche/Filtres)

S'ouvre vers le haut, rattaché au dock :

```
position: fixed bottom-[88px] left-1/2 -translate-x-1/2
style: bg-black/70 backdrop-blur-2xl rounded-2xl border border-white/[0.08]
       shadow-[0_24px_60px_rgba(0,0,0,0.7)]
       animate-in slide-in-from-bottom-3 duration-200
width: 520px
```

**Contexte Lab (liste clients) :**
- Onglet Recherche : input + pills statut (Tous / Actifs / Inactifs / Archivés)
- Onglet Filtres : tri (Alphabétique / Récent / Inactif le plus longtemps)

**Contexte Studio :**
- Onglet Recherche : input texte libre
- Onglet Filtres : type (Programmes / Bilans / Nutrition), goal, niveau

Navigation clavier : `↑↓←→` naviguer · `↵` activer · `Escape` fermer.

Fermeture : clic sur overlay `fixed inset-0 z-[55]`.

---

## 8. Page Cockpit (Accueil)

La page `/coach/organisation` est enrichie d'une **section Pilotage** en haut :

- KPIs essentiels : clients actifs, MRR, bilans en attente, tâches du jour
- Alertes actionnables : paiements en retard, clients inactifs >14j, bilans sans réponse >5j
- Section KPIs + Alertes en haut, contenu Organisation existant en dessous
- Pas de nouveau composant — enrichissement de la page existante

---

## 9. Architecture Technique

### Fichiers à créer

```
components/layout/UnifiedDock/
  index.tsx              — export public
  UnifiedDock.tsx        — composant principal
  DockButton.tsx         — bouton réutilisable (tooltip, badge, glow, scale)
  DockSectionA.tsx       — 5 icônes navigation principale
  DockSectionB.tsx       — items contextuels + ClientTabs
  DockSectionC.tsx       — actions contextuelles injectées
  ContextPill.tsx        — pill breadcrumb flottante
  CommandPalette.tsx     — palette recherche/filtres
  useDockConfig.ts       — hook central : config B+C selon pathname+clientId
  useDockScroll.ts       — hook : détecte scroll pour show/hide pill
```

### Fichiers à supprimer

```
components/layout/DockLeft.tsx
components/layout/DockBottom.tsx
components/layout/TopBarContext.tsx
components/layout/useSetTopBar.tsx
components/layout/CoachHeader.tsx
components/layout/useDockBottom.ts
```

### Fichiers à modifier

```
components/layout/DockContext.tsx   — étendre avec activeSectionA, commandPaletteOpen
app/coach/layout.tsx                — remplacer CoachShell par UnifiedDock
components/layout/CoachShell.tsx    — supprimer TopBar, garder DockProvider
app/coach/organisation/page.tsx     — ajouter section Pilotage (KPIs + alertes)
```

### Pages à mettre à jour

Toutes les pages qui appellent `useSetTopBar` doivent être mises à jour :
- Supprimer l'appel `useSetTopBar`
- Intégrer le titre de section directement dans le corps de la page
- Les boutons d'action migrent vers `useDockConfig` (Section C)

### State management

- `DockContext` étendu — source de vérité navigation + clients ouverts
- `useDockConfig(pathname, clientId?)` — retourne `{ sectionB: DockItem[], sectionC: ActionItem[] }`
- Pas de Zustand — React Context suffit
- `ActionItem` : `{ id, label, icon: LucideIcon, onClick: () => void, variant: 'primary' | 'secondary', badge?: number, glowColor?: string }`

---

## 10. Invariants & Points de Vigilance

- `DockSectionC` reçoit les actions via `useDockConfig` — jamais hardcodé dans le composant
- Maximum 3 actions en Section C — si une page a plus de 3 actions, prioriser par fréquence d'usage
- `CommandPalette` est un composant unique réutilisé dans plusieurs contextes via props
- La pill contextuelle ne s'affiche pas sur la page Accueil (pas de breadcrumb utile)
- `useSetTopBar` est entièrement supprimé — aucune page ne doit l'importer après la migration
- `pb-24` sur toutes les pages pour le clearance dock (déjà en place sur les pages client)
- Les pop-overs Section B (`↓`) ferment au clic overlay et à la navigation

---

## 11. Pages Non Affectées

- Toutes les routes `/client/*` (mini-app client) — dock coach uniquement
- Routes publiques (`/`, `/login`, `/signup`)
- Routes API

---

## Ordre de livraison

1. `DockContext` étendu
2. `useDockConfig` hook
3. Composants `UnifiedDock/*`
4. Migration `app/coach/layout.tsx`
5. Suppression anciens composants
6. Migration pages `useSetTopBar` → titre inline
7. Enrichissement page Cockpit
8. Tests visuels toutes routes
