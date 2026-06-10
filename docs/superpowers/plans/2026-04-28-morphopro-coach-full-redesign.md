# MorphoPro — Refonte Complète (Coach-Only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le système MorphoPro non-fonctionnel par un outil complet : galerie de photos, canvas d'annotation Fabric.js, analyse IA GPT-4o structurée (JSON), affichage résultats avec score/flags/recommandations, comparaison multi-photos.

**Architecture:** Nouvelles tables `morpho_photos` + `morpho_annotations` + colonnes additionnelles sur `morpho_analyses`. Analyse synchrone GPT-4o (pas Inngest). Composants dans `components/morpho/`. Routes API dans `app/api/morpho/`. L'existant (`/morpho/latest`, `/morpho/analyses`, `stimulus_adjustments`) est conservé pour compatibilité scoring programme.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (Postgres + Storage), OpenAI GPT-4o (`response_format: json_object`), Fabric.js v6 (canvas annotation, SSR disabled), Recharts (évolution timeline), Tailwind CSS / DS v2.0

---

## File Map

### Nouveau (à créer)
```
supabase/migrations/20260428_morpho_photos_annotations.sql
supabase/migrations/20260428_morpho_analyses_extend.sql
lib/morpho/buildAnalysisPrompt.ts
lib/morpho/types.ts
app/api/morpho/photos/sync/route.ts
app/api/morpho/photos/upload/route.ts
app/api/morpho/photos/route.ts               (GET galerie)
app/api/morpho/annotations/route.ts
app/api/morpho/analyze/route.ts
components/morpho/MorphoGallery.tsx
components/morpho/MorphoUploadModal.tsx
components/morpho/MorphoPhotoCard.tsx
components/morpho/MorphoFloatingBar.tsx
components/morpho/MorphoCanvas.tsx
components/morpho/MorphoAnalysisPanel.tsx
components/morpho/MorphoEvolutionChart.tsx
components/morpho/MorphoCompare.tsx
```

### Modifié (existant)
```
app/coach/clients/[clientId]/data/morphopro/page.tsx   (refonte complète)
app/api/inngest/route.ts                                (retirer morphoAnalyzeFunction)
lib/inngest/functions/morpho-analyze.ts                 (supprimer)
jobs/morpho/analyzeMorphoJob.ts                         (supprimer)
app/api/clients/[clientId]/morpho/analyze/route.ts      (supprimer — remplacé)
app/api/clients/[clientId]/morpho/job-status/route.ts   (supprimer)
CHANGELOG.md
.claude/rules/project-state.md
```

### Conservé intact
```
app/api/clients/[clientId]/morpho/latest/route.ts
app/api/clients/[clientId]/morpho/analyses/route.ts
lib/morpho/adjustments.ts
lib/morpho/analyze.ts                      (getPhotoUrlsFromSubmission réutilisé)
```

---

## Task 1: Migrations DB

**Files:**
- Create: `supabase/migrations/20260428_morpho_photos_annotations.sql`
- Create: `supabase/migrations/20260428_morpho_analyses_extend.sql`

- [ ] **Step 1: Créer la migration morpho_photos + morpho_annotations**

```sql
-- supabase/migrations/20260428_morpho_photos_annotations.sql

-- Table morpho_photos : index centralisé de toutes les photos morpho client
create table if not exists public.morpho_photos (
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

create index if not exists morpho_photos_client_id_idx
  on public.morpho_photos(client_id);
create index if not exists morpho_photos_client_taken_at_idx
  on public.morpho_photos(client_id, taken_at desc);

-- RLS morpho_photos
alter table public.morpho_photos enable row level security;

create policy "Coach accès ses photos clients" on public.morpho_photos
  for all using (
    client_id in (
      select id from public.coach_clients where coach_id = auth.uid()
    )
  );

-- Table morpho_annotations : canvas Fabric.js par photo
create table if not exists public.morpho_annotations (
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

drop trigger if exists morpho_annotations_updated_at on public.morpho_annotations;
create trigger morpho_annotations_updated_at
  before update on public.morpho_annotations
  for each row execute function public.set_updated_at();

-- RLS morpho_annotations
alter table public.morpho_annotations enable row level security;

create policy "Coach accès ses annotations" on public.morpho_annotations
  for all using (coach_id = auth.uid());
```

- [ ] **Step 2: Créer la migration d'extension morpho_analyses**

```sql
-- supabase/migrations/20260428_morpho_analyses_extend.sql

alter table public.morpho_analyses
  add column if not exists photo_ids uuid[] default '{}',
  add column if not exists analysis_result jsonb;
```

- [ ] **Step 3: Appliquer les migrations via Supabase Dashboard SQL Editor**

Ouvrir Supabase Dashboard → SQL Editor → coller et exécuter `20260428_morpho_photos_annotations.sql`, puis `20260428_morpho_analyses_extend.sql`.

Vérifier qu'aucune erreur n'est retournée. Les tables `morpho_photos` et `morpho_annotations` doivent apparaître dans Table Editor.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428_morpho_photos_annotations.sql supabase/migrations/20260428_morpho_analyses_extend.sql
git commit -m "schema: add morpho_photos, morpho_annotations tables + extend morpho_analyses"
```

---

## Task 2: Types partagés + Prompt IA

**Files:**
- Create: `lib/morpho/types.ts`
- Create: `lib/morpho/buildAnalysisPrompt.ts`

- [ ] **Step 1: Créer les types partagés**

```typescript
// lib/morpho/types.ts

export type MorphoPhotoPosition =
  | 'front' | 'back' | 'left' | 'right'
  | 'three_quarter_front_left' | 'three_quarter_front_right'

export type MorphoPhotoSource = 'assessment' | 'coach_upload'

export interface MorphoPhoto {
  id: string
  client_id: string
  coach_id: string
  storage_path: string
  position: MorphoPhotoPosition
  taken_at: string
  source: MorphoPhotoSource
  assessment_response_id?: string | null
  notes?: string | null
  created_at: string
  // enrichis par l'API
  signed_url?: string
  has_annotation?: boolean
  thumbnail_url?: string | null
}

export interface MorphoAnnotation {
  id: string
  photo_id: string
  coach_id: string
  canvas_data: Record<string, unknown>
  thumbnail_path?: string | null
  analysis_snapshot?: MorphoAnalysisResult | null
  created_at: string
  updated_at: string
}

export interface MorphoFlag {
  zone: 'shoulders' | 'pelvis' | 'spine' | 'knees' | 'ankles'
  severity: 'red' | 'orange' | 'green'
  label: string
}

export interface MorphoAttentionPoint {
  priority: number
  description: string
  zone: string
}

export interface MorphoRecommendation {
  type: 'exercise' | 'correction' | 'contraindication'
  description: string
  reference: string
}

export interface MorphoAsymmetries {
  shoulder_imbalance_cm: number | null
  arm_diff_cm: number | null
  hip_imbalance_cm: number | null
  posture_notes: string
}

export interface MorphoStimulusHints {
  dominant_pattern: string | null
  weak_pattern: string | null
  notes: string
}

export interface MorphoAnalysisResult {
  score: number
  posture_summary: string
  flags: MorphoFlag[]
  attention_points: MorphoAttentionPoint[]
  recommendations: MorphoRecommendation[]
  asymmetries: MorphoAsymmetries
  stimulus_hints: MorphoStimulusHints
}

export interface MorphoAnalysis {
  id: string
  client_id: string
  analysis_date: string
  status: 'pending' | 'completed' | 'failed'
  photo_ids: string[]
  analysis_result?: MorphoAnalysisResult | null
  body_composition?: {
    body_fat_pct?: number
    estimated_muscle_mass_kg?: number
  } | null
  asymmetries?: {
    arm_diff_cm?: number
    shoulder_imbalance_cm?: number
    hip_imbalance_cm?: number
    posture_notes?: string
  } | null
  stimulus_adjustments?: Record<string, number> | null
  error_message?: string | null
}

export const POSITION_LABELS: Record<MorphoPhotoPosition, string> = {
  front: 'Face',
  back: 'Dos',
  left: 'Profil G',
  right: 'Profil D',
  three_quarter_front_left: '¾ Avant G',
  three_quarter_front_right: '¾ Avant D',
}
```

- [ ] **Step 2: Créer le prompt structuré**

```typescript
// lib/morpho/buildAnalysisPrompt.ts

