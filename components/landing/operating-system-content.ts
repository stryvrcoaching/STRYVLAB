import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BellRing,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  CreditCard,
  Dumbbell,
  FolderKanban,
  GalleryVerticalEnd,
  Gauge,
  HeartPulse,
  Layers3,
  LineChart,
  MessageSquareText,
  NotebookTabs,
  PanelsTopLeft,
  RefreshCw,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  Utensils,
  UsersRound,
  WalletCards,
} from "lucide-react";

export type ExplorerModule = {
  id: string;
  label: string;
  description: string;
  connection: string;
  icon: LucideIcon;
};

export type ExplorerPreview = {
  src: string;
  alt: string;
  label: string;
  mobileSrc?: string;
  mobileAlt?: string;
};

export type ExplorerSection = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  preview?: ExplorerPreview;
  modules: ExplorerModule[];
};

export const explorerSections: ExplorerSection[] = [
  {
    id: "pilotage",
    label: "Pilotage",
    eyebrow: "Pilotage du coaching",
    title: "Le point d’entrée du coaching sportif.",
    description:
      "STRYV lab relie portefeuille, priorités et échanges pour que le coach ne reconstruise pas le contexte à chaque action.",
    preview: {
      src: "/landing-demo/dashboard.png",
      alt: "Vue d’ensemble du tableau de bord STRYV lab pour coach",
      label: "Vue d’ensemble coach",
      mobileSrc: "/landing-demo/dashboard-focus-mobile.png",
      mobileAlt: "Vue resserrée du tableau de bord coach sur mobile",
    },
    modules: [
      {
        id: "clients",
        label: "Coachés",
        description:
          "Portefeuille et dossiers individuels : objectif, historique, programmes et éléments récents.",
        connection:
          "Chaque espace du système revient vers le dossier du coaché.",
        icon: UsersRound,
      },
      {
        id: "priorites",
        label: "Priorités",
        description:
          "Les situations à traiter sont regroupées pour voir où porter l’attention aujourd’hui.",
        connection:
          "Un signal peut devenir une action plutôt qu’une notification isolée.",
        icon: Target,
      },
      {
        id: "inbox",
        label: "Inbox",
        description:
          "Les échanges qui demandent une réponse restent rattachés au bon accompagnement.",
        connection:
          "La conversation conserve la personne et le contexte concernés.",
        icon: MessageSquareText,
      },
      {
        id: "bilans",
        label: "Bilans",
        description:
          "Créer des modèles, configurer les questions et réutiliser un cadre adapté à chaque phase de suivi.",
        connection:
          "Chaque réponse rejoint le dossier, la phase de travail et la décision suivante.",
        icon: ClipboardList,
      },
      {
        id: "formules",
        label: "Formules",
        description:
          "Le cadre d’accès et de suivi d’un coaché reste visible à côté de l’accompagnement.",
        connection:
          "Portefeuille actif, accès et suivi opérationnel restent cohérents.",
        icon: WalletCards,
      },
      {
        id: "documentation",
        label: "Méthode",
        description:
          "Capitaliser une méthode réutilisable sans rendre chaque suivi identique.",
        connection:
          "Une base de travail solide, puis adaptée à chaque coaché.",
        icon: NotebookTabs,
      },
    ],
  },
  {
    id: "workout",
    label: "Workout",
    eyebrow: "Workout Studio · Smart Workout",
    title: "Prescrire avec précision, ajuster sur le terrain.",
    description:
      "Workout Studio structure la programmation. Smart Workout relit volume, répartition, alertes et ce que le coaché a réellement exécuté.",
    preview: {
      src: "/landing-demo/workout-studio-builder-desktop.png",
      alt: "Interface réelle de Workout Studio avec programmation des séances",
      label: "Workout Studio",
      mobileSrc: "/landing-v2/studios/workout-focus-mobile.png",
      mobileAlt: "Vue resserrée de Workout Studio sur mobile",
    },
    modules: [
      {
        id: "programmes",
        label: "Programmes",
        description:
          "Créer et structurer une base de travail par semaines, séances et objectifs.",
        connection:
          "La prescription devient le parcours consultable dans STRYVR.",
        icon: PanelsTopLeft,
      },
      {
        id: "seances",
        label: "Séances",
        description:
          "Organiser exercices, séries, répétitions, repos, tempo, RIR et types de séries.",
        connection: "Le coaché retrouve les cibles utiles pendant l’exécution.",
        icon: Dumbbell,
      },
      {
        id: "mesocycles",
        label: "Mésocycles",
        description:
          "Transformer une ou plusieurs semaines en un cycle progressif avec volume, RIR et semaine de décharge.",
        connection:
          "La progression planifiée devient l’ordre des semaines proposées au coaché.",
        icon: Layers3,
      },
      {
        id: "smart-fit",
        label: "Smart Workout",
        description:
          "Relire l’équilibre, la récupération, les mouvements et le volume, puis faire remonter les alertes du programme.",
        connection:
          "Un outil de relecture qui ramène le coach vers le bon point à examiner.",
        icon: Sparkles,
      },
      {
        id: "alternatives",
        label: "Alternatives",
        description:
          "Explorer des variantes selon le mouvement, le matériel et les groupes ciblés.",
        connection:
          "L’intention de la séance reste lisible même lorsqu’un exercice change.",
        icon: RefreshCw,
      },
      {
        id: "performance",
        label: "Performance",
        description:
          "Revenir du réel vers le programme : volume, complétion, effort, repos et tendances par exercice.",
        connection:
          "L’exécution nourrit le prochain ajustement de programmation.",
        icon: LineChart,
      },
    ],
  },
  {
    id: "nutrition",
    label: "Nutrition",
    eyebrow: "Smart Nutrition · Nutrition Studio",
    title: "Calculer à partir du réel. Prescrire quelque chose de tenable.",
    description:
      "Plans, repas, alternatives et suivi restent dans le même raisonnement : le coach ajuste le protocole sans perdre le lien avec le quotidien du coaché.",
    preview: {
      src: "/landing-demo/nutrition-studio-builder-desktop.png",
      alt: "Interface réelle de Nutrition Studio avec protocole et repas",
      label: "Smart Nutrition · Nutrition Studio",
      mobileSrc: "/landing-v2/studios/nutrition-focus-mobile.png",
      mobileAlt: "Vue resserrée de Nutrition Studio sur mobile",
    },
    modules: [
      {
        id: "protocoles",
        label: "Plan vivant",
        description:
          "Construire un protocole autour de l’objectif, du rythme de vie et de la phase de travail du coaché.",
        connection:
          "Le coaché retrouve une référence claire dans STRYVR, sans perdre l’intention du coach.",
        icon: Utensils,
      },
      {
        id: "jours",
        label: "Jours & repas",
        description:
          "Organiser les journées d’entraînement, de repos ou neutres, avec les repas, apports et repères utiles.",
        connection:
          "La nutrition reste calée sur le rythme réel du programme et des journées vécues.",
        icon: CalendarDays,
      },
      {
        id: "ajustement-global",
        label: "Ajustement global",
        description:
          "Modifier une cible énergétique ou la répartition des macros, puis recalculer les portions du plan : repas, aliments et alternatives compris.",
        connection:
          "Une décision du coach se propage au protocole sans avoir à reconstruire chaque repas à la main.",
        icon: SlidersHorizontal,
      },
      {
        id: "cycle-sync",
        label: "Cycle Sync",
        description:
          "Lorsque cette donnée est pertinente et activée, intégrer le cycle menstruel dans les repères nutritionnels affichés au coaché.",
        connection:
          "Le contexte est explicite : il éclaire l’ajustement, sans décider à la place du coach.",
        icon: RefreshCw,
      },
      {
        id: "tdee",
        label: "TDEE adaptatif",
        description:
          "Estimer la dépense à partir des apports consignés et de l’évolution suivie, avec des variations lissées et un niveau de confiance explicite.",
        connection:
          "Le système prépare une lecture à examiner ; l’application de l’ajustement reste un choix du coach.",
        icon: Gauge,
      },
      {
        id: "reality",
        label: "Réalité STRYVR",
        description:
          "Relire les repas, portions, hydratation et repères réellement consignés au fil des journées.",
        connection:
          "Le coach distingue le protocole de ce qui est vécu, puis ajuste avec le bon contexte.",
        icon: CheckSquare,
      },
    ],
  },
  {
    id: "metrics",
    label: "Metrics",
    eyebrow: "Data Metrics",
    title: "Voir ce qui mérite une décision, pas seulement ce qui s’est passé.",
    description:
      "Corps, retours de suivi, nutrition et performance se lisent ensemble pour préparer la prochaine action du coach.",
    preview: {
      src: "/landing-demo/client-metrics-desktop.png",
      alt: "Interface réelle de métriques client dans STRYV lab",
      label: "Data Metrics",
      mobileSrc: "/landing-v2/intelligence/performance-focus-mobile.png",
      mobileAlt: "Vue resserrée des données de performance sur mobile",
    },
    modules: [
      {
        id: "corps",
        label: "Corps",
        description:
          "Suivre poids, composition et repères corporels lorsque ces données font partie de l’accompagnement.",
        connection:
          "Chaque série rejoint l’évolution du coaché plutôt qu’un tableau isolé.",
        icon: BarChart3,
      },
      {
        id: "mensurations",
        label: "Mensurations",
        description:
          "Relire taille, hanches, bras, cuisses et autres mesures dans le temps.",
        connection:
          "Les évolutions restent liées à la période et aux décisions prises.",
        icon: ScanLine,
      },
      {
        id: "recuperation",
        label: "Récupération",
        description:
          "Mettre en regard sommeil, énergie, stress et courbatures issus des retours de suivi.",
        connection:
          "Le vécu déclaré éclaire la lecture de performance et de charge.",
        icon: HeartPulse,
      },
      {
        id: "overlays",
        label: "Superpositions",
        description:
          "Croiser composition, nutrition, récupération et performance, puis relire sur la même chronologie les événements qui expliquent une évolution.",
        connection:
          "Nouveau protocole, changement de programme, déplacement ou note coach restent replacés au bon moment.",
        icon: Layers3,
      },
      {
        id: "references",
        label: "Normes",
        description:
          "Situer certaines données corporelles par rapport à des plages de référence lisibles et contextualisées.",
        connection:
          "La référence soutient la lecture du coach ; elle ne définit jamais une personne.",
        icon: Target,
      },
      {
        id: "synthese",
        label: "Synthèse",
        description:
          "Retrouver les tendances de performance et la qualité des données avant un ajustement.",
        connection: "Les données servent une prochaine action concrète.",
        icon: LineChart,
      },
    ],
  },
  {
    id: "morpho",
    label: "Morpho Pro",
    eyebrow: "Morpho Pro",
    title: "Documenter l’observation visuelle dans le temps.",
    description:
      "Morpho Pro donne au coach un espace séparé pour documenter, comparer et relire des éléments visuels avec prudence.",
    preview: {
      src: "/landing-demo/morphopro-desktop.png",
      alt: "Interface réelle de Morpho Pro dans STRYV lab",
      label: "Morpho Pro",
      mobileSrc: "/landing-demo/morphopro-focus-mobile.png",
      mobileAlt: "Vue resserrée de Morpho Pro sur mobile",
    },
    modules: [
      {
        id: "galerie",
        label: "Galerie",
        description:
          "Conserver les photos liées au coaché, puis les retrouver selon leur position et leur historique.",
        connection:
          "L’observation reste associée à la personne et à son évolution.",
        icon: GalleryVerticalEnd,
      },
      {
        id: "comparaison",
        label: "Comparer",
        description:
          "Mettre en regard deux à quatre photos sélectionnées pour préparer une lecture dans le temps.",
        connection:
          "Le coach visualise un chemin, pas une image sortie de son contexte.",
        icon: PanelsTopLeft,
      },
      {
        id: "annotations",
        label: "Annotations",
        description:
          "Conserver les repères visuels que le coach souhaite observer ou discuter.",
        connection:
          "L’observation devient partageable dans l’histoire du suivi.",
        icon: MessageSquareText,
      },
      {
        id: "analysis",
        label: "Analyse assistée",
        description:
          "Produire une lecture structurée à partir des photos sélectionnées, à relire par le coach.",
        connection:
          "Une aide à l’observation qui ne remplace jamais le jugement du professionnel.",
        icon: Sparkles,
      },
      {
        id: "evolution",
        label: "Évolution",
        description:
          "Comparer les analyses et retrouver une synthèse récente de l’évolution observée.",
        connection:
          "L’historique visuel rejoint les autres repères de progression.",
        icon: LineChart,
      },
      {
        id: "coherence",
        label: "Cohérence",
        description:
          "Mettre à disposition des indications de cohérence entre les choix d’exercice et les éléments observés.",
        connection:
          "Une information complémentaire pour éclairer la programmation.",
        icon: Dumbbell,
      },
    ],
  },
  {
    id: "business",
    label: "Business",
    eyebrow: "Gestion de l’activité de coaching",
    title: "Gérer l’activité sans séparer le suivi client.",
    description:
      "Les tâches, rendez-vous, paiements et priorités opérationnelles restent liés aux coachés et à leur contexte de suivi.",
    preview: {
      src: "/landing-demo/business.png",
      alt: "Interface réelle Business de STRYV lab avec portefeuille et organisation",
      label: "Organisation & Business",
      mobileSrc: "/landing-demo/business-focus-mobile.png",
      mobileAlt: "Vue resserrée de l’espace Business sur mobile",
    },
    modules: [
      {
        id: "portfolio",
        label: "Portefeuille",
        description:
          "Voir les coachés, leur état de suivi et les situations qui demandent une attention.",
        connection: "La gestion de l’activité reste attachée au suivi humain.",
        icon: FolderKanban,
      },
      {
        id: "agenda",
        label: "Agenda",
        description:
          "Planifier rendez-vous, échéances et actions à réaliser avec un coaché.",
        connection: "Une observation peut devenir un moment de suivi daté.",
        icon: CalendarDays,
      },
      {
        id: "kanban",
        label: "Kanban",
        description:
          "Transformer une priorité en tâche, dans le tableau et la colonne choisis par le coach.",
        connection: "La tâche peut être liée à un événement d’agenda.",
        icon: CheckSquare,
      },
      {
        id: "paiements",
        label: "Paiements",
        description:
          "Garder les paiements et éléments administratifs à proximité du portefeuille coachés.",
        connection:
          "L’opérationnel soutient le coaching sans devenir son centre.",
        icon: CreditCard,
      },
      {
        id: "recompenses",
        label: "Récompenses",
        description:
          "Configurer les cadeaux échangeables par les coachés selon leurs points et leurs séries de régularité.",
        connection: "Le coach garde la main sur les demandes d’échange.",
        icon: Trophy,
      },
      {
        id: "alertes",
        label: "Alertes",
        description:
          "Associer une échéance et un rappel à une action de suivi qui ne doit pas être oubliée.",
        connection: "Le système aide à donner une suite concrète à un signal.",
        icon: BellRing,
      },
    ],
  },
  {
    id: "stryvr",
    label: "STRYVR",
    eyebrow: "Application client STRYVR",
    title: "Le coaching sort du rendez-vous et entre dans la journée.",
    description:
      "STRYVR transforme les prescriptions en actions quotidiennes claires, puis renvoie séances, repas et check-ins au bon endroit dans STRYV lab.",
    preview: {
      src: "/landing-v2/hero/client-context.png",
      alt: "Expérience client STRYVR connectée au contexte de coaching",
      label: "STRYVR",
      mobileSrc: "/landing-v2/hero/client-context-mobile.png",
      mobileAlt: "Expérience client STRYVR sur mobile",
    },
    modules: [
      {
        id: "today",
        label: "Aujourd’hui",
        description:
          "Voir les actions, rendez-vous et priorités utiles pour la journée.",
        connection: "La prescription devient une prochaine action claire.",
        icon: CalendarDays,
      },
      {
        id: "smart-workout",
        label: "Smart Workout",
        description:
          "Ouvrir une séance, exécuter les exercices et consigner les informations nécessaires.",
        connection: "L’exécution nourrit les vues de performance du coach.",
        icon: Dumbbell,
      },
      {
        id: "client-nutrition",
        label: "Nutrition",
        description:
          "Retrouver le protocole, les repas, l’hydratation et des modes de saisie adaptés au quotidien.",
        connection:
          "Les apports réels restent reliés à la structure prévue par le coach.",
        icon: Utensils,
      },
      {
        id: "checkins",
        label: "Check-ins",
        description:
          "Partager des retours courts et structurés au moment approprié.",
        connection:
          "Le coach reçoit du contexte, pas un simple feu vert ou rouge.",
        icon: ClipboardList,
      },
      {
        id: "progression",
        label: "Progression",
        description:
          "Consulter les repères que le coach a choisi de rendre visibles.",
        connection:
          "Le coaché comprend davantage la continuité de son parcours.",
        icon: BarChart3,
      },
      {
        id: "trophees",
        label: "Trophées",
        description:
          "Points, séries de régularité et récompenses définies dans l’environnement de coaching.",
        connection: "L’engagement reste encadré par les règles du coach.",
        icon: Trophy,
      },
    ],
  },
  {
    id: "account",
    label: "Mon compte",
    eyebrow: "Espace coach",
    title: "Le cadre de travail reste à votre main.",
    description:
      "Les réglages, préférences et ressources qui structurent votre environnement de coaching.",
    modules: [
      {
        id: "profil-coach",
        label: "Profil coach",
        description:
          "Renseigner l’identité et les informations qui définissent votre espace professionnel.",
        connection:
          "Votre environnement reste aligné avec la façon dont vous accompagnez.",
        icon: UsersRound,
      },
      {
        id: "preferences",
        label: "Préférences",
        description:
          "Ajuster les préférences de travail et les réglages utiles au quotidien.",
        connection: "Un espace qui s’adapte à votre méthode, pas l’inverse.",
        icon: SlidersHorizontal,
      },
      {
        id: "notifications",
        label: "Notifications",
        description:
          "Choisir les signaux à recevoir pour préserver l’attention sur ce qui compte.",
        connection: "Les rappels soutiennent le suivi sans créer de bruit.",
        icon: BellRing,
      },
      {
        id: "organisation",
        label: "Organisation",
        description:
          "Garder les paramètres de votre environnement, de votre méthode et de vos accès au même endroit.",
        connection:
          "Le cadre opérationnel reste clair lorsque l’activité se développe.",
        icon: FolderKanban,
      },
      {
        id: "formules-compte",
        label: "Formules",
        description:
          "Retrouver les cadres d’accompagnement proposés à vos coachés.",
        connection: "L’offre reste reliée au portefeuille et au suivi réel.",
        icon: WalletCards,
      },
      {
        id: "ressources",
        label: "Ressources",
        description:
          "Accéder à la documentation et aux repères utiles pour exploiter la plateforme.",
        connection:
          "La méthode se consolide à mesure que vous travaillez avec le système.",
        icon: NotebookTabs,
      },
    ],
  },
];

