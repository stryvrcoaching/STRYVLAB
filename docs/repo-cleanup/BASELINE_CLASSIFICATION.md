# Classification de la baseline courante

Date : 16 juillet 2026  
Objectif : déterminer ce qui doit entrer dans une baseline Git restaurable avant tout nettoyage applicatif supplémentaire.

## Décision exécutive

L'état courant ne doit pas être traité comme un ensemble de déchets. Le workspace contient une version produit beaucoup plus récente que `HEAD`, avec de nombreuses routes, migrations, interfaces, tests et ressources encore non suivis.

La baseline doit donc conserver par défaut tout le runtime courant. Seuls les caches, extractions, sauvegardes ponctuelles et fichiers explicitement privés doivent être exclus. Le code ou les assets ambigus restent en attente de validation ; ils ne sont pas supprimés.

## Photographie Git

Au moment de la classification :

- 455 fichiers suivis modifiés ;
- 16 fichiers suivis supprimés, dont 13 sauvegardes `.bak`, le lockfile npm retiré pendant le nettoyage, ainsi que `app/icon.svg` et `public/favicon.ico` déjà supprimés avant ce lot ;
- 2 393 fichiers non suivis avant ajout des nouvelles protections `.gitignore` ;
- environ 343 Mo de fichiers non suivis visibles, sans compter les contenus du dépôt imbriqué `framework/` ;
- 129 fichiers de convention Next.js non suivis (`page`, `layout`, `route`, etc.) ;
- 70 migrations Supabase non suivies ;
- 82 tests non suivis ;
- 53 fichiers Android et 23 fichiers iOS non suivis ;
- 1 164 assets publics non suivis, pour environ 317 Mo.

Ces chiffres prouvent que `HEAD` n'est pas une représentation suffisante du produit courant.

## A — À conserver dans la baseline produit

### Runtime et logique métier

Conserver par défaut :

- `app/` : 183 fichiers suivis modifiés et 134 fichiers non suivis ;
- `components/` : 144 fichiers suivis modifiés et 67 fichiers non suivis ;
- `lib/` : 69 fichiers suivis modifiés et 156 fichiers non suivis ;
- `utils/`, `hooks/`, middleware et configurations Next.js ;
- `data/exercise-catalog.json` et les scripts qui construisent réellement ce catalogue ;
- les fichiers de configuration runtime et les exemples d'environnement sans secret.

Motif : le build isolé réussit avec cet état et les logs Vercel montrent que des fichiers non suivis, notamment `/dummy`, ont été inclus dans le déploiement de référence.

### Base de données et backend

Conserver :

- les 70 migrations nouvelles sous `supabase/migrations/` ;
- les migrations suivies déjà modifiées ;
- les routes API, webhooks, crons et fonctions Inngest ;
- les politiques de sécurité, confidentialité et suppression de compte.

Les migrations ne doivent jamais être nettoyées sur la seule base de leur ancienneté.

### Tests

Conserver les 82 tests non suivis et les 27 tests modifiés. La baseline comporte déjà des échecs connus, mais supprimer les tests ferait perdre la capacité de distinguer dette antérieure et régression future.

### Mobile et PWA

Conserver :

- `android/` et `ios/` ;
- `capacitor.config.ts` ;
- `out/index.html` ;
- manifest, service worker et icônes PWA ;
- l'expérience `app/client/`.

Les wrappers sont explicitement reliés au projet Capacitor actuel.

### Assets protégés

Conserver sans déduplication immédiate :

- `public/bibliotheque_exercices/` : 500 nouveaux fichiers visibles, environ 68 Mo, reliés au catalogue d'exercices ;
- `public/landing-demo/` ;
- `public/videos/client-dashboard-bg.mp4`, référencé par deux interfaces client ;
- `public/images/currency/stryvr-token.png`, référencé par les composants de récompenses ;
- toutes les séries `food-icons-*-transparent`, directement mappées par `components/nutrition/FoodIcon.tsx` ;
- les polices, logos et icônes PWA référencés par les metadata et manifests.

Les chemins Git affichés entre guillemets dans la bibliothèque d'exercices correspondent à l'échappement de noms accentués ou contenant des espaces ; ce ne sont pas des chemins malformés.

### Documentation de référence

Conserver :

- `AGENTS.md` ;
- `LANDING_BRIEF.md` ;
- `docs/DESIGN_SYSTEM_V2.0_REFERENCE.md` et les tokens actifs de `app/globals.css` ;
- `SECURITY_PRIVACY_BASELINE.md` ;
- `docs/privacy/` ;
- `docs/repo-cleanup/`.