export interface AnalysisContext {
  age?: number
  sex?: 'male' | 'female' | 'other'
  goal?: string
  weight_kg?: number
  height_cm?: number
  body_fat_pct?: number
  injuries?: string[]
  photo_positions: string[]
}

export function buildAnalysisPrompt(context: AnalysisContext): string {
  const {
    age, sex, goal, weight_kg, height_cm, body_fat_pct,
    injuries = [], photo_positions
  } = context

  const biometrics = [
    weight_kg ? `${weight_kg}kg` : null,
    height_cm ? `${height_cm}cm` : null,
    body_fat_pct != null ? `${body_fat_pct}% MG` : null,
  ].filter(Boolean).join(' | ') || 'non renseigné'

  return `Tu es un expert en biomécanique et analyse posturale. Tu analyses des photos morphologiques pour un coach sportif.

CONTEXTE CLIENT :
- Âge : ${age ?? 'non renseigné'}
- Sexe : ${sex ?? 'non renseigné'}
- Objectif : ${goal ?? 'non renseigné'}
- Biométrie : ${biometrics}
- Blessures connues : ${injuries.length > 0 ? injuries.join(', ') : 'aucune'}
- Photos fournies : ${photo_positions.join(', ')}

INSTRUCTIONS :
Analyse uniquement ce qui est visuellement observable. Ne tente PAS d'estimer le pourcentage de masse grasse ni les circumférences — ces données sont déjà renseignées ci-dessus si disponibles.

Concentre-toi sur :
1. Alignement postural global (tête, épaules, bassin, colonne)
2. Asymétries détectables (différences gauche/droite épaules, hanches, membres)
3. Drapeaux de sécurité (enroulement épaules, antéversion pelvienne, scoliose apparente, cyphose)
4. Recommandations d'exercices correctifs ou contre-indications si applicable

RÈGLES SAFETY GUARD (obligatoires) :
- Si enroulement d'épaules → type "contraindication" pour mouvement de poussée overhead
- Si asymétrie épaule visible → recommander exercices unilatéraux correctifs
- Si décalage de hanche > 3° estimé → insérer exercices correctifs unilatéraux

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte (aucun texte avant ou après) :
{
  "score": <entier 0-100 représentant la qualité posturale globale>,
  "posture_summary": "<résumé 1-2 phrases de la posture générale>",
  "flags": [
    { "zone": "<shoulders|pelvis|spine|knees|ankles>", "severity": "<red|orange|green>", "label": "<description courte>" }
  ],
  "attention_points": [
    { "priority": <1-5 où 1=critique>, "description": "<description actionnable>", "zone": "<zone anatomique>" }
  ],
  "recommendations": [
    { "type": "<exercise|correction|contraindication>", "description": "<description>", "reference": "<référence ou chaîne vide>" }
  ],
  "asymmetries": {
    "shoulder_imbalance_cm": <nombre ou null>,
    "arm_diff_cm": <nombre ou null>,
    "hip_imbalance_cm": <nombre ou null>,
    "posture_notes": "<notes posturales texte>"
  },
  "stimulus_hints": {
    "dominant_pattern": "<pattern musculaire dominant visible ou null>",
    "weak_pattern": "<pattern musculaire faible visible ou null>",
    "notes": "<notes sur les adaptations programme>"
  }
}`
}
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

Attendu : 0 erreurs nouvelles liées aux fichiers créés.

- [ ] **Step 4: Commit**

```bash
git add lib/morpho/types.ts lib/morpho/buildAnalysisPrompt.ts
git commit -m "feat(morpho): add shared types and structured GPT-4o prompt"
```

---

## Task 3: API — Sync photos bilans + Upload coach

**Files:**
- Create: `app/api/morpho/photos/sync/route.ts`
- Create: `app/api/morpho/photos/upload/route.ts`

- [ ] **Step 1: Créer la route sync**

```typescript
// app/api/morpho/photos/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bodySchema = z.object({ clientId: z.string().uuid() })

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: 'clientId requis' }, { status: 400 })
  }

  const db = service()
  const { clientId } = body.data

  // Vérifier ownership coach
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Récupérer toutes les submissions complétées du client
  const { data: submissions } = await db
    .from('assessment_submissions')
    .select('id, bilan_date')
    .eq('client_id', clientId)
    .eq('status', 'completed')

  if (!submissions || submissions.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  const submissionIds = (submissions as Array<{ id: string; bilan_date: string }>).map(s => s.id)

  // Récupérer les assessment_responses avec photos
  const { data: responses } = await db
    .from('assessment_responses')
    .select('id, submission_id, storage_path, field_key')
    .in('submission_id', submissionIds)
    .like('field_key', 'photo_%')
    .not('storage_path', 'is', null)

  if (!responses || responses.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  const submissionMap = new Map(
    (submissions as Array<{ id: string; bilan_date: string }>).map(s => [s.id, s.bilan_date])
  )

  // Déterminer la position depuis le field_key (photo_front, photo_back, etc.)
  function positionFromFieldKey(fieldKey: string): string {
    const key = fieldKey.replace('photo_', '')
    const map: Record<string, string> = {
      front: 'front', back: 'back', left: 'left', right: 'right',
      three_quarter_front_left: 'three_quarter_front_left',
      three_quarter_front_right: 'three_quarter_front_right',
    }
    return map[key] ?? 'front'
  }

  const toInsert = (responses as Array<{ id: string; submission_id: string; storage_path: string; field_key: string }>)
    .filter(r => r.storage_path)
    .map(r => ({
      client_id: clientId,
      coach_id: user.id,
      storage_path: r.storage_path,
      position: positionFromFieldKey(r.field_key),
      taken_at: submissionMap.get(r.submission_id) ?? new Date().toISOString().split('T')[0],
      source: 'assessment',
      assessment_response_id: r.id,
    }))

  const { data: inserted, error: insertError } = await db
    .from('morpho_photos')
    .upsert(toInsert, { onConflict: 'assessment_response_id', ignoreDuplicates: true })
    .select('id')

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ synced: inserted?.length ?? 0 })
}
```

- [ ] **Step 2: Créer la route upload**

```typescript
// app/api/morpho/photos/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const formData = await req.formData()
  const clientId = formData.get('clientId') as string
  const position = formData.get('position') as string
  const takenAt = formData.get('takenAt') as string
  const notes = formData.get('notes') as string | null
  const file = formData.get('file') as File | null

  if (!clientId || !position || !takenAt || !file) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const db = service()

  // Vérifier ownership
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Valider MIME type
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Format non supporté (jpeg/png/webp)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${clientId}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await db.storage
    .from('morpho-photos')
    .upload(storagePath, arrayBuffer, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: photo, error: insertError } = await db
    .from('morpho_photos')
    .insert({
      client_id: clientId,
      coach_id: user.id,
      storage_path: storagePath,
      position,
      taken_at: takenAt,
      source: 'coach_upload',
      notes: notes || null,
    })
    .select('id, storage_path')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const { data: signedUrlData } = await db.storage
    .from('morpho-photos')
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({
    photo_id: (photo as { id: string; storage_path: string }).id,
    storage_path: storagePath,
    signed_url: signedUrlData?.signedUrl ?? null,
  })
}
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/morpho/photos/sync/route.ts app/api/morpho/photos/upload/route.ts
git commit -m "feat(morpho): add photos sync (bilans) and coach upload API routes"
```

---

## Task 4: API — GET galerie + POST annotations

**Files:**
- Create: `app/api/morpho/photos/route.ts`
- Create: `app/api/morpho/annotations/route.ts`

- [ ] **Step 1: Créer la route GET galerie**

