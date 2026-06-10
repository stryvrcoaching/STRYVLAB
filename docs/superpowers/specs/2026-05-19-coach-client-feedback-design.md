# Coach ↔ Client Feedback — Design Spec

**Date :** 2026-05-19
**Objectif :** Annotations contextuelles coach → client sur toutes les entités du système (sessions, exercices, sets, check-ins, morpho, bilans), avec réaction emoji + réponse texte optionnelle côté client. Hub centralisé sur la fiche client + accès inline sur chaque entité.
**Stack :** Next.js App Router, Supabase, TypeScript strict, DS v2.0 coach + DS v3.0 client

---

## Contexte

Actuellement, `coach_client_notifications` permet des messages one-way système → client (type `coach_note`, `program_assigned`, etc.). Il n'existe pas d'annotations contextuelles liées à une entité précise (set, séance, check-in...), ni de mécanisme de réponse client. Le coach ne peut pas commenter "Augmente le poids sur le curl SET 3" directement sur la donnée concernée.

---

## Section 1 — Architecture

**Flow complet :**
```
Coach voit données client → bouton "+" inline → FeedbackComposer bottom sheet → saisit annotation
  → POST /api/clients/[clientId]/feedback
  → INSERT coach_feedback
  → INSERT coach_client_notifications (type='coach_feedback', payload={feedback_id, entity_type, entity_id, entity_label})
  → Client voit notif → tape → navigue vers entité → FeedbackThread visible in-context
  → Client choisit emoji + réponse optionnelle → POST /api/client/feedback/[feedbackId]/reactions
  → INSERT coach_feedback_reactions
  → INSERT coach_client_notifications (type='client_reaction', coach_id=..., payload={feedback_id, client_name, emoji})
  → Coach voit notif → hub Feedback sur fiche client
```

**Livraison :** polling existant 30s sur `/api/client/notifications`. Aucun WebSocket.

---

## Section 2 — Data Model

**`coach_feedback`**
```sql
CREATE TABLE coach_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('session','exercise','set','checkin','morpho','bilan')),
  entity_id    uuid NOT NULL,
  body         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_feedback_client ON coach_feedback (client_id, created_at DESC);
CREATE INDEX idx_coach_feedback_entity ON coach_feedback (entity_type, entity_id);
```

**`coach_feedback_reactions`**
```sql
CREATE TABLE coach_feedback_reactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id  uuid NOT NULL REFERENCES coach_feedback(id) ON DELETE CASCADE,
  author_type  text NOT NULL CHECK (author_type IN ('client','coach')),
  author_id    uuid NOT NULL,
  emoji        text NOT NULL CHECK (emoji IN ('👍','💪','✅','🔥','❓')),
  reply_text   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_reactions_feedback ON coach_feedback_reactions (feedback_id, created_at ASC);
```

**RLS :**

`coach_feedback` :
- Coach : SELECT/INSERT/DELETE où `coach_id = auth.uid()` ET ownership via `coach_clients.coach_id`
- Client : SELECT où `client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())`

`coach_feedback_reactions` :
- Coach : SELECT/INSERT où feedback appartient à son client
- Client : SELECT/INSERT où `feedback_id IN (SELECT id FROM coach_feedback WHERE client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid()))`

**Extension `coach_client_notifications`** — 2 nouveaux types ajoutés à la contrainte CHECK :
- `'coach_feedback'` — coach a annoté une entité → notif client
- `'client_reaction'` — client a réagi → notif coach (via `coach_id` column)

---

## Section 3 — API Routes

### Coach routes

**`GET /api/clients/[clientId]/feedback`**
- Auth : coach ownership check
- Query params : `?entity_type=session&entity_id=xxx` (optionnel, filtre)
- Returns : `FeedbackWithReactions[]` — liste annotations + réactions, order `created_at DESC`, limit 50

**`POST /api/clients/[clientId]/feedback`**
- Auth : coach ownership check
- Body : `{ entity_type, entity_id, body, entity_label? }` (label = nom affiché, ex: "Séance du 19 mai")
- Actions : INSERT coach_feedback + INSERT coach_client_notifications (type='coach_feedback')
- Returns : le feedback créé

**`POST /api/clients/[clientId]/feedback/[feedbackId]/reactions`**
- Auth : coach ownership check (coach peut aussi réagir — réponse à la réaction client)
- Body : `{ emoji, reply_text? }`
- Returns : réaction créée

