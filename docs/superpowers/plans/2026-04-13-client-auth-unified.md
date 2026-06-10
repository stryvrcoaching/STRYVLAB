# Client Auth Unified Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken dual-system client auth with a single, reliable flow based on Supabase Auth native (createUser + generateLink recovery) + email Namecheap, covering first invitation, reactivation, suspension, and reconnection.

**Architecture:** On invitation, we create the Supabase account via `admin.createUser` (no email sent by Supabase), then generate a password-reset link via `admin.generateLink({ type: 'recovery' })` and send it ourselves via Namecheap SMTP. Suspension uses `admin.updateUserById({ banned: true })`. The internal magic-link system (access-token) is removed entirely.

**Tech Stack:** Next.js App Router, Supabase Auth Admin API, Nodemailer (Namecheap SMTP), TypeScript strict

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/api/clients/[clientId]/invite/route.ts` | Modify | Unified invite: createUser + generateLink recovery + detect existing |
| `app/api/clients/[clientId]/access/route.ts` | Modify | DELETE: ban Supabase user + set status=suspended |
| `app/api/clients/[clientId]/access-token/route.ts` | Delete | System B removed |
| `app/client/access/[token]/route.ts` | Delete | Magic link internal removed |
| `app/client/set-password/page.tsx` | Modify | Remove hash fragment fallback, keep only ?code= PKCE flow |
| `app/client/login/page.tsx` | Modify | Remove hash redirect hook, add clear error for banned users |
| `middleware.ts` | Modify | Replace status=inactive check with Supabase banned check |
| `components/clients/ClientAccessToken.tsx` | Modify | UI: "Inviter" vs "Restaurer l'accès" based on status |
| `lib/email/mailer.ts` | Modify | Add sendWelcomeEmail function |

---

## Task 1: Update `invite/route.ts` — unified invite logic

**Files:**
- Modify: `app/api/clients/[clientId]/invite/route.ts`

- [ ] **Step 1: Replace the entire route with the unified logic**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendInvitationEmail, sendReactivationEmail } from '@/lib/email/mailer'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  const { data: client } = await db
    .from('coach_clients')
    .select('id, email, first_name, last_name, status')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  if (!client.email) return NextResponse.json({ error: 'Ce client n\'a pas d\'email' }, { status: 422 })

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

  const coachFirstName = (user.user_metadata?.first_name as string | undefined) ?? null
  const coachLastName  = (user.user_metadata?.last_name  as string | undefined) ?? null
  const coachName = coachFirstName
    ? `${coachFirstName}${coachLastName ? ' ' + coachLastName : ''}`
    : null

  // Chercher si le compte Supabase existe déjà pour cet email
  const { data: existingUsers } = await db.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u: { email?: string }) => u.email === client.email)

  if (existingUser) {
    // Compte existant — réactivation : débannir + email "accès restauré"
    const { error: unbanError } = await db.auth.admin.updateUserById(existingUser.id, {
      ban_duration: 'none',
    })
    if (unbanError) {
      console.error('unban error:', unbanError)
      return NextResponse.json({ error: 'Impossible de réactiver le compte' }, { status: 500 })
    }

    await db
      .from('coach_clients')
      .update({ status: 'active' })
      .eq('id', params.clientId)

    try {
      await sendReactivationEmail({
        to: client.email,
        clientFirstName: client.first_name ?? 'vous',
        coachName,
        loginUrl: `${siteUrl}/client/login`,
      })
    } catch (emailError) {
      console.error('Reactivation email failed:', emailError)
      // Non-bloquant — le compte est réactivé même si l'email échoue
    }

    return NextResponse.json({ success: true, mode: 'reactivated' })
  }

  // Nouveau compte — créer sans email Supabase, puis générer lien recovery
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: client.email,
    email_confirm: true,   // pas besoin de confirmation email séparée
    password: crypto.randomUUID(), // mot de passe temporaire aléatoire, écrasé au set-password
  })

  if (createError || !created?.user) {
    console.error('createUser error:', createError)
    return NextResponse.json({ error: 'Impossible de créer le compte' }, { status: 500 })
  }

  // generateLink type 'recovery' : génère le lien reset-password SANS envoyer d'email Supabase
  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: 'recovery',
    email: client.email,
    options: { redirectTo: `${siteUrl}/client/set-password` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('generateLink recovery error:', linkError)
    return NextResponse.json({ error: 'Impossible de générer le lien d\'invitation' }, { status: 500 })
  }

  await db
    .from('coach_clients')
    .update({ status: 'active' })
    .eq('id', params.clientId)

  try {
    await sendInvitationEmail({
      to: client.email,
      clientFirstName: client.first_name ?? 'vous',
      coachName,
      setupPasswordUrl: linkData.properties.action_link,
    })
  } catch (emailError) {
    console.error('Invitation email failed:', emailError)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi de l\'email' }, { status: 500 })
  }

  return NextResponse.json({ success: true, mode: 'invited' })
}
```

