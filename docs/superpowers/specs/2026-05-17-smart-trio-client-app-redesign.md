# Smart Trio — Refonte App Client `/client`

**Date :** 2026-05-17
**Statut :** Design validé, prêt pour implémentation plan
**Auteur :** Refonte UX/architectural — 3 piliers Smart Agenda / Smart Workout / Smart Nutrition

---

## Contexte & Objectif

L'app client `/client` actuelle est éclatée en pages multiples (home, agenda, programme, nutrition, journal, progress, profil) avec navigation peu intuitive et bouton `+` PlusMenu mal calibré. Objectif :

> Architecture intuitive, centralisée, premium, minimaliste. Trois piliers principaux : Smart Agenda (accueil), Smart Workout, Smart Nutrition. Tout est en un clin d'œil sur l'accueil. Bouton central logo STRYVR = logger rapide (eau, repas, activité, check-in).

---

## Routes finales

```
/client                  → Smart Agenda (accueil)
/client/programme        → Smart Workout (refonte vue intelligente)
/client/nutrition        → Smart Nutrition (refonte vue intelligente)
/client/profil           → Profil + paramètres (inchangé)

SUPPRIMÉES (redirect 301 → /client) :
/client/agenda
/client/progress
```

---

## Navigation — BottomNav refonte (5 slots)

```
[ Agenda ] [ Workout ] [ ◆ Logo ] [ Nutrition ] [ Profil ]
   icon       icon       central     icon        icon
```

- Bouton central = logo STRYVR `#ffe01e` carré `40×40px`, `rounded-xl`, shadow `0_0_16px_rgba(255,224,30,0.25)`
- Tap = ouvre `RadialActionMenu` (overlay + 4 boutons en arc)
- Garde structure actuelle (border, blur, safe-area)
- Composant : `components/client/BottomNav.tsx` modifié

### TopBar dynamique (`ClientTopBar.tsx` modifié)

`useSetTopBar(left, right)` hook existant. Label section :

| Route | Label | Titre |
|---|---|---|
| `/client` | `AUJOURD'HUI` | Date du jour (ex: `Sam. 17 mai`) |
| `/client/programme` | `ENTRAÎNEMENT` | Nom séance ou date |
| `/client/nutrition` | `NUTRITION` | Date |
| `/client/profil` | `PROFIL` | Prénom client |

Style :
- Left label : `text-[9px] text-white/30 uppercase tracking-[0.18em] font-barlow-condensed bold`
- Left titre : `text-[13px] text-white font-barlow`
- Right : action contextuelle par page (ex: `+ Repas` sur nutrition)

---

## Smart Agenda (accueil) — `/client/page.tsx`

### Structure top→bottom

```
1. NotificationsBar         (conditionnel)
2. SmartNutritionWidget     (demi-cercle + macros + hydra + bouton +)
3. SmartWorkoutWidget       (séance jour avec BodyMap mini)
4. SmartAgendaTimeline      (logs jour, heure colonne fixe 44px)
```

### 1. NotificationsBar

- Affiche uniquement si ≥1 notification non-dismissed
- Cards horizontales scrollables si ≥3, stack vertical si ≤2
- Types : `coach_note`, `bilan_pending`, `program_assigned`, `system_reminder`
- Dot indicator non-lu, tap = action contextuelle
- Composant : `components/client/smart/NotificationsBar.tsx`

### 2. SmartNutritionWidget

Référence visuelle : MacroFactor dashboard, adapté DS v3.0 jaune.

- Card `bg-[#161616]`, `rounded-2xl`, padding `18px`
- Header : label `NUTRITION` (uppercase Barlow Condensed bold tracking 0.18em) + lien `+ Repas` jaune
- Demi-cercle 120px haut, `stroke-width:12`, jaune `#ffe01e`, fond `rgba(255,255,255,0.08)`
- Centre : kcal consommés `24px font-black` + `/ cible kcal` `10px white/40`
- 3 barres macros pleine largeur (P bleu `#4a90e2` / G vert `#22c55e` / L jaune-orange `#f59e0b`), chacune :
  - Label gauche `10px white/55 uppercase tracking 0.1em`
  - Valeur droite `consommé/cible g` `10px white font-bold`
  - Barre `6px` arrondie