## B — À conserver hors du commit produit ou dans un commit outillage séparé

| Zone | Volume observé | Décision |
|---|---:|---|
| `.codex/` | 178 fichiers, 3,3 Mo | outils, skills et workflows ; commit séparé seulement s'ils sont volontairement partagés |
| `.agents/` | 31 fichiers, 432 Ko | skills locaux ; ne pas mélanger au runtime |
| `.aidd/` | 2 fichiers visibles | configuration d'agent ; décision d'équipe |
| `.claude/` | 2 fichiers visibles | configuration d'outil ; décision d'équipe |
| `skills-lock.json` | 3 Ko | lock d'outillage ; associer au commit des skills, pas à la baseline runtime |

Ces fichiers ne sont pas des déchets, mais ils ne doivent pas rendre le déploiement produit dépendant d'un environnement d'agent local.

## C — À archiver ou supprimer après la baseline

| Candidat | Preuve | Action proposée |
|---|---|---|
| `.tmp/aidd/` | 308 fichiers issus d'une archive marketplace extraite | supprimer après snapshot ; désormais ignoré |
| `supabase/.temp/` | 8 fichiers de versions et référence locale de CLI | supprimer à la demande ; désormais ignoré |
| `framework/` | dépôt Git imbriqué autonome, 8,7 Mo | déplacer hors de STRYVLAB ; désormais ignoré |
| `tmp/` | 377 Mo de sources/intermédiaires | sélectionner les éventuels masters, archiver hors dépôt, puis supprimer |
| `artifacts/` | 35 Mo de captures et sorties d'audit | déplacer dans l'archive externe ou supprimer |
| audits `cafe-*` et `audit-cafe-*` à la racine | sorties ponctuelles datées, environ 18,6 Mo | archiver hors dépôt puis supprimer |
| scripts `patch-*`, `extract-*`, `find-cafe-*` | scripts ponctuels de juin 2026 | archiver ou supprimer après contrôle de la version finale |
| `cleanup.sh` | ancien script VIRTUS destructif et obsolète | supprimer dans un lot séparé ; ne jamais exécuter |

Les éléments de cette section sont conservés dans le snapshot externe actuel. Aucune suppression supplémentaire n'a été faite pendant cette classification.

## D — À vérifier avant décision

### Anciennes icônes alimentaires non transparentes

Les dossiers non transparents `food-icons-v2` à `food-icons-v7` ont été supprimés après validation :

- zéro référence statique vers les chemins sans suffixe ;
- la base utilise une `icon_key`, ensuite résolue par le composant vers un asset transparent ;
- contrôle réel du Nutrition Studio en production : V2 transparent chargé pour la salade/pomme, V3 pour les champignons, V4 pour la feta, V5 pour l'artichaut, V6 pour l'abricot et V7 pour la macadamia ;
- les 150 icônes possédaient un homologue de même nom dans les dossiers `-transparent` ; les trois fichiers supplémentaires étaient des planches sources `sprite-source.png` ;
- comparaison bit à bit réussie avec le snapshot externe avant suppression ;
- build de production local réussi après suppression, avec 247 pages statiques générées.

Gain total : 108 868 Kio, soit environ 106,3 Mio pour 153 fichiers. Les dossiers transparents V2 à V7 restent protégés : 30, 30, 30, 20, 20 et 20 fichiers respectivement.

Le dossier générique non transparent `food-icons/` reste à vérifier séparément : 8 fichiers et environ 739 Ko. Le composant actif utilise actuellement `food-icons-transparent/`.

### Favicons déjà supprimés

`app/icon.svg` et `public/favicon.ico` étaient déjà supprimés au début du nettoyage. Les metadata actuelles pointent vers `/images/logo.png`, `/icon-192.png`, `/icon-512.png` et `/apple-touch-icon.png`, ce qui rend ces suppressions plausibles.

Décision proposée : vérifier `/favicon.ico`, les metadata générées et l'installation PWA sur Preview avant de valider définitivement leur retrait.

### Route `/dummy`

`pages/dummy.tsx` semble factice, mais les logs Vercel prouvent qu'elle faisait partie du build de production de référence. Elle reste à vérifier, puis à retirer uniquement dans un lot avec Preview.

### Documentation historique

Les 24 nouveaux documents de `docs/superpowers/` et les nombreux plans/specs déjà présents mélangent historique utile et instructions périmées.