- [ ] **Step 2: Vérifier que le fichier compile**

```bash
npx tsc --noEmit 2>&1 | grep "invite/route"
```
Expected: aucune ligne (0 erreurs sur ce fichier)

- [ ] **Step 3: Commit**

```bash
git add app/api/clients/[clientId]/invite/route.ts
git commit -m "feat(auth): unified invite — createUser + generateLink recovery, no Supabase email"
```

---

## Task 2: Ajouter `sendReactivationEmail` + `sendWelcomeEmail` dans `mailer.ts`

**Files:**
- Modify: `lib/email/mailer.ts`

- [ ] **Step 1: Ajouter les interfaces et fonctions à la fin de `mailer.ts`**

Après la dernière fonction (`sendInvitationEmail`), ajouter :

```typescript
// ─── 8. Réactivation client (accès restauré) ─────────────────────────────────

export interface SendReactivationEmailParams {
  to: string
  clientFirstName: string
  coachName: string | null
  loginUrl: string
}

export async function sendReactivationEmail(params: SendReactivationEmailParams) {
  const { to, clientFirstName, coachName, loginUrl } = params

  const intro = coachName
    ? `Votre coach <strong style="color:${DS.white};">${coachName}</strong> a restauré votre accès à STRYV. Vous pouvez vous reconnecter avec votre email et votre mot de passe habituel.`
    : `Votre accès à STRYV a été restauré. Vous pouvez vous reconnecter avec votre email et votre mot de passe habituel.`

  const subject = coachName
    ? `${coachName} a restauré votre accès STRYV`
    : 'Votre accès STRYV est restauré'

  await transporter.sendMail({
    from: FROM,
    to,
    subject,
    html: emailTemplate({
      senderLabel: coachName ?? undefined,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(intro)}
        ${ctaButton(loginUrl, 'Se connecter')}
        ${hint('Si vous avez oublié votre mot de passe, utilisez la page de connexion pour le réinitialiser.')}
      `,
    }),
  })
}

// ─── 9. Bienvenue après création du mot de passe ──────────────────────────────

export interface SendWelcomeEmailParams {
  to: string
  clientFirstName: string
  coachName: string | null
  loginUrl: string
}

