# Client Delete / Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a coach to archive or permanently delete a client from the client detail page, with confirmation modale and full data cascade on hard delete.

**Architecture:** DELETE endpoint on the existing `app/api/clients/[clientId]/route.ts`, new `DeleteClientModal` component consumed by the client detail page. Archive sets `status='archived'` and revokes tokens. Hard delete cascades all related tables then removes the Supabase auth user.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (service role), Tailwind CSS DS v2.0

**Spec:** `docs/superpowers/specs/2026-04-13-client-delete-archive-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/api/clients/[clientId]/route.ts` | Modify | Add `DELETE` handler |
| `components/clients/DeleteClientModal.tsx` | Create | Modale UI (archive + hard delete) |
| `app/coach/clients/[clientId]/page.tsx` | Modify | Add danger zone button + wire modal |

---

## Task 1 — DELETE API endpoint

**Files:**
- Modify: `app/api/clients/[clientId]/route.ts`

- [ ] **Step 1: Add the DELETE handler at the bottom of the route file**

```typescript
// DELETE /api/clients/[clientId]?mode=archive|delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')

  if (mode !== 'archive' && mode !== 'delete') {
    return NextResponse.json({ error: 'Paramètre mode invalide (archive|delete)' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const service = serviceClient()

  // Ownership check
  const { data: clientRow, error: fetchError } = await service
    .from('coach_clients')
    .select('id, auth_user_id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (fetchError || !clientRow) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  if (mode === 'archive') {
    // Revoke all access tokens
    await service
      .from('client_access_tokens')
      .update({ revoked: true })
      .eq('client_id', params.clientId)

    // Set status archived
    const { error } = await service
      .from('coach_clients')
      .update({ status: 'archived' })
      .eq('id', params.clientId)

    if (error) {
      console.error('DELETE archive:', error)
      return NextResponse.json({ error: 'Archivage impossible' }, { status: 500 })
    }

    return NextResponse.json({ mode: 'archive', clientId: params.clientId })
  }

  // Hard delete — cascade in FK-safe order
  const deleteSteps: Array<{ table: string; column: string }> = [
    { table: 'assessment_responses', column: 'submission_id' },
  ]

  // First get submission IDs for this client
  const { data: submissions } = await service
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', params.clientId)

  if (submissions && submissions.length > 0) {
    const submissionIds = submissions.map((s: { id: string }) => s.id)
    const { error: responsesError } = await service
      .from('assessment_responses')
      .delete()
      .in('submission_id', submissionIds)
    if (responsesError) {
      console.error('DELETE responses:', responsesError)
      return NextResponse.json({ error: 'Suppression réponses impossible' }, { status: 500 })
    }
  }

  const clientScopedTables = [
    'assessment_submissions',
    'client_access_tokens',
    'client_subscriptions',
    'coach_client_annotations',
  ]

  for (const table of clientScopedTables) {
    const { error } = await service
      .from(table)
      .delete()
      .eq('client_id', params.clientId)
    if (error) {
      console.error(`DELETE ${table}:`, error)
      return NextResponse.json({ error: `Suppression ${table} impossible` }, { status: 500 })
    }
  }

  // Delete coach_clients row
  const { error: clientDeleteError } = await service
    .from('coach_clients')
    .delete()
    .eq('id', params.clientId)

  if (clientDeleteError) {
    console.error('DELETE coach_clients:', clientDeleteError)
    return NextResponse.json({ error: 'Suppression client impossible' }, { status: 500 })
  }

  // Delete auth user if linked
  if (clientRow.auth_user_id) {
    const { error: authDeleteError } = await service.auth.admin.deleteUser(clientRow.auth_user_id)
    if (authDeleteError) {
      // Log but don't fail — data already cleaned
      console.error('DELETE auth user:', authDeleteError)
    }
  }

  return NextResponse.json({ mode: 'delete', clientId: params.clientId })
}
```

- [ ] **Step 2: Check which column stores the auth user ID**