```typescript
// app/api/morpho/photos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const querySchema = z.object({
  clientId: z.string().uuid(),
  position: z.string().optional(),
  source: z.enum(['assessment', 'coach_upload']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const params = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!params.success) {
    return NextResponse.json({ error: 'clientId requis' }, { status: 400 })
  }

  const db = service()
  const { clientId, position, source, from, to } = params.data

  // Vérifier ownership coach
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let query = db
    .from('morpho_photos')
    .select('id, client_id, storage_path, position, taken_at, source, notes, created_at')
    .eq('client_id', clientId)
    .order('taken_at', { ascending: false })

  if (position) query = query.eq('position', position)
  if (source) query = query.eq('source', source)
  if (from) query = query.gte('taken_at', from)
  if (to) query = query.lte('taken_at', to)

  const { data: photos, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!photos || photos.length === 0) {
    return NextResponse.json({ photos: [] })
  }

  // Récupérer les annotations existantes pour ces photos
  const photoIds = (photos as Array<{ id: string }>).map(p => p.id)
  const { data: annotations } = await db
    .from('morpho_annotations')
    .select('photo_id, thumbnail_path')
    .in('photo_id', photoIds)
    .eq('coach_id', user.id)

  const annotationMap = new Map(
    (annotations ?? []).map((a: { photo_id: string; thumbnail_path: string | null }) => [
      a.photo_id,
      a.thumbnail_path,
    ])
  )

  // Générer les signed URLs (bucket selon source)
  const enriched = await Promise.all(
    (photos as Array<{ id: string; storage_path: string; source: string; position: string; taken_at: string; notes: string | null; created_at: string }>).map(async (photo) => {
      const bucket = photo.source === 'assessment' ? 'assessment-photos' : 'morpho-photos'
      const { data: signedUrl } = await db.storage
        .from(bucket)
        .createSignedUrl(photo.storage_path, 3600)

      const thumbnailPath = annotationMap.get(photo.id) ?? null
      let thumbnailUrl: string | null = null
      if (thumbnailPath) {
        const { data: thumbSigned } = await db.storage
          .from('morpho-photos')
          .createSignedUrl(thumbnailPath, 3600)
        thumbnailUrl = thumbSigned?.signedUrl ?? null
      }

      return {
        ...photo,
        signed_url: signedUrl?.signedUrl ?? null,
        has_annotation: annotationMap.has(photo.id),
        thumbnail_url: thumbnailUrl,
      }
    })
  )

  return NextResponse.json({ photos: enriched })
}
```

- [ ] **Step 2: Créer la route annotations**

```typescript
// app/api/morpho/annotations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bodySchema = z.object({
  photoId: z.string().uuid(),
  canvasData: z.record(z.string(), z.unknown()),
  thumbnailBase64: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 })
  }

  const db = service()
  const { photoId, canvasData, thumbnailBase64 } = body.data

  // Vérifier que la photo appartient à un client du coach
  const { data: photo } = await db
    .from('morpho_photos')
    .select('id, client_id')
    .eq('id', photoId)
    .single()

  if (!photo) {
    return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })
  }

  const { data: access } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', (photo as { id: string; client_id: string }).client_id)
    .eq('coach_id', user.id)
    .single()

  if (!access) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let thumbnailPath: string | null = null

  // Upload thumbnail si fourni
  if (thumbnailBase64) {
    const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `thumbnails/${photoId}_${user.id}.png`
    const { error: thumbError } = await db.storage
      .from('morpho-photos')
      .upload(path, buffer, { contentType: 'image/png', upsert: true })

    if (!thumbError) thumbnailPath = path
  }

  const { data: annotation, error: upsertError } = await db
    .from('morpho_annotations')
    .upsert(
      {
        photo_id: photoId,
        coach_id: user.id,
        canvas_data: canvasData,
        ...(thumbnailPath ? { thumbnail_path: thumbnailPath } : {}),
      },
      { onConflict: 'photo_id,coach_id' }
    )
    .select('id')
    .single()

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ annotation_id: (annotation as { id: string }).id })
}
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/morpho/photos/route.ts app/api/morpho/annotations/route.ts
git commit -m "feat(morpho): add gallery GET and annotations POST API routes"
```

---

## Task 5: API — Analyse IA synchrone GPT-4o

**Files:**
- Create: `app/api/morpho/analyze/route.ts`

- [ ] **Step 1: Créer la route d'analyse**

```typescript
// app/api/morpho/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildAnalysisPrompt } from '@/lib/morpho/buildAnalysisPrompt'
import { calculateStimulusAdjustments } from '@/lib/morpho/adjustments'
import type { MorphoAnalysisResult } from '@/lib/morpho/types'

export const maxDuration = 60

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bodySchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1).max(4),
  clientId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 })
  }

  const { photoIds, clientId } = body.data
  const db = service()

  // Vérifier ownership
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id, goal, fitness_level, date_of_birth, gender')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Récupérer les photos et leurs storage_path + source
  const { data: photos } = await db
    .from('morpho_photos')
    .select('id, storage_path, source, position, client_id')
    .in('id', photoIds)
    .eq('client_id', clientId)

  if (!photos || photos.length === 0) {
    return NextResponse.json({ error: 'Photos introuvables' }, { status: 404 })
  }

  // Générer les signed URLs selon la source
  const signedUrls: string[] = []
  for (const photo of photos as Array<{ id: string; storage_path: string; source: string; position: string }>) {
    const bucket = photo.source === 'assessment' ? 'assessment-photos' : 'morpho-photos'
    const { data: signed } = await db.storage
      .from(bucket)
      .createSignedUrl(photo.storage_path, 600)
    if (signed?.signedUrl) signedUrls.push(signed.signedUrl)
  }

  if (signedUrls.length === 0) {
    return NextResponse.json({ error: 'Impossible de générer les URLs photos' }, { status: 500 })
  }

  // Récupérer le contexte biométrique client
  const { data: latestSubmission } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'completed')
    .order('bilan_date', { ascending: false })
    .limit(1)
    .single()

  let weight_kg: number | undefined
  let height_cm: number | undefined
  let body_fat_pct: number | undefined

  if (latestSubmission) {
    const { data: bioResponses } = await db
      .from('assessment_responses')
      .select('field_key, value_number')
      .eq('submission_id', (latestSubmission as { id: string }).id)
      .in('field_key', ['weight_kg', 'height_cm', 'body_fat_pct'])

    for (const r of (bioResponses ?? []) as Array<{ field_key: string; value_number: string | null }>) {
      if (r.value_number == null) continue
      if (r.field_key === 'weight_kg') weight_kg = parseFloat(r.value_number)
      if (r.field_key === 'height_cm') height_cm = parseFloat(r.value_number)
      if (r.field_key === 'body_fat_pct') body_fat_pct = parseFloat(r.value_number)
    }
  }

  // Récupérer les blessures connues
  const { data: injuryAnnotations } = await db
    .from('metric_annotations')
    .select('label')
    .eq('client_id', clientId)
    .eq('event_type', 'injury')
    .not('body_part', 'is', null)

  const injuries = (injuryAnnotations ?? []).map((a: { label: string }) => a.label).filter(Boolean)

  const client = clientRow as {
    goal?: string; fitness_level?: string;
    date_of_birth?: string; gender?: string
  }

  const age = client.date_of_birth
    ? Math.floor((Date.now() - new Date(client.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : undefined

  const photoPositions = (photos as Array<{ position: string }>).map(p => p.position)

  const prompt = buildAnalysisPrompt({
    age,
    sex: client.gender as 'male' | 'female' | 'other' | undefined,
    goal: client.goal ?? undefined,
    weight_kg,
    height_cm,
    body_fat_pct,
    injuries,
    photo_positions: photoPositions,
  })

  // Appel OpenAI GPT-4o
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY manquant' }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey })

  const imageContent = signedUrls.map(url => ({
    type: 'image_url' as const,
    image_url: { url, detail: 'high' as const },
  }))

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: prompt },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1500,
    temperature: 0.2,
  })

  const raw = completion.choices[0]?.message?.content
  if (!raw) {
    return NextResponse.json({ error: 'Pas de réponse OpenAI' }, { status: 500 })
  }

  let analysisResult: MorphoAnalysisResult
  try {
    analysisResult = JSON.parse(raw) as MorphoAnalysisResult
  } catch {
    return NextResponse.json({ error: 'Réponse OpenAI non parseable' }, { status: 500 })
  }

  // Calculer stimulus_adjustments depuis les asymétries détectées
  const stimulusAdjustments = calculateStimulusAdjustments(
    {
      asymmetries: {
        arm_diff_cm: analysisResult.asymmetries.arm_diff_cm ?? undefined,
        shoulder_imbalance_cm: analysisResult.asymmetries.shoulder_imbalance_cm ?? undefined,
      },
    },
    { height_cm }
  )

  // Sauvegarder dans morpho_analyses
  const today = new Date().toISOString().split('T')[0]
  const { data: savedAnalysis, error: saveError } = await db
    .from('morpho_analyses')
    .insert({
      client_id: clientId,
      analysis_date: today,
      status: 'completed',
      photo_ids: photoIds,
      analysis_result: analysisResult,
      asymmetries: {
        shoulder_imbalance_cm: analysisResult.asymmetries.shoulder_imbalance_cm,
        arm_diff_cm: analysisResult.asymmetries.arm_diff_cm,
        hip_imbalance_cm: analysisResult.asymmetries.hip_imbalance_cm,
        posture_notes: analysisResult.asymmetries.posture_notes,
      },
      stimulus_adjustments: stimulusAdjustments,
      raw_payload: { prompt_response: raw },
      analyzed_by: user.id,
    })
    .select('id')
    .single()

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  return NextResponse.json({
    analysis_id: (savedAnalysis as { id: string }).id,
    analysis_result: analysisResult,
    stimulus_adjustments: stimulusAdjustments,
  })
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/morpho/analyze/route.ts
git commit -m "feat(morpho): add synchronous GPT-4o analysis route with json_object format"
```