- Séparateur `border-top white/[0.06]`
- Ligne hydratation : label + valeur `1.4 / 2.5 L` + barre cyan `#06b6d4` + bouton `+` carré `32×32px` `#ffe01e` (tap = ouvre `QuickWaterModal` existant)

**Pas de toggle Consumed/Remaining.** Toujours consommé/cible.

Composant : `components/client/smart/SmartNutritionWidget.tsx`

### 3. SmartWorkoutWidget

- Card `bg-[#161616]`, `rounded-2xl`, padding `18px`
- Header : label `SÉANCE DU JOUR` + chevron `→`
- Layout 2 colonnes :
  - **Gauche** flex-1 : nom séance `18px font-black -0.02em`, sub `8 exercices · ~58 min` `11px white/50`, pills muscles `bg-[#ffe01e]/0.1 text-[#ffe01e]` `9px uppercase`
  - **Droite** 80px : BodyMap miniature SVG (composant existant adapté)
- CTA `Démarrer →` jaune full-width `padding 10px rounded-xl 11px font-black uppercase tracking 0.1em`
- Tap card hors CTA → `/client/programme`
- État repos : "Jour de repos — pas de séance prévue" + link `+ Logger activité libre`
- État programme manquant : "Pas de programme assigné" + link "Contacter ton coach"

Composant : `components/client/smart/SmartWorkoutWidget.tsx`

### 4. SmartAgendaTimeline

- Card `bg-[#161616]`, `rounded-2xl`, padding `18px`
- Header : label `JOURNÉE`
- Liste verticale gap-10px, chaque entrée :
  - Heure 44px col gauche `text-[10px] white/40 font-bold font-variant-numeric:tabular-nums`
  - Icon 28px carré `rounded-lg` bg coloré (vert=repas `#22c55e/0.15`, cyan=eau `#06b6d4/0.15`, jaune=workout `#ffe01e/0.15`, violet=check-in `#8b5cf6/0.15`, gris=activité `rgba(255,255,255,0.08)`)
  - Contenu : titre `12px font-semibold white` + sub `10px white/40`
  - Tap → modal détail ou route appropriée
- Séance jour highlight : `bg-[#ffe01e]/0.06` + border `border-[#ffe01e]/0.2`
- **Agrégation eau par tranche horaire** : matin 5-12h / midi 12-15h / aprem 15-19h / soir 19-24h → "Hydratation matin · 750ml"
- Empty state : "Aucune activité enregistrée aujourd'hui"

Composant : `components/client/smart/SmartAgendaTimeline.tsx`

---

## Bouton central + RadialActionMenu

### Visuel bouton central

- Carré `40×40px`, `rounded-xl`, `bg-[#ffe01e]`
- Logo STRYVR SVG monochrome `#0d0d0d` centré
- Shadow `0_0_16px_rgba(255,224,30,0.25)`
- Active scale `0.95`
- Remplace l'icône `Plus` actuelle dans `BottomNav.tsx`

### RadialActionMenu component

- Composant : `components/client/smart/RadialActionMenu.tsx`
- Overlay plein écran `bg-black/60 backdrop-blur-sm` z-40
- 4 boutons disposés en arc autour bouton central (rayon `~110px`, angles approx `-135° / -100° / -80° / -45°` depuis vertical)
- Anim Framer Motion : opacity `0→1` + translate from center (stagger `40ms`)
- Chaque bouton :
  - `64×64px rounded-2xl bg-[#161616] border-white/[0.08]`
  - Icon Phosphor `28px`
  - Label sous bouton : `font-barlow-condensed bold uppercase tracking-[0.18em] text-[10px]`
- Tap hors bouton ou bouton central re-tap = close radial
- Active scale `0.95` au tap action

### Actions

| Icon | Label | Action |
|---|---|---|
| 🍽️ ForkKnife | REPAS | `router.push('/client/nutrition/log')` |
| 💧 Drop | EAU | Ouvre `QuickWaterModal` existant + close radial |
| 🏃 PersonSimpleRun | ACTIVITÉ | Ouvre `FreeActivitySheet` (nouveau) |
| 🌙 Moon | CHECK-IN | `router.push('/client/checkin/onboarding')` |

