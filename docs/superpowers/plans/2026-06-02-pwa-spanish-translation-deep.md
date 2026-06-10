# PWA Spanish Translation — Deep Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full Spanish (ES) coverage for the client PWA — UI strings, food database, and AI coach chat language config.

**Architecture:** 5 sequential task groups: (1) fix hardcoded UI strings via i18n, (2) food_item_translations schema + API, (3) LLM batch seed for ES+EN food names, (4) AI coach lang config (schema + widget + system prompt), (5) end-to-end validation.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (raw SQL migrations), `lib/i18n/clientTranslations.ts` (flat dict pattern), OpenAI API (batch translation seed)

---

## File Map

| File | Action |
|------|--------|
| `lib/i18n/clientTranslations.ts` | Add ~20 keys (chat greeting, suggestions, measurements labels+guides, cycle toasts) |
| `components/client/ChatPage.tsx` | Replace hardcoded greeting + QUICK_SUGGESTIONS with i18n keys; add `lang` prop |
| `components/client/metrics/MeasurementsEntrySheet.tsx` | Replace FIELDS array with i18n lookup; add `lang` prop |
| `components/client/cycle/LogPeriodSheet.tsx` | Replace 2 hardcoded toast strings with i18n; add `lang` prop |
| `components/client/MetricsClientPage.tsx` | Thread `lang` prop to MeasurementsEntrySheet |
| `components/client/QuickLogSheet.tsx` | Thread `lang` prop to LogPeriodSheet |
| `components/client/profile/ProfilAccordion.tsx` | Thread `lang` prop to LogPeriodSheet |
| `app/client/metrics/page.tsx` | Pass `lang` down to MetricsClientPage |
| `supabase/migrations/20260602_food_item_translations.sql` | New table + FR backfill |
| `supabase/migrations/20260602_ai_coach_chat_lang.sql` | Add `ai_chat_lang` to `coach_ai_settings_per_client` |
| `app/api/client/food-items/route.ts` | JOIN translations, localized search+response |
| `app/api/clients/[clientId]/ai-settings/route.ts` | GET/PUT `ai_chat_lang` |
| `lib/client/ai-coach/buildSystemPrompt.ts` | Resolve chat lang, inject directive |
| `components/coach/AiCoachSettingsWidget.tsx` | Add lang selector UI |
| `scripts/seed-food-translations.ts` | Batch LLM translation runner |
| `CHANGELOG.md` | Updated after each task group |
| `.claude/rules/project-state.md` | Updated after plan completes |

---

## Task 1 — i18n keys: chat greeting + suggestions

**Files:**
- Modify: `lib/i18n/clientTranslations.ts` (after line 653, around the existing `ai.*` keys)
- Modify: `components/client/ChatPage.tsx` (lines 51–55, 464)

### Context

`clientDict` in `lib/i18n/clientTranslations.ts` already has `'ai.suggestion1/2/3'` and `'ai.greeting'` for the AI chat page contextual suggestions, but `ChatPage.tsx` uses its own hardcoded `QUICK_SUGGESTIONS` array and a hardcoded `"Bonjour {firstName} 👋"` greeting that bypasses i18n entirely.

`ChatPage` is a client component that currently receives no `lang` prop — it will need one added.

- [ ] **Step 1: Add chat greeting + suggestion keys to clientTranslations.ts**

Open `lib/i18n/clientTranslations.ts`. Find the block around line 650 (the `ai.suggestion*` and `ai.greeting` keys). Add these new keys immediately after `'ai.greeting'`:

```typescript
  'chat.greeting':       { fr: 'Bonjour {name} 👋',    en: 'Hello {name} 👋',         es: 'Hola {name} 👋' },
  'chat.greetingAnon':   { fr: 'Bonjour 👋',           en: 'Hello 👋',                es: 'Hola 👋' },
  'chat.subtitle':       { fr: 'Pose-moi une question ou fais ton check-in.', en: 'Ask me a question or do your check-in.', es: 'Hazme una pregunta o haz tu check-in.' },
  'chat.qs1':            { fr: 'Comment je récupère après ma séance ?', en: 'How do I recover after my session?', es: '¿Cómo me recupero después de mi sesión?' },
  'chat.qs2':            { fr: 'Aide-moi avec ma nutrition',            en: 'Help me with my nutrition',           es: 'Ayúdame con mi nutrición' },
  'chat.qs3':            { fr: "Programme pour aujourd'hui",             en: "Today's programme",                   es: 'Mi programa de hoy' },
```

- [ ] **Step 2: Add `lang` prop to ChatPage and replace hardcoded strings**

Open `components/client/ChatPage.tsx`. Make these changes:

**a) Update the `ChatPageProps` interface** (around line 57):
```typescript
interface ChatPageProps {
  coachAvatarUrl?: string | null
  coachInitial?: string | null
  clientFirstName?: string | null
  lang?: ClientLang
}
```

**b) Add import** at the top of the file:
```typescript
import { ct, type ClientLang } from '@/lib/i18n/clientTranslations'
```

**c) Update the function signature** (around line 63):
```typescript
export default function ChatPage({ coachAvatarUrl, coachInitial, clientFirstName, lang = 'fr' }: ChatPageProps) {
```

**d) Replace `QUICK_SUGGESTIONS` constant** (lines 51–55) — delete the entire `const QUICK_SUGGESTIONS = [...]` block and instead compute it inside the component body after the function signature:
```typescript
const QUICK_SUGGESTIONS = [
  ct(lang, 'chat.qs1'),
  ct(lang, 'chat.qs2'),
  ct(lang, 'chat.qs3'),
]
```