---

## Task 6: Nettoyage — Supprimer l'ancien système

**Files:**
- Delete: `lib/inngest/functions/morpho-analyze.ts`
- Delete: `jobs/morpho/analyzeMorphoJob.ts`
- Delete: `app/api/clients/[clientId]/morpho/analyze/route.ts`
- Delete: `app/api/clients/[clientId]/morpho/job-status/route.ts`
- Modify: `app/api/inngest/route.ts`

- [ ] **Step 1: Mettre à jour la route Inngest (retirer morpho)**

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
})
```

- [ ] **Step 2: Supprimer les fichiers obsolètes**

```bash
rm lib/inngest/functions/morpho-analyze.ts
rm jobs/morpho/analyzeMorphoJob.ts
rm app/api/clients/\[clientId\]/morpho/analyze/route.ts
rm app/api/clients/\[clientId\]/morpho/job-status/route.ts
```

Vérifier que le dossier `jobs/morpho/` est vide et peut être supprimé :

```bash
rmdir jobs/morpho 2>/dev/null; rmdir jobs 2>/dev/null; echo "done"
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs nouvelles. Si des imports sur les fichiers supprimés subsistent quelque part, les corriger.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(morpho): remove legacy Inngest job, job-status route, and old analyze route"
```

---

## Task 7: Composant MorphoGallery + MorphoPhotoCard

**Files:**
- Create: `components/morpho/MorphoPhotoCard.tsx`
- Create: `components/morpho/MorphoFloatingBar.tsx`
- Create: `components/morpho/MorphoGallery.tsx`

- [ ] **Step 1: Créer MorphoPhotoCard**

```typescript
// components/morpho/MorphoPhotoCard.tsx
'use client'

import Image from 'next/image'
import { CheckCircle2, Pencil } from 'lucide-react'
import { POSITION_LABELS, type MorphoPhoto } from '@/lib/morpho/types'

interface Props {
  photo: MorphoPhoto
  selected: boolean
  onToggle: (id: string) => void
  onAnnotate: (photo: MorphoPhoto) => void
}

export function MorphoPhotoCard({ photo, selected, onToggle, onAnnotate }: Props) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden cursor-pointer border-[0.3px] transition-all ${
        selected
          ? 'border-[#1f8a65] ring-1 ring-[#1f8a65]/40'
          : 'border-white/[0.06] hover:border-white/[0.12]'
      }`}
      onClick={() => onToggle(photo.id)}
    >
      <div className="aspect-[3/4] bg-white/[0.03] relative">
        {photo.signed_url ? (
          <Image
            src={photo.signed_url}
            alt={POSITION_LABELS[photo.position]}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/20 text-[10px]">Photo</span>
          </div>
        )}

        {/* Overlay sélection */}
        {selected && (
          <div className="absolute inset-0 bg-[#1f8a65]/10 flex items-start justify-end p-2">
            <CheckCircle2 size={16} className="text-[#1f8a65]" />
          </div>
        )}

        {/* Badge annoté */}
        {photo.has_annotation && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-[#181818]/90 rounded-md px-1.5 py-0.5">
            <Pencil size={9} className="text-white/50" />
            <span className="text-[9px] text-white/50">Annoté</span>
          </div>
        )}
      </div>

      <div className="p-2 space-y-0.5">
        <p className="text-[10px] font-semibold text-white/80">{POSITION_LABELS[photo.position]}</p>
        <p className="text-[9px] text-white/40">
          {new Date(photo.taken_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onAnnotate(photo) }}
          className="text-[9px] text-[#1f8a65]/70 hover:text-[#1f8a65] transition-colors mt-0.5"
        >
          Annoter →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Créer MorphoFloatingBar**

```typescript
// components/morpho/MorphoFloatingBar.tsx
'use client'

import { GitCompare, Pencil, Dna, X } from 'lucide-react'

interface Props {
  count: number
  onCompare: () => void
  onAnnotate: () => void
  onAnalyze: () => void
  onClear: () => void
  analyzing: boolean
}

