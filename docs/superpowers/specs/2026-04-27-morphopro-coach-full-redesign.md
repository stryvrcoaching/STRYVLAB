# MorphoPro — Refonte Complète (Coach-Only)

**Date :** 2026-04-27  
**Statut :** Approuvé — prêt pour implémentation  
**Scope :** Remplacement complet du système MorphoPro existant — galerie photos, canvas d'annotation, analyse IA structurée, affichage résultats, intégration scoring programme  
**Coach-only :** La page client `/client/morpho` est hors scope (Phase 2 ultérieure)

---

## 1. Contexte & Problèmes Actuels

### Ce qui existe (à remplacer)

- `components/clients/MorphoAnalysisSection.tsx` — widget minimaliste, non fonctionnel
- `jobs/morpho/analyzeMorphoJob.ts` — job Inngest avec prompt OpenAI non structuré (regex parsing)
- `lib/morpho/analyze.ts`, `parse.ts`, `adjustments.ts` — helpers avec regex fragiles
- `app/api/clients/[clientId]/morpho/` — routes analyze, latest, job-status, analyses

### Pourquoi ça ne fonctionne pas

1. **Prompt OpenAI non structuré** : le prompt demande du texte libre + parsing regex → OpenAI répond "not visible in photo" pour les mesures visuellement impossibles (body fat %, circumferences en cm depuis une photo sans référence)
2. **Données biométriques ignorées** : poids, taille, % MG existent déjà dans les bilans et les métriques — le système ne les exploite pas
3. **Pas de galerie** : les photos des bilans ne sont pas centralisées ni accessibles dans un espace dédié
4. **Pas de canvas** : aucune annotation possible
5. **Pas de score structuré** : pas de score 0–100, pas de flags par zone, pas de recommandations

### Ce qu'on construit

Un outil MorphoPro complet en 3 piliers :
1. **Galerie** — centraliser toutes les photos (bilans + uploads coach), filtres, upload
2. **Canvas d'annotation** — Fabric.js, outils de tracé, angles, mesures, save/export
3. **Analyse IA** — GPT-4o avec `response_format: json_object`, score structuré, flags, recommandations, évolution timeline

---

## 2. Data Model

### 2.1 Table `morpho_photos` (nouvelle)

```sql
create table public.morpho_photos (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid not null references public.coach_clients(id) on delete cascade,
  coach_id               uuid not null references auth.users(id),
  storage_path           text not null,
  position               text not null check (position in (
                           'front', 'back', 'left', 'right',
                           'three_quarter_front_left', 'three_quarter_front_right'
                         )),
  taken_at               date not null,
  source                 text not null check (source in ('assessment', 'coach_upload')),
  assessment_response_id uuid unique references public.assessment_responses(id) on delete set null,
  notes                  text,
  created_at             timestamptz not null default now()
);

create index morpho_photos_client_id_idx on public.morpho_photos(client_id);
create index morpho_photos_taken_at_idx on public.morpho_photos(client_id, taken_at desc);
```

**RLS :**
- Coach : SELECT/INSERT/UPDATE/DELETE sur ses clients (`client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())`)

### 2.2 Table `morpho_annotations` (nouvelle)

```sql
create table public.morpho_annotations (
  id                uuid primary key default gen_random_uuid(),
  photo_id          uuid not null references public.morpho_photos(id) on delete cascade,
  coach_id          uuid not null references auth.users(id),
  canvas_data       jsonb not null default '{}',
  thumbnail_path    text,
  analysis_snapshot jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (photo_id, coach_id)
);

create trigger morpho_annotations_updated_at
  before update on public.morpho_annotations
  for each row execute function public.set_updated_at();
```

**RLS :** Coach : SELECT/INSERT/UPDATE sur ses propres annotations (`coach_id = auth.uid()`)

### 2.3 Table `morpho_analyses` (existante — à modifier)

La table existe déjà. On modifie le champ `raw_payload` pour stocker le JSON structuré GPT-4o (au lieu du texte libre), et on ajoute `photo_ids uuid[]` pour tracer quelles photos ont été analysées.

```sql
alter table public.morpho_analyses
  add column if not exists photo_ids uuid[] default '{}';
```

