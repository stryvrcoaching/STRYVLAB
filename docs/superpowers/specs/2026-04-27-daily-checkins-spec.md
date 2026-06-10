# Daily Check-ins — Spec Phase 2

> Spec finalisée le 2026-04-28 via session brainstorming.
> Feature à implémenter après l'onboarding client (Phase 2).
> Scope : check-ins bien-être (matin/soir) + journal alimentaire simple + gamification.
> Le Journal Nutritionnel IA (log repas via photo/vocal + analyse macros temps réel) fait l'objet d'une spec séparée.

---

## Vision

Le coach active des rappels quotidiens paramétrés pour collecter des données de bien-être client à deux moments de la journée (matin et soir). Le client configure ses horaires pendant l'onboarding. Un journal alimentaire journalier (vue agenda) permet de logger les repas manuellement. Un système de gamification (points, niveaux, streaks) encourage la régularité.

---

## Acteurs

- **Coach** : active la feature par client, sélectionne les données à collecter, choisit les jours de la semaine actifs, consulte les analytics (synthèse + drill-down)
- **Client** : configure ses horaires de rappel pendant l'onboarding, répond aux check-ins via notification push, logue ses repas depuis l'agenda journalier

---

## Moments de la journée

| Moment | Données collectées (coach sélectionne) |
|--------|----------------------------------------|
| Matin (réveil) | Durée du sommeil (h), Qualité du sommeil (1-5), Niveau d'énergie (1-5) |
| Soir (coucher) | Niveau d'énergie fin de journée (1-5), Stress (1-5), Humeur (1-5) |

Le moment "Repas" est un journal alimentaire libre (pas de rappel fixe) — le client logue ses repas quand il mange. Champs fixes : photo (optionnel), nom du repas, qualité estimée (1-5), notes libres, heure réelle.

