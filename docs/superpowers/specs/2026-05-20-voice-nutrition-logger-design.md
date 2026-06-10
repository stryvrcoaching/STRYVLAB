# Voice Nutrition Logger — Design Spec

**Date:** 2026-05-20  
**Status:** Approved  
**Scope:** Client PWA — saisie vocale de repas avec analyse IA GPT-4o mini

---

## Objectif

Permettre au client de décrire oralement ce qu'il mange. Le système transcrit, nettoie, envoie à l'IA, retourne une liste d'aliments avec macros estimées, affiche pour confirmation, puis logue dans nutrition_meals/nutrition_entries.

---

## Architecture

```
[FAB micro sur /client/nutrition]
         ↓
[VoiceLogSheet — bottom sheet dédiée, 3 couches]
    ├── Layer "recording"   → enregistrement + waveform live
    ├── Layer "processing"  → nettoyage + appel IA + spinner
    └── Layer "review"      → liste items éditables → confirmation → log

[Bouton micro dans NutritionLogContent header]
         ↓ (ouvre VoiceLogSheet avec meal_id pré-rempli si repas en cours)
```

---

## Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `components/client/smart/VoiceLogSheet.tsx` | Sheet dédiée — 3 couches, state machine |
| `lib/nutrition/voice.ts` | `cleanTranscript()`, types `VoiceItem`, `VoiceParseResult` |
| `app/api/client/nutrition/voice-parse/route.ts` | POST — nettoie + GPT-4o mini + match food_items |

**Fichiers modifiés :**

| Fichier | Changement |
|---------|-----------|
| `app/client/nutrition/page.tsx` | FAB micro flottant |
| `components/client/smart/MealLogSheet.tsx` | Bouton micro dans header → ouvre VoiceLogSheet |
| `app/client/nutrition/log/NutritionLogContent.tsx` | Bouton micro dans header du composer |
| `app/lib/i18n/translations.ts` | Clés `voice.*` (FR/EN/ES) |

---

## 1. Enregistrement (Layer "recording")

### Technologie

