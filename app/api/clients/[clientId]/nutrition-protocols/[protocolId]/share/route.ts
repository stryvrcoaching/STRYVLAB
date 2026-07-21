import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ensureProtocolSharedAnnotation } from '@/lib/nutrition/protocolAnnotations'
import { activateNutritionProtocolAssignment, closeNutritionProtocolAssignment } from '@/lib/assignments/clientAssignments'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import {
  loadProtocolDaysForFoodValidation,
  validateProtocolFoodCompatibility,
} from '@/lib/nutrition/protocol-food-validation'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; protocolId: string }> }
) {
  const { clientId, protocolId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  const { data: cc } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: protocol } = await db
    .from('nutrition_protocols')
    .select('id, name')
    .eq('id', protocolId)
    .eq('client_id', clientId)
    .single()
  if (!protocol) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const foodValidation = await validateProtocolFoodCompatibility({
    db,
    clientId,
    days: await loadProtocolDaysForFoodValidation(db, protocolId),
  })
  if (foodValidation.issues.length > 0) {
    return NextResponse.json(
      {
        error:
          foodValidation.issues[0].status === 'profile_unknown'
            ? 'Le statut allergique doit être confirmé avant le partage.'
            : 'Le protocole contient un aliment bloqué ou dont la compatibilité doit être vérifiée.',
        food_compatibility_issues: foodValidation.issues,
      },
      { status: 409 },
    )
  }

  const { data: currentlyShared } = await db
    .from('nutrition_protocols')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'shared')
    .neq('id', protocolId)

  // Archive any previously shared protocol for this client
  await db
    .from('nutrition_protocols')
    .update({ status: 'draft' })
    .eq('client_id', clientId)
    .eq('status', 'shared')
    .neq('id', protocolId)

  for (const row of currentlyShared ?? []) {
    await closeNutritionProtocolAssignment(db, {
      clientId,
      protocolId: (row as any).id,
      endedBy: user.id,
      reason: 'replace',
    })
  }

  // Set this protocol as shared
  await db
    .from('nutrition_protocols')
    .update({ status: 'shared' })
    .eq('id', protocolId)

  const annotationId = await ensureProtocolSharedAnnotation(db, {
    clientId,
    coachId: user.id,
    protocolId,
    protocolName: protocol.name,
  })

  await activateNutritionProtocolAssignment(db, {
    clientId,
    coachId: user.id,
    protocolId,
    startedBy: user.id,
    sourceAnnotationId: annotationId ?? null,
  })

  await createClientAppNotification(db, {
    clientId,
    coachId: user.id,
    type: 'program_updated',
    copyKey: 'nutrition.available',
    actionUrl: '/client/nutrition',
    pushKind: 'program',
    pushTag: `stryv-nutrition-shared-${protocolId}`,
    payload: { protocol_id: protocolId },
  })

  return NextResponse.json({ success: true })
}
