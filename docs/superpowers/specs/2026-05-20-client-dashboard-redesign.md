# Client Dashboard Redesign — Spec

**Date:** 2026-05-20  
**Scope:** `app/client/page.tsx` + composants home  
**Goal:** Remplacer la grille 2 colonnes par un layout full-width vertical, hiérarchie claire, alertes regroupées

---

## Principe directeur

Résumé global en premier. Chaque bloc a toute la largeur. Ce qui nécessite une action immédiate (alertes) est visible sans scroll.

---

## Layout — 5 blocs full-width vertical

```
TopBar : "AUJOURD'HUI" + date courte

[1] Hero Snapshot        — 4 stats clés de la journée
[2] Alertes prioritaires — toutes alertes regroupées (conditionnel)
[3] Séance du jour       — SmartWorkoutWidget full-width
[4] Nutrition du jour    — SmartNutritionWidget full-width + régularités
[5] Timeline journée     — SmartAgendaTimeline (inchangé)
```

---

## Bloc 1 — Hero Snapshot

**Composant :** nouveau `DashboardHeroSnapshot.tsx` (`components/client/smart/`)

**Données affichées (4 stats en ligne) :**

| Stat | Valeur | Fallback |
|------|--------|----------|
| Kcal restantes | `target.kcal - consumed.kcal` | `—` si pas de protocole |
| Séance | nom session si planifiée / `✓ [nom]` si complétée / `Repos` si jour off | `Repos` |
| Eau | `Xml / Yml` (consommé / cible) | `0ml / 2.5L` |
| Streak | `🔥 Nj` si streak > 0, sinon `0j` | `0j` |

**Style :**
- `bg-[#161616] rounded-2xl border border-white/[0.08] px-5 py-4`
- Date en haut : `text-[9px] font-barlow-condensed uppercase tracking-[0.18em] text-white/30`
- 4 stats : `grid grid-cols-4`, chaque stat = valeur (`text-[18px] font-black`) + label (`text-[9px] text-white/35 uppercase tracking-[0.1em]`)
- Streak jaune `#ffe01e` si > 0, blanc sinon
- Kcal négatives (dépassement) → rouge `#ef4444`

**Props :**
```ts
type DashboardHeroSnapshotProps = {
  kcalRemaining: number | null   // null = pas de protocole
  sessionState: 'scheduled' | 'completed' | 'rest' | 'no_program'
  sessionName: string | null
  waterMl: number
  waterTargetMl: number
  streak: number
  date: string  // ex: "Mer. 21 mai"
}
```

---

## Bloc 2 — Alertes prioritaires

**Composant :** nouveau `DashboardAlertsFeed.tsx` (`components/client/smart/`)

**Sources agrégées (dans cet ordre de priorité) :**
1. Notifications coach (`coach_client_notifications` non lues) — type `coach_feedback`, `program_assigned`, etc.
2. Recovery alerts (`RecoveryStatusWidget` — sommeil, stress, énergie depuis check-in matin)
3. Workout alerts (`SmartAlertsFeed` — stagnation, overreaching depuis `workoutAlerts`)
4. Nutrition alerts — calculées inline depuis `consumed` vs `target` :
   - Protéines en retard : si heure > 14h ET `consumed.protein_g < target.protein_g * 0.5` → warning
   - Hydratation faible : si heure > 12h ET `consumed.water_ml < target.water_ml * 0.4` → warning

**Rendu :**
- Bloc entier **non rendu** si 0 alertes (pas de card vide)
- Max 4 alertes visibles, bouton "Voir tout" si > 4
- Chaque alerte : pill couleur (rouge=critique, amber=warning, bleu=info) + titre court + corps optionnel
- Style card : `bg-[#161616] rounded-2xl border border-white/[0.08] px-4 py-3 space-y-2`

**Props :**
```ts
type DashboardAlertsFeedProps = {
  coachNotifications: Notification[]
  morningCheckin: CheckinData | null
  workoutAlerts: GenericAlert[]
  consumed: NutritionMacros
  target: NutritionMacros
  plannedSessionToday: boolean
}
```

---

## Bloc 3 — Séance du jour

**Composant :** `SmartWorkoutWidget` existant — **modifié** : suppression prop `compact`, layout full-width par défaut.

**Changements :**
- Supprimer `compact` prop et toute logique conditionnelle liée
- BodyMap : affiché si `!compact` → toujours affiché (full-width = espace suffisant)
- Conserver style actuel (titre `font-semibold 15px`, bouton outline jaune)

---

## Bloc 4 — Nutrition du jour

**Composant :** `SmartNutritionWidget` existant — **modifié** : prop `compact` supprimée, ajout section régularités.

**Ajout régularités (sous les macros) :**
- Calculé server-side dans `page.tsx` : compter les N derniers jours où `protein_g >= target.protein_g * 0.8`
- Affichage : `"Protéines atteintes X jours sur 7"` + mini barre de progression `rounded-full bg-[#ffe01e]`
- Seulement si target.protein_g > 0 et au moins 3 jours de données

**Query supplémentaire dans `page.tsx` :**
```ts
// Derniers 7 jours de nutrition (pour régularités)
svc()
  .from('nutrition_meals')
  .select('physiological_date, total_protein_g')
  .eq('client_id', clientId)
  .gte('physiological_date', sevenDaysAgo)
  .order('physiological_date', { ascending: true })
```

---

## Bloc 5 — Timeline journée

`SmartAgendaTimeline` — **inchangé**.

---

## Modifications `page.tsx`

1. Supprimer `<div className="grid grid-cols-2 ...">` wrapper
2. Ajouter query nutrition 7j pour régularités
3. Calculer `kcalRemaining`, `sessionState` pour `DashboardHeroSnapshot`
4. Calculer `nutritionStreak` (jours protéines atteintes sur 7j)
5. Passer `DashboardAlertsFeed` à la place des 3 composants séparés (`NotificationsBar`, `RecoveryStatusWidget` gardés comme sources de données mais le rendu est unifié)
6. Ordre rendu : Hero → Alertes → Séance → Nutrition → Timeline

---

## DS v3.0 compliance

- Background pages : `#0d0d0d` ✅
- Cards : `#161616` ✅
- Accent : `#ffe01e` ✅
- Texte sur jaune : `#0d0d0d` ✅
- Radius : `rounded-2xl` cards, `rounded-xl` boutons ✅
- No `rounded-[2px]` ✅
- No colored shadows ✅

---

## Fichiers touchés

| Action | Fichier |
|--------|---------|
| Create | `components/client/smart/DashboardHeroSnapshot.tsx` |
| Create | `components/client/smart/DashboardAlertsFeed.tsx` |
| Modify | `components/client/smart/SmartWorkoutWidget.tsx` — suppr compact |
| Modify | `components/client/smart/SmartNutritionWidget.tsx` — full-width + régularités |
| Modify | `app/client/page.tsx` — layout + nouvelles queries + props |
