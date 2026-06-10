# STRYVR — Application Client : Référence Complète

> Document de référence pour tout travail sur l'app client (`/client/*`).
> Dernière mise à jour : 2026-04-27

---

## Vue d'ensemble

L'application client est une **mini-app PWA mobile-first** intégrée dans le même projet Next.js que le dashboard coach. Elle est accessible à `stryvlab.com/client/*` et destinée aux clients invités par leur coach.

**Objectif UX :** < 5 minutes d'interaction par séance. Dense, rapide, sans friction.

---

## Architecture générale

```
Coach invite le client
        ↓
Email d'invitation (lien Supabase type=recovery)
        ↓
/client/onboarding  → setSession() manuel depuis hash
        ↓
Formulaire création mot de passe → supabase.auth.updateUser()
        ↓
Page de bienvenue → /client (home)
        ↓
Sessions suivantes : /client/login → signInWithPassword()
```

**Stack :**
- Next.js App Router (Server Components + Client Components)
- Supabase Auth (session cookie via `@supabase/ssr`)
- Service Worker (`/public/sw.js`) — cache v3, network-first pages
- PWA manifest (`/public/manifest.json`)
- i18n : FR / EN / ES via `lib/i18n/clientTranslations.ts`

---

## Routes

### Authentification (publiques — pas de middleware)

| Route | Fichier | Rôle |
|-------|---------|------|
| `/client/login` | `app/client/login/page.tsx` | Connexion email + mot de passe. Si hash `#access_token` détecté → forward vers `/client/onboarding` |
| `/client/onboarding` | `app/client/onboarding/page.tsx` | Flow d'onboarding : setSession() depuis hash → création mot de passe → écran de bienvenue |
| `/client/acces-suspendu` | `app/client/acces-suspendu/page.tsx` | Écran bloquant si statut `suspended` |

### Application (protégées par middleware)

| Route | Fichier | Rôle |
|-------|---------|------|
| `/client` | `app/client/page.tsx` | Home : séance du jour, stats semaine, message coach, bilans en attente |
| `/client/programme` | `app/client/programme/page.tsx` | Liste des séances du programme actif |
| `/client/programme/session/[sessionId]` | `.../session/[sessionId]/page.tsx` | Logger de séance live (sets, reps, poids, RIR) |
| `/client/programme/recap/[sessionLogId]` | `.../recap/[sessionLogId]/page.tsx` | Récap post-séance |
| `/client/progress` | `app/client/progress/page.tsx` | Graphiques progression (poids, force, heatmap, PRs) |
| `/client/nutrition` | `app/client/nutrition/page.tsx` | Protocole nutritionnel actif partagé par le coach |
| `/client/bilans` | `app/client/bilans/page.tsx` | Liste des bilans (pending / completed) |
| `/client/bilans/[submissionId]` | `app/client/bilans/[submissionId]/page.tsx` | Formulaire bilan |
| `/client/profil` | `app/client/profil/page.tsx` | Profil : infos, préférences, langue, notifications, restrictions, photo |

---

## API Routes (`/api/client/*`)

Toutes ces routes résolvent le client via `user_id` → `coach_clients`.

| Endpoint | Méthode | Rôle |
|----------|---------|------|
| `/api/client/preferences` | GET / PATCH | Langue, unités, notifications. Retourne defaults si pas de ligne en DB |
| `/api/client/profile` | GET / PATCH | Prénom, nom, genre, date de naissance |
| `/api/client/profile/photo` | POST | Upload photo de profil → Supabase Storage |
| `/api/client/restrictions` | GET / POST | Restrictions physiques du client (blessures, zones à éviter) |
| `/api/client/restrictions/[annotationId]` | DELETE | Suppression d'une restriction |
| `/api/client/notifications` | GET | Liste des notifications non lues |
| `/api/client/notifications/[id]/read` | POST | Marquer une notification comme lue |
| `/api/client/notifications/all/read` | POST | Marquer toutes comme lues |
| `/api/client/nutrition-protocols-status` | GET | Vérifie si un protocole actif existe (banner NewProtocol) |
| `/api/client/performance` | GET | Données de performance pour les graphiques progress |
| `/api/client/welcome` | POST | Envoie l'email de bienvenue après création du mot de passe |

### Autres API utilisées par le client

| Endpoint | Usage |
|----------|-------|
| `/api/session-logs` | POST créer log, GET liste |
| `/api/session-logs/[logId]` | PATCH (compléter la séance) |
| `/api/session-logs/[logId]/sets` | PATCH upsert sets live |
| `/api/assessments/public/[token]` | GET / POST bilan public |
| `/api/assessments/photos/signed-url` | POST signed URL pour photos bilan |

---

## Middleware (`utils/supabase/middleware.ts`)

Routes **exemptées** du guard auth client :
- `/client/login`
- `/client/auth`
- `/client/access`
- `/client/onboarding`
- `/client/acces-suspendu`

Logique de protection :
1. Si route protégée + pas de session → redirect `/client/login`
2. Si route protégée + session + `coach_clients.status = 'suspended'` → redirect `/client/acces-suspendu`
3. Si `/client/login` + session déjà active → redirect `/client`

---

## Layout et Shell

```
app/client/layout.tsx
  └── ClientI18nProvider        (contexte i18n — charge langue depuis DB)
       └── ConditionalClientShell
            ├── AUTH_PATHS → children seuls (pas de nav)
            └── autres → div pb-28 + BottomNav
```

**`ConditionalClientShell`** — routes sans BottomNav :
`/client/login`, `/client/set-password`, `/client/auth`, `/client/access`, `/client/onboarding`, `/client/acces-suspendu`

