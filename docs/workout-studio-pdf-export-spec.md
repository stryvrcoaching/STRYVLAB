# Workout Studio — Export PDF programmes & templates

## Objectif

Ajouter une feature d’export PDF dans le Workout Studio pour :

- prévisualiser un programme avant export
- télécharger le PDF
- partager le PDF par e-mail
- réutiliser le même socle pour les programmes client et les templates

Le rendu doit être propre, structuré, cohérent avec la marque, et exploitable directement par le client final.

## Périmètre validé

### Contextes couverts

1. **Programme lié à un client**
   - bouton `Enregistrer en PDF`
   - ouverture d’un modal avec prévisualisation
   - action `Télécharger`
   - action `Partager`
   - `Partager` envoie le PDF par e-mail au client déjà lié au programme

2. **Template de programme**
   - bouton `Enregistrer en PDF`
   - ouverture d’un modal avec prévisualisation
   - action `Télécharger`
   - action `Partager`
   - `Partager` permet de sélectionner un ou plusieurs clients, puis envoie le PDF par e-mail

### Hors périmètre

- automatisations d’envoi récurrent
- autres formats d’export
- éditeur de mise en page PDF

## Expérience utilisateur

### Entrée

Ajouter un bouton `Enregistrer en PDF` dans les actions d’un programme et d’un template.

### Modal

Le flux reste dans un modal unique à deux états :

1. **Prévisualisation**
   - aperçu du PDF final
   - boutons `Télécharger` et `Partager`

2. **Partage**
   - même modal, vue secondaire
   - retour possible vers la prévisualisation
   - conservation du contexte

### Variante programme client

- destinataire prérempli avec le client lié
- si l’e-mail du client est absent :
  - action `Partager` désactivée ou bloquée
  - message clair indiquant que l’adresse e-mail doit être renseignée
- champ `Message personnalisé`
- CTA `Envoyer le PDF`

### Variante template

- sélection d’un ou plusieurs clients
- seuls les clients avec e-mail valide sont éligibles à l’envoi
- champ `Message personnalisé`
- CTA `Envoyer à X client(s)`

### Feedback attendu

- téléchargement réussi
- envoi réussi
- échec clair si aucun destinataire valide
- envoi multi-clients avec retour partiel si nécessaire

## PDF — structure validée

### Positionnement

PDF **client-facing hybride** :

- lisible et épuré
- conserve les consignes avancées réellement utiles
- évite les métadonnées internes trop techniques

### Structure

1. **Intro compacte**
2. **Détail par séance**

### En-tête éditorial

L’en-tête doit afficher :

- marque STRYV / Protocole
- titre du programme
- nom du client
- nom du coach
- date d’édition
- courte note d’usage

### Contenu du document

#### Intro compacte

- nom du programme
- description courte si disponible
- durée / nombre de semaines
- fréquence si disponible
- tags utiles si pertinents
- note d’usage concise

#### Blocs séance

Pour chaque séance :

- nom de la séance
- ordre cohérent
- éventuelles notes de séance

Pour chaque exercice :

- nom
- image si disponible
- séries
- répétitions
- repos
- tempo si utile
- RIR si utile
- notes utiles pour le client

### Règles d’affichage

- si une image manque, le PDF reste propre et exploitable
- si un champ avancé n’apporte pas de valeur client, ne pas l’afficher
- la preview doit correspondre au PDF téléchargé et envoyé

## E-mail — comportement validé

### Mode d’envoi

- le PDF est envoyé en **pièce jointe**
- pas de simple lien comme mécanisme principal

### Corps d’e-mail

Le mail doit être enrichi mais sobre.

Contenu attendu :

- branding léger
- message indiquant que le coach a envoyé un programme PDF
- message personnalisé du coach
- formulation claire pour ouvrir la pièce jointe

### Message personnalisé

Le coach peut saisir un message personnalisé avant l’envoi.

### Envoi multi-clients

Pour les templates :

- un envoi par destinataire
- permet une meilleure traçabilité
- permet de gérer les échecs partiels proprement

## Architecture recommandée

## Recommandation retenue

Utiliser une **génération serveur unifiée** du PDF.

### Pourquoi

- même source pour preview, téléchargement et e-mail
- fidélité de rendu
- meilleure robustesse multi-pages
- intégration propre des images
- cohérence avec l’existant `@react-pdf/renderer`

### Composants/éléments attendus

#### 1. Socle PDF unique

Créer un composant dédié, par exemple :

- `lib/pdf/program.tsx`

Responsabilité :

- recevoir des données normalisées
- produire le document PDF
- servir de source unique pour preview / download / email

#### 2. Couche de normalisation

Créer une couche qui aligne les données `program` et `template` sur un format commun.

Objectif :

- un seul rendu PDF
- deux contextes de données

#### 3. Modal réutilisable

Créer un composant UI réutilisable pour :

- le mode `program`
- le mode `template`

#### 4. Routes serveur

Prévoir :

- génération/preview PDF programme
- génération/preview PDF template
- envoi mail programme
- envoi mail template

Une implémentation commune peut être utilisée derrière ces points d’entrée.

#### 5. Template e-mail

Créer un template e-mail dédié pour l’envoi du programme PDF avec :

- coach
- client
- nom du programme
- message personnalisé
- pièce jointe PDF

## Données nécessaires

### Programme / template

- métadonnées principales
- séances triées
- exercices triés

### Champs client-facing prioritaires

- nom
- sets / reps
- rest
- tempo
- RIR utile
- notes
- images d’exercices

### Contexte relationnel

- coach
- client lié au programme
- clients sélectionnés pour le template

## Validations produit

### Bloquants

Bloquer `Partager` si :

- aucun destinataire valide
- e-mail absent dans le contexte programme client
- programme ou template vide
- PDF non générable

### Avertissements non bloquants

- image absente
- certains champs avancés non renseignés

## Cas limites

- programme sans image
- programme très long multi-pages
- client sans e-mail
- template envoyé à plusieurs clients
- échec partiel sur un envoi multi-clients
- double clic sur `Envoyer`

## Stratégie de test

### Tests unitaires

- normalisation des données programme/template
- règles d’affichage des champs client-facing

### Tests d’intégration

- routes PDF
- routes d’envoi e-mail

### Vérification manuelle

- fidélité preview / PDF final
- qualité visuelle multi-pages
- rendu images
- envoi simple programme client
- envoi multi-clients template

## Assumptions

- la génération serveur est acceptable en latence produit
- les images d’exercices sont accessibles par le moteur PDF
- seuls les coachs autorisés peuvent générer et envoyer ces PDF
- le premier jet peut rester sobre visuellement tant que la hiérarchie de lecture est solide

## Decision log

- PDF : **hybride client-facing**
- structure : **intro compacte + détail par séance**
- modal : **prévisualisation + télécharger + partager**
- sharing programme client : **e-mail direct au client lié**
- sharing template : **sélection d’un ou plusieurs clients**
- envoi : **pièce jointe PDF**
- message d’e-mail : **personnalisable**
- images d’exercices : **incluses**
- architecture : **génération serveur unifiée**
- flux UI : **un modal à deux états**

## Prochaine phase

### Implémentation recommandée

1. ajouter le socle PDF serveur
2. ajouter la normalisation programme/template
3. ajouter le modal de preview
4. brancher le téléchargement
5. brancher le partage programme client
6. brancher le partage template
7. ajouter le template e-mail
8. valider les cas limites
