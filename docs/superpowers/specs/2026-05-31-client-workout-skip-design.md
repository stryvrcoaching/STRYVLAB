# Client Workout Skip — Design Spec

**Date :** 2026-05-31
**Objectif :** Permettre au client PWA de déclarer qu'il ne peut vraiment pas faire sa séance du jour, de la `skip` avant démarrage, d'informer le coach via l'inbox coach + badge visible, et de requalifier la date comme `jour off global`.
**Stack :** Next.js App Router, Supabase, TypeScript strict, DS v3.0 client, système de notifications coach existant

---

## Contexte

La PWA client expose déjà un espace `programme / workout`, un logger de séance, ainsi qu'un système de notifications côté coach via `coach inbox`. En revanche, il manque un comportement produit explicite quand le client ne peut réellement pas exécuter sa séance prévue.

Aujourd'hui, l'absence de séance peut être interprétée comme :
- une séance oubliée
- une séance manquée sans prévenir
- une impossibilité réelle mais silencieuse

Le besoin est d'introduire un signal produit propre : le client peut déclarer un `skip exceptionnel`, et le coach reçoit une information exploitable sans surcharger sa boîte mail.

---

## Understanding Summary

- Le périmètre est la PWA client, dans `workout / programme d'entraînement`.
- Le besoin est un `skip exceptionnel` de séance, pas une pause globale du programme.
- Le skip est autorisé `uniquement avant démarrage` de la séance.
- Le coach doit être informé via `coach inbox` avec `badge visible` sur le client concerné.
- Aucun email immédiat n'est envoyé en V1.
- Le client doit fournir un `motif guidé`, avec `note optionnelle`.
- Quand une séance est skippée, la date concernée devient un `jour off global`.
- Si une nutrition `training day / off day` est configurée, la journée bascule vers la logique `off day`.
- L'objectif est d'améliorer la lisibilité coach sans normaliser le fait de sauter une séance.

---

## Assumptions

- Une séance est considérée comme `démarrée` dès qu'un log de séance existe ou qu'un signal métier équivalent marque le début du logger.
- Le skip s'applique à une séance planifiée précise, pour une date donnée.
- Le système de notifications coach existant peut être étendu sans créer un canal parallèle.
- Le client n'a pas besoin de reprogrammer lui-même la séance au moment du skip en V1.
- Le skip doit rester visible comme un état métier distinct dans l'historique et les analyses futures.
- La requalification `jour off global` vaut pour la date du skip uniquement.
- Les systèmes lisant le type de journée doivent pouvoir appliquer un override explicite de date, au-dessus du planning théorique.

---

## Non-Functional Requirements

- **Performance :** le flow doit rester court, compréhensible et terminer en quelques interactions.
- **Scale :** réutiliser l'architecture PWA et notifications existante, sans nouveau service temps réel.
- **Sécurité :** seul le client propriétaire de la séance planifiée peut effectuer le skip.
- **Fiabilité :** le skip et la notification coach doivent être traités comme une seule action métier cohérente.
- **Maintenance :** éviter un système ad hoc ; s'appuyer sur les états de séance et l'inbox coach existants.
- **Consistance métier :** la qualification de la journée doit être partagée entre programme, nutrition et vues smart pour éviter des états contradictoires.

---

## Decision Log

- **Décidé :** le besoin V1 est un `skip exceptionnel` par séance.
  **Alternatives considérées :** pause globale, report de séance, skip libre sans garde-fou.
  **Pourquoi :** besoin plus simple, plus clair et mieux aligné avec le cas d'usage exprimé.

- **Décidé :** le skip est autorisé uniquement avant démarrage.
  **Alternatives considérées :** autoriser pendant la séance, jusqu'à la fin du jour, ou rétroactivement.
  **Pourquoi :** évite les ambiguïtés métier entre abandon, séance commencée et séance volontairement non faite.

- **Décidé :** le coach est informé via `inbox + badge visible`.
  **Alternatives considérées :** inbox seule, email immédiat, inbox + badge + email.
  **Pourquoi :** bon équilibre entre visibilité et bruit opérationnel.

- **Décidé :** le client doit fournir un motif guidé avec note optionnelle.
  **Alternatives considérées :** justification libre obligatoire, justification facultative, aucun motif.
  **Pourquoi :** vitesse côté client + meilleure lisibilité côté coach.

