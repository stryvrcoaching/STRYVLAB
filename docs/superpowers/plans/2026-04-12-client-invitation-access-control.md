# Client Invitation & Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le flux "token magique" fragile par une invitation email classique (le client choisit son mot de passe), et ajouter une coupure d'accès manuelle (coach) + automatique (abonnement expiré).

**Architecture:** Le coach clique "Inviter le client" → on envoie un email SMTP custom avec un lien `signInWithPassword` temporaire qui redirige vers une page "choisis ton mot de passe" → le client définit un vrai mot de passe et a un compte durable. La coupure d'accès passe par `coach_clients.status = 'inactive'` vérifié dans le middleware, + un cron nightly qui expire les abonnements échus. Le token d'accès existant (`client_access_tokens`) est conservé pour tracer la relation mais n'est plus l'unique vecteur de connexion.

**Tech Stack:** Next.js App Router, Supabase Admin API (`auth.admin.generateLink` type `recovery`), nodemailer SMTP (Namecheap), Vercel Cron Jobs, `@supabase/ssr`

---

## Fichiers touchés

| Fichier | Action | Rôle |
|---------|--------|------|
| `app/api/clients/[clientId]/invite/route.ts` | Créer | POST — génère un lien de définition de mot de passe + envoie l'email d'invitation |
| `app/api/clients/[clientId]/access/route.ts` | Créer | DELETE — révoque l'accès manuellement (status → inactive + token révoqué) |
| `app/api/cron/expire-subscriptions/route.ts` | Créer | Cron nightly — expire abonnements échus + révoque accès clients |
| `lib/email/mailer.ts` | Modifier | Ajouter `sendInvitationEmail` |
| `components/clients/ClientAccessToken.tsx` | Modifier | Refonte UX — état "Pas invité / Actif / Suspendu" + bouton invitation |
| `app/client/acces-suspendu/page.tsx` | Créer | Page affichée quand `status = 'inactive'` |
| `app/client/login/page.tsx` | Modifier | Retirer le tab "Créer un compte" — le client est toujours invité par le coach |
| `app/client/login/actions.ts` | Modifier | Retirer `clientSignup` — inutile désormais |
| `utils/supabase/middleware.ts` | Modifier | Vérifier `coach_clients.status` et rediriger vers `/client/acces-suspendu` si `inactive` |
| `vercel.json` | Créer/Modifier | Déclarer le cron `expire-subscriptions` |
| `CHANGELOG.md` | Modifier | Documenter |

---

## Task 1 : Email d'invitation — `sendInvitationEmail` dans `lib/email/mailer.ts`

**Fichiers :**
- Modifier : `lib/email/mailer.ts`

**Contexte :** On utilise `auth.admin.generateLink({ type: 'recovery', email })` de Supabase — qui génère un lien "reset password" valide 1h. On envoie ce lien via notre SMTP Namecheap avec notre template DS v2.0. Le client clique → atterrit sur `/client/reset-password?token=...` (page Supabase native ou page custom — voir Task 3), choisit son mot de passe, et a un vrai compte. Le lien `recovery` est différent d'un magic link OTP : il ne crée pas de session, il donne juste le droit de définir un mot de passe.

- [ ] **Étape 1 : Ajouter le type `SendInvitationEmailParams`**

Dans `lib/email/mailer.ts`, après le bloc `SendInvoiceEmailParams` (ligne ~182), ajouter :

```typescript
export interface SendInvitationEmailParams {
  to: string
  clientFirstName: string
  coachName: string | null
  setupPasswordUrl: string  // lien recovery Supabase
}
```

- [ ] **Étape 2 : Ajouter la fonction `sendInvitationEmail`**

À la fin de `lib/email/mailer.ts`, ajouter :

```typescript
// ─── 7. Invitation client (premier accès — définir son mot de passe) ──────────

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  const { to, clientFirstName, coachName, setupPasswordUrl } = params

  const intro = coachName
    ? `Votre coach <strong style="color:${DS.white};">${coachName}</strong> vous a créé un espace personnel sur STRYV. Définissez votre mot de passe pour accéder à vos bilans et votre programme.`
    : `Votre coach vous a créé un espace personnel sur STRYV. Définissez votre mot de passe pour y accéder.`

  const subject = coachName
    ? `${coachName} vous invite sur STRYV — Créez votre accès`
    : 'Créez votre accès STRYV'

  await transporter.sendMail({
    from: FROM,
    to,
    subject,
    html: emailTemplate({
      senderLabel: coachName ?? undefined,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(intro)}
        ${ctaButton(setupPasswordUrl, 'Créer mon mot de passe')}
        ${hint('Ce lien est valable 1 heure. Si vous n\'avez pas demandé cet accès, ignorez ce message.')}
        ${separator()}
        ${directLink(setupPasswordUrl)}
      `,
    }),
  })
}
```

- [ ] **Étape 3 : Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | grep "mailer"
```

