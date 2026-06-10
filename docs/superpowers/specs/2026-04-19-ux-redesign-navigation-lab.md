# UX Redesign — Navigation Dock + Lab System

> Date : 2026-04-19
> Statut : Approuvé — prêt pour implémentation

---

## Vision

Transformer STRYVR en un **laboratoire de coaching** — un espace où tout part du client, où la data alimente les protocoles, et où la navigation est si intuitive qu'elle disparaît. Le coach ne réfléchit pas à "où aller" — il sait d'instinct.

---

## Architecture de navigation — Double Dock

Inspiré de Miro/Figma. Deux docks permanents, rôles distincts.

### Dock gauche (vertical, permanent, ~48px)

Toujours visible. Ne change jamais. Donne l'orientation globale dans l'app.

| Icône | Label | Destination |
|-------|-------|-------------|
| `LayoutDashboard` | Dashboard | `/dashboard` |
| `FlaskConical` | Lab | Sélection client → Lab |
| `Layers` | Templates | Templates universels |
| `Briefcase` | Business | Gestion du cabinet |
| `UserCircle` | Mon compte | Paramètres coach |

- Icône active : indicateur point `#1f8a65` + icône colorée
- Hover : tooltip avec le label
- Style : `bg-[#181818]`, `rounded-2xl`, `border-[0.3px] border-white/[0.06]`

### Dock bas (horizontal, centré, flottant, ~56px)

Contextuel — change selon l'espace actif. Toujours centré, `bottom-6`, `rounded-2xl`.

**Contenu par espace :**

| Espace actif | Items dock bas |
|---|---|
| Dashboard | Absent ou minimal (actions rapides si nécessaire) |
| Lab / Sélection client | Barre de recherche client |
| Lab / Data & Analyse | `Métriques · Bilans · Performances · MorphoPro` |
| Lab / Protocoles | `Nutrition · Entraînement · Cardio · Composition` |
| Templates | `Programmes · Bilans · Nutrition` |
| Business | `Comptabilité · Formules · Organisation` |
| Mon compte | `Profil · Abonnement · Préférences` |

**Bouton `+` central :**
- Toujours présent dans le dock bas
- Non déplaçable, non supprimable
- Contextuel : action directe si une seule possibilité, menu radial/vertical si plusieurs
- Exemples :
  - Sur liste clients → "Nouveau client"
  - Sur Lab / Data → "Nouveau bilan · Lancer MorphoPro · Ajouter note"
  - Sur Lab / Protocoles → "Nouveau protocole nutrition · Assigner programme"
  - Sur Templates → "Nouveau template"

**Dock configurable :**
- Clic long → mode édition (shake, boutons `-`, drag-to-reorder)
- Tiroir "Ajouter au dock" pour les items non placés
- Persisté en DB (`coach_preferences`) ou `localStorage`

### Barre de tabs clients (au-dessus du dock bas, Lab uniquement)

Visible uniquement quand au moins un client est ouvert dans le Lab.

- Style Chrome/Safari : tabs scrollables horizontalement
- Chaque tab : avatar/initiales + prénom + `×` pour fermer
- Tab actif : indicateur `#1f8a65`
- Bouton `+` dans la barre → ouvre la sélection client

---

## Espaces — Détail

### 1. Dashboard

Page synthétique : hero narratif, alertes, actions rapides, vue clients, strip financier. Déjà implémenté — à adapter au nouveau shell.

