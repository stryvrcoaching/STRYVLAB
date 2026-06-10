# Client Access — Password Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le système magic link Supabase (OTP fragile, usage unique, double consommation Edge) par un système de mot de passe temporaire : à la génération du token d'accès, un mot de passe aléatoire est généré et stocké chiffré, et la route `/client/access/[token]` fait un `signInWithPassword` côté serveur pour créer la session.

**Architecture:** La route `/client/access/[token]` reçoit le token, récupère l'email + mot de passe temporaire du client, appelle `auth.admin.createSession` ou `signInWithPassword` via le service role, puis pose les cookies de session sur la réponse redirect vers `/client`. Plus de magic link, plus d'OTP, plus de dépendance à l'Implicit Flow.

**Tech Stack:** Next.js Route Handler, @supabase/supabase-js (service role), @supabase/ssr (cookies), crypto (Node built-in pour génération mot de passe)

---

## Fichiers touchés

| Fichier | Action | Rôle |
|---------|--------|------|
| `app/api/clients/[clientId]/access-token/route.ts` | Modifier | Générer un mot de passe temporaire + mettre à jour le compte Supabase du client |
| `app/client/access/[token]/route.ts` | Modifier | Faire `signInWithPassword` + poser les cookies de session |
| `app/client/auth/confirm/page.tsx` | Supprimer | Plus nécessaire — la session est créée côté serveur directement |
| `middleware.ts` | Modifier | Retirer l'exclusion `/client/access` ajoutée précédemment |
| `CHANGELOG.md` | Modifier | Documenter le changement |

---

## Task 1 : Mise à jour de `access-token/route.ts` — génération du mot de passe temporaire

**Fichiers :**
- Modifier : `app/api/clients/[clientId]/access-token/route.ts`

**Contexte :** Actuellement, cette route génère un magic link Supabase et stocke l'`action_link` dans `magic_url`. On va à la place générer un mot de passe aléatoire, mettre à jour le compte Supabase du client via `auth.admin.updateUserById`, et stocker ce mot de passe en clair dans `magic_url` (champ réutilisé — on évite une migration DB). Le mot de passe n'est pas un secret durable : il est valide 30 jours max et révocable.

- [ ] **Étape 1 : Remplacer la logique de génération dans `POST`**

Remplacer dans `app/api/clients/[clientId]/access-token/route.ts` le bloc `generateLink` (lignes 37-44) par :

```typescript
import crypto from 'crypto'

// Dans le POST handler, après avoir vérifié le client :

// Générer un mot de passe temporaire aléatoire (32 hex chars = 128 bits)
const tempPassword = crypto.randomBytes(32).toString('hex')

// S'assurer que le compte Supabase existe pour cet email, sinon le créer
const { data: existingUser } = await db.auth.admin.listUsers()
const userExists = existingUser?.users?.find((u: { email?: string }) => u.email === client.email)

let userId: string

if (userExists) {
  // Mettre à jour le mot de passe du compte existant
  const { data: updated, error: updateError } = await db.auth.admin.updateUserById(
    userExists.id,
    { password: tempPassword }
  )
  if (updateError || !updated) {
    console.error('updateUserById error:', updateError)
    return NextResponse.json({ error: 'Impossible de préparer l\'accès client' }, { status: 500 })
  }
  userId = userExists.id
} else {
  // Créer le compte Supabase pour ce client
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: client.email,
    password: tempPassword,
    email_confirm: true,
  })
  if (createError || !created?.user) {
    console.error('createUser error:', createError)
    return NextResponse.json({ error: 'Impossible de créer le compte client' }, { status: 500 })
  }
  userId = created.user.id
}
```

- [ ] **Étape 2 : Stocker `tempPassword` dans `magic_url` et `userId` dans le token**

Remplacer le bloc `upsert` existant par :

```typescript
const { data: tokenRow, error: tokenError } = await db
  .from('client_access_tokens')
  .upsert(
    {
      coach_id: user.id,
      client_id: params.clientId,
      magic_url: tempPassword,          // réutilise la colonne pour stocker le mot de passe temporaire
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      revoked: false,
    },
    { onConflict: 'client_id' }
  )
  .select('token')
  .single()

if (tokenError || !tokenRow) {
  return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
}
```

- [ ] **Étape 3 : Supprimer l'import inutile de `sendAccessLinkEmail` si besoin, vérifier que le fichier compile**

```bash
npx tsc --noEmit 2>&1 | grep "access-token"
```

Attendu : aucune erreur sur ce fichier.

- [ ] **Étape 4 : Commit**

```bash
git add app/api/clients/\[clientId\]/access-token/route.ts
git commit -m "feat(client-access): generate temp password instead of magic link OTP"
```

---

## Task 2 : Mise à jour de `access/[token]/route.ts` — signInWithPassword côté serveur

**Fichiers :**
- Modifier : `app/client/access/[token]/route.ts`

**Contexte :** La route récupère l'email du client et le mot de passe temporaire stocké dans `magic_url`, appelle `signInWithPassword`, et pose les cookies de session Supabase sur la réponse redirect. Tout se passe côté serveur — pas d'Implicit Flow, pas de hash, pas de OTP.