**e) Replace the greeting** (line 464):
```typescript
<p className="text-[17px] font-barlow font-semibold text-white leading-snug">
  {clientFirstName
    ? ct(lang, 'chat.greeting', { name: clientFirstName })
    : ct(lang, 'chat.greetingAnon')}
</p>
<p className="text-[13px] text-[#5a5a5a] font-barlow mt-1">
  {ct(lang, 'chat.subtitle')}
</p>
```

- [ ] **Step 3: Find where ChatPage is rendered and pass `lang`**

Run:
```bash
grep -rn "ChatPage" /Users/user/Desktop/STRYVLAB/app/client/ --include="*.tsx" | head -10
```

In the parent server component, get the client's `display_lang` from the session/profile (same pattern used by other client pages) and pass it as `lang={display_lang as ClientLang}`.

- [ ] **Step 4: Run TypeScript check**
```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -E "ChatPage|clientTranslations" | head -20
```
Expected: 0 errors for these files.

- [ ] **Step 5: Commit**
```bash
git add lib/i18n/clientTranslations.ts components/client/ChatPage.tsx
git commit -m "feat(i18n): localize ChatPage greeting and quick suggestions (ES+EN)"
```

---

## Task 2 — i18n keys: measurement labels + guides

**Files:**
- Modify: `lib/i18n/clientTranslations.ts`
- Modify: `components/client/metrics/MeasurementsEntrySheet.tsx`
- Modify: `components/client/MetricsClientPage.tsx`
- Modify: `app/client/metrics/page.tsx` (to thread lang)

### Context

`MeasurementsEntrySheet.tsx` has a `FIELDS` static array (lines 14–160) with FR labels and anatomical guide strings. The component has no `lang` prop and doesn't use `useClientT()`. We add a `lang` prop and replace the static array with a function that returns localized fields.

- [ ] **Step 1: Add measurement keys to clientTranslations.ts**

Add these keys after the `'chat.qs3'` entry from Task 1:

