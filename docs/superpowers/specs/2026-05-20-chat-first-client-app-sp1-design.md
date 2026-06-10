# Chat-First Client App — Sub-projet #1 : Chat Page + Navigation

**Date :** 2026-05-20
**Statut :** Approuvé
**Auteur :** Brainstorming session

---

## Vision

Remplacer le dashboard home (Smart Agenda) par une interface conversationnelle comme feature principale de l'app client. Le chat devient le point d'entrée unique : check-ins, logs, rappels, questions libres — tout passe par cet échange. Les pages Workout et Nutrition restent dédiées à leur fonction. Une nouvelle page Métriques remplace l'onglet Profil.

**4 sous-projets séquentiels :**

| # | Scope | Dépendances |
|---|-------|-------------|
| **#1** | Chat Page + Navigation (ce doc) | — |
| #2 | Scripted Flow Engine (check-ins, banque questions, flows coach) | #1 |
| #3 | Push Notifications + Inngest Scheduling | #2 |
| #4 | Metrics / Body Evolution Page | #1 |

---

## Sub-projet #1 — Scope

### Navigation (BottomNav)

4 onglets — suppression du radial FAB et de l'onglet Profil :

| Tab | Icône | Route | Remplace |
|-----|-------|-------|---------|
| Chat | MessageCircle | `/client` | Home (Smart Agenda) |
| Programme | Barbell | `/client/programme` | inchangé |
| Nutrition | ForkKnife | `/client/nutrition` | inchangé |
| Métriques | ChartLine | `/client/metrics` | Profil |

**Supprimés :**
- Radial FAB + actions (meal / water / activity / checkin) → tout passe par le chat
- `CoachAIButton` flottant (`components/client/CoachAIButton.tsx`)
- `CoachAIChatSheet` overlay (`components/client/CoachAIChatSheet.tsx`)
- Onglet Profil

---

### Chat Page (`/client`)

#### Layout

```
┌─────────────────────────────────┐
│  TODAY STRIP                    │  56px, shrink-0, scroll horizontal
│  [🏋 Séance pecs] [✓ Check-in] │  pills compactes depuis données live
│  [💧 1.2L / 2L] [🥗 1840 kcal] │  tap = deep link page concernée
├─────────────────────────────────┤
│                                 │
│  CONVERSATION                   │  flex-1, overflow-y-auto
│                                 │
│  [Bot] Bonjour Marc 👋          │
│  Comment s'est passée ta nuit ? │
│                                 │
│  [User] Bonne nuit, 7h30        │
│                                 │
│  [Bot] Super ! Niveau d'énergie │
│  ┌──────────────────────────┐   │
│  │ 😴  😐  🙂  😊  ⚡     │   │  quick-reply chips inline
│  └──────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│  INPUT BAR                      │  56px, shrink-0
│  [🎤] [Écrire un message...] [→]│
└─────────────────────────────────┘
```

#### Today Strip

Données chargées depuis `/api/client/chat/today-strip` :
- Séances du jour (depuis `program_sessions`) — pill cliquable → `/client/programme`
- Status check-in matin/soir (depuis `chat_sessions`) — pill ✓ ou à faire
- Eau loggée vs objectif (depuis `nutrition_entries` type eau)
- Calories loggées vs objectif (depuis `nutrition_entries`)

#### Bulles de conversation

- **Bot** : `bg-[#161616]`, texte `white/80`, `rounded-2xl rounded-tl-sm`
- **User** : `bg-[#ffe01e]`, texte `#0d0d0d`, `rounded-2xl rounded-tr-sm`
- **Avatar bot** : photo profil coach (`Coach.avatarUrl`) si disponible, sinon logo STRYVR — 28px, `rounded-full`
- **Interactive components** : inline dans les bulles bot (pas de modal) — voir sous-projet #2 pour les types

#### Input Bar

- Icône mic (Phosphor `Microphone`) → `VoiceLogSheet` réutilisé → transcript → message user → envoi auto
- Champ texte `placeholder="Écrire un message..."`
- Bouton envoi `ArrowRight`
- DS v3.0 : `bg-[#161616]`, border top `border-white/[0.06]`

#### Historique & Archives

- **Actif** : 3 derniers jours (`archived_at IS NULL`)
- **Archives** : accessibles via sélecteur date en haut de la conversation — query par `archived_at::date`
- Séparateurs visuels entre jours (`text-[10px] text-white/30 uppercase tracking-widest`)

---

### Page Métriques (`/client/metrics`)

Remplace `/client/profil`. Data source inchangée (`assessment_submissions + assessment_responses`).

#### Layout

```
TopBar : "MÉTRIQUES"  [⚙️ settings]
├── Hero : avatar 56px + nom + email + streak pill
├── Graphique poids SVG — sélecteur 7j / 30j / 90j
├── Cards composition : [MG%] [Masse maigre] [IMC]
├── Mensurations : grille (taille, hanches, bras, poitrine)
└── Historique bilans : liste soumissions → deep link
```

