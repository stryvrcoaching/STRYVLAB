# Coach IA Chat — Design Spec

**Date:** 2026-05-20  
**Status:** Approved  
**Scope:** Chat IA contextuel quotidien pour client PWA

---

## 1. Vue d'ensemble

Bouton permanent `MessageCircle` dans la TopBar jaune de toutes les pages `/client`. Ouvre un bottom sheet de chat avec un LLM (GPT-4o mini) qui connaît la journée du client : nutrition, séance, check-ins, profil, objectifs. Conseils courts et pratiques uniquement. Session-only (pas de persistance des messages). Rate limit 20 messages/jour.

**Use cases principaux :**
- "Il me reste 500 kcal ce soir, comment m'y prendre ?"
- "J'ai fait ma séance mais j'ai mal aux jambes, je peux manger plus ?"
- "Mon eau est insuffisante, ça change quoi ?"
- "Je suis épuisé ce soir, est-ce normal vu ma journée ?"
- "J'ai sauté le déjeuner, comment rattraper mes protéines ?"

---

## 2. Architecture

```
Client (PWA)
  └── CoachAIButton (TopBar right slot, toutes pages /client)
      └── CoachAIChatSheet (bottom sheet z-[70])
          │
          ├── onOpen → GET /api/client/ai-coach/context
          │     ├── Auth Supabase
          │     ├── Resolve client_id
          │     ├── Fetch profil (objectif, TDEE, macros cibles, programme actif, restrictions)
          │     ├── Fetch journée (repas, eau, séance, check-ins)
          │     └── Return: { systemPrompt, remainingMessages }
          │
          └── onSend → POST /api/client/ai-coach/chat
                ├── Auth Supabase
                ├── Rate limit check → ai_coach_daily_usage
                ├── Build OpenAI messages array (system + history + new user msg)
                ├── OpenAI GPT-4o mini (non-streaming Phase 1)
                └── Return: { reply, remainingMessages }
```

**Pas de streaming Phase 1** — réponse complète après ~1-2s. Typing indicator pendant l'attente.

---

## 3. Contexte injecté (system prompt)

Le system prompt est **reconstruit côté serveur à chaque appel `/chat`** (stateless — pas de session server-side). `GET /api/client/ai-coach/context` sert uniquement à vérifier la disponibilité et récupérer le compteur de messages restants avant le premier envoi.

Format texte structuré (~1000-2500 tokens selon richesse des données) :

```
Tu es le Coach IA de {prénom}. Tu connais sa journée en détail.
Réponds en 3 à 5 lignes maximum. Uniquement nutrition, récupération, entraînement du jour.
Si la question est hors scope, réponds : "Je suis ton coach du quotidien — pose-moi une question sur ta journée, ta nutrition ou ta récupération."
Langue : français. Ton : direct, bienveillant, factuel.

[PROFIL]
Prénom: {prénom}
Objectif: {objectif} | TDEE: {tdee} kcal | Cible: {cible_kcal} kcal
Macros cibles: P {protein_g}g / L {fat_g}g / G {carbs_g}g
Programme actif: {programme_nom} (semaine {semaine}/{total_semaines})
Niveau: {niveau}
Restrictions physiques: {liste ou "aucune"}

[JOURNÉE DU {date_lisible}]
Heure actuelle: {heure}

Nutrition: {kcal_consommés} kcal / {cible_kcal} cible ({pct}%)
  Protéines: {protein_g_consommés}g / {protein_g_cible}g
  Lipides: {fat_g_consommés}g / {fat_g_cible}g
  Glucides: {carbs_g_consommés}g / {carbs_g_cible}g
Repas:
{liste_repas_avec_heure_et_kcal}

Eau: {eau_ml}ml / {cible_eau_ml}ml ({pct_eau}%)

Séance: {description ou "Aucune séance aujourd'hui"}

Activités libres: {liste ou "Aucune"}

Check-ins: {énergie}/5, stress {stress}/5, sommeil {sommeil}h {ou "Non renseignés"}
```

**Données sources :**
- Profil : `coach_clients` + `assessment_submissions` (dernière valide) + `nutrition_protocols` (actif) + `metric_annotations` (restrictions)
- Journée : `nutrition_meals` + `client_water_logs` + `client_session_logs` + `client_activity_logs` + check-ins du jour

**Sécurité :** Le system prompt est construit et stocké uniquement côté serveur. Jamais exposé en réponse API au client browser.

---

## 4. Rate limiting

### Table Supabase

```sql
CREATE TABLE ai_coach_daily_usage (
  client_id uuid REFERENCES coach_clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (client_id, date)
);
```

RLS : client peut lire sa propre ligne (`user_id` via `coach_clients`). Pas d'écriture directe (service role uniquement).

### Logique API

```
POST /api/client/ai-coach/chat
  1. Auth + resolve client_id
  2. SELECT message_count FROM ai_coach_daily_usage WHERE client_id = ? AND date = today
  3. Si message_count >= 20 → 429 { error: "limit_reached", remaining: 0 }
  4. Appel OpenAI
  5. UPSERT ai_coach_daily_usage SET message_count = message_count + 1
  6. Return { reply, remaining: 20 - (message_count + 1) }
```

`date` = date physiologique (même logique que `computePhysiologicalDate`, reset à 04:00).

---

## 5. API Routes

### `GET /api/client/ai-coach/context`

- Auth Supabase obligatoire
- Retourne `{ remainingMessages: number, clientName: string, contextReady: boolean }`
- **Le system prompt n'est PAS retourné au client** — il est recalculé à chaque appel `/chat` côté serveur (stateless, pas de session server-side à gérer)
- Sert uniquement à vérifier la dispo et afficher le compteur avant le premier message
- Appelé une seule fois par session de chat (onOpen du sheet)