export type LandingDockItem = {
  id: "accueil" | "athletes" | "studio" | "business" | "compte";
  label: string;
  viewId: string;
};

export type LandingAthleteTab = {
  id: "profil" | "suivi" | "protocoles";
  label: string;
  viewId: string;
};

export type LandingStudioTab = {
  id: "workout" | "nutrition" | "metrics" | "morpho" | "stryvr";
  label: string;
  viewId: string;
};

export type LandingExplorerView = {
  id: string;
  sectionId: string;
  defaultModuleId?: string;
  eyebrow: string;
  title: string;
  description: string;
  preview?: ExplorerPreview;
};

export const landingDockItems: LandingDockItem[] = [
  { id: "accueil", label: "Accueil", viewId: "accueil" },
  { id: "athletes", label: "Coachés", viewId: "athletes-profil" },
  { id: "studio", label: "Studio", viewId: "studio-workout" },
  { id: "business", label: "Business", viewId: "business" },
  { id: "compte", label: "Compte", viewId: "compte" },
];

export const landingAthleteTabs: LandingAthleteTab[] = [
  { id: "profil", label: "Profil", viewId: "athletes-profil" },
  { id: "suivi", label: "Suivi", viewId: "athletes-suivi" },
  { id: "protocoles", label: "Protocoles", viewId: "athletes-protocoles" },
];