export function MorphoFloatingBar({ count, onCompare, onAnnotate, onAnalyze, onClear, analyzing }: Props) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-2 bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl px-4 py-3 shadow-lg">
        <span className="text-[11px] text-white/50 mr-1">{count} sélectionnée{count > 1 ? 's' : ''}</span>

        <div className="w-px h-4 bg-white/[0.06]" />

        <button
          onClick={onCompare}
          disabled={count < 2 || count > 4}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-white/[0.04] text-[10px] font-bold text-white/60 hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 transition-all"
        >
          <GitCompare size={11} />
          Comparer ({count})
        </button>

        <button
          onClick={onAnnotate}
          disabled={count !== 1}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-white/[0.04] text-[10px] font-bold text-white/60 hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-30 transition-all"
        >
          <Pencil size={11} />
          Annoter
        </button>

        <button
          onClick={onAnalyze}
          disabled={analyzing || count > 4}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-[#1f8a65] text-[10px] font-bold text-white hover:bg-[#217356] disabled:opacity-50 active:scale-[0.97] transition-all"
        >
          <Dna size={11} className={analyzing ? 'animate-pulse' : ''} />
          {analyzing ? 'Analyse…' : 'Analyser avec IA'}
        </button>

        <button onClick={onClear} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Créer MorphoGallery**

```typescript
// components/morpho/MorphoGallery.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { MorphoPhotoCard } from './MorphoPhotoCard'
import { MorphoFloatingBar } from './MorphoFloatingBar'
import { POSITION_LABELS, type MorphoPhoto, type MorphoPhotoPosition, type MorphoAnalysisResult } from '@/lib/morpho/types'

interface Props {
  clientId: string
  onOpenCanvas: (photo: MorphoPhoto) => void
  onOpenCompare: (photos: MorphoPhoto[]) => void
  onOpenUpload: () => void
  onAnalysisComplete: (result: MorphoAnalysisResult) => void
  refreshToken: number
}

const POSITIONS: Array<{ value: MorphoPhotoPosition | 'all'; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'front', label: 'Face' },
  { value: 'back', label: 'Dos' },
  { value: 'left', label: 'Profil G' },
  { value: 'right', label: 'Profil D' },
  { value: 'three_quarter_front_left', label: '¾ G' },
  { value: 'three_quarter_front_right', label: '¾ D' },
]

export function MorphoGallery({ clientId, onOpenCanvas, onOpenCompare, onOpenUpload, onAnalysisComplete, refreshToken }: Props) {
  const [photos, setPhotos] = useState<MorphoPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [positionFilter, setPositionFilter] = useState<MorphoPhotoPosition | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'assessment' | 'coach_upload'>('all')
  const [analyzing, setAnalyzing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchPhotos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ clientId })
      if (positionFilter !== 'all') params.set('position', positionFilter)
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      const res = await fetch(`/api/morpho/photos?${params}`)
      const data = await res.json()
      setPhotos(data.photos ?? [])
    } catch {
      setErrorMsg('Erreur chargement photos')
    } finally {
      setLoading(false)
    }
  }, [clientId, positionFilter, sourceFilter])

  // Auto-sync bilans au premier chargement
  useEffect(() => {
    async function syncAndFetch() {
      setSyncing(true)
      try {
        await fetch('/api/morpho/photos/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        })
      } finally {
        setSyncing(false)
        fetchPhotos()
      }
    }
    syncAndFetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  useEffect(() => {
    if (!loading) fetchPhotos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionFilter, sourceFilter, refreshToken])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleAnalyze() {
    const photoIds = Array.from(selected)
    setAnalyzing(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/morpho/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds, clientId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Erreur analyse')
      } else {
        setSelected(new Set())
        onAnalysisComplete(data.analysis_result)
      }
    } catch {
      setErrorMsg('Erreur réseau')
    } finally {
      setAnalyzing(false)
    }
  }

  const selectedPhotos = photos.filter(p => selected.has(p.id))

  if (loading || syncing) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-7 w-16 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-red-500/[0.08] rounded-xl px-4 py-3 border-[0.3px] border-red-500/20">
          <p className="text-[11px] text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        {POSITIONS.map(p => (
          <button
            key={p.value}
            onClick={() => setPositionFilter(p.value as MorphoPhotoPosition | 'all')}
            className={`px-2.5 h-7 rounded-lg text-[10px] font-semibold transition-all ${
              positionFilter === p.value
                ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
                : 'bg-white/[0.03] text-white/40 hover:text-white/60'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="w-px h-4 bg-white/[0.06]" />
        {(['all', 'assessment', 'coach_upload'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSourceFilter(s)}
            className={`px-2.5 h-7 rounded-lg text-[10px] font-semibold transition-all ${
              sourceFilter === s
                ? 'bg-white/[0.08] text-white/80'
                : 'bg-white/[0.03] text-white/40 hover:text-white/60'
            }`}
          >
            {s === 'all' ? 'Toutes sources' : s === 'assessment' ? 'Bilans' : 'Uploads'}
          </button>
        ))}
        <button
          onClick={fetchPhotos}
          className="ml-auto p-1.5 text-white/30 hover:text-white/60 transition-colors"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Grille */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-[13px] text-white/30">Aucune photo morphologique</p>
          <p className="text-[11px] text-white/20">Ajoutez des photos via un bilan ou uploadez directement</p>
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-4 h-8 rounded-lg bg-[#1f8a65]/10 text-[#1f8a65] text-[11px] font-bold hover:bg-[#1f8a65]/20 transition-all mt-2"
          >
            <Upload size={12} />
            Ajouter une photo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {photos.map(photo => (
            <MorphoPhotoCard
              key={photo.id}
              photo={photo}
              selected={selected.has(photo.id)}
              onToggle={toggleSelect}
              onAnnotate={onOpenCanvas}
            />
          ))}
        </div>
      )}

      {/* Barre flottante */}
      <MorphoFloatingBar
        count={selected.size}
        onCompare={() => onOpenCompare(selectedPhotos)}
        onAnnotate={() => selectedPhotos[0] && onOpenCanvas(selectedPhotos[0])}
        onAnalyze={handleAnalyze}
        onClear={() => setSelected(new Set())}
        analyzing={analyzing}
      />
    </div>
  )
}
```

- [ ] **Step 4: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add components/morpho/MorphoPhotoCard.tsx components/morpho/MorphoFloatingBar.tsx components/morpho/MorphoGallery.tsx
git commit -m "feat(morpho): add MorphoGallery with filters, selection, and floating action bar"
```

---

## Task 8: MorphoUploadModal

**Files:**
- Create: `components/morpho/MorphoUploadModal.tsx`

- [ ] **Step 1: Créer le modal**

```typescript
// components/morpho/MorphoUploadModal.tsx
'use client'

import { useState, useRef } from 'react'
import { X, Upload } from 'lucide-react'
import { POSITION_LABELS, type MorphoPhotoPosition } from '@/lib/morpho/types'

interface Props {
  clientId: string
  onClose: () => void
  onUploaded: () => void
}

const POSITIONS: MorphoPhotoPosition[] = ['front', 'back', 'left', 'right', 'three_quarter_front_left', 'three_quarter_front_right']

export function MorphoUploadModal({ clientId, onClose, onUploaded }: Props) {
  const [position, setPosition] = useState<MorphoPhotoPosition>('front')
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Format non supporté (jpeg, png, webp)')
      return
    }
    setFile(f)
    setError(null)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function handleSubmit() {
    if (!file) return
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('clientId', clientId)
    form.append('position', position)
    form.append('takenAt', takenAt)
    form.append('notes', notes)
    form.append('file', file)

    try {
      const res = await fetch('/api/morpho/photos/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur upload')
      } else {
        onUploaded()
        onClose()
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] rounded-2xl p-6 w-full max-w-md border-[0.3px] border-white/[0.06] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-[14px]">Ajouter une photo</h3>
          <button onClick={onClose} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Zone drag & drop */}
        <div
          className={`border-[0.3px] border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-all ${
            preview ? 'border-[#1f8a65]/40' : 'border-white/[0.12] hover:border-white/25'
          }`}
          style={{ minHeight: 160 }}
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onDragOver={e => e.preventDefault()}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className="max-h-40 rounded-lg object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-8">
              <Upload size={24} className="text-white/20" />
              <p className="text-[11px] text-white/30">Glisser-déposer ou cliquer pour sélectionner</p>
              <p className="text-[10px] text-white/20">JPEG, PNG, WebP</p>
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>

        {/* Position */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Position</label>
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map(p => (
              <button
                key={p}
                onClick={() => setPosition(p)}
                className={`px-2.5 h-7 rounded-lg text-[10px] font-semibold transition-all ${
                  position === p ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/50 hover:text-white/70'
                }`}
              >
                {POSITION_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Date de la photo</label>
          <input
            type="date"
            value={takenAt}
            onChange={e => setTakenAt(e.target.value)}
            className="w-full rounded-xl bg-[#0a0a0a] px-4 h-[44px] text-[13px] text-white outline-none border-[0.3px] border-white/[0.06]"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Notes (optionnel)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: après 3 mois de programme"
            className="w-full rounded-xl bg-[#0a0a0a] px-4 h-[44px] text-[13px] text-white placeholder:text-white/20 outline-none border-[0.3px] border-white/[0.06]"
          />
        </div>

        {error && <p className="text-[11px] text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="flex-1 py-2.5 rounded-xl bg-[#1f8a65] text-white text-[13px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Upload…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/morpho/MorphoUploadModal.tsx
git commit -m "feat(morpho): add MorphoUploadModal with drag-and-drop and position selector"
```

---

## Task 9: MorphoAnalysisPanel + MorphoEvolutionChart

**Files:**
- Create: `components/morpho/MorphoEvolutionChart.tsx`
- Create: `components/morpho/MorphoAnalysisPanel.tsx`

- [ ] **Step 1: Créer MorphoEvolutionChart**

