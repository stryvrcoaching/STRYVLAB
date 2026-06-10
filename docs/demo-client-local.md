# Client Demo Local

Ce repo peut provisionner un client de demo local **sans committer d'identifiants**.

## Objectif

- creer ou resynchroniser un client de demo dans Supabase
- garder email et mot de passe dans `.env.local` uniquement
- activer un bouton `Acces demo local` uniquement hors production

## Variables a ajouter dans `.env.local`

```env
CLIENT_DEMO_ENABLED=true
NEXT_PUBLIC_CLIENT_DEMO_ENABLED=true

CLIENT_DEMO_COACH_ID=uuid-du-coach-proprietaire
CLIENT_DEMO_EMAIL=demo.client@local.test
CLIENT_DEMO_PASSWORD=change-me-long-random-password

CLIENT_DEMO_FIRST_NAME=Demo
CLIENT_DEMO_LAST_NAME=Nutrition
CLIENT_DEMO_GENDER=prefer_not_to_say
CLIENT_DEMO_TIMEZONE=Europe/Brussels
CLIENT_DEMO_LANGUAGE=fr
```

## Provisioning

```bash
npm run demo:client:setup
```

Le script:

- cree ou met a jour l'utilisateur Supabase Auth
- cree ou met a jour la ligne `coach_clients`
- force `status=active`
- force `password_set=true`
- aligne `client_preferences.language`

## Connexion

Quand `CLIENT_DEMO_ENABLED=true` et `NEXT_PUBLIC_CLIENT_DEMO_ENABLED=true` sont presents en local:

- la page `/client/login` affiche un bouton `Acces demo local`
- le mot de passe ne transite jamais dans le front
- la connexion de demo est refusee en production

## Garde-fous

- ne jamais mettre ces variables dans un fichier commite
- utiliser un mot de passe long et unique
- reserver ce compte a un coach de demo dedie si possible
- desactiver `CLIENT_DEMO_ENABLED` quand tu n'en as plus besoin