Attendu : aucune erreur sur ce fichier.

- [ ] **Étape 4 : Commit**

```bash
git add lib/email/mailer.ts
git commit -m "feat(email): add sendInvitationEmail for client onboarding"
```

---

## Task 2 : Route API d'invitation — `POST /api/clients/[clientId]/invite`

**Fichiers :**
- Créer : `app/api/clients/[clientId]/invite/route.ts`

**Contexte :** Cette route :
1. Vérifie que le coach est authentifié et que le client lui appartient
2. Appelle `db.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: ... } })` — qui crée le compte Supabase si inexistant ET génère un lien de reset password
3. Envoie l'email d'invitation via `sendInvitationEmail`
4. Met à jour `coach_clients.status = 'active'` pour marquer que l'invitation a été envoyée

Le `redirectTo` pointe vers `/client/set-password` — une page qu'on créera en Task 3 pour finaliser la session après le reset.

- [ ] **Étape 1 : Créer le fichier**

Créer `app/api/clients/[clientId]/invite/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendInvitationEmail } from '@/lib/email/mailer'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string } }

// POST /api/clients/[clientId]/invite — envoie l'invitation email au client
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  // Vérifier ownership
  const { data: client } = await db
    .from('coach_clients')
    .select('id, email, first_name, last_name')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  if (!client.email) return NextResponse.json({ error: 'Ce client n\'a pas d\'email' }, { status: 422 })

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

  // Générer un lien de définition de mot de passe via admin API
  // type 'recovery' = crée le compte si inexistant + génère un lien reset password valable 1h
  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: 'recovery',
    email: client.email,
    options: {
      redirectTo: `${siteUrl}/client/set-password`,
    },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('generateLink recovery error:', linkError)
    return NextResponse.json({ error: 'Impossible de générer le lien d\'invitation' }, { status: 500 })
  }

  // Envoyer l'email d'invitation via SMTP Namecheap
  const coachFirstName = (user.user_metadata?.first_name as string | undefined) ?? null
  const coachLastName  = (user.user_metadata?.last_name  as string | undefined) ?? null
  const coachName = coachFirstName
    ? `${coachFirstName}${coachLastName ? ' ' + coachLastName : ''}`
    : null

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

  // Marquer le client comme actif (invitation envoyée)
  await db
    .from('coach_clients')
    .update({ status: 'active' })
    .eq('id', params.clientId)

  return NextResponse.json({ success: true })
}
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | grep "invite"
```

Attendu : aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add app/api/clients/\[clientId\]/invite/route.ts
git commit -m "feat(api): add POST /api/clients/[clientId]/invite — send password setup email"
```

---

## Task 3 : Page client `/client/set-password`

**Fichiers :**
- Créer : `app/client/set-password/page.tsx`

**Contexte :** Après avoir cliqué le lien dans l'email d'invitation, Supabase redirige le client vers `/client/set-password?code=...` (PKCE flow). Cette page :
1. Échange le code contre une session (`exchangeCodeForSession`)
2. Affiche un formulaire "Choisissez votre mot de passe"
3. Appelle `supabase.auth.updateUser({ password })` avec le mot de passe choisi
4. Redirige vers `/client`

Cette page utilise le DS v2.0 client (fond blanc/light — cf. les autres pages client comme `/client/login`).

- [ ] **Étape 1 : Créer la page**

Créer `app/client/set-password/page.tsx` :

```tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

function SetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [exchanging, setExchanging] = useState(true)
  const [exchangeError, setExchangeError] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('Impossible de définir le mot de passe. Le lien a peut-être expiré.')
      setLoading(false)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/client'), 2000)
  }

  if (exchanging) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }

  if (exchangeError) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="bg-surface rounded-card shadow-soft-out p-8 max-w-sm w-full text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-primary mb-2">Lien invalide ou expiré</h2>
          <p className="text-sm text-secondary mb-6">
            Ce lien n'est plus valable. Demande à ton coach de t'envoyer une nouvelle invitation.
          </p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="bg-surface rounded-card shadow-soft-out p-8 max-w-sm w-full text-center">
          <CheckCircle2 size={48} className="text-accent mx-auto mb-4" />
          <h2 className="text-lg font-bold text-primary mb-2">Mot de passe créé !</h2>
          <p className="text-sm text-secondary">Redirection vers ton espace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image src="/images/logo.png" alt="STRYV" width={48} height={48} className="w-12 h-12 object-contain" />
        <span className="font-unbounded font-semibold text-base text-primary tracking-tight leading-none">
          STRYV<span className="font-light text-secondary"> lab</span>
        </span>
      </div>

      <div className="bg-surface rounded-card shadow-soft-out p-6 w-full max-w-sm">
        <h2 className="text-base font-bold text-primary mb-1">Crée ton mot de passe</h2>
        <p className="text-xs text-secondary mb-5">Tu utiliseras ce mot de passe pour te connecter à ton espace.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Au moins 8 caractères"
                required
                minLength={8}
                className="w-full px-3 py-2.5 pr-10 bg-surface-light shadow-soft-in rounded-btn text-sm text-primary placeholder-secondary/50 outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-1">
              Confirmer
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Répète ton mot de passe"
              required
              className="w-full px-3 py-2.5 bg-surface-light shadow-soft-in rounded-btn text-sm text-primary placeholder-secondary/50 outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-btn px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 bg-accent text-white font-bold py-3 rounded-btn hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg text-sm"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Créer mon mot de passe
          </button>
        </form>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    }>
      <SetPasswordForm />
    </Suspense>
  )
}
```

- [ ] **Étape 2 : Vérifier que `@/utils/supabase/client` existe**

```bash
ls /Users/user/Desktop/VIRTUS/utils/supabase/
```

Attendu : fichiers `client.ts`, `server.ts`, `middleware.ts`. Si `client.ts` n'existe pas, le créer :

```typescript
// utils/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Étape 3 : Ajouter `/client/set-password` aux routes publiques du middleware**

Dans `utils/supabase/middleware.ts`, modifier la condition `isClientProtected` pour exclure `/client/set-password` :

```typescript
const isClientProtected =
  pathname.startsWith('/client') &&
  !pathname.startsWith('/client/login') &&
  !pathname.startsWith('/client/auth') &&
  !pathname.startsWith('/client/access') &&
  !pathname.startsWith('/client/set-password') &&   // ← ajouter cette ligne
  !pathname.startsWith('/client/acces-suspendu')     // ← et celle-ci (pour Task 5)
```

- [ ] **Étape 4 : Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | grep "set-password"
```

Attendu : aucune erreur.

- [ ] **Étape 5 : Commit**

```bash
git add app/client/set-password/page.tsx utils/supabase/middleware.ts
git commit -m "feat(client): add /client/set-password page for first-time password setup"
```

---

## Task 4 : Refonte du composant `ClientAccessToken.tsx`

**Fichiers :**
- Modifier : `components/clients/ClientAccessToken.tsx`

**Contexte :** Le composant actuel expose un lien URL brut, des boutons "Copier/Renouveler/Révoquer" — tout ça était pensé pour le flux magic link. Maintenant on a deux actions distinctes :

1. **"Inviter le client"** (si jamais invité, ou status `inactive`) → appelle `POST /api/clients/[clientId]/invite`
2. **"Couper l'accès"** (si status `active`) → appelle `DELETE /api/clients/[clientId]/access`

Le composant doit aussi afficher l'état actuel : pas encore invité / actif / suspendu.

On récupère le `status` du client via `GET /api/clients/[clientId]` (route existante sur la page coach) — mais plus simple : on ajoute `status` au GET de l'access-token actuel. Ou encore plus simple : on passe `clientStatus` en prop depuis la page parent qui a déjà le client.

**Choix architectural :** Passer `clientStatus: string` en prop depuis `app/coach/clients/[clientId]/page.tsx` — la page a déjà le client complet, pas besoin d'un fetch supplémentaire.

- [ ] **Étape 1 : Réécrire `ClientAccessToken.tsx` complètement**

Remplacer tout le contenu de `components/clients/ClientAccessToken.tsx` par :

```tsx
"use client";

