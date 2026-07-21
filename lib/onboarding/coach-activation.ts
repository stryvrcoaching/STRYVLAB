/**
 * Coach activation onboarding — progressive categories + permanent "learn" module.
 * Plan-aware (Solo locks STRYVR with upgrade CTA; Pro/Studio unlock invite/app steps).
 */

import type { BillingStatus, CoachPlan } from '@/lib/billing/plans'
import { isClientAppEnabledForPlanState } from '@/lib/billing/assertClientAppEnabled'
import type { CoachPlanState } from '@/lib/billing/getCoachPlan'

export type ActivationCategoryId =
  | 'basics'
  | 'first_client'
  | 'prescription'
  | 'stryvr'
  | 'learn'

export type ActivationStepId =
  // basics
  | 'coach_profile'
  | 'first_formula'
  | 'first_assessment_template'
  | 'notifications_settings'
  // first client
  | 'create_client'
  | 'client_info'
  | 'client_sport'
  | 'assign_formula'
  // prescription
  | 'first_program'
  | 'first_nutrition'
  | 'first_assessment_use'
  // stryvr
  | 'upgrade_pro_for_app'
  | 'invite_client'
  | 'client_app_active'
  // learn (permanent, optional)
  | 'learn_assessments'
  | 'learn_setup'
  | 'learn_clients'
  | 'learn_client_profile'
  | 'learn_nutrition'
  | 'learn_programs'
  | 'learn_training'
  | 'learn_follow_up'
  | 'learn_metrics'
  | 'learn_checkins'
  | 'learn_morphopro'
  | 'learn_cardio_composition'
  | 'learn_organisation'
  | 'learn_inbox'
  | 'learn_client_app'
  | 'learn_documentation'
  | 'learn_ma_page'
  | 'learn_notifications'
  | 'learn_rewards'
  | 'learn_payments'

export type ActivationStepKind = 'action' | 'upgrade' | 'learn'

export type ActivationCtaMode = 'navigate' | 'checkout_or_portal'

export type ActivationStepDef = {
  id: ActivationStepId
  categoryId: ActivationCategoryId
  kind: ActivationStepKind
  label: string
  why: string
  ctaLabel: string
  /** Path template. `{clientId}` replaced when available. */
  href: string
  ctaMode?: ActivationCtaMode
  /** If true, step only appears when client app is enabled. */
  requiresClientApp?: boolean
  /** If true, step only appears when client app is NOT enabled (teaser + upgrade). */
  requiresNoClientApp?: boolean
  /** Progress category only — learn steps never block "next". */
  countsTowardProgress: boolean
}

export type ActivationCategoryDef = {
  id: ActivationCategoryId
  label: string
  hint: string
  /** learn = permanent module, not required for "bases done" */
  mode: 'progress' | 'learn'
}

export const ACTIVATION_CATEGORIES: ActivationCategoryDef[] = [
  {
    id: 'basics',
    label: 'Bases de l’espace',
    hint: 'Installer ton cabinet avant le premier suivi',
    mode: 'progress',
  },
  {
    id: 'first_client',
    label: 'Premier client',
    hint: 'Un dossier exploitable, pas juste un nom',
    mode: 'progress',
  },
  {
    id: 'prescription',
    label: 'Premier accompagnement',
    hint: 'Bilan, entraînement et nutrition',
    mode: 'progress',
  },
  {
    id: 'stryvr',
    label: 'App client STRYVR',
    hint: 'Activation de l’expérience client connectée',
    mode: 'progress',
  },
  {
    id: 'learn',
    label: 'Apprendre la plateforme',
    hint: 'Guides pratiques — toujours disponibles',
    mode: 'learn',
  },
]

