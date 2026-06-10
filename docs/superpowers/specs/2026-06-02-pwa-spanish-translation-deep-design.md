# Spec — Traduction Espagnol PWA Client (Deep Pass)

**Date:** 2026-06-02  
**Branche cible:** feat/pwa-es-translation-deep  
**Priorité:** P1 — déblocage marché ES

---

## Contexte

L'app client PWA supporte FR/EN/ES en UI (795 clés dans `clientTranslations.ts`). Audit révèle 3 zones critiques non traduites :

1. **Strings hardcodées** dans composants React (ChatPage, MeasurementsEntrySheet, LogPeriodSheet)
2. **Aliments DB** — `food_items` a `name_fr` uniquement, ~3230 items (3184 CSV + 47 suppléments), aucune table de traductions
3. **Langue du chat IA** — le bot répond toujours en FR, pas de config coach par client

---

## Bloc 1 — Strings hardcodées composants

### Fichiers ciblés

**`components/client/ChatPage.tsx`**
- Greeting `"Bonjour {firstName} 👋"` / `"Bonjour 👋"` (ligne ~200)
- `QUICK_SUGGESTIONS` array : 3 strings FR hardcodées (lignes 46–48)

**`components/client/metrics/MeasurementsEntrySheet.tsx`**
- `FIELDS` array : ~11 labels de mesures + ~11 guides anatomiques — tous en FR
- État de loading `'Enregistrement…'`

**`components/client/cycle/LogPeriodSheet.tsx`**
- 2 messages de succès toast en FR

### Approche

Extraire toutes ces strings vers `lib/i18n/clientTranslations.ts` sous les namespaces :
- `chat.greeting`, `chat.greetingNamed`, `chat.suggestion1/2/3`
- `measurements.fields.*` (poids, cou, épaules…), `measurements.guides.*`
- `measurements.saving`
- `cycle.periodUpdated`, `cycle.periodEnded`

Composants passent `lang` (déjà disponible via `useClientT()`) et appellent `t('key')`.

---

## Bloc 2 — clientTranslations.ts polish

Après extraction des strings hardcodées, valider :
- Toutes les clés ajoutées ont 3 versions (fr/en/es)
- Terminologie anatomique ES correcte (médicale, pas familière)
- `ctp()` pluriels cohérents ES

---

## Bloc 3 — food_item_translations (schema + seed + API)

### Décision architecture

Créer une vraie table `food_item_translations` — cohérent avec `exercise_translations`, `muscle_translations`, etc. Pattern uniforme dans le data model.

### Schema migration

```sql
-- supabase/migrations/20260602_food_item_translations.sql

CREATE TABLE food_item_translations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_item_id uuid NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
  lang        text NOT NULL CHECK (lang IN ('fr', 'en', 'es')),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (food_item_id, lang)
);

CREATE INDEX idx_food_item_translations_food_item ON food_item_translations(food_item_id);
CREATE INDEX idx_food_item_translations_lang ON food_item_translations(lang);

-- Backfill FR depuis name_fr existant
INSERT INTO food_item_translations (food_item_id, lang, name)
SELECT id, 'fr', name_fr FROM food_items
ON CONFLICT (food_item_id, lang) DO NOTHING;
```

### Seed traductions ES + EN

Fichier : `prisma/seeds/food-item-translations-es.ts`

**Stratégie :** batch GPT-4o sur les 3230 noms FR → ES + EN.  
- Input : `[{ id, name_fr }]` par batch de 100  
- Output : `[{ id, name_es, name_en }]`  
- Le seed script fait des upserts idempotents
- Les noms doivent respecter la terminologie alimentaire ES standard (pas traduction littérale — ex: "Salade de thon" → "Ensalada de atún", pas "Salada de atún")

Script runner : `scripts/seed-food-translations.ts` — appelle l'API OpenAI en batches avec retry.

**Suppléments :** traduits manuellement (~47 items) — terminologie spécifique fitness.

### API update

`app/api/client/food-items/route.ts` :

```typescript
// GET — ajouter lang au select
const lang = req.headers.get('x-client-lang') ?? 'fr' // ou via searchParams

let query = db
  .from("food_items")
  .select(`
    id, name_fr, category_l1, category_l2, item_key,
    kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
    source, client_id,
    food_item_translations!left(lang, name)
  `)
  ...

// Dans la réponse : résoudre le nom localisé
const localizedName = (item.food_item_translations ?? [])
  .find(t => t.lang === lang)?.name ?? item.name_fr
```

Fallback strict : si pas de traduction ES → `name_fr`. Jamais null.

**Search** : quand `lang === 'es'`, scorer sur le nom ES traduit + fallback sur `name_fr`. La normalisation NFD s'applique identiquement (accents ES : á, é, í, ó, ú, ñ).

**POST custom food item** : ajouter `name_es?: string` optionnel. Si fourni, insérer dans `food_item_translations`. Sinon, le client crée son aliment avec `name_fr` seulement — pas bloquant.

---

## Bloc 4 — Langue du chat IA (config coach)

### Décision produit

Le coach configure une **langue préférée par client** pour le chat IA. Cette langue contrôle :
1. La langue dans laquelle le bot répond (instruction dans le system prompt)
2. La langue des messages template (greeting, suggestions rapides, closing)

**Priorité de résolution :**
```
ai_chat_lang (config coach) → display_lang (préférence client) → 'fr' (défaut)
```

Si le coach ne configure pas de langue → le bot s'adapte automatiquement à la langue que le client a choisie dans ses préférences d'affichage.

### Schema migration