Inspect the actual column name in `coach_clients` by running:
```bash
grep -r "auth_user_id\|user_id" app/api/clients/ --include="*.ts" -l
```
Then read the GET handler in `app/api/clients/[clientId]/route.ts` to confirm. If the column is `user_id` instead of `auth_user_id`, update the `select('id, auth_user_id')` and `clientRow.auth_user_id` references accordingly.

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Manual smoke test — archive**

```bash
# Replace CLIENT_ID and COOKIE with real values
curl -X DELETE "http://localhost:3000/api/clients/CLIENT_ID?mode=archive" \
  -H "Cookie: YOUR_SESSION_COOKIE"
```
Expected: `{ "mode": "archive", "clientId": "..." }`

- [ ] **Step 5: Commit**

```bash
git add app/api/clients/[clientId]/route.ts
git commit -m "feat(clients): add DELETE endpoint — archive and hard delete modes"
```

---

## Task 2 — DeleteClientModal component

**Files:**
- Create: `components/clients/DeleteClientModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"

interface Props {
  clientId: string
  clientName: string // "Prénom Nom"
  onClose: () => void
  onSuccess: (mode: "archive" | "delete") => void
}

type Step = "choice" | "confirming_delete" | "loading"

export default function DeleteClientModal({ clientId, clientName, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("choice")
  const [deleteInput, setDeleteInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const nameMatch = deleteInput.trim().toLowerCase() === clientName.trim().toLowerCase()

  async function handleAction(mode: "archive" | "delete") {
    setStep("loading")
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}?mode=${mode}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Une erreur est survenue")
        setStep(mode === "archive" ? "choice" : "confirming_delete")
        return
      }
      onSuccess(mode)
    } catch {
      setError("Erreur réseau")
      setStep(mode === "archive" ? "choice" : "confirming_delete")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] rounded-2xl p-6 w-full max-w-sm border-[0.3px] border-white/[0.06]">

        {step === "choice" && (
          <>
            <h3 className="font-bold text-white mb-1">Gérer le client</h3>
            <p className="text-[13px] text-white/55 mb-5">
              Choisissez une action pour <span className="text-white/80 font-medium">{clientName}</span>.
            </p>

            {/* Archive */}
            <div className="mb-3 p-4 rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06]">
              <p className="text-[13px] font-semibold text-white mb-1">Archiver</p>
              <p className="text-[12px] text-white/45 mb-3">
                Le client sera masqué de votre liste. Ses données sont conservées et récupérables.
              </p>
              <button
                onClick={() => handleAction("archive")}
                className="w-full py-2 rounded-xl bg-white/[0.04] text-[13px] text-white/70 hover:text-white/90 hover:bg-white/[0.07] transition-colors font-medium"
              >
                Archiver ce client
              </button>
            </div>

            {/* Hard delete trigger */}
            <div className="p-4 rounded-xl bg-red-500/[0.04] border-[0.3px] border-red-500/20">
              <p className="text-[13px] font-semibold text-white mb-1">Supprimer définitivement</p>
              <p className="text-[12px] text-white/45 mb-3">
                Toutes les données seront effacées de manière irréversible, y compris les bilans et l'accès client.
              </p>
              <button
                onClick={() => setStep("confirming_delete")}
                className="w-full py-2 rounded-xl bg-red-500/10 text-[13px] text-red-400/80 hover:text-red-400 hover:bg-red-500/20 transition-colors font-medium"
              >
                Procéder à la suppression…
              </button>
            </div>

            <button
              onClick={onClose}
              className="mt-4 w-full py-2 rounded-xl bg-transparent text-[12px] text-white/30 hover:text-white/55 transition-colors"
            >
              Annuler
            </button>
          </>
        )}

        {step === "confirming_delete" && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <h3 className="font-bold text-white">Confirmation requise</h3>
            </div>
            <p className="text-[13px] text-white/55 mb-4">
              Cette action est <span className="text-red-400 font-medium">irréversible</span>. Tapez le nom complet du client pour confirmer :
            </p>
            <p className="text-[12px] font-mono text-white/70 bg-white/[0.04] rounded-lg px-3 py-2 mb-3 select-all">
              {clientName}
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="Tapez le nom ici…"
              className="w-full rounded-xl bg-[#0a0a0a] px-4 h-[44px] text-[13px] font-medium text-white placeholder:text-white/20 outline-none border-[0.3px] border-white/[0.06] focus:border-red-500/40 transition-colors mb-4"
            />

            {error && (
              <p className="text-[12px] text-red-400 mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep("choice"); setDeleteInput(""); setError(null) }}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium"
              >
                Retour
              </button>
              <button
                onClick={() => handleAction("delete")}
                disabled={!nameMatch}
                className="flex-1 py-2.5 rounded-xl bg-red-500/80 text-white text-[13px] font-bold hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
            <p className="text-[13px] text-white/45">Opération en cours…</p>
          </div>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/clients/DeleteClientModal.tsx
git commit -m "feat(clients): add DeleteClientModal — archive and hard delete with name confirmation"
```