export const ACTIVATION_STEPS: ActivationStepDef[] = [
  {
    id: 'coach_profile',
    categoryId: 'basics',
    kind: 'action',
    label: 'Compléter ton profil coach',
    why: 'Nom, marque et contact pour factures, Ma page et la crédibilité client.',
    ctaLabel: 'Ouvrir mon profil',
    href: '/coach/settings?section=profile',
    countsTowardProgress: true,
  },
  {
    id: 'first_formula',
    categoryId: 'basics',
    kind: 'action',
    label: 'Créer ta première formule',
    why: 'L’offre commerciale que tu assigneras ensuite à un client.',
    ctaLabel: 'Créer une formule',
    href: '/coach/formules',
    countsTowardProgress: true,
  },
  {
    id: 'first_assessment_template',
    categoryId: 'basics',
    kind: 'action',
    label: 'Créer un template de bilan',
    why: 'Le questionnaire que tu enverras pour cadrer le suivi.',
    ctaLabel: 'Créer un bilan',
    href: '/coach/assessments/templates/new',
    countsTowardProgress: true,
  },
  {
    id: 'notifications_settings',
    categoryId: 'basics',
    kind: 'action',
    label: 'Vérifier les notifications',
    why: 'Choisir ce que tu reçois (inbox, bilans, paiements, onboarding).',
    ctaLabel: 'Paramétrer',
    href: '/coach/settings?section=notifications',
    countsTowardProgress: true,
  },
  {
    id: 'create_client',
    categoryId: 'first_client',
    kind: 'action',
    label: 'Créer ton premier client',
    why: 'Le point de départ de toute la boucle de coaching.',
    ctaLabel: 'Nouveau client',
    href: '/coach/clients?create=1',
    countsTowardProgress: true,
  },
  {
    id: 'client_info',
    categoryId: 'first_client',
    kind: 'action',
    label: 'Compléter les informations client',
    why: 'Email / téléphone pour contacter et inviter.',
    ctaLabel: 'Fiche informations',
    href: '/coach/clients/{clientId}/profil?section=informations',
    countsTowardProgress: true,
  },
  {
    id: 'client_sport',
    categoryId: 'first_client',
    kind: 'action',
    label: 'Renseigner le profil sportif',
    why: 'Objectif, phase et niveau pour aligner prescription et outils.',
    ctaLabel: 'Profil sportif',
    href: '/coach/clients/{clientId}/profil?section=sport',
    countsTowardProgress: true,
  },
  {
    id: 'assign_formula',
    categoryId: 'first_client',
    kind: 'action',
    label: 'Assigner une formule au client',
    why: 'Lier l’offre commerciale au dossier (suivi + facturation).',
    ctaLabel: 'Offre & formules',
    href: '/coach/clients/{clientId}/profil?section=formules',
    countsTowardProgress: true,
  },
  {
    id: 'first_program',
    categoryId: 'prescription',
    kind: 'action',
    label: 'Créer un premier programme',
    why: 'Poser la structure d’entraînement du client.',
    ctaLabel: 'Programmes',
    href: '/coach/clients/{clientId}/protocoles/entrainement',
    countsTowardProgress: true,
  },
  {
    id: 'first_nutrition',
    categoryId: 'prescription',
    kind: 'action',
    label: 'Créer un protocole nutrition',
    why: 'Cibles et plan alimentaire rattachés au client.',
    ctaLabel: 'Nutrition',
    href: '/coach/clients/{clientId}/protocoles/nutrition',
    countsTowardProgress: true,
  },
  {
    id: 'first_assessment_use',
    categoryId: 'prescription',
    kind: 'action',
    label: 'Utiliser un bilan avec un client',
    why: 'Envoyer ou recevoir un premier questionnaire rempli.',
    ctaLabel: 'Bilans',
    href: '/coach/clients/{clientId}/data/bilans',
    countsTowardProgress: true,
  },
  {
    id: 'upgrade_pro_for_app',
    categoryId: 'stryvr',
    kind: 'upgrade',
    label: 'Activer l’app client STRYVR',
    why: 'Disponible avec le plan Pro (ou Studio). Passez au plan adapté pour inviter vos clients dans l’app.',
    ctaLabel: 'Passer en Pro',
    href: '/coach/settings?section=plan&intent=upgrade_pro',
    ctaMode: 'checkout_or_portal',
    requiresNoClientApp: true,
    countsTowardProgress: true,
  },
  {
    id: 'invite_client',
    categoryId: 'stryvr',
    kind: 'action',
    label: 'Inviter le client dans STRYVR',
    why: 'Envoyer l’accès pour que les données remontent dans ton cockpit.',
    ctaLabel: 'Envoyer l’accès',
    href: '/coach/clients/{clientId}/profil?section=acces',
    requiresClientApp: true,
    countsTowardProgress: true,
  },
  {
    id: 'client_app_active',
    categoryId: 'stryvr',
    kind: 'action',
    label: 'Client connecté à l’app',
    why: 'Le client a activé son compte (mot de passe / accès actif).',
    ctaLabel: 'Voir l’accès',
    href: '/coach/clients/{clientId}/profil?section=acces',
    requiresClientApp: true,
    countsTowardProgress: true,
  },
  {
    id: 'learn_setup',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Configurer mon espace coach',
    why: 'Profil, offre et réglages pour partir sur une base claire.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/setup',
    countsTowardProgress: false,
  },
  {
    id: 'learn_clients',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Créer et organiser mes clients',
    why: 'Créer un dossier exploitable et retrouver les priorités du portefeuille.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/clients',
    countsTowardProgress: false,
  },
  {
    id: 'learn_client_profile',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Comprendre le dossier client',
    why: 'Profil, accès, données et prescriptions réunis au bon endroit.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/client-profile',
    countsTowardProgress: false,
  },
  {
    id: 'learn_assessments',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Bilans & questionnaires',
    why: 'Construire un template, l’envoyer, lire les réponses.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/assessments',
    countsTowardProgress: false,
  },
  {
    id: 'learn_programs',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Templates d’entraînement',
    why: 'Bibliothèque de programmes à assigner aux clients.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/programs',
    countsTowardProgress: false,
  },
  {
    id: 'learn_nutrition',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Protocoles nutrition',
    why: 'Créer et piloter un protocole depuis le dossier client.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/nutrition',
    countsTowardProgress: false,
  },
  {
    id: 'learn_training',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Prescrire l’entraînement',
    why: 'Construire, ajuster et partager un programme dans le dossier client.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/training',
    countsTowardProgress: false,
  },
  {
    id: 'learn_follow_up',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Suivre un accompagnement',
    why: 'Lire les données client et décider du prochain ajustement.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/follow-up',
    countsTowardProgress: false,
  },
  {
    id: 'learn_metrics',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Lire les métriques et performances',
    why: 'Poids, mensurations et entraînement réel pour objectiver le suivi.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/metrics',
    countsTowardProgress: false,
  },
  {
    id: 'learn_checkins',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Exploiter les check-ins',
    why: 'Transformer les retours quotidiens du client en décisions utiles.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/checkins',
    countsTowardProgress: false,
  },
  {
    id: 'learn_morphopro',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Utiliser MorphoPro',
    why: 'Observer l’évolution corporelle avec un contexte de coaching.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/morphopro',
    countsTowardProgress: false,
  },
  {
    id: 'learn_cardio_composition',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Cardio et composition corporelle',
    why: 'Compléter une prescription avec les protocoles adaptés.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/cardio-composition',
    countsTowardProgress: false,
  },
  {
    id: 'learn_ma_page',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Ma page business',
    why: 'Ton mini-site public, formules affichées, QR et publication.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/ma-page',
    countsTowardProgress: false,
  },
  {
    id: 'learn_organisation',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Organiser ma journée coach',
    why: 'Planifier les priorités, tâches et rendez-vous de suivi.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/organisation',
    countsTowardProgress: false,
  },
  {
    id: 'learn_inbox',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Gérer l’inbox coach',
    why: 'Centraliser les messages et les éléments qui demandent une réponse.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/inbox',
    countsTowardProgress: false,
  },
  {
    id: 'learn_client_app',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Mettre en route STRYVR',
    why: 'Inviter le client et comprendre ce qui remonte de l’app.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/client-app',
    countsTowardProgress: false,
  },
  {
    id: 'learn_documentation',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Approfondir les outils de décision',
    why: 'Comprendre les mécanismes avancés et leurs données sources.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/documentation',
    countsTowardProgress: false,
  },
  {
    id: 'learn_notifications',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Notifications & inbox',
    why: 'Régler ce qui arrive dans ton flux coach.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/notifications',
    countsTowardProgress: false,
  },
  {
    id: 'learn_rewards',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Boutique de récompenses',
    why: 'Gamification côté client (surtout utile avec STRYVR).',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/rewards',
    countsTowardProgress: false,
  },
  {
    id: 'learn_payments',
    categoryId: 'learn',
    kind: 'learn',
    label: 'Encaissements clients',
    why: 'Stripe Connect, demandes de paiement, abonnements clients.',
    ctaLabel: 'Commencer le guide',
    href: '/coach/apprendre/payments',
    countsTowardProgress: false,
  },
]