import { useState } from "react";
import {
  UserCheck,
  UserX,
  Mail,
  Loader2,
  CheckCircle2,
  ShieldOff,
} from "lucide-react";

interface Props {
  clientId: string;
  clientStatus: string;      // 'active' | 'inactive' | 'archived' | autre
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
      setStatus("inactive");
    } else {
      const d = await res.json();
      setError(d.error ?? "Erreur lors de la révocation.");
    }
    setRevoking(false);
    setShowRevokeConfirm(false);
  }

  const isActive = status === "active";
  const isInactive = status === "inactive" || status === "archived";

  return (
    <>
      <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-xl p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <UserCheck size={15} className="text-[#1f8a65]" />
          <h3 className="font-semibold text-white text-sm">Accès client</h3>
          {/* Statut badge */}
          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isActive
              ? "bg-[#1f8a65]/15 text-[#1f8a65]"
              : "bg-white/[0.06] text-white/40"
          }`}>
            {isActive ? "Actif" : "Inactif"}
          </span>
        </div>

        {!clientEmail ? (
          <p className="text-xs text-white/40">
            Ce client n'a pas d'adresse email. Ajoutez-en une pour l'inviter.
          </p>
        ) : isActive ? (
          /* État actif — option de coupure */
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
                Couper l'accès
              </button>
            </div>
          </div>
        ) : (
          /* État inactif — invitation */
          <div className="flex flex-col gap-3">
            <p className="text-xs text-white/45">
              {status === "archived"
                ? "Ce client est archivé. Restaurez-le avant de l'inviter."
                : "Ce client n'a pas encore accès à son espace. Envoyez-lui une invitation pour qu'il crée son mot de passe."}
            </p>
            {status !== "archived" && (
              <button
                onClick={() => void sendInvitation()}
                disabled={inviting}
                className="flex items-center gap-1.5 bg-[#1f8a65] hover:bg-[#217356] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors w-fit disabled:opacity-50"
              >
                {inviting ? <Loader2 size={12} className="animate-spin" /> : invited ? <CheckCircle2 size={12} /> : <Mail size={12} />}
                {inviting ? "Envoi…" : invited ? "Invitation envoyée !" : "Inviter le client"}
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Modal confirmation révocation */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <UserX size={18} className="text-red-400" />
              <h3 className="font-bold text-white">Couper l'accès client ?</h3>
            </div>
            <p className="text-sm text-white/50 mb-5">
              Le client sera déconnecté et ne pourra plus accéder à son espace. Vous pourrez le réinviter à tout moment.
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
                {revoking ? "Révocation…" : "Couper l'accès"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Étape 2 : Mettre à jour l'appel dans `app/coach/clients/[clientId]/page.tsx`**

La page passe déjà `clientId` — il faut maintenant passer `clientStatus` et `clientEmail`. Chercher la ligne qui rend `<ClientAccessToken` :

```bash
grep -n "ClientAccessToken" app/coach/clients/\[clientId\]/page.tsx
```

Puis modifier le rendu pour passer les nouvelles props. Le client complet est déjà dans le state de la page — ajouter `clientStatus={client.status}` et `clientEmail={client.email}`. La signature exacte dépend de la ligne trouvée, mais le pattern est :

```tsx
<ClientAccessToken
  clientId={clientId}
  clientStatus={client.status ?? 'inactive'}
  clientEmail={client.email ?? null}
/>
```

- [ ] **Étape 3 : Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | grep -E "ClientAccessToken|invite"
```

Attendu : aucune erreur.

- [ ] **Étape 4 : Commit**

```bash
git add components/clients/ClientAccessToken.tsx
git commit -m "feat(ui): refonte ClientAccessToken — invitation email + coupure d'accès"
```

---

## Task 5 : Route API de révocation — `DELETE /api/clients/[clientId]/access`

**Fichiers :**
- Créer : `app/api/clients/[clientId]/access/route.ts`

**Contexte :** La révocation manuelle passe le client à `status = 'inactive'` ET révoque le token d'accès (pour couper aussi les connexions via lien direct). Supabase ne permet pas de "forcer la déconnexion" d'un user côté serveur dans le plan gratuit — la session expire naturellement au prochain middleware check. C'est acceptable.

