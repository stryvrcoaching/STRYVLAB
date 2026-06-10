# Chat SP2 — Scripted Flow Engine + Interactive Messages

**Date :** 2026-05-21
**Statut :** Approuvé
**Dépendance :** Chat SP1 (implémenté)

---

## Vision

Transformer le chat client de conversationnel passif (texte brut → LLM) en système interactif structuré :
- Check-ins matin/soir via composants inline (chips, sliders, saisie numérique)
- LLM enrichi avec données réelles corrigées + tendances 3 jours + données check-in
- Zéro saisie texte pour les flows structurés — tout par tap/slider

---

## 1. Bug Fix — Données réelles dans le system prompt

### Problème

`buildSystemPrompt` lit `nutrition_meals.calories` (colonne inexistante) et ignore `meal_logs`.
Résultat : `totalKcal = 0` même si l'utilisateur a loggé des repas.
L'IA répond sur la base des objectifs journaliers au lieu des données réelles.

### Fix

Aligner `buildSystemPrompt` sur les mêmes sources que `today-strip/route.ts` :

```
Source A : nutrition_meals.total_calories (Nutrition Composer)
Source B : meal_logs.estimated_macros.calories_kcal (legacy)
totalKcal = A + B
```

Pour les macros, lire depuis `nutrition_meals` les colonnes correctes.

### Données supplémentaires dans le system prompt

**Bloc tendances 3 jours** (nouveau) :
```
[TENDANCES NUTRITION — 3 derniers jours]
  J-1: 1620 kcal / 2070 (78%) | P 121g / 180g ❌
  J-2: 1890 kcal / 2070 (91%) | P 155g / 180g ❌
  J-3: 2010 kcal / 2070 (97%) | P 172g / 180g ✓
→ Déficit protéines 3 jours consécutifs
```

**Bloc check-ins** (nouveau, lu depuis `client_daily_checkins`) :
```
[CHECK-INS]
Matin: sommeil 7.5h, qualité 3/4 (Bien), énergie 4/5, poids 78.2kg
Soir: énergie 2/5, stress 4/5, courbatures 3/4, faim 3/4
```

### Instruction système enrichie

```
Tu es le Coach IA de {prénom}.
Réponds en 3-5 lignes max. Direct, bienveillant, factuel.
Si les données montrent une tendance (déficit protéines, mauvais sommeil récurrent),
  signale-la AVANT de répondre à la question.
Pose UNE question de contexte si nécessaire avant de recommander.
Ne donne jamais de conseils médicaux.
```

---

## 2. DB Schema — `client_daily_checkins`

```sql
CREATE TABLE client_daily_checkins (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  date            date NOT NULL,
  flow_type       text NOT NULL CHECK (flow_type IN ('morning', 'evening')),

  -- Morning + Evening
  sleep_hours     numeric(4,1),    -- 4.0–10.0 (matin seulement)
  sleep_quality   smallint,        -- 1–4
  energy_level    smallint,        -- 1–5
  stress_level    smallint,        -- 1–5 (soir seulement)
  weight_kg       numeric(5,2),    -- optionnel, matin seulement
  notes           text,

  -- Evening only
  hunger_level    smallint,        -- 1–4
  muscle_soreness smallint,        -- 1–4, conditionnel (si séance ce jour)

  completed_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, date, flow_type)
);

-- RLS
ALTER TABLE client_daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_read_write_own"
  ON client_daily_checkins
  FOR ALL
  USING (client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid()));

CREATE POLICY "coach_read_clients"
  ON client_daily_checkins
  FOR SELECT
  USING (client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid()));
```

**Pourquoi ces champs :**
- `sleep_hours` + `sleep_quality` → SRA, deload detection, récupération
- `energy_level` → intensité séance recommandée, besoin calorique
- `stress_level` → cortisol, récupération, ajustements calorie
- `weight_kg` → tracking poids sans bilan formel
- `hunger_level` → calibration nutrition (plan trop restrictif ?)
- `muscle_soreness` → readiness séance suivante

**Lien `chat_sessions`** : à la complétion d'un flow, on écrit dans `client_daily_checkins` ET on met `chat_sessions.completed_at`. Le today-strip lit `chat_sessions` (inchangé).

---

## 3. Interactive Message Types

3 composants rendus **inline dans la bulle bot** :

### `chips` — sélection rapide
```
╭─────────────────────────────────╮
│ Comment tu as dormi cette nuit? │
│                                 │
│ 😴 Mal  😐 Moyen  🙂 Bien  ⚡Top│
╰─────────────────────────────────╯
```

### `slider` — valeur numérique
```
╭─────────────────────────────────╮
│ Combien d'heures de sommeil ?   │
│  5h ●━━━━━━━━━━━━━━━━━━ 9h     │
│            7.5h                 │
╰─────────────────────────────────╯
```

### `number` — saisie poids
```
╭─────────────────────────────────╮
│ Ton poids ce matin ? (optionnel)│
│  ┌──────────┐                   │
│  │ 78.5  kg │  [Passer →]       │
│  └──────────┘                   │
╰─────────────────────────────────╯
```

### Schéma `metadata` JSONB (`chat_messages`)