Le schéma JSONB des champs `body_composition`, `asymmetries`, `stimulus_adjustments` reste compatible — on ajoute un champ `analysis_result jsonb` pour le résultat structuré complet (score, flags, attention_points, recommendations).

```sql
alter table public.morpho_analyses
  add column if not exists analysis_result jsonb;
```

---

## 3. Architecture des Composants

```
app/coach/clients/[clientId]/data/morphopro/page.tsx   ← page existante, remplacée
components/morpho/
  MorphoGallery.tsx          ← galerie principale + filtres
  MorphoUploadModal.tsx      ← modal upload photo coach
  MorphoCanvas.tsx           ← canvas Fabric.js plein écran
  MorphoCompare.tsx          ← comparaison 2–4 photos
  MorphoAnalysisPanel.tsx    ← panel résultats IA
  MorphoEvolutionChart.tsx   ← graphique score dans le temps
lib/morpho/
  buildAnalysisPrompt.ts     ← nouveau prompt structuré JSON
  analyze.ts                 ← conservé, getPhotoUrlsFromSubmission réutilisé
  parse.ts                   ← déprécié (remplacé par JSON parse)
  adjustments.ts             ← conservé, calculateStimulusAdjustments réutilisé
```

---

## 4. API Layer

### 4.1 `POST /api/morpho/photos/sync`

- Auth coach, body `{ clientId }`
- Indexe les `assessment_responses` avec `storage_path IS NOT NULL` et `field_key LIKE 'photo_%'` pour ce client
- Upsert `morpho_photos` avec `source='assessment'`, `ON CONFLICT (assessment_response_id) DO NOTHING`
- Retourne `{ synced: N }` — nombre de nouvelles photos indexées

### 4.2 `POST /api/morpho/photos/upload`

- Auth coach, ownership check client
- Body : `{ clientId, position, takenAt, notes? }` + fichier multipart
- Upload vers Supabase Storage bucket `morpho-photos` (nouveau bucket, séparé de `assessment-photos`)
- Crée `morpho_photos` avec `source='coach_upload'`
- Retourne `{ photo_id, storage_path, signed_url }`

### 4.3 `GET /api/morpho/photos`

- Query params : `clientId`, `position?`, `from?`, `to?`, `source?`
- Retourne `morpho_photos` avec signed URLs (1h) + présence d'annotation (boolean + thumbnail_path)
- Triées par `taken_at DESC`

### 4.4 `POST /api/morpho/annotations`

- Auth coach
- Body : `{ photoId, canvasData, thumbnailBase64? }`
- Upload thumbnail vers Storage si fourni (`morpho-photos/thumbnails/`)
- Upsert `morpho_annotations` sur `(photo_id, coach_id)`

### 4.5 `POST /api/morpho/analyze` (remplace `/api/clients/[clientId]/morpho/analyze`)

- Auth coach, ownership check client
- Body : `{ photoIds: string[], clientId }`
- Récupère signed URLs des photos (max 4)
- Récupère le contexte client depuis bilans/métriques : age, sex, goal, poids, taille, % MG, blessures connues
- Appelle `lib/morpho/buildAnalysisPrompt.ts` → construit le prompt avec contexte
- Appelle OpenAI GPT-4o avec `response_format: { type: 'json_object' }`
- Calcule `stimulus_adjustments` depuis le résultat structuré via `calculateStimulusAdjustments`
- Crée/met à jour `morpho_analyses` avec `status='completed'`, `analysis_result`, `stimulus_adjustments`, `photo_ids`
- Retourne le résultat complet immédiatement (pas de job Inngest — analyse synchrone avec timeout 30s)

**Pourquoi synchrone et non Inngest ici :** Le coach déclenche l'analyse depuis le canvas ou la galerie et attend le résultat activement. Le polling complexe avec job_id est remplacé par un appel direct avec spinner. Si l'analyse dépasse 30s (rare), on affiche une erreur claire.

### 4.6 `GET /api/clients/[clientId]/morpho/latest` (existante — conservée)

Inchangée. Retourne la dernière analyse complète pour le scoring programme.

### 4.7 `GET /api/clients/[clientId]/morpho/analyses` (existante — conservée)

Inchangée. Timeline paginée pour le graphique d'évolution.

---

## 5. Prompt IA — `lib/morpho/buildAnalysisPrompt.ts`

### Principe