`BottomNavPlusMenu.tsx` est **supprimé** (remplacé par RadialActionMenu).

### FreeActivitySheet (nouveau)

- Composant : `components/client/smart/FreeActivitySheet.tsx`
- Bottom sheet `rounded-t-2xl bg-[#161616]`, `maxHeight 88vh`, header fixe + scroll body
- Form :
  - **Type activité** : select (`running`, `cycling`, `swimming`, `walking`, `team_sport`, `other`) → input text si `other`
  - **Date + heure début** : datetime picker
  - **Durée** : input minutes (1-360)
  - **Intensité** : slider natif `<input type="range" min={1} max={10}>` style DS v3.0
  - **Notes** : textarea optionnelle (max 500 chars)
- CTA `Enregistrer` jaune full-width
- POST `/api/client/activity-logs` → close sheet + revalidate timeline

---

## Smart Nutrition page — `/client/nutrition/page.tsx`

**Objectif :** vue intelligente avec indicateurs IA, pas un journal. Le journal vit dans Smart Agenda timeline.

### Structure top→bottom

```
1. SmartNutritionHero       (jour navigation prev/today/next + macros gros)
2. SmartAlertsFeed          (alertes IA contextuelles, conditionnel)
3. CoachProtocolCard        (protocole shared coach)
4. RemainingBreakdown       (ce qui reste à consommer, suggestions)
5. WeeklyTrendStrip         (mini chart 7j calories vs cible)
```

### 1. SmartNutritionHero

- Composant : `components/client/smart/SmartNutritionHero.tsx`
- Header navigation 3 colonnes : `← {prev_date}` | `{current_date} font-black 18px` | `{next_date} →`
- Demi-cercle large `180px` (plus grand que widget accueil), même style DS v3.0
- 3 colonnes macros gros sous demi-cercle : valeur consommé/cible, mini barre couleur
- Tap navigation = reload `?date=YYYY-MM-DD`

### 2. SmartAlertsFeed (4 règles IA, lib `lib/client/smart/nutritionAlerts.ts`)

- Composant : `components/client/smart/SmartAlertsFeed.tsx`
- Card par alerte : icon + titre + sub
- Max 3 visibles, expand pour voir tout
- Réutilisable aussi sur Smart Workout page (variante workoutAlerts)

**Règles nutrition :**

| Règle | Trigger | Severity | Message |
|---|---|---|---|
| Manque protéines | `consommé_g < (cible_g × current_hour/22) × 0.8` ET `current_hour ≥ 14` | warning | "PROTÉINES EN RETARD · il te reste {delta}g pour atteindre {cible}g" |
| Limite glucides | `consommé_g > cible_g` | critical | "LIMITE GLUCIDES ATTEINTE · -{depasse}g sur ta cible" |
| Hydratation faible | `current_hour ≥ 14` ET `conso_eau_ml / cible_ml < 0.5` | warning | "HYDRATATION FAIBLE · il manque {delta_l}L" |
| Repas non logué | `current_hour ∈ [13,14]` ET pas de log `meal_type='lunch'` aujourd'hui | info | "PAS DE DÉJEUNER LOGUÉ" |

Severity colors :
- `info` : cyan `#06b6d4`
- `warning` : amber `#f59e0b`
- `critical` : red `#ef4444`

Tap alerte = action contextuelle (ex: open composer pré-rempli macro manquant).

### 3. CoachProtocolCard

- Composant : `components/client/smart/CoachProtocolCard.tsx`
- Si `nutrition_protocols.status='shared'` actif : affiche le jour du protocole (carb cycle haut/bas si applicable)
- Objectifs jour : kcal / P / L / G / eau
- Recommandations textuelles (`recommendations` field du protocole)
- Phase cycle sync si client `gender='female'`
- Empty state : "Pas de protocole nutritionnel actif"

### 4. RemainingBreakdown