```typescript
  // Measurements — labels
  'meas.weight':           { fr: 'Poids',             en: 'Weight',          es: 'Peso' },
  'meas.neck':             { fr: 'Cou',               en: 'Neck',            es: 'Cuello' },
  'meas.shoulders':        { fr: 'Épaules',           en: 'Shoulders',       es: 'Hombros' },
  'meas.chest':            { fr: 'Poitrine',          en: 'Chest',           es: 'Pecho' },
  'meas.waist':            { fr: 'Tour de taille',    en: 'Waist',           es: 'Cintura' },
  'meas.hips':             { fr: 'Hanches',           en: 'Hips',            es: 'Caderas' },
  'meas.glutes':           { fr: 'Fessiers',          en: 'Glutes',          es: 'Glúteos' },
  'meas.armLeft':          { fr: 'Bras gauche',       en: 'Left arm',        es: 'Brazo izquierdo' },
  'meas.armRight':         { fr: 'Bras droit',        en: 'Right arm',       es: 'Brazo derecho' },
  'meas.forearmLeft':      { fr: 'Avant-bras gauche', en: 'Left forearm',    es: 'Antebrazo izquierdo' },
  'meas.forearmRight':     { fr: 'Avant-bras droit',  en: 'Right forearm',   es: 'Antebrazo derecho' },
  'meas.thighLeft':        { fr: 'Cuisse gauche',     en: 'Left thigh',      es: 'Muslo izquierdo' },
  'meas.thighRight':       { fr: 'Cuisse droite',     en: 'Right thigh',     es: 'Muslo derecho' },
  'meas.calfLeft':         { fr: 'Mollet gauche',     en: 'Left calf',       es: 'Gemelo izquierdo' },
  'meas.calfRight':        { fr: 'Mollet droit',      en: 'Right calf',      es: 'Gemelo derecho' },
  'meas.saving':           { fr: 'Enregistrement…',  en: 'Saving…',         es: 'Guardando…' },
  // Measurements — anatomical guides (3 lines each)
  'meas.guide.neck.0':     { fr: "Juste en dessous de la pomme d'Adam, au point le plus étroit", en: "Just below the Adam's apple, at the narrowest point", es: 'Justo debajo de la nuez de Adán, en el punto más estrecho' },
  'meas.guide.neck.1':     { fr: "Tête droite, regard à l'horizon, cou détendu", en: 'Head straight, looking forward, neck relaxed', es: 'Cabeza recta, mirando al frente, cuello relajado' },
  'meas.guide.neck.2':     { fr: 'Mètre horizontal, sans serrer — glisser un doigt pour vérifier', en: 'Tape horizontal, not tight — slide a finger to check', es: 'Cinta horizontal, sin apretar — desliza un dedo para verificar' },
  'meas.guide.shoulders.0': { fr: 'Autour des épaules au niveau des deltoïdes, passant sur les deux acromions', en: 'Around the shoulders at deltoid level, passing over both acromions', es: 'Alrededor de los hombros a nivel de deltoides, pasando por ambos acromios' },
  'meas.guide.shoulders.1': { fr: 'Debout, bras le long du corps, épaules décontractées (ne pas les remonter)', en: 'Standing, arms at sides, shoulders relaxed (do not shrug)', es: 'De pie, brazos a los lados, hombros relajados (no elevarlos)' },
  'meas.guide.shoulders.2': { fr: 'Mètre horizontal, passant sur les pointes des deux épaules et dans le dos', en: 'Tape horizontal, over both shoulder tips and across the back', es: 'Cinta horizontal, sobre las puntas de ambos hombros y por la espalda' },
  'meas.guide.chest.0':    { fr: 'Au niveau des mamelons, à la saillie maximale du torse', en: 'At nipple level, at the maximum chest protrusion', es: 'A la altura de los pezones, en la proyección máxima del torso' },
  'meas.guide.chest.1':    { fr: 'Debout, bras légèrement écartés le temps de passer le mètre, puis ramenés', en: 'Standing, arms slightly apart to pass the tape, then lowered', es: 'De pie, brazos ligeramente separados para pasar la cinta, luego bajarlos' },
  'meas.guide.chest.2':    { fr: 'Expiration normale, torse décontracté', en: 'Normal exhale, chest relaxed', es: 'Expiración normal, pecho relajado' },
  'meas.guide.waist.0':    { fr: 'Au niveau du nombril, entre le bas des côtes et le haut des hanches', en: 'At navel level, between the bottom ribs and top of hips', es: 'A la altura del ombligo, entre la parte inferior de las costillas y la parte superior de las caderas' },
  'meas.guide.waist.1':    { fr: 'Debout, abdomen détendu — ne pas rentrer le ventre', en: 'Standing, abdomen relaxed — do not suck in', es: 'De pie, abdomen relajado — no meter el vientre' },
  'meas.guide.waist.2':    { fr: 'À jeun le matin, mesurer en expiration normale', en: 'Fasted in the morning, measure on normal exhale', es: 'En ayunas por la mañana, medir en expiración normal' },
  'meas.guide.hips.0':     { fr: 'À la saillie maximale des fessiers, généralement 18–22 cm sous le nombril', en: 'At the maximum glute protrusion, usually 18–22 cm below the navel', es: 'En la proyección máxima de los glúteos, generalmente 18–22 cm bajo el ombligo' },
  'meas.guide.hips.1':     { fr: 'Debout, pieds joints, jambes légèrement décontractées', en: 'Standing, feet together, legs slightly relaxed', es: 'De pie, pies juntos, piernas ligeramente relajadas' },
  'meas.guide.hips.2':     { fr: 'Mètre horizontal, parallèle au sol sur tout le tour', en: 'Tape horizontal, parallel to the floor all the way around', es: 'Cinta horizontal, paralela al suelo en todo el recorrido' },
  'meas.guide.glutes.0':   { fr: 'À la saillie maximale des fessiers, mètre strictement horizontal', en: 'At maximum glute protrusion, tape strictly horizontal', es: 'En la proyección máxima de los glúteos, cinta estrictamente horizontal' },
  'meas.guide.glutes.1':   { fr: 'Debout, pieds joints, fessiers décontractés', en: 'Standing, feet together, glutes relaxed', es: 'De pie, pies juntos, glúteos relajados' },
  'meas.guide.glutes.2':   { fr: 'Niveau identique au tour de hanches ou légèrement au-dessus', en: 'Same level as hips or slightly above', es: 'Mismo nivel que las caderas o ligeramente por encima' },
  'meas.guide.arm.0':      { fr: "À mi-distance entre l'épaule (acromion) et le coude — point le plus large", en: 'Midway between shoulder (acromion) and elbow — widest point', es: 'A mitad de camino entre el hombro (acromion) y el codo — punto más ancho' },
  'meas.guide.arm.1':      { fr: 'Bras pendant le long du corps, complètement détendu — ne pas contracter', en: 'Arm hanging at side, fully relaxed — do not flex', es: 'Brazo colgando al lado, completamente relajado — no contraer' },
  'meas.guide.arm.2':      { fr: "Mètre perpendiculaire à l'axe du bras, sans serrer", en: 'Tape perpendicular to arm axis, not tight', es: 'Cinta perpendicular al eje del brazo, sin apretar' },
  'meas.guide.forearm.0':  { fr: "Circumférence maximale de l'avant-bras, juste sous le coude", en: 'Maximum forearm circumference, just below the elbow', es: 'Circunferencia máxima del antebrazo, justo debajo del codo' },
  'meas.guide.forearm.1':  { fr: 'Bras tendu, main ouverte et détendue, paume vers le haut', en: 'Arm extended, hand open and relaxed, palm up', es: 'Brazo extendido, mano abierta y relajada, palma hacia arriba' },
  'meas.guide.forearm.2':  { fr: 'Mètre horizontal, au point le plus large', en: 'Tape horizontal, at widest point', es: 'Cinta horizontal, en el punto más ancho' },
  'meas.guide.thigh.0':    { fr: "À mi-hauteur entre le pli de l'aine et le dessus de la rotule", en: 'Midway between the groin crease and top of the kneecap', es: 'A mitad de camino entre el pliegue inguinal y la parte superior de la rótula' },
  'meas.guide.thigh.1':    { fr: 'Debout, poids réparti sur les deux jambes, cuisse décontractée', en: 'Standing, weight on both legs, thigh relaxed', es: 'De pie, peso repartido en ambas piernas, muslo relajado' },
  'meas.guide.thigh.2':    { fr: 'Mètre horizontal, sans pincer ni comprimer les tissus', en: 'Tape horizontal, not pinching or compressing tissue', es: 'Cinta horizontal, sin pellizcar ni comprimir los tejidos' },
  'meas.guide.calf.0':     { fr: 'Circumférence maximale du mollet, généralement au tiers supérieur', en: 'Maximum calf circumference, usually at the upper third', es: 'Circunferencia máxima del gemelo, generalmente en el tercio superior' },
  'meas.guide.calf.1':     { fr: 'Debout, pieds à plat, mollet détendu — pas sur la pointe des pieds', en: 'Standing, feet flat, calf relaxed — not on tiptoes', es: 'De pie, pies planos, gemelo relajado — no de puntillas' },
  'meas.guide.calf.2':     { fr: 'Mètre horizontal, au point le plus large', en: 'Tape horizontal, at widest point', es: 'Cinta horizontal, en el punto más ancho' },
```