Le prompt injecte le contexte biométrique mesuré (poids, taille, % MG depuis bilans/métriques) et demande une analyse **uniquement visuelle** — posture, asymétries, alignement — sans estimer ce qui ne peut pas être vu.

### Structure du prompt

```typescript
export function buildAnalysisPrompt(context: {
  age?: number
  sex?: 'male' | 'female' | 'other'
  goal?: string
  weight_kg?: number
  height_cm?: number
  body_fat_pct?: number
  injuries?: string[]
  photo_positions: string[]
}): string
```

**Contenu :**

```
Tu es un expert en biomécanique et analyse posturale. Tu analyses des photos morphologiques pour un coach sportif.

CONTEXTE CLIENT :
- Âge : {age ?? 'non renseigné'}
- Sexe : {sex}
- Objectif : {goal}
- Poids : {weight_kg}kg | Taille : {height_cm}cm | MG : {body_fat_pct}%
- Blessures connues : {injuries.join(', ') || 'aucune'}
- Photos fournies : {photo_positions.join(', ')}

INSTRUCTIONS :
Analyse uniquement ce qui est visuellement observable sur les photos. Ne tente pas d'estimer le % de masse grasse ou les circumférences en cm — ces données sont déjà renseignées ci-dessus.

Concentre-toi sur :
1. Alignement postural global
2. Asymétries détectables (épaules, hanches, membres)
3. Drapeaux de sécurité (enroulement d'épaules, antéversion, scoliose apparente, etc.)
4. Recommandations d'exercices correctifs si applicable

RÈGLES SAFETY GUARD :
- Si enroulement d'épaules détecté → contraindication mouvement de poussée overhead
- Si ratio fémur/buste critique → recommander Trap Bar plutôt que barre droite
- Si asymétrie > 3° → insérer exercices unilatéraux correctifs

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte :
{
  "score": <number 0-100>,
  "posture_summary": "<string — résumé 1-2 phrases>",
  "flags": [
    { "zone": "<shoulders|pelvis|spine|knees|ankles>", "severity": "<red|orange|green>", "label": "<string>" }
  ],
  "attention_points": [
    { "priority": <1-5>, "description": "<string>", "zone": "<string>" }
  ],
  "recommendations": [
    { "type": "<exercise|correction|contraindication>", "description": "<string>", "reference": "<string ou vide>" }
  ],
  "asymmetries": {
    "shoulder_imbalance_cm": <number ou null>,
    "arm_diff_cm": <number ou null>,
    "hip_imbalance_cm": <number ou null>,
    "posture_notes": "<string>"
  },
  "stimulus_hints": {
    "dominant_pattern": "<string ou null>",
    "weak_pattern": "<string ou null>",
    "notes": "<string>"
  }
}
```

### Mapping vers `stimulus_adjustments`

Après parsing du JSON, `calculateStimulusAdjustments` utilise `asymmetries` + les règles existantes pour produire les coefficients par pattern. Les `stimulus_hints` sont informatifs pour le coach.

---

## 6. Composants UI

### 6.1 Page `morphopro/page.tsx`

Remplace le contenu actuel. Layout :

```
TopBar : "MORPHOPRO" label + titre client + bouton "+ Photo"
Corps :
  Si aucune photo → empty state avec bouton sync bilans + bouton upload
  Sinon → MorphoGallery (défaut)
Modals :
  MorphoUploadModal
  MorphoCanvas (plein écran, z-50)
  MorphoCompare (plein écran, z-50)
```

### 6.2 `MorphoGallery.tsx`

**Barre de filtres :**
- Position : chips multi-select (Face / Dos / Profil G / Profil D / ¾ G / ¾ D / Toutes)
- Source : Tous / Bilan / Upload coach
- Période : date range picker (from/to)

**Grille photos :**
- `grid-cols-3` sur desktop, `grid-cols-2` sur mobile
- Card photo : thumbnail, badge position, date, badge "Annoté" (si annotation)
- Checkbox sélection au hover

**Barre d'action flottante** (apparaît dès 1 photo cochée, `fixed bottom-24 left-1/2 -translate-x-1/2`) :
- `Comparer (N)` → ouvre MorphoCompare (max 4)
- `Annoter` → ouvre MorphoCanvas (1 photo seulement)
- `Analyser avec IA` → appelle `/api/morpho/analyze` (max 4)