- Composant : `components/client/smart/RemainingBreakdown.tsx`
- Texte : "Il te reste aujourd'hui : {kcal_remaining} kcal · {p_remaining}g P · {g_remaining}g G · {l_remaining}g L · {eau_remaining}L"
- 2-3 suggestions repas pré-construits qui matchent macros restants
- **Phase 1** : suggestions hardcodées par range (ex: `if remaining_protein > 30g && remaining_carbs < 20g → "Yaourt grec + amandes"`)
- **Phase 2 (futur)** : suggestions IA
- Tap suggestion → composer pré-rempli

### 5. WeeklyTrendStrip

- Composant : `components/client/smart/WeeklyTrendStrip.tsx`
- 7 colonnes verticales (lun→dim, en respectant la semaine en cours)
- Hauteur = % cible atteint
- Couleurs : vert `#22c55e` >85%, jaune `#ffe01e` 60-85%, rouge `#ef4444` <60%, gris jour futur
- Compact 60px haut total

---

## Smart Workout page — `/client/programme/ProgrammeClientPage.tsx`

**Objectif :** refonte "Smart" — indicateurs IA, volume coverage, alertes RIR/stagnation. Conserve flow session existant (SessionLogger v2).

### Structure top→bottom

```
1. SmartWorkoutHero              (jour nav + séance du jour)
2. SmartWorkoutAlerts            (RIR / stagnation, conditionnel)
3. SessionPreview                (BodyMap pleine + exos liste)
4. VolumeCoverageWidget          (MEV/MAV/MRV par muscle, semaine)
5. RecentSessionsStrip           (3 dernières séances completed)
```

### 1. SmartWorkoutHero

- Composant : `components/client/smart/SmartWorkoutHero.tsx`
- Header navigation : `← {prev}` | `{current} 18px font-black` | `{next} →`
- État séance du jour :
  - **Programmée** : nom + sub `8 ex · 58 min · Pectoraux/Épaules/Triceps` + CTA `Démarrer →`
  - **Complétée** : badge `✓ Terminée` vert + delta perf (kg moy, RIR moy) + link `Voir le récap`
  - **Repos** : "Jour de repos" + link `+ Activité libre`

### 2. SmartWorkoutAlerts (3 règles IA, lib `lib/client/smart/workoutAlerts.ts`)

Réutilise `lib/performance/analyzer.ts` existant.

| Règle | Trigger | Severity | Message |
|---|---|---|---|
| Surmenage RIR | `avg_rir ≤ 1` sur 2 séances + `completion < 0.8` | critical | "SURMENAGE · {exercice} · réduis charge ou ajoute jour repos" |
| Stagnation | `overloads_last_3_weeks = 0` ET `≥ 3 sessions period` | warning | "STAGNATION · {exercice} · essaie alternative" + bouton `Voir alternatives` |
| Progression positive | `completion_rate > 0.95` + `rir_trend = improving` | info | "BONNE PROGRESSION · {exercice} · prêt pour overload" |

### 3. SessionPreview

- Composant : `components/client/smart/SessionPreview.tsx`
- BodyMap pleine taille avec primary/secondary highlight (composant `BodyMap.tsx` existant)
- Liste exos (`ExerciseListDisclosure.tsx` existant) : nom + sets×reps + RIR cible + équipement
- Tap exo = expand pour voir alternatives + last performance

### 4. VolumeCoverageWidget (réutilise `lib/programs/intelligence/volume-targets`)

- Composant : `components/client/smart/VolumeCoverageWidget.tsx`
- Card `bg-[#161616]`, `rounded-2xl`
- Header : `VOLUME HEBDOMADAIRE` + sub `S{n} · {x} séances cette semaine`
- Liste verticale par sous-groupe (16 muscles depuis `VOLUME_SEGMENTS`) :
  - Label muscle `11px white/55`
  - Barre `6px` avec marqueurs MEV (tick vertical noir) et MAV (tick vertical noir)
  - Couleurs : gris `rgba(255,255,255,0.08)` under MEV, vert `#22c55e` MEV→MAV optimal, amber `#f59e0b` >MAV, rouge `#ef4444` >MRV
  - Valeur droite `{actual} sets / MEV {mev}`