- [ ] **Step 2: Refactor MeasurementsEntrySheet to use lang**

Open `components/client/metrics/MeasurementsEntrySheet.tsx`. Replace the entire file up through the `FIELDS` array (lines 1–167) with:

```typescript
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Info } from 'lucide-react'
import { ct, cta, type ClientLang } from '@/lib/i18n/clientTranslations'

interface Field {
  key: string
  labelKey: string
  unit: string
  guideKeys?: string[]
}

const FIELD_DEFS: Field[] = [
  { key: 'weight_kg',                 labelKey: 'meas.weight',    unit: 'kg' },
  { key: 'neck_cm',                   labelKey: 'meas.neck',      unit: 'cm', guideKeys: ['meas.guide.neck.0',     'meas.guide.neck.1',     'meas.guide.neck.2']     },
  { key: 'shoulder_circumference_cm', labelKey: 'meas.shoulders', unit: 'cm', guideKeys: ['meas.guide.shoulders.0','meas.guide.shoulders.1','meas.guide.shoulders.2'] },
  { key: 'chest_cm',                  labelKey: 'meas.chest',     unit: 'cm', guideKeys: ['meas.guide.chest.0',    'meas.guide.chest.1',    'meas.guide.chest.2']    },
  { key: 'waist_cm',                  labelKey: 'meas.waist',     unit: 'cm', guideKeys: ['meas.guide.waist.0',    'meas.guide.waist.1',    'meas.guide.waist.2']    },
  { key: 'hips_cm',                   labelKey: 'meas.hips',      unit: 'cm', guideKeys: ['meas.guide.hips.0',     'meas.guide.hips.1',     'meas.guide.hips.2']     },
  { key: 'glute_cm',                  labelKey: 'meas.glutes',    unit: 'cm', guideKeys: ['meas.guide.glutes.0',   'meas.guide.glutes.1',   'meas.guide.glutes.2']   },
  { key: 'arm_left_cm',               labelKey: 'meas.armLeft',   unit: 'cm', guideKeys: ['meas.guide.arm.0',      'meas.guide.arm.1',      'meas.guide.arm.2']      },
  { key: 'arm_right_cm',              labelKey: 'meas.armRight',  unit: 'cm', guideKeys: ['meas.guide.arm.0',      'meas.guide.arm.1',      'meas.guide.arm.2']      },
  { key: 'forearm_left_cm',           labelKey: 'meas.forearmLeft',  unit: 'cm', guideKeys: ['meas.guide.forearm.0','meas.guide.forearm.1','meas.guide.forearm.2'] },
  { key: 'forearm_right_cm',          labelKey: 'meas.forearmRight', unit: 'cm', guideKeys: ['meas.guide.forearm.0','meas.guide.forearm.1','meas.guide.forearm.2'] },
  { key: 'thigh_left_cm',             labelKey: 'meas.thighLeft', unit: 'cm', guideKeys: ['meas.guide.thigh.0',   'meas.guide.thigh.1',   'meas.guide.thigh.2']   },
  { key: 'thigh_right_cm',            labelKey: 'meas.thighRight',unit: 'cm', guideKeys: ['meas.guide.thigh.0',   'meas.guide.thigh.1',   'meas.guide.thigh.2']   },
  { key: 'calf_left_cm',              labelKey: 'meas.calfLeft',  unit: 'cm', guideKeys: ['meas.guide.calf.0',    'meas.guide.calf.1',    'meas.guide.calf.2']    },
  { key: 'calf_right_cm',             labelKey: 'meas.calfRight', unit: 'cm', guideKeys: ['meas.guide.calf.0',    'meas.guide.calf.1',    'meas.guide.calf.2']    },
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: () => Promise<void> | void
  lang?: ClientLang
}
```

Then in the component body, replace every `FIELDS` reference with `FIELD_DEFS`, and replace every `f.label` with `ct(lang ?? 'fr', f.labelKey as any)`, every `f.guide` with `f.guideKeys?.map(k => ct(lang ?? 'fr', k as any))`, and `'Enregistrement…'` with `ct(lang ?? 'fr', 'meas.saving')`.

- [ ] **Step 3: Thread `lang` from MetricsClientPage**

Open `components/client/MetricsClientPage.tsx`. Add `lang?: ClientLang` to the `Props` interface, then pass it to `<MeasurementsEntrySheet lang={lang} .../>`.

Find where `MetricsClientPage` is used in `app/client/metrics/page.tsx` and pass `lang={lang}` (get `lang` from the client profile/session same as other pages).

- [ ] **Step 4: TypeScript check**
```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -E "MeasurementsEntry|MetricsClient|metrics/page" | head -20
```
Expected: 0 errors.

- [ ] **Step 5: Commit**
```bash
git add lib/i18n/clientTranslations.ts components/client/metrics/MeasurementsEntrySheet.tsx components/client/MetricsClientPage.tsx app/client/metrics/page.tsx
git commit -m "feat(i18n): localize measurement field labels and anatomical guides (ES+EN)"
```

---

## Task 3 — i18n keys: cycle toasts + LogPeriodSheet

**Files:**
- Modify: `lib/i18n/clientTranslations.ts`
- Modify: `components/client/cycle/LogPeriodSheet.tsx`
- Modify: `components/client/QuickLogSheet.tsx`
- Modify: `components/client/profile/ProfilAccordion.tsx`

- [ ] **Step 1: Add cycle toast keys to clientTranslations.ts**

