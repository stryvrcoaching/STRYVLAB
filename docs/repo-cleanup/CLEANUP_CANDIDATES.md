# Candidats de nettoyage

Les statuts ci-dessous suivent l'audit et le journal d'exécution. Le seul lot supprimé à ce stade concerne les sorties Next.js régénérables, après snapshot restaurable.

## P0 — Régénérable, très forte confiance

| Candidat | Preuve | Gain estimé | Risque | Action proposée |
|---|---|---:|---|---|
| 17 sauvegardes `.next*` | anciens caches/builds, exclus par `.vercelignore` | 16,40 Gio | faible après snapshot | **fait** — supprimés, exclusion Git renforcée |
| `.next` actif | sortie de build Next.js | 2,0 Go observés pendant l'audit | faible | **fait** — absent après le lot, à régénérer à la demande |
| `artifacts/` | captures et sorties d'audit landing, non suivies | 36 Mo | faible | exporter hors dépôt ou supprimer |
| `.DS_Store` | métadonnées macOS | faible | nul | **fait** — supprimés et ignorés |
| `*.tsbuildinfo` | caches TypeScript | faible | nul | supprimer ; désindexer `stryvr/tsconfig.tsbuildinfo` |

`node_modules` reste localement présent. Le lockfile officiel et l'installation figée sont maintenant validés, mais sa suppression est différée pour ne pas rendre l'environnement de développement immédiatement inutilisable.

## P1 — Déchets historiques à forte confiance

| Candidat | Preuve | Risque | Action proposée |
|---|---|---|---|
| fichiers `*.bak*` | sauvegardes manuelles parallèles au code courant | faible | **fait pour le lot inventorié** — 13 suivis et les copies locales retirés après snapshot |
| scripts `patch-*`, `extract-*`, audits café et extraits `.txt` à la racine | scripts ponctuels datés de juin 2026 | faible | supprimer ou archiver hors dépôt |
| `cleanup.sh` | ancien script « VIRTUS SMART FIT », chemins obsolètes et suppressions destructives | faible | supprimer ; ne jamais l'exécuter |
| `framework/` | dépôt autonome `aidd-framework` avec son propre `.git` | faible | déplacer hors du dépôt STRYV lab |
| `pages/dummy.tsx` | page factice non suivie, App Router utilisé | faible | supprimer |
| `mkdir -p lib:i18n/` | répertoire accidentel nommé comme une commande, aucune référence | faible | supprimer |
| `tmp/` | 377 Mo de sources intermédiaires d'icônes et feuilles d'audit | faible à moyen | garder un master utile hors dépôt, supprimer le reste |

## P2 — Code et dépendances probablement morts

### Landing

- `components/landing/CoachWorkflowLanding.tsx` : aucune importation observée.
- `components/landing/SaasLanding.tsx` : aucune importation observée.
- `components/landing/LiquidGlassEffect.tsx` : utilisé seulement par `SaasLanding.tsx`, lui-même inutilisé.
- `components/landing/OperatingSystemLanding.tsx` : **protégé**, importé par `app/page.tsx`.

Ces trois premiers fichiers peuvent former un lot de suppression après build Preview et contrôle visuel de `/`.

### Dépendances

Les 14 paquets listés dans `REPO_INVENTORY.md` n'ont aucune référence statique observée. Ils doivent être retirés un par un ou par petits groupes cohérents, avec installation figée, tests, typecheck et build après chaque lot.

### Documentation historique

- `docs/superpowers/plans` contient 90 plans.
- `docs/superpowers/specs` contient 73 spécifications.
- Plusieurs documents racine et documents `docs/` décrivent les visions GENESIS, VIRTUS SMART FIT ou d'anciennes phases STRYVR.

Politique proposée :

1. conserver les décisions encore vraies et les runbooks opérationnels ;
2. convertir les décisions structurantes en ADR courts ;
3. déplacer l'historique utile dans une archive externe ou une branche/tag dédiée ;
4. supprimer du tronc les plans terminés, prompts ponctuels et comptes rendus périmés.

## P3 — Assets à consolider, pas à supprimer en masse

| Zone | Constat | Action sûre |
|---|---|---|
| `public/bibliotheque_exercices` | actif, lourd et partiellement dupliqué | créer une table de chemins canoniques, mettre à jour le catalogue, puis dédupliquer |
| séries `food-icons-*-transparent` | actives dans `FoodIcon.tsx` | ne pas supprimer sans migration de mapping |
| séries non transparentes `food-icons-v2` à `v7` | aucune référence applicative ; variantes transparentes validées dans Nutrition Studio | **fait** — 153 fichiers supprimés, environ 106,3 Mio récupérés, build réussi après chaque lot |
| `public/images` | plusieurs fonds et variantes non nommées clairement | produire un inventaire références → fichiers avant suppression |
| `public/videos` | vidéo hero et fond client | vérifier usage, compression et fallback avant changement |

## P4 — Séparation de produits

### `stryvr/`

Ce dossier contient un projet React Native/Expo distinct. Trois décisions sont possibles :

1. actif : le conserver mais le transformer en workspace explicite ;
2. actif mais indépendant : l'extraire dans un dépôt STRYVR ;
3. abandonné : le taguer/archiver puis le supprimer du tronc.

Il ne faut pas le supprimer sur la seule base de l'absence d'import depuis l'application Next.js.

### `app/stryvr/`

Cette route publique possède une landing bêta et une action serveur Supabase. Elle doit faire l'objet d'une décision commerciale : maintien, redirection ou retrait contrôlé.

## P5 — Historique Git

L'historique contient de très gros blobs `.next_bak_*`. Après stabilisation du repo :

- créer une sauvegarde complète du dépôt ;
- prévenir tous les contributeurs ;
- utiliser `git filter-repo` pour retirer les chemins `.next*` historiques et les blobs générés ;
- pousser l'historique réécrit uniquement après validation ;
- demander un reclone à tous les contributeurs.

Cette opération réduit le poids Git mais ne doit jamais être mélangée avec les suppressions applicatives.