export const landingStudioTabs: LandingStudioTab[] = [
  { id: "workout", label: "Workout", viewId: "studio-workout" },
  { id: "nutrition", label: "Nutrition", viewId: "studio-nutrition" },
  { id: "metrics", label: "Metrics", viewId: "studio-metrics" },
  { id: "morpho", label: "Morpho", viewId: "studio-morpho" },
  { id: "stryvr", label: "STRYVR", viewId: "studio-stryvr" },
];

export const landingExplorerViews: LandingExplorerView[] = [
  {
    id: "accueil",
    sectionId: "pilotage",
    defaultModuleId: "priorites",
    eyebrow: "Accueil",
    title: "Savoir où porter l’attention aujourd’hui.",
    description:
      "Portefeuille, priorités et échanges : le contexte de chaque coaché reste disponible avant la prochaine action.",
  },
  {
    id: "athletes-profil",
    sectionId: "pilotage",
    defaultModuleId: "clients",
    eyebrow: "Coachés · Profil",
    title: "Un dossier complet, pas un fichier éparpillé.",
    description:
      "Objectif, historique, programmes, bilans et éléments récents restent réunis pour ne plus reconstruire le profil à chaque message.",
    preview: {
      src: "/landing-demo/client-profile-desktop.png",
      alt: "Interface réelle du profil coaché dans STRYV lab",
      label: "Profil coaché",
    },
  },
  {
    id: "athletes-suivi",
    sectionId: "metrics",
    defaultModuleId: "corps",
    eyebrow: "Coachés · Suivi",
    title: "Lire le suivi pour décider, pas seulement pour archiver.",
    description:
      "Données, retours et repères sont rapprochés pour préparer l’ajustement suivant avec le bon niveau de contexte.",
    preview: {
      src: "/landing-demo/client-metrics-desktop.png",
      alt: "Interface réelle de suivi des métriques dans STRYV lab",
      label: "Suivi coaché",
    },
  },
  {
    id: "athletes-protocoles",
    sectionId: "nutrition",
    defaultModuleId: "protocoles",
    eyebrow: "Coachés · Protocoles",
    title: "Prescrire, relire, ajuster — dans le même fil.",
    description:
      "Nutrition Studio relie le plan du coach, ce qui est vécu dans STRYVR et la décision d’ajustement.",
    preview: {
      src: "/landing-demo/nutrition-studio-builder-desktop.png",
      alt: "Interface réelle de Nutrition Studio dans STRYV lab",
      label: "Nutrition Studio",
    },
  },
  {
    id: "studio-workout",
    sectionId: "workout",
    defaultModuleId: "programmes",
    eyebrow: "Studio · Workout",
    title: "Construire des programmes reliés au terrain.",
    description:
      "Séances, progression et relecture de cohérence : la prescription reste lisible pour le coaché et utile pour l’ajustement.",
    preview: {
      src: "/landing-demo/workout-studio-builder-desktop.png",
      alt: "Interface réelle de Workout Studio dans STRYV lab",
      label: "Workout Studio",
    },
  },
  {
    id: "studio-nutrition",
    sectionId: "nutrition",
    defaultModuleId: "protocoles",
    eyebrow: "Studio · Nutrition",
    title: "Ajuster la nutrition sans reconstruire le plan.",
    description:
      "Protocoles, journées, portions et données de suivi restent liés : une décision se propage sans tout refaire à la main.",
    preview: {
      src: "/landing-demo/nutrition-studio-builder-desktop.png",
      alt: "Interface réelle de Nutrition Studio dans STRYV lab",
      label: "Nutrition Studio",
      mobileSrc: "/landing-v2/studios/nutrition-focus-mobile.png",
      mobileAlt: "Vue resserrée de Nutrition Studio sur mobile",
    },
  },
  {
    id: "studio-metrics",
    sectionId: "metrics",
    defaultModuleId: "overlays",
    eyebrow: "Studio · Data Metrics",
    title: "Croiser les signaux sur la même période.",
    description:
      "Corps, nutrition, récupération et performance éclairent ce qui mérite une décision — pas seulement ce qui s’est passé.",
    preview: {
      src: "/landing-demo/client-metrics-desktop.png",
      alt: "Interface réelle de Data Metrics dans STRYV lab",
      label: "Data Metrics",
      mobileSrc: "/landing-v2/intelligence/performance-focus-mobile.png",
      mobileAlt: "Vue resserrée des données de performance sur mobile",
    },
  },
  {
    id: "studio-morpho",
    sectionId: "morpho",
    defaultModuleId: "comparaison",
    eyebrow: "Studio · Morpho Pro",
    title: "Documenter l’observation visuelle dans le temps.",
    description:
      "Photos, comparaisons et annotations restent rattachées au dossier et aux choix de programmation.",
    preview: {
      src: "/landing-demo/morphopro-desktop.png",
      alt: "Interface réelle de Morpho Pro dans STRYV lab",
      label: "Morpho Pro",
      mobileSrc: "/landing-demo/morphopro-focus-mobile.png",
      mobileAlt: "Vue resserrée de Morpho Pro sur mobile",
    },
  },
  {
    id: "studio-stryvr",
    sectionId: "stryvr",
    defaultModuleId: "today",
    eyebrow: "Studio · STRYVR",
    title: "Le protocole devient le quotidien du coaché.",
    description:
      "STRYVR rend l’exécution claire, puis ramène séances, repas et check-ins au bon endroit dans STRYV lab.",
    preview: {
      src: "/landing-v2/hero/client-context.png",
      alt: "Aperçu de l’expérience client STRYVR",
      label: "Aperçu STRYVR",
      mobileSrc: "/landing-v2/hero/client-context-mobile.png",
      mobileAlt: "Aperçu de l’expérience client STRYVR sur mobile",
    },
  },
  {
    id: "business",
    sectionId: "business",
    defaultModuleId: "portfolio",
    eyebrow: "Business",
    title: "Faire tourner l’activité sans quitter le suivi.",
    description:
      "Rendez-vous, tâches, paiements et alertes restent liés aux coachés concernés — l’opérationnel au service du coaching.",
    preview: {
      src: "/landing-demo/business.png",
      alt: "Interface réelle Business de STRYV lab",
      label: "Business",
    },
  },
  {
    id: "compte",
    sectionId: "account",
    defaultModuleId: "profil-coach",
    eyebrow: "Mon compte",
    title: "Votre environnement, sous votre contrôle.",
    description:
      "Préférences, notifications et cadre de travail qui structurent votre espace coach.",
  },
];