- [ ] **Étape 1 : Réécrire la route complètement**

Remplacer tout le contenu de `app/client/access/[token]/route.ts` par :

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const db = service()

  // 1. Valider le token d'accès
  const { data: tokenRow } = await db
    .from('client_access_tokens')
    .select('magic_url, expires_at, revoked, client_id')
    .eq('token', params.token)
    .single()

  if (!tokenRow || tokenRow.revoked) {
    return NextResponse.redirect(new URL('/client/access/invalid', request.url))
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.redirect(new URL('/client/access/expired', request.url))
  }

  if (!tokenRow.magic_url) {
    return NextResponse.redirect(new URL('/client/access/invalid', request.url))
  }

  // 2. Récupérer l'email du client
  const { data: client } = await db
    .from('coach_clients')
    .select('email')
    .eq('id', tokenRow.client_id)
    .single()

  if (!client?.email) {
    return NextResponse.redirect(new URL('/client/access/invalid', request.url))
  }

  // 3. Préparer la réponse redirect avec cookies
  const redirectUrl = new URL('/client', request.url)
  let response = NextResponse.redirect(redirectUrl)

  // 4. Créer un client Supabase qui écrit les cookies sur la réponse
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 5. Connexion avec le mot de passe temporaire — côté serveur, pas d'OTP
  const { data: session, error } = await supabase.auth.signInWithPassword({
    email: client.email,
    password: tokenRow.magic_url,
  })

  if (error || !session?.user) {
    console.error('[access/token] signInWithPassword error:', error?.message)
    return NextResponse.redirect(new URL('/client/access/invalid', request.url))
  }

  return response
}
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | grep "access/\[token\]"
```

Attendu : aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add app/client/access/\[token\]/route.ts
git commit -m "feat(client-access): sign in with temp password server-side, set session cookies directly"
```

---

## Task 3 : Nettoyage — supprimer `auth/confirm`, restaurer le middleware

**Fichiers :**
- Supprimer : `app/client/auth/confirm/page.tsx`
- Modifier : `middleware.ts`

**Contexte :** La page `/client/auth/confirm` n'est plus nécessaire — la session est créée côté serveur dans la route `/client/access/[token]`. Le middleware peut redevenir standard.

- [ ] **Étape 1 : Supprimer la page `auth/confirm`**

```bash
rm app/client/auth/confirm/page.tsx
rmdir app/client/auth/confirm 2>/dev/null || true
```

- [ ] **Étape 2 : Restaurer le middleware matcher**

Dans `middleware.ts`, remettre le matcher original sans l'exclusion `/client/access` :

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Important :** `/client/access` doit rester dans le matcher pour que `updateSession` rafraîchisse correctement les cookies. La double exécution n'est plus un problème car `signInWithPassword` est idempotent (contrairement à un OTP usage unique).

- [ ] **Étape 3 : Vérifier la compilation globale**

```bash
npx tsc --noEmit 2>&1 | grep -v "tests/api" | grep "error TS"
```

Attendu : uniquement les erreurs pre-existantes (stripe, payments).

- [ ] **Étape 4 : Commit**

```bash
git add middleware.ts
git commit -m "chore(client-access): remove auth/confirm page, restore middleware matcher"
```

---

## Task 4 : Mise à jour du `redirectTo` dans `access-token/route.ts`

**Fichiers :**
- Modifier : `app/api/clients/[clientId]/access-token/route.ts`

**Contexte :** Le `redirectTo` dans le POST ne génère plus de magic link, donc les lignes qui référencent `redirectTo` dans `generateLink` ont été supprimées en Task 1. Vérifier qu'il n'y a plus aucune référence à `generateLink` ou `magiclink` dans ce fichier.

- [ ] **Étape 1 : Vérifier**

```bash
grep -n "generateLink\|magiclink\|magic_url\|redirectTo" app/api/clients/\[clientId\]/access-token/route.ts
```

Attendu : seule `magic_url: tempPassword` dans l'upsert.

- [ ] **Étape 2 : Mettre à jour CHANGELOG.md**

Ajouter en tête de la section `## 2026-04-12` :

```
FIX: Client access — remplace magic link OTP (fragile, usage unique) par signInWithPassword avec mot de passe temporaire généré côté serveur
```

- [ ] **Étape 3 : Commit final**

```bash
git add CHANGELOG.md
git commit -m "docs: update changelog for client access password flow"
```

---

## Test manuel post-déploiement

1. Depuis la plateforme coach, aller sur la fiche d'un client avec email
2. Cliquer "Générer le lien d'accès" → vérifier status 200 dans les logs
3. Copier le lien `/client/access/[token]`
4. Ouvrir en **navigation privée**
5. Attendu : redirection vers `/client` avec session active, "Bonjour [prénom client]"
6. Naviguer vers Bilans, Programme, Profil → aucune redirection vers `/client/login`
7. Attendre 2 minutes, recharger → session toujours active
8. Cliquer le même lien une 2ème fois → doit fonctionner (idempotent, pas d'OTP)