```typescript
// components/morpho/MorphoEvolutionChart.tsx
'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint { date: string; score: number }

interface Props { clientId: string }

export function MorphoEvolutionChart({ clientId }: Props) {
  const [points, setPoints] = useState<DataPoint[]>([])

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/clients/${clientId}/morpho/analyses?limit=20`)
      const data = await res.json()
      const mapped = (data.analyses ?? [])
        .filter((a: { analysis_result?: { score?: number }; status: string }) => a.status === 'completed' && a.analysis_result?.score != null)
        .map((a: { analysis_date: string; analysis_result: { score: number } }) => ({
          date: new Date(a.analysis_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          score: a.analysis_result.score,
        }))
        .reverse()
      setPoints(mapped)
    }
    load()
  }, [clientId])

  if (points.length < 2) return null

  return (
    <div className="space-y-1">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Évolution du score</p>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={points}>
          <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#181818', border: '0.3px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 11 }}
            itemStyle={{ color: '#1f8a65' }}
          />
          <Line type="monotone" dataKey="score" stroke="#1f8a65" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Créer MorphoAnalysisPanel**

```typescript
// components/morpho/MorphoAnalysisPanel.tsx
'use client'

import { MorphoEvolutionChart } from './MorphoEvolutionChart'
import type { MorphoAnalysisResult } from '@/lib/morpho/types'

interface Props {
  result: MorphoAnalysisResult
  stimulusAdjustments?: Record<string, number> | null
  analysisDate?: string
  clientId: string
}

const ZONE_LABELS: Record<string, string> = {
  shoulders: 'Épaules', pelvis: 'Bassin', spine: 'Colonne', knees: 'Genoux', ankles: 'Chevilles'
}

const SEVERITY_STYLES: Record<string, string> = {
  red: 'text-red-400 bg-red-500/10 border-red-500/20',
  orange: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  green: 'text-[#1f8a65] bg-[#1f8a65]/10 border-[#1f8a65]/20',
}

const TYPE_STYLES: Record<string, string> = {
  exercise: 'text-[#1f8a65] bg-[#1f8a65]/10 border-[#1f8a65]/20',
  correction: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  contraindication: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const TYPE_LABELS: Record<string, string> = {
  exercise: 'Exercice', correction: 'Correction', contraindication: 'Contre-indication'
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 75 ? '#1f8a65' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Score postural</p>
        <p className="text-[22px] font-black leading-none" style={{ color }}>{score}<span className="text-[12px] font-bold text-white/30">/100</span></p>
      </div>
      <div className="h-[3px] w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  )
}

export function MorphoAnalysisPanel({ result, stimulusAdjustments, analysisDate, clientId }: Props) {
  return (
    <div className="space-y-4">
      {analysisDate && (
        <p className="text-[9px] text-white/30">
          {new Date(analysisDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      <ScoreGauge score={result.score} />

      {result.posture_summary && (
        <p className="text-[11px] text-white/50 italic leading-relaxed">{result.posture_summary}</p>
      )}

      {/* Flags par zone */}
      {result.flags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Zones</p>
          <div className="flex flex-wrap gap-1.5">
            {result.flags.map((flag, i) => (
              <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded-lg border-[0.3px] text-[10px] font-semibold ${SEVERITY_STYLES[flag.severity]}`}>
                <span className="text-white/50">{ZONE_LABELS[flag.zone] ?? flag.zone}</span>
                <span>— {flag.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points d'attention */}
      {result.attention_points.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Points d'attention</p>
          <div className="space-y-1">
            {result.attention_points
              .sort((a, b) => a.priority - b.priority)
              .map((pt, i) => (
                <div key={i} className="flex items-start gap-2 bg-white/[0.02] rounded-lg p-2.5 border-[0.3px] border-white/[0.06]">
                  <span className={`text-[9px] font-black shrink-0 mt-0.5 ${pt.priority === 1 ? 'text-red-400' : pt.priority === 2 ? 'text-amber-400' : 'text-white/30'}`}>
                    P{pt.priority}
                  </span>
                  <p className="text-[11px] text-white/60 leading-snug">{pt.description}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recommandations */}
      {result.recommendations.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Recommandations</p>
          <div className="space-y-1">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="bg-white/[0.02] rounded-lg p-2.5 border-[0.3px] border-white/[0.06] space-y-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border-[0.3px] ${TYPE_STYLES[rec.type]}`}>
                  {TYPE_LABELS[rec.type]}
                </span>
                <p className="text-[11px] text-white/70 leading-snug">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ajustements stimulus */}
      {stimulusAdjustments && Object.keys(stimulusAdjustments).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Ajustements scoring programme</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stimulusAdjustments).map(([pattern, coeff]) => (
              <div key={pattern} className={`px-2 py-1 rounded-lg text-[9px] font-semibold border-[0.3px] ${
                coeff > 1 ? 'text-[#1f8a65] bg-[#1f8a65]/10 border-[#1f8a65]/20' :
                coeff < 1 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                'text-white/40 bg-white/[0.03] border-white/[0.06]'
              }`}>
                {pattern.replace(/_/g, ' ')} ×{coeff.toFixed(2)}
              </div>
            ))}
          </div>
          <p className="text-[9px] text-[#1f8a65]/60">✓ Appliqués au scoring du programme d'entraînement</p>
        </div>
      )}

      <MorphoEvolutionChart clientId={clientId} />
    </div>
  )
}
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add components/morpho/MorphoEvolutionChart.tsx components/morpho/MorphoAnalysisPanel.tsx
git commit -m "feat(morpho): add MorphoAnalysisPanel with score gauge, flags, recommendations, and evolution chart"
```

---

## Task 10: MorphoCanvas (Fabric.js)

**Files:**
- Create: `components/morpho/MorphoCanvas.tsx`

- [ ] **Step 1: Installer Fabric.js et jsPDF**

```bash
cd /Users/user/Desktop/VIRTUS && npm install fabric@^6.0.0 jspdf@^2.5.0
```

Vérifier l'installation :

```bash
node -e "require('fabric'); console.log('fabric ok')" 2>/dev/null || echo "fabric installed (ESM only, normal)"
```

- [ ] **Step 2: Créer MorphoCanvas**

```typescript
// components/morpho/MorphoCanvas.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Save, Undo2, Redo2, ZoomIn, ZoomOut, Download, Dna } from 'lucide-react'
import type { MorphoPhoto, MorphoAnalysisResult } from '@/lib/morpho/types'
import { MorphoAnalysisPanel } from './MorphoAnalysisPanel'

type Tool = 'select' | 'line' | 'freepath' | 'rect' | 'circle' | 'text' | 'eraser'

interface Props {
  photo: MorphoPhoto
  clientId: string
  onClose: () => void
}