- **Décidé :** la V1 ne reprogramme pas automatiquement la séance.
  **Alternatives considérées :** report automatique ou proposition de replanification instantanée.
  **Pourquoi :** réduit fortement la complexité produit et les cas limites.

- **Décidé :** un skip requalifie la date en `jour off global`.
  **Alternatives considérées :** nutrition seulement, override partiel de quelques widgets, aucun impact hors workout.
  **Pourquoi :** la journée doit rester cohérente à travers le produit ; un training day affiché avec une séance skippée créerait une contradiction.

---

## Approches Envisagées

### 1. CTA explicite sur la séance du jour — Recommandé

Ajouter sur la carte de la séance planifiée un CTA secondaire du type `Je ne peux pas faire cette séance`.

Au tap :
- ouverture d'une bottom sheet
- choix du motif
- note optionnelle
- confirmation explicite que le coach sera informé

**Avantages :**
- très clair pour le client
- visible au bon moment
- simple à implémenter dans le flux existant `programme`
- cohérent avec les patterns PWA actuels

**Inconvénients :**
- nécessite de bien doser le poids visuel pour ne pas banaliser l'action

### 2. Action cachée dans un menu secondaire

Le skip existe, mais n'est disponible que dans un menu `•••` ou une action discrète.

**Avantages :**
- réduit le risque de normaliser le skip

**Inconvénients :**
- moins découvrable
- moins rassurant dans un moment de friction réelle

### 3. Choix présenté au lancement de la séance

Le client voit `Démarrer` ou `Je ne peux pas aujourd'hui` quand il entre dans le flow de lancement.

**Avantages :**
- contexte très précis

**Inconvénients :**
- oblige à entrer dans le flow pour une action qui devrait pouvoir être déclarée en amont

### Recommandation

La V1 doit utiliser l'approche **CTA explicite sur la séance du jour**, avec un poids visuel secondaire par rapport au CTA principal `Démarrer`.

---

## UX Client

### Emplacement

Sur `/client/programme`, sur la carte de la séance du jour non démarrée :
- CTA principal : `Démarrer`
- CTA secondaire discret : `Je ne peux pas faire cette séance`

Ce CTA ne doit pas apparaître si :
- la séance est déjà démarrée
- la séance est déjà terminée
- la séance est déjà skippée

### Flow

Tap sur `Je ne peux pas faire cette séance` :

1. ouverture d'une bottom sheet
2. sélection d'un motif guidé
3. ajout facultatif d'une note
4. confirmation finale

### Copy recommandée

**Titre :** `Impossible de faire ta séance ?`

**Aide :** `Ton coach sera informé que tu as décidé de passer cette séance aujourd'hui.`

**CTA final :** `Confirmer le skip`

**CTA retour :** `Annuler`

### Motifs guidés V1

- `Malade / pas en forme`
- `Fatigue / récupération insuffisante`
- `Douleur / gêne physique`
- `Imprévu perso / boulot`
- `Déplacement / logistique`

### État après confirmation

Après confirmation :
- la séance passe à l'état `skipped`
- la date est marquée `off day` via un override métier
- le CTA de démarrage disparaît pour cette occurrence
- un feedback explicite apparaît : `Séance passée. Ton coach a été informé.`
- la carte peut afficher un état passif `Séance skippée aujourd'hui`

---

## UX Coach

La V1 ne crée pas de nouveau dashboard dédié.

Le coach reçoit une notification dans le système existant `coach inbox`, avec badge visible sur le client concerné.

### Données utiles dans la notification

- nom du client
- nom de la séance
- date prévue
- motif guidé sélectionné
- note optionnelle
- horodatage du skip

### Exemple de rendu

`Louis a skippé "Full Body A" prévue aujourd'hui`

Sous-texte :
- `Motif : Fatigue / récupération insuffisante`
- `Note : Nuit très courte, impossible de faire une bonne séance`

### Positionnement produit

Ce signal doit être traité comme un événement d'adhérence ou d'engagement, pas comme une alerte critique de type safety.

---

## Data Model

La V1 doit créer ou enregistrer un **état métier explicite** de séance skippée. Il ne faut pas seulement se reposer sur une notification.