- Compact, scrollable si >8 muscles affichés

### 5. RecentSessionsStrip

- Composant : `components/client/smart/RecentSessionsStrip.tsx`
- 3 cards horizontales scrollables, dernières séances complétées
- Chaque card : date + nom séance + 1 chiffre clé (volume kg total ou RIR moy) + delta vs précédente même séance (↑ vert / ↓ rouge)
- Tap card → `/client/programme/recap/[sessionLogId]`

---

## Architecture composants & fichiers

### Nouveaux composants (`components/client/smart/`)

```
SmartNutritionWidget.tsx
SmartWorkoutWidget.tsx
SmartAgendaTimeline.tsx
NotificationsBar.tsx
RadialActionMenu.tsx
FreeActivitySheet.tsx
SmartAlertsFeed.tsx
SmartNutritionHero.tsx
CoachProtocolCard.tsx
RemainingBreakdown.tsx
WeeklyTrendStrip.tsx
SmartWorkoutHero.tsx
SmartWorkoutAlerts.tsx
SessionPreview.tsx
VolumeCoverageWidget.tsx
RecentSessionsStrip.tsx
```

### Composants modifiés

- `components/client/BottomNav.tsx` — 5 slots + bouton logo central radial
- `components/client/ClientTopBar.tsx` — labels dynamiques par section
- `app/client/page.tsx` — refonte complète Smart Agenda
- `app/client/nutrition/page.tsx` — refonte Smart Nutrition
- `app/client/programme/ProgrammeClientPage.tsx` — refonte Smart Workout

### Composants/pages supprimés

- `app/client/agenda/` (toute la route)
- `app/client/progress/` (toute la route)
- `components/client/AgendaDayView.tsx`, `AgendaWeekView.tsx`, `AgendaEventCard.tsx`
- `components/client/ProgressCharts.tsx`, `PRsPodium.tsx`, `ProgressHeatmap.tsx`, `ProgressVolumeChart.tsx`
- `components/client/BottomNavPlusMenu.tsx`
- Redirects 301 `/client/agenda` → `/client`, `/client/progress` → `/client` via `middleware.ts` ou route handlers

### Libs partagées (pure fns, testables Vitest)

```
lib/client/smart/
├── nutritionAlerts.ts       ← computeNutritionAlerts(todayLogs, target, currentHour)
├── workoutAlerts.ts         ← computeWorkoutAlerts(analyzerOutput)
├── waterAggregation.ts      ← groupWaterByTimeOfDay(logs) → { morning, midday, afternoon, evening }
└── timelineBuilder.ts       ← buildTimeline(meals, water, session, activities, checkins) → entries[]
```

Imports inversés : API route appelle lib (server-side compute), pas dans React components.

---

## Migrations DB

### `supabase/migrations/20260517_coach_client_notifications.sql`

```sql
CREATE TABLE IF NOT EXISTS coach_client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES auth.users(id),   -- null si système
  type text NOT NULL CHECK (type IN ('coach_note', 'bilan_pending', 'program_assigned', 'system_reminder')),
  title text NOT NULL,
  body text,
  payload jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notif_client_active ON coach_client_notifications (client_id, dismissed_at, created_at DESC);

ALTER TABLE coach_client_notifications ENABLE ROW LEVEL SECURITY;

-- Client peut lire ses propres notifs
CREATE POLICY notif_client_select ON coach_client_notifications
  FOR SELECT USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

-- Client peut marquer lu/dismiss
CREATE POLICY notif_client_update ON coach_client_notifications
  FOR UPDATE USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

-- Coach peut insérer pour ses clients
CREATE POLICY notif_coach_insert ON coach_client_notifications
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())
  );
```

### `supabase/migrations/20260517_client_activity_logs.sql`

```sql
CREATE TABLE IF NOT EXISTS client_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('running','cycling','swimming','walking','team_sport','other')),
  custom_label text,
  started_at timestamptz NOT NULL,
  duration_min int NOT NULL CHECK (duration_min BETWEEN 1 AND 360),
  intensity int NOT NULL CHECK (intensity BETWEEN 1 AND 10),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_client_date ON client_activity_logs (client_id, started_at DESC);

ALTER TABLE client_activity_logs ENABLE ROW LEVEL SECURITY;

-- Client peut tout sur ses propres logs
CREATE POLICY activity_client_all ON client_activity_logs
  FOR ALL USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

-- Coach peut lire les logs de ses clients
CREATE POLICY activity_coach_select ON client_activity_logs
  FOR SELECT USING (
    client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())
  );
```