- [ ] **Étape 1 : Créer le fichier**

Créer `app/api/clients/[clientId]/access/route.ts` :

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

// DELETE /api/clients/[clientId]/access — révoque l'accès client (status inactive + token révoqué)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  // Vérifier ownership
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  // Passer status à 'inactive'
  const { error: statusError } = await db
    .from('coach_clients')
    .update({ status: 'inactive' })
    .eq('id', params.clientId)

  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 })

  // Révoquer le token d'accès (si existant)
  await db
    .from('client_access_tokens')
    .update({ revoked: true })
    .eq('client_id', params.clientId)
    .eq('coach_id', user.id)

  return NextResponse.json({ success: true })
}
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | grep "access/route"
```

Attendu : aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add app/api/clients/\[clientId\]/access/route.ts
git commit -m "feat(api): add DELETE /api/clients/[clientId]/access — manual access revocation"
```

---

## Task 6 : Page "accès suspendu" + protection middleware

**Fichiers :**
- Créer : `app/client/acces-suspendu/page.tsx`
- Modifier : `utils/supabase/middleware.ts`

**Contexte :** Quand un client authentifié tente d'accéder à `/client/*` mais que son `coach_clients.status = 'inactive'`, on le redirige vers `/client/acces-suspendu`. Cette vérification se fait dans le middleware — il faut faire un appel DB rapide avec le service role.

**Attention :** Le middleware Supabase tourne sur l'Edge Runtime — pas de `prisma`, pas de `node:crypto`. On utilise le client Supabase standard avec une requête directe.

- [ ] **Étape 1 : Créer la page "accès suspendu"**

Créer `app/client/acces-suspendu/page.tsx` :

```tsx
import Image from 'next/image'
import { ShieldOff } from 'lucide-react'

export default function AccesSuspenduPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image src="/images/logo.png" alt="STRYV" width={48} height={48} className="w-12 h-12 object-contain" />
        <span className="font-unbounded font-semibold text-base text-primary tracking-tight leading-none">
          STRYV<span className="font-light text-secondary"> lab</span>
        </span>
      </div>

      <div className="bg-surface rounded-card shadow-soft-out p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldOff size={24} className="text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-primary mb-2">Accès suspendu</h2>
        <p className="text-sm text-secondary leading-relaxed">
          Ton accès à l'espace STRYV a été suspendu. Contacte ton coach pour le renouveler.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Étape 2 : Modifier le middleware pour vérifier le statut client**

Dans `utils/supabase/middleware.ts`, après le bloc `if (isClientProtected && !user)`, ajouter la vérification du statut client. Remplacer le bloc complet de la fonction `updateSession` par :

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/auth')
  const isHomePage = pathname === '/'

  const isCoachProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/coach') ||
    pathname.startsWith('/app')

  const isClientProtected =
    pathname.startsWith('/client') &&
    !pathname.startsWith('/client/login') &&
    !pathname.startsWith('/client/auth') &&
    !pathname.startsWith('/client/access') &&
    !pathname.startsWith('/client/set-password') &&
    !pathname.startsWith('/client/acces-suspendu')

  const isClientLogin = pathname.startsWith('/client/login')

  const isPublicApi =
    pathname.startsWith('/api/assessments/public') ||
    pathname.startsWith('/bilan/')

  // Redirection si non authentifié sur route client protégée
  if (isClientProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/client/login'
    return NextResponse.redirect(url)
  }

  // Vérification du statut client (accès suspendu)
  if (isClientProtected && user && !pathname.startsWith('/client/acces-suspendu')) {
    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return [] },
          setAll() {},
        },
      }
    )
    const { data: clientRecord } = await serviceSupabase
      .from('coach_clients')
      .select('status')
      .eq('user_id', user.id)
      .single()

    if (clientRecord?.status === 'inactive') {
      const url = request.nextUrl.clone()
      url.pathname = '/client/acces-suspendu'
      return NextResponse.redirect(url)
    }
  }

  if (isClientLogin && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/client'
    return NextResponse.redirect(url)
  }

  if (isCoachProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if ((isAuthRoute || isHomePage) && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

**Note importante :** On crée un second client Supabase avec le service role key pour contourner les RLS — nécessaire car `coach_clients` n'a pas de policy permettant la lecture par le user lui-même. On utilise `cookies: { getAll: () => [], setAll: () => {} }` car ce client ne gère pas de session.

- [ ] **Étape 3 : Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | grep "middleware"
```

