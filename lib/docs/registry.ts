export type DocsAudience = 'client' | 'coach'

export type DocsCategory =
  | 'workout'
  | 'progression'
  | 'execution'
  | 'programming'
  | 'nutrition'
  | 'decision-support'
  | 'analytics'
  | 'transformation'
  | 'phases'

export type DocsContext =
  | 'coach-documentation-index'
  | 'workout-studio'
  | 'client-profile-workout'
  | 'client-session'

export interface DocsEntry {
  id: string
  audience: DocsAudience
  title: string
  summary: string
  route: string
  categories: DocsCategory[]
  contexts: DocsContext[]
  keywords: string[]
  order: number
  featured?: boolean
}

export const DOCS_CATEGORY_META: Record<DocsCategory, { label: string; order: number }> = {
  workout: { label: 'Workout', order: 10 },
  progression: { label: 'Progression', order: 20 },
  execution: { label: 'Exécution', order: 30 },
  programming: { label: 'Programmation', order: 40 },
  nutrition: { label: 'Nutrition', order: 50 },
  'decision-support': { label: "Aide à la décision", order: 60 },
  analytics: { label: 'Analytics', order: 70 },
  transformation: { label: 'Transformation', order: 80 },
  phases: { label: 'Phases', order: 90 },
}

export const DOCS_CONTEXT_META: Record<DocsContext, { label: string; order: number }> = {
  'coach-documentation-index': { label: 'Documentation coach', order: 10 },
  'workout-studio': { label: 'Workout Studio', order: 20 },
  'client-profile-workout': { label: 'Profil client > Workout', order: 30 },
  'client-session': { label: 'Séance client', order: 40 },
}

