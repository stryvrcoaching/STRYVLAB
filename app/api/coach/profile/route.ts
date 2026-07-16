import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PLAN_LIMITS, type BillingStatus, type CoachPlan } from '@/lib/billing/plans'
import { z } from 'zod'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── GET /api/coach/profile ───────────────────────────────────────────────────
export async function GET() {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await serviceClient()
    .from('coach_profiles')
    .select('*')
    .eq('coach_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Always build fallback from auth metadata
  const meta = user.user_metadata ?? {}
  const firstName: string = meta.first_name ?? ''
  const lastName: string = meta.last_name ?? ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

  const fromMeta = {
    full_name:  fullName,
    brand_name: meta.coach_name ?? null,
    pro_email:  user.email ?? null,
    phone:      meta.phone_number ?? null,
  }

  if (data) {
    // Profile exists — fill null fields with auth metadata values
    return NextResponse.json({
      profile: {
        ...data,
        full_name:  data.full_name  ?? fromMeta.full_name,
        brand_name: data.brand_name ?? fromMeta.brand_name,
        pro_email:  data.pro_email  ?? fromMeta.pro_email,
        phone:      data.phone      ?? fromMeta.phone,
      }
    })
  }

  // No profile yet — return fully pre-filled from auth metadata
  return NextResponse.json({
    profile: {
      ...fromMeta,
      logo_url:    null,
      siret:       null,
      address:     null,
      vat_number:  null,
      notif_payment_reminder:      true,
      notif_payment_reminder_days: 3,
      notif_bilan_completed:       true,
      notif_onboarding_emails:     true,
      notif_inbox_assessments:     true,
      notif_inbox_training:        true,
      notif_inbox_messages:        true,
      notif_inbox_checkins:        true,
      notif_inbox_nutrition:       true,
      notif_inbox_health_progress: true,
      notif_inbox_administrative:  true,
      plan:                        'solo',
      billing_status:              'inactive',
      client_limit:                PLAN_LIMITS.solo.clientLimit,
      team_seats:                  PLAN_LIMITS.solo.teamSeats,
      has_ai_llm:                  false,
      ai_tone:                     null,
      ai_notif_email:              true,
      ai_notif_sms:                false,
      ai_escalation_threshold:     null,
    }
  })
}

// ─── PATCH /api/coach/profile ─────────────────────────────────────────────────
const patchSchema = z.object({
  full_name: z.string().max(100).nullable().optional(),
  brand_name: z.string().max(100).nullable().optional(),
  pro_email: z.string().email().nullable().optional().or(z.literal('')).or(z.literal(null)),
  phone: z.string().max(30).nullable().optional(),
  logo_url: z.string().nullable().optional(),
  company_name: z.string().max(160).nullable().optional(),
  billing_country: z.string().length(2).nullable().optional(),
  business_registration_number: z.string().max(40).nullable().optional(),
  siret: z.string().max(20).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  vat_number: z.string().max(20).nullable().optional(),
  notif_payment_reminder: z.boolean().optional(),
  notif_payment_reminder_days: z.number().int().min(1).max(30).optional(),
  notif_bilan_completed: z.boolean().optional(),
  notif_onboarding_emails: z.boolean().optional(),
  notif_inbox_assessments: z.boolean().optional(),
  notif_inbox_training: z.boolean().optional(),
  notif_inbox_messages: z.boolean().optional(),
  notif_inbox_checkins: z.boolean().optional(),
  notif_inbox_nutrition: z.boolean().optional(),
  notif_inbox_health_progress: z.boolean().optional(),
  notif_inbox_administrative: z.boolean().optional(),
  plan: z.enum(['solo', 'pro', 'studio']).optional(),
  billing_status: z.enum(['inactive', 'trialing', 'active', 'past_due', 'canceled']).optional(),
  client_limit: z.number().int().min(1).max(100000).nullable().optional(),
  team_seats: z.number().int().min(1).max(10000).nullable().optional(),
  // IA Coach
  has_ai_llm: z.boolean().optional(),
  ai_tone: z.enum(['strict', 'bienveillant', 'motivant', 'neutre']).nullable().optional(),
  ai_coach_name: z.string().nullable().optional(),
  ai_permissions: z.any().optional(),
  ai_custom_instructions: z.string().nullable().optional(),
  ai_notif_email: z.boolean().optional(),
  ai_notif_sms: z.boolean().optional(),
  ai_escalation_threshold: z.number().int().min(1).max(10).nullable().optional(),
}).partial();

export async function PATCH(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = patchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const db = serviceClient()
  const updates = { ...body.data }
  // Billing entitlement fields are managed by Stripe/webhooks, not by standard coach settings PATCH.
  delete updates.plan
  delete updates.billing_status
  delete updates.client_limit
  delete updates.team_seats

  // Upsert — create profile if it doesn't exist
  const { data, error } = await db
    .from('coach_profiles')
    .upsert(
      { coach_id: user.id, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