Add after the `meas.*` keys:

```typescript
  'cycle.periodUpdated':  { fr: 'Cycle mis à jour · Phase : {phase}', en: 'Cycle updated · Phase: {phase}', es: 'Ciclo actualizado · Fase: {phase}' },
  'cycle.periodEnded':    { fr: 'Fin de règles enregistrée',          en: 'Period end logged',               es: 'Fin del período registrado' },
```

- [ ] **Step 2: Add `lang` prop to LogPeriodSheet and use i18n**

Open `components/client/cycle/LogPeriodSheet.tsx`. Add import:
```typescript
import { ct, type ClientLang } from '@/lib/i18n/clientTranslations'
```

Add `lang?: ClientLang` to the Props interface.

Replace line 48 (success message after logStart):
```typescript
setSuccessMsg(ct(lang ?? 'fr', 'cycle.periodUpdated', { phase: phaseName }))
```

Replace line 70 (success message after logEnd):
```typescript
setSuccessMsg(ct(lang ?? 'fr', 'cycle.periodEnded'))
```

- [ ] **Step 3: Thread `lang` to LogPeriodSheet from both call sites**

**`components/client/QuickLogSheet.tsx`** — add `lang?: ClientLang` prop to `QuickLogSheet`, pass to `<LogPeriodSheet lang={lang} .../>`.

**`components/client/profile/ProfilAccordion.tsx`** — add `lang?: ClientLang` prop, pass to `<LogPeriodSheet lang={lang} .../>`.

Then thread `lang` from parent pages to these components (same pattern as MetricsClientPage).

- [ ] **Step 4: TypeScript check**
```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -E "LogPeriod|QuickLog|ProfilAccordion" | head -20
```

- [ ] **Step 5: Commit**
```bash
git add lib/i18n/clientTranslations.ts components/client/cycle/LogPeriodSheet.tsx components/client/QuickLogSheet.tsx components/client/profile/ProfilAccordion.tsx
git commit -m "feat(i18n): localize cycle period toast messages (ES+EN)"
```

---

## Task 4 — Migration: food_item_translations

**Files:**
- Create: `supabase/migrations/20260602_food_item_translations.sql`

### Context

`food_items` table has `name_fr text NOT NULL` as the only name column. We create a `food_item_translations` table (same pattern as `exercise_translations`, `muscle_translations`) with a FR backfill so existing data is not broken. The API can then join this table and return localized names.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260602_food_item_translations.sql`:

```sql
-- food_item_translations: multilingual names for food items
-- Follows same pattern as exercise_translations, muscle_translations