export const docsRegistry: DocsEntry[] = [
  {
    id: 'coach-workout-mesocycles',
    audience: 'coach',
    title: 'Workout Studio — générer un mésocycle',
    summary:
      "Configurer un cycle de 2 à 12 semaines à partir d’une ou plusieurs semaines sources, avec progression du volume, évolution du RIR, deload et garde-fous.",
    route: '/coach/documentation/workout-mesocycles',
    categories: ['workout', 'progression', 'programming', 'decision-support'],
    contexts: ['coach-documentation-index', 'workout-studio'],
    keywords: ['mésocycle', 'cycle', 'volume', 'RIR', 'deload', 'semaine', 'workout studio'],
    order: 5,
    featured: true,
  },
  {
    id: 'coach-workout-progression',
    audience: 'coach',
    title: 'Workout Studio — logique de progression',
    summary:
      "Comprendre la différence entre la recommandation en séance et la progression du programme, pour paramétrer correctement reps, RIR, tempo et surcharge.",
    route: '/coach/documentation/workout-progression',
    categories: ['workout', 'progression', 'programming', 'decision-support'],
    contexts: ['coach-documentation-index', 'workout-studio'],
    keywords: ['RIR', 'tempo', 'reps', 'double progression', 'workout studio', 'charge'],
    order: 10,
    featured: true,
  },
  {
    id: 'coach-transformation-score',
    audience: 'coach',
    title: 'Score de transformation',
    summary:
      "Comprendre le score global du client, les dimensions utilisées, les poids selon l’objectif et les bonnes règles d’interprétation.",
    route: '/coach/documentation/transformation-score',
    categories: ['analytics', 'decision-support', 'transformation'],
    contexts: ['coach-documentation-index'],
    keywords: ['score', 'transformation', 'adhérence', 'récupération', 'performance'],
    order: 20,
    featured: true,
  },
  {
    id: 'coach-phase-optimization',
    audience: 'coach',
    title: 'Optimisation de phase',
    summary:
      "Comprendre la logique du verdict de phase, les signaux utilisés et la bonne lecture du moteur pour orienter une décision coach.",
    route: '/coach/documentation/phase-optimization',
    categories: ['decision-support', 'phases', 'transformation'],
    contexts: ['coach-documentation-index'],
    keywords: ['phase', 'optimisation', 'recovery', 'signals', 'decision'],
    order: 30,
    featured: true,
  },
  {
    id: 'coach-nutrition-smoothing',
    audience: 'coach',
    title: 'Nutrition Studio — lissage calorique coach',
    summary:
      "Comprendre quand le système recommande un lissage, comment l’écart est réparti, ce qui est modifié dans le plan alimentaire et ce que le client voit réellement.",
    route: '/coach/documentation/nutrition-smoothing',
    categories: ['nutrition', 'decision-support', 'programming'],
    contexts: ['coach-documentation-index'],
    keywords: ['nutrition studio', 'lissage', 'calories', 'meal plan', 'protocole', 'coach'],
    order: 40,
    featured: true,
  },
  {
    id: 'coach-adaptive-tdee',
    audience: 'coach',
    title: 'TDEE adaptatif — moteur de régression métabolique',
    summary:
      "Comprendre le fonctionnement du TDEE adaptatif, le calibrage sur 14 jours, la gestion des fluctuations hydriques et menstruelles, et les règles de transition anti-bruit.",
    route: '/coach/documentation/adaptive-tdee',
    categories: ['nutrition', 'decision-support', 'analytics'],
    contexts: ['coach-documentation-index'],
    keywords: ['TDEE', 'adaptatif', 'métabolisme', 'poids lissé', 'calibrage', 'eau', 'glycogène', 'transition'],
    order: 50,
    featured: true,
  },
  {
    id: 'coach-cycle-sync',
    audience: 'coach',
    title: 'CycleSync — synchronisation menstruelle & nutrition',
    summary:
      "Configurer Cycle Sync, comprendre les profils, la confiance du cycle, l’ajustement des portions du plan alimentaire et les garde-fous coach.",
    route: '/coach/documentation/cycle-sync',
    categories: ['nutrition', 'decision-support', 'phases'],
    contexts: ['coach-documentation-index'],
    keywords: ['cycle menstruel', 'CycleSync', 'phase', 'règles', 'portions', 'profil prudent', 'cycle irrégulier', 'nutrition studio'],
    order: 60,
    featured: true,
  },
  {
    id: 'coach-tdee-waterfall',
    audience: 'coach',
    title: 'Cascade TDEE — décomposition de la dépense énergétique',
    summary:
      "Comprendre comment le système calcule et décompose le TDEE théorique (BMR, NEAT, EAT, TEF) et comment personnaliser chaque variable.",
    route: '/coach/documentation/tdee-waterfall',
    categories: ['nutrition', 'decision-support', 'analytics'],
    contexts: ['coach-documentation-index'],
    keywords: ['TDEE', 'BMR', 'NEAT', 'EAT', 'TEF', 'cascade', 'dépense énergétique', 'activité'],
    order: 70,
    featured: true,
  },
  {
    id: 'coach-nutrition-coherence',
    audience: 'coach',
    title: 'Score de cohérence & qualité des données nutritionnelles',
    summary:
      "Comprendre le score d'adhérence du client, l'impact des jours non loggés sur les algorithmes et comment valider la fiabilité des signaux.",
    route: '/coach/documentation/nutrition-coherence',
    categories: ['nutrition', 'decision-support', 'analytics'],
    contexts: ['coach-documentation-index'],
    keywords: ['adhérence', 'cohérence', 'logs', 'complétude', 'fiabilité', 'qualité des signaux'],
    order: 80,
    featured: true,
  },
  {
    id: 'coach-connected-ecosystem',
    audience: 'coach',
    title: 'Écosystème STRYVR — flux de données et impacts bidirectionnels',
    summary:
      "Comprendre comment les actions du coach et du client s'influencent mutuellement en temps réel à travers la nutrition, l'entraînement, CycleSync et la récupération.",
    route: '/coach/documentation/connected-ecosystem',
    categories: ['programming', 'decision-support', 'analytics'],
    contexts: ['coach-documentation-index'],
    keywords: ['écosystème', 'synchronisation', 'flux de données', 'impacts', 'bidirectionnel', 'PWA'],
    order: 90,
    featured: true,
  },
  {
    id: 'client-workout-progression',
    audience: 'client',
    title: 'Workout — comprendre la progression',
    summary:
      "Savoir lire les recommandations de charge, reps, RIR et tempo pendant la séance, et comprendre ce qui change pour la prochaine fois.",
    route: '/client/profil/documentation/workout/progression',
    categories: ['workout', 'progression', 'execution'],
    contexts: ['client-profile-workout', 'client-session'],
    keywords: ['workout', 'progression', 'charge', 'reps', 'RIR', 'tempo'],
    order: 10,
    featured: true,
  },
]

function sortDocs(left: DocsEntry, right: DocsEntry) {
  if (left.order !== right.order) return left.order - right.order
  return left.title.localeCompare(right.title, 'fr')
}

export function getDocsForAudience(audience: DocsAudience): DocsEntry[] {
  return docsRegistry.filter((doc) => doc.audience === audience).sort(sortDocs)
}

export function getDocsForAudienceAndContext(audience: DocsAudience, context: DocsContext): DocsEntry[] {
  return docsRegistry
    .filter((doc) => doc.audience === audience && doc.contexts.includes(context))
    .sort(sortDocs)
}

export function getDocsByRoute(route: string): DocsEntry | null {
  return docsRegistry.find((doc) => doc.route === route) ?? null
}

export function groupDocsByCategory(docs: DocsEntry[]) {
  return Object.entries(DOCS_CATEGORY_META)
    .sort(([, left], [, right]) => left.order - right.order)
    .map(([category, meta]) => ({
      category: category as DocsCategory,
      label: meta.label,
      docs: docs.filter((doc) => doc.categories.includes(category as DocsCategory)),
    }))
    .filter((group) => group.docs.length > 0)
}
