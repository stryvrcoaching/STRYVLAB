# Inventaire du dépôt STRYV lab

Date de l'audit : 16 juillet 2026  
Périmètre : dépôt principal `/Users/user/Desktop/STRYVLAB`  
Mode initial : audit en lecture seule, suivi d'un premier lot limité aux sorties régénérables et à la reproductibilité du gestionnaire de paquets

## Mise à jour d'exécution — 16 juillet 2026

- Snapshot externe créé dans `/Users/user/Desktop/STRYVLAB_SAFETY_20260716-020913` avec sources courantes, bundle Git complet, patch des fichiers suivis, liste des fichiers non suivis et manifeste SHA-256.
- Bundle restauré dans un clone temporaire ; le patch de travail s'y applique sans erreur.
- Branche locale de sécurité `codex/pre-cleanup-20260716` créée sur le commit `d51b29771cd2cf190ab956d8dbb9e109a41bc058`, sans changer la branche active `main`.
- Les logs du build Vercel de référence confirment pnpm 10.28.0, `pnpm run build`, Next.js 15.5.20 et 245 pages statiques.
- `package.json` fixe maintenant `pnpm@10.28.0`, le lock pnpm a été synchronisé, une installation figée isolée a réussi et `package-lock.json` a été retiré.
- Un build isolé après installation figée a réussi.
- Les 17 dossiers `.next*` de sauvegarde ont été supprimés : 17 194 644 Kio, soit environ 16,40 Gio récupérés. Aucun code applicatif ni asset produit n'a été supprimé.
- Treize fichiers `*.bak` suivis par Git et 61 sauvegardes/métadonnées locales supplémentaires (`*.bak*`, `.DS_Store`) ont été retirés. Le snapshot externe en conserve l'état antérieur.
- Les séries non transparentes `public/food-icons-v2` à `public/food-icons-v7` ont été supprimées après contrôle du Nutrition Studio : les variantes `-transparent` sont celles réellement chargées. Gain total d'environ 106,3 Mio ; build complet réussi après chaque lot.
- La version Node 20.11.1 de `.nvmrc` est désormais trop ancienne pour la chaîne de tests résolue : Rolldown requiert une API Node plus récente. Le typecheck atteint aussi la limite mémoire par défaut. Ces deux points restent une dette d'environnement distincte du nettoyage.

## Verdict exécutif

Le dépôt peut être fortement allégé, mais il ne faut pas commencer par supprimer du code. Le risque principal est l'absence de correspondance démontrée entre l'état local, Git et la production :

- le déploiement Vercel de production est `Ready`, créé le 16 juillet 2026 à 00:52 CEST ;
- le dernier commit local est `d51b29771cd2cf190ab956d8dbb9e109a41bc058`, daté du 13 juillet 2026 ;
- aucun remote Git n'est configuré localement ;
- au début de l'audit, le workspace contenait 455 fichiers modifiés, 2 supprimés et 618 non suivis ;
- les métadonnées Vercel disponibles ne relient pas le déploiement de production à un commit Git.

La priorité est donc de sécuriser l'état courant et de rendre le build reproductible. Après cela, environ 18 à 21 Go de données locales régénérables pourront probablement être retirés sans toucher au produit.

## Volumétrie observée

| Zone | Taille / quantité | Lecture |
|---|---:|---|
| `.git` | 2,3 Go | historique anormalement lourd |
| `node_modules` | 2,7 Go | installation locale incohérente pendant l'audit |
| `.next` | 2,0 Go au début de l'audit | build actif régénérable ; absent après le premier lot |
| 17 dossiers `.next*` de sauvegarde | 16,40 Gio au début de l'audit | supprimés après snapshot et test de restauration |
| `public` | 881 Mo / 1 732 fichiers | assets produit, à traiter avec prudence |
| `tmp` | 377 Mo | principalement sources intermédiaires d'icônes |
| `artifacts` | 36 Mo | captures et sorties d'audit landing |
| `app` | 8,6 Mo | code applicatif principal |
| `components` | 5,5 Mo | composants partagés |
| `lib` | 3,2 Mo | logique métier et infrastructure |
| `docs` | 5,2 Mo / 181 fichiers | documentation active et historique mélangée |
| migrations Supabase | 181 fichiers | historique de production à protéger |
| fichiers conventionnels App Router | 458 | pages, layouts et routes API |

## État Git

- 2 171 fichiers sont suivis dans `HEAD`.
- Les objets Git occupent environ 750 Mio en objets libres et 1,53 Gio en packs.
- L'historique contient d'anciens blobs Webpack provenant de `.next_bak_*`, dont plusieurs font entre 300 et 470 Mo chacun.
- La réduction de `.git` nécessitera une réécriture d'historique distincte ; supprimer les dossiers actuels ne réduira pas les packs historiques.
- Le commit `d370e223` porte le message `restore source from Vercel production deployment F92`, ce qui renforce la nécessité de conserver une sauvegarde externe avant nettoyage.

## Frontières d'architecture

### Produit principal actif