CREATE TABLE IF NOT EXISTS food_item_translations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  food_item_id uuid        NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
  lang         text        NOT NULL CHECK (lang IN ('fr', 'en', 'es')),
  name         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (food_item_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_food_item_translations_food_item ON food_item_translations(food_item_id);
CREATE INDEX IF NOT EXISTS idx_food_item_translations_lang      ON food_item_translations(lang);

-- Backfill FR from existing name_fr (idempotent)
INSERT INTO food_item_translations (food_item_id, lang, name)
SELECT id, 'fr', name_fr
FROM food_items
ON CONFLICT (food_item_id, lang) DO NOTHING;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with the SQL above, targeting the production project.

Verify by running:
```sql
SELECT COUNT(*) FROM food_item_translations WHERE lang = 'fr';
```
Expected: same count as `SELECT COUNT(*) FROM food_items`.

- [ ] **Step 3: Commit migration file**
```bash
git add supabase/migrations/20260602_food_item_translations.sql
git commit -m "schema: add food_item_translations table with FR backfill"
```

---

## Task 5 — food-items API: localized search + response

**Files:**
- Modify: `app/api/client/food-items/route.ts`

### Context

The GET handler currently selects only `name_fr` and searches/sorts by it. We need to:
1. JOIN `food_item_translations` for the requested lang
2. Use the translated name (or fallback to `name_fr`) in the response
3. Apply the search scoring to the translated name when lang ≠ `fr`

The client's lang is passed via the `x-client-lang` request header (set by the client app for all API calls) OR via a `lang` query param.

- [ ] **Step 1: Update GET handler to accept lang and join translations**

In `app/api/client/food-items/route.ts`, inside the `GET` handler, add lang resolution after the auth check:

```typescript
const lang = (searchParams.get('lang') ?? req.headers.get('x-client-lang') ?? 'fr') as 'fr' | 'en' | 'es'
```

Update the Supabase select to include translations:

```typescript
let query = db
  .from("food_items")
  .select(`
    id, name_fr, category_l1, category_l2, item_key,
    kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
    source, client_id,
    food_item_translations!food_item_translations_food_item_id_fkey(lang, name)
  `)
  .order("name_fr")
  .limit(fetchLimit)
```

- [ ] **Step 2: Add localized name resolution helper**

Add this helper function before the GET handler:

```typescript
function resolveLocalizedName(
  item: { name_fr: string; food_item_translations?: Array<{ lang: string; name: string }> | null },
  lang: 'fr' | 'en' | 'es'
): string {
  if (lang === 'fr') return item.name_fr
  return item.food_item_translations?.find(t => t.lang === lang)?.name ?? item.name_fr
}
```

- [ ] **Step 3: Apply localized name to search and response**

In the search scoring section, replace `scoreFoodSearchMatch(item.name_fr, normalizedQuery)` with:

```typescript
const localName = resolveLocalizedName(item, lang)
score: scoreFoodSearchMatch(localName, normalizedQuery),
```

In the final response map, replace `...item` spread with explicit fields that include `name` (localized):

```typescript
return NextResponse.json({
  data: filteredItems.map((item) => ({
    id: item.id,
    name_fr: item.name_fr,
    name: resolveLocalizedName(item, lang),  // localized name for display
    category_l1: recommendFoodCategory({ ...item, is_verified: item.source === 'internal' }),
    category_l2: item.category_l2,
    item_key: item.item_key,
    kcal_per_100g: item.kcal_per_100g,
    protein_per_100g: item.protein_per_100g,
    carbs_per_100g: item.carbs_per_100g,
    fat_per_100g: item.fat_per_100g,
    fiber_per_100g: item.fiber_per_100g,
    source: item.source,
    client_id: item.client_id,
  })),
  total: filteredItems.length,
})
```

- [ ] **Step 4: Update FoodItem type to include `name`**

In `lib/nutrition/food-items.ts`, add `name?: string` to the `FoodItem` interface (optional, falls back to `name_fr` in consuming code).

- [ ] **Step 5: Update client food search components to display `name` over `name_fr`**

Run:
```bash
grep -rn "name_fr" /Users/user/Desktop/STRYVLAB/components/client/ --include="*.tsx" | grep -v "node_modules"
```

For each component that displays `item.name_fr` to the user, replace with `item.name ?? item.name_fr`.

- [ ] **Step 6: TypeScript check**
```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -E "food-items|food-item|FoodItem" | head -20
```

- [ ] **Step 7: Commit**
```bash
git add app/api/client/food-items/route.ts lib/nutrition/food-items.ts
git commit -m "feat(nutrition): localized food item names via food_item_translations join"
```

---

## Task 6 — Seed: ES + EN food translations via LLM batch

**Files:**
- Create: `scripts/seed-food-translations.ts`

### Context

~3230 food items need ES and EN names. We batch them 100 at a time through the OpenAI API, then upsert into `food_item_translations`. The script is idempotent (ON CONFLICT DO NOTHING) so it can be re-run safely.

**Supplement note:** The 47 supplement items in `data/nutrition/supplements.csv` are already in `food_items` (seeded earlier). They get the same LLM treatment — no special case needed.

- [ ] **Step 1: Create the seed script**

Create `scripts/seed-food-translations.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const BATCH_SIZE = 100
const TARGET_LANGS: Array<{ lang: 'es' | 'en'; instruction: string }> = [
  {
    lang: 'es',
    instruction: 'Translate the following French food names to Spanish. Use standard culinary/food Spanish terminology (not literal translation). Return a JSON array of objects {id, name}.',
  },
  {
    lang: 'en',
    instruction: 'Translate the following French food names to English. Use standard culinary/food English terminology. Return a JSON array of objects {id, name}.',
  },
]

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  // Fetch all food items not yet translated to ES or EN
  for (const { lang, instruction } of TARGET_LANGS) {
    console.log(`\n=== Translating to ${lang.toUpperCase()} ===`)

    // Get items missing this lang
    const { data: allItems } = await db.from('food_items').select('id, name_fr').order('name_fr')
    if (!allItems) { console.error('Failed to fetch food items'); process.exit(1) }

    const { data: existingTranslations } = await db
      .from('food_item_translations')
      .select('food_item_id')
      .eq('lang', lang)
    const existingIds = new Set((existingTranslations ?? []).map(t => t.food_item_id))
    const toTranslate = allItems.filter(item => !existingIds.has(item.id))

    console.log(`${toTranslate.length} items to translate (${allItems.length - toTranslate.length} already done)`)

    let translated = 0
    for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
      const batch = toTranslate.slice(i, i + BATCH_SIZE)
      const inputJson = JSON.stringify(batch.map(item => ({ id: item.id, name: item.name_fr })))

      let attempts = 0
      while (attempts < 3) {
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0,
            messages: [
              { role: 'system', content: instruction },
              { role: 'user', content: inputJson },
            ],
            response_format: { type: 'json_object' },
          })

          const raw = response.choices[0].message.content ?? '{}'
          // GPT returns { items: [...] } or { translations: [...] } — find the array
          const parsed = JSON.parse(raw)
          const results: Array<{ id: string; name: string }> =
            Array.isArray(parsed) ? parsed : Object.values(parsed).find(v => Array.isArray(v)) as any ?? []

          const rows = results
            .filter(r => r.id && r.name)
            .map(r => ({ food_item_id: r.id, lang, name: r.name }))

          if (rows.length > 0) {
            const { error } = await db
              .from('food_item_translations')
              .upsert(rows, { onConflict: 'food_item_id,lang', ignoreDuplicates: true })
            if (error) throw error
          }

          translated += rows.length
          console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${rows.length} rows inserted (total: ${translated})`)
          break
        } catch (err) {
          attempts++
          console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (attempt ${attempts}):`, err)
          if (attempts >= 3) console.error('  Skipping batch after 3 failures')
          else await new Promise(r => setTimeout(r, 2000 * attempts))
        }
      }
    }

    console.log(`${lang.toUpperCase()} done: ${translated} translations inserted`)
  }
}

main().catch(console.error)
```

- [ ] **Step 2: Run the script**

```bash
cd /Users/user/Desktop/STRYVLAB
NEXT_PUBLIC_SUPABASE_URL=<value> SUPABASE_SERVICE_ROLE_KEY=<value> OPENAI_API_KEY=<value> \
  npx tsx scripts/seed-food-translations.ts
```

Expected output: ~3230 ES translations + ~3230 EN translations inserted over ~65 batches per lang.

- [ ] **Step 3: Verify counts**

Run via Supabase MCP:
```sql
SELECT lang, COUNT(*) FROM food_item_translations GROUP BY lang ORDER BY lang;
```
Expected:
```
en  | ~3230
es  | ~3230
fr  | ~3230
```

- [ ] **Step 4: Spot-check quality** (manual)

Query 10 random ES translations and verify culinary accuracy:
```sql
SELECT fi.name_fr, t.name AS name_es
FROM food_item_translations t
JOIN food_items fi ON fi.id = t.food_item_id
WHERE t.lang = 'es'
ORDER BY RANDOM()
LIMIT 10;
```

- [ ] **Step 5: Commit**
```bash
git add scripts/seed-food-translations.ts
git commit -m "chore(seed): LLM batch translation script for food_item_translations (ES+EN)"
```

---

## Task 7 — Migration: ai_chat_lang on coach_ai_settings_per_client

**Files:**
- Create: `supabase/migrations/20260602_ai_coach_chat_lang.sql`

### Context

Per-client AI settings are in `coach_ai_settings_per_client` (not `coach_clients`). This is where `ai_tone`, `coaching_freedom`, `ai_llm_enabled` etc. live. `ai_chat_lang` belongs here.

`buildSystemPrompt.ts` already queries this table to get `ai_tone` — adding `ai_chat_lang` to that same select is trivial.

For resolving the response language: `ai_chat_lang` (coach override) → `display_lang` from `coach_clients` (client preference) → `'fr'` (default).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260602_ai_coach_chat_lang.sql`:

```sql
ALTER TABLE coach_ai_settings_per_client
  ADD COLUMN IF NOT EXISTS ai_chat_lang text NULL
  CHECK (ai_chat_lang IN ('fr', 'es', 'en'));

COMMENT ON COLUMN coach_ai_settings_per_client.ai_chat_lang IS
  'Language for AI chat responses. NULL = inherit from client display_lang preference.';
```

- [ ] **Step 2: Apply migration**

Use `mcp__plugin_supabase_supabase__apply_migration`. Verify:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'coach_ai_settings_per_client' AND column_name = 'ai_chat_lang';
```

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20260602_ai_coach_chat_lang.sql
git commit -m "schema: add ai_chat_lang to coach_ai_settings_per_client"
```

---

## Task 8 — AI settings API: expose ai_chat_lang

**Files:**
- Modify: `app/api/clients/[clientId]/ai-settings/route.ts`

- [ ] **Step 1: Update GET select**

In the GET handler, find the select:
```typescript
.select('ai_llm_enabled, ai_tone, monthly_quota, ai_morning_routine_enabled, ai_evening_routine_enabled, coaching_freedom')
```

Replace with:
```typescript
.select('ai_llm_enabled, ai_tone, monthly_quota, ai_morning_routine_enabled, ai_evening_routine_enabled, coaching_freedom, ai_chat_lang')
```

Update the fallback defaults object to include:
```typescript
ai_chat_lang: null as string | null,
```

- [ ] **Step 2: Update PUT Zod schema**

Find the `updateSchema` (or equivalent). Add:
```typescript
ai_chat_lang: z.enum(['fr', 'es', 'en']).nullable().optional(),
```

Update the `update` call to include `ai_chat_lang` in the fields written to DB.

- [ ] **Step 3: Update AiSettings type in the widget**

In `components/coach/AiCoachSettingsWidget.tsx`, update the `AiSettings` type:
```typescript
type AiSettings = {
  ai_llm_enabled: boolean;
  ai_tone: string | null;
  monthly_quota: number | null;
  ai_morning_routine_enabled: boolean;
  ai_evening_routine_enabled: boolean;
  coaching_freedom: CoachingFreedom;
  ai_chat_lang: 'fr' | 'es' | 'en' | null;
};
```

- [ ] **Step 4: Add lang selector UI to AiCoachSettingsWidget**

Inside the `{settings.ai_llm_enabled && (...)}` block, after the "Liberté de coaching IA" section, add:

```tsx
<div>
  <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-1.5">
    Langue du chat IA
  </label>
  <div className="grid grid-cols-4 gap-1.5">
    {([
      { value: null,  label: 'Auto',     hint: 'Langue du client' },
      { value: 'fr',  label: 'Français', hint: 'Toujours FR' },
      { value: 'es',  label: 'Español',  hint: 'Toujours ES' },
      { value: 'en',  label: 'English',  hint: 'Toujours EN' },
    ] as Array<{ value: 'fr' | 'es' | 'en' | null; label: string; hint: string }>).map((opt) => {
      const active = (settings.ai_chat_lang ?? null) === opt.value
      return (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => updateSettings({ ai_chat_lang: opt.value })}
          className={`rounded-xl border-[0.3px] px-2 py-2 text-left transition-colors ${
            active
              ? 'border-[#1f8a65]/40 bg-[#1f8a65]/[0.08]'
              : 'border-white/[0.06] bg-[#0a0a0a] hover:bg-white/[0.03]'
          }`}
        >
          <p className={`text-[11px] font-semibold ${active ? 'text-[#1f8a65]' : 'text-white/70'}`}>
            {opt.label}
          </p>
          <p className="mt-0.5 text-[9px] leading-snug text-white/35">{opt.hint}</p>
        </button>
      )
    })}
  </div>
  <p className="mt-1.5 text-[9px] leading-relaxed text-white/30">
    "Auto" utilise la langue choisie par le client dans ses préférences.
  </p>
