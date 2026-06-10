# Design — Suppression / Archivage Client

**Date :** 2026-04-13  
**Statut :** Approuvé  

---

## Contexte

Un coach doit pouvoir retirer un client de son portefeuille de deux façons :
- **Archivage (soft delete)** — le client est caché mais ses données sont conservées
- **Suppression définitive (hard delete)** — toutes les données sont effacées, y compris le compte auth Supabase

Le déclenchement se fait depuis la fiche client uniquement (`/coach/clients/[clientId]`).

---

## Comportements

### Archive
- `coach_clients.status` → `'archived'`
- Révoque tous les `client_access_tokens` (`revoked = true`)
- Le compte auth Supabase est conservé (accès révoqué via token uniquement)
- Le client n'apparaît plus dans la liste par défaut (filtre `status != 'archived'`)

### Hard Delete
- Suppression en cascade dans cet ordre (FK safety) :
  1. `assessment_responses` (via les submissions du client)
  2. `assessment_submissions`
  3. `client_access_tokens`
  4. `client_subscriptions`
  5. `coach_client_annotations`
  6. `coach_clients`
  7. Compte auth Supabase via `auth.admin.deleteUser(userId)` — si `userId` non null
- Irreversible — aucune récupération possible

---

## API

### `DELETE /api/clients/[clientId]?mode=archive|delete`

**Auth :** session coach requise  
**Ownership check :** `coach_clients.coach_id = user.id`

**Réponses :**
- `200` — opération réussie, `{ mode, clientId }`
- `400` — `mode` manquant ou invalide
- `403` — client n'appartient pas au coach
- `404` — client introuvable
- `500` — erreur Supabase

---

## UI

### Bouton déclencheur
Zone "Danger" en bas de la fiche client (`/coach/clients/[clientId]`).  
Bouton secondaire discret : `bg-white/[0.04] text-red-400/70`, libellé "Archiver ou supprimer".

### Modale

Overlay `bg-black/50 backdrop-blur-sm`, card `bg-[#181818] rounded-2xl`.

**Deux sections :**

**1. Archiver**
- Description : "Le client sera masqué. Ses données sont conservées."
- Bouton : `bg-white/[0.04]` → "Archiver ce client"
- Confirmation simple (un clic)

**2. Supprimer définitivement**
- Description : "Toutes les données seront effacées de manière irréversible."
- Champ texte : "Tapez `[prénom nom]` pour confirmer"
- Bouton : `bg-red-500/80` → "Supprimer définitivement" — désactivé tant que le nom n'est pas exact
- Matching case-insensitive, trim whitespace

### États
- `idle` → `confirming_archive` | `confirming_delete` → `loading` → `done`
- Après succès : redirect vers `/coach/clients`

---

## Sécurité

- L'ownership est toujours vérifié server-side avant toute opération
- `auth.admin.deleteUser` requiert le service role key (déjà utilisé dans ce projet)
- La suppression DB se fait dans une transaction Supabase pour garantir l'atomicité
- Si `auth.admin.deleteUser` échoue mais que la DB est déjà nettoyée : log l'erreur, retourner 500 (opération non atomique — acceptable car l'utilisateur sans données est inoffensif)

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `app/api/clients/[clientId]/route.ts` | Ajouter handler `DELETE` |
| `app/coach/clients/[clientId]/page.tsx` ou composant dédié | Ajouter bouton + modale |
| `components/clients/DeleteClientModal.tsx` | Nouveau composant modale |
