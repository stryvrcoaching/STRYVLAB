# Session Logger — Sauvegarde live, verrouillage navigation, PWA temps réel

**Date :** 2026-04-23
**Statut :** Approuvé

---

## Contexte et problèmes résolus

Trois problèmes identifiés dans l'application client :

1. **Perte de données** — Le bouton retour dans le header du `SessionLogger` appelle `router.back()` sans protection. Un clic accidentel en pleine séance détruit toutes les données saisies (stockées uniquement en mémoire React).

2. **Pas de sauvegarde intermédiaire** — Les données de séance (sets, poids, reps, RIR) ne sont sauvegardées qu'au moment du `submitSession()` final. Un crash app, un rechargement, ou une coupure réseau = perte totale.

3. **PWA périmée** — Le service worker utilise `staleWhileRevalidate` pour les pages `/client`. L'app affiche le cache au lancement et ne recharge le contenu frais qu'en arrière-plan. Le client doit fermer et rouvrir l'app pour voir les mises à jour du coach (nouveau programme, modifications d'exercices).

---

## Décisions

- Sauvegarde **set par set** en DB (pas exercice par exercice, pas périodique)
- PWA **network-first** pour les pages dynamiques (pas de bannière "mise à jour disponible")
- Bouton Terminer : **comportement inchangé** (appui long 3s si incomplet, clic simple si tout coché)

---

## Design détaillé

### 1. Suppression du bouton retour

Le bouton `ChevronLeft` dans le header de `SessionLogger.tsx` (appel à `router.back()`) est supprimé. Aucune autre route de sortie n'existe pendant une séance active. La seule sortie est le bouton "Terminer".

Il n'y a pas de confirmation "êtes-vous sûr de vouloir quitter" — on supprime simplement le bouton. La protection vient de la sauvegarde live (même si le client quitte via le geste système, les données sont en DB).

### 2. Sauvegarde live — set par set

#### Création du draft au montage

Au montage de `SessionLogger`, avant que le client ne saisisse quoi que ce soit :

1. Vérifier dans `localStorage` si un `draft_session_log_id_${sessionId}` existe.
2. Si oui, vérifier via `GET /api/session-logs/[logId]/status` que ce log existe en DB et est `completed_at IS NULL`.
   - Si valide → recharger les sets depuis DB, reprendre la séance.
   - Si invalide (supprimé ou déjà complété) → supprimer la clé localStorage, créer un nouveau log.
3. Si non → créer immédiatement un `client_session_logs` via `POST /api/session-logs` avec `set_logs: []`. Stocker le `sessionLogId` retourné dans `localStorage` sous `draft_session_log_id_${sessionId}`.

L'état `sessionLogId` est tenu en `useRef` (pas en state, pour éviter les re-renders).

#### Sauvegarde des sets

Deux déclencheurs :

**A — Coche d'un set (`toggleSet`)** : sauvegarde immédiate, sans debounce. C'est l'action la plus intentionnelle du client.

**B — Saisie dans un champ (reps, poids, RIR)** : debounce 800ms après la dernière frappe. Un `useRef` par champ (ou un seul debounce global sur `updateSet`) déclenche le PATCH après 800ms d'inactivité.

La fonction `patchSets(sets: SetLog[])` envoie `PATCH /api/session-logs/[sessionLogId]/sets` avec le tableau complet des sets de l'exercice courant (pas juste le set modifié — simplifie la logique d'upsert).

#### Endpoint — `PATCH /api/session-logs/[sessionLogId]/sets`

```
PATCH /api/session-logs/[sessionLogId]/sets
Body: { set_logs: SetLog[] }
```

- Auth : vérifier que le `client_session_logs.client_id` correspond au user connecté.
- Opération : `upsert` sur `client_set_logs` avec `onConflict: 'session_log_id, exercise_name, set_number, side'`.
- Retourne `{ ok: true }`.

La contrainte d'unicité `(session_log_id, exercise_name, set_number, side)` doit exister sur la table `client_set_logs`. Si elle n'existe pas, une migration l'ajoute (sans index unique existant, l'upsert dégénère en insert → doublons).

#### Soumission finale (`submitSession`)

