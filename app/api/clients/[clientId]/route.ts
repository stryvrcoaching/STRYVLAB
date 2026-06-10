import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/clients/[clientId]
export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data, error } = await serviceClient()
    .from('coach_clients')
    .select('*')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  return NextResponse.json({ client: data })
}

// PATCH /api/clients/[clientId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json()
  const allowed = [
    'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender', 'notes', 'status',
    'transformation_phase', 'training_goal', 'fitness_level', 'sport_practice', 'weekly_frequency', 'equipment_category',
    'equipment',
    // CRM fields
    'address', 'city', 'emergency_contact_name', 'emergency_contact_phone',
    'acquisition_source', 'internal_notes',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Validate weekly_frequency bounds (1-7 days/week)
  if ('weekly_frequency' in update && update.weekly_frequency != null) {
    const freq = Number(update.weekly_frequency)
    if (isNaN(freq) || freq < 1 || freq > 7) {
      return NextResponse.json(
        { error: 'weekly_frequency must be between 1 and 7' },
        { status: 400 }
      )
    }
  }

  const service = serviceClient()

  const { data, error } = await service
    .from('coach_clients')
    .update(update)
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error || !data) {
    console.error('PATCH /api/clients/[id]:', error)
    return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
  }

  // Sync email in Supabase Auth if client has an active account
  if ('email' in update && update.email && data.user_id) {
    const { error: authError } = await service.auth.admin.updateUserById(data.user_id, {
      email: update.email as string,
    })
    if (authError) {
      console.error('PATCH /api/clients/[id] — sync auth email:', authError)
      // Non-blocking: DB is updated, Auth sync failure is logged only
    }
  }

  return NextResponse.json({ client: data })
}

// DELETE /api/clients/[clientId]?mode=archive|delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')

  if (mode !== 'archive' && mode !== 'delete') {
    return NextResponse.json({ error: 'Paramètre mode invalide (archive|delete)' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const service = serviceClient()

  const { data: clientRow, error: fetchError } = await service
    .from('coach_clients')
    .select('id, user_id, email')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (fetchError || !clientRow) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  if (mode === 'archive') {
    const { error: revokeError } = await service
      .from('client_access_tokens')
      .update({ revoked: true })
      .eq('client_id', params.clientId)
    if (revokeError) console.error('DELETE archive — revoke tokens:', revokeError)

    const { error } = await service
      .from('coach_clients')
      .update({ status: 'archived' })
      .eq('id', params.clientId)

    if (error) {
      console.error('DELETE archive:', error)
      return NextResponse.json({ error: 'Archivage impossible' }, { status: 500 })
    }

    return NextResponse.json({ mode: 'archive', clientId: params.clientId })
  }

  // Hard delete
  const { data: submissions } = await service
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', params.clientId)

  if (submissions && submissions.length > 0) {
    const submissionIds = submissions.map((s: { id: string }) => s.id)
    const { error: responsesError } = await service
      .from('assessment_responses')
      .delete()
      .in('submission_id', submissionIds)
    if (responsesError) {
      console.error('DELETE responses:', responsesError)
      return NextResponse.json({ error: 'Suppression réponses impossible' }, { status: 500 })
    }
  }

  const clientScopedTables = [
    'assessment_submissions',
    'client_access_tokens',
    'client_subscriptions',
    'metric_annotations',
  ]

  for (const table of clientScopedTables) {
    const { error } = await service
      .from(table)
      .delete()
      .eq('client_id', params.clientId)
    if (error) {
      console.error(`DELETE ${table}:`, error)
      return NextResponse.json({ error: `Suppression ${table} impossible` }, { status: 500 })
    }
  }

  const { error: clientDeleteError } = await service
    .from('coach_clients')
    .delete()
    .eq('id', params.clientId)

  if (clientDeleteError) {
    console.error('DELETE coach_clients:', clientDeleteError)
    return NextResponse.json({ error: 'Suppression client impossible' }, { status: 500 })
  }

  const authUserId = (clientRow as Record<string, unknown>).user_id as string | null | undefined
  const clientEmail = (clientRow as Record<string, unknown>).email as string | null | undefined

  if (authUserId) {
    // Never delete the coach's own auth account
    if (authUserId === user.id) {
      console.warn('DELETE client — skipping auth deletion: client user_id matches coach user_id', authUserId)
    } else {
      const { error: authDeleteError } = await service.auth.admin.deleteUser(authUserId)
      if (authDeleteError) {
        console.error('DELETE auth user (by id):', authDeleteError)
      }
    }
  } else if (clientEmail) {
    // Fallback: find auth user by email — only delete if not the coach's own account
    const { data: listData, error: listError } = await service.auth.admin.listUsers()
    if (!listError && listData) {
      const authUser = listData.users.find((u) => u.email === clientEmail)
      if (authUser && authUser.id !== user.id) {
        const { error: authDeleteError } = await service.auth.admin.deleteUser(authUser.id)
        if (authDeleteError) {
          console.error('DELETE auth user (by email):', authDeleteError)
        }
      } else if (authUser?.id === user.id) {
        console.warn('DELETE client — skipping auth deletion: email matches coach account', clientEmail)
      }
    }
  }

  return NextResponse.json({ mode: 'delete', clientId: params.clientId })
}