Décision proposée : conserver les décisions durables sous forme d'ADR ou de runbook, puis déplacer le reste vers une archive dédiée.

### STRYVR

`stryvr/`, `app/stryvr/`, `app/client/` et les wrappers Capacitor ne doivent pas être fusionnés ou supprimés sans décision produit explicite.

### Scripts opérationnels

`run_migration.js` doit être revu avant commit : il peut être utile, mais un script de migration manuel peut aussi contourner le processus Supabase attendu.

## E — À ne jamais committer

- fichiers `.env*` réels ;
- `benchmarks/nutrition-scan/sources/private-sessions.json`, explicitement privé et désormais ignoré ;
- caches et références locales `supabase/.temp/` ;
- `.tmp/`, `tmp/`, `artifacts/` ;
- `node_modules/`, `.next*`, `.DS_Store`, `*.bak*` ;
- secrets, clés, certificats ou exports de base.

Le scan des noms n'a trouvé aucun certificat ou fichier de clé non suivi. Il a trouvé le benchmark privé ci-dessus ; son contenu n'a pas été exposé dans le rapport.

## Composition recommandée de la baseline Git

### Simulation réalisée

Une simulation sans staging a produit la sélection suivante :

- 471 changements sur des fichiers déjà suivis ;
- 1 822 fichiers non suivis candidats ;
- 2 293 chemins uniques au total ;
- environ 319 Mo pour les seuls nouveaux fichiers candidats, principalement dans `public/`.

La sélection inclut le produit, les tests, les migrations, les wrappers mobiles, les assets protégés et la documentation de référence. Elle exclut l'outillage agent, les audits CAFE racine, les extractions, caches et données privées.

Le contrôle de secrets à haute confiance n'a trouvé aucune clé exploitable. `env.production.example` a déclenché une alerte initiale, puis a été confirmé comme faux positif : valeur tronquée avec points de suspension, structure JWT invalide et valeur déjà identique dans `HEAD`.

Aucun fichier n'avait été stagé pendant cette simulation initiale.

### Baseline préparée dans l'index Git

Après validation de la simulation, la sélection a été préparée sur la branche
`codex/pre-cleanup-20260716` :

- 2 142 fichiers stagés ;
- 1 670 ajouts, 455 modifications et 17 suppressions ;
- 70 nouvelles migrations Supabase, toutes présentes, non vides et sans doublon de nom ;
- aucun fichier supérieur à 50 Mio ; le plus volumineux ajouté est la vidéo client de 4,7 Mo ;
- aucun cache, outil agent, benchmark privé, artefact ou dépôt imbriqué stagé ;
- un seul changement suivi volontairement hors staging : `stryvr/tsconfig.tsbuildinfo`, cache TypeScript généré ;
- aucun secret à haute confiance détecté. Les alertes dans `README.md` et
  `env.production.example` correspondent à des placeholders invalides, pas à des jetons exploitables ;
- 12 tests sécurité ciblés réussis ;
- build complet réussi après le nettoyage des icônes et l'intégration des derniers
  templates email, avec 247 pages générées.

Les fichiers non suivis `DESIGN_SYSTEM_IMPLEMENTATION.md` et `DESIGN_SYSTEM_v5.md`,
visibles au début de l'audit, n'étaient plus présents au moment du staging. Les
sources de référence actuelles restent `docs/DESIGN_SYSTEM_V2.0_REFERENCE.md`,
`tailwind.config.ts` et `app/globals.css`.

### Baseline fonctionnelle

Inclure les sources et ressources nécessaires au produit courant : `app`, `components`, `lib`, `hooks`, `utils`, `data`, `tests`, migrations, configurations, Android/iOS, assets protégés et documentation opérationnelle.

### Exclusions

Exclure tous les éléments des sections C et E. Ne pas inclure l'outillage de la section B sans décision explicite.

### Validation avant commit

1. vérifier la liste staged et l'absence de secrets ;
2. confirmer que les 70 migrations non suivies sont intentionnelles et ordonnées ;
3. conserver le résultat de l'installation figée et du build isolé ;
4. créer le commit sur une branche dédiée, pas directement sur `main` ;
5. pousser vers un remote privé ;
6. construire une Preview Vercel ;
7. tester les parcours critiques avant toute nouvelle suppression.

## Prochain lot recommandé

Créer le commit local de baseline, puis configurer un remote privé avant toute
nouvelle suppression à risque moyen ou élevé.
