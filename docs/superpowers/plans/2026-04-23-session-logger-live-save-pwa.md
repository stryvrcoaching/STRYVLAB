# Session Logger — Sauvegarde live, verrouillage navigation, PWA temps réel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher toute perte de données pendant une séance d'entraînement client, et faire en sorte que la PWA affiche toujours un contenu à jour sans manipulation de l'utilisateur.

**Architecture:** Création du `client_session_logs` au montage (draft immédiat), upsert des sets à chaque interaction via un nouvel endpoint `PATCH /api/session-logs/[logId]/sets`, et remplacement de la stratégie `staleWhileRevalidate` par `networkFirst` dans le service worker avec rechargement automatique à la mise à jour.

**Tech Stack:** Next.js App Router, Supabase (service role), React `useRef`/`useEffect`, Service Worker API, localStorage.

**Spec:** `docs/superpowers/specs/2026-04-23-session-logger-live-save-pwa.md`

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `supabase/migrations/YYYYMMDD_set_logs_unique.sql` | Créer — contrainte unique sur `client_set_logs` |
| `app/api/session-logs/[logId]/sets/route.ts` | Créer — endpoint PATCH upsert sets |
| `app/client/programme/session/[sessionId]/SessionLogger.tsx` | Modifier — supprimer bouton retour, draft au mount, live save |
| `app/client/programme/session/[sessionId]/page.tsx` | Modifier — passer `sessionId` en prop |
| `public/sw.js` | Modifier — network-first + cache v2 |
| `components/client/ServiceWorkerRegistrar.tsx` | Modifier — controllerchange → reload conditionnel |

---

## Task 1 : Migration DB — contrainte unique sur client_set_logs

**Files:**
- Create: `supabase/migrations/20260423_set_logs_unique.sql`

L'upsert du Task 2 nécessite une contrainte `UNIQUE (session_log_id, exercise_name, set_number, side)` sur `client_set_logs`. Sans elle, chaque PATCH crée des doublons au lieu de mettre à jour.

- [ ] **Step 1.1 : Créer la migration**

Créer `supabase/migrations/20260423_set_logs_unique.sql` avec ce contenu exact :

```sql
-- Contrainte unique pour permettre l'upsert live des sets en séance
ALTER TABLE client_set_logs
  ADD CONSTRAINT IF NOT EXISTS client_set_logs_session_exercise_set_side_unique
  UNIQUE (session_log_id, exercise_name, set_number, side);
```

- [ ] **Step 1.2 : Appliquer la migration**

```bash
npx supabase db push
```

Si la commande échoue (doublons existants), exécuter d'abord en SQL :
```sql
DELETE FROM client_set_logs a
USING client_set_logs b
WHERE a.id > b.id
  AND a.session_log_id = b.session_log_id
  AND a.exercise_name = b.exercise_name
  AND a.set_number = b.set_number
  AND a.side IS NOT DISTINCT FROM b.side;
```
Puis réappliquer.

- [ ] **Step 1.3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Attendu : 0 erreur.

- [ ] **Step 1.4 : Commit**

```bash
git add supabase/migrations/20260423_set_logs_unique.sql
git commit -m "schema: add unique constraint on client_set_logs for live upsert"
```

---

## Task 2 : Endpoint PATCH /api/session-logs/[logId]/sets

**Files:**
- Create: `app/api/session-logs/[logId]/sets/route.ts`

Cet endpoint reçoit un tableau de sets et fait un upsert par `(session_log_id, exercise_name, set_number, side)`. Il vérifie que le log appartient au client authentifié.

- [ ] **Step 2.1 : Créer l'endpoint**