- application Next.js dans `app/` ;
- logique et composants dans `lib/` et `components/` ;
- PWA client sous `app/client/` ;
- landing active : `app/page.tsx` → `components/landing/OperatingSystemLanding.tsx` ;
- Supabase, Stripe, Inngest, crons Vercel et service worker ;
- wrappers Capacitor `android/`, `ios/`, `capacitor.config.ts` et fallback `out/index.html`.

### Sous-ensembles à clarifier

- `stryvr/` est un projet React Native/Expo séparé, suivi par Git, alors que l'expérience client actuelle existe aussi dans `app/client/` et Capacitor. Il faut décider s'il est actif, historique ou à extraire dans un autre dépôt.
- `app/stryvr/` expose une landing bêta distincte. Elle reste une route publique et possède une action Supabase ; elle ne doit pas être supprimée sans décision produit.
- `framework/` est un dépôt Git imbriqué autonome nommé `aidd-framework`. Il est non suivi par le dépôt principal et n'appartient pas à l'application STRYV lab.
- `.agents/`, `.codex/`, `.claude/` et `.aidd/` sont des outils de développement/agents, pas du runtime produit. Leur politique de versionnement doit être explicite.

## Assets

- `public/bibliotheque_exercices` pèse environ 638 Mo et est activement référencé par `data/exercise-catalog.json` et les générateurs de catalogue.
- Deux GIF identiques de 101 861 810 octets existent sous deux noms d'exercice différents. Ce cas représente à lui seul environ 97 Mio de duplication dans le workspace.
- Sur l'ensemble de `public`, 151 groupes de contenu identique ont été trouvés, soit 201 copies supplémentaires et un potentiel théorique d'environ 183 Mio.
- Ces doublons ne sont pas directement supprimables : les chemins ont une valeur métier et sont référencés par le catalogue.
- Les répertoires transparents `food-icons-v2-transparent` à `food-icons-v25-transparent` sont réellement référencés par `components/nutrition/FoodIcon.tsx`.
- Les anciennes séries non transparentes `food-icons-v2` à `food-icons-v7` semblent ne plus être référencées et constituent un candidat séparé à confirmer.

## Dépendances

- 85 dépendances directes sont déclarées.
- pnpm 10.28.0 est le gestionnaire confirmé par les logs de production et fixé dans `package.json`.
- `pnpm-lock.yaml` a été synchronisé ; une installation isolée avec lock figé réussit.
- Le lockfile npm concurrent a été retiré après cette validation.
- L'audit recalculé du lock pnpm synchronisé signale 14 vulnérabilités hautes, 11 modérées, 3 faibles et aucune critique. pnpm 10.28.0 rencontre désormais un endpoint npm retiré ; la lecture a été refaite sans mutation avec le moteur pnpm 11.7.0.
- Licences directes à examiner : licence standard GSAP, MPL-2.0 pour `@capgo/capacitor-health` et `web-push`, licence spécifique de `@calcom/embed-react`.

### Dépendances sans référence statique observée

Liste candidate, avec validation manuelle obligatoire :

- `@react-three/drei`
- `@react-three/fiber`
- `@react-three/postprocessing`
- `postprocessing`
- `react-hook-form`
- `@hookform/resolvers`
- `@dnd-kit/modifiers`
- `@radix-ui/react-slot`
- `@radix-ui/react-tooltip`
- `canvas-confetti`
- `lenis`
- `nodemailer`
- `@vercel/speed-insights`
- `react-is`

Les paquets Capacitor, Tailwind, ESLint, TypeScript et leurs plugins ne doivent pas être jugés uniquement par recherche d'import : plusieurs sont chargés implicitement par les outils ou les plateformes natives.

## Baseline de validation

Une validation isolée a été tentée sans réutiliser le `node_modules` du workspace :

- installation pnpm non figée : réussie ;
- fichiers de tests : 188 réussis, 9 échoués, 1 ignoré ;
- tests : 1 226 réussis, 28 échoués, 1 ignoré ;
- 6 erreurs supplémentaires étaient liées au binaire natif `canvas`, volontairement non construit dans l'installation d'audit avec scripts désactivés ;
- le typecheck n'a pas terminé dans une première fenêtre de plus de cinq minutes ; sous Node 20.11.1, une seconde tentative a atteint la limite mémoire par défaut ;
- un build isolé avec pnpm 10.28.0 et lock figé a ensuite réussi ;
- sous Node 20.11.1, la chaîne Vitest/Rolldown actuelle échoue au démarrage car cette version de Node n'expose pas l'API `node:util` attendue ;
- le build Vercel de production, lui, est `Ready`, mais `next.config.js` ignore actuellement les erreurs TypeScript et ESLint pendant le build.

Les échecs observés constituent la dette de départ. Ils ne doivent pas être attribués aux futures suppressions.

## Limites de cet audit

- aucune preuve ne relie encore la production au commit local ;
- les références dynamiques stockées en base ne peuvent pas être détectées uniquement par recherche locale ;
- React Doctor n'a pas produit de rapport exploitable : le scan multi-projets s'est figé et a été arrêté sans correction ;
- le scanner externe de licences a refusé son installation avec une erreur d'intégrité de son propre paquet ; aucune protection n'a été contournée ;
- aucune migration, donnée Supabase, configuration Vercel ou variable d'environnement n'a été modifiée.