### Client routes

**`GET /api/client/feedback`**
- Auth : client connecté
- Returns : tous les `coach_feedback` du client avec réactions, order `created_at DESC`, limit 50

**`GET /api/client/feedback/[entityType]/[entityId]`**
- Auth : client connecté
- Returns : annotations pour une entité précise avec réactions

**`POST /api/client/feedback/[feedbackId]/reactions`**
- Auth : client connecté — vérifie que le feedback appartient à ce client
- Body : `{ emoji, reply_text? }`
- Actions : INSERT coach_feedback_reactions (author_type='client') + INSERT coach_client_notifications (type='client_reaction', coach_id=feedback.coach_id)
- Returns : réaction créée

---

## Section 4 — Types partagés

```typescript
// lib/feedback/types.ts
export interface CoachFeedback {
  id: string
  coach_id: string
  client_id: string
  entity_type: 'session' | 'exercise' | 'set' | 'checkin' | 'morpho' | 'bilan'
  entity_id: string
  body: string
  created_at: string
  reactions: FeedbackReaction[]
}

export interface FeedbackReaction {
  id: string
  feedback_id: string
  author_type: 'client' | 'coach'
  author_id: string
  emoji: '👍' | '💪' | '✅' | '🔥' | '❓'
  reply_text: string | null
  created_at: string
}

export const FEEDBACK_EMOJIS = ['👍', '💪', '✅', '🔥', '❓'] as const
export type FeedbackEmoji = typeof FEEDBACK_EMOJIS[number]
```

---

## Section 5 — Composants Coach

### `components/coach/FeedbackComposer.tsx`

Bottom sheet DS v2.0 — déclenché inline sur chaque entité.

**Props :**
```typescript
interface FeedbackComposerProps {
  open: boolean
  clientId: string
  entityType: CoachFeedback['entity_type']
  entityId: string
  entityLabel: string  // ex: "Séance du 19 mai", "Curl biceps SET 3"
  onClose: () => void
  onSent: () => void
}
```

**Layout :**
```
[drag handle pill]
"Commentaire — {entityLabel}"    [X]

[textarea — 3 lignes, placeholder "Écris ton retour..."]

                         [Envoyer →]
```

DS v2.0 : `bg-[#181818]`, `rounded-t-2xl`, `border-t border-white/[0.06]`
Bouton Envoyer : `bg-[#1f8a65]`, `rounded-xl`, `h-11`
POST `/api/clients/{clientId}/feedback` → `onSent()` → ferme

### `app/coach/clients/[clientId]/feedback/page.tsx`

Hub centralisé — nouvel onglet "Feedback" sur la fiche client.

**Layout :**
```
[Filtres pills : Tout | Sessions | Exercices | Check-ins | Morpho | Bilans]

[Liste chronologique]
┌─────────────────────────────────────────────────┐
│ 🏋️ Séance du 19 mai                   il y a 2h │
│ "Bonne progression sur les squats..."            │
│                                                  │
│ Client : 💪  "Merci, je sentais que c'était bon" │
└─────────────────────────────────────────────────┘
```

Badges entité : 🏋️ session / 💪 exercise+set / 📊 checkin / 📷 morpho / 📋 bilan
DS v2.0 : cartes `bg-white/[0.02]`, `border-[0.3px] border-white/[0.06]`, `rounded-xl`

**Bouton inline sur entités coach :**
- `components/clients/SessionRecapCard.tsx` (si existant) → bouton `MessageSquare` size 14
- `components/clients/MorphoAnalysisSection.tsx` → bouton par analyse
- Toujours : `h-7 w-7 rounded-lg bg-white/[0.04] text-white/40 hover:text-white/70`

---

## Section 6 — Composants Client

### `components/client/smart/FeedbackThread.tsx`

Composant affiché sur les pages client quand des annotations existent pour l'entité courante.

**Props :**
```typescript
interface FeedbackThreadProps {
  entityType: CoachFeedback['entity_type']
  entityId: string
  clientId: string
}
```

**Behavior :**
- Fetch `GET /api/client/feedback/[entityType]/[entityId]` au mount
- Si 0 feedbacks → render nothing
- Si feedbacks → affiche les cartes

