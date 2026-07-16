export type OrganizerMode = 'agenda' | 'kanban' | 'both'

export type OrganizerClient = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

export type OrganizerPreset = {
  id: string
  label: string
  subtitle: string
  mode: OrganizerMode
  buildTitle: (clientName: string) => string
  buildNote: (clientName: string) => string
}

export type OrganizerCopyBlock = {
  title: string
  body: string
}

export type OrganizerHelpContent = {
  title: string
  intro: string
  items: string[]
  footer: string
}

type OrganizerContextKey =
  | 'nutrition'
  | 'training'
  | 'assessments'
  | 'performance'
  | 'dashboard'
  | 'clients'
  | 'client'
  | 'generic'

type OrganizerContextDefinition = {
  copy: OrganizerCopyBlock
  recommendedPresetId: string | null
  draft?: {
    title: (clientName: string) => string
    note: (clientName: string) => string
  }
}

export const ORGANIZER_PRESETS: OrganizerPreset[] = [
  {
    id: 'nutrition-follow-up',
    label: 'Suivi nutrition',
    subtitle: 'Nutrition',
    mode: 'both',
    buildTitle: (clientName) => `Suivi nutrition ${clientName}`,
    buildNote: (clientName) =>
      `Programmer un point nutrition avec ${clientName} pour suivre l'application du protocole et décider du prochain ajustement.`,
  },
  {
    id: 'formula-follow-up',
    label: 'Relance formule',
    subtitle: 'Commercial',
    mode: 'both',
    buildTitle: (clientName) => `Relance formule ${clientName}`,
    buildNote: (clientName) =>
      `Revenir vers ${clientName} sur la formule à activer ou à réattribuer.`,
  },
  {
    id: 'checkin-follow-up',
    label: 'Point check-in',
    subtitle: 'Suivi',
    mode: 'agenda',
    buildTitle: (clientName) => `Point check-in ${clientName}`,
    buildNote: (clientName) =>
      `Prévoir un point rapide avec ${clientName} sur son avancée et ses derniers retours.`,
  },
  {
    id: 'assessment-review',
    label: 'Bilan à traiter',
    subtitle: 'Analyse',
    mode: 'kanban',
    buildTitle: (clientName) => `Bilan à traiter ${clientName}`,
    buildNote: (clientName) =>
      `Traiter le bilan de ${clientName} et préparer la prochaine décision coach.`,
  },
  {
    id: 'performance-review',
    label: 'Point progression',
    subtitle: 'Performance',
    mode: 'both',
    buildTitle: (clientName) => `Point progression ${clientName}`,
    buildNote: (clientName) =>
      `Revoir les performances de ${clientName} et programmer le prochain ajustement utile.`,
  },
  {
    id: 'training-adjustment',
    label: 'Ajustement entraînement',
    subtitle: 'Workout',
    mode: 'both',
    buildTitle: (clientName) => `Ajustement entraînement ${clientName}`,
    buildNote: (clientName) =>
      `Programmer un point sur le protocole d'entraînement de ${clientName} et préparer le prochain ajustement coach.`,
  },
]

const DEFAULT_HELP_ITEMS = [
  'Choisis le client concerné.',
  'Choisis si tu veux une alerte, une tâche dashboard, ou les deux.',
  'Ajuste le titre et le contexte si besoin, puis enregistre.',
]

const GENERIC_CONTEXT_COPY: OrganizerCopyBlock = {
  title: 'Organisation coach',
  body: 'Crée une action claire pour retrouver ce sujet dans ton agenda, ton Kanban, ou les deux.',
}