**`BottomNav`** — 6 onglets fixes :
Home · Programme · Progrès · Nutrition · Bilans · Profil

---

## Onboarding — Flow détaillé

Le flow d'invitation fonctionne ainsi :

1. **Coach** clique "Envoyer l'invitation" → `POST /api/clients/[clientId]/invite`
2. **Route invite** :
   - Si compte auth inexistant → `admin.createUser()` puis `generateLink({ type: 'recovery' })`
   - Si compte existant non suspendu → `generateLink({ type: 'recovery' })` directement
   - Si compte suspendu → unban + email "accès restauré" (pas de lien)
3. **Email** envoyé via Namecheap SMTP (`lib/email/mailer.ts`) avec le lien Supabase
4. **Lien** : `supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=stryvlab.com/client/onboarding`
5. **Supabase** vérifie le token → redirige vers `/client/onboarding#access_token=...&refresh_token=...`
6. **Page onboarding** : extrait les tokens du hash → `supabase.auth.setSession()` manuellement
   - ⚠️ `@supabase/ssr` ne parse PAS le hash automatiquement — `setSession()` est obligatoire
7. Client crée son mot de passe → `supabase.auth.updateUser({ password })`
8. Écran de bienvenue → `router.push('/client')`

**Points critiques :**
- `NEXT_PUBLIC_SITE_URL` doit être `https://www.stryvlab.com` (avec www) pour éviter le redirect Vercel non-www→www qui strip le hash
- `/client/onboarding` doit être dans les Redirect URLs Supabase Dashboard
- Le `user_id` est lié dans `coach_clients` à l'étape 2 (avant que le client clique)

---

## Authentification cliente — Session

Le client se connecte avec **email + mot de passe** uniquement (`signInWithPassword`).

Résolution du profil client :
```typescript
// lib/client/resolve-client.ts
// 1. Cherche par user_id (login normal)
// 2. Fallback email + user_id=null (premier login si lien non encore lié)
//    → auto-link user_id au passage
```

**Si `resolveClientFromUser` retourne null** → le client voit `NoProgramPage` (pas de crash).

---

## i18n

Langues supportées : `fr` | `en` | `es`

```typescript
// Côté Server Component
import { ct, cta, ctp } from '@/lib/i18n/clientTranslations'
ct(lang, 'home.section')           // string
cta(lang, 'programme.days.full')   // string[]
ctp(lang, 'home.bilans.many', n)   // pluriel

// Côté Client Component
const { t, ta, tp } = useClientT()
```

La langue est chargée depuis :
1. `localStorage` (instantané, évite le flash)
2. `/api/client/preferences` (source de vérité DB)

---

## SessionLogger — Live Save

Le logger de séance sauvegarde en temps réel :

- **Création draft** au mount → `POST /api/session-logs`
- **Toggle set** (coché/décoché) → `PATCH /api/session-logs/[logId]/sets` immédiat
- **Saisie reps/poids/RIR** → debounce 800ms → même PATCH
- **Terminer** → `PATCH /api/session-logs/[logId]` avec `completed_at`
- **Draft ID** persisté en `localStorage` sous `draft_session_log_id_${sessionId}`

Le Service Worker **ne recharge pas** la page si un draft est actif (`hasActiveDraft()` check).

---

## PWA — Service Worker

Fichier : `/public/sw.js` — cache `stryv-client-v3`

| Pattern URL | Stratégie |
|-------------|-----------|
| `/api/*` | network-first |
| `/_next/static/` | cache-first (assets versionnés) |
| `/client/*` | network-first avec timeout 3s → fallback cache |

**Pour forcer la réinstallation du SW** (après déploiement majeur) : bumper `CACHE_NAME` → `stryv-client-v4`, etc.

---

## Composants clés (`components/client/`)

| Composant | Rôle |
|-----------|------|
| `BottomNav.tsx` | Navigation fixe 6 onglets, utilise `useClientT()` |
| `ClientI18nProvider.tsx` | Contexte i18n, expose `useClientT()` |
| `ConditionalClientShell.tsx` | Shell conditionnel (nav vs auth pages) |
| `ServiceWorkerRegistrar.tsx` | Inscription SW + auto-reload protégé |
| `BodyMap.tsx` | Carte anatomique 3 états (primaire / secondaire / inactif) |
| `SessionLogger.tsx` | Logger live avec draft localStorage |
| `ExerciseSwapSheet.tsx` | Bottom sheet swap exercice (temporaire, non persisté) |
| `ClientAlternativesSheet.tsx` | Bottom sheet alternatives pré-configurées par le coach |
| `ContextualGreeting.tsx` | Salutation contextuelle (heure + séance du jour) |
| `NewProtocolBanner.tsx` | Banner si nouveau protocole nutrition disponible |

---

## Points de vigilance

| Sujet | Détail |
|-------|--------|
| `@supabase/ssr` ne parse pas le hash | Toujours appeler `setSession()` manuellement sur les pages qui reçoivent un token dans le hash |
| `resolveClientFromUser` avec `user_id=null` | Le fallback email ne trouve rien si `user_id` a déjà été lié — comportement normal |
| SW cache périmé | Bumper `CACHE_NAME` à chaque déploiement majeur. Demander au client de vider Safari si crash inexpliqué |
| `www.` vs sans www | Vercel redirige non-www→www, ce qui stripe le hash. `NEXT_PUBLIC_SITE_URL` doit inclure `www.` |
| `client_preferences` absente | `/api/client/preferences` retourne des defaults si pas de ligne — ne jamais supposer que la ligne existe |
| Suspended vs Inactive | `suspended` = banni Supabase (ban_duration 87600h). `inactive` = compte pas encore créé ou désactivé manuellement |
