# Plan de nettoyage sécurisé

## Principe

Chaque phase doit être réversible et livrée séparément. Aucune phase ne commence si son gate d'entrée n'est pas satisfait.

## Gate 0 — Sauvegarde et vérité de production

Objectif : rendre impossible la perte du code actuellement utile.

1. enregistrer le déploiement Vercel de référence et ses parcours critiques ;
2. créer une sauvegarde externe du workspace, y compris les sources non suivies ;
3. conserver les secrets hors de Git et chiffrer toute sauvegarde qui les contient ;
4. créer un remote Git privé fiable ;
5. créer un tag/une branche `pre-cleanup-20260716` ;
6. produire un commit WIP contrôlé contenant les sources utiles, sans caches ni backups générés ;
7. confirmer que le snapshot peut être restauré dans un dossier vide.

Sortie attendue : code courant récupérable indépendamment de Vercel et du Mac local.

État : snapshot externe, bundle Git, manifeste d'intégrité, test de restauration et branche locale de sécurité terminés. Un remote privé et un commit WIP contrôlé restent à créer ; ils ne peuvent pas être déduits automatiquement sans destination Git autorisée.

## Phase 1 — Rendre le projet reproductible

Objectif : obtenir une installation identique en local, CI et Vercel.

1. choisir un seul gestionnaire de paquets ;
2. préférence d'audit : pnpm, car le dépôt possède `pnpm-lock.yaml`, `pnpm-workspace.yaml` et des politiques de supply chain ; confirmer ce choix avec les logs de build Vercel ;
3. régénérer et valider le lockfile choisi ;
4. supprimer l'autre lockfile seulement après validation ;
5. ajouter le champ `packageManager` dans `package.json` ;
6. exiger une installation figée en CI ;
7. recalculer audit de vulnérabilités et licences ;
8. établir la baseline tests/typecheck/build ;
9. décider si les 28 échecs existants sont corrigés immédiatement ou enregistrés comme dette temporaire ;
10. retirer progressivement `ignoreBuildErrors` et `ignoreDuringBuilds` lorsque la baseline le permet.

Gate de sortie : installation figée, typecheck terminé, build réussi et résultat des tests archivé.

État : pnpm 10.28.0 confirmé par Vercel, lock synchronisé, installation figée et build isolé réussis, lock npm retiré. Le gate reste partiellement ouvert pour la baseline Node/typecheck : `.nvmrc` 20.11.1 est incompatible avec la chaîne Vitest/Rolldown actuelle et le typecheck dépasse la mémoire par défaut.

## Phase 2 — Nettoyage local régénérable

Objectif : récupérer rapidement environ 18 Go sans toucher au comportement produit.

Lot proposé :

- supprimer les 17 `.next*` de sauvegarde ;
- supprimer `.next` ;
- exporter ou supprimer `artifacts/` ;
- trier `tmp/`, conserver uniquement les sources maîtres réellement nécessaires hors du tronc ;
- supprimer `.DS_Store` et caches TypeScript ;
- supprimer puis réinstaller `node_modules` uniquement après réussite du Gate de phase 1 ;
- compléter `.gitignore` pour couvrir `.next_bak_*`, `.next_build_backup_*`, `tmp/`, `artifacts/`, backups et caches ;
- compléter `.vercelignore` pour exclure les outils agents, docs historiques et artefacts non runtime.

Validation : le diff applicatif doit être nul ; une installation propre doit reproduire le build.

État des premiers lots : 17 sorties `.next*` supprimées, 16,40 Gio récupérés, puis sauvegardes `*.bak*` et métadonnées `.DS_Store` retirées. Aucun fichier applicatif actif ou asset produit touché. `tmp/`, `artifacts/` et `node_modules` sont volontairement conservés pour les lots suivants.

## Phase 3 — Déchets historiques et documentation

Lots séparés :

1. fichiers `.bak` ;
2. scripts `patch-*`, `extract-*` et audits café ;
3. suppression de `cleanup.sh`, `pages/dummy.tsx` et `mkdir -p lib:i18n/` ;
4. déplacement de `framework/` hors du dépôt ;
5. classement de la documentation ;
6. suppression des plans/prompts périmés après validation métier.

Validation : recherche globale des noms supprimés, tests documentaires éventuels, build Preview.

## Phase 4 — Code et dépendances morts

1. supprimer les landing alternatives non importées dans un premier lot ;
2. retirer les dépendances sans référence par groupes fonctionnels ;
3. retirer les types associés devenus inutiles ;
4. exécuter installation figée, audit, tests, typecheck et build après chaque lot ;
5. vérifier la taille du bundle avant/après.

Un paquet implicitement chargé par Capacitor, Tailwind, ESLint, Next.js ou une configuration ne doit pas être retiré sur la seule base d'une recherche d'import.

## Phase 5 — Assets

1. produire le graphe `URL → code/catalogue/base → fichier` ;
2. supprimer les séries d'icônes non transparentes réellement inutilisées ;
3. choisir un chemin canonique pour chaque doublon d'exercice ;
4. migrer les références avant suppression ;
5. compresser les GIF/vidéos démesurés ;
6. valider les PDF, previews, exports et interfaces coach/client.

Cette phase peut faire gagner plusieurs centaines de mégaoctets, mais elle est plus risquée que le nettoyage des caches.

## Phase 6 — Décision STRYVR

Décider explicitement du sort de :

- `stryvr/` React Native/Expo ;
- `app/stryvr/` landing bêta ;
- PWA actuelle `app/client/` ;
- wrappers Capacitor `android/` et `ios/`.

Si plusieurs produits restent actifs, formaliser un monorepo. Sinon, extraire ou archiver les produits abandonnés avec leur historique.

## Phase 7 — Réduction de l'historique Git

À effectuer en dernier :

1. sauvegarder le remote et créer un bundle Git ;
2. mesurer les blobs historiques ciblés ;
3. retirer `.next*` et autres artefacts générés avec `git filter-repo` ;
4. lancer `git fsck` et vérifier un clone neuf ;
5. reconstruire et tester ;
6. coordonner le force-push et le reclone.

## Organisation des changements

Branches/PR recommandées :

1. `chore/cleanup-safety-baseline`
2. `chore/cleanup-package-manager`
3. `chore/cleanup-generated-artifacts`
4. `chore/cleanup-legacy-files`
5. `docs/cleanup-history`
6. `chore/cleanup-unused-dependencies`
7. `refactor/assets-canonicalization`
8. opération exceptionnelle de réécriture Git

Chaque PR doit annoncer : gain de taille, preuves d'inutilisation, tests exécutés, impact attendu, procédure de rollback.

## Ordre de priorité recommandé

1. sécuriser et versionner l'état actuel ;
2. choisir le package manager et réparer le lockfile ;
3. nettoyer les 16,40 Gio de backups Next ;
4. retirer les backups/scripts historiques ;
5. nettoyer la documentation ;
6. retirer code et dépendances morts ;
7. consolider les assets ;
8. décider de la séparation STRYVR ;
9. réécrire l'historique Git.