</div>
```

- [ ] **Step 5: TypeScript check**
```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -E "ai-settings|AiCoachSettings" | head -20
```

- [ ] **Step 6: Commit**
```bash
git add app/api/clients/\[clientId\]/ai-settings/route.ts components/coach/AiCoachSettingsWidget.tsx
git commit -m "feat(coach): ai_chat_lang selector in AI coach settings widget"
```

---

## Task 9 — buildSystemPrompt: inject language directive

**Files:**
- Modify: `lib/client/ai-coach/buildSystemPrompt.ts`

### Context

`buildSystemPrompt.ts` currently queries `coach_ai_settings_per_client` for `ai_tone` only (via `perClientToneResult`). We need to:
1. Also select `ai_chat_lang` from that same query
2. Query `display_lang` from `coach_clients` (already queried for `first_name` etc.)
3. Resolve final lang: `ai_chat_lang ?? display_lang ?? 'fr'`
4. Append a language directive to the system prompt

- [ ] **Step 1: Update coach_clients select to include display_lang**

Find the query (around line 43–47):
```typescript
const { data: profileData } = await db
  .from('coach_clients')
  .select('first_name, goal, tdee, fitness_level, coach_id')
  .eq('id', clientId)
  .single()
```

Replace with:
```typescript
const { data: profileData } = await db
  .from('coach_clients')
  .select('first_name, goal, tdee, fitness_level, coach_id, display_lang')
  .eq('id', clientId)
  .single()
