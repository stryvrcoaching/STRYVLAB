export type CoachLearningStep = {
  id: string
  title: string
  description: string
  actionLabel: string
  href: string
}

export type CoachLearningLesson = {
  id: string
  title: string
  summary: string
  outcome: string
  steps: CoachLearningStep[]
}

export type CoachLearningChapter = {
  id: 'foundations' | 'prescribe' | 'follow-up' | 'operate' | 'business'
  title: string
  shortTitle: string
  description: string
  lessonIds: string[]
}

export const COACH_LEARNING_CHAPTERS: CoachLearningChapter[] = [
  {
    id: 'foundations',
    title: 'Chapitre 1 · Poser les fondations',
    shortTitle: 'Fondations',
    description: 'Configurer votre espace et créer un premier dossier client exploitable.',
    lessonIds: ['setup', 'clients', 'client-profile', 'assessments'],
  },
  {
    id: 'prescribe',
    title: 'Chapitre 2 · Construire la prescription',
    shortTitle: 'Prescription',
    description: 'Créer les protocoles qui structurent l’accompagnement du client.',
    lessonIds: ['programs', 'training', 'nutrition', 'cardio-composition'],
  },
  {
    id: 'follow-up',
    title: 'Chapitre 3 · Lire et ajuster le suivi',
    shortTitle: 'Suivi',
    description: 'Transformer les données et retours client en prochaines décisions.',
    lessonIds: ['follow-up', 'metrics', 'checkins', 'morphopro', 'documentation'],
  },
  {
    id: 'operate',
    title: 'Chapitre 4 · Piloter au quotidien',
    shortTitle: 'Quotidien',
    description: 'Organiser votre travail, les échanges et l’expérience STRYVR.',
    lessonIds: ['organisation', 'inbox', 'notifications', 'client-app', 'rewards'],
  },
  {
    id: 'business',
    title: 'Chapitre 5 · Développer votre activité',
    shortTitle: 'Activité',
    description: 'Présenter votre offre et piloter les encaissements clients.',
    lessonIds: ['ma-page', 'payments'],
  },
]

/**
 * Short, task-led lessons. They deliberately explain a workflow before
 * sending the coach into a product screen.
 */