export type CoachActivationFacts = {
  plan: CoachPlan
  billingStatus: BillingStatus
  clientAppEnabled: boolean
  /** Has a Stripe subscription id in active/trialing/past_due */
  hasLiveSubscription: boolean
  hasCoachProfile: boolean
  hasFormula: boolean
  hasAssessmentTemplate: boolean
  /** Soft: coach opened notifications settings at least once — we use profile flag proxy */
  hasTouchedNotifications: boolean
  hasClient: boolean
  primaryClientId: string | null
  clientHasContact: boolean
  clientHasSport: boolean
  clientHasFormula: boolean
  clientInvitedOrActive: boolean
  clientPasswordSet: boolean
  hasProgram: boolean
  hasNutritionProtocol: boolean
  hasAssessmentActivity: boolean
}

export type ResolvedActivationStep = ActivationStepDef & {
  done: boolean
  locked: boolean
  hrefResolved: string
  /** Upgrade teaser when app not available */
  isUpgradeTeaser: boolean
}

export type ResolvedActivationCategory = {
  id: ActivationCategoryId
  label: string
  hint: string
  mode: 'progress' | 'learn'
  doneCount: number
  totalCount: number
  complete: boolean
  steps: ResolvedActivationStep[]
}

export type CoachActivationSnapshot = {
  plan: CoachPlan
  billingStatus: BillingStatus
  clientAppEnabled: boolean
  hasLiveSubscription: boolean
  primaryClientId: string | null
  /** Category that contains the next action — UI opens only this one by default */
  activeCategoryId: ActivationCategoryId | null
  progressDone: number
  progressTotal: number
  progressComplete: boolean
  nextStep: ResolvedActivationStep | null
  categories: ResolvedActivationCategory[]
}