---

## Task 3 — Wire modal into client detail page

**Files:**
- Modify: `app/coach/clients/[clientId]/page.tsx`

- [ ] **Step 1: Add import at the top of the file**

After the existing import block (around line 41), add:
```tsx
import DeleteClientModal from "@/components/clients/DeleteClientModal"
```

- [ ] **Step 2: Add modal state near the other useState declarations (around line 121)**

```tsx
const [showDeleteModal, setShowDeleteModal] = useState(false)
```

- [ ] **Step 3: Add the danger zone button at the bottom of the "profil" tab content**

Find the section in the JSX where the `profil` tab content ends (search for `tab === "profil"` block). At the very bottom of that block, before the closing tag, add:

```tsx
{/* Danger zone */}
<div className="mt-8 pt-6 border-t-[0.3px] border-white/[0.06]">
  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25 mb-3">
    Zone dangereuse
  </p>
  <button
    onClick={() => setShowDeleteModal(true)}
    className="px-4 py-2 rounded-lg bg-white/[0.02] text-[12px] text-red-400/60 hover:text-red-400/90 hover:bg-red-500/[0.06] transition-colors border-[0.3px] border-red-500/10"
  >
    Archiver ou supprimer ce client
  </button>
</div>
```

- [ ] **Step 4: Add the modal and its success handler just before the closing `</div>` of the page root**

```tsx
{showDeleteModal && client && (
  <DeleteClientModal
    clientId={clientId}
    clientName={`${client.first_name} ${client.last_name}`}
    onClose={() => setShowDeleteModal(false)}
    onSuccess={(mode) => {
      setShowDeleteModal(false)
      router.push("/coach/clients")
    }}
  />
)}
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Manual test — full flow**

1. Start dev server: `npm run dev`
2. Navigate to a client detail page
3. Go to tab "Profil", scroll to bottom — verify "Zone dangereuse" button appears
4. Click it — verify modale opens with archive + delete options
5. Test archive: click "Archiver ce client" → verify redirect to `/coach/clients`
6. Test delete flow: open modal on another client, click "Procéder à la suppression…", verify name input, type exact name → button enables → click → verify redirect

- [ ] **Step 7: Update CHANGELOG.md**

Add at the top of today's section:
```
## 2026-04-13

FEATURE: Add client archive and hard delete from client detail page
```

- [ ] **Step 8: Update project-state.md**

Add a dated section `## 2026-04-13 — Suppression / Archivage Client` documenting the new DELETE endpoint, cascade order, and the modal flow.

- [ ] **Step 9: Commit**

```bash
git add app/coach/clients/[clientId]/page.tsx CHANGELOG.md .claude/rules/project-state.md
git commit -m "feat(clients): wire DeleteClientModal into client detail page"
```

---

## Notes d'implémentation

- **Colonne auth user ID** : vérifier le vrai nom de colonne dans `coach_clients` (probablement `user_id` ou `auth_user_id`) avant de lancer — le Task 1 Step 2 couvre ça.
- **Table `coach_client_annotations`** : vérifier que la table s'appelle exactement ainsi (`grep -r "annotations" app/api/clients/` peut confirmer).
- **Clients archivés** : penser à ajouter un filtre `status != 'archived'` dans `app/api/clients/route.ts` (GET list) si ce n'est pas déjà le cas.