export const COACH_LEARNING_LESSONS: CoachLearningLesson[] = [
  {
    id: 'setup', title: 'Configurer mon espace coach',
    summary: 'Posez les repères de votre espace avant de démarrer les suivis.',
    outcome: 'Votre profil, vos offres et vos préférences de travail sont prêts.',
    steps: [
      { id: 'profile', title: 'Compléter le profil coach', description: 'Vos informations et votre identité servent dans les échanges, factures et pages publiques.', actionLabel: 'Ouvrir mon profil', href: '/coach/settings?section=profile' },
      { id: 'offers', title: 'Créer mes formules', description: 'Vos formules structurent ce que vous vendez et ce que vous assignez aux clients.', actionLabel: 'Gérer les formules', href: '/coach/formules' },
      { id: 'preferences', title: 'Régler mes préférences', description: 'Définissez notamment les notifications qui doivent réellement vous interrompre.', actionLabel: 'Ouvrir les réglages', href: '/coach/settings' },
    ],
  },
  {
    id: 'clients', title: 'Créer et organiser mes clients',
    summary: 'Un bon suivi commence par un dossier clair et une liste clients exploitable.',
    outcome: 'Vous savez créer un client et retrouver les dossiers qui demandent votre attention.',
    steps: [
      { id: 'create', title: 'Créer un client', description: 'Ajoutez les informations de contact et le contexte minimal avant de commencer la prescription.', actionLabel: 'Nouveau client', href: '/coach/clients?create=1' },
      { id: 'prioritize', title: 'Lire la liste comme un portefeuille', description: 'La liste clients sert à repérer le dossier à traiter, pas seulement à stocker des coordonnées.', actionLabel: 'Voir les clients', href: '/coach/clients' },
      { id: 'open', title: 'Ouvrir un dossier pour travailler', description: 'Le dossier relie ensuite profil, données, protocoles et accès client.', actionLabel: 'Choisir un client', href: '/coach/clients' },
    ],
  },
  {
    id: 'client-profile', title: 'Comprendre le dossier client',
    summary: 'Le dossier est le point de continuité entre contexte, décisions et expérience du client.',
    outcome: 'Vous savez où retrouver les informations, les données et les protocoles d’un client.',
    steps: [
      { id: 'profile', title: 'Lire le profil et les accès', description: 'Commencez par le contexte du client, ses coordonnées et son accès à STRYVR.', actionLabel: 'Choisir un client', href: '/coach/clients' },
      { id: 'data', title: 'Ouvrir le suivi des données', description: 'Les bilans, métriques, check-ins et performances se lisent depuis le même dossier.', actionLabel: 'Voir les clients', href: '/coach/clients' },
      { id: 'protocols', title: 'Passer aux protocoles', description: 'Depuis ce contexte, vous construisez et ajustez la prescription utile au client.', actionLabel: 'Voir les clients', href: '/coach/clients' },
    ],
  },
  {
    id: 'assessments',
    title: 'Bilans & questionnaires',
    summary: 'Structurez vos questions, envoyez le bon bilan puis exploitez les réponses dans le dossier client.',
    outcome: 'À la fin, vous savez créer un bilan et l’utiliser pour cadrer un suivi.',
    steps: [
      { id: 'create', title: 'Créer ou ouvrir un template', description: 'Un template regroupe les questions réutilisables : démarrage, suivi hebdomadaire ou photos.', actionLabel: 'Voir les templates', href: '/coach/assessments' },
      { id: 'send', title: 'Envoyer un bilan à un client', description: 'Depuis un template, utilisez l’icône d’envoi pour choisir le client et la date du bilan.', actionLabel: 'Ouvrir les bilans', href: '/coach/assessments' },
      { id: 'read', title: 'Lire les réponses dans le dossier', description: 'Les réponses reçues servent à préparer la prochaine décision de coaching, pas seulement à archiver un formulaire.', actionLabel: 'Choisir un client', href: '/coach/clients' },
    ],
  },
  {
    id: 'programs',
    title: 'Templates d’entraînement',
    summary: 'Préparez une base de programme, puis adaptez-la avant de l’assigner à un client.',
    outcome: 'À la fin, vous savez où créer une trame et comment elle rejoint un accompagnement.',
    steps: [
      { id: 'browse', title: 'Parcourir la bibliothèque', description: 'Les templates sont vos trames réutilisables ; ils évitent de repartir de zéro pour chaque nouveau dossier.', actionLabel: 'Voir les templates', href: '/coach/programs/templates' },
      { id: 'build', title: 'Construire une trame', description: 'Ajoutez les semaines, séances et exercices qui forment la base du programme.', actionLabel: 'Créer un template', href: '/coach/programs/templates' },
      { id: 'assign', title: 'L’adapter au client', description: 'Depuis le dossier client, ajustez puis partagez la prescription correspondant à son objectif et sa phase.', actionLabel: 'Choisir un client', href: '/coach/clients' },
    ],
  },
  {
    id: 'nutrition',
    title: 'Protocoles nutrition',
    summary: 'Le protocole nutrition se construit dans le dossier client : objectifs, cibles puis suivi des données réelles.',
    outcome: 'À la fin, vous savez où ouvrir le studio et comment relier le protocole au suivi client.',
    steps: [
      { id: 'choose-client', title: 'Ouvrir le bon dossier client', description: 'La nutrition est toujours contextualisée : choisissez d’abord le client à accompagner.', actionLabel: 'Voir les clients', href: '/coach/clients' },
      { id: 'set-targets', title: 'Définir les cibles du protocole', description: 'Dans le studio Nutrition, définissez calories, macros et structure alimentaire selon l’objectif du client.', actionLabel: 'Ouvrir un protocole', href: '/coach/clients' },
      { id: 'review', title: 'Piloter avec les données reçues', description: 'Les repas, poids et retours client permettent ensuite d’ajuster la prescription au bon moment.', actionLabel: 'Voir les données client', href: '/coach/clients' },
    ],
  },
  {
    id: 'training', title: 'Prescrire l’entraînement',
    summary: 'Le Workout Studio permet de transformer l’objectif du client en séances exécutables.',
    outcome: 'Vous savez où créer, ajuster et partager un programme client.',
    steps: [
      { id: 'client', title: 'Choisir le dossier à accompagner', description: 'Le programme prend son sens avec l’objectif, le niveau et la phase du client.', actionLabel: 'Voir les clients', href: '/coach/clients' },
      { id: 'build', title: 'Ouvrir le Workout Studio', description: 'Construisez les semaines, séances et exercices depuis les protocoles du client.', actionLabel: 'Choisir un client', href: '/coach/clients' },
      { id: 'share', title: 'Contrôler l’expérience client', description: 'Vérifiez ce qui est prêt à être consulté et réalisé dans STRYVR.', actionLabel: 'Voir les clients', href: '/coach/clients' },
    ],
  },
  {
    id: 'follow-up', title: 'Suivre un accompagnement',
    summary: 'Utilisez le dossier pour relier les données observées à la décision à prendre.',
    outcome: 'Vous savez passer de la réalité du client au prochain ajustement utile.',
    steps: [
      { id: 'choose', title: 'Ouvrir le dossier concerné', description: 'Chaque décision doit s’appuyer sur le contexte du client, pas sur une donnée isolée.', actionLabel: 'Voir les clients', href: '/coach/clients' },
      { id: 'signals', title: 'Lire les signaux de suivi', description: 'Bilans, métriques, check-ins et nutrition permettent de voir ce qui se passe réellement.', actionLabel: 'Choisir un client', href: '/coach/clients' },
      { id: 'act', title: 'Ajuster le protocole si nécessaire', description: 'Une fois le signal compris, rendez-vous dans le studio concerné pour modifier la prescription.', actionLabel: 'Choisir un client', href: '/coach/clients' },
    ],
  },
  {
    id: 'metrics', title: 'Lire les métriques et performances',
    summary: 'Consultez l’évolution corporelle et l’exécution de l’entraînement sans perdre le contexte.',
    outcome: 'Vous savez où analyser les mesures et les performances d’un client.',
    steps: [
      { id: 'metrics', title: 'Ouvrir les métriques', description: 'Poids et mensurations permettent de lire la tendance plutôt qu’une journée isolée.', actionLabel: 'Choisir un client', href: '/coach/clients' },
      { id: 'performance', title: 'Comparer avec les performances', description: 'Les performances montrent ce qui a réellement été réalisé à l’entraînement.', actionLabel: 'Choisir un client', href: '/coach/clients' },
      { id: 'decide', title: 'Relier les signaux à la prescription', description: 'Utilisez ces données pour décider s’il faut maintenir, ajuster ou investiguer davantage.', actionLabel: 'Voir les clients', href: '/coach/clients' },
    ],
  },
  {
    id: 'checkins', title: 'Exploiter les check-ins',
    summary: 'Les check-ins font remonter le vécu quotidien du client entre deux bilans.',
    outcome: 'Vous savez où lire les check-ins et quoi en faire dans le suivi.',
    steps: [
      { id: 'open', title: 'Ouvrir les check-ins du client', description: 'Consultez les retours depuis l’espace Suivi du dossier.', actionLabel: 'Choisir un client', href: '/coach/clients' },
      { id: 'interpret', title: 'Chercher une tendance, pas un verdict', description: 'Croisez énergie, récupération et adhérence avec la prescription en cours.', actionLabel: 'Voir la documentation', href: '/coach/documentation' },
      { id: 'respond', title: 'Agir dans le bon outil', description: 'Selon le signal, ajustez la nutrition, l’entraînement ou échangez avec le client.', actionLabel: 'Ouvrir l’inbox', href: '/coach/inbox' },
    ],
  },
  {
    id: 'morphopro', title: 'Utiliser MorphoPro',
    summary: 'MorphoPro aide à suivre l’évolution corporelle à partir d’éléments visuels et de mesures.',
    outcome: 'Vous savez où consulter MorphoPro et le remettre dans le contexte du suivi.',
    steps: [
      { id: 'open', title: 'Ouvrir le dossier client', description: 'MorphoPro se consulte dans le suivi d’un client précis.', actionLabel: 'Choisir un client', href: '/coach/clients' },
      { id: 'compare', title: 'Comparer avec les autres signaux', description: 'Une évolution visuelle gagne à être lue avec mesures, adhérence et protocole en cours.', actionLabel: 'Voir la documentation', href: '/coach/documentation' },
      { id: 'decide', title: 'Préparer le prochain ajustement', description: 'L’objectif reste une décision de coaching explicable, pas un score isolé.', actionLabel: 'Voir les clients', href: '/coach/clients' },
    ],
  },
  {
    id: 'cardio-composition', title: 'Cardio et composition corporelle',
    summary: 'Ces protocoles complètent nutrition et entraînement lorsque le suivi le demande.',
    outcome: 'Vous savez où les trouver et comment les intégrer à une prescription client.',
    steps: [
      { id: 'client', title: 'Choisir le dossier concerné', description: 'Les protocoles s’ouvrent toujours depuis le contexte du client.', actionLabel: 'Voir les clients', href: '/coach/clients' },
      { id: 'cardio', title: 'Configurer le cardio', description: 'Ajoutez une prescription cardio lorsqu’elle sert réellement l’objectif et la récupération.', actionLabel: 'Choisir un client', href: '/coach/clients' },
      { id: 'composition', title: 'Suivre la composition corporelle', description: 'Utilisez les informations de composition avec les autres données de suivi.', actionLabel: 'Choisir un client', href: '/coach/clients' },
    ],
  },
  {
    id: 'organisation', title: 'Organiser ma journée coach',
    summary: 'Transformez les priorités de suivi en une journée de travail lisible.',
    outcome: 'Vous savez planifier vos tâches et garder le rythme de vos accompagnements.',
    steps: [
      { id: 'open', title: 'Ouvrir l’organisation', description: 'Centralisez les tâches et les rendez-vous à traiter dans un même espace.', actionLabel: 'Ouvrir l’organisation', href: '/coach/organisation' },
      { id: 'prioritize', title: 'Choisir les prochaines actions', description: 'Commencez par ce qui débloque un suivi ou une décision client.', actionLabel: 'Voir l’organisation', href: '/coach/organisation' },
      { id: 'complete', title: 'Revenir aux dossiers clients', description: 'L’organisation indique quoi faire ; le dossier client est l’endroit où vous le réalisez.', actionLabel: 'Voir les clients', href: '/coach/clients' },
    ],
  },
  {
    id: 'inbox', title: 'Gérer l’inbox coach',
    summary: 'L’inbox rassemble les échanges et demandes qui méritent votre attention.',
    outcome: 'Vous savez traiter un message sans perdre le fil du suivi client.',
    steps: [
      { id: 'open', title: 'Ouvrir l’inbox', description: 'Commencez par les messages et demandes qui sont encore en attente.', actionLabel: 'Ouvrir l’inbox', href: '/coach/inbox' },
      { id: 'context', title: 'Retrouver le contexte client', description: 'Avant de répondre, ouvrez le dossier si une donnée ou une prescription doit éclairer la décision.', actionLabel: 'Voir les clients', href: '/coach/clients' },
      { id: 'respond', title: 'Répondre puis reprendre le suivi', description: 'La conversation sert à faire avancer l’accompagnement, pas à devenir un canal isolé.', actionLabel: 'Ouvrir l’inbox', href: '/coach/inbox' },
    ],
  },
  {
    id: 'client-app', title: 'Mettre en route STRYVR',
    summary: 'Invitez un client dans l’application et comprenez comment ses actions reviennent dans votre espace coach.',
    outcome: 'Vous savez préparer l’accès client et lire les données qui remontent de STRYVR.',
    steps: [
      { id: 'access', title: 'Ouvrir les accès du client', description: 'L’invitation et le statut d’accès se gèrent depuis son dossier.', actionLabel: 'Choisir un client', href: '/coach/clients' },
      { id: 'experience', title: 'Vérifier ce que le client reçoit', description: 'Protocoles, check-ins et messages doivent rester cohérents avec ce que vous avez prescrit.', actionLabel: 'Voir les clients', href: '/coach/clients' },
      { id: 'feedback', title: 'Lire les retours dans le suivi', description: 'Les données saisies dans STRYVR alimentent les bilans et les décisions du coach.', actionLabel: 'Voir la documentation', href: '/coach/documentation/connected-ecosystem' },
    ],
  },
  {
    id: 'documentation', title: 'Approfondir les outils de décision',
    summary: 'La documentation explique ce que les outils observent, ce qu’ils ne concluent pas et comment les utiliser correctement.',
    outcome: 'Vous savez où approfondir les signaux avancés avant de les utiliser dans une décision.',
    steps: [
      { id: 'browse', title: 'Parcourir les sujets disponibles', description: 'TDEE, cohérence nutritionnelle, optimisation de phase et progression sont expliqués en langage coach.', actionLabel: 'Ouvrir la documentation', href: '/coach/documentation' },
      { id: 'choose', title: 'Choisir le bon sujet', description: 'Partez d’une question de suivi réelle plutôt que de lire les outils comme une liste de fonctionnalités.', actionLabel: 'Voir la documentation', href: '/coach/documentation' },
      { id: 'apply', title: 'Revenir au dossier client', description: 'La documentation éclaire la décision ; l’action reste dans le dossier et les studios.', actionLabel: 'Voir les clients', href: '/coach/clients' },
    ],
  },
  {
    id: 'ma-page',
    title: 'Ma page business',
    summary: 'Présentez votre activité, vos formules et votre lien public depuis un espace dédié.',
    outcome: 'À la fin, vous savez préparer et publier votre page coach.',
    steps: [
      { id: 'profile', title: 'Vérifier les informations affichées', description: 'Votre identité et vos informations publiques donnent le cadre de la page.', actionLabel: 'Ouvrir Ma page', href: '/coach/ma-page' },
      { id: 'offers', title: 'Choisir les formules à présenter', description: 'Les formules affichées permettent à un prospect de comprendre votre offre avant de vous contacter.', actionLabel: 'Gérer les formules', href: '/coach/formules' },
      { id: 'publish', title: 'Prévisualiser puis publier', description: 'Vérifiez la page comme un visiteur avant de partager son lien ou son QR code.', actionLabel: 'Prévisualiser Ma page', href: '/coach/ma-page' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications & inbox',
    summary: 'Définissez ce qui mérite votre attention et retrouvez les demandes dans votre flux coach.',
    outcome: 'À la fin, vous avez un flux de notifications adapté à votre façon de travailler.',
    steps: [
      { id: 'settings', title: 'Régler les notifications', description: 'Choisissez les alertes utiles : messages, bilans, paiements et activité client.', actionLabel: 'Ouvrir les réglages', href: '/coach/settings?section=notifications' },
      { id: 'inbox', title: 'Consulter l’inbox', description: 'L’inbox rassemble les éléments qui nécessitent une réponse ou une décision de votre part.', actionLabel: 'Ouvrir l’inbox', href: '/coach/inbox' },
    ],
  },
  {
    id: 'rewards',
    title: 'Boutique de récompenses',
    summary: 'Créez les récompenses que vos clients peuvent débloquer dans STRYVR.',
    outcome: 'À la fin, vous savez où configurer les récompenses côté coach.',
    steps: [
      { id: 'discover', title: 'Découvrir les réglages', description: 'Les récompenses se configurent ici puis sont visibles par les clients éligibles dans l’application.', actionLabel: 'Ouvrir les récompenses', href: '/coach/settings?section=rewards' },
      { id: 'configure', title: 'Créer une récompense utile', description: 'Définissez une récompense claire, cohérente avec le suivi que vous proposez.', actionLabel: 'Configurer', href: '/coach/settings?section=rewards' },
    ],
  },
  {
    id: 'payments',
    title: 'Encaissements clients',
    summary: 'Reliez formules, demandes de paiement Stripe et suivi des encaissements.',
    outcome: 'À la fin, vous savez où configurer Stripe et suivre les paiements à relancer.',
    steps: [
      { id: 'connect', title: 'Configurer Stripe Connect', description: 'Connectez votre compte pour envoyer des demandes de paiement et recevoir les règlements.', actionLabel: 'Ouvrir les paiements', href: '/coach/settings?section=client-payments' },
      { id: 'request', title: 'Envoyer une demande de paiement', description: 'Depuis la formule d’un client, créez le lien de paiement correspondant à son accompagnement.', actionLabel: 'Voir les clients', href: '/coach/clients' },
      { id: 'follow-up', title: 'Suivre les paiements à relancer', description: 'Les paiements en attente restent séparés de l’historique des encaissements réalisés.', actionLabel: 'Ouvrir les paiements', href: '/coach/settings?section=client-payments' },
    ],
  },
]

export function getCoachLearningLesson(id: string): CoachLearningLesson | null {
  return COACH_LEARNING_LESSONS.find((lesson) => lesson.id === id) ?? null
}

export function getCoachLearningChapter(id: string): CoachLearningChapter | null {
  return COACH_LEARNING_CHAPTERS.find((chapter) => chapter.id === id) ?? null
}