Attendu : aucune erreur.

- [ ] **Étape 4 : Commit**

```bash
git add app/client/acces-suspendu/page.tsx utils/supabase/middleware.ts
git commit -m "feat(client): add access-suspended page + middleware status check"
```

---

## Task 7 : Cron nightly — expiration automatique des abonnements

**Fichiers :**
- Créer : `app/api/cron/expire-subscriptions/route.ts`
- Créer/Modifier : `vercel.json`

**Contexte :** Chaque nuit à minuit UTC, le cron vérifie les abonnements `status = 'active'` dont `end_date` est passée. Pour chacun, il passe l'abonnement à `status = 'expired'` et le client à `status = 'inactive'`. Le cron est sécurisé par le header `CRON_SECRET` standard Vercel.

- [ ] **Étape 1 : Créer la route cron**

Créer `app/api/cron/expire-subscriptions/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  // Sécurité : vérifier le secret Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = service()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Trouver tous les abonnements actifs dont end_date est dépassée
  const { data: expiredSubs, error: fetchError } = await db
    .from('client_subscriptions')
    .select('id, client_id')
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .lt('end_date', today)

  if (fetchError) {
    console.error('[cron/expire-subscriptions] fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!expiredSubs || expiredSubs.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  const subIds = expiredSubs.map(s => s.id)
  const clientIds = [...new Set(expiredSubs.map(s => s.client_id))]

  // Passer les abonnements à 'expired'
  const { error: subError } = await db
    .from('client_subscriptions')
    .update({ status: 'expired' })
    .in('id', subIds)

  if (subError) {
    console.error('[cron/expire-subscriptions] sub update error:', subError)
    return NextResponse.json({ error: subError.message }, { status: 500 })
  }

  // Passer les clients correspondants à 'inactive'
  // Seulement si le client n'a PLUS aucun abonnement actif restant
  const inactiveClientIds: string[] = []

  for (const clientId of clientIds) {
    const { count } = await db
      .from('client_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'active')

    if (count === 0) {
      inactiveClientIds.push(clientId)
    }
  }

  if (inactiveClientIds.length > 0) {
    await db
      .from('coach_clients')
      .update({ status: 'inactive' })
      .in('id', inactiveClientIds)

    // Révoquer les tokens d'accès des clients désactivés
    await db
      .from('client_access_tokens')
      .update({ revoked: true })
      .in('client_id', inactiveClientIds)
  }

  console.log(`[cron/expire-subscriptions] processed ${subIds.length} subscriptions, deactivated ${inactiveClientIds.length} clients`)

  return NextResponse.json({
    processed: subIds.length,
    deactivated: inactiveClientIds.length,
  })
}
```

- [ ] **Étape 2 : Créer ou modifier `vercel.json`**

Vérifier si `vercel.json` existe :

```bash
ls /Users/user/Desktop/VIRTUS/vercel.json 2>/dev/null && cat /Users/user/Desktop/VIRTUS/vercel.json || echo "MISSING"
```

Si le fichier n'existe pas, le créer :

```json
{
  "crons": [
    {
      "path": "/api/cron/expire-subscriptions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Si le fichier existe déjà, ajouter l'entrée dans le tableau `crons` existant.

- [ ] **Étape 3 : Ajouter `CRON_SECRET` dans les variables d'environnement**

Dans `.env.local`, ajouter :

```
CRON_SECRET=<générer avec : openssl rand -hex 32>
```

Et configurer la même variable dans le dashboard Vercel (Settings → Environment Variables).

- [ ] **Étape 4 : Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | grep "expire-subscriptions"
```

Attendu : aucune erreur.

- [ ] **Étape 5 : Commit**

```bash
git add app/api/cron/expire-subscriptions/route.ts vercel.json
git commit -m "feat(cron): add nightly subscription expiry — deactivate clients with expired end_date"
```

---

## Task 8 : Simplifier la page `/client/login`

**Fichiers :**
- Modifier : `app/client/login/page.tsx`
- Modifier : `app/client/login/actions.ts`

**Contexte :** Le tab "Créer un compte" n'a plus de raison d'être — le client est toujours invité par son coach via email. On retire le tab signup et `clientSignup` de `actions.ts`.