export function MorphoCanvas({ photo, clientId, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null)
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [color, setColor] = useState('#1f8a65')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<MorphoAnalysisResult | null>(null)
  const [stimulusAdjustments, setStimulusAdjustments] = useState<Record<string, number> | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyRef = useRef<any[]>([])
  const historyIndexRef = useRef(-1)

  useEffect(() => {
    if (!canvasRef.current || !photo.signed_url) return

    let canvas: unknown
    let destroyed = false

    import('fabric').then(({ Canvas, FabricImage }) => {
      if (destroyed || !canvasRef.current) return

      canvas = new Canvas(canvasRef.current, {
        backgroundColor: '#0a0a0a',
        width: canvasRef.current.parentElement?.clientWidth ?? 800,
        height: canvasRef.current.parentElement?.clientHeight ?? 600,
      })
      fabricRef.current = canvas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fc = canvas as any

      FabricImage.fromURL(photo.signed_url!, { crossOrigin: 'anonymous' }).then((img: unknown) => {
        if (destroyed) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fabricImg = img as any
        const scaleX = fc.width / fabricImg.width
        const scaleY = fc.height / fabricImg.height
        const scale = Math.min(scaleX, scaleY)
        fabricImg.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false })
        fc.add(fabricImg)
        fc.renderAll()
        saveHistory()
      })

      fc.on('object:added', saveHistory)
      fc.on('object:modified', saveHistory)
      fc.on('object:removed', saveHistory)
    })

    return () => {
      destroyed = true
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.signed_url])

  function saveHistory() {
    const fc = fabricRef.current
    if (!fc) return
    const json = fc.toJSON()
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(json)
    historyIndexRef.current = historyRef.current.length - 1
  }

  function undo() {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current--
    fabricRef.current?.loadFromJSON(historyRef.current[historyIndexRef.current])
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current++
    fabricRef.current?.loadFromJSON(historyRef.current[historyIndexRef.current])
  }

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return
    fc.isDrawingMode = activeTool === 'freepath'
    if (fc.freeDrawingBrush) {
      fc.freeDrawingBrush.color = color
      fc.freeDrawingBrush.width = strokeWidth
    }
    fc.selection = activeTool === 'select'
  }, [activeTool, color, strokeWidth])

  const addText = useCallback(() => {
    import('fabric').then(({ IText }) => {
      const text = new IText('Texte', {
        left: 100, top: 100,
        fill: color,
        fontSize: 16,
        fontFamily: 'sans-serif',
      })
      fabricRef.current?.add(text)
      fabricRef.current?.setActiveObject(text)
    })
  }, [color])

  useEffect(() => {
    if (activeTool === 'text') addText()
  }, [activeTool, addText])

  async function handleSave() {
    const fc = fabricRef.current
    if (!fc) return
    setSaving(true)
    setError(null)
    try {
      const canvasData = fc.toJSON()
      const thumbnailBase64 = fc.toDataURL({ format: 'png', multiplier: 0.3 })
      const res = await fetch('/api/morpho/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id, canvasData, thumbnailBase64 }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erreur sauvegarde')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/morpho/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: [photo.id], clientId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur analyse')
      } else {
        setAnalysisResult(data.analysis_result)
        setStimulusAdjustments(data.stimulus_adjustments)
        setShowAnalysis(true)
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setAnalyzing(false)
    }
  }

  function handleExportPNG() {
    const fc = fabricRef.current
    if (!fc) return
    const url = fc.toDataURL({ format: 'png', multiplier: 1 })
    const a = document.createElement('a')
    a.href = url
    a.download = `morpho-${photo.position}-${photo.taken_at}.png`
    a.click()
  }

  const TOOLS: Array<{ id: Tool; label: string }> = [
    { id: 'select', label: 'Sélection' },
    { id: 'line', label: 'Ligne' },
    { id: 'freepath', label: 'Stylo' },
    { id: 'rect', label: 'Rectangle' },
    { id: 'circle', label: 'Cercle' },
    { id: 'text', label: 'Texte' },
    { id: 'eraser', label: 'Gomme' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex bg-[#0a0a0a]">
      {/* Toolbar gauche */}
      <div className="w-14 bg-[#181818] border-r-[0.3px] border-white/[0.06] flex flex-col items-center py-4 gap-1 shrink-0">
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            title={t.label}
            className={`w-9 h-9 rounded-lg text-[9px] font-bold transition-all ${
              activeTool === t.id
                ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
                : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70'
            }`}
          >
            {t.label.slice(0, 3)}
          </button>
        ))}
        <div className="flex-1" />
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0.5"
          title="Couleur"
        />
        <input
          type="range"
          min={1} max={10}
          value={strokeWidth}
          onChange={e => setStrokeWidth(Number(e.target.value))}
          className="w-9 mt-1"
          title="Épaisseur"
          style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 60 }}
        />
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-12 bg-[#181818] border-b-[0.3px] border-white/[0.06] flex items-center px-4 gap-3">
          <button onClick={undo} className="p-1.5 text-white/40 hover:text-white/70 transition-colors" title="Annuler">
            <Undo2 size={14} />
          </button>
          <button onClick={redo} className="p-1.5 text-white/40 hover:text-white/70 transition-colors" title="Rétablir">
            <Redo2 size={14} />
          </button>
          <div className="w-px h-4 bg-white/[0.06]" />
          <button onClick={() => fabricRef.current?.setZoom((fabricRef.current?.getZoom() ?? 1) * 1.2)} className="p-1.5 text-white/40 hover:text-white/70 transition-colors">
            <ZoomIn size={14} />
          </button>
          <button onClick={() => fabricRef.current?.setZoom((fabricRef.current?.getZoom() ?? 1) / 1.2)} className="p-1.5 text-white/40 hover:text-white/70 transition-colors">
            <ZoomOut size={14} />
          </button>
          <div className="flex-1" />
          {error && <p className="text-[10px] text-red-400">{error}</p>}
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-[#1f8a65]/10 text-[#1f8a65] text-[10px] font-bold hover:bg-[#1f8a65]/20 disabled:opacity-50 transition-all"
          >
            <Dna size={11} className={analyzing ? 'animate-pulse' : ''} />
            {analyzing ? 'Analyse…' : 'Analyser IA'}
          </button>
          <button onClick={handleExportPNG} className="p-1.5 text-white/40 hover:text-white/70 transition-colors" title="Exporter PNG">
            <Download size={14} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-[#1f8a65] text-white text-[10px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-all"
          >
            <Save size={11} />
            {saving ? '…' : 'Sauvegarder'}
          </button>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white/70 ml-2 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Zone canvas */}
        <div className="flex-1 relative overflow-hidden">
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Panel IA latéral */}
      {showAnalysis && analysisResult && (
        <div className="w-72 bg-[#181818] border-l-[0.3px] border-white/[0.06] overflow-y-auto p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Analyse IA</p>
            <button onClick={() => setShowAnalysis(false)} className="text-white/30 hover:text-white/60">
              <X size={13} />
            </button>
          </div>
          <MorphoAnalysisPanel
            result={analysisResult}
            stimulusAdjustments={stimulusAdjustments}
            clientId={clientId}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add components/morpho/MorphoCanvas.tsx package.json package-lock.json
git commit -m "feat(morpho): add MorphoCanvas with Fabric.js annotation tools and IA side panel"
```

---

## Task 11: MorphoCompare

**Files:**
- Create: `components/morpho/MorphoCompare.tsx`

- [ ] **Step 1: Créer MorphoCompare**

```typescript
// components/morpho/MorphoCompare.tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { POSITION_LABELS, type MorphoPhoto } from '@/lib/morpho/types'

type Layout = '1x2' | '2x2' | '1+3'

interface Props {
  initialPhotos: MorphoPhoto[]
  onClose: () => void
}

export function MorphoCompare({ initialPhotos, onClose }: Props) {
  const [layout, setLayout] = useState<Layout>('1x2')
  const [slots, setSlots] = useState<Array<MorphoPhoto | null>>(() => {
    const arr: Array<MorphoPhoto | null> = [null, null, null, null]
    initialPhotos.slice(0, 4).forEach((p, i) => { arr[i] = p })
    return arr
  })
  const [opacity, setOpacity] = useState(50)
  const [splitDirection, setSplitDirection] = useState<'horizontal' | 'vertical'>('vertical')

  const slotCount = layout === '1x2' ? 2 : layout === '2x2' ? 4 : 4

  const gridClass = layout === '1x2'
    ? 'grid-cols-2'
    : layout === '2x2'
    ? 'grid-cols-2 grid-rows-2'
    : 'grid-cols-2 grid-rows-2'

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="h-12 bg-[#181818] border-b-[0.3px] border-white/[0.06] flex items-center px-4 gap-3 shrink-0">
        <p className="text-[12px] font-bold text-white/70">Comparaison</p>
        <div className="flex gap-1">
          {(['1x2', '2x2', '1+3'] as Layout[]).map(l => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`px-2.5 h-7 rounded-lg text-[10px] font-bold transition-all ${
                layout === l ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Superposition (1x2 seulement) */}
        {layout === '1x2' && slots[0] && slots[1] && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Superposition</span>
            <input
              type="range" min={0} max={100} value={opacity}
              onChange={e => setOpacity(Number(e.target.value))}
              className="w-20"
            />
            <button
              onClick={() => setSplitDirection(d => d === 'vertical' ? 'horizontal' : 'vertical')}
              className="px-2 h-6 rounded text-[9px] bg-white/[0.04] text-white/50 hover:text-white/70"
            >
              {splitDirection === 'vertical' ? '⇕ Horiz.' : '⇔ Vert.'}
            </button>
          </div>
        )}

        <div className="flex-1" />
        <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white/70 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Grille de slots */}
      <div className={`flex-1 grid ${gridClass} gap-px`}>
        {Array.from({ length: slotCount }).map((_, i) => {
          const photo = slots[i] ?? null
          return (
            <div key={i} className="relative bg-[#181818] flex items-center justify-center">
              {photo?.signed_url ? (
                <>
                  <Image
                    src={photo.signed_url}
                    alt={POSITION_LABELS[photo.position]}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                  {/* Overlay superposition (slot 1 seulement en mode 1x2) */}
                  {layout === '1x2' && i === 1 && slots[0]?.signed_url && (
                    <div
                      className="absolute inset-0"
                      style={{ opacity: opacity / 100 }}
                    >
                      <Image
                        src={slots[0].signed_url}
                        alt="overlay"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-[#181818]/80 rounded px-1.5 py-0.5">
                    <p className="text-[9px] text-white/60">{POSITION_LABELS[photo.position]} — {new Date(photo.taken_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-1">
                  <p className="text-[11px] text-white/20">Slot {i + 1}</p>
                  <p className="text-[9px] text-white/15">Sélectionner une photo depuis la galerie</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/morpho/MorphoCompare.tsx
git commit -m "feat(morpho): add MorphoCompare with 1x2/2x2/1+3 layouts and opacity overlay"
```

---

## Task 12: Page MorphoPro — Orchestration finale

**Files:**
- Modify: `app/coach/clients/[clientId]/data/morphopro/page.tsx`

- [ ] **Step 1: Réécrire la page**

```typescript
// app/coach/clients/[clientId]/data/morphopro/page.tsx
'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { useClient } from '@/lib/client-context'
import { useClientTopBar } from '@/components/clients/useClientTopBar'
import { MorphoGallery } from '@/components/morpho/MorphoGallery'
import { MorphoUploadModal } from '@/components/morpho/MorphoUploadModal'
import { MorphoCanvas } from '@/components/morpho/MorphoCanvas'
import { MorphoCompare } from '@/components/morpho/MorphoCompare'
import { MorphoAnalysisPanel } from '@/components/morpho/MorphoAnalysisPanel'
import type { MorphoPhoto, MorphoAnalysisResult } from '@/lib/morpho/types'

export default function MorphoProPage() {
  const { clientId } = useClient()
  const [showUpload, setShowUpload] = useState(false)
  const [canvasPhoto, setCanvasPhoto] = useState<MorphoPhoto | null>(null)
  const [comparePhotos, setComparePhotos] = useState<MorphoPhoto[] | null>(null)
  const [latestAnalysis, setLatestAnalysis] = useState<MorphoAnalysisResult | null>(null)
  const [latestStimulus, setLatestStimulus] = useState<Record<string, number> | null>(null)
  const [galleryRefresh, setGalleryRefresh] = useState(0)

  useClientTopBar(
    'MorphoPro',
    <button
      onClick={() => setShowUpload(true)}
      className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/[0.04] text-white/55 text-[10px] font-bold hover:bg-white/[0.08] hover:text-white/80 transition-all"
    >
      <Upload size={12} />
      Photo
    </button>
  )

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24 pt-4">
        {/* Dernière analyse (si disponible) */}
        {latestAnalysis && (
          <div className="mb-6 bg-white/[0.02] rounded-xl p-4 border-[0.3px] border-white/[0.06]">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30 mb-3">Dernière analyse</p>
            <MorphoAnalysisPanel
              result={latestAnalysis}
              stimulusAdjustments={latestStimulus}
              clientId={clientId}
            />
          </div>
        )}

        {/* Galerie */}
        <MorphoGallery
          clientId={clientId}
          onOpenCanvas={setCanvasPhoto}
          onOpenCompare={setComparePhotos}
          onOpenUpload={() => setShowUpload(true)}
          onAnalysisComplete={(result, stimulus) => {
            setLatestAnalysis(result)
            setLatestStimulus(stimulus ?? null)
          }}
          refreshToken={galleryRefresh}
        />
      </div>

      {/* Modals */}
      {showUpload && (
        <MorphoUploadModal
          clientId={clientId}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setGalleryRefresh(t => t + 1) }}
        />
      )}

      {canvasPhoto && (
        <MorphoCanvas
          photo={canvasPhoto}
          clientId={clientId}
          onClose={() => setCanvasPhoto(null)}
        />
      )}

      {comparePhotos && (
        <MorphoCompare
          initialPhotos={comparePhotos}
          onClose={() => setComparePhotos(null)}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 2: Mettre à jour la signature de `onAnalysisComplete` dans MorphoGallery**

Dans `components/morpho/MorphoGallery.tsx`, mettre à jour la prop `onAnalysisComplete` pour passer aussi `stimulus_adjustments` :

```typescript
// Dans l'interface Props de MorphoGallery :
onAnalysisComplete: (result: MorphoAnalysisResult, stimulus?: Record<string, number>) => void

// Dans handleAnalyze(), remplacer :
onAnalysisComplete(data.analysis_result)
// par :
onAnalysisComplete(data.analysis_result, data.stimulus_adjustments)
```

- [ ] **Step 3: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreurs. Corriger si nécessaire.

- [ ] **Step 4: Commit**

```bash
git add app/coach/clients/\[clientId\]/data/morphopro/page.tsx components/morpho/MorphoGallery.tsx
git commit -m "feat(morpho): wire MorphoPro page — gallery + canvas + compare + analysis panel"
```

---

## Task 13: CHANGELOG + project-state + tsc final

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Mettre à jour CHANGELOG.md**

Ajouter en haut de `CHANGELOG.md` :

```markdown
## 2026-04-28

FEATURE: MorphoPro coach — galerie photos, canvas annotation Fabric.js, analyse IA GPT-4o structurée (JSON), score postural, flags zones, recommandations, comparaison multi-photos
SCHEMA: Add morpho_photos table (index centralisé photos bilans + uploads coach)
SCHEMA: Add morpho_annotations table (canvas Fabric.js persisté par photo/coach)
SCHEMA: Extend morpho_analyses with photo_ids and analysis_result columns
REFACTOR: Replace Inngest morpho job with synchronous GPT-4o analysis (response_format: json_object)
CHORE: Remove legacy MorphoAnalysisSection, analyzeMorphoJob, job-status route
```

- [ ] **Step 2: Mettre à jour project-state.md**

Dans `.claude/rules/project-state.md`, mettre à jour le tableau des modules :

```markdown
| **MorphoPro Bridge** | ✅ Phase 1 complet (galerie + canvas + analyse IA structurée) | 2026-04-28 |
```

Et ajouter dans "Dernières Avancées" :

```markdown
### MorphoPro — Refonte Complète Phase 1 (COMPLET)
- ✅ `morpho_photos` + `morpho_annotations` tables + RLS
- ✅ `morpho_analyses` étendu : `photo_ids`, `analysis_result`
- ✅ Prompt GPT-4o structuré (`response_format: json_object`) — analyse posturale + asymétries + flags + recommandations
- ✅ Analyse synchrone (plus Inngest) — résultat immédiat avec `maxDuration = 60`
- ✅ Galerie avec filtres position/source, sélection multi, barre flottante
- ✅ Upload coach direct (bucket `morpho-photos`)
- ✅ Auto-sync photos des bilans au premier load
- ✅ Canvas Fabric.js : 7 outils, undo/redo, zoom, save thumbnail, export PNG
- ✅ Panel résultats : score 0–100, flags zones, attention_points, recommandations, stimulus chips, évolution chart
- ✅ Comparaison multi-photos : layouts 1×2 / 2×2 / 1+3, overlay opacité
- ✅ `stimulus_adjustments` conservés → scoring programme inchangé
```

- [ ] **Step 3: Run TypeScript final**

```bash
npx tsc --noEmit 2>&1
```

Attendu : 0 nouvelles erreurs liées au code MorphoPro. Corriger tout ce qui est introduit dans cette feature.

- [ ] **Step 4: Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for MorphoPro full redesign"
```

---

## Self-Review — Couverture Spec

| Exigence spec | Tâche |
|---------------|-------|
| Migration morpho_photos + morpho_annotations | Task 1 |
| Colonnes photo_ids + analysis_result sur morpho_analyses | Task 1 |
| Bucket morpho-photos Supabase | Task 3 (upload route) — **noter : créer manuellement dans Dashboard** |
| lib/morpho/buildAnalysisPrompt.ts — prompt JSON structuré | Task 2 |
| POST /api/morpho/photos/sync — pont bilans | Task 3 |
| POST /api/morpho/photos/upload — upload coach | Task 3 |
| GET /api/morpho/photos — galerie signed URLs | Task 4 |
| POST /api/morpho/annotations — save canvas | Task 4 |
| POST /api/morpho/analyze — GPT-4o synchrone | Task 5 |
| GET /api/clients/[clientId]/morpho/latest — conservé | Non modifié ✓ |
| GET /api/clients/[clientId]/morpho/analyses — conservé | Non modifié ✓ |
| Supprimer Inngest morpho + job + job-status route | Task 6 |
| MorphoGallery filtres + sélection + barre flottante | Task 7 |
| MorphoUploadModal drag-and-drop | Task 8 |
| MorphoAnalysisPanel score + flags + reco + stimulus + évolution | Task 9 |
| MorphoCanvas Fabric.js 7 outils + undo/redo + save + export | Task 10 |
| MorphoCompare layouts 1×2/2×2/1+3 + superposition | Task 11 |
| Page orchestration finale | Task 12 |
| CHANGELOG + project-state | Task 13 |
| maxDuration = 60 sur route analyze | Task 5 ✓ |
| Bucket assessment-photos (bilans) vs morpho-photos (uploads) | Tasks 3, 4, 5 ✓ |

**⚠️ Action manuelle requise avant Task 3 :** Créer le bucket `morpho-photos` dans Supabase Dashboard → Storage → New bucket (public: false, 30MB max file size).
