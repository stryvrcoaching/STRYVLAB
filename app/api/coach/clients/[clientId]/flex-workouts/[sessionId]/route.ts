import { NextRequest, NextResponse } from 'next/server'
import { assertCoachOwnsClient, requireAuthedUser, createServiceDb } from '@/lib/training/flexTraining/server'
import { fetchFlexWorkoutSession } from '@/lib/training/flexTraining/queries'
import { summarizeFlexWorkoutSession } from '@/lib/training/flexTraining/summary'

type Params = { params: { clientId: string; sessionId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await assertCoachOwnsClient(user.id, params.clientId)
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const db = createServiceDb()
  const { session, exercises } = await fetchFlexWorkoutSession(db, params.sessionId)
  if (!session || session.client_id !== params.clientId) {
    return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  }

  return NextResponse.json({
    session,
    exercises,
    summary: summarizeFlexWorkoutSession(session, exercises),
  })
}