- **Primary:** `Web Speech API` (`window.SpeechRecognition`) — transcript live, gratuit, 0 latence réseau
- **Fallback:** Si SpeechRecognition non supporté (iOS Safari < 16.4) → message "Saisie vocale non disponible sur ce navigateur" + lien vers le composer classique
- `lang` : `'fr-FR'` | `'en-US'` | `'es-ES'` selon `client_preferences.language`
- Mode : `continuous: false`, `interimResults: true` (affiche transcript live pendant l'écoute)

### UX Recording

- Bouton micro central (72px, bg `#ffe01e`, icône `Mic`)
- Waveform animé : 5 barres SVG réactives au volume via `AnalyserNode` (Web Audio API)
- Timer visible : `00:00` → `01:00` max
- Stop : tap bouton (passe en rouge pendant écoute → `MicOff`) OU silence > 2.5s OU 60s atteint
- Transcript partiel affiché en texte sous la waveform (`text-white/40`, italic, mis à jour live)
- Transcript final affiché en texte blanc quand l'écoute s'arrête

---

## 2. Nettoyage client-side (`lib/nutrition/voice.ts`)

Fonction pure `cleanTranscript(raw: string, lang: string): string` :

```ts
// Étapes dans l'ordre :
// 1. Lowercase
// 2. Suppression mots parasites selon lang :
//    FR: "euh", "donc", "voilà", "en fait", "genre", "alors", "bon", "ben"
//    EN: "um", "uh", "so", "like", "well", "you know"
//    ES: "eh", "bueno", "pues", "o sea"
// 3. Normalisation nombres écrits → chiffres :
//    "deux cents" → "200", "une demi" → "0.5", "un quart" → "0.25"
//    "vingt" → "20", "trente" → "30" ... jusqu'à "mille"
// 4. Normalisation unités : "grammes" → "g", "kilogrammes" → "kg"
//    "millilitres" → "ml", "centilitres" → "cl"
// 5. Trim + collapse whitespace multiple
```

Types exportés :

```ts
export type VoiceItem = {
  name: string           // "poulet grillé"
  quantity_g: number     // 150
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  confidence: 'high' | 'medium' | 'low'
  food_item_id?: string  // UUID si match catalogue existant
  is_new: boolean        // true = aliment absent du catalogue
}

export type VoiceParseResult = {
  items: VoiceItem[]
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  raw_transcript: string
  clean_transcript: string
}
```

---

## 3. API route `/api/client/nutrition/voice-parse` (POST)

### Input

```ts
{
  transcript: string          // transcript nettoyé côté client
  physiological_date: string  // "2026-05-20"
  lang: string                // "fr"
}
```

### Logique

1. **Auth** : `resolveClientFromUser()` — 401 si non authentifié
2. **Rate limit** : 10 req/min par `client_id` (compteur en mémoire via Map + TTL 60s)
3. **Fetch catalogue client** : top 20 `food_items` utilisés par ce client (via `nutrition_entries` JOIN `food_items`, ORDER BY count DESC, LIMIT 20) — injecté dans le prompt pour matcher en priorité
4. **Appel GPT-4o mini** — prompt système strict, réponse JSON uniquement
5. **Match food_item_id** : pour chaque item retourné par l'IA, tentative de match par `name_fr` ILIKE dans `food_items` → si trouvé, ajouter `food_item_id` + `is_new: false`
6. **Retour** : `VoiceParseResult`

### Prompt système GPT-4o mini

```
Tu es un assistant nutritionnel. Analyse ce texte et retourne UNIQUEMENT un JSON valide.

Format de réponse :
{
  "items": [
    {
      "name": "nom de l'aliment en français",
      "quantity_g": 150,
      "kcal": 248,
      "protein_g": 31.5,
      "carbs_g": 0,
      "fat_g": 13.2,
      "fiber_g": 0,
      "confidence": "high"
    }
  ],
  "meal_type": "lunch"
}

Règles :
- Identifie chaque aliment distinct mentionné
- Si la quantité n'est pas précisée, estime une portion standard
- confidence: "high" si quantité explicite, "medium" si estimée, "low" si très incertain
- meal_type déduit du contexte ou de l'heure (${currentHour}h)
- Ne retourne que le JSON, aucun texte autour

Catalogue du client (préfère ces aliments si correspondance) :
${userFoodItemsJson}

Texte à analyser : "${cleanTranscript}"
```

### Gestion erreurs

- GPT retourne JSON invalide → retry 1 fois, sinon 422 `{ error: 'parse_failed' }`
- GPT indisponible → 503 `{ error: 'ai_unavailable' }`
- Rate limit atteint → 429 `{ error: 'rate_limit', retry_after: 60 }`

---

## 4. Layer "review"

### UX

- Liste scrollable des `VoiceItem` retournés
- Chaque card :
  - Nom de l'aliment (éditable via tap → input inline)
  - Quantité en grammes (éditable inline)
  - Macros : kcal / P / G / L (recalculées live si quantité modifiée — ratio linéaire)
  - Badge confiance : `bg-[#22c55e]/20 text-[#22c55e]` (high) / `bg-[#f59e0b]/20 text-[#f59e0b]` (medium) / `bg-red-500/20 text-red-400` (low)
  - Badge "Nouveau" (amber) si `is_new: true`
  - Swipe gauche → supprimer (Framer Motion drag)

- Items `is_new: true` : confirmation requise avant log
  - Banner en bas : "X aliment(s) nouveau(x) seront ajoutés à votre catalogue"
  - Ces items seront créés via `POST /api/client/food-items` avec `source: 'user', is_verified: false`

- Bouton "Ajouter un aliment" (+ en bas) → ajoute une ligne vide éditable
- Total récapitulatif sticky en bas : kcal / P / G / L agrégés

### Confirmation

Bouton "Logger ce repas" :
1. Créer les `food_items` manquants (`is_new: true`) via `POST /api/client/food-items`
2. Appel `POST /api/client/nutrition/meals` avec `entries[]` + `meal_type` + `input_mode: 'voice'`
3. Succès → ferme VoiceLogSheet + toast "Repas loggé ✓" + refresh nutrition page

**Note :** Ajouter `'voice'` à l'enum `input_mode` dans `nutrition_entries` (migration SQL).

---

## 5. FAB micro sur `/client/nutrition/page.tsx`

Bouton flottant secondaire (position fixe `bottom-[88px] right-4`, z-50) :
- Icône `Mic`, taille 44px, `bg-white/[0.08]`, `rounded-full`
- DS v3.0 : border `border-white/[0.08]`, hover `bg-white/[0.12]`
- Tap → ouvre `<VoiceLogSheet />`

**Ne pas dupliquer le FAB jaune principal** — le FAB voice est distinct, secondaire.

---

## 6. Bouton micro dans NutritionLogContent

Dans le header de `NutritionLogContent.tsx` (top right, à côté du bouton fermeture) :
- Icône `Mic` 20px, `text-white/50`, hover `text-white`
- Tap → ouvre `<VoiceLogSheet mealId={currentMealId} />`
- Si repas en cours (`mealId` fourni), les items loggés sont appendés au repas existant

---

## 7. Schema DB — migration

Fichier : `supabase/migrations/20260520_voice_input_mode.sql`

```sql
-- Ajouter 'voice' à l'enum input_mode sur nutrition_entries
ALTER TABLE nutrition_entries 
  DROP CONSTRAINT IF EXISTS nutrition_entries_input_mode_check;

ALTER TABLE nutrition_entries
  ADD CONSTRAINT nutrition_entries_input_mode_check 
  CHECK (input_mode IN ('composer', 'portion', 'photo_ai', 'voice'));
```

---

## 8. i18n — nouvelles clés

```ts
// app/lib/i18n/translations.ts
voice: {
  title: { fr: "Saisie vocale", en: "Voice log", es: "Registro por voz" },
  tap_to_speak: { fr: "Appuyez pour parler", en: "Tap to speak", es: "Toca para hablar" },
  listening: { fr: "J'écoute…", en: "Listening…", es: "Escuchando…" },
  processing: { fr: "Analyse en cours…", en: "Processing…", es: "Analizando…" },
  review_title: { fr: "Aliments détectés", en: "Detected foods", es: "Alimentos detectados" },
  new_badge: { fr: "Nouveau", en: "New", es: "Nuevo" },
  new_items_notice: { fr: "{n} aliment(s) ajouté(s) à votre catalogue", en: "{n} food(s) added to your catalog", es: "{n} alimento(s) añadido(s) a su catálogo" },
  log_meal: { fr: "Logger ce repas", en: "Log this meal", es: "Registrar esta comida" },
  not_supported: { fr: "Saisie vocale non disponible sur ce navigateur", en: "Voice input not available on this browser", es: "Entrada de voz no disponible en este navegador" },
  error_parse: { fr: "Impossible d'analyser le repas. Réessayez.", en: "Could not analyze meal. Please try again.", es: "No se pudo analizar la comida. Inténtalo de nuevo." },
  error_rate_limit: { fr: "Trop de tentatives. Attendez 1 minute.", en: "Too many attempts. Wait 1 minute.", es: "Demasiados intentos. Espera 1 minuto." },
}
```

---

## 9. Points de vigilance

- **iOS Safari** : `SpeechRecognition` disponible depuis iOS 16.4. Versions antérieures → fallback message. Ne pas utiliser `MediaRecorder` + Whisper (coût + latence inutiles).
- **Permissions micro** : `getUserMedia` requis pour l'`AnalyserNode` (waveform). Si refusé, waveform désactivée mais transcript fonctionne quand même via SpeechRecognition seul.
- **`input_mode: 'voice'`** : migration à appliquer manuellement si Supabase Dashboard SQL Editor (même pattern que les autres migrations pendantes).
- **Macros éditées dans Review** : recalcul ratio linéaire uniquement (`new_qty / original_qty × macro`). Pas d'appel IA au re-edit.
- **food_item créé via voice** : `is_verified: false`, `source: 'user'` — n'apparaît pas dans le catalogue global coach, uniquement dans les résultats de recherche du client concerné.
- **Rate limit** : implémenté in-memory (Map). Si serverless cold start → compteur reset. Acceptable Phase 1, suffisant pour éviter les abus accidentels.
- **Confidence score** en DB : `voice` → `0.70` (entre `composer: 0.85` et `portion: 0.65`).

---

## Séquence complète

```
Client parle → SpeechRecognition transcript → cleanTranscript() →
POST /api/client/nutrition/voice-parse →
  [fetch top20 food_items client] →
  [GPT-4o mini JSON] →
  [match food_item_id par ILIKE] →
VoiceItem[] retournés →
Layer Review (édition, swipe delete) →
[POST /api/client/food-items pour is_new items] →
POST /api/client/nutrition/meals (input_mode: 'voice') →
Toast + refresh page nutrition
```