const ORGANIZER_CONTEXTS: Record<OrganizerContextKey, OrganizerContextDefinition> = {
  nutrition: {
    copy: {
      title: 'Organisation nutrition',
      body: "Tu es dans Nutrition Studio. Ici, l'outil sert surtout à programmer un suivi nutrition, un ajustement à faire ou un rappel de décision coach.",
    },
    recommendedPresetId: 'nutrition-follow-up',
    draft: {
      title: (clientName) => `Suivi nutrition ${clientName}`,
      note: (clientName) => `Faire un point sur la mise en place nutrition de ${clientName} et décider du prochain ajustement.`,
    },
  },
  training: {
    copy: {
      title: 'Organisation entraînement',
      body: "Tu es dans Workout Studio. Ici, l'outil sert surtout à programmer un ajustement d'entraînement, un point progression ou un rappel de décision coach.",
    },
    recommendedPresetId: 'training-adjustment',
    draft: {
      title: (clientName) => `Ajustement entraînement ${clientName}`,
      note: (clientName) => `Faire un point sur le protocole d'entraînement de ${clientName} et décider du prochain ajustement utile.`,
    },
  },
  assessments: {
    copy: {
      title: 'Organisation bilan',
      body: "Tu es sur les bilans. Utilise l'outil pour te planifier un traitement, un retour client ou une action de relance.",
    },
    recommendedPresetId: 'assessment-review',
    draft: {
      title: (clientName) => `Bilan à traiter ${clientName}`,
      note: (clientName) => `Traiter le bilan de ${clientName}, préparer le retour et décider de la prochaine action coach.`,
    },
  },
  performance: {
    copy: {
      title: 'Organisation performance',
      body: "Tu es sur les performances. Utilise l'outil pour programmer une analyse, un ajustement ou un point progression.",
    },
    recommendedPresetId: 'performance-review',
    draft: {
      title: (clientName) => `Point progression ${clientName}`,
      note: (clientName) => `Revoir les performances de ${clientName} et planifier le prochain ajustement utile.`,
    },
  },
  dashboard: {
    copy: {
      title: 'Organisation du jour',
      body: 'Depuis le dashboard, privilégie les actions qui structurent ta journée et sécurisent tes suivis prioritaires.',
    },
    recommendedPresetId: 'checkin-follow-up',
  },
  clients: {
    copy: {
      title: 'Pilotage portefeuille',
      body: 'Depuis la liste clients, utilise cette sheet pour relancer, requalifier et remettre rapidement les dossiers en mouvement.',
    },
    recommendedPresetId: 'formula-follow-up',
  },
  client: {
    copy: {
      title: 'Action dossier client',
      body: 'Depuis un dossier client, transforme ton analyse en action concrète à traiter ou à reprogrammer.',
    },
    recommendedPresetId: 'assessment-review',
  },
  generic: {
    copy: GENERIC_CONTEXT_COPY,
    recommendedPresetId: null,
  },
}

const ORGANIZER_HELP_CONTENT: Record<OrganizerContextKey, OrganizerHelpContent> = {
  nutrition: {
    title: "Comment utiliser l'organisation ici",
    intro: "Depuis Nutrition Studio, cet outil te sert à transformer une observation nutrition en action concrète.",
    items: [
      'Utilise “Suivi nutrition” pour programmer un point coach après analyse du protocole.',
      'Utilise “Alerte” si tu veux simplement te faire rappeler un sujet à une date précise.',
      'Utilise “Les deux” si tu veux à la fois un rappel daté et une tâche visible dans ton dashboard.',
    ],
    footer: 'Le client courant est détecté automatiquement quand la page le permet, mais tu peux toujours en choisir un autre.',
  },
  training: {
    title: "Comment utiliser l'organisation ici",
    intro: "Depuis Workout Studio, cet outil te sert à transformer une décision sur l'entraînement en action concrète.",
    items: [
      'Utilise “Ajustement entraînement” pour programmer un vrai point coach sur le protocole.',
      'Utilise “Alerte” si tu veux simplement te faire rappeler de revenir sur ce sujet à une date précise.',
      'Utilise “Les deux” si tu veux un rappel daté et une tâche visible dans ton dashboard.',
    ],
    footer: 'Le client courant est détecté automatiquement sur cette page, mais tu peux toujours en choisir un autre.',
  },
  assessments: {
    title: "Comment utiliser l'organisation ici",
    intro: "Depuis les bilans, cet outil te sert à ne pas laisser une analyse sans suite concrète.",
    items: [
      'Utilise “Bilan à traiter” si tu dois reprendre le dossier avant de décider de la suite.',
      'Utilise “Alerte” si tu veux simplement te faire rappeler de revenir sur ce bilan à une date précise.',
      'Utilise “Les deux” si tu veux à la fois un rappel daté et une tâche visible dans ton dashboard.',
    ],
    footer: 'Le client courant est détecté automatiquement sur cette page, mais tu peux le remplacer si tu organises une autre action.',
  },
  performance: {
    title: "Comment utiliser l'organisation ici",
    intro: 'Depuis les performances, cet outil te sert à programmer une lecture coach claire et un prochain point progression.',
    items: [
      'Utilise “Point progression” pour transformer l’analyse en suivi concret.',
      'Utilise “Alerte” si tu veux revoir le sujet à une date précise.',
      'Utilise “Les deux” si tu veux un rappel daté et une tâche de suivi dans le dashboard.',
    ],
    footer: 'Le client courant est détecté automatiquement sur cette page, mais tu peux toujours changer de client.',
  },
  dashboard: {
    title: 'À quoi sert cet outil',
    intro: "Cet outil te permet d'enregistrer rapidement une action coach à partir de n'importe quelle page.",
    items: DEFAULT_HELP_ITEMS,
    footer: 'Quand le contexte de page est clair, l’outil te suggère automatiquement le client et les presets les plus utiles.',
  },
  clients: {
    title: 'À quoi sert cet outil',
    intro: "Cet outil te permet d'enregistrer rapidement une action coach à partir de n'importe quelle page.",
    items: DEFAULT_HELP_ITEMS,
    footer: 'Quand le contexte de page est clair, l’outil te suggère automatiquement le client et les presets les plus utiles.',
  },
  client: {
    title: 'À quoi sert cet outil',
    intro: "Cet outil te permet d'enregistrer rapidement une action coach à partir de n'importe quelle page.",
    items: DEFAULT_HELP_ITEMS,
    footer: 'Quand le contexte de page est clair, l’outil te suggère automatiquement le client et les presets les plus utiles.',
  },
  generic: {
    title: 'À quoi sert cet outil',
    intro: "Cet outil te permet d'enregistrer rapidement une action coach à partir de n'importe quelle page.",
    items: DEFAULT_HELP_ITEMS,
    footer: 'Quand le contexte de page est clair, l’outil te suggère automatiquement le client et les presets les plus utiles.',
  },
}

