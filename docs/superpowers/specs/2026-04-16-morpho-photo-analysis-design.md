# MorphoPro — Espace Photo & Analyse Morphologique

**Date :** 2026-04-16
**Statut :** Approuvé — prêt pour implémentation
**Scope :** Phase 1 complète — galerie, comparaison, canvas annoté, analyse IA GPT-4o vision

---

## 1. Contexte & Objectif

Construire un espace photo/morpho de niveau expert intégré à la fiche client coach. L'objectif est de permettre au coach de :

- Centraliser toutes les photos morphologiques d'un client (issues des bilans, uploadées directement, ou envoyées par le client)
- Comparer visuellement l'évolution (avant/après) avec jusqu'à 4 photos simultanées
- Annoter les photos directement dans un canvas (lignes, angles, mesures, calques persistés)
- Obtenir une analyse IA structurée basée sur les specs MorphoPro (posture, asymétrie, ratios segments, recommandations correctrices)

---

## 2. Placement dans la navigation

Nouvel onglet **"Morpho"** dans `app/coach/clients/[clientId]/page.tsx`, s'ajoutant aux onglets existants (Profil, Métriques, Bilans, Programmes).

---

## 3. Data Model

### Table `morpho_photos`

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
  source                 text not null check (source in ('assessment', 'coach_upload', 'client_upload')),
  assessment_response_id uuid unique references public.assessment_responses(id) on delete set null,
  notes                  text,
  created_at             timestamptz not null default now()
);

create index morpho_photos_client_id_idx on public.morpho_photos(client_id);
create index morpho_photos_taken_at_idx on public.morpho_photos(taken_at);
```

**Pont avec bilans existants :** à la première ouverture de l'onglet Morpho pour un client, un appel à `POST /api/morpho/photos/sync` indexe automatiquement les `assessment_responses` avec `storage_path` non null → crée les entrées `morpho_photos` correspondantes avec `source='assessment'`. Idempotent via `ON CONFLICT (assessment_response_id) DO NOTHING`.

### Table `morpho_annotations`

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

-- Trigger updated_at automatique
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger morpho_annotations_updated_at
  before update on public.morpho_annotations
  for each row execute function public.set_updated_at();
```

---

## 4. Architecture des modules

### 4.1 `MorphoGallery` — vue principale de l'onglet

**Fichier :** `components/morpho/MorphoGallery.tsx`

- Barre de filtres :
  - Position : chips sélectionnables (Face, Dos, Profil G, Profil D, ¾ G, ¾ D) — multi-select
  - Date range : deux date pickers `from` / `to`
  - Source : Tous / Bilan / Coach / Client
- Grille de photos triées par `taken_at` DESC, groupées par mois
- Card photo : thumbnail + badge position + date + badge "Annoté" (si annotation existe) + checkbox sélection
- Upload coach : bouton "+ Photo" → modal avec sélecteur position + date picker + drag-drop fichier
- Barre d'action flottante (apparaît dès 1 photo cochée) :
  - "Comparer (N)" → ouvre `MorphoCompare`
  - "Annoter" → ouvre `MorphoCanvas` sur la photo sélectionnée
  - "Analyser avec IA" → déclenche `MorphoAnalysis` sur les photos sélectionnées (max 4)

### 4.2 `MorphoCompare` — comparaison multi-photos

**Fichier :** `components/morpho/MorphoCompare.tsx`