```sql
-- supabase/migrations/20260602_ai_coach_chat_lang.sql

ALTER TABLE coach_clients
  ADD COLUMN IF NOT EXISTS ai_chat_lang text NULL
  CHECK (ai_chat_lang IN ('fr', 'es', 'en'));

COMMENT ON COLUMN coach_clients.ai_chat_lang IS
  'Langue forcée pour le chat IA. NULL = hérite de display_lang du client.';
```

### API update

`app/api/clients/[clientId]/ai-settings/route.ts` :
- GET : inclure `ai_chat_lang` dans la réponse
- PUT : accepter et valider `ai_chat_lang: 'fr' | 'es' | 'en' | null`

### buildSystemPrompt update

`lib/client/ai-coach/buildSystemPrompt.ts` :

```typescript
// Résolution langue
const chatLang = coachConfig.ai_chat_lang ?? clientProfile.display_lang ?? 'fr'

const langInstruction = {
  fr: "Tu réponds TOUJOURS en français, quelle que soit la langue du client.",
  es: "Respondes SIEMPRE en español, sin importar el idioma del cliente.",
  en: "You ALWAYS reply in English, regardless of the client's language.",
}[chatLang]

// Injecter dans le system prompt
systemPrompt += `\n\n${langInstruction}`
```

**Note :** le prompt système lui-même reste en FR (qualité du prompt engineering). Seule la directive de langue de réponse est traduite.

### messageComposer.ts update

`lib/client/ai-coach/messageComposer.ts` — les greetings, suggestions rapides, et closing templates doivent être multilingues :

```typescript
const GREETINGS = {
  fr: { morning: "Bonjour {name} 👋", evening: "Bonsoir {name} 👋" },
  es: { morning: "¡Buenos días {name} 👋", evening: "¡Buenas noches {name} 👋" },
  en: { morning: "Good morning {name} 👋", evening: "Good evening {name} 👋" },
}
```

Idem pour `QUICK_SUGGESTIONS` dans `ChatPage` — ces strings viennent du i18n client (Bloc 1), donc déjà couvert.

### AiCoachSettingsWidget update

Ajouter un sélecteur de langue dans le widget :

```
┌─────────────────────────────────────┐
│ LANGUE DU CHAT IA                   │
│ ○ Automatique (selon client)        │
│ ○ Français                          │
│ ○ Español                           │
│ ○ English                           │
└─────────────────────────────────────┘
```

Design : même pattern que "Liberté de coaching IA" — grid de boutons, DS v2.0.

---

## Bloc 5 — Validation bout-en-bout ES

### Checklist

- [ ] Passer `display_lang: 'es'` dans les préférences client test
- [ ] Parcourir toutes les pages client — 0 string FR visible
- [ ] Logger un aliment en ES — noms ES affichés dans la recherche
- [ ] Mesures corporelles — labels ES dans MeasurementsEntrySheet
- [ ] Chat — bot répond en ES (si `display_lang = 'es'` et `ai_chat_lang = null`)
- [ ] Coach force `ai_chat_lang = 'es'` → bot ES quelle que soit la langue client
- [ ] Coach force `ai_chat_lang = 'fr'` → bot FR même si client est en ES
- [ ] Suggestions rapides en ES dans ChatPage
- [ ] Cycle tracking — toasts success en ES
- [ ] Nutrition search — accent ES normalisé (búsqueda fonctionne avec "busqueda")

---

## Ordre de livraison

```
Plan 1 — Strings hardcodées + i18n polish (Bloc 1+2)
  → Migration: 0
  → Risque: minimal

Plan 2 — food_item_translations schema + backfill FR (Bloc 3, partie A)
  → Migration SQL
  → API update (lecture)
  → Risque: faible, fallback name_fr

Plan 3 — Seed ES + EN aliments (Bloc 3, partie B)
  → Script LLM batch
  → Idempotent, peut tourner plusieurs fois
  → Risque: qualité traductions (review manuelle spot-check)

Plan 4 — Langue chat IA (Bloc 4)
  → Migration SQL (1 colonne)
  → API + prompt + widget
  → Risque: faible, opt-in

Plan 5 — Validation ES (Bloc 5)
  → Tests manuels + correctifs
```

---

## Fichiers impactés (récapitulatif)

| Fichier | Action |
|---------|--------|
| `lib/i18n/clientTranslations.ts` | +~60 clés ES (mesures, chat, cycle) |
| `components/client/ChatPage.tsx` | extraire greeting + suggestions vers i18n |
| `components/client/metrics/MeasurementsEntrySheet.tsx` | extraire FIELDS vers i18n |
| `components/client/cycle/LogPeriodSheet.tsx` | extraire toasts vers i18n |
| `supabase/migrations/20260602_food_item_translations.sql` | nouvelle table + backfill FR |
| `supabase/migrations/20260602_ai_coach_chat_lang.sql` | colonne ai_chat_lang |
| `scripts/seed-food-translations.ts` | batch LLM ES+EN |
| `prisma/seeds/food-item-translations-es.ts` | seed idempotent |
| `app/api/client/food-items/route.ts` | join translations + search localisé |
| `app/api/clients/[clientId]/ai-settings/route.ts` | GET/PUT ai_chat_lang |
| `lib/client/ai-coach/buildSystemPrompt.ts` | directive langue |
| `lib/client/ai-coach/messageComposer.ts` | greetings/closing multilingues |
| `components/coach/AiCoachSettingsWidget.tsx` | sélecteur langue |
| `CHANGELOG.md` | MAJ après chaque plan |
| `.claude/rules/project-state.md` | MAJ après chaque plan |
