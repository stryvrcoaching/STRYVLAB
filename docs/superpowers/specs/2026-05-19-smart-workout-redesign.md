# Smart Workout Redesign — Spec

**Date:** 2026-05-19  
**Scope:** SessionLogger, SmartWorkoutHero, SmartWorkoutWidget, /client/programme page  
**Inspiration:** Motra, Macro Factor Workout  
**DS:** v3.0 strict (`#0d0d0d` bg, `#161616` surface, `#ffe01e` accent, Barlow)

---

## 1. Objectif

Refonte de l'expérience séance client : passer d'une vue focalisée 1-exercice-à-la-fois vers une **liste scrollable native** avec sets **inline-editables**, gestes swipe natifs, context menu `•••`, et set type selector. Niveau design : Motra / Macro Factor. Toutes les fonctions backend existantes sont conservées.

---

## 2. Architecture — Nouveaux composants

| Composant | Rôle | Remplace |
|-----------|------|---------|
| `ExerciseBlock.tsx` | Card exercice avec sets inline | Navigation par groupe actuelle |
| `SetRow.tsx` | Row d'un set, inline editable, swipe | `SetSwipeCard.tsx` |
| `SetTypeSelector.tsx` | Bottom sheet EC/Principal/RC/Dégressive | — |
| `ExerciseContextMenu.tsx` | Bottom sheet options `•••` exercice | — |
| `SupersetContextMenu.tsx` | Bottom sheet options `•••` groupe superset | — |

**Supprimés :**
- `SetSwipeCard.tsx` → remplacé par `SetRow`
- `SetEditSheet.tsx` → remplacé par inline edit dans `SetRow`
- Swipe hint banner
- Navigation dots par groupe / vue focalisée

---

## 3. SessionLogger — Structure générale

```
┌─ Header fixe (sticky top-0 z-50) ───────────────────────┐
│  [•••]        01:38        [⏁ Terminer]                  │
│  ████████████░░░░░░░░░░  14/36 séries (barre jaune)     │
└──────────────────────────────────────────────────────────┘

┌─ Scroll zone ────────────────────────────────────────────┐
│  ExerciseBlock                                           │
│  SupersetGroup > ExerciseBlock[]                         │
│  ExerciseBlock                                           │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘
```

**Header :**
- Gauche : `•••` → SessionContextMenu (Repos, Hydratation, Terminer)
- Centre : chrono `MM:SS` elapsed
- Droite : bouton `⏁ Terminer` (long press 3s → confirm, conservé)
- Sous le header : barre progression `completedSets / totalSets`, couleur `#ffe01e`

---

## 4. ExerciseBlock

Card `bg-[#161616] rounded-2xl border border-white/[0.08]` par exercice.

**Header exercice :**
```
[img 56×56 rounded-xl]  Barbell Incline Bench Press  [•••]
                        4 séries · 12 reps · RIR 2
```

**Corps :** liste de `SetRow` dans l'ordre (warmup → working → cooldown → dropset).

**Set actif** = premier set `!completed`. Border row `border-[#ffe01e]/20`. Scroll automatique vers set actif au mount.

**Footer :**
```
[+ Add Set]                              [📊 Progression]
```
- `+ Add Set` : ajoute un set `working` avec mêmes valeurs que dernier set
- `📊` : ouvre `ExerciseProgressionChart` en bottom sheet (existant, non refondu)

**Supersets :** groupés dans `SupersetGroup` wrapper :
```
bg-[#161616] rounded-2xl border border-white/[0.08]
Header: ⟲ Surensemble [•••]
Corps: ExerciseBlock[] sans border propre (fond transparent)
```

---

## 5. SetRow

Row inline-editable. Un composant par set.

**État pending :**
```
[TYPE▾]  [MM:SS repos]  [reps▾]  [poids kg]  [✓]
```

- **TYPE** : pill tapable `text-[9px] font-barlow-condensed uppercase` → ouvre `SetTypeSelector`
- **Repos** : `text-[12px] font-mono`, tap → input numérique natif (secondes → formaté MM:SS)
- **Reps** : `<input type="number" inputMode="numeric">`, placeholder = recommandation moteur
- **Poids** : `<input type="number" inputMode="decimal" step="0.25">`, placeholder = recommandation
- **✓** : bouton manuel valider (alternative au swipe)

**Swipe :**
- Droite `> +100px` → valide (vert `#10b981` flash, haptic 40ms, live save)
- Gauche `< -100px` → supprime set (rouge `#ef4444` trash icon révélé)

**État completed :**
```
bg-[#ffe01e]/06  border-[#ffe01e]/20
✓ EC   2:30   12 × 32,5kg   RIR 2   [PR]
```
Tap → re-edit (remet pending, conserve valeurs saisies).

**PR badge :** `bg-[#ffe01e] text-[#0d0d0d] text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md`

**Recommandation :** affichée en `placeholder` gris dans les inputs reps/poids. Pas d'overlay. Si user tape → placeholder disparaît.