function getOrganizerContextKey(pathname: string | null): OrganizerContextKey {
  if (pathname?.includes('/protocoles/nutrition')) return 'nutrition'
  if (pathname?.includes('/protocoles/entrainement')) return 'training'
  if (pathname?.includes('/data/bilans')) return 'assessments'
  if (pathname?.includes('/data/performances')) return 'performance'
  if (pathname === '/dashboard') return 'dashboard'
  if (pathname === '/coach/clients') return 'clients'
  if (pathname?.startsWith('/coach/clients/')) return 'client'
  return 'generic'
}

export function getClientName(client: OrganizerClient | null) {
  if (!client) return ''
  return [client.first_name, client.last_name].filter(Boolean).join(' ').trim()
}

export function getRecommendationCopy(mode: OrganizerMode): OrganizerCopyBlock {
  if (mode === 'both') {
    return {
      title: 'Alerte + tâche',
      body: "Utilise ce mode si tu veux un rappel à une date précise et une action visible dans ton dashboard.",
    }
  }
  if (mode === 'agenda') {
    return {
      title: 'Alerte datée',
      body: 'Utilise ce mode si tu veux surtout te faire rappeler ce sujet à un moment précis.',
    }
  }
  return {
    title: 'Tâche dashboard',
    body: "Utilise ce mode si tu veux ajouter ce sujet dans ton flux de suivi sans créer d'horaire précis.",
  }
}

export function getContextCopy(pathname: string | null): OrganizerCopyBlock {
  return ORGANIZER_CONTEXTS[getOrganizerContextKey(pathname)].copy
}

export function getRecommendedPresetId(pathname: string | null) {
  return ORGANIZER_CONTEXTS[getOrganizerContextKey(pathname)].recommendedPresetId
}

export function getCurrentClientIdFromPath(pathname: string | null) {
  const match = pathname?.match(/^\/coach\/clients\/([^/]+)/)
  return match?.[1] ?? ''
}

export function getContextDraft(pathname: string | null, clientName: string) {
  const context = ORGANIZER_CONTEXTS[getOrganizerContextKey(pathname)]
  if (context.draft) {
    return {
      title: context.draft.title(clientName),
      note: context.draft.note(clientName),
    }
  }
  return { title: `Suivi ${clientName}`, note: '' }
}

export function getPresetById(presetId: string | null) {
  if (!presetId) return null
  return ORGANIZER_PRESETS.find((preset) => preset.id === presetId) ?? null
}

export function getOrderedPresets(recommendedPresetId: string | null) {
  if (!recommendedPresetId) return ORGANIZER_PRESETS
  const recommended = ORGANIZER_PRESETS.find((preset) => preset.id === recommendedPresetId)
  const others = ORGANIZER_PRESETS.filter((preset) => preset.id !== recommendedPresetId)
  return recommended ? [recommended, ...others] : ORGANIZER_PRESETS
}

export function getHelpContent(pathname: string | null): OrganizerHelpContent {
  return ORGANIZER_HELP_CONTENT[getOrganizerContextKey(pathname)]
}