export async function sendWelcomeEmail(params: SendWelcomeEmailParams) {
  const { to, clientFirstName, coachName, loginUrl } = params

  const intro = coachName
    ? `Votre mot de passe a bien été créé. Bienvenue sur STRYV — votre espace personnel configuré par <strong style="color:${DS.white};">${coachName}</strong> est maintenant accessible.`
    : `Votre mot de passe a bien été créé. Bienvenue sur STRYV — votre espace personnel est maintenant accessible.`

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Bienvenue sur STRYV — ton accès est actif',
    html: emailTemplate({
      senderLabel: coachName ?? undefined,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(intro)}
        ${ctaButton(loginUrl, 'Accéder à mon espace')}
        ${hint('Conserve ce lien pour te reconnecter à tout moment.')}
        ${separator()}
        ${directLink(loginUrl)}
      `,
    }),
  })
}
```

- [ ] **Step 2: Vérifier compilation**

```bash
npx tsc --noEmit 2>&1 | grep "mailer"
```
Expected: aucune ligne

- [ ] **Step 3: Commit**

```bash
git add lib/email/mailer.ts
git commit -m "feat(email): add sendReactivationEmail and sendWelcomeEmail"
```

---

## Task 3: Envoyer `sendWelcomeEmail` après création du mot de passe

**Files:**
- Modify: `app/client/set-password/page.tsx`

- [ ] **Step 1: Ajouter l'appel welcome email après `updateUser` réussi**

Dans la fonction `handleSubmit`, remplacer :

```typescript
    setDone(true)
    setTimeout(() => router.push('/client'), 2000)
```

Par :

```typescript
    // Envoyer l'email de bienvenue (non-bloquant)
    fetch('/api/client/welcome', { method: 'POST' }).catch(() => {})
    setDone(true)
    setTimeout(() => router.push('/client'), 2000)
```

- [ ] **Step 2: Créer la route `app/api/client/welcome/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '@/lib/email/mailer'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  // Récupérer les infos client + coach
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('first_name, email, coach_id')
    .eq('user_id', user.id)
    .single()

  if (!clientRow?.email) return NextResponse.json({ ok: true }) // silencieux

  // Récupérer le nom du coach
  const { data: coachRow } = await db
    .from('coaches')
    .select('first_name, last_name')
    .eq('user_id', clientRow.coach_id)
    .single()

  const coachName = coachRow?.first_name
    ? `${coachRow.first_name}${coachRow.last_name ? ' ' + coachRow.last_name : ''}`
    : null

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

  try {
    await sendWelcomeEmail({
      to: clientRow.email,
      clientFirstName: clientRow.first_name ?? 'vous',
      coachName,
      loginUrl: `${siteUrl}/client/login`,
    })
  } catch (e) {
    console.error('Welcome email failed (non-blocking):', e)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Vérifier compilation**

```bash
npx tsc --noEmit 2>&1 | grep -E "set-password|api/client/welcome"
```
Expected: aucune ligne

- [ ] **Step 4: Commit**

```bash
git add app/client/set-password/page.tsx app/api/client/welcome/route.ts
git commit -m "feat(auth): send welcome email after client sets password"
```

---

## Task 4: Mettre à jour `access/route.ts` — suspension via ban Supabase

**Files:**
- Modify: `app/api/clients/[clientId]/access/route.ts`

- [ ] **Step 1: Lire le fichier actuel**

```bash
cat app/api/clients/\[clientId\]/access/route.ts
```

- [ ] **Step 2: Remplacer le handler DELETE**

Le handler DELETE doit bannir le compte Supabase en plus de mettre à jour le statut DB. Remplacer le contenu par :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string } }

export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  // Vérifier ownership
  const { data: client } = await db
    .from('coach_clients')
    .select('id, email')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  // Bannir le compte Supabase si il existe
  if (client.email) {
    const { data: users } = await db.auth.admin.listUsers()
    const supabaseUser = users?.users?.find((u: { email?: string }) => u.email === client.email)
    if (supabaseUser) {
      await db.auth.admin.updateUserById(supabaseUser.id, {
        ban_duration: '87600h', // 10 ans = suspension permanente
      })
    }
  }

  // Mettre à jour le statut en DB
  const { error } = await db
    .from('coach_clients')
    .update({ status: 'suspended' })
    .eq('id', params.clientId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Vérifier compilation**

```bash
npx tsc --noEmit 2>&1 | grep "access/route"
```
Expected: aucune ligne

- [ ] **Step 4: Commit**

```bash
git add "app/api/clients/[clientId]/access/route.ts"
git commit -m "feat(auth): suspend client via Supabase ban_duration on access revoke"
```

---

## Task 5: Mettre à jour le middleware — vérifier le statut `suspended`

**Files:**
- Modify: `middleware.ts` (via `utils/supabase/middleware.ts`)

- [ ] **Step 1: Remplacer la vérification `status=inactive` par `status=suspended`**

Dans `utils/supabase/middleware.ts`, remplacer :

```typescript
    if (clientRecord?.status === 'inactive') {
```

Par :

```typescript
    if (clientRecord?.status === 'suspended') {
```

- [ ] **Step 2: Vérifier compilation**

```bash
npx tsc --noEmit 2>&1 | grep "middleware"
```
Expected: aucune ligne

- [ ] **Step 3: Commit**

```bash
git add utils/supabase/middleware.ts
git commit -m "fix(middleware): redirect suspended clients (status=suspended) to acces-suspendu"
```

---

## Task 6: Mettre à jour `ClientAccessToken.tsx` — UI selon statut

**Files:**
- Modify: `components/clients/ClientAccessToken.tsx`

- [ ] **Step 1: Mettre à jour la logique d'affichage**

Remplacer le contenu de `ClientAccessToken.tsx` par :

```typescript
"use client";

import { useState } from "react";
import {
  UserCheck,
  UserX,
  Mail,
  Loader2,
  CheckCircle2,
  ShieldOff,
  RefreshCw,
} from "lucide-react";

interface Props {
  clientId: string;
  clientStatus: string;
  clientEmail: string | null;
}

export default function ClientAccessToken({ clientId, clientStatus, clientEmail }: Props) {
  const [status, setStatus] = useState(clientStatus);
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendInvitation() {
    setInviting(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/invite`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "Erreur lors de l'envoi.");
    } else {
      setInvited(true);
      setStatus("active");
      setTimeout(() => setInvited(false), 4000);
    }
    setInviting(false);
  }

  async function revokeAccess() {
    setRevoking(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/access`, { method: "DELETE" });
    if (res.ok) {
      setStatus("suspended");
    } else {
      const d = await res.json();
      setError(d.error ?? "Erreur lors de la révocation.");
    }
    setRevoking(false);
    setShowRevokeConfirm(false);
  }

  const isActive = status === "active";
  const isSuspended = status === "suspended";
  // inactive = jamais invité, suspended = accès révoqué
  const needsInvite = !isActive;

  return (
    <>
      <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck size={15} className="text-[#1f8a65]" />
          <h3 className="font-semibold text-white text-sm">Accès client</h3>
          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isActive
              ? "bg-[#1f8a65]/15 text-[#1f8a65]"
              : isSuspended
              ? "bg-amber-500/15 text-amber-400"
              : "bg-white/[0.06] text-white/40"
          }`}>
            {isActive ? "Actif" : isSuspended ? "Suspendu" : "Inactif"}
          </span>
        </div>

        {!clientEmail ? (
          <p className="text-xs text-white/40">
            Ce client n&apos;a pas d&apos;adresse email. Ajoutez-en une pour l&apos;inviter.
          </p>
        ) : isActive ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-white/45">
              Le client a accès à son espace STRYV. Il peut se connecter avec son email et son mot de passe.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => void sendInvitation()}
                disabled={inviting}
                className="flex items-center gap-1.5 text-xs font-semibold text-white/55 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {inviting ? <Loader2 size={12} className="animate-spin" /> : invited ? <CheckCircle2 size={12} /> : <Mail size={12} />}
                {inviting ? "Envoi…" : invited ? "Invitation envoyée !" : "Renvoyer l'invitation"}
              </button>
              <button
                onClick={() => setShowRevokeConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2 rounded-lg transition-colors ml-auto"
              >
                <ShieldOff size={12} />
                Couper l&apos;accès
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-white/45">
              {isSuspended
                ? "L'accès de ce client a été suspendu. Vous pouvez le réactiver à tout moment."
                : "Ce client n'a pas encore accès à son espace. Envoyez-lui une invitation pour qu'il crée son mot de passe."}
            </p>
            <button
              onClick={() => void sendInvitation()}
              disabled={inviting}
              className="flex items-center gap-1.5 bg-[#1f8a65] hover:bg-[#217356] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors w-fit disabled:opacity-50"
            >
              {inviting
                ? <Loader2 size={12} className="animate-spin" />
                : invited
                ? <CheckCircle2 size={12} />
                : isSuspended
                ? <RefreshCw size={12} />
                : <Mail size={12} />}
              {inviting
                ? "Envoi…"
                : invited
                ? (isSuspended ? "Accès restauré !" : "Invitation envoyée !")
                : isSuspended
                ? "Restaurer l'accès"
                : "Inviter le client"}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-400">{error}</p>
        )}
      </div>

      {showRevokeConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <UserX size={18} className="text-red-400" />
              <h3 className="font-bold text-white">Couper l&apos;accès client ?</h3>
            </div>
            <p className="text-sm text-white/50 mb-5">
              Le client sera déconnecté et ne pourra plus accéder à son espace. Vous pourrez le réactiver à tout moment.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRevokeConfirm(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/[0.04] text-sm text-white/50 hover:text-white transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => void revokeAccess()}
                disabled={revoking}
                className="flex-1 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {revoking ? "Suspension…" : "Couper l'accès"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Vérifier compilation**

```bash
npx tsc --noEmit 2>&1 | grep "ClientAccessToken"
```
Expected: aucune ligne

- [ ] **Step 3: Commit**

```bash
git add components/clients/ClientAccessToken.tsx
git commit -m "feat(ui): ClientAccessToken shows suspended state + Restaurer l'accès button"
```

---

## Task 7: Nettoyer `set-password/page.tsx` et `client/login/page.tsx`

**Files:**
- Modify: `app/client/set-password/page.tsx`
- Modify: `app/client/login/page.tsx`

- [ ] **Step 1: Remplacer le useEffect dans `set-password/page.tsx`**

Remplacer le useEffect complet (qui gère hash + code) par la version simple PKCE uniquement :

```typescript
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setExchangeError(true)
      setExchanging(false)
      return
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.error('exchangeCodeForSession error:', error.message)
        setExchangeError(true)
      }
      setExchanging(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Nettoyer `client/login/page.tsx` — supprimer le hook hash**

Dans `app/client/login/page.tsx`, supprimer :
- L'import de `useEffect` si plus utilisé ailleurs
- Le state `hashError`
- Le `useEffect` entier qui lit `window.location.hash`
- Le bloc JSX `{hashError && (...)}` 

La page doit redevenir un simple formulaire email/mot de passe sans logique de hash.

- [ ] **Step 3: Vérifier compilation**

```bash
npx tsc --noEmit 2>&1 | grep -E "set-password|client/login"
```
Expected: aucune ligne

- [ ] **Step 4: Commit**

```bash
git add app/client/set-password/page.tsx app/client/login/page.tsx
git commit -m "chore(auth): remove hash fragment fallback — PKCE flow only"
```

---

## Task 8: Supprimer System B (access-token + magic link interne)

**Files:**
- Delete: `app/api/clients/[clientId]/access-token/route.ts`
- Delete: `app/client/access/[token]/route.ts`

- [ ] **Step 1: Vérifier qu'aucun fichier n'importe ces routes**

```bash
grep -r "access-token\|client/access/" app components lib --include="*.ts" --include="*.tsx" | grep -v ".git"
```

Si des imports existent, les corriger avant de supprimer.

- [ ] **Step 2: Supprimer les fichiers**

```bash
rm "app/api/clients/[clientId]/access-token/route.ts"
rm "app/client/access/[token]/route.ts"
```

- [ ] **Step 3: Vérifier compilation globale**

```bash
npx tsc --noEmit 2>&1 | grep -v "stripe\|i18n\|BodyFat\|bilans/page\|programme/page\|progress/page\|session/"
```
Expected: aucune nouvelle erreur introduite par ces suppressions

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(auth): remove System B — access-token route and magic link internal"
```

---

## Task 9: Mise à jour CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Ajouter dans `CHANGELOG.md` sous `## 2026-04-13`**

```
FEATURE: Unified client auth — createUser + generateLink recovery, no dual system
FEATURE: Client suspension via Supabase ban_duration on access revoke
FEATURE: sendReactivationEmail — coach restores access, client gets login link
FEATURE: sendWelcomeEmail — sent after client sets password for the first time
FIX: Remove generateLink type 'invite' — was triggering Supabase built-in email in parallel
CHORE: Remove System B (access-token magic link internal routes)
```

- [ ] **Step 2: Ajouter section dans `project-state.md`**

```markdown
## 2026-04-13 — Système d'accès client unifié

**Ce qui a été fait :**

1. **`app/api/clients/[clientId]/invite/route.ts`** — logique unifiée
   - Nouveau compte : `admin.createUser` + `admin.generateLink({ type: 'recovery' })` → email Namecheap
   - Compte existant : `admin.updateUserById({ ban_duration: 'none' })` + email "accès restauré"
   - Plus aucun appel à `generateLink({ type: 'invite' })` — évite l'email Supabase built-in parallèle

2. **`app/api/clients/[clientId]/access/route.ts`** — suspension via ban Supabase
   - `admin.updateUserById({ ban_duration: '87600h' })` + `status = 'suspended'`

3. **`app/api/client/welcome/route.ts`** — nouveau endpoint
   - Appelé depuis `/client/set-password` après création du mot de passe
   - Envoie `sendWelcomeEmail` avec lien `/client/login`

4. **`lib/email/mailer.ts`** — 2 nouvelles fonctions
   - `sendReactivationEmail` — email coach restaure accès
   - `sendWelcomeEmail` — email bienvenue après set-password

5. **System B supprimé** — `access-token/route.ts` + `client/access/[token]/route.ts`

**Points de vigilance :**
- `generateLink({ type: 'recovery' })` ne déclenche pas d'email Supabase — c'est intentionnel
- La suspension utilise `ban_duration: '87600h'` (10 ans) car Supabase n'a pas de "permanent ban"
- La réactivation utilise `ban_duration: 'none'` pour débannir
- `listUsers()` est appelé à chaque invitation pour détecter si le compte existe — acceptable pour le volume actuel (< 1000 users)
- L'email de bienvenue est non-bloquant dans `/client/set-password` (fire and forget)
- La table `client_access_tokens` est conservée en DB mais n'est plus alimentée
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for unified client auth"
```

---

## Vérification finale

- [ ] Tester flow complet : nouveau client → invitation → set-password → /client → email bienvenue
- [ ] Tester réactivation : couper accès → restaurer → email reçu → connexion avec ancien mot de passe
- [ ] Tester suspension : client connecté → coach coupe accès → client redirigé vers /client/acces-suspendu
- [ ] Vérifier qu'aucun email Supabase built-in n'est envoyé en parallèle