/** Client row for first-cycle detection + deep-link targeting. */
export type ActivationClientCandidate = {
  id: string
  email: string | null
  phone: string | null
  training_goal: string | null
  transformation_phase: string | null
  fitness_level: string | null
  status: string | null
  password_set: boolean | null
  created_at: string | null
  hasFormula: boolean
  hasProgram: boolean
  hasNutrition: boolean
  hasAssessment: boolean
}

export function clientHasContact(c: ActivationClientCandidate): boolean {
  return Boolean((c.email && c.email.trim()) || (c.phone && c.phone.trim()))
}

export function clientHasSport(c: ActivationClientCandidate): boolean {
  return Boolean(c.training_goal || c.transformation_phase || c.fitness_level)
}

export function clientIsInvited(c: ActivationClientCandidate): boolean {
  return c.status === 'active' || c.status === 'suspended'
}

/**
 * Aggregate "first cycle" facts across ALL clients.
 * Onboarding validates that the coach has done each step at least once,
 * not that every client is complete.
 */
export function aggregateFirstCycleFacts(clients: ActivationClientCandidate[]): {
  hasClient: boolean
  clientHasContact: boolean
  clientHasSport: boolean
  clientHasFormula: boolean
  clientInvitedOrActive: boolean
  clientPasswordSet: boolean
  hasProgram: boolean
  hasNutritionProtocol: boolean
  hasAssessmentActivity: boolean
  /** Best complete client if any, else null */
  completeClientId: string | null
} {
  if (clients.length === 0) {
    return {
      hasClient: false,
      clientHasContact: false,
      clientHasSport: false,
      clientHasFormula: false,
      clientInvitedOrActive: false,
      clientPasswordSet: false,
      hasProgram: false,
      hasNutritionProtocol: false,
      hasAssessmentActivity: false,
      completeClientId: null,
    }
  }

  let completeClientId: string | null = null
  for (const c of clients) {
    const full =
      clientHasContact(c) &&
      clientHasSport(c) &&
      c.hasFormula &&
      c.hasProgram &&
      c.hasNutrition &&
      // assessment optional for "full" in some workflows — keep required for cycle
      c.hasAssessment &&
      clientIsInvited(c) &&
      c.password_set === true
    if (full) {
      completeClientId = c.id
      break
    }
  }

  return {
    hasClient: true,
    clientHasContact: clients.some(clientHasContact),
    clientHasSport: clients.some(clientHasSport),
    clientHasFormula: clients.some((c) => c.hasFormula),
    clientInvitedOrActive: clients.some(clientIsInvited),
    clientPasswordSet: clients.some((c) => c.password_set === true),
    hasProgram: clients.some((c) => c.hasProgram),
    hasNutritionProtocol: clients.some((c) => c.hasNutrition),
    hasAssessmentActivity: clients.some((c) => c.hasAssessment),
    completeClientId,
  }
}

