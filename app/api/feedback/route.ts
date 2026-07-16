import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { FEEDBACK_CATEGORIES, FEEDBACK_PRIORITIES, FEEDBACK_WORKSPACES } from '@/lib/feedback/types'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

export const dynamic = 'force-dynamic'

const feedbackSchema = z.object({
  workspace: z.enum(FEEDBACK_WORKSPACES),
  page_path: z.string().min(1).max(500),
  page_title: z.string().trim().max(200).optional().nullable(),
  category: z.enum(FEEDBACK_CATEGORIES),
  priority_user: z.enum(FEEDBACK_PRIORITIES),
  message: z.string().trim().min(8).max(4000),
  meta: z.object({
    viewport: z
      .object({
        width: z.number().int().positive().max(10000),
        height: z.number().int().positive().max(10000),
      })
      .optional(),
    route_label: z.string().trim().max(120).optional().nullable(),
    user_agent: z.string().trim().max(1000).optional().nullable(),
  }).optional(),
})

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function resolveCoachName(user: any, coachProfile: any) {
  return (
    coachProfile?.brand_name ??
    coachProfile?.full_name ??
    user?.user_metadata?.full_name ??
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') ??
    user?.email ??
    'Coach'
  )
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const parsed = feedbackSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
  }

  const db = serviceClient()
  const body = parsed.data

  const [clientRecord, coachProfileResult] = await Promise.all([
    resolveClientFromUser(
      user.id,
      user.email,
      db,
      'id, first_name, last_name, email',
    ),
    db
      .from('coach_profiles')
      .select('id, full_name, brand_name, pro_email')
      .eq('coach_id', user.id)
      .maybeSingle(),
  ])

  const coachProfile = coachProfileResult.data

  if (body.workspace === 'client_pwa' && !clientRecord) {
    return NextResponse.json({ error: 'Profil client introuvable' }, { status: 403 })
  }

  if (body.workspace === 'platform_web' && !coachProfile) {
    return NextResponse.json({ error: 'Profil coach introuvable' }, { status: 403 })
  }

  const sourceRole = body.workspace === 'client_pwa' ? 'client' : 'coach'
  const sourceName = body.workspace === 'client_pwa'
    ? [clientRecord?.first_name, clientRecord?.last_name].filter(Boolean).join(' ') || user.email || 'Client'
    : resolveCoachName(user, coachProfile)
  const sourceEmail = body.workspace === 'client_pwa'
    ? clientRecord?.email ?? user.email ?? null
    : coachProfile?.pro_email ?? user.email ?? null

  const meta = {
    ...(body.meta ?? {}),
    user_agent: body.meta?.user_agent ?? req.headers.get('user-agent'),
  }

  const { data, error } = await db
    .from('product_feedback')
    .insert({
      workspace: body.workspace,
      source_role: sourceRole,
      source_user_id: user.id,
      source_name: sourceName,
      source_email: sourceEmail,
      coach_client_id: clientRecord?.id ?? null,
      coach_profile_id: coachProfile?.id ?? null,
      page_path: body.page_path,
      page_title: body.page_title ?? null,
      category: body.category,
      priority_user: body.priority_user,
      message: body.message,
      meta,
    })
    .select('id, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, feedback: data }, { status: 201 })
}