Créer `app/api/session-logs/[logId]/sets/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { logId: string } }

const setLogSchema = z.object({
  exercise_id: z.string().uuid().nullable().optional(),
  exercise_name: z.string().min(1),
  set_number: z.number().int().positive(),
  side: z.enum(['left', 'right', 'bilateral']).default('bilateral'),
  planned_reps: z.union([z.string(), z.number()]).nullable().optional(),
  actual_reps: z.number().int().nonnegative().nullable().optional(),
  actual_weight_kg: z.number().nonnegative().nullable().optional(),
  completed: z.boolean().default(false),
  rir_actual: z.number().int().min(0).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
  rest_sec_actual: z.number().int().nonnegative().nullable().optional(),
})

const bodySchema = z.object({
  set_logs: z.array(setLogSchema),
})

// PATCH /api/session-logs/[logId]/sets — upsert live des sets pendant une séance
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  // Vérifier ownership : le log appartient au client connecté
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const { data: log } = await db
    .from('client_session_logs')
    .select('id')
    .eq('id', params.logId)
    .eq('client_id', (client as { id: string }).id)
    .is('completed_at', null)
    .single()
  if (!log) return NextResponse.json({ error: 'Séance introuvable ou déjà terminée' }, { status: 404 })

  const raw = await req.json()
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const rows = parsed.data.set_logs.map(s => ({
    session_log_id: params.logId,
    exercise_id: s.exercise_id ?? null,
    exercise_name: s.exercise_name,
    set_number: s.set_number,
    side: s.side,
    planned_reps: s.planned_reps ?? null,
    actual_reps: s.actual_reps ?? null,
    actual_weight_kg: s.actual_weight_kg ?? null,
    completed: s.completed,
    rir_actual: s.rir_actual ?? null,
    notes: s.notes ?? null,
    rest_sec_actual: s.rest_sec_actual ?? null,
  }))

  const { error } = await db
    .from('client_set_logs')
    .upsert(rows, {
      onConflict: 'session_log_id,exercise_name,set_number,side',
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2.2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Attendu : 0 erreur.

- [ ] **Step 2.3 : Commit**

```bash
git add app/api/session-logs/[logId]/sets/route.ts
git commit -m "feat(api): add PATCH session-logs/[logId]/sets for live set upsert"
```

---

## Task 3 : SessionLogger — suppression bouton retour + création draft + live save

**Files:**
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`
- Modify: `app/client/programme/session/[sessionId]/page.tsx`

C'est la tâche centrale. Trois changements dans `SessionLogger.tsx` :
1. Supprimer le bouton `ChevronLeft` du header
2. Créer le draft `client_session_logs` au montage et stocker l'ID en localStorage
3. Envoyer un PATCH live à chaque coche de set, et après 800ms de saisie dans un champ

- [ ] **Step 3.1 : Ajouter `sessionId` comme prop dans page.tsx**

Dans `app/client/programme/session/[sessionId]/page.tsx`, modifier le composant `SessionLogger` pour lui passer `sessionId` :

```typescript
// Ligne ~143 — remplacer le return par :
return (
  <SessionLogger
    clientId={client.id}
    sessionId={params.sessionId}
    session={{ id: session.id, name: session.name }}
    exercises={exercisesWithAlternatives}
    lastPerformance={lastPerformance}
  />
)
```

- [ ] **Step 3.2 : Mettre à jour l'interface Props dans SessionLogger.tsx**

Trouver l'interface `Props` (ligne ~55) et ajouter `sessionId` :

```typescript
interface Props {
  clientId: string
  sessionId: string
  session: { id: string; name: string }
  exercises: Exercise[]
  lastPerformance: Record<string, LastPerf[]>
}
```

Mettre à jour la signature de la fonction :

```typescript
export default function SessionLogger({ clientId, sessionId, session, exercises, lastPerformance }: Props) {
```

- [ ] **Step 3.3 : Ajouter les states et refs pour le live save**

Après la ligne `const [altSheetTarget, setAltSheetTarget] = useState<number | null>(null)` (ligne ~141), ajouter :

```typescript
  // ── Live save ──
  const sessionLogIdRef = useRef<string | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const DRAFT_KEY = `draft_session_log_id_${sessionId}`
```

- [ ] **Step 3.4 : Ajouter la fonction patchSets**

Après la déclaration des refs (après `const LONG_PRESS_DURATION = 3000`), ajouter :

```typescript
  // Envoie un upsert des sets actuels d'un exercice vers la DB (fire-and-forget)
  async function patchSets(currentSets: SetLog[]) {
    const logId = sessionLogIdRef.current
    if (!logId) return
    try {
      await fetch(`/api/session-logs/${logId}/sets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_logs: currentSets }),
      })
    } catch {
      // Erreur réseau silencieuse — les données sont en state React
    }
  }
