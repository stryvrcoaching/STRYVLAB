export interface InfoModalDef {
  title: string
  description: string
  example: string
  whenToUse: string
  tabs?: Array<{
    id: string
    label: string
    content: string
  }>
}

export const INJECTION_INFO_MODALS: Record<string, InfoModalDef> = {
  base: {
    title: 'Injecter les macros calculées',
    description:
      'Cette action va remplacer les calories, protéines, lipides et glucides du jour sélectionné avec les valeurs calculées ci-dessus.',
    example:
      'Si vous injectez dans "Jour entraînement", les macros deviendront : 2731 kcal, 122g protéines, 64g lipides, 417g glucides.',
    whenToUse:
      'Utilisez ce bouton après avoir ajusté votre objectif et vos paramètres pour populer le jour.',
  },
  carbCycleHigh: {
    title: 'Injecter un jour haut en glucides',
    description:
      'Cette action va injecter les macros optimisées pour un jour d\'entraînement avec un apport en glucides élevé.',
    example:
      'Un jour haut aura typiquement 350-400g de glucides pour supporter la performance, avec une quantité de lipides réduite.',
    whenToUse:
      'Utilisez ce bouton pour les jours d\'entraînement intensif afin de maximiser la performance et la récupération.',
  },
  carbCycleLow: {
    title: 'Injecter un jour bas en glucides',
    description:
      'Cette action va injecter les macros optimisées pour un jour de repos avec un apport en glucides réduit.',
    example:
      'Un jour bas aura typiquement 150-200g de glucides, compensé par un apport en lipides plus élevé pour atteindre les calories.',
    whenToUse:
      'Utilisez ce bouton pour les jours de repos ou de faible intensité pour optimiser l\'utilisation des graisses.',
  },
  hydration: {
    title: 'Injecter l\'hydratation recommandée',
    description:
      'Cette action va populer le champ hydratation avec le volume recommandé basé sur votre climat et votre activité.',
    example:
      'Pour un climat tempéré et un niveau d\'activité modéré, l\'hydratation recommandée est 3.8L (EFSA 2010).',
    whenToUse:
      'Utilisez ce bouton après avoir sélectionné votre climat pour obtenir une recommandation d\'hydratation personnalisée.',
  },
  allCalculations: {
    title: 'Appliquer les paramètres nutritionnels',
    description:
      'Cette action applique l\'ensemble des paramètres calculés dans la colonne centrale sur le jour sélectionné : calories cibles, protéines, lipides, glucides et hydratation.',
    example:
      'Si le calcul nutritionnel donne 2436 kcal — 141g P · 64g L · 339g G avec 3.8L d\'hydratation, ces valeurs remplaceront intégralement les données du jour actif.',
    whenToUse:
      'Utilisez ce bouton une fois votre objectif, votre ajustement calorique et vos paramètres configurés dans la colonne centrale. Chaque jour du protocole peut recevoir des paramètres différents (ex : +10% entraînement, -5% repos).',
  },
  carbCyclingToggle: {
    title: 'Carb Cycling — Alimentation cyclique en glucides',
    description:
      'Le Carb Cycling alterne automatiquement entre des jours hauts en glucides (entraînement) et des jours bas (repos) pour optimiser votre composition corporelle.',
    example:
      'En mode 2/1, vous aurez 2 jours hauts en glucides (>350g), puis 1 jour bas (<200g), puis le cycle recommence.',
    whenToUse:
      'Activez le Carb Cycling si vous cherchez une approche flexible pour adapter votre apport en glucides à votre programme d\'entraînement.',
  },
  tdeeClientTruth: {
    title: 'TDEE client — documentation complète',
    description:
      'Le TDEE est traité ici comme une donnée physiologique du client, pas comme une propriété du protocole.\n\n' +
      'Principe produit :\n' +
      '• le client possède une vérité TDEE stable\n' +
      '• chaque protocole consomme un snapshot de cette vérité\n' +
      '• ouvrir un protocole ne doit jamais recalculer silencieusement le TDEE\n\n' +
      'Comment le moteur fonctionne :\n' +
      '1. il calcule un TDEE observé à partir des apports moyens et de la variation de poids\n' +
      '2. il évalue la confiance selon les pesées, la qualité des logs et la fenêtre utile\n' +
      '   (remarque : le calcul s\'ancre sur le protocole en cours s\'il a ≥ 14 jours, sinon il utilise une fenêtre glissante de 14j minimum)\n' +
      '3. il compare ce TDEE observé au TDEE client stable actuel\n' +
      '4. il décide de l\'ignorer, le surveiller ou promouvoir une nouvelle valeur stable\n\n' +
      'Anti-bruit :\n' +
      '• < 50 kcal : bruit, pas de changement\n' +
      '• 50–99 kcal : surveillance\n' +
      '• ≥ 100 kcal cohérents sur plusieurs runs : promotion possible\n' +
      '• ≥ 150 kcal avec forte confiance : promotion accélérée\n\n' +
      'Important : le recalcul peut être fréquent, mais la vérité client ne doit pas bouger tous les jours.',
    example:
      'Cas concret :\n' +
      '• TDEE client stable actuel : 2130 kcal\n' +
      '• nouveau TDEE observé : 2210 kcal\n' +
      '• confiance : haute\n' +
      '• run 1 : statut watch, on ne bouge pas encore\n' +
      '• run 2 cohérent : promotion lissée vers une nouvelle valeur stable, par exemple 2160 ou 2170 kcal\n\n' +
      'Le protocole n\'est ensuite rescalé que si le coach le décide.',
    whenToUse:
      'Utiliser cette section pour :\n' +
      '• recalculer la dépense réelle du client\n' +
      '• vérifier si la donnée est stable ou seulement sous surveillance\n' +
      '• activer cette valeur comme base des macros et du déficit\n\n' +
      'Bon usage coach :\n' +
      '• cut : recalcul utile toutes les 2 à 3 semaines\n' +
      '• maintien / prise : plutôt toutes les 3 à 4 semaines\n' +
      '• ne pas sur-réagir à une seule observation\n' +
      '• privilégier les périodes avec pesées régulières et logs nutritionnels propres',
    tabs: [
      {
        id: 'concept',
        label: 'Concept',
        content:
          'Le TDEE est la dépense énergétique de maintien réelle du client.\n\n' +
          'Dans ce produit, il est géré comme une vérité client évolutive :\n' +
          '• il appartient au client\n' +
          '• il traverse les protocoles\n' +
          '• un protocole ne fait que consommer un snapshot\n\n' +
          'Conséquence directe : créer un nouveau protocole ne doit pas recréer un nouveau TDEE.',
      },
      {
        id: 'calcul',
        label: 'Calcul',
        content:
          'Le moteur estime un TDEE observé à partir de la relation entre :\n' +
          '• apports moyens observés\n' +
          '• évolution pondérale\n' +
          '• densité des pesées\n' +
          '• qualité du logging nutritionnel\n' +
          '• fenêtre utile d’observation (minimum 14 jours)\n\n' +
          'Fenêtre d\'ancrage :\n' +
          '• Si le protocole a démarré depuis ≥ 14 jours, le calcul s\'ancre sur le protocole pour éviter de mélanger des données antérieures.\n' +
          '• Si le protocole a < 14 jours, le système utilise par défaut une fenêtre glissante glissante de 14j (incluant des données pré-protocole) pour garantir la stabilité statistique.\n\n' +
          'Formule :\n' +
          'TDEE = apport moyen − (pente poids × 7700)\n\n' +
          'Le moteur tient ensuite compte de la confiance et de la stabilité avant de promouvoir une nouvelle valeur.',
      },
      {
        id: 'interpretation',
        label: 'Interprétation',
        content:
          'Tous les recalculs ne doivent pas changer la vérité client.\n\n' +
          'Règles anti-bruit :\n' +
          '• < 50 kcal : bruit, on ignore\n' +
          '• 50–99 kcal : on surveille\n' +
          '• ≥ 100 kcal cohérents sur plusieurs runs : promotion possible\n' +
          '• ≥ 150 kcal avec forte confiance : promotion accélérée\n\n' +
          'États à lire :\n' +
          '• Stable : la base est exploitable telle quelle\n' +
          '• Sous surveillance : tendance détectée, pas encore promue\n' +
          '• Ajustement validé : une nouvelle valeur stable vient d’être retenue',
      },
      {
        id: 'coach-usage',
        label: 'Bon usage coach',
        content:
          'Période de calibrage :\n' +
          '• Durant les 14 premiers jours d\'un protocole, soyez vigilants. Le corps perd beaucoup d\'eau et de glycogène (perte transitoire), ce qui peut faire grimper artificiellement le TDEE calculé brute. Laissez passer cette phase de calibrage de 14 jours.\n\n' +
          'Cadence recommandée :\n' +
          '• cut : toutes les 2 à 3 semaines\n' +
          '• maintien / prise : toutes les 3 à 4 semaines\n\n' +
          'Ce qu’il faut éviter :\n' +
          '• recalculer puis modifier le protocole sur un seul signal faible\n' +
          '• sur-interpréter une fenêtre incomplète\n' +
          '• confondre TDEE client et calories du protocole\n\n' +
          'Workflow propre :\n' +
          '1. calculer\n' +
          '2. lire la confiance\n' +
          '3. lire le statut stable/watch/action\n' +
          '4. décider ensuite seulement si le protocole doit être rescalé',
      },
    ],
  },
}
