import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/clients/[clientId]/ai-settings
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  // Ownership
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const { data: globalRow } = await db
    .from('coach_profiles')
    .select('has_ai_llm')
    .eq('coach_id', user.id)
    .maybeSingle()

  const { data: settings } = await db
    .from('coach_ai_settings_per_client')
    .select('ai_llm_enabled, ai_tone, monthly_quota, ai_morning_routine_enabled, ai_evening_routine_enabled, coaching_freedom, ai_chat_lang, nutrition_generation_enabled, nutrition_publication_mode, nutrition_allow_phase_adjustment')
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle()

  // Defaults si pas encore de ligne
  return NextResponse.json({
    global_ai_enabled: globalRow?.has_ai_llm ?? false,
    settings: settings ?? {
      ai_llm_enabled:       false,
      ai_tone:              null,
      monthly_quota:        null,
      ai_morning_routine_enabled: false,
      ai_evening_routine_enabled: false,
      coaching_freedom:     'none',
      ai_chat_lang:         null,
      nutrition_generation_enabled: false,
      nutrition_publication_mode: 'coach_review',
      nutrition_allow_phase_adjustment: false,
    }
  })
}

const putSchema = z.object({
  ai_llm_enabled: z.boolean().optional(),
  ai_tone:        z.string().max(50).nullable().optional(),
  monthly_quota:  z.number().int().min(1).max(100).nullable().optional(),
  ai_morning_routine_enabled: z.boolean().optional(),
  ai_evening_routine_enabled: z.boolean().optional(),
  coaching_freedom: z.enum(['none', 'safe', 'extended']).optional(),
  ai_chat_lang: z.enum(['fr', 'es', 'en']).nullable().optional(),
  nutrition_generation_enabled: z.boolean().optional(),
  nutrition_publication_mode: z.enum(['coach_review', 'coach_auto']).optional(),
  nutrition_allow_phase_adjustment: z.boolean().optional(),
})

// PUT /api/clients/[clientId]/ai-settings
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = putSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const db = service()

  // Ownership
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const { data, error } = await db
    .from('coach_ai_settings_per_client')
    .upsert(
      { coach_id: user.id, client_id: clientId, ...body.data },
      { onConflict: 'coach_id,client_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Upsert Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