```

- [ ] **Step 3.5 : Ajouter le useEffect de création/récupération du draft**

Après les useEffect existants du chrono global (après `}, [startTime]`), ajouter :

```typescript
  // ── Création ou récupération du draft session log au montage ──
  useEffect(() => {
    async function initDraft() {
      const existingId = localStorage.getItem(DRAFT_KEY)

      if (existingId) {
        // Vérifier que ce log existe encore en DB et n'est pas terminé
        try {
          const res = await fetch(`/api/session-logs/${existingId}/sets`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ set_logs: [] }),
          })
          if (res.ok) {
            sessionLogIdRef.current = existingId
            setDraftReady(true)
            return
          }
        } catch {
          // Log invalide ou réseau coupé — on en crée un nouveau
        }
        localStorage.removeItem(DRAFT_KEY)
      }

      // Créer un nouveau session log
      try {
        const res = await fetch('/api/session-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_session_id: session.id,
            session_name: session.name,
            set_logs: [],
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const newId = data?.session_log?.id
          if (newId) {
            sessionLogIdRef.current = newId
            localStorage.setItem(DRAFT_KEY, newId)
          }
        }
      } catch {
        // Pas de réseau au démarrage — on fonctionnera sans live save
      }
      setDraftReady(true)
    }
    initDraft()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 3.6 : Modifier toggleSet pour patcher immédiatement après la coche**

Remplacer la fonction `toggleSet` existante (ligne ~269) par :

```typescript
  function toggleSet(exId: string, setNum: number, side: string, restSec: number | null) {
    setSets(prev => {
      const next = prev.map(s => {
        if (s.exercise_id !== exId || s.set_number !== setNum || s.side !== side) return s
        const nowCompleted = !s.completed
        if (nowCompleted) {
          const alreadyTracking = pendingRestSet?.exId === exId && pendingRestSet?.setNum === setNum && pendingRestSet?.side === side
          if (!alreadyTracking) {
            startRest(exId, setNum, side, restSec)
          }
        }
        return { ...s, completed: nowCompleted }
      })
      // Patch immédiat sur la coche — intentionnel, pas de debounce
      const exSetsUpdated = next.filter(s => s.exercise_id === exId)
      patchSets(exSetsUpdated)
      return next
    })
  }
```

- [ ] **Step 3.7 : Modifier updateSet pour débouncer le patch**

Remplacer la fonction `updateSet` existante (ligne ~245) par :

```typescript
  function updateSet(exId: string, setNum: number, side: string, patch: Partial<SetLog>) {
    onSetInteraction(exId, setNum, side)
    setSets(prev => {
      const next = prev.map(s =>
        s.exercise_id === exId && s.set_number === setNum && s.side === side
          ? { ...s, ...patch }
          : s
      )
      const updated = next.find(s => s.exercise_id === exId && s.set_number === setNum && s.side === side)
      if (updated && !updated.completed && (updated.actual_reps || updated.actual_weight_kg)) {
        const ex = exercises.find(e => e.id === exId)
        const alreadyTracking = pendingRestSet?.exId === exId && pendingRestSet?.setNum === setNum && pendingRestSet?.side === side
        if (!alreadyTracking) {
          startRest(exId, setNum, side, ex?.rest_sec ?? null)
        } else {
          scheduleModalOpen()
        }
      }
      // Debounce 800ms sur la saisie clavier
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
      const exSetsUpdated = next.filter(s => s.exercise_id === exId)
      saveDebounceRef.current = setTimeout(() => {
        patchSets(exSetsUpdated)
      }, 800)
      return next
    })
  }
```

- [ ] **Step 3.8 : Modifier submitSession pour flush final + nettoyage localStorage**

Remplacer la fonction `submitSession` existante (ligne ~335) par :