```

Add after the existing variable extractions:
```typescript
const clientDisplayLang = (profileData?.display_lang ?? 'fr') as 'fr' | 'es' | 'en'
```

- [ ] **Step 2: Update per-client AI settings select to include ai_chat_lang**

Find the parallel query for `perClientToneResult` (around line 147):
```typescript
db.from('coach_ai_settings_per_client').select('ai_tone').eq('client_id', clientId).maybeSingle(),
```

Replace with:
```typescript
db.from('coach_ai_settings_per_client').select('ai_tone, ai_chat_lang').eq('client_id', clientId).maybeSingle(),
```

- [ ] **Step 3: Extract ai_chat_lang and resolve final chat language**

After the `const tone = resolveTone(...)` line (around line 156), add:

```typescript
// ── Chat language ──────────────────────────────────────────────────────────
const perClientSettings = perClientToneResult.status === 'fulfilled' ? (perClientToneResult.value as any)?.data : null
const coachLangOverride = perClientSettings?.ai_chat_lang as 'fr' | 'es' | 'en' | null ?? null
const chatLang: 'fr' | 'es' | 'en' = coachLangOverride ?? clientDisplayLang

const LANG_DIRECTIVE: Record<'fr' | 'es' | 'en', string> = {
  fr: "Tu réponds TOUJOURS en français, quelle que soit la langue utilisée par le client.",
  es: "Respondes SIEMPRE en español, sin importar el idioma que use el cliente.",
  en: "You ALWAYS reply in English, regardless of the language used by the client.",
}
```

- [ ] **Step 4: Append lang directive to the returned system prompt**

At the very end of `buildSystemPrompt`, find the `return` statement that returns the prompt string. Append the directive:

```typescript
return [
  existingPromptContent,
  LANG_DIRECTIVE[chatLang],
].join('\n\n')
```

(Adapt to match the actual return structure in the file — the directive must be the last instruction so the model sees it as highest priority.)

- [ ] **Step 5: TypeScript check**
```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "buildSystemPrompt" | head -10
```

- [ ] **Step 6: Commit**
```bash
git add lib/client/ai-coach/buildSystemPrompt.ts
git commit -m "feat(ai-coach): inject language directive from ai_chat_lang or client display_lang"
```

---

## Task 10 — End-to-end validation

- [ ] **Step 1: Set a test client to `display_lang = 'es'` and open the PWA**

Verify: every visible string on every client page is in Spanish. No French text visible.

- [ ] **Step 2: ChatPage validation**
- Greeting shows `"Hola {name} 👋"` or `"Hola 👋"`
- Subtitle shows Spanish
- Quick suggestions show 3 Spanish strings

- [ ] **Step 3: Nutrition food search validation**
- Search "pollo" returns "Pollo" items
- Search "pan" returns bread items with Spanish names
- Fallback: if item has no ES translation, `name_fr` is shown (not blank)

- [ ] **Step 4: Measurements validation**
- Open MeasurementsEntrySheet
- All 15 field labels are in Spanish
- Guide text for each measurement is in Spanish

- [ ] **Step 5: Cycle tracking validation**
- Trigger period start/end
- Success toast shows Spanish message

- [ ] **Step 6: AI chat language validation**
- Coach sets `ai_chat_lang = 'es'` in AiCoachSettingsWidget
- Client sends any message in any language
- Bot responds in Spanish

- [ ] **Step 7: Coach lang override validation**
- Coach sets `ai_chat_lang = 'fr'`
- Client has `display_lang = 'es'`
- Bot responds in French (coach override wins)

- [ ] **Step 8: Final TypeScript check (clean)**
```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```
Expected: 0 new errors (pre-existing errors in test files are OK per project-state.md).

- [ ] **Step 9: Update CHANGELOG.md**

Add under today's date:
```
FEATURE: Full Spanish (ES) translation — UI strings, food item database, AI coach language config
SCHEMA: food_item_translations table with FR backfill + ES/EN seed via LLM batch
SCHEMA: ai_chat_lang column on coach_ai_settings_per_client
FEATURE: Coach can configure per-client AI chat language (fr/es/en/auto)
```

- [ ] **Step 10: Update project-state.md**

Add new module row:
```
| **PWA ES Translation (Deep)** | ✅ Done | 2026-06-02 |
```

Add dated section describing what was done.

- [ ] **Step 11: Final commit**
```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update changelog and project-state for ES translation deep pass"
```