- Layouts disponibles : 1×2 | 2×2 | 1+3 (jusqu'à 4 photos)
- Chaque slot : drag & drop depuis galerie, label date + position, bouton "Annoter ce slot"
- Mode superposition : slider d'opacité entre 2 photos (disponible uniquement en layout 1×2, positions identiques recommandées)
- Toggle split direction : Horizontal / Vertical
- Smart pairing : si 2 photos de même position sélectionnées → proposé automatiquement en 1×2

### 4.3 `MorphoCanvas` — canvas d'annotation plein écran

**Fichier :** `components/morpho/MorphoCanvas.tsx`
**Librairie :** Fabric.js (gestion calques, sérialisation JSON, export)

**Toolbar gauche (outils) :**

- Sélection (curseur)
- Ligne droite
- Courbe libre (path)
- Rectangle
- Stylo (dessin libre)
- Cercle / Ellipse
- Point / Marqueur (avec label optionnel)
- Texte libre
- Outil Angle (3 points → calcul + affichage de l'angle en degrés)
- Outil Mesure (2 points + calibration px/cm → affichage distance réelle)
- Grille d'alignement (plomb vertical + horizontal, snapping)
- Gomme

**Toolbar droite (calques & style) :**

- Liste des calques avec toggle visibilité, ordre drag & drop
- Couleur (color picker)
- Épaisseur du trait (slider 1–10px)
- Opacité de l'objet sélectionné

**Contrôles canvas :**

- Undo / Redo illimité (stack en mémoire, réinitialisé à la fermeture)
- Zoom + pan (molette + drag)

**Actions :**

- **Sauvegarder** → POST `/api/morpho/annotations` avec `canvas_data` (JSON Fabric.js) + génération thumbnail PNG
- **Exporter PNG** → `canvas.toDataURL()` → download
- **Exporter PDF** → jsPDF avec métadonnées (nom client, date, position)
- **Exporter SVG** → `canvas.toSVG()` → download
- **Partager avec le client** → génère signed URL (1 semaine) vers le PNG exporté, copie dans presse-papier

**Panel IA intégré :** bouton "Analyser" dans la toolbar du canvas → déclenche l'analyse sur la photo courante → résultat affiché dans un panel latéral droit rétractable.

### 4.4 `MorphoAnalysis` — analyse IA et reporting

**Fichier :** `components/morpho/MorphoAnalysis.tsx`

**Déclenchement :** depuis la barre flottante galerie, depuis le canvas, ou depuis un bouton dédié sur chaque card.

**Contenu du panel :**

- **Score global** : jauge 0–100 avec zone colorée (rouge < 50, orange 50–75, vert > 75)
- **Drapeaux par zone** : épaules / bassin / colonne / genoux / chevilles — badge rouge/orange/vert
- **Points d'attention** : liste priorisée, chaque item cliquable (scroll vers la zone sur la photo si annoté)
- **Recommandations** : exercices correctifs avec références MorphoPro (Safety Guard, seuils asymétrie)
- **Alerte asymétrie** : badge rouge si décalage > 3° détecté
- **Graphique évolution** : courbe du score global sur le temps (1 point par analyse effectuée pour ce client)

---

## 5. API Layer

### `POST /api/morpho/photos/sync`

- Auth coach, `clientId` en body
- Indexe les `assessment_responses` existantes avec `storage_path` non null → crée `morpho_photos` avec `source='assessment'`
- Idempotent (ON CONFLICT DO NOTHING)

### `POST /api/morpho/photos/upload`

- Auth coach, ownership check client
- Body : `{ clientId, position, takenAt, notes? }`
- Génère signed upload URL Supabase Storage → retourne à l'UI
- Crée `morpho_photos` avec `source='coach_upload'`

### `POST /api/client/morpho/upload`

- Auth client
- Body : `{ position, takenAt }`
- `coach_id` résolu depuis `coach_clients`
- Crée `morpho_photos` avec `source='client_upload'`

### `GET /api/morpho/photos`

- Query params : `clientId`, `position?`, `from?`, `to?`, `source?`
- Retourne `morpho_photos` + signed URLs (1h) + `morpho_annotations` associées (présence + thumbnail)

### `POST /api/morpho/annotations`

- Body : `{ photoId, canvasData, thumbnailBase64? }`
- Upload thumbnail vers Storage si fourni
- Upsert `morpho_annotations` sur `(photo_id, coach_id)`

### `POST /api/morpho/analyze`

- Body : `{ photoIds: string[], clientContext: { age, sex, goal, injuries[] } }`
- Récupère signed URLs des photos (max 4)
- Appelle **OpenAI GPT-4o** avec vision via `lib/morpho/buildAnalysisPrompt.ts`
- Force le résultat en JSON structuré via `response_format: { type: 'json_object' }`
- Sauvegarde `analysis_snapshot` dans `morpho_annotations`
- Retourne : `{ score, flags[], attention_points[], recommendations[], raw_text }`

---

## 6. Prompt IA — `lib/morpho/buildAnalysisPrompt.ts`

Le prompt injecte :

1. **Contexte client** : âge, sexe, objectif, historique blessures
2. **Positions des photos** fournies
3. **Pipeline MorphoPro 5 couches** : Ingestion/Normalisation → Safety Guard → Vecteurs de Force → Scoring Best-Fit → Ordonnancement
4. **Règles Safety Guard** : seuils asymétrie (> 3°), espace sous-acromial, protection lombale (ratio fémur/buste > 0.28), alerte cyphose
5. **Format de sortie forcé** via `response_format: { type: 'json_object' }` :

```typescript
{
  score: number,          // 0-100
  flags: {
    zone: string,         // shoulders | pelvis | spine | knees | ankles
    severity: 'red' | 'orange' | 'green',
    label: string
  }[],
  attention_points: {
    priority: number,
    description: string,
    zone: string
  }[],
  recommendations: {
    type: 'exercise' | 'correction' | 'contraindication',
    description: string,
    reference: string     // référence MorphoPro si applicable
  }[]
}
```

---

## 7. Page client `/client/morpho`

**Fichier :** `app/client/morpho/page.tsx`

- Grille des photos uploadées par le client ou partagées par le coach
- Bouton "+ Ajouter une photo" → modal avec sélecteur position + date picker
- Pas d'accès au canvas d'annotation (réservé coach)
- Pas d'accès à l'analyse IA (réservé coach)
- Photos partagées par le coach (PNG exporté annoté) : affichées avec badge "Partagé par votre coach"

---

## 8. Design System

Toutes les composantes respectent DS v2.0 :

- Background `#121212`, cards `bg-white/[0.02]`, accent `#1f8a65`
- Bordures `border-[0.3px] border-white/[0.06]`
- Badges drapeaux : rouge `text-red-400 bg-red-500/10`, orange `text-amber-400 bg-amber-500/10`, vert `text-[#1f8a65] bg-[#1f8a65]/10`
- Canvas : fond `#0a0a0a`, toolbar `bg-[#181818]`
- Modale canvas : plein écran `fixed inset-0`, z-50

---

## 9. Dépendances à ajouter

| Package  | Usage                                                                       |
| -------- | --------------------------------------------------------------------------- |
| `fabric` | Canvas d'annotation (Fabric.js v6)                                          |
| `jspdf`  | Export PDF                                                                  |
| `openai` | GPT-4o vision — analyse morphologique IA (requiert `OPENAI_API_KEY` en env) |

---

## 10. Ordre de livraison

```
1. Migration DB          → morpho_photos + morpho_annotations
2. API sync              → /api/morpho/photos/sync (pont bilans existants)
3. API photos            → upload coach + upload client + GET galerie
4. MorphoGallery         → galerie filtrée + upload
5. API annotations       → POST /api/morpho/annotations
6. MorphoCanvas          → canvas Fabric.js + outils + save/export
7. API analyze           → GPT-4o vision + buildAnalysisPrompt
8. MorphoAnalysis        → panel résultats IA + graphique évolution
9. MorphoCompare         → split-view + superposition
10. Page client          → /client/morpho
11. Docs                 → CHANGELOG + project-state
```

---

## 11. Points de vigilance

- Les signed URLs Supabase expirent en 1h — le canvas doit recharger la photo si elle expire pendant une session longue
- Fabric.js v6 est ESM-only — importer avec `dynamic(() => import('fabric'), { ssr: false })`
- L'analyse IA sur 4 photos simultanées peut prendre 10–20s — afficher un état de chargement avec étapes (`Chargement des photos… Analyse en cours… Génération des recommandations…`)
- `canvas_data` JSONB peut peser 50–200KB par annotation complexe — acceptable, pas de compression nécessaire en Phase 1
- Les photos client uploadées depuis `/client/morpho` doivent passer par une validation MIME côté serveur (jpeg/png/webp uniquement, 30MB max — aligne sur le bucket existant)
- `assessment_response_id` sur `morpho_photos` : unique constraint incluse dans le DDL — la sync est idempotente par construction
- `OPENAI_API_KEY` doit être défini en `.env.local` ET dans les variables Vercel avant déploiement — l'endpoint `/api/morpho/analyze` lève une erreur 500 explicite si la clé est absente (guard au démarrage du handler)
