import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'

const requestSchema = z.object({
  requestType: z.enum([
    'access',
    'rectification',
    'erasure',
    'restriction',
    'objection',
    'portability',
    'other',
  ]),
  details: z.string().trim().max(1000).optional(),
})

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
  })
}

export async function GET() {
  const auth = createServerClient()
  const { data: { user }, error: authError } = await auth.auth.getUser()

  if (authError || !user) {
    return noStoreJson({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data, error } = await serviceClient()
    .from('privacy_requests')
    .select('id, request_type, status, received_at, statutory_due_at, extended_due_at, completed_at')
    .eq('requester_user_id', user.id)
    .order('received_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[privacy-requests] unable to list requests:', error.message)
    return noStoreJson({ error: 'Lecture impossible' }, { status: 500 })
  }

  return noStoreJson({ requests: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = createServerClient()
  const { data: { user }, error: authError } = await auth.auth.getUser()

  if (authError || !user?.email) {
    return noStoreJson({ error: 'Non authentifié' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return noStoreJson({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(json)
  if (!parsed.success) {
    return noStoreJson({ error: 'Demande invalide' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data, error } = await serviceClient()
    .from('privacy_requests')
    .insert({
      requester_user_id: user.id,
      requester_email: user.email,
      request_type: parsed.data.requestType,
      request_details: parsed.data.details || null,
      source: 'in_app',
      identity_verification_method: 'authenticated_session',
      identity_verified_at: now,
    })
    .select('id, request_type, status, received_at, statutory_due_at')
    .single()

  if (error?.code === '23505') {
    return noStoreJson(
      { error: 'Une demande du même type est déjà en cours.' },
      { status: 409 },
    )
  }

  if (error || !data) {
    console.error('[privacy-requests] unable to create request:', error?.message)
    return noStoreJson({ error: 'Enregistrement impossible' }, { status: 500 })
  }

  return noStoreJson({ request: data }, { status: 201 })
}