**Auto-sync au premier montage :** appel à `/api/morpho/photos/sync` si 0 photos en DB pour ce client.

### 6.3 `MorphoCanvas.tsx`

Canvas Fabric.js plein écran (`fixed inset-0 z-50 bg-[#0a0a0a]`).

**Import dynamique** (SSR disabled) :
```typescript
const { Canvas, Line, ... } = await import('fabric')
```

**Toolbar gauche (outils) :**
- Sélection, Ligne, Courbe libre, Rectangle, Stylo, Cercle, Point/Marqueur, Texte libre
- Outil Angle (3 points → calcul + affichage degrés)
- Outil Mesure (2 points + calibration px/cm → distance réelle)
- Grille d'alignement (plomb vertical/horizontal, snapping)
- Gomme

**Toolbar droite (style) :**
- Couleur (color picker)
- Épaisseur trait (slider 1–10px)
- Opacité objet sélectionné
- Liste calques avec toggle visibilité

**Contrôles :**
- Undo/Redo (stack mémoire)
- Zoom + pan (molette + drag)

**Actions header :**
- `Sauvegarder` → POST `/api/morpho/annotations` avec canvas_data JSON + thumbnail PNG
- `Analyser avec IA` → trigger analyse sur cette photo + affiche MorphoAnalysisPanel en panel latéral droit
- `Exporter PNG` → `canvas.toDataURL()` → download
- `Fermer` → confirmation si modifications non sauvegardées

**Panel IA latéral** (280px, slide depuis la droite, `fixed right-0 top-0 h-full`) :
- Affiché quand une analyse existe pour cette photo
- Score global, flags, attention_points, recommandations

### 6.4 `MorphoAnalysisPanel.tsx`

Panel résultats standalone (utilisé dans canvas ET dans la galerie en drawer).

**Sections :**
1. **Score global** — jauge 0–100 (rouge < 50, orange 50–75, vert > 75) + date analyse
2. **Résumé postural** — `posture_summary` en italique
3. **Drapeaux par zone** — grille de badges (épaules / bassin / colonne / genoux / chevilles) : rouge/orange/vert
4. **Points d'attention** — liste priorisée (priorité 1 = critique en rouge)
5. **Recommandations** — liste avec badge type (exercice/correction/contraindication)
6. **Ajustements stimulus** — chips par pattern avec coefficient (ex: `vertical_pull ×1.12`) + tooltip explication
7. **Évolution** — `MorphoEvolutionChart` (score timeline)

### 6.5 `MorphoEvolutionChart.tsx`

Recharts `LineChart` — score global par date d'analyse.
- Un point par analyse complétée pour ce client
- Hover tooltip : date + score + nb de flags rouges
- Hauteur : 120px, pas de légende, accent `#1f8a65`

### 6.6 `MorphoCompare.tsx`

Modal plein écran.

**Layouts :** 1×2 | 2×2 | 1+3 (sélectable en haut)

**Chaque slot :**
- Drag & drop depuis la galerie (via state passé en props)
- Label date + position
- Bouton "Annoter ce slot"

**Mode superposition** (layout 1×2 uniquement) :
- Slider opacité 0–100% entre les 2 photos
- Toggle direction split : Horizontal / Vertical

**Smart pairing :** si 2 photos de même position sélectionnées → proposé automatiquement en 1×2

---

## 7. Suppression / Remplacement du Code Existant

| Fichier | Action |
|---------|--------|
| `components/clients/MorphoAnalysisSection.tsx` | Remplacé — ne plus utiliser |
| `jobs/morpho/analyzeMorphoJob.ts` | Supprimé — analyse synchrone désormais |
| `lib/inngest/functions/morpho-analyze.ts` | Supprimé — plus de job Inngest pour morpho |
| `lib/morpho/parse.ts` | Déprécié — conservé pour compatibilité tests, non utilisé en runtime |
| `lib/morpho/analyze.ts` | Partiellement conservé — `getPhotoUrlsFromSubmission` réutilisé |
| `lib/morpho/adjustments.ts` | Conservé intact — `calculateStimulusAdjustments` réutilisé |
| `app/api/clients/[clientId]/morpho/analyze/route.ts` | Remplacé par `/api/morpho/analyze/route.ts` |
| `app/api/clients/[clientId]/morpho/job-status/route.ts` | Supprimé |
| `app/api/clients/[clientId]/morpho/latest/route.ts` | Conservé — utilisé par scoring programme |
| `app/api/clients/[clientId]/morpho/analyses/route.ts` | Conservé — timeline |
| `app/api/inngest/route.ts` | Retirer l'enregistrement de `morphoAnalyzeFunction` |

