# BottomNav Client — Refonte Design + Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la BottomNav client de 6 items basiques vers 4 items pro (Home · Programme · Nutrition · Profil), avec un design aligné sur le DockLeft coach, et corriger le lien "Bilan en attente" sur la home pour ouvrir directement le bilan concerné.

**Architecture:** Remplacement du composant `BottomNav` existant — même fichier, même point de rendu (`ConditionalClientShell`). Mise à jour de `OnboardingTour` dont les index nav sont hardcodés sur l'ancienne structure 6 items. Correction du fetch sur la home page pour récupérer l'`id` du premier bilan pending (au lieu de juste le count).

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, Lucide React, Supabase (service role pour le fetch home).

---

## Fichiers impactés

| Fichier | Action |
|---|---|
| `components/client/BottomNav.tsx` | Modifier — 4 items, nouveau design |
| `components/client/OnboardingTour.tsx` | Modifier — 4 steps, index mis à jour |
| `app/client/page.tsx` | Modifier — fetch submission ID + lien direct |

---

### Task 1 : Refonte `BottomNav` — 4 items, design pro

**Files:**
- Modify: `components/client/BottomNav.tsx`

- [ ] **Step 1 : Remplacer le contenu du fichier**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Dumbbell, Utensils, User } from 'lucide-react'
import { useClientT } from './ClientI18nProvider'
import type { ClientDictKey } from '@/lib/i18n/clientTranslations'