Dock bas : absent (le Dashboard est déjà une page d'orientation, pas besoin de sous-navigation).

### 2. Lab

**Le cœur de la plateforme.** Tout part du client.

**Entrée :** Sélection d'un client depuis la liste. Le client s'ouvre comme un tab dans la barre de tabs. Le dock gauche reste sur "Lab".

**Deux zones distinctes accessibles depuis le dock gauche via sous-entrées Lab :**

#### Lab / Data & Analyse
Tout ce qui est observation, mesure, historique. Lecture uniquement.

Dock bas : `Métriques · Bilans · Performances · MorphoPro`

- **Métriques** : biométriques, normes, jauges, graphiques évolution
- **Bilans** : historique soumissions, statuts, réponses
- **Performances** : historique séances, 1RM évolution, session logs
- **MorphoPro** : analyse morphologique photos — outil d'analyse → appartient à Data

Toutes les données collectées ici alimentent automatiquement les Protocoles.

#### Lab / Protocoles
Tout ce qui est construction de protocoles personnalisés pour ce client. Les données du client sont injectées automatiquement dans chaque outil.

Dock bas : `Nutrition · Entraînement · Cardio · Composition`

- **Nutrition** : Macros & Calories, Carb Cycling, Hydratation, Cycle Sync
- **Entraînement** : Assigner un programme template, Programme personnalisé (builder), RIR tracking
- **Cardio** : HR Zones
- **Composition** : Body Fat %, suivi masse grasse/musculaire

**Règle clé :** Les outils de Protocoles reçoivent automatiquement les données du client (poids, BF%, objectif, niveau, restrictions, morpho) sans que le coach ait à les saisir manuellement.

### 3. Templates

Espace de préparation universelle — aucun lien avec un client spécifique. On construit des templates réutilisables qu'on assignera ensuite depuis le Lab.

Dock bas : `Programmes · Bilans · Nutrition`

- **Programmes** : builder templates d'entraînement (déjà implémenté — `ProgramTemplateBuilder`)
- **Bilans** : builder templates de bilans (déjà implémenté — `AssessmentTemplates`)
- **Nutrition** : builder protocoles nutritionnels types *(futur)*

### 4. Business

Gestion du cabinet coach. Rien à voir avec les clients directement.

Dock bas : `Comptabilité · Formules · Organisation`

- **Comptabilité** : revenus, factures, abonnements clients
- **Formules** : offres et tarifs assignables aux clients
- **Organisation** : Kanban, Calendrier

### 5. Mon compte

Paramètres du coach.

Dock bas : `Profil · Abonnement · Préférences`

---

## Onboarding — Nouveau coach

### Checklist Dashboard

Visible jusqu'à completion de toutes les étapes. Persistée en DB.

Étapes suggérées (ordre logique) :
1. Compléter son profil (photo, infos entreprise, TVA)
2. Créer sa première formule
3. Créer un template bilan
4. Créer un template programme
5. Ajouter son premier client
6. Envoyer le premier bilan
7. Assigner le premier programme

### CTA contextuels sur pages vides

Sur chaque page vide, un CTA principal mis en avant :
- Aucun client → "Ajouter votre premier client"
- Aucun template → "Créer votre premier template"
- Aucune formule → "Créer votre première formule"

Hiérarchie visuelle : le CTA prioritaire est toujours en accent `#1f8a65`, les secondaires en `bg-white/[0.04]`.

---

## Implémentation — 3 phases

### Phase 1 — Nouveau shell (double dock)
Refonte de `CoachShell.tsx` :
- Supprimer la sidebar actuelle
- Créer `DockLeft.tsx` (vertical, permanent)
- Créer `DockBottom.tsx` (horizontal, contextuel, configurable)
- Créer `ClientTabsBar.tsx` (barre de tabs au-dessus du dock bas)
- Adapter le TopBar ou le supprimer si redondant

### Phase 2 — Refonte fiche client
- Supprimer les 7 onglets actuels
- Lab / Data & Analyse : Métriques, Bilans, Performances, MorphoPro (déplacé depuis Profil)
- Lab / Protocoles : Nutrition, Entraînement, Cardio, Composition avec injection données client
- Système de tabs clients ouverts en parallèle

### Phase 3 — Lab contextualisé + injection données
- Chaque outil Protocole reçoit les données du client automatiquement
- MorphoPro déplacé de `/coach/clients/[clientId]` (onglet Profil) vers Lab / Data & Analyse
- Outils standalone (sans client) accessibles depuis Templates ou usage libre

---

## Points de vigilance

- Le dock bas **ne remplace pas** le TopBar pour les actions de page (save, filtres) — le TopBar reste pour les actions contextuelles de la page courante
- MorphoPro **déplacé** depuis l'onglet Profil client → Lab / Data & Analyse — migration à planifier
- Les outils Protocoles doivent recevoir les données client via un contexte React partagé (`ClientLabContext`) — évite les fetches redondants
- Le dock configurable nécessite une table `coach_preferences` ou une colonne JSONB sur `coach_profiles` pour persister la config
- La barre de tabs clients : limiter à ~8 tabs max affichés, scroll horizontal au-delà
- `ProgramTemplateBuilder` reste dans Templates — il est universel, pas client-specific
