# Smart Agenda — Design Spec
**Date:** 2026-05-06  
**Phase:** Phase 1 (client-side) + Phase 2 (coach-side annotations)  
**Status:** Approved for implementation

---

## Vision

Smart Agenda = source de vérité du suivi coach/client. Tous les événements (repas, check-ins, séances, bilans, annotations coach) centralisés dans une vue chronologique type iOS Calendrier. Point d'entrée principal du suivi quotidien côté client.

---

## Scope Phase 1 (ce spec)

- Smart Agenda client (`/client/agenda`) — vue jour + semaine
- Ajout repas avec IA async (texte/vocal + photos → GPT-4o → macros)
- Bouton `+` BottomNav avec sous-menu (Repas / Check-in)
- Page nutrition mise à jour live (protocole vs consommé)
- Bouton "Smart Agenda" dans TopBar accueil

**Phase 2 (spec séparé) :** Annotations coach + notification accueil + Smart Agenda côté coach (onglet Data & Analyse)

---

## Data Model

### `meal_logs` — enrichissement (table déjà existante)

Colonnes à ajouter :
```sql
transcript        TEXT          -- saisie texte ou retranscription vocale brute
photo_urls        TEXT[]        -- URLs Supabase Storage bucket "meal-photos"
ai_status         TEXT          -- CHECK ('pending', 'done', 'failed'), DEFAULT 'pending'
```

Colonnes déjà présentes (à conserver) :
```
id, client_id, name, logged_at, photo_url (legacy single), quality_rating,
notes, estimated_macros JSONB
```

### `smart_agenda_events` — nouvelle table centrale

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
client_id       UUID NOT NULL REFERENCES coach_clients(id)
event_type      TEXT NOT NULL CHECK ('meal', 'checkin', 'session', 'assessment')
event_date      DATE NOT NULL
event_time      TIME
source_id       UUID   -- FK vers meal_logs.id, client_session_logs.id, etc.
title           TEXT
summary         TEXT
data            JSONB  -- snapshot dénormalisé (macros, score humeur, etc.)
created_at      TIMESTAMPTZ DEFAULT now()
```

Index : `(client_id, event_date DESC)`, `(client_id, event_type, event_date)`

**Peuplement :** INSERT dans `smart_agenda_events` à chaque création d'entité source (repas, check-in complété, séance complétée, bilan complété). Pas de triggers DB — peuplement applicatif dans les API routes.

### `coach_agenda_annotations` — nouvelle table (Phase 2)

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
coach_id    UUID NOT NULL
client_id   UUID NOT NULL REFERENCES coach_clients(id)
event_id    UUID NOT NULL REFERENCES smart_agenda_events(id)
note        TEXT NOT NULL
created_at  TIMESTAMPTZ DEFAULT now()
read_at     TIMESTAMPTZ  -- NULL = non lu par le client
```

---

## RLS

`smart_agenda_events` :
- Coach : `EXISTS (SELECT 1 FROM coach_clients cc WHERE cc.id = event.client_id AND cc.coach_id = auth.uid())`
- Client : `EXISTS (SELECT 1 FROM coach_clients cc WHERE cc.id = event.client_id AND cc.user_id = auth.uid())`

`meal_logs` : policies déjà définies dans `20260506_rls_fix_all_tables.sql` (coach + client).

---

## Architecture & Flow

### Inngest job : `meal/analyze.requested`

```
1. POST /api/client/meals
   → INSERT meal_logs (ai_status='pending', transcript, photo_urls)
   → INSERT smart_agenda_events (event_type='meal', source_id=meal.id)
   → inngest.send({ name: 'meal/analyze.requested', data: { mealLogId } })
   → 201 immédiat

2. Job Inngest (lib/inngest/functions/meal-analyze.ts)
   → fetch meal_log (transcript + photo_urls)
   → GPT-4o Vision : transcript + jusqu'à 3 photos → macros structurées
   → PATCH meal_logs SET estimated_macros, ai_status='done'
   → PATCH smart_agenda_events SET data (macros snapshot)

3. Client poll GET /api/client/meals/[id] toutes 2s (max 30s)
   → quand ai_status='done', affiche macros
```

### Routes API

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/client/meals?date=YYYY-MM-DD` | Repas du jour |
| POST | `/api/client/meals` | Créer repas (déclenche Inngest) |
| GET | `/api/client/meals/[id]` | Poll status IA |
| GET | `/api/client/agenda?date=YYYY-MM-DD` | Tous events du jour |
| GET | `/api/client/agenda/week?start=YYYY-MM-DD` | 7 jours vue semaine |
| GET | `/api/client/nutrition/today-progress` | Macros consommées vs protocole |

---

## Composants & Pages

### `/client/agenda` — Smart Agenda

**Structure :**
```
ClientTopBar (section="Suivi", title="Smart Agenda")
  [Jour] [Semaine]  ← toggle pills DS v2.0

Vue Jour :
  ← Mer 6 mai →    ← navigation date
  [barre macros du jour si protocole actif]
  Timeline chronologique :
    09:00  [🍽 Petit-déjeuner] card
    10:30  [☀️ Check-in matin] card
    12:15  [🍽 Déjeuner] card
    18:00  [💪 Séance Push A] card
    20:00  [🍽 Collation soir] card

Vue Semaine :
  L  M  M  J  V  S  D   ← pills, actif = accent vert
  [barres densité sous chaque jour]
  [liste chronologique du jour sélectionné]