```typescript
  async function submitSession() {
    setSaveState('saving')
    setErrorMsg(null)
    const durationMin = Math.round(elapsed / 60)
    const logId = sessionLogIdRef.current

    // Flush final de tous les sets avant de marquer completed
    if (logId) {
      try {
        await fetch(`/api/session-logs/${logId}/sets`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ set_logs: sets }),
        })
      } catch {
        // On continue même si le flush échoue — les données ont été patchées live
      }
    }

    // Marquer la séance comme terminée
    if (logId) {
      try {
        await fetch(`/api/session-logs/${logId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: true, duration_min: durationMin }),
        })
      } catch (err) {
        setSaveState('error')
        setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau — vérifie ta connexion')
        return
      }
    } else {
      // Fallback : pas de logId (réseau coupé au démarrage) — POST complet
      try {
        const res = await fetch('/api/session-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_session_id: session.id,
            session_name: session.name,
            exercise_notes: exerciseNotes,
            set_logs: sets.map(s => ({
              exercise_id: s.exercise_id,
              exercise_name: s.exercise_name,
              set_number: s.set_number,
              side: s.side,
              planned_reps: s.planned_reps,
              actual_reps: s.actual_reps ? parseInt(s.actual_reps) : null,
              actual_weight_kg: s.actual_weight_kg ? parseFloat(s.actual_weight_kg) : null,
              completed: s.completed,
              rir_actual: s.rir_actual ? parseInt(s.rir_actual) : null,
              notes: s.notes || null,
              rest_sec_actual: s.rest_sec_actual ?? null,
            })),
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? `Erreur serveur (${res.status})`)
        }
        const data = await res.json()
        const newLogId = data?.session_log?.id
        if (newLogId) {
          await fetch(`/api/session-logs/${newLogId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true, duration_min: durationMin }),
          }).catch(() => {})
          setSaveState('idle')
          localStorage.removeItem(DRAFT_KEY)
          router.push(`/client/programme/recap/${newLogId}`)
          return
        }
      } catch (err) {
        setSaveState('error')
        setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau — vérifie ta connexion')
        return
      }
    }

    setSaveState('idle')
    localStorage.removeItem(DRAFT_KEY)
    router.push(`/client/programme/recap/${logId}`)
  }
```

- [ ] **Step 3.9 : Supprimer le bouton retour dans le header**

Localiser le bouton `ChevronLeft` dans le header (ligne ~422-427) :

```tsx
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.07] hover:text-white/70 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
```

Le remplacer par un spacer de même taille pour conserver l'alignement du header :

```tsx
          <div className="h-9 w-9" />
```

Supprimer aussi `ChevronLeft` de la liste des imports Lucide si c'est le seul usage (vérifier qu'il n'est pas utilisé ailleurs dans le composant). L'import ligne ~8 liste : `ChevronLeft, ChevronRight` — `ChevronLeft` est aussi utilisé dans la navigation exercices (ligne ~569). Le laisser dans les imports.

- [ ] **Step 3.10 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Attendu : 0 erreur.

- [ ] **Step 3.11 : Commit**

```bash
git add app/client/programme/session/[sessionId]/SessionLogger.tsx
git add app/client/programme/session/[sessionId]/page.tsx
git commit -m "feat(client): session live save — draft at mount, set-by-set upsert, remove back button"
```

---

## Task 4 : Service Worker — network-first + cache v2

**Files:**
- Modify: `public/sw.js`
- Modify: `components/client/ServiceWorkerRegistrar.tsx`

- [ ] **Step 4.1 : Mettre à jour sw.js**

Remplacer le contenu entier de `public/sw.js` par :

```javascript
const CACHE_NAME = 'stryv-client-v2'

// Assets statiques à pré-cacher
const STATIC_ASSETS = [
  '/client',
  '/client/programme',
  '/client/bilans',
  '/client/profil',
  '/manifest.json',
]

// Patterns d'URL qui ne doivent PAS être mis en cache
const NO_CACHE_PATTERNS = [
  /\/api\//,
  /supabase/,
  /\.hot-update\./,
]

// ─── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ─── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (NO_CACHE_PATTERNS.some((p) => p.test(url.pathname + url.hostname))) return

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
    return
  }

  // Assets statiques versionnés → cache-first (hash dans le nom = jamais stale)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Pages client → network-first avec timeout 3s
  if (url.pathname.startsWith('/client')) {
    event.respondWith(networkFirstWithTimeout(request, 3000))
    return
  }
})

// ─── Stratégies ────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached ?? new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function networkFirstWithTimeout(request, timeoutMs) {
  const cache = await caches.open(CACHE_NAME)

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs)
  )

  try {
    const response = await Promise.race([fetch(request), timeoutPromise])
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Timeout ou offline → servir le cache
    const cached = await cache.match(request)
    return cached ?? new Response('Offline', { status: 503 })
  }
}
```

- [ ] **Step 4.2 : Mettre à jour ServiceWorkerRegistrar.tsx**

Remplacer le contenu entier de `components/client/ServiceWorkerRegistrar.tsx` par :

```typescript
'use client'

import { useEffect } from 'react'

// Clé localStorage utilisée par SessionLogger pour détecter une séance active
const DRAFT_KEY_PREFIX = 'draft_session_log_id_'

function hasActiveDraft(): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(DRAFT_KEY_PREFIX)) return true
  }
  return false
}

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/client' })
      .catch(() => {
        // SW registration failed silently — app still works without it
      })

    // Recharger automatiquement quand un nouveau SW prend le contrôle
    // Sauf si une séance est en cours (draft présent en localStorage)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hasActiveDraft()) {
        window.location.reload()
      }
    })
  }, [])

  return null
}
```

- [ ] **Step 4.3 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Attendu : 0 erreur.

- [ ] **Step 4.4 : Commit**

```bash
git add public/sw.js components/client/ServiceWorkerRegistrar.tsx
git commit -m "feat(pwa): network-first for client pages, auto-reload on SW update"
```

---

## Task 5 : Mise à jour CHANGELOG et project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 5.1 : Mettre à jour CHANGELOG.md**

Ajouter en tête de `CHANGELOG.md` :

```markdown
## 2026-04-23

FEATURE: Session Logger — live save set-by-set via PATCH /api/session-logs/[logId]/sets
FEATURE: Session Logger — draft créé au montage, récupérable après crash ou rechargement
FEATURE: Session Logger — suppression bouton retour pendant une séance active
FEATURE: PWA — network-first avec timeout 3s pour les pages /client (cache v2)
FEATURE: PWA — rechargement automatique au déploiement d'un nouveau service worker
SCHEMA: Contrainte UNIQUE sur client_set_logs(session_log_id, exercise_name, set_number, side)
```

- [ ] **Step 5.2 : Mettre à jour project-state.md**

Ajouter une section datée dans `.claude/rules/project-state.md` :

```markdown
## 2026-04-23 — Session Logger Live Save + PWA Temps Réel

**Ce qui a été fait :**

1. **`supabase/migrations/20260423_set_logs_unique.sql`** — contrainte UNIQUE sur `client_set_logs`
   - `UNIQUE (session_log_id, exercise_name, set_number, side)` — requis pour l'upsert idempotent

2. **`app/api/session-logs/[logId]/sets/route.ts`** — nouveau endpoint PATCH
   - Upsert des sets via la contrainte unique — pas de doublons possibles
   - Ownership check : log doit appartenir au client connecté ET avoir `completed_at IS NULL`

3. **`SessionLogger.tsx`** — live save complet
   - `sessionLogIdRef` (useRef) — ID du draft, pas de re-render
   - Draft créé au montage via POST, ID stocké en `localStorage` sous `draft_session_log_id_${sessionId}`
   - `toggleSet` : patch immédiat (sans debounce) à chaque coche de set
   - `updateSet` : debounce 800ms sur la saisie reps/poids/RIR
   - `submitSession` : flush final → PATCH completed — plus de POST au submit si draft présent
   - Fallback POST complet si `sessionLogIdRef` est null (réseau coupé au démarrage)
   - Bouton `ChevronLeft` remplacé par un spacer `div` — seule sortie = bouton Terminer

4. **`public/sw.js`** — cache v2, stratégie network-first
   - `networkFirstWithTimeout(request, 3000)` pour les pages `/client`
   - Timeout 3s → fallback cache si réseau lent ou offline
   - `stryv-client-v2` invalide proprement l'ancien cache v1

5. **`ServiceWorkerRegistrar.tsx`** — rechargement auto
   - `controllerchange` → `window.location.reload()` si pas de draft actif
   - `hasActiveDraft()` vérifie les clés `draft_session_log_id_*` en localStorage

**Points de vigilance :**
- Le draft est créé même si le client ne saisit rien — cleanup possible en ajoutant un TTL localStorage en Phase 2
- Si deux onglets sont ouverts sur la même session, deux drafts seront créés (même `program_session_id`) — acceptable Phase 1
- La contrainte unique autorise `side IS NULL` distinct de `side = 'bilateral'` (NULL ≠ NULL en SQL) — les sets sans side explicite ont `'bilateral'` comme default dans le schema Zod
- Le rechargement auto n'a pas lieu si l'utilisateur est en séance — il verra le rechargement à la fin de séance seulement
```

- [ ] **Step 5.3 : Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for live save + PWA session"
```