**Settings (⚙️ → bottom sheet) :** langue, déconnexion, notifications on/off (préfigure sous-projet #3).

---

### Data Model

#### `chat_messages`

```sql
CREATE TABLE chat_messages (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('user', 'assistant')),
  content       text NOT NULL,
  message_type  text NOT NULL DEFAULT 'text'
                CHECK (message_type IN ('text', 'quick_reply', 'slider', 'voice')),
  metadata      jsonb,          -- options chips, range, valeur choisie
  created_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz     -- NULL = actif ; SET par cron après 3 jours
);

CREATE INDEX ON chat_messages (client_id, created_at DESC);
CREATE INDEX ON chat_messages (client_id, archived_at);
```

RLS :
- Client SELECT / INSERT : `client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())`
- Coach SELECT : `client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())`

#### `chat_sessions`

```sql
CREATE TABLE chat_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  date          date NOT NULL,
  flow_type     text NOT NULL CHECK (flow_type IN ('morning', 'evening', 'freeform')),
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, date, flow_type)
);
```

---

### API Routes

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/client/chat/messages` | Messages actifs (3 jours, `archived_at IS NULL`) |
| POST | `/api/client/chat/messages` | Envoie message user → LLM (GPT-4o mini) → retourne réponse bot |
| GET | `/api/client/chat/archives` | `?date=YYYY-MM-DD` — messages archivés par date |
| GET | `/api/client/chat/today-strip` | Données today strip (sessions, check-in, macros, eau) |

**LLM config (chat/messages POST) :**
- Modèle : `gpt-4o-mini`
- `max_tokens` : 300
- System prompt : reprend `buildSystemPrompt` existant (profil + journée)
- Rate limit : 20 messages / jour / client (table `ai_coach_daily_usage` existante)
- System prompt jamais retourné au client browser

---

### Archivage — Inngest Cron

```typescript
// Quotidien 03:00 (heure physiologique — après minuit physiologique 04:00)
// Archive tous les messages de plus de 3 jours
UPDATE chat_messages
SET archived_at = now()
WHERE archived_at IS NULL
  AND created_at < now() - INTERVAL '3 days';
```

---

### Fichiers à créer

| Fichier | Type | Description |
|---------|------|-------------|
| `supabase/migrations/20260520_chat_messages.sql` | Migration | Tables `chat_messages` + `chat_sessions` + RLS |
| `app/client/page.tsx` | Page | Chat page (remplace Smart Agenda) |
| `app/client/metrics/page.tsx` | Page | Métriques (remplace profil) |
| `app/api/client/chat/messages/route.ts` | API | GET + POST |
| `app/api/client/chat/archives/route.ts` | API | GET par date |
| `app/api/client/chat/today-strip/route.ts` | API | GET today strip |
| `components/client/ChatPage.tsx` | Component | Orchestrateur chat |
| `components/client/ChatTodayStrip.tsx` | Component | Pills today strip |
| `components/client/ChatConversation.tsx` | Component | Liste messages + scroll |
| `components/client/ChatInputBar.tsx` | Component | Input text + mic + envoi |
| `components/client/ChatBubble.tsx` | Component | Bulle bot/user |
| `components/client/MetricsPage.tsx` | Component | Page métriques |
| `lib/inngest/functions/chat-archive.ts` | Inngest | Cron archivage 3j |

### Fichiers à supprimer

- `components/client/CoachAIButton.tsx`
- `components/client/CoachAIChatSheet.tsx`
- `app/client/profil/page.tsx` + `ProfilAccordion.tsx` + sections accordion
- Widgets Smart Agenda non réutilisés : `SmartAgendaTimeline`, `DayChecklist`, `AdherenceScoreCard`, `PriorityActionCard`, `DeloadAlertBanner`
- Radial FAB logic dans `BottomNav.tsx`

### Fichiers à modifier

- `components/client/BottomNav.tsx` — 4 tabs, suppression radial FAB
- `components/client/ConditionalClientShell.tsx` — supprimer injection `CoachAIButton`
- `app/client/layout.tsx` — aucun changement structurel
- `app/api/inngest/route.ts` — importer et ajouter `chatArchiveFunction` dans le tableau `functions`

---

## Contraintes DS v3.0

- Background : `#0d0d0d`
- Surface bulles bot / input : `#161616`
- Accent user : `#ffe01e`, texte `#0d0d0d`
- Police : `font-barlow` body, `font-barlow-condensed` labels
- Radius : `rounded-2xl` bulles, `rounded-xl` input, `rounded-full` avatar
- Zéro `shadow-*` colorée, zéro gradient coloré

---

## Non-Scope (sous-projets suivants)

- Scripted flows check-in morning/evening → **#2**
- Interactive message types (chips, sliders) → **#2**
- Coach dashboard config flows → **#2**
- Push notifications VAPID → **#3**
- Inngest scheduling par client → **#3**
- Body Evolution charts avancés → **#4**
