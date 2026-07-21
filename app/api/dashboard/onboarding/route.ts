import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getCoachPlan } from '@/lib/billing/getCoachPlan'
import {
  aggregateFirstCycleFacts,
  buildCoachActivationSnapshot,
  factsFromPlanState,
  pickGuideClientForStep,
  type ActivationClientCandidate,
  type ActivationStepId,
  type CoachActivationFacts,
} from '@/lib/onboarding/coach-activation'

export const dynamic = 'force-dynamic'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = serviceClient()
  const coachId = user.id
  const planState = await getCoachPlan(db, coachId)

  const [profileRes, clientsRes, templatesRes, formulasRes] = await Promise.all([
    db
      .from('coach_profiles')
      .select(
        'full_name, brand_name, pro_email, phone, stripe_subscription_id, billing_status',
      )
      .eq('coach_id', coachId)
      .maybeSingle(),
    db
      .from('coach_clients')
      .select(
        'id, email, phone, training_goal, transformation_phase, fitness_level, status, password_set, created_at',
      )
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('assessment_templates')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId),
    db
      .from('coach_formulas')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId),
  ])

  const profile = profileRes.data
  const clients = clientsRes.data ?? []
  const clientIds = clients.map((c) => c.id)

  let formulaByClient = new Set<string>()
  let programByClient = new Set<string>()
  let nutritionByClient = new Set<string>()
  let assessmentByClient = new Set<string>()

  if (clientIds.length > 0) {
    const [subsRes, programsRes, nutritionRes, submissionsRes] =
      await Promise.all([
        db
          .from('client_subscriptions')
          .select('client_id')
          .in('client_id', clientIds),
        db
          .from('programs')
          .select('client_id')
          .eq('coach_id', coachId)
          .in('client_id', clientIds),
        db
          .from('nutrition_protocols')
          .select('client_id')
          .eq('coach_id', coachId)
          .in('client_id', clientIds),
        db
          .from('assessment_submissions')
          .select('client_id')
          .eq('coach_id', coachId)
          .in('client_id', clientIds),
      ])

    formulaByClient = new Set(
      (subsRes.data ?? [])
        .map((r) => r.client_id as string | null)
        .filter(Boolean) as string[],
    )
    programByClient = new Set(
      (programsRes.data ?? [])
        .map((r) => r.client_id as string | null)
        .filter(Boolean) as string[],
    )
    nutritionByClient = new Set(
      (nutritionRes.data ?? [])
        .map((r) => r.client_id as string | null)
        .filter(Boolean) as string[],
    )
    assessmentByClient = new Set(
      (submissionsRes.data ?? [])
        .map((r) => r.client_id as string | null)
        .filter(Boolean) as string[],
    )
  }

  const candidates: ActivationClientCandidate[] = clients.map((c) => ({
    id: c.id,
    email: c.email,
    phone: c.phone,
    training_goal: c.training_goal,
    transformation_phase: c.transformation_phase,
    fitness_level: c.fitness_level,
    status: c.status,
    password_set: c.password_set,
    created_at: c.created_at,
    hasFormula: formulaByClient.has(c.id),
    hasProgram: programByClient.has(c.id),
    hasNutrition: nutritionByClient.has(c.id),
    hasAssessment: assessmentByClient.has(c.id),
  }))

  // First-cycle completion = at least one client has each criterion (ANY client)
  const cycle = aggregateFirstCycleFacts(candidates)
  const factsPartial = factsFromPlanState(planState, {
    hasLiveSubscription: Boolean(
      profile?.stripe_subscription_id &&
        ['active', 'trialing', 'past_due'].includes(profile.billing_status ?? ''),
    ),
    hasCoachProfile: Boolean(
      (profile?.full_name && String(profile.full_name).trim()) ||
        (profile?.brand_name && String(profile.brand_name).trim()),
    ),
    hasFormula: (formulasRes.count ?? 0) > 0,
    hasAssessmentTemplate: (templatesRes.count ?? 0) > 0,
    hasTouchedNotifications: Boolean(
      (profile?.full_name && String(profile.full_name).trim()) ||
        (profile?.brand_name && String(profile.brand_name).trim()),
    ),
    hasClient: cycle.hasClient,
    // Deep-link fallback: complete client if any, else most recent
    primaryClientId:
      cycle.completeClientId ?? candidates[0]?.id ?? null,
    clientHasContact: cycle.clientHasContact,
    clientHasSport: cycle.clientHasSport,
    clientHasFormula: cycle.clientHasFormula,
    clientInvitedOrActive: cycle.clientInvitedOrActive,
    clientPasswordSet: cycle.clientPasswordSet,
    hasProgram: cycle.hasProgram,
    hasNutritionProtocol: cycle.hasNutritionProtocol,
    hasAssessmentActivity: cycle.hasAssessmentActivity,
  })

  // Per open step, deep-link to a client still missing that piece
  const guideSteps: ActivationStepId[] = [
    'client_info',
    'client_sport',
    'assign_formula',
    'first_program',
    'first_nutrition',
    'first_assessment_use',
    'invite_client',
    'client_app_active',
  ]
  const guideClientByStep: Partial<Record<ActivationStepId, string | null>> = {}
  for (const stepId of guideSteps) {
    const guide = pickGuideClientForStep(
      candidates,
      stepId,
      factsPartial.clientAppEnabled,
    )
    guideClientByStep[stepId] = guide?.id ?? factsPartial.primaryClientId
  }

  const snapshot = buildCoachActivationSnapshot(factsPartial, guideClientByStep)

  return NextResponse.json({
    ...snapshot,
    hasClient: factsPartial.hasClient,
    hasTemplate: factsPartial.hasAssessmentTemplate,
    hasFormula: factsPartial.hasFormula,
  })
}