/**
 * Deep-link target when a step is still open: first client missing that criterion.
 * Prefer most recently created incomplete match.
 */
export function pickGuideClientForStep(
  clients: ActivationClientCandidate[],
  stepId: ActivationStepId,
  clientAppEnabled: boolean,
): ActivationClientCandidate | null {
  if (clients.length === 0) return null

  const sorted = [...clients].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })

  const missing = (c: ActivationClientCandidate): boolean => {
    switch (stepId) {
      case 'client_info':
        return !clientHasContact(c)
      case 'client_sport':
        return !clientHasSport(c)
      case 'assign_formula':
        return !c.hasFormula
      case 'first_program':
        return !c.hasProgram
      case 'first_nutrition':
        return !c.hasNutrition
      case 'first_assessment_use':
        return !c.hasAssessment
      case 'invite_client':
        return clientAppEnabled && !clientIsInvited(c)
      case 'client_app_active':
        return clientAppEnabled && c.password_set !== true
      default:
        return false
    }
  }

  return sorted.find(missing) ?? sorted[0] ?? null
}

/**
 * @deprecated Use aggregateFirstCycleFacts + pickGuideClientForStep.
 * Kept as alias: returns a client useful for generic deep links (most recent).
 */
export function pickPrimaryClient(
  clients: ActivationClientCandidate[],
): ActivationClientCandidate | null {
  if (clients.length === 0) return null
  const sorted = [...clients].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
  return sorted[0] ?? null
}

export function resolveStepHref(href: string, clientId: string | null): string {
  if (!href.includes('{clientId}')) return href
  if (!clientId) {
    // Fallback: clients list (create) until a client exists
    return '/coach/clients?create=1'
  }
  return href.replaceAll('{clientId}', clientId)
}

/** Tag links so the continue bar + dashboard know we came from activation. */
export function withActivationQuery(href: string, stepId: string): string {
  const sep = href.includes('?') ? '&' : '?'
  return `${href}${sep}from=activation&step=${encodeURIComponent(stepId)}`
}

export function isStepDone(stepId: ActivationStepId, facts: CoachActivationFacts): boolean {
  switch (stepId) {
    case 'coach_profile':
      return facts.hasCoachProfile
    case 'first_formula':
      return facts.hasFormula
    case 'first_assessment_template':
      return facts.hasAssessmentTemplate
    case 'notifications_settings':
      return facts.hasTouchedNotifications
    case 'create_client':
      return facts.hasClient
    case 'client_info':
      return facts.clientHasContact
    case 'client_sport':
      return facts.clientHasSport
    case 'assign_formula':
      return facts.clientHasFormula
    case 'first_program':
      return facts.hasProgram
    case 'first_nutrition':
      return facts.hasNutritionProtocol
    case 'first_assessment_use':
      return facts.hasAssessmentActivity
    case 'upgrade_pro_for_app':
      return facts.clientAppEnabled
    case 'invite_client':
      return facts.clientInvitedOrActive
    case 'client_app_active':
      return facts.clientPasswordSet
    // learn: never auto-done (optional permanent module)
    case 'learn_assessments':
    case 'learn_setup':
    case 'learn_clients':
    case 'learn_client_profile':
    case 'learn_nutrition':
    case 'learn_programs':
    case 'learn_training':
    case 'learn_follow_up':
    case 'learn_metrics':
    case 'learn_checkins':
    case 'learn_morphopro':
    case 'learn_cardio_composition':
    case 'learn_organisation':
    case 'learn_inbox':
    case 'learn_client_app':
    case 'learn_documentation':
    case 'learn_ma_page':
    case 'learn_notifications':
    case 'learn_rewards':
    case 'learn_payments':
      return false
    default:
      return false
  }
}