export const landingModulePreviews: Partial<Record<string, ExplorerPreview>> = {
  "pilotage-clients": {
    src: "/landing-demo/clients.png",
    alt: "Liste réelle des coachés dans STRYV lab",
    label: "Athlètes · Coachés",
  },
  "pilotage-priorites": {
    src: "/landing-demo/dashboard.png",
    alt: "Tableau de bord réel STRYV lab avec les priorités coach",
    label: "Accueil · Priorités",
    mobileSrc: "/landing-demo/dashboard-focus-mobile.png",
    mobileAlt: "Vue resserrée des priorités du coach sur mobile",
  },
  "pilotage-bilans": {
    src: "/landing-demo/client-profile-desktop.png",
    alt: "Profil coaché réel STRYV lab avec les informations de suivi",
    label: "Athlètes · Bilans",
  },
  "workout-programmes": {
    src: "/landing-demo/workout-studio-builder-desktop.png",
    alt: "Interface réelle de construction de programme dans Workout Studio",
    label: "Workout Studio · Programmes",
    mobileSrc: "/landing-v2/studios/workout-focus-mobile.png",
    mobileAlt: "Vue resserrée de la construction du programme sur mobile",
  },
  "workout-seances": {
    src: "/landing-demo/workout-studio-builder-desktop.png",
    alt: "Interface réelle de construction de séances dans Workout Studio",
    label: "Workout Studio · Séances",
    mobileSrc: "/landing-v2/studios/workout-focus-mobile.png",
    mobileAlt: "Vue resserrée des séances dans Workout Studio sur mobile",
  },
  "workout-smart-fit": {
    src: "/landing-v2/studios/workout-studio.png",
    alt: "Interface réelle de Smart Workout avec relecture du programme et alertes",
    label: "Workout Studio · Smart Workout",
  },
  "workout-alternatives": {
    src: "/landing-demo/workout-studio-builder-desktop.png",
    alt: "Interface réelle de construction de programme dans Workout Studio",
    label: "Workout Studio · Alternatives",
    mobileSrc: "/landing-v2/studios/workout-focus-mobile.png",
    mobileAlt: "Vue resserrée des exercices dans Workout Studio sur mobile",
  },
  "workout-performance": {
    src: "/landing-demo/client-performances-desktop.png",
    alt: "Interface réelle de performances coaché dans STRYV lab",
    label: "Suivi · Performance",
  },
  "nutrition-protocoles": {
    src: "/landing-demo/nutrition-studio-builder-desktop.png",
    alt: "Interface réelle de Nutrition Studio avec le protocole coach",
    label: "Nutrition Studio · Plan vivant",
    mobileSrc: "/landing-v2/studios/nutrition-focus-mobile.png",
    mobileAlt: "Vue resserrée du plan nutritionnel sur mobile",
  },
  "nutrition-jours": {
    src: "/landing-demo/nutrition-studio-builder-desktop.png",
    alt: "Interface réelle de Nutrition Studio avec les journées nutritionnelles",
    label: "Nutrition Studio · Jours & repas",
    mobileSrc: "/landing-v2/studios/nutrition-focus-mobile.png",
    mobileAlt: "Vue resserrée des jours et repas sur mobile",
  },
  "nutrition-tdee": {
    src: "/landing-demo/nutrition-studio-desktop.png",
    alt: "Interface réelle de Nutrition Studio avec TDEE client actif",
    label: "Nutrition Studio · TDEE adaptatif",
  },
  "nutrition-reality": {
    src: "/landing-demo/client-nutrition-data-desktop.png",
    alt: "Données nutritionnelles réelles d’un coaché dans STRYV lab",
    label: "Suivi · Réalité nutritionnelle",
  },
  "metrics-synthese": {
    src: "/landing-demo/client-performances-desktop.png",
    alt: "Interface réelle de performances coaché dans STRYV lab",
    label: "Data Metrics · Synthèse",
  },
  "morpho-galerie": {
    src: "/landing-demo/morphopro-desktop.png",
    alt: "Interface réelle Morpho Pro dans STRYV lab",
    label: "Morpho Pro · Galerie",
    mobileSrc: "/landing-demo/morphopro-focus-mobile.png",
    mobileAlt: "Vue resserrée de Morpho Pro sur mobile",
  },
  "morpho-comparaison": {
    src: "/landing-demo/morphopro-desktop.png",
    alt: "Interface réelle Morpho Pro dans STRYV lab",
    label: "Morpho Pro · Comparer",
    mobileSrc: "/landing-demo/morphopro-focus-mobile.png",
    mobileAlt: "Vue resserrée de Morpho Pro sur mobile",
  },
  "morpho-annotations": {
    src: "/landing-demo/morphopro-desktop.png",
    alt: "Interface réelle Morpho Pro dans STRYV lab",
    label: "Morpho Pro · Annotations",
    mobileSrc: "/landing-demo/morphopro-focus-mobile.png",
    mobileAlt: "Vue resserrée de Morpho Pro sur mobile",
  },
  "morpho-analysis": {
    src: "/landing-demo/morphopro-desktop.png",
    alt: "Interface réelle Morpho Pro dans STRYV lab",
    label: "Morpho Pro · Analyse assistée",
    mobileSrc: "/landing-demo/morphopro-focus-mobile.png",
    mobileAlt: "Vue resserrée de Morpho Pro sur mobile",
  },
  "morpho-evolution": {
    src: "/landing-demo/morphopro-desktop.png",
    alt: "Interface réelle Morpho Pro dans STRYV lab",
    label: "Morpho Pro · Évolution",
    mobileSrc: "/landing-demo/morphopro-focus-mobile.png",
    mobileAlt: "Vue resserrée de Morpho Pro sur mobile",
  },
  "morpho-coherence": {
    src: "/landing-demo/morphopro-desktop.png",
    alt: "Interface réelle Morpho Pro dans STRYV lab",
    label: "Morpho Pro · Cohérence",
    mobileSrc: "/landing-demo/morphopro-focus-mobile.png",
    mobileAlt: "Vue resserrée de Morpho Pro sur mobile",
  },
  "business-portfolio": {
    src: "/landing-demo/business.png",
    alt: "Interface réelle Business de STRYV lab",
    label: "Business · Portefeuille",
    mobileSrc: "/landing-demo/business-focus-mobile.png",
    mobileAlt: "Vue resserrée du portefeuille Business sur mobile",
  },
  "business-agenda": {
    src: "/landing-demo/dashboard.png",
    alt: "Tableau de bord réel STRYV lab avec les événements du jour",
    label: "Accueil · Agenda",
    mobileSrc: "/landing-demo/dashboard-focus-mobile.png",
    mobileAlt: "Vue resserrée des événements du jour sur mobile",
  },
  "business-kanban": {
    src: "/landing-demo/dashboard.png",
    alt: "Tableau de bord réel STRYV lab avec les tâches en cours",
    label: "Accueil · Kanban",
    mobileSrc: "/landing-demo/dashboard-focus-mobile.png",
    mobileAlt: "Vue resserrée des tâches en cours sur mobile",
  },
  "business-paiements": {
    src: "/landing-demo/comptabilite.png",
    alt: "Interface réelle de comptabilité STRYV lab",
    label: "Business · Paiements",
  },
  "business-alertes": {
    src: "/landing-demo/dashboard.png",
    alt: "Tableau de bord réel STRYV lab avec les alertes actives",
    label: "Accueil · Alertes",
    mobileSrc: "/landing-demo/dashboard-focus-mobile.png",
    mobileAlt: "Vue resserrée des alertes actives sur mobile",
  },
};
