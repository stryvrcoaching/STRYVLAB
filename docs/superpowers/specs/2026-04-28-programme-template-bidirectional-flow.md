# Programme ↔ Template Bidirectional Flow

**Date:** 2026-04-28  
**Status:** Approved  

---

## Problème

Le flux programme/template est actuellement à sens unique :
- Template → Programme client (via `/coach/programs/templates/[templateId]/assign`)
- Mais cette assignation redirige hors du contexte client (page dédiée)
- Il n'existe pas de chemin Programme client → Template

De plus, les boutons d'action sur la page Entraînement sont dans le contenu de la page au lieu de la TopBar (non-conforme DS v2.0).

---

## Solution

### A — TopBar Entraînement

**Fichier :** `app/coach/clients/[clientId]/protocoles/entrainement/page.tsx`

Deux boutons dans la TopBar right (via `useClientTopBar`) :
- `"Assigner un template"` — bouton secondaire `bg-white/[0.04]`
- `"+ Nouveau programme"` — bouton primaire `bg-[#1f8a65]`

Les boutons sont masqués quand le builder est ouvert (mode édition).

---

### B — Modal "Assigner un template"

**Nouveau composant :** `components/programs/AssignTemplateModal.tsx`

- Overlay `bg-black/50 backdrop-blur-sm`, card `bg-[#181818] rounded-2xl`
- Taille : `max-w-2xl w-full max-h-[80vh]` avec scroll interne
- Header : "Assigner un template" + bouton X
- Search input pour filtrer les templates par nom
- Liste triée par score via `rankTemplates([template], clientProfile)` (système existant)
  - Badge score, label "Recommandé", hard stops, substitutions — même rendu que la page assign
- Input nom du programme (pré-rempli : `template.name — Prénom Nom`)
- Bouton "Créer le programme" → `POST /api/program-templates/[templateId]/assign` avec `client_id`
- Après succès : ferme le modal + rafraîchit la liste programmes

Le client est connu depuis le contexte (`useClient()`) — pas de sélection client dans le modal.

**Props :**
```ts
interface AssignTemplateModalProps {
  clientId: string
  clientProfile: ClientProfile  // pour le scoring
  clientName: string            // pour le nom par défaut
  onClose: () => void
  onAssigned: () => void        // rafraîchit la liste
}
```

---

### C — "Enregistrer comme template" (builder)

**Fichier :** `components/programs/ProgramTemplateBuilder.tsx`

Bouton "Enregistrer comme template" dans la TopBar quand `programId` est présent (mode programme client vs mode template).  
Bouton secondaire `bg-white/[0.04]`, à gauche du bouton "Sauvegarder".

Au clic → ouvre `SaveAsTemplateModal`.

---

### D — "Enregistrer comme template" (liste)

**Fichier :** `components/programs/ClientProgramsList.tsx`

Chaque carte programme a un bouton secondaire "Enregistrer comme template" (icône `BookmarkPlus` ou similaire).  
Au clic → ouvre `SaveAsTemplateModal` avec le `programId` concerné.

---

### E — Modal "Enregistrer comme template"

**Nouveau composant :** `components/programs/SaveAsTemplateModal.tsx`

Petite modale DS v2.0 :
- `bg-[#181818] rounded-2xl p-6 max-w-sm`
- Input nom du template (pré-rempli avec le nom du programme)
- Textarea description (optionnel)
- Bouton "Créer le template" → `POST /api/programs/[programId]/save-as-template`
- Toast succès + fermeture

---

### F — Endpoint `save-as-template`

**Nouveau fichier :** `app/api/programs/[programId]/save-as-template/route.ts`

```
POST /api/programs/[programId]/save-as-template
Body: { name?: string, description?: string }
```

Logique :
1. Auth + vérification ownership (`programs.coach_id = user.id`)
2. Fetch le programme complet avec sessions + exercices
3. `INSERT` dans `coach_program_templates` avec les métadonnées du programme
4. Pour chaque session → `INSERT` dans `coach_program_template_sessions`
5. Pour chaque exercice → `INSERT` dans `coach_program_template_exercises`
6. Retourne `{ template_id }` — le programme client reste intact

---

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `app/coach/clients/[clientId]/protocoles/entrainement/page.tsx` | Modifier — TopBar 2 boutons, intégrer modaux |
| `app/api/programs/[programId]/save-as-template/route.ts` | Créer — endpoint copie programme → template |
| `components/programs/AssignTemplateModal.tsx` | Créer — modal assignation avec scoring |
| `components/programs/SaveAsTemplateModal.tsx` | Créer — modal confirmation save-as-template |
| `components/programs/ProgramTemplateBuilder.tsx` | Modifier — bouton "Enregistrer comme template" dans TopBar |
| `components/programs/ClientProgramsList.tsx` | Modifier — action "Enregistrer comme template" sur cartes |

---

## Invariants

- Le programme client **n'est jamais modifié** lors de la création du template (copie stricte)
- Le client est toujours connu depuis le contexte — jamais de sélection client dans le modal d'assignation
- Les boutons d'action sont **uniquement dans la TopBar** (DS v2.0 non-négociable)
- Le scoring `rankTemplates` est réutilisé tel quel — pas de duplication de logique