```

**Cards par type (DS v2.0) :**

Repas (`bg-white/[0.02]`, icône `#1f8a65`) :
- Nom repas + heure
- Macros P/G/L si `ai_status='done'`, sinon badge "Analyse en cours..." (pulse)
- Miniatures photos si présentes

Check-in (`bg-white/[0.02]`, icône bleu/violet selon moment) :
- "Check-in matin" / "Check-in soir" + heure
- Score humeur si renseigné (étoiles ou valeur)

Séance (`bg-white/[0.02]`, icône amber) :
- Nom séance + durée
- Nb exercices / sets complétés

Bilan (`bg-white/[0.02]`, icône blanc) :
- Nom template bilan

Annotation coach (Phase 2, `border-[0.3px] border-[#1f8a65]/30`) :
- Badge "Note coach" + texte note
- Badge "Nouveau" si `read_at IS NULL`

### `/client/agenda/meals/new` — Ajout repas

```
ClientTopBar (title="Nouveau repas")

Heure              [10:30 ▾]  ← modifiable

[Zone texte — "Décrivez ce que vous mangez..."]
  placeholder: "Ex: 250ml lait écrémé, 40g flocons avoine..."
  + bouton micro (Web Speech API, toggle recording)

[Photos] — grid 3 slots, upload Supabase Storage "meal-photos"

[Enregistrer →]  ← bouton CTA vert DS v2.0
```

Après submit : redirect `/client/agenda` avec date du jour sélectionnée.

### BottomNav `+` menu

Slide-up modal over BottomNav (z-50, Framer Motion) :
```
┌─────────────────────────────┐
│  🍽  Ajouter un repas        │
│  ✓   Check-in               │
└─────────────────────────────┘
```
- "Ajouter un repas" → `/client/agenda/meals/new`
- "Check-in" → `/client/checkin/matin` ou `/client/checkin/soir` selon heure (avant 14h = matin, sinon soir)
- Fermeture : clic overlay ou swipe down

### Page `/client/nutrition` — mise à jour

Ajouter section "Aujourd'hui" en haut (avant le protocole) :
```
Aujourd'hui
[barre macros consommées vs objectif protocole]
P: 120/180g  G: 200/250g  L: 55/70g   Calories: 1840/2200
```
Fetch depuis `/api/client/nutrition/today-progress`.
Si aucun protocole actif : section masquée.

### TopBar page d'accueil

Ajouter bouton "Smart Agenda" (secondaire DS v2.0, icône `CalendarDays`) dans le TopBarRight de la home client, à côté des boutons existants.

---

## Inngest — nouveau job

**Fichier :** `lib/inngest/functions/meal-analyze.ts`

```typescript
inngest.createFunction(
  { id: 'meal-analyze', retries: 3, timeouts: { finish: '2m' } },
  { event: 'meal/analyze.requested' },
  async ({ event, step }) => {
    const { mealLogId } = event.data
    await step.run('analyze-meal', async () => {
      // fetch meal_log (transcript + photo_urls)
      // GPT-4o Vision avec transcript + images
      // parse macros structurées (calories, protein_g, carbs_g, fat_g, fiber_g)
      // PATCH meal_logs + smart_agenda_events
    })
  }
)
```

Prompt GPT-4o : analyse transcript textuel + photos → retourne JSON structuré macros. `response_format: { type: 'json_object' }`.

Enregistrer dans `app/api/inngest/route.ts`.

---

## Points de Vigilance

- `smart_agenda_events` peuplé applicativement (pas triggers) — si API route échoue après INSERT source, event manquant. Acceptable Phase 1 (réconciliation possible via batch job Phase 2).
- Web Speech API : pas disponible sur tous les browsers. Fallback silencieux (bouton micro masqué si `!('webkitSpeechRecognition' in window)`).
- Poll 2s max 30s pour macros IA — si job Inngest dépasse 30s (réseau lent), afficher "Analyse en cours" permanent avec lien "Actualiser" manuel.
- `meal-photos` bucket Supabase Storage à créer manuellement (comme `morpho-photos`).
- Check-in routing (matin/soir) basé sur heure locale client — edge case minuit/tôt le matin acceptable Phase 1.
- BottomNav `+` menu : z-index 60 (au-dessus BottomNav z-50), overlay z-50.

---

## Fichiers à créer / modifier

**Nouveaux :**
- `supabase/migrations/YYYYMMDD_smart_agenda.sql`
- `app/client/agenda/page.tsx`
- `app/client/agenda/meals/new/page.tsx`
- `app/api/client/meals/route.ts`
- `app/api/client/meals/[id]/route.ts`
- `app/api/client/agenda/route.ts`
- `app/api/client/agenda/week/route.ts`
- `app/api/client/nutrition/today-progress/route.ts`
- `lib/inngest/functions/meal-analyze.ts`
- `components/client/AgendaDayView.tsx`
- `components/client/AgendaWeekView.tsx`
- `components/client/AgendaEventCard.tsx`
- `components/client/AddMealPage.tsx`
- `components/client/BottomNavPlusMenu.tsx`

**Modifiés :**
- `components/client/BottomNav.tsx` — ajouter bouton `+` avec menu
- `app/client/nutrition/page.tsx` — section macros du jour
- `app/client/page.tsx` (home) — bouton Smart Agenda TopBar
- `app/api/inngest/route.ts` — enregistrer `mealAnalyzeFunction`