**Layout carte (DS v3.0) :**
```
┌────────────────────────────────────────────────┐
│ 💬  Coach                            il y a 2h │
│ "Augmente le poids sur le curl SET 3 semaine   │
│  prochaine — tu as encore de la marge."        │
│                                                │
│ [👍] [💪] [✅] [🔥] [❓]                      │
│                                                │
│ [Répondre...] (textarea, optionnel)  [Envoyer] │
│                                                │
│ Toi · 💪 · "Merci coach !"            il y a 1h │
└────────────────────────────────────────────────┘
```

DS v3.0 :
- Card : `bg-[#161616] border border-white/[0.08] rounded-2xl p-4`
- Emoji buttons : `h-9 w-9 rounded-xl bg-white/[0.06] text-[18px]`
- Sélectionné : `bg-[#ffe01e]/[0.12] border border-[#ffe01e]/30`
- Réponse coach sous la réaction client : `bg-white/[0.03] rounded-xl p-2 text-[11px]`
- Textarea : `bg-white/[0.04] border border-white/[0.06] rounded-xl`

**Intégrations pages client :**
- `app/client/programme/session/[sessionId]/recap/[sessionLogId]/page.tsx` — FeedbackThread entity_type='session', entity_id=sessionLogId
- `app/client/bilans/[submissionId]/page.tsx` — FeedbackThread entity_type='bilan', entity_id=submissionId
- `app/client/checkin/` (page récap check-in si existante) — FeedbackThread entity_type='checkin'
- Morpho : dans la section MorphoPro client si accessible

### NotificationsBar — nouveaux types

`type: "coach_feedback"` → icône `MessageSquare`, navigate vers entité via `payload.entity_type` + `payload.entity_id`
`type: "client_reaction"` → icône `MessageSquare` (côté coach, dans dashboard coach)

Navigation `coach_feedback` :
```typescript
if (n.type === "coach_feedback") {
  const { entity_type, entity_id } = n.payload
  // session → /client/programme/session/recap/{entity_id}
  // bilan   → /client/bilans/{entity_id}
  // checkin → /client/checkin
  // morpho  → /client/profil (section morpho)
  // exercise/set → /client/programme (session en cours si active, sinon recap)
}
```

---

## Section 7 — Fichiers & périmètre

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260519_coach_feedback.sql` | Créer |
| `lib/feedback/types.ts` | Créer |
| `app/api/clients/[clientId]/feedback/route.ts` | Créer |
| `app/api/clients/[clientId]/feedback/[feedbackId]/reactions/route.ts` | Créer |
| `app/api/client/feedback/route.ts` | Créer |
| `app/api/client/feedback/[entityType]/[entityId]/route.ts` | Créer |
| `app/api/client/feedback/[feedbackId]/reactions/route.ts` | Créer |
| `components/coach/FeedbackComposer.tsx` | Créer |
| `app/coach/clients/[clientId]/feedback/page.tsx` | Créer |
| `components/client/smart/FeedbackThread.tsx` | Créer |
| `components/clients/MorphoAnalysisSection.tsx` | Modifier — bouton FeedbackComposer inline |
| `app/client/programme/session/[sessionId]/recap/[sessionLogId]/page.tsx` | Modifier — intégrer FeedbackThread |
| `app/client/bilans/[submissionId]/page.tsx` | Modifier — intégrer FeedbackThread |
| `components/client/smart/NotificationsBar.tsx` | Modifier — types coach_feedback + client_reaction |
| `supabase/migrations/20260517_coach_client_notifications.sql` | NE PAS modifier — nouveau type ajouté via ALTER dans la nouvelle migration |

**Inchangés :**
- `coach_client_notifications` table structure (hors CHECK constraint étendue)
- SessionLogger client (séance en cours) — pas d'annotation mid-session
- Tout le reste

---

## Contraintes non-négociables

- `lib/feedback/types.ts` : zéro import DB — types purs
- RLS strict : coach ne voit que ses clients, client ne voit que ses feedbacks
- Pas de Supabase Realtime — polling 30s existant suffit
- DS v2.0 strict coach, DS v3.0 strict client
- TypeScript strict — 0 erreurs `npx tsc --noEmit`
- CHANGELOG.md mis à jour après chaque changement
- `coach_client_notifications.type` CHECK constraint étendue via ALTER TABLE dans la migration (pas de modification de la migration existante)