### `POST /api/client/ai-coach/chat`

Body :
```typescript
{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  // historique de la conversation courante, sans le system message
  // limité aux 10 derniers échanges côté client avant envoi (évite explosion tokens)
}
```

Réponse :
```typescript
{
  reply: string
  remaining: number // messages restants aujourd'hui
}
```

Erreurs :
- `401` : non authentifié
- `429` : limite atteinte `{ error: 'limit_reached', remaining: 0 }`
- `500` : erreur OpenAI

---

## 6. UI — CoachAIButton

Ajout dans `ClientTopBar` via prop `right` sur chaque page `/client`.

Pattern identique aux boutons TopBar existants :

```tsx
// Dans ClientTopBar right slot
<button className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.10] text-[#0d0d0d] hover:bg-black/[0.18] transition-colors">
  <MessageCircle size={16} />
</button>
```

Implémenté via un hook `useSetTopBar` ou via le layout `/client/layout.tsx` pour être présent sur toutes les pages sans modifier chaque page individuellement.

---

## 7. UI — CoachAIChatSheet

Bottom sheet DS v3.0 :

```
┌─────────────────────────────────┐
│ ● Coach IA              [×]     │  h-14, shrink-0, border-b border-white/[0.06]
│ "Contexte du 20 mai chargé"     │  chip text-[10px] text-white/40
├─────────────────────────────────┤
│                                 │
│  ╭─────────────────────╮        │  assistant: bg-white/[0.06] rounded-2xl
│  │ Bonjour ! Je connais │        │  text-[14px] font-barlow
│  │ ta journée. Comment  │        │
│  │ puis-je t'aider ?   │        │
│  ╰─────────────────────╯        │
│                                 │
│  ╭──────────────────╮           │  suggestions: chips jaunes bg-[#ffe01e]/10
│  │ 500 kcal ce soir │           │  border border-[#ffe01e]/30 text-[#ffe01e]
│  ╰──────────────────╯           │  disparaissent après 1er message
│  ╭──────────────────────╮       │
│  │ Récupération séance  │       │
│  ╰──────────────────────╯       │
│                                 │
│           ╭─────────────────╮   │  user: bg-[#ffe01e] text-[#0d0d0d] rounded-2xl
│           │ Il me reste 500 │   │
│           │ kcal ce soir    │   │
│           ╰─────────────────╯   │
│                                 │
│  ╭──────────────────────────╮   │
│  │ ▪ ▪ ▪                   │   │  typing indicator: 3 dots animés
│  ╰──────────────────────────╯   │
│                                 │
├─────────────────────────────────┤
│ ┌─────────────────────┐  [➤]   │  input rounded-xl bg-[#1a1a1a]
│ │ Tape ton message... │        │  border border-white/[0.08]
│ └─────────────────────┘        │
│                    12/20 msg   │  text-[10px] text-white/30, right-aligned
└─────────────────────────────────┘
```

**Specs sheet :**
- `maxHeight: "88vh"`, `bg-[#161616]`, `rounded-t-2xl`
- `z-[70]` (au-dessus des autres sheets z-50)
- Overlay `z-[60]` `bg-black/60`
- Scroll messages : `flex-1 overflow-y-auto`
- Header + input : `shrink-0`

**Suggestions rapides (pré-définies) :**
1. "Il me reste des calories ce soir"
2. "Comment récupérer après ma séance ?"
3. "Mon eau est insuffisante, que faire ?"

Disparaissent après le premier message envoyé.

**Message d'erreur limite :**
```
╭────────────────────────────────────────╮
│ Tu as atteint tes 20 messages du jour. │
│ Reviens demain !                       │
╰────────────────────────────────────────╯
```
Affiché comme bubble assistant, input désactivé.

---

## 8. Fichiers à créer / modifier

### Nouveaux fichiers
```
app/api/client/ai-coach/context/route.ts     — GET context + system prompt
app/api/client/ai-coach/chat/route.ts        — POST chat (rate limit + OpenAI)
components/client/CoachAIChatSheet.tsx       — Sheet UI complète
components/client/CoachAIButton.tsx          — Bouton TopBar
supabase/migrations/20260520_ai_coach_daily_usage.sql
```

### Fichiers modifiés
```
app/client/layout.tsx                        — Injection CoachAIButton dans TopBar right slot
lib/i18n/translations.ts                     — Clés i18n coach_ai.*
```

### Variables d'environnement
`OPENAI_API_KEY` — déjà présente (voice-parse). Aucune nouvelle variable requise.

---

## 9. Décisions techniques

| Décision | Choix | Raison |
|----------|-------|--------|
| Streaming | Non (Phase 1) | Simplicité. Réponses courtes (3-5 lignes) = latence ~1-2s acceptable |
| Historique persisté | Non | Zéro RGPD, zéro coût stockage, scope quotidien suffisant |
| Contexte re-fetch | Non (une fois à onOpen) | Données du jour ne changent pas significativement en cours de chat |
| Modèle | GPT-4o mini | Conseils pratiques quotidiens, coût ~$0.00015/session |
| Rate limit | DB-side (Supabase) | Résiste aux redémarrages Vercel, pas d'état in-memory |
| Date reset | Physiologique (04:00) | Cohérent avec tout le système nutrition STRYVR |

---

## 10. Hors scope (Phase 1)

- Streaming SSE
- Badge "non lu" sur le bouton TopBar
- Historique multi-jours
- Coaching proactif (notifications push déclenchées par l'IA)
- Réponses avec actions directes (ex: "Ajouter 200kcal au journal" depuis le chat)
- Escalade vers coach humain