Le flow change :

1. Envoyer un dernier `PATCH /api/session-logs/[sessionLogId]/sets` avec tous les sets (flush final).
2. Envoyer `PATCH /api/session-logs/[sessionLogId]` avec `{ completed: true, duration_min }`.
3. Supprimer la clé `draft_session_log_id_${sessionId}` du localStorage.
4. Rediriger vers `/client/programme/recap/[sessionLogId]`.

Plus de `POST /api/session-logs` au moment du submit — le log existe déjà depuis le début.

#### Gestion d'erreur réseau

- Si le PATCH live échoue (réseau coupé, timeout) → on ne bloque pas l'UI. On log l'erreur en console et on maintient un flag `pendingSync: boolean` en state.
- Si `pendingSync` est vrai au moment du submit final, on réessaie le PATCH complet avant de marquer `completed`.
- L'état `saveState` existant (`'idle' | 'saving' | 'error'`) est conservé pour le submit final uniquement.

### 3. PWA — network-first pour les pages client

#### Stratégie service worker

Dans `sw.js`, la section qui gère les pages `/client` passe de `staleWhileRevalidate` à une variante `networkFirst` avec timeout 3 secondes :

```
networkFirst avec timeout 3s :
  1. Race entre fetch(request) et un timer 3s
  2. Si fetch répond avant 3s → servir + mettre en cache
  3. Si timeout → servir le cache
  4. Si offline (fetch throw) → servir le cache
```

Le timeout de 3s évite que l'app soit bloquée sur réseau lent. En pratique sur WiFi ou 4G, le réseau répond en < 500ms.

Les assets `/_next/static/` restent en `cacheFirst` — ils sont versionnés par hash, pas de risque de stale.

Le nom du cache passe de `stryv-client-v1` à `stryv-client-v2` pour invalider proprement le cache existant lors du déploiement.

#### Rechargement automatique après mise à jour

`ServiceWorkerRegistrar.tsx` est enrichi :

```js
navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload()
})
```

Quand un nouveau SW prend le contrôle (après un déploiement), l'app se recharge automatiquement. Le client voit toujours la version fraîche sans manipulation.

**Exception :** Si le client est en séance active (`sessionLogId` présent dans localStorage), on ne recharge PAS automatiquement — on attend la fin de séance. Cette vérification se fait dans le handler `controllerchange` avant le `reload()`.

---

## Fichiers touchés

| Fichier | Nature du changement |
|---|---|
| `app/client/programme/session/[sessionId]/SessionLogger.tsx` | Supprimer bouton retour, créer draft au mount, debounce PATCH, récupération draft, flush final |
| `app/client/programme/session/[sessionId]/page.tsx` | Passer `sessionId` comme prop explicite |
| `app/api/session-logs/[sessionLogId]/sets/route.ts` | Nouveau endpoint PATCH upsert |
| `app/api/session-logs/[sessionLogId]/route.ts` | Vérifier que le endpoint PATCH `completed` existe (déjà présent selon le code) |
| `public/sw.js` | Network-first avec timeout, cache v2 |
| `components/client/ServiceWorkerRegistrar.tsx` | Écoute `controllerchange`, reload conditionnel |

---

## Migration DB requise

Vérifier l'existence d'une contrainte unique sur `client_set_logs(session_log_id, exercise_name, set_number, side)`. Si absente, créer :

```sql
ALTER TABLE client_set_logs
  ADD CONSTRAINT client_set_logs_session_exercise_set_side_unique
  UNIQUE (session_log_id, exercise_name, set_number, side);
```

Cette contrainte est nécessaire pour que l'upsert fonctionne correctement sans créer de doublons.

---

## Invariants

- Un `client_session_logs` avec `completed_at IS NULL` représente une séance en cours. Il ne peut y en avoir qu'un par client par `program_session_id` à la fois (à vérifier côté API au moment de la création).
- Les données de sets en DB sont la source de vérité. Le state React est la vue locale.
- Le localStorage ne stocke que l'ID du log en cours — jamais les données elles-mêmes (la DB est le backup).
- Pendant une séance active, le SW ne recharge jamais l'app automatiquement.
