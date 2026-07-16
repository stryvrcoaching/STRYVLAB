# Chemins critiques de production

## Référence opérationnelle

- domaine inspecté : `stryvlab.com` ;
- déploiement Vercel : `dpl_9yHyqiBTTvrGXuiCjZvZcuRYrgHb` ;
- cible : production ;
- état pendant l'audit : `Ready` ;
- création : 16 juillet 2026 à 00:52 CEST ;
- association à un commit Git : non disponible.
- build observé : pnpm 10.28.0, commande `pnpm run build`, Next.js 15.5.20, 245 pages statiques ; les validations TypeScript et ESLint sont actuellement ignorées par la configuration de build.

Les logs montrent aussi que `/dummy` et `/stryvr` faisaient partie du déploiement de référence. Même si `pages/dummy.tsx` paraît factice, il ne doit donc pas être retiré sans validation de route et Preview.

Ce déploiement constitue une référence fonctionnelle et une cible de comparaison, mais pas une sauvegarde complète du code source.

## Zones protégées par défaut

### Runtime Next.js

- `app/`
- `components/`
- `lib/`
- `hooks/`
- `utils/`
- `middleware.ts`
- `next.config.js`
- `app/layout.tsx`
- `app/globals.css`

Les routes `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx` et les fichiers metadata peuvent être chargés par convention, même sans import explicite.

### Données et backend

- `supabase/migrations/` : ne jamais supprimer une migration potentiellement exécutée en production ;
- `utils/supabase/` et clients Supabase ;
- routes Stripe et webhooks ;
- fonctions Inngest ;
- routes cron listées dans `vercel.json` ;
- routes de confidentialité, purge de compte et sécurité ;
- stockage, uploads et URLs signées.

### Expérience client et mobile

- `app/client/`
- `public/sw.js`
- `public/manifest.json`
- `capacitor.config.ts`
- `android/`
- `ios/`
- `out/index.html`

Le dossier `out/` paraît presque vide, mais `capacitor.config.ts` le déclare explicitement comme fallback requis.

### Assets actifs

- `data/exercise-catalog.json`
- `public/bibliotheque_exercices/`
- `components/nutrition/FoodIcon.tsx`
- tous les répertoires d'icônes référencés par ce mapping ;
- `public/fonts/`
- `public/landing-demo/`
- assets référencés par la landing active et les metadata.

### Landing

- `app/page.tsx`
- `components/landing/OperatingSystemLanding.tsx`
- tout composant ou contenu importé depuis celui-ci.

## Parcours de smoke test obligatoires

| Domaine | Vérification minimale |
|---|---|
| Landing | `/`, responsive, images, CTA Cal.com, liens légaux |
| Auth coach | login, callback, reset password, session |
| Auth client | login/access, onboarding, session PWA |
| Coach | dashboard, clients, profil client, inbox |
| Bilans | création, lien public, réponse, upload, consultation |
| Entraînement | programmes, templates, assignation, session client, historique |
| Nutrition | protocole, planning, suivi, saisie photo/voix, TDEE |
| Paiements | checkout, webhook, paiements coach, rappels |
| Automations | Inngest et chaque cron de `vercel.json` |
| Mobile/PWA | service worker, manifest, navigation `/client`, wrappers Capacitor |
| Données | migrations, RLS, uploads et suppression de compte |

## Conditions avant suppression d'un élément protégé

Une suppression à risque moyen ou élevé exige :

1. référence de production et snapshot de rollback ;
2. recherche des imports statiques et dynamiques ;
3. recherche des chemins dans les données, scripts, tests et configurations ;
4. installation figée réussie ;
5. baseline de tests connue ;
6. typecheck terminé ;
7. build de production réussi ;
8. déploiement Preview ;
9. smoke tests ciblés ;
10. rollback documenté.

## Interdictions

- ne pas exécuter `cleanup.sh` ;
- ne pas supprimer des migrations déjà appliquées ;
- ne pas juger une route App Router inutilisée uniquement parce qu'elle n'est pas importée ;
- ne pas supprimer un asset dont l'URL peut être stockée en base ;
- ne pas réécrire l'historique Git avant d'avoir un remote et une sauvegarde ;
- ne pas faire un unique commit massif combinant caches, docs, dépendances, code et assets.