---

## 8. Intégration Scoring Programme

Inchangée. `lib/programs/intelligence/scoring.ts` consomme `stimulus_adjustments` depuis `/api/clients/[clientId]/morpho/latest`. Le nouveau système peuple ce champ via le même chemin DB (`morpho_analyses.stimulus_adjustments`).

---

## 9. Design System

Toutes les composantes respectent DS v2.0 :

- Background principal : `bg-[#121212]`
- Cards : `bg-white/[0.02]`, bordures `border-[0.3px] border-white/[0.06]`
- Canvas : fond `#0a0a0a`, toolbars `bg-[#181818]`
- Modals plein écran : `fixed inset-0 z-50`
- Badges drapeaux :
  - Rouge : `text-red-400 bg-red-500/10 border-red-500/20`
  - Orange : `text-amber-400 bg-amber-500/10 border-amber-500/20`
  - Vert : `text-[#1f8a65] bg-[#1f8a65]/10 border-[#1f8a65]/20`
- Barre d'action flottante : `bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl px-4 py-3`

---

## 10. Dépendances à Ajouter

| Package | Version | Usage |
|---------|---------|-------|
| `fabric` | `^6.0.0` | Canvas d'annotation (ESM-only, import dynamique) |
| `jspdf` | `^2.5.0` | Export PDF |

`openai` est déjà installé.

---

## 11. Ordre de Livraison

```
1.  Migration DB           → morpho_photos + morpho_annotations + alter morpho_analyses
2.  Nouveau bucket Storage → morpho-photos (Supabase Dashboard)
3.  lib/morpho/buildAnalysisPrompt.ts  → prompt structuré JSON
4.  API /api/morpho/photos/sync        → pont bilans existants
5.  API /api/morpho/photos/upload      → upload coach
6.  API /api/morpho/photos (GET)       → galerie avec signed URLs
7.  API /api/morpho/annotations        → save canvas
8.  API /api/morpho/analyze            → analyse synchrone GPT-4o
9.  MorphoGallery                      → galerie + filtres + barre flottante
10. MorphoUploadModal                  → modal upload
11. MorphoAnalysisPanel                → panel résultats + MorphoEvolutionChart
12. MorphoCanvas                       → Fabric.js + outils + panel IA latéral
13. MorphoCompare                      → split-view + superposition
14. Page morphopro/page.tsx            → orchestration finale
15. Nettoyage                          → supprimer ancien code listé section 7
16. npx tsc --noEmit                   → 0 erreurs TypeScript
17. CHANGELOG + project-state         → docs obligatoires
```

---

## 12. Points de Vigilance

- **Fabric.js v6 ESM-only** : `dynamic(() => import('fabric'), { ssr: false })` obligatoire — ne pas importer dans un Server Component
- **Signed URLs 1h** : le canvas doit recharger la photo si la session dépasse 1h (écouter les erreurs 401 sur l'image)
- **canvas_data JSONB** : peut peser 50–200KB par annotation complexe — acceptable, pas de compression Phase 1
- **Analyse synchrone 30s** : si OpenAI dépasse le timeout Next.js (par défaut 30s sur Vercel), configurer `export const maxDuration = 60` sur la route API
- **Bucket morpho-photos** : créer manuellement dans Supabase Dashboard avant déploiement — ne pas réutiliser `assessment-photos` (séparation des responsabilités)
- **Assessment responses field_key** : la sync vérifie `field_key LIKE 'photo_%'` ET `storage_path IS NOT NULL` — les réponses texte ne sont pas indexées
- **Supprimer morpho-analyze de l'Inngest route** : retirer `morphoAnalyzeFunction` de `app/api/inngest/route.ts` pour éviter un handler mort
- **Rétrocompatibilité scoring** : `/api/clients/[clientId]/morpho/latest` et `morpho_analyses.stimulus_adjustments` sont conservés tels quels — le scoring programme ne casse pas