---

## API routes

### Nouvelles

```
app/api/client/notifications/route.ts                  ← GET (unread param), PATCH (mark all read)
app/api/client/notifications/[id]/route.ts             ← PATCH (dismiss), DELETE
app/api/client/activity-logs/route.ts                  ← GET (date param), POST
app/api/client/activity-logs/[id]/route.ts             ← DELETE
app/api/client/nutrition-alerts/route.ts               ← GET (calcul alertes IA serveur via lib)
app/api/client/workout-alerts/route.ts                 ← GET (réutilise analyzer existant)
app/api/client/volume-coverage/route.ts                ← GET (utilise volume-targets lib, week param)
app/api/client/nutrition/today/route.ts                ← GET (data hero + remaining, date param)
app/api/client/nutrition/weekly-trend/route.ts         ← GET (7 days calories vs cible)
app/api/client/timeline/today/route.ts                 ← GET (data SmartAgendaTimeline, date param)
app/api/client/recent-sessions/route.ts                ← GET (3 dernières completed pour RecentSessionsStrip)
```

### Existantes réutilisées

- `/api/client/nutrition/today-progress` (déjà existe)
- `/api/clients/[clientId]/performance-summary` (déjà existe, expose RIR/stagnation)
- `/api/client/preferences` (déjà existe)

---

## Data flow

### Smart Agenda (accueil)

```
app/client/page.tsx (Server Component)
  ├── resolveClientFromUser
  ├── Promise.all([
  │     notifications: /api/client/notifications?unread=true
  │     nutrition: /api/client/nutrition/today
  │     workout: program_sessions WHERE day_of_week = today
  │     timeline: /api/client/timeline/today
  │   ])
  └── render → NotificationsBar + SmartNutritionWidget + SmartWorkoutWidget + SmartAgendaTimeline
```

### Smart Nutrition

```
app/client/nutrition/page.tsx (Server Component)
  ├── Date param ?date (default today)
  ├── Promise.all([
  │     dayProgress: /api/client/nutrition/today?date=...
  │     alerts: /api/client/nutrition-alerts
  │     protocol: nutrition_protocols.status='shared' active
  │     weeklyTrend: /api/client/nutrition/weekly-trend
  │   ])
  └── render sections 1-5
```

### Smart Workout

```
app/client/programme/ProgrammeClientPage.tsx (Client Component existant modifié)
  ├── Date param navigation
  ├── Fetch session du jour (existant)
  ├── Fetch alerts: /api/client/workout-alerts
  ├── Fetch volume: /api/client/volume-coverage
  ├── Fetch recent: /api/client/recent-sessions
  └── render sections 1-5
```

---

## Edge cases & gestion erreur

| Cas | Comportement |
|---|---|
| Client sans coach assigné | Widgets vides + empty states explicites |
| Pas de programme actif | SmartWorkoutWidget = "Pas de programme assigné" + link contact coach |
| Pas de protocole nutrition shared | SmartNutritionWidget = "Pas de protocole nutritionnel" + macros à 0 |
| Pas de logs du jour | SmartAgendaTimeline = empty state |
| Pas de notifs | NotificationsBar absent du DOM |
| Fetch fail (réseau) | Error boundary par section, retry button |
| Date future navigée | Affichage état futur (prévu), volume = 0 |
| Date passée | Mode lecture, pas de CTA "Démarrer" |
| Activité libre annulable | Tap entry timeline → modal détail avec bouton supprimer |
| Notification dismissed | `dismissed_at = now()`, n'apparaît plus |

### Performance

- Smart Agenda : 1 `Promise.all` parallèle au mount server-side, debounce 0
- Smart Workout volume coverage : memo côté server, recalculé 1× par requête
- Smart Nutrition alerts : pure compute, <50ms