**Coaching cue :** texte `text-[10px] text-white/40 italic` sous la row completed (conservé).

---

## 6. SetTypeSelector

Bottom sheet au tap sur pill TYPE.

```
⚡ Échauffement (EC)    — orange #FF6B35
1  Série principale     — blanc
❄  Retour au calme (RC) — bleu #60a5fa
↘  Dégressive           — violet #a78bfa
```

**DB :** colonne `set_type text default 'working'` sur `client_set_logs`.  
**Migration :** `20260519_set_type.sql`  
**SetLog type :** `set_type: 'warmup' | 'working' | 'cooldown' | 'dropset'`  
Persisté via live save PATCH `/api/session-logs/[logId]/sets` existant.

**Numérotation affichée :** seules les séries `working` sont numérotées (1, 2, 3...). EC/RC/Dégressive affichent leur label.

---

## 7. ExerciseContextMenu

Bottom sheet `•••` par exercice.

```
⟲  Exercice d'échange
⏱  Temps de repos
✎  Ajouter une note
▶  Tempo guide          (si tempo configuré sur l'exercice)
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
🗑  Supprimer l'exercice  (rouge)
```

- Échange → ouvre `ExerciseSwapSheet` existant
- Temps de repos → ouvre RestTimer modal existant
- Note → inline textarea sous l'exercice (toggle, conservé)
- Tempo guide → ouvre `TempoGuideModal` existant
- Supprimer → retire exercice de la liste locale (non persisté en DB côté client)

**SupersetContextMenu** (`•••` sur header Surensemble) :

```
↔  Dissocier le superset
⏱  Temps de repos
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
🗑  Supprimer le superset  (rouge)
```

---

## 8. Header fixe — SessionContextMenu

`•••` gauche du header → bottom sheet session :

```
⏱  Démarrer un repos manuel
💧  Hydratation
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
⏁  Terminer la séance
```

---

## 9. SmartWorkoutHero redesign

**State scheduled :**
```
┌──────────────────────────────────────────────────────────┐
│  SÉANCE DU JOUR          [Lun 19 mai]                   │
│                                                          │
│  Full Body A                                            │
│  8 exercices · ~55 min                                  │
│                                                          │
│  [Quad] [Pec] [Dos]          [BodyMap 80×120px]        │
│                                                          │
│  [████████████  DÉMARRER  ████████████]  (#ffe01e)      │
└──────────────────────────────────────────────────────────┘
```

**Changements vs actuel :**
- Suppression navigation prev/next date (appartient à `/client/programme`)
- Nom séance `text-[22px] font-black` (vs `text-[20px]`)
- BodyMap conservé

**State completed :** inchangé (checkmark + "Voir →").  
**State rest :** inchangé.

---

## 10. SmartWorkoutWidget

Structure conservée. Alignement typographique DS v3.0 uniquement — pas de refonte structurelle.

---

## 11. Page /client/programme

Hors scope de ce sprint. Navigation semaine / liste séances = Phase suivante.

---

## 12. Ce qui est conservé sans modification

| Feature | Fichier |
|---------|---------|
| Live save PATCH /sets | `SessionLogger.tsx` |
| PR detection + flash | `SessionLogger.tsx` |
| SetRecommendation engine | `lib/training/setRecommendation.ts` |
| Tempo guide modal | `TempoGuideModal.tsx` |
| RestTimer overlay | `SessionLogger.tsx` |
| Client alternatives sheet | `ClientAlternativesSheet.tsx` |
| ExerciseSwapSheet | `ExerciseSwapSheet.tsx` |
| Hydration plan | `SessionLogger.tsx` |
| Long press terminer | `SessionLogger.tsx` |
| Unilateral G/D sets | `buildInitialSets()` |
| ExerciseProgressionChart | `ExerciseProgressionChart.tsx` |

---

## 13. Migration DB requise

```sql
-- 20260519_set_type.sql
ALTER TABLE client_set_logs
  ADD COLUMN IF NOT EXISTS set_type text DEFAULT 'working'
  CHECK (set_type IN ('warmup', 'working', 'cooldown', 'dropset'));
```

À appliquer manuellement via Supabase Dashboard.

---

## 14. Points de vigilance

- `SetRow` inline inputs dans flex → TOUJOURS `min-w-0` sur chaque `<input>`
- Swipe delete : uniquement sets `!completed` — sets validés ne peuvent pas être supprimés par swipe (tap re-edit d'abord)
- `set_type` default `'working'` → les sets existants sans migration sont traités comme working (rétrocompat)
- Supersets : `group_id` déjà dans `SetLog` — ExerciseBlock groupés par `group_id` non-null
- `+ Add Set` : copie `rest_sec`, `planned_reps`, `current_weight_kg` du dernier set du même exercice
- Scroll to active set : `useEffect` au mount + au changement de `currentGroupIndex` supprimé → scroll natif via `ref.scrollIntoView({ behavior: 'smooth', block: 'center' })`
- `rounded-[2px]` INTERDIT dans `/client` — DS v3.0 strict
