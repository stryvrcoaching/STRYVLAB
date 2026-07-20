import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'

function toE164Digits(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, '') ?? ''
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null
}

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function currentCoach() {
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? null : user
}

export async function GET() {
  const user = await currentCoach()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = serviceClient()
  const [{ data: agent, error: agentError }, { data: profile, error: profileError }] = await Promise.all([
    db.from('coach_whatsapp_agents').select('enabled, phone_e164, action_policy, proactive_alerts_enabled').eq('coach_id', user.id).maybeSingle(),
    db.from('coach_profiles').select('phone, has_ai_llm').eq('coach_id', user.id).maybeSingle(),
  ])
  if (agentError || profileError) return NextResponse.json({ error: agentError?.message ?? profileError?.message }, { status: 500 })

  const phone = toE164Digits(profile?.phone)
  return NextResponse.json({
    agent: agent ?? null,
    phoneConfigured: Boolean(phone),
    aiEnabled: profile?.has_ai_llm === true,
  })
}

const patchSchema = z.object({ enabled: z.boolean() })

export async function PATCH(request: NextRequest) {
  const user = await currentCoach()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const db = serviceClient()
  const { data: profile, error: profileError } = await db
    .from('coach_profiles')
    .select('phone, has_ai_llm')
    .eq('coach_id', user.id)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile?.has_ai_llm) return NextResponse.json({ error: "Activez d'abord l’IA Coach." }, { status: 409 })

  const phone = toE164Digits(profile.phone)
  if (!phone) return NextResponse.json({ error: 'Ajoutez un numéro WhatsApp dans votre profil professionnel.' }, { status: 409 })

  const { data, error } = await db
    .from('coach_whatsapp_agents')
    .upsert({
      coach_id: user.id,
      phone_e164: phone,
      enabled: parsed.data.enabled,
      action_policy: 'confirm_all',
      proactive_alerts_enabled: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'coach_id' })
    .select('enabled, phone_e164, action_policy, proactive_alerts_enabled')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ agent: data })
}
