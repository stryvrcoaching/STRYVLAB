# Dashboard Home — Redesign Spec

**Date :** 2026-05-04  
**Scope :** Fusionner `/dashboard` et `/coach/organisation` en une unique page d'accueil coach avec résumé collapsible, onboarding progressif, et vues Kanban/Agenda.

---

## Contexte

Deux pages coexistaient avec des rôles incohérents :
- `/dashboard` — KPIs business, alertes, actions rapides (133 lignes)
- `/coach/organisation` — Kanban, Agenda, vue résumé org (834 lignes)

La nav "Accueil" pointait vers `/coach/organisation` mais DockLeft pointait vers `/dashboard`. Résultat : confusion totale pour le coach.

**Décision :** `/dashboard` devient l'unique Accueil. `/coach/organisation` redirige → `/dashboard`.

---

## Structure Générale

```
TopBar (useSetTopBar)
Sub-nav : [Résumé] [Kanban] [Agenda]
─────────────────────────────────────
WELCOME HEADER (conditionnel — visible si < 3 étapes complétées)
─────────────────────────────────────
RÉSUMÉ FIXE (collapsible)
  expanded : ~45vh, 3 rows
  collapsed : mini-barre 48px
─────────────────────────────────────
VUE ACTIVE (scrollable)
  Résumé | Kanban | Agenda
```

---

## Section 1 : Welcome Header (Onboarding Progressif)

Visible tant que le coach n'a pas complété les 3 étapes. Disparaît définitivement à 3/3 — pas de toggle "revoir".

### Étapes (séquentielles)

| # | Action | Vérification DB | CTA destination |
|---|--------|----------------|----------------|
| 1 | Ajouter premier client | `COUNT coach_clients WHERE coach_id = user.id` | `/coach/clients/new` |
| 2 | Créer template de bilan | `COUNT assessment_templates WHERE coach_id = user.id` | `/coach/assessments/templates/new` |
| 3 | Créer première formule | `COUNT coach_formulas WHERE coach_id = user.id` | `/coach/formules` |

### Comportement

- Étape active : bouton CTA vert "→ Créer maintenant"
- Étape complétée : checkmark vert, texte barré discret
- Étape bloquée (suivante non encore atteinte) : grisée, pas de CTA
- Barre de progression `[██████░░░░] 2/3`
- Titre contextuel change selon étape active :
  - 0/3 : "Bienvenue dans la nouvelle ère du coaching"
  - 1/3 : "Premier client ajouté — créez votre premier bilan"
  - 2/3 : "Presque prêt — définissez votre première formule"

### Data

Fetch unique au load : 3 counts en `Promise.all`. Pas de polling. Refresh naturel au retour sur la page.

---

## Section 2 : Résumé Fixe (Collapsible)

### Expanded (~45vh)

**Row 1 — KPIs Business (grid 4 cols)**
- MRR (€/mois)
- Clients actifs
- Paiements en attente (€)
- Revenus ce mois

**Row 2 — Organisation du jour (grid 3 cols)**
- Aujourd'hui : événements agenda du jour
- Kanban : X tâches urgentes / en cours
- À venir : rappels 24h

**Row 3 — Activité coaching (grid 3 cols)**
- Bilans sans réponse >5j
- Clients inactifs >14j
- Séances complétées cette semaine

Toggle bas : `[↑ Réduire le résumé]`

### Collapsed (mini-barre 48px)

```
[MRR €]  [Clients actifs]  [⚠ N alertes]  [↓ Voir résumé]
```

Seuls MRR, clients actifs, count alertes critiques visibles.

### Persistance

État collapsed/expanded persisté en `localStorage('dashboard_summary_collapsed')`.

### Data

Endpoint existant `/api/dashboard/coach` — aucun nouvel endpoint requis.

---

## Section 3 : Sub-nav + Vues

### Sub-nav

Barre fine style Studio, positionnée sous le TopBar via `useSetTopBar` ou barre dédiée.  
3 pills : **Résumé · Kanban · Agenda**  
Pill active = accent `#1f8a65`.  
État persisté `localStorage('dashboard_active_view')`, défaut = `'resume'`.

### Vue Résumé (défaut)

Rien sous le résumé fixe. Si 0 alertes critiques : message discret "Tout est sous contrôle." Empty state propre.

### Vue Kanban

Composant `<DashboardKanban />` extrait depuis `app/coach/organisation/page.tsx`.  
Logique DnD, boards, colonnes, tâches — inchangée.

### Vue Agenda

Composant `<AgendaCalendar />` déjà existant dans `components/ui/AgendaCalendar`.  
Utilisé tel quel.

---

## Migration

| Avant | Après |
|-------|-------|
| `app/dashboard/page.tsx` (133L) | Réécrit — orchestrateur principal |
| `app/coach/organisation/page.tsx` (834L) | Remplacé par `redirect('/dashboard')` |
| Nav "Accueil" → `/coach/organisation` | Nav "Accueil" → `/dashboard` partout |
| Composants Kanban inline dans organisation | Extraits dans `components/dashboard/DashboardKanban.tsx` |

### Fichiers nav à mettre à jour

- `components/layout/DockLeft.tsx` — déjà correct (`/dashboard`)
- `components/layout/NavDock/NavRowB.tsx` — href `/coach/organisation` → `/dashboard`
- `components/layout/NavDock/useNavConfig.ts` — idem
- `components/layout/Sidebar.tsx` — idem

---

## Nouveaux Composants

```
components/dashboard/
  WelcomeHeader.tsx        — onboarding progressif 3 étapes
  SummaryPanel.tsx         — résumé collapsible (expanded + collapsed)
  DashboardKanban.tsx      — extrait de organisation/page.tsx
  DashboardSubNav.tsx      — pills Résumé/Kanban/Agenda
```

`app/dashboard/page.tsx` — réécrit, orchestrateur léger.  
`app/coach/organisation/page.tsx` — remplacé par redirect.

---

## Ce qu'on ne touche pas

- Logique Kanban (DnD, boards, tâches, API)
- `AgendaCalendar` composant
- Endpoint `/api/dashboard/coach`
- Design System tokens (couleurs, bordures, typo)

---

## Non-Objectifs

- Pas de polling temps réel sur le résumé
- Pas de 4ème étape onboarding (template programme) — Phase 2
- Pas de personnalisation des colonnes KPIs