const NAV: { href: string; labelKey: ClientDictKey; icon: React.ElementType }[] = [
  { href: '/client',           labelKey: 'nav.home',      icon: Home },
  { href: '/client/programme', labelKey: 'nav.programme', icon: Dumbbell },
  { href: '/client/nutrition', labelKey: 'nav.nutrition', icon: Utensils },
  { href: '/client/profil',    labelKey: 'nav.profil',    icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useClientT()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto w-full max-w-[480px] px-4">
        <div className="flex items-center justify-around rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] shadow-[0_-1px_0_rgba(255,255,255,0.04),0_-8px_32px_rgba(0,0,0,0.4)] px-2 h-16">
          {NAV.map(({ href, labelKey, icon: Icon }) => {
            const active = href === '/client' ? pathname === '/client' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl transition-all duration-150 active:scale-95 ${
                  active
                    ? 'text-[#1f8a65]'
                    : 'text-white/35 hover:text-white/60'
                }`}
              >
                {active && (
                  <span className="absolute inset-0 rounded-xl bg-[#1f8a65]/10" />
                )}
                <Icon
                  size={20}
                  strokeWidth={active ? 2 : 1.5}
                  className="relative z-10"
                />
                {active && (
                  <span className="absolute bottom-2 w-1 h-1 rounded-full bg-[#1f8a65]" />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "BottomNav"
```

Expected : aucune ligne de sortie (zéro erreur sur ce fichier).

- [ ] **Step 3 : Commit**

```bash
git add components/client/BottomNav.tsx
git commit -m "feat(client-nav): refonte BottomNav — 4 items, design pro aligné DockLeft (bg-[#181818], dot actif, icônes 20px)"
```

---

### Task 2 : Mise à jour `OnboardingTour` — 4 steps, index corrects

**Files:**
- Modify: `components/client/OnboardingTour.tsx`

L'ancienne structure avait 6 items (index 0–5) et un tableau `NAV_TOUR_TARGETS` contournant certains index. Avec 4 items (0=Home, 1=Programme, 2=Nutrition, 3=Profil), les steps et index sont simplifiés.

- [ ] **Step 1 : Remplacer `TOUR_STEPS` et `NAV_TOUR_TARGETS`**

Remplacer les lignes 6–43 (type + constantes) par :

```tsx
type TourStep = {
  navIndex: number // index in BottomNav (0=Home, 1=Programme, 2=Nutrition, 3=Profil)
  title: string
  body: string
}

const TOUR_STEPS: TourStep[] = [
  {
    navIndex: 0,
    title: 'Ton dashboard',
    body: 'C\'est ton point de départ. Tes actions du jour et les messages de ton coach sont ici.',
  },
  {
    navIndex: 1,
    title: 'Ton programme',
    body: 'Retrouve tes séances de la semaine et ta progression dans le temps.',
  },
  {
    navIndex: 2,
    title: 'Ta nutrition',
    body: 'Ton protocole nutritionnel préparé par ton coach. Macros, hydratation, jours hauts et bas.',
  },
  {
    navIndex: 3,
    title: 'Ton profil',
    body: 'Complète ton profil — tes restrictions physiques, tes préférences. Important pour que ton coach puisse t\'accompagner au mieux.',
  },
]
```

- [ ] **Step 2 : Supprimer `NAV_TOUR_TARGETS` et corriger son usage**

Ligne 43 : supprimer `const NAV_TOUR_TARGETS = [0, 1, 2, 3, 5]`

Ligne 83 : remplacer :
```tsx
const targetNavIndex = NAV_TOUR_TARGETS[step.navIndex] ?? step.navIndex
```
par :
```tsx
const targetNavIndex = step.navIndex
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "OnboardingTour"
```

Expected : aucune ligne.

- [ ] **Step 4 : Commit**

```bash
git add components/client/OnboardingTour.tsx
git commit -m "fix(onboarding-tour): mise à jour 4 steps et index nav après refonte BottomNav"
```

---

### Task 3 : Home — lien bilan direct vers le submission

**Files:**
- Modify: `app/client/page.tsx`

Actuellement la home fetche `pendingResult` avec `{ count: 'exact', head: true }` (aucune donnée retournée, seulement le count). Il faut fetcher l'`id` du premier bilan pending pour construire le lien direct `/client/bilans/${id}`.

- [ ] **Step 1 : Modifier le fetch `pendingResult` pour récupérer l'ID**

Trouver ce bloc (lignes ~118–122) :

```ts
clientId
  ? service
      .from('assessment_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('status', ['pending', 'in_progress'])
  : Promise.resolve({ count: 0 }),
```

Le remplacer par :

```ts
clientId
  ? service
      .from('assessment_submissions')
      .select('id')
      .eq('client_id', clientId)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: true })
  : Promise.resolve({ data: [] }),
```

- [ ] **Step 2 : Adapter l'extraction des données**

Trouver (ligne ~176) :

```ts
const pendingCount = (pendingResult as any)?.count ?? 0
```

Remplacer par :

```ts
const pendingSubmissions: { id: string }[] = (pendingResult as any)?.data ?? []
const pendingCount = pendingSubmissions.length
const firstPendingId = pendingSubmissions[0]?.id ?? null
```

- [ ] **Step 3 : Corriger le lien CTA bilan**

Trouver (ligne ~388) :

```tsx
href="/client/bilans"
```

Remplacer par :

```tsx
href={firstPendingId ? `/client/bilans/${firstPendingId}` : '/client/bilans'}
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "client/page"
```

Expected : aucune ligne.

- [ ] **Step 5 : Commit**

```bash
git add app/client/page.tsx
git commit -m "fix(home): lien bilan en attente pointe directement vers /client/bilans/[id] — plus de page liste intermédiaire"
```

---

### Task 4 : Vérification finale + CHANGELOG

- [ ] **Step 1 : Vérification TypeScript globale (hors erreurs pré-existantes)**

```bash
npx tsc --noEmit 2>&1 | grep -v "stripe\|BodyFatCalculator\|webhook\|payments/route\|CarbCycling\|HRZones\|session-logs.test" | grep "error TS"
```

Expected : aucune ligne.

- [ ] **Step 2 : Mettre à jour CHANGELOG.md**

Ajouter en tête de la section `## 2026-04-29` :

```
FEATURE(client-nav): BottomNav refonte — 4 items (Home, Programme, Nutrition, Profil), bg-[#181818], dot actif vert, icônes 20px strokeWidth 1.5/2, shadow élévation — aligné design DockLeft coach
FIX(client-nav): suppression items Bilans et Progrès de la nav — Bilans accessible via lien direct home, Progrès dans Programme
FIX(onboarding-tour): 4 steps alignés sur la nouvelle nav — index corrigés, step Bilans supprimé
FIX(home): lien "Bilan en attente" redirige directement vers /client/bilans/[submissionId]
```

- [ ] **Step 3 : Commit final**

```bash
git add CHANGELOG.md
git commit -m "chore: CHANGELOG — refonte BottomNav client + fix lien bilan direct"
```
