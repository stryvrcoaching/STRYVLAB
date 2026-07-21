import { describe, expect, it } from 'vitest'
import {
  aggregateFirstCycleFacts,
  buildCoachActivationSnapshot,
  isStepDone,
  pickGuideClientForStep,
  resolveStepHref,
  withActivationQuery,
  type ActivationClientCandidate,
  type CoachActivationFacts,
} from '@/lib/onboarding/coach-activation'

function baseFacts(overrides: Partial<CoachActivationFacts> = {}): CoachActivationFacts {
  return {
    plan: 'solo',
    billingStatus: 'active',
    clientAppEnabled: false,
    hasLiveSubscription: true,
    hasCoachProfile: false,
    hasFormula: false,
    hasAssessmentTemplate: false,
    hasTouchedNotifications: false,
    hasClient: false,
    primaryClientId: null,
    clientHasContact: false,
    clientHasSport: false,
    clientHasFormula: false,
    clientInvitedOrActive: false,
    clientPasswordSet: false,
    hasProgram: false,
    hasNutritionProtocol: false,
    hasAssessmentActivity: false,
    ...overrides,
  }
}

describe('resolveStepHref', () => {
  it('replaces clientId when present', () => {
    expect(
      resolveStepHref('/coach/clients/{clientId}/profil?section=acces', 'abc'),
    ).toBe('/coach/clients/abc/profil?section=acces')
  })

  it('falls back to create client when missing', () => {
    expect(resolveStepHref('/coach/clients/{clientId}/profil', null)).toBe(
      '/coach/clients?create=1',
    )
  })
})

describe('buildCoachActivationSnapshot', () => {
  it('shows upgrade teaser for Solo without client app', () => {
    const snap = buildCoachActivationSnapshot(baseFacts())
    const stryvr = snap.categories.find((c) => c.id === 'stryvr')
    expect(stryvr).toBeTruthy()
    expect(stryvr!.steps.some((s) => s.id === 'upgrade_pro_for_app')).toBe(true)
    expect(stryvr!.steps.some((s) => s.id === 'invite_client')).toBe(false)
    expect(snap.nextStep?.id).toBe('coach_profile')
  })

  it('shows invite steps when client app is enabled', () => {
    const snap = buildCoachActivationSnapshot(
      baseFacts({
        plan: 'pro',
        clientAppEnabled: true,
        hasCoachProfile: true,
        hasFormula: true,
        hasAssessmentTemplate: true,
        hasTouchedNotifications: true,
        hasClient: true,
        primaryClientId: 'c1',
        clientHasContact: true,
        clientHasSport: true,
        clientHasFormula: true,
        hasProgram: true,
        hasNutritionProtocol: true,
        hasAssessmentActivity: true,
      }),
    )
    const stryvr = snap.categories.find((c) => c.id === 'stryvr')!
    expect(stryvr.steps.some((s) => s.id === 'upgrade_pro_for_app')).toBe(false)
    expect(stryvr.steps.some((s) => s.id === 'invite_client')).toBe(true)
    expect(snap.nextStep?.id).toBe('invite_client')
  })

  it('keeps learn module permanent with no progress weight', () => {
    const snap = buildCoachActivationSnapshot(
      baseFacts({
        plan: 'pro',
        clientAppEnabled: true,
        hasCoachProfile: true,
        hasFormula: true,
        hasAssessmentTemplate: true,
        hasTouchedNotifications: true,
        hasClient: true,
        primaryClientId: 'c1',
        clientHasContact: true,
        clientHasSport: true,
        clientHasFormula: true,
        hasProgram: true,
        hasNutritionProtocol: true,
        hasAssessmentActivity: true,
        clientInvitedOrActive: true,
        clientPasswordSet: true,
      }),
    )
    expect(snap.progressComplete).toBe(true)
    const learn = snap.categories.find((c) => c.id === 'learn')!
    expect(learn.mode).toBe('learn')
    expect(learn.steps.length).toBeGreaterThan(0)
    expect(learn.steps.every((s) => !s.countsTowardProgress)).toBe(true)
  })

  it('marks assign_formula done when client has subscription', () => {
    expect(
      isStepDone(
        'assign_formula',
        baseFacts({ clientHasFormula: true }),
      ),
    ).toBe(true)
  })

  it('tags hrefs with activation query', () => {
    expect(withActivationQuery('/coach/formules', 'first_formula')).toBe(
      '/coach/formules?from=activation&step=first_formula',
    )
  })

  it('marks first-cycle steps done if ANY client completed them', () => {
    const complete: ActivationClientCandidate = {
      id: 'full',
      email: 'a@b.c',
      phone: null,
      training_goal: 'hypertrophy',
      transformation_phase: 'cut',
      fitness_level: 'intermediate',
      status: 'active',
      password_set: true,
      created_at: '2024-01-01T00:00:00Z',
      hasFormula: true,
      hasProgram: true,
      hasNutrition: true,
      hasAssessment: true,
    }
    const incomplete: ActivationClientCandidate = {
      id: 'empty',
      email: null,
      phone: null,
      training_goal: null,
      transformation_phase: null,
      fitness_level: null,
      status: 'inactive',
      password_set: false,
      created_at: '2026-01-01T00:00:00Z',
      hasFormula: false,
      hasProgram: false,
      hasNutrition: false,
      hasAssessment: false,
    }
    const cycle = aggregateFirstCycleFacts([incomplete, complete])
    expect(cycle.clientHasSport).toBe(true)
    expect(cycle.hasProgram).toBe(true)
    expect(cycle.hasNutritionProtocol).toBe(true)
    expect(cycle.clientPasswordSet).toBe(true)
    expect(cycle.completeClientId).toBe('full')

    const snap = buildCoachActivationSnapshot(
      baseFacts({
        plan: 'pro',
        clientAppEnabled: true,
        hasCoachProfile: true,
        hasFormula: true,
        hasAssessmentTemplate: true,
        hasTouchedNotifications: true,
        hasClient: true,
        primaryClientId: 'full',
        clientHasContact: cycle.clientHasContact,
        clientHasSport: cycle.clientHasSport,
        clientHasFormula: cycle.clientHasFormula,
        clientInvitedOrActive: cycle.clientInvitedOrActive,
        clientPasswordSet: cycle.clientPasswordSet,
        hasProgram: cycle.hasProgram,
        hasNutritionProtocol: cycle.hasNutritionProtocol,
        hasAssessmentActivity: cycle.hasAssessmentActivity,
      }),
    )
    expect(snap.progressComplete).toBe(true)
    expect(snap.nextStep).toBeNull()
  })

  it('guides deep-link to a client still missing the open step', () => {
    const withSport: ActivationClientCandidate = {
      id: 'a',
      email: 'a@b.c',
      phone: null,
      training_goal: 'strength',
      transformation_phase: null,
      fitness_level: null,
      status: 'inactive',
      password_set: false,
      created_at: '2025-01-01T00:00:00Z',
      hasFormula: false,
      hasProgram: false,
      hasNutrition: false,
      hasAssessment: false,
    }
    const noSport: ActivationClientCandidate = {
      id: 'b',
      email: 'b@b.c',
      phone: null,
      training_goal: null,
      transformation_phase: null,
      fitness_level: null,
      status: 'inactive',
      password_set: false,
      created_at: '2026-01-01T00:00:00Z',
      hasFormula: false,
      hasProgram: false,
      hasNutrition: false,
      hasAssessment: false,
    }
    expect(pickGuideClientForStep([withSport, noSport], 'client_sport', false)?.id).toBe(
      'b',
    )
  })
})