Le coach peut activer un ou plusieurs moments et sélectionner les champs de chaque moment. Il peut aussi restreindre les check-ins à certains jours de la semaine (ex : jours d'entraînement uniquement).

---

## Gamification

### Points

| Action | Points |
|--------|--------|
| Check-in complété (avant minuit) | +10 pts |
| Check-in tardif (entre 00h00 et 02h00 du lendemain) | +5 pts (streak préservé) |
| Séance complétée | +25 pts |
| Bilan complété | +20 pts |
| Repas loggué | +3 pts |

### Niveaux

| Niveau | Seuil | Badge couleur |
|--------|-------|---------------|
| Bronze | 0 – 99 pts | Ambre |
| Argent | 100 – 299 pts | Gris clair |
| Or | 300 – 699 pts | Jaune doré |
| Platine | 700+ pts | Cyan |

### Streaks

- **Streak courant** : nombre de jours consécutifs avec au moins un check-in complété
- **Record streak** : meilleur streak historique du client
- **Règle strict** : 1 jour sans check-in = streak remis à 0
- **Grace period** : soumission entre 00h00 et 02h00 préserve le streak mais vaut +5 pts (au lieu de +10)
- Le streak n'est évalué que sur les jours où le coach a activé les check-ins (jours configurés dans `days_of_week`)

---

## Schéma DB

Six tables, toutes avec RLS multi-tenant. À créer via migration Prisma.

### `daily_checkin_configs`
Configuration coach par client.

```sql
id              UUID PK
coach_id        UUID → auth.users(id)
client_id       UUID → coach_clients(id)
is_active       BOOLEAN DEFAULT false
days_of_week    INT[]  -- 0=lundi … 6=dimanche
moments         JSONB  -- [{moment: 'morning', fields: ['sleep_duration', 'sleep_quality', 'energy']}]
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
UNIQUE (coach_id, client_id)
```

### `daily_checkin_schedules`
Horaires configurés par le client (onboarding + profil).

```sql
id              UUID PK
client_id       UUID → coach_clients(id)
moment          TEXT CHECK (moment IN ('morning', 'evening'))
scheduled_time  TIME   -- ex: 07:30
timezone        TEXT   -- ex: 'Europe/Paris'
created_at      TIMESTAMPTZ DEFAULT now()
UNIQUE (client_id, moment)
```

### `daily_checkin_responses`
Réponses aux check-ins matin/soir.

```sql
id              UUID PK
client_id       UUID → coach_clients(id)
config_id       UUID → daily_checkin_configs(id)
moment          TEXT CHECK (moment IN ('morning', 'evening'))
responses       JSONB  -- {sleep_duration: 7.5, sleep_quality: 4, energy: 3}
responded_at    TIMESTAMPTZ DEFAULT now()
is_late         BOOLEAN DEFAULT false  -- true si soumis entre 00h00 et 02h00
```

### `meal_logs`
Journal alimentaire journalier (agenda repas).

```sql
id              UUID PK
client_id       UUID → coach_clients(id)
logged_at       TIMESTAMPTZ  -- heure réelle du repas (modifiable par le client)
name            TEXT
photo_url       TEXT NULL    -- Supabase Storage, route API authentifiée
quality_rating  INT CHECK (quality_rating BETWEEN 1 AND 5) NULL
notes           TEXT NULL
estimated_macros JSONB NULL  -- réservé pour Journal Nutritionnel IA (spec séparée)
created_at      TIMESTAMPTZ DEFAULT now()
```

### `client_points`
Historique des points gagnés.

```sql
id              UUID PK
client_id       UUID → coach_clients(id)
action_type     TEXT CHECK (action_type IN ('checkin', 'checkin_late', 'session', 'bilan', 'meal'))
points          INT
reference_id    UUID NULL    -- ID de la réponse/session/bilan/repas associé
earned_at       TIMESTAMPTZ DEFAULT now()
```

### `client_streaks`
État streak et niveau par client.

```sql
id              UUID PK
client_id       UUID → coach_clients(id) UNIQUE
current_streak  INT DEFAULT 0
longest_streak  INT DEFAULT 0
last_checkin_date DATE NULL
level           TEXT CHECK (level IN ('bronze', 'silver', 'gold', 'platinum')) DEFAULT 'bronze'
total_points    INT DEFAULT 0   -- dénormalisé pour éviter SUM() à chaque rendu
updated_at      TIMESTAMPTZ DEFAULT now()
```

### RLS

- Coach : CRUD sur `daily_checkin_configs` + SELECT sur toutes les tables de ses clients (via `coach_clients.coach_id`)
- Client : SELECT/INSERT sur ses propres lignes (via `coach_clients.user_id`)

---

## API Routes

### Coach

```
GET  /api/clients/[clientId]/checkin-config         — lire config active
POST /api/clients/[clientId]/checkin-config         — créer/mettre à jour config (moments + jours)
GET  /api/clients/[clientId]/checkin-summary        — moyennes 30j par champ (dashboard synthèse)
GET  /api/clients/[clientId]/checkin-history        — réponses paginées par date (drill-down)
GET  /api/clients/[clientId]/meal-logs              — journal repas du client (paginé par date)
```

### Client

```
GET  /api/client/checkin/today                      — check-ins du jour + statut (répondu/en attente)
POST /api/client/checkin/respond                    — soumettre réponses (matin ou soir)
GET  /api/client/checkin/schedule                   — lire ses horaires configurés
POST /api/client/checkin/schedule                   — sauvegarder horaires (onboarding + profil)
GET  /api/client/meals                              — repas du jour (vue agenda, filtre par date)
POST /api/client/meals                              — ajouter un repas
DELETE /api/client/meals/[mealId]                   — supprimer un repas
GET  /api/client/points                             — total points + streak + niveau + historique
```

Toutes les routes valident l'ownership via Supabase session. Validation Zod sur tous les inputs. Gestion d'erreur explicite (pas de try/catch vide).

---

## Jobs Inngest

| Event | Job | Déclencheur |
|-------|-----|-------------|
| `checkin/reminder.send` | Envoie Web Push au client | Cron toutes les minutes — filtre schedules dont `scheduled_time` correspond à l'heure courante ±1 min |
| `checkin/streak.evaluate` | Calcule streak + attribue points | Trigger sur POST `/api/client/checkin/respond` |
| `checkin/streak.expire` | Remet streak à 0 si aucune réponse | Cron quotidien à 02h00 UTC |
| `points/level.update` | Met à jour le niveau dans `client_streaks` | Trigger sur INSERT `client_points` |

Le job `checkin/reminder.send` respecte le timezone du client (colonne `daily_checkin_schedules.timezone`).

---

## Notifications Push (Web Push)

Nécessite VAPID keys (à configurer en variables d'environnement) :

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:stryv.revolution@gmail.com
```

Token push stocké dans une colonne `push_token TEXT NULL` à ajouter sur `coach_clients` (ou table dédiée `client_push_tokens` si multi-device en Phase 3).

Payload de la notification :
```json
{
  "title": "Check-in du matin",
  "body": "Comment s'est passée ta nuit ?",
  "url": "/client/checkin/morning"
}
```

Le client doit avoir installé la PWA et accordé la permission push. Un guide d'installation est intégré dans l'onboarding (voir section UI Client).

---

## UI Coach

### Onglet "Check-ins" dans `/coach/clients/[clientId]/`

**Config panel (partie haute) :**
- Toggle `is_active` — active/désactive les check-ins pour ce client
- Sélecteur jours de la semaine — 7 pills cliquables L M M J V S D
- Accordéons par moment :
  - **Matin** — toggle activer + checkboxes champs (Sommeil durée, Qualité sommeil, Énergie)
  - **Soir** — toggle activer + checkboxes champs (Énergie, Stress, Humeur)
  - **Repas** — toggle activer (journal alimentaire — champs fixes, pas de sélection)
- Bouton "Sauvegarder" → POST `/api/clients/[clientId]/checkin-config`

**Vue analytics (partie basse) :**

*Dashboard synthèse (défaut) :*
- 4 stat cards : streak actuel, points total, niveau (badge), taux de réponse % sur 30j
- Graphiques lignes 30 jours : énergie matin / qualité sommeil / stress soir (Recharts LineChart, style MetricsSection)
- Calendrier heatmap mensuel : vert = check-in complet, amber = tardif, rouge = manqué, gris = jour non configuré

*Drill-down par jour (clic cellule calendrier) :*
- Panel slide-in droit (pattern `ParameterAdjustmentPanel` du Nutrition Studio)
- Détail réponses du jour : sliders read-only, photos repas miniatures, notes
- Liste des repas loggués avec heure et qualité
- Bouton retour au calendrier

---

## UI Client

### Onboarding — étape conditionnelle

Déclenchée si `daily_checkin_config.is_active === true` pour ce client.

S'insère entre l'écran 5 (hub dashboard) et le CTA final, en 3 sous-écrans :

**Sous-écran 1 — "Tes rappels quotidiens"**
- Explication de la feature + liste des moments activés par le coach
- Bouton "Suivant"

**Sous-écran 2 — "Installe l'application"**
- Explication du pourquoi (notifications push nécessitent PWA installée)
- Instructions iOS : Safari → icône Partager → "Sur l'écran d'accueil"
- Instructions Android : Chrome → menu ⋮ → "Installer l'application"
- Illustrations simples (icons flèches)
- Bouton "C'est fait, continuer"

**Sous-écran 3 — "Configure tes horaires"**
- Time picker par moment activé (matin / soir)
- Bouton "Activer mes rappels" → demande permission Web Push → sauvegarde `daily_checkin_schedules`
- Si permission refusée : message explicatif + option "Configurer plus tard" (accessible depuis profil)

### Dashboard client — widget

Sur `/client` (home) :
- Card "Check-in du matin — À compléter" si check-in du jour non répondu et heure ≥ scheduled_time
- Disparaît après soumission
- Lien direct → `/client/checkin/morning` ou `/client/checkin/evening`

### Page check-in `/client/checkin/[moment]`

- Header : label moment (Matin / Soir) + date du jour
- Questions présentées une par une avec transition slide entre chaque
- Sliders 1-5 stylisés DS v2.0 (pas les sliders natifs HTML)
- Animation de confirmation après la dernière question : points gagnés (+10 ou +5 si tardif) avec micro-animation Framer Motion
- Retour automatique au dashboard après 2 secondes

### Agenda repas `/client/checkin/meals`

- Vue timeline verticale journalière par heure
- Navigation entre les jours (flèches gauche/droite + date picker)
- Chaque repas = card avec heure, photo thumbnail (si présente), nom, badge qualité
- Bouton flottant "+ Ajouter un repas" → bottom sheet :
  - Upload photo (optionnel) → route API authentifiée → Supabase Storage
  - Nom du repas (input texte)
  - Qualité estimée (slider 1-5, optionnel)
  - Notes libres (textarea, optionnel)
  - Heure : pré-remplie avec l'heure actuelle, modifiable via time picker
- Swipe gauche sur une card repas → bouton supprimer (confirmation inline)
- Accessible depuis BottomNav (icône `UtensilsCrossed`) + widget dashboard

### Profil client `/client/profil`

Nouvelle section "Ma progression" :
- Badge niveau avec icône colorée (Bronze/Argent/Or/Platine)
- Compteur points total + streak actuel + record streak
- Historique 10 dernières actions ("+10 check-in matin", "+25 séance", etc.)
- Bouton "Configurer mes rappels" → redirige vers la config horaires

---

## Contraintes

- Aucune donnée collectée sans consentement explicite (opt-in dans l'onboarding + permission Web Push)
- Photos repas → route API authentifiée + Supabase Storage (bucket privé)
- Données accessibles au coach via son dashboard client uniquement
- RLS sur toutes les nouvelles tables
- Zero TypeScript errors (`npx tsc --noEmit` obligatoire)
- Streak évalué uniquement sur les jours configurés dans `days_of_week`
- `estimated_macros` dans `meal_logs` réservé (null en Phase 2) — sera utilisé par le Journal Nutritionnel IA

---

## Next Steps — Implémentation Phase 2

- [ ] Schema DB + migration Prisma (6 tables + colonne `push_token` sur `coach_clients`)
- [ ] Seeds si nécessaire (aucune donnée de référence requise)
- [ ] Service layer : `lib/checkins/` (streak evaluation, points attribution, level update)
- [ ] API routes coach (config + analytics)
- [ ] API routes client (respond + schedule + meals + points)
- [ ] Jobs Inngest (reminder.send, streak.evaluate, streak.expire, level.update)
- [ ] Configuration VAPID keys (Vercel env vars)
- [ ] UI Coach : onglet Check-ins (config + analytics + drill-down)
- [ ] UI Client : étape onboarding conditionnelle (3 sous-écrans + guide PWA)
- [ ] UI Client : page `/client/checkin/[moment]`
- [ ] UI Client : agenda repas `/client/checkin/meals` + BottomNav entry
- [ ] UI Client : widget dashboard "Check-in à compléter"
- [ ] UI Client : section points/niveau/streak dans `/client/profil`
- [ ] Tests unitaires : streak evaluation, points attribution
