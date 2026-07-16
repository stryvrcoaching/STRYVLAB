export type CoachPlan = 'solo' | 'pro' | 'studio'

export type BillingStatus =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'

export type Capability =
  | 'coach_dashboard_access'
  | 'client_management'
  | 'assessments_and_questionnaires'
  | 'nutrition_protocols'
  | 'training_programs'
  | 'pdf_exports'
  | 'client_app_access'
  | 'client_checkins'
  | 'client_routines'
  | 'client_progress_dashboard'
  | 'adherence_signals'
  | 'smart_recommendations'
  | 'coach_quick_actions'

export const PLAN_LIMITS: Record<CoachPlan, { clientLimit: number | null; teamSeats: number | null }> = {
  solo: { clientLimit: 5, teamSeats: 1 },
  pro: { clientLimit: 30, teamSeats: 1 },
  studio: { clientLimit: null, teamSeats: 1 },
}

export const PLAN_CAPABILITIES: Record<CoachPlan, Capability[]> = {
  solo: [
    'coach_dashboard_access',
    'client_management',
    'assessments_and_questionnaires',
    'nutrition_protocols',
    'training_programs',
    'pdf_exports',
  ],
  pro: [
    'coach_dashboard_access',
    'client_management',
    'assessments_and_questionnaires',
    'nutrition_protocols',
    'training_programs',
    'pdf_exports',
    'client_app_access',
    'client_checkins',
    'client_routines',
    'client_progress_dashboard',
    'adherence_signals',
    'smart_recommendations',
    'coach_quick_actions',
  ],
  studio: [
    'coach_dashboard_access',
    'client_management',
    'assessments_and_questionnaires',
    'nutrition_protocols',
    'training_programs',
    'pdf_exports',
    'client_app_access',
    'client_checkins',
    'client_routines',
    'client_progress_dashboard',
    'adherence_signals',
    'smart_recommendations',
    'coach_quick_actions',
  ],
}

export function getCapabilities(plan: CoachPlan): Set<Capability> {
  return new Set(PLAN_CAPABILITIES[plan] ?? PLAN_CAPABILITIES.solo)
}

export function hasCapability(plan: CoachPlan, capability: Capability): boolean {
  return getCapabilities(plan).has(capability)
}