---

## i18n

Toutes les nouvelles chaînes via `ct(lang, 'smart.<section>.<key>')` etc.

Ajout clés dans `lib/i18n/clientTranslations.ts` :

```
smart.agenda.title
smart.agenda.empty
smart.nutrition.label
smart.nutrition.kcal
smart.nutrition.protein
smart.nutrition.carbs
smart.nutrition.fat
smart.nutrition.hydration
smart.nutrition.alert.proteinLow
smart.nutrition.alert.carbsLimit
smart.nutrition.alert.hydrationLow
smart.nutrition.alert.lunchMissing
smart.workout.session
smart.workout.rest
smart.workout.alert.overreaching
smart.workout.alert.stagnation
smart.workout.alert.progression
smart.workout.volumeCoverage
smart.timeline.morning
smart.timeline.midday
smart.timeline.afternoon
smart.timeline.evening
smart.radial.meal
smart.radial.water
smart.radial.activity
smart.radial.checkin
smart.activity.type.running
smart.activity.type.cycling
smart.activity.type.swimming
smart.activity.type.walking
smart.activity.type.team_sport
smart.activity.type.other
smart.notification.coach_note
smart.notification.bilan_pending
smart.notification.program_assigned
smart.notification.system_reminder
```

3 langues : FR, EN, ES.

---

## DS v3.0 — tokens stricts respectés

- Background pages : `#0d0d0d`
- Surface cards : `#161616`
- Accent CTA : `#ffe01e` jaune, texte sur jaune `#0d0d0d`
- Border : `border-white/[0.08]`
- Radius : `rounded-2xl` cards principales, `rounded-xl` boutons/items, `rounded-lg` icônes, `rounded-full` dots/pills
- Aucune `shadow-*` colorée
- Aucun gradient coloré en fond de card
- Police : Barlow (body) + Barlow Condensed (labels uppercase)
- Labels uppercase : `font-barlow-condensed font-bold uppercase tracking-[0.18em]`

---

## Hors scope Phase 1 (Phase 2 futur)

- Refonte système progression (heatmaps habits, PRs podium) — supprimé Phase 1, refonte future
- Suggestions repas IA (currently hardcoded ranges)
- Notifications Web Push pour alertes Smart Nutrition
- Vue extended `/client/agenda` semaine/mois (supprimée Phase 1)
- Refonte Profil page
- Mobile gestures swipe entre piliers
- Coach UI pour créer notifications côté `/coach`

---

## Critères acceptance

- [ ] BottomNav 5 slots avec logo central STRYVR fonctionnel
- [ ] Tap logo central ouvre RadialActionMenu animé 4 actions
- [ ] Smart Agenda affiche 4 sections (notifs si présentes, nutrition widget, workout widget, timeline)
- [ ] SmartNutritionWidget match référence MacroFactor adaptée DS v3.0 jaune
- [ ] Timeline agrège eau par tranche horaire (matin/midi/aprem/soir)
- [ ] Smart Nutrition page affiche 5 sections + alertes IA fonctionnelles
- [ ] Smart Workout page affiche 5 sections + alertes RIR/stagnation + volume coverage
- [ ] Routes `/client/agenda` + `/client/progress` redirigent 301 vers `/client`
- [ ] Migrations DB appliquées : `coach_client_notifications` + `client_activity_logs`
- [ ] 11 API routes nouvelles fonctionnelles
- [ ] Pure fns lib testées Vitest (`nutritionAlerts`, `workoutAlerts`, `waterAggregation`, `timelineBuilder`)
- [ ] TopBar dynamique par section opérationnelle
- [ ] FreeActivitySheet enregistre activité libre dans `client_activity_logs`
- [ ] i18n FR/EN/ES complet sur toutes les nouvelles chaînes
- [ ] DS v3.0 strict : `#0d0d0d` bg, `#161616` surfaces, `#ffe01e` accent, radius rules, no shadows colorées
- [ ] `npx tsc --noEmit` 0 erreur sur les fichiers du scope
- [ ] CHANGELOG.md mis à jour
- [ ] `.claude/rules/project-state.md` mis à jour