function isStepVisible(def: ActivationStepDef, facts: CoachActivationFacts): boolean {
  if (def.requiresClientApp && !facts.clientAppEnabled) return false
  if (def.requiresNoClientApp && facts.clientAppEnabled) return false
  return true
}

/** Soft lock: steps that need a client before deep-linking into a dossier */
function isStepLocked(def: ActivationStepDef, facts: CoachActivationFacts, done: boolean): boolean {
  if (done) return false
  if (def.kind === 'upgrade') return false
  if (def.href.includes('{clientId}') && !facts.primaryClientId) {
    // Still clickable → falls back to create client
    return false
  }
  // Sequential soft lock within progress: only for UX display of "next"
  return false
}

export function buildCoachActivationSnapshot(
  facts: CoachActivationFacts,
  /** Optional: resolve deep-link client per open step */
  guideClientByStep?: Partial<Record<ActivationStepId, string | null>>,
): CoachActivationSnapshot {
  const categories: ResolvedActivationCategory[] = []
  let progressDone = 0
  let progressTotal = 0
  let nextStep: ResolvedActivationStep | null = null

  for (const cat of ACTIVATION_CATEGORIES) {
    const defs = ACTIVATION_STEPS.filter(
      (s) => s.categoryId === cat.id && isStepVisible(s, facts),
    )
    const steps: ResolvedActivationStep[] = defs.map((def) => {
      const done = isStepDone(def.id, facts)
      const locked = isStepLocked(def, facts, done)
      const guideId =
        guideClientByStep?.[def.id] ?? facts.primaryClientId
      const baseHref = resolveStepHref(def.href, guideId)
      const resolved: ResolvedActivationStep = {
        ...def,
        done,
        locked,
        hrefResolved: withActivationQuery(baseHref, def.id),
        isUpgradeTeaser: def.kind === 'upgrade',
      }
      if (def.countsTowardProgress) {
        progressTotal += 1
        if (done) progressDone += 1
      }
      if (
        !nextStep &&
        cat.mode === 'progress' &&
        def.countsTowardProgress &&
        !done
      ) {
        nextStep = resolved
      }
      return resolved
    })

    const countable = steps.filter((s) => s.countsTowardProgress)
    const doneCount = countable.filter((s) => s.done).length
    categories.push({
      id: cat.id,
      label: cat.label,
      hint: cat.hint,
      mode: cat.mode,
      doneCount,
      totalCount: countable.length || steps.length,
      complete:
        cat.mode === 'learn'
          ? false
          : countable.length > 0 && doneCount === countable.length,
      steps,
    })
  }

  return {
    plan: facts.plan,
    billingStatus: facts.billingStatus,
    clientAppEnabled: facts.clientAppEnabled,
    hasLiveSubscription: facts.hasLiveSubscription,
    primaryClientId: facts.primaryClientId,
    activeCategoryId: nextStep?.categoryId ?? null,
    progressDone,
    progressTotal,
    progressComplete: progressTotal > 0 && progressDone >= progressTotal,
    nextStep,
    categories,
  }
}

export function factsFromPlanState(
  planState: CoachPlanState,
  extras: Omit<
    CoachActivationFacts,
    'plan' | 'billingStatus' | 'clientAppEnabled'
  >,
): CoachActivationFacts {
  return {
    plan: planState.plan,
    billingStatus: planState.billingStatus,
    clientAppEnabled: isClientAppEnabledForPlanState(planState),
    ...extras,
  }
}