```typescript
// message_type = 'interactive', role = 'assistant'
{
  component: 'chips' | 'slider' | 'number',
  key: string,           // field dans client_daily_checkins
  question: string,
  options?: { label: string; value: number; emoji?: string }[],
  min?: number,
  max?: number,
  step?: number,
  unit?: string,         // 'h', 'kg'
  optional?: boolean,    // affiche "Passer →"
  answered?: boolean,    // true après réponse → composant désactivé
}
```

**UX rules :**
- Composant rendu après le texte de la bulle bot
- Après réponse → composant grisé + non-interactif + bulle user affichée
- Composants déjà répondus non-interactifs au rechargement (lu depuis `metadata.answered`)

---

## 4. Flow Engine

### Types

```typescript
interface FlowStep {
  key: string
  component: 'chips' | 'slider' | 'number'
  question: string
  options?: { label: string; value: number; emoji?: string }[]
  min?: number; max?: number; step?: number; unit?: string
  optional?: boolean
  condition?: (collectedData: Record<string, number>) => boolean  // ex: muscle_soreness conditionnel
}

interface CheckinFlow {
  type: 'morning' | 'evening'
  greeting: string
  steps: FlowStep[]
}
```

### Flow Matin — 5 steps

```
greeting: "Bonjour [prénom] ! On fait le point sur ta nuit 🌙"

Step 1 — sleep_hours — slider 4–10h step 0.5
  "Combien d'heures de sommeil ?"

Step 2 — sleep_quality — chips
  "Comment tu as dormi ?"
  😴 Mauvais(1)  😐 Moyen(2)  🙂 Bien(3)  ⚡ Excellent(4)

Step 3 — energy_level — chips
  "Niveau d'énergie au réveil ?"
  🪫 Épuisé(1)  😴 Fatigué(2)  😐 Normal(3)  💪 Chargé(4)  ⚡ Top(5)

Step 4 — weight_kg — number, optional
  "Ton poids ce matin ?" [Passer →]

→ API POST /api/client/checkin (save + chat_sessions)
→ LLM closing: message contextuel court basé sur données collectées + journée
  ex: "7h30 et bonne qualité — récupération solide. Séance pecs prévue, tu es prêt."
```

### Flow Soir — 4 steps

```
greeting: "Bonsoir [prénom] ! Comment s'est passée ta journée ?"

Step 1 — energy_level — chips
  "Niveau d'énergie en fin de journée ?"
  🪫 Épuisé(1)  😴 Fatigué(2)  😐 Normal(3)  💪 Bien(4)  ⚡ Top(5)

Step 2 — stress_level — chips
  "Niveau de stress aujourd'hui ?"
  😌 Aucun(1)  🙂 Léger(2)  😐 Modéré(3)  😟 Élevé(4)  🔥 Intense(5)

Step 3 — muscle_soreness — chips (conditionnel : si séance complétée aujourd'hui)
  "Courbatures / douleurs musculaires ?"
  ✅ Aucune(1)  😌 Légères(2)  😬 Modérées(3)  😫 Intenses(4)

Step 4 — hunger_level — chips
  "Niveau de faim en fin de journée ?"
  😌 Rassasié(1)  😐 Normal(2)  🍽️ Faim(3)  🦁 Très faim(4)

→ API POST /api/client/checkin (save + chat_sessions)
→ LLM closing: analyse courte
  ex: "Stress élevé + fatigué = nuit de récupération prioritaire. Dors avant 22h30."
```

### Smart Detection (bouton Check-in du today strip)

```
Heure < 14h00  + morning non complété  → flow morning
Heure ≥ 14h00  + evening non complété  → flow evening
Morning non complété + evening non complété (heure ≥ 14h) → flow evening en priorité
Les deux complétés                      → message "Check-ins du jour terminés ✓"
```

---

## 5. Fichiers à créer / modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `supabase/migrations/20260521_daily_checkins.sql` | CREATE | Table `client_daily_checkins` + RLS |
| `lib/client/ai-coach/buildSystemPrompt.ts` | MODIFY | Fix colonnes nutrition + tendances 3j + check-ins |
| `lib/client/checkin/flows.ts` | CREATE | Définitions flows morning/evening |
| `lib/client/checkin/checkinEngine.ts` | CREATE | Détection morning/evening, collecte state |
| `app/api/client/checkin/route.ts` | CREATE | POST — save → `client_daily_checkins` + `chat_sessions` |
| `components/client/ChatBubble.tsx` | MODIFY | Render composants interactifs depuis `metadata` |
| `components/client/ChatPage.tsx` | MODIFY | Wiring bouton check-in → flow engine |
| `components/client/checkin/CheckinFlow.tsx` | CREATE | Orchestrateur flow step-by-step |

---

## 6. Hors scope SP2

- Configuration flows par coach → SP3
- Push notifications (rappel check-in le matin) → SP3
- Flows custom (autre que check-in) → SP3
- Streaming SSE → toujours hors scope

---

## Contraintes DS v4.0 (app client)

- Background : `#080808`
- Surface bulles / composants : `#111111`
- Chips actives : `bg-[#f2f2f2] text-[#080808]`
- Chips inactives : `bg-[#1a1a1a] text-[#808080]`
- Slider : `input[type=range]` natif, thumb `#f2f2f2`
- Bouton "Passer →" : `text-[#5a5a5a] text-[12px]`
- Composant répondu : `opacity-40 pointer-events-none`
- Police : `font-barlow`
- Radius : `rounded-xl` composants, `rounded-full` chips
