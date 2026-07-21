/**
 * Shared gate for /api/client/* handlers and middleware-aligned checks.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser, type ResolvedClient } from '@/lib/client/resolve-client'
import {
  assertClientAppEnabledForCoach,
  ClientAppAccessError,
} from '@/lib/billing/assertClientAppEnabled'

function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export type ClientApiContext = {
  user: User
  db: SupabaseClient
  client: ResolvedClient
  clientId: string
  coachId: string
}

/**
 * Auth + resolve client + assert coach plan allows STRYVR app.
 * Use at the top of any /api/client/* route that needs a full session.
 */
export async function requireClientApiAccess(
  select = 'id, coach_id, timezone',
): Promise<ClientApiContext | NextResponse> {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceDb()
  const client = await resolveClientFromUser(user.id, user.email, db, select)
  if (!client?.id) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const coachId = (client.coach_id as string | undefined) ?? null
  if (!coachId) {
    return NextResponse.json(
      { error: 'Coach introuvable pour ce client', code: 'CLIENT_APP_DISABLED' },
      { status: 403 },
    )
  }

  try {
    await assertClientAppEnabledForCoach(db, coachId)
  } catch (error) {
    if (error instanceof ClientAppAccessError) {
      return NextResponse.json(
        {
          error: 'L’application client n’est pas active pour ce coach.',
          code: 'CLIENT_APP_DISABLED',
        },
        { status: 403 },
      )
    }
    throw error
  }

  return {
    user,
    db,
    client,
    clientId: client.id as string,
    coachId,
  }
}

export function isClientApiContext(
  value: ClientApiContext | NextResponse,
): value is ClientApiContext {
  return !(value instanceof NextResponse) && 'clientId' in value
}