### Données minimales recommandées

```ts
{
  client_id: string
  program_id: string | null
  program_session_id: string
  scheduled_date: string
  status: 'skipped'
  skip_reason_key: string
  skip_note: string | null
  skipped_at: string
  day_override_kind: 'off'
}
```

### Override de jour recommandé

Pour propager la décision au reste du produit, il est recommandé d'ajouter un second enregistrement métier dédié à la qualification de journée, par exemple :

```ts
{
  client_id: string
  date: string
  source: 'session_skip'
  kind: 'off'
  linked_program_session_id: string | null
  created_at: string
}
```

Ce modèle permet :
- de faire primer l'override sur le planning théorique
- d'éviter de recalculer la journée off à partir d'une simple notification
- de brancher proprement nutrition, timeline, smart widgets et futurs moteurs analytiques

### Pourquoi un état dédié

- distinguer `complétée`, `skippée`, `manquée`
- alimenter plus tard les métriques d'adhérence
- éviter les ambiguïtés dans le suivi coach
- garder une trace historique cohérente

---

## Règles Métier

- le skip est autorisé uniquement si la séance n'a pas démarré
- un seul skip est possible par séance planifiée et par date
- une séance complétée ne peut pas être skippée
- un skip ne reprogramme pas la séance automatiquement
- l'action doit créer à la fois l'état de skip et la notification coach
- l'action doit aussi créer un override `jour off global` pour la date concernée
- les lectures métier du type de journée doivent faire passer l'override avant le planning training standard

### Hors scope V1

- pause globale du programme
- report automatique de séance
- email coach
- règles de quota de skip
- adaptation automatique du planning après skip

---

## API / Orchestration Recommandée

### Route cliente dédiée

Créer une action serveur dédiée, par exemple :

`POST /api/client/programme/skip`

**Body recommandé :**

```json
{
  "programSessionId": "uuid",
  "scheduledDate": "2026-05-31",
  "reasonKey": "fatigue_recovery",
  "note": "Nuit très courte"
}
```

### Comportement serveur

1. résoudre le client authentifié
2. vérifier que la séance lui appartient
3. vérifier qu'aucun démarrage de séance n'existe déjà
4. créer l'état `skipped`
5. créer l'override `jour off global` pour la date
6. créer une notification coach structurée dans le système inbox existant
7. retourner l'état mis à jour pour rafraîchir la carte du programme

### Consommateurs de l'override

La V1 doit faire lire cet override au minimum par :
- `/client/programme`
- la logique nutrition du jour si `training / off day` existe
- la timeline ou widgets qui décident si la journée est training ou rest
- les couches de synthèse qui affichent la journée en cours

---

## Analytics / Reporting

En V1, le skip doit être traité comme une séance `non réalisée mais déclarée`.

Cette nuance est utile car elle distingue :
- l'absence silencieuse
- l'impossibilité déclarée
- la séance réellement terminée

La date devient aussi un `off day déclaré`, ce qui autorise plus tard des analyses du type :
- nombre de jours off planifiés vs off déclarés
- cohérence nutrition training/rest
- fréquence des skips sur journées à forte charge

Une évolution future pourra décider si le skip est neutre ou pénalisant dans certains KPI, mais la V1 doit déjà stocker l'information nécessaire.

---

## Risques et Garde-Fous

- **Risque :** banaliser le skip.
  **Réponse :** CTA secondaire, wording sérieux, confirmation explicite.

- **Risque :** bruit coach excessif.
  **Réponse :** inbox + badge seulement, sans email V1.

- **Risque :** confusion entre skip et séance manquée.
  **Réponse :** état métier distinct.

- **Risque :** complexité de replanification prématurée.
  **Réponse :** ne pas reprogrammer automatiquement en V1.

---

## Recommandation Finale

La V1 recommandée est la suivante :

- CTA secondaire sur la séance du jour non démarrée
- bottom sheet de confirmation
- motifs guidés + note optionnelle
- état métier `skipped`
- override `jour off global` pour la date
- notification `coach inbox + badge`
- aucune replanification automatique
- aucun email coach

Cette direction est simple, robuste, compréhensible pour l'utilisateur, et bien alignée avec l'architecture déjà présente dans le projet.