- [ ] **Étape 1 : Simplifier `actions.ts`**

Remplacer le contenu de `app/client/login/actions.ts` par :

```typescript
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('Email not confirmed')) return 'Votre email n\'a pas encore été confirmé.'
  return 'Une erreur est survenue. Veuillez réessayer.'
}

export async function clientLogin(formData: FormData) {
  const supabase = createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email et mot de passe requis.' }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: translateError(error.message) }

  revalidatePath('/', 'layout')
  return { success: true }
}
```

- [ ] **Étape 2 : Simplifier `page.tsx`**

Remplacer le contenu de `app/client/login/page.tsx` par :

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { clientLogin } from './actions'

export default function ClientLoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await clientLogin(formData)
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/client')
      }
    })
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image src="/images/logo.png" alt="STRYV" width={48} height={48} className="w-12 h-12 object-contain" />
        <span className="font-unbounded font-semibold text-base text-primary tracking-tight leading-none">
          STRYV<span className="font-light text-secondary"> lab</span>
        </span>
        <p className="text-xs text-secondary text-center">Ton espace client</p>
      </div>

      <div className="bg-surface rounded-card shadow-soft-out p-6 w-full max-w-sm">
        <h2 className="text-base font-bold text-primary mb-1">Connexion</h2>
        <p className="text-xs text-secondary mb-5">
          Utilise l'email et le mot de passe créés lors de ton invitation.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-1">
              Email
            </label>
            <input
              name="email"
              type="email"
              placeholder="toi@exemple.com"
              required
              className="w-full px-3 py-2.5 bg-surface-light shadow-soft-in rounded-btn text-sm text-primary placeholder-secondary/50 outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 pr-10 bg-surface-light shadow-soft-in rounded-btn text-sm text-primary placeholder-secondary/50 outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-btn px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 flex items-center justify-center gap-2 bg-accent text-white font-bold py-3 rounded-btn hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg text-sm"
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            Se connecter
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-secondary text-center">
        Accès réservé aux clients invités par leur coach.
      </p>
    </div>
  )
}
```

- [ ] **Étape 3 : Vérifier la compilation globale**

```bash
npx tsc --noEmit 2>&1 | grep -v "tests/api" | grep "error TS"
```

Attendu : uniquement les erreurs pre-existantes (stripe, payments). Aucune nouvelle erreur.

- [ ] **Étape 4 : Mettre à jour CHANGELOG.md**

Ajouter en tête de la section `## 2026-04-12` :

```
FEATURE: Client invitation — flux email avec définition de mot de passe (remplace magic link)
FEATURE: Coupure d'accès manuelle coach (DELETE /api/clients/[clientId]/access)
FEATURE: Coupure d'accès automatique — cron nightly expire les abonnements échus
FEATURE: Page /client/acces-suspendu — message clair si accès inactif
FEATURE: Middleware — vérification coach_clients.status sur chaque requête client protégée
REFACTOR: /client/login — retrait tab signup (client toujours invité par coach)
```

- [ ] **Étape 5 : Commit final**

```bash
git add app/client/login/page.tsx app/client/login/actions.ts CHANGELOG.md
git commit -m "refactor(client-login): remove signup tab — clients are always invited by coach"
```

---

## Test manuel post-implémentation

1. **Flux invitation :**
   - Aller sur la fiche d'un client avec email, status `inactive`
   - Cliquer "Inviter le client" → email reçu en ~5s
   - Cliquer le lien dans l'email → arrive sur `/client/set-password`
   - Entrer un mot de passe → redirigé vers `/client` avec session active
   - Retourner sur la fiche coach → badge "Actif" visible

2. **Coupure manuelle :**
   - Sur la fiche coach → "Couper l'accès" → confirmer
   - Badge passe à "Inactif"
   - Dans un autre onglet, le client connecté → à la prochaine requête, redirigé vers `/client/acces-suspendu`

3. **Reconnexion après invitation :**
   - Aller sur `/client/login`
   - Entrer email + mot de passe défini lors de l'invitation → connexion normale

4. **Cron (test manuel) :**
   - Appeler `GET /api/cron/expire-subscriptions` avec header `Authorization: Bearer <CRON_SECRET>`
   - Attendu : `{ processed: N, deactivated: M }`
