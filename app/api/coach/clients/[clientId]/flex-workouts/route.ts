import { NextRequest, NextResponse } from 'next/server'
import { assertCoachOwnsClient, requireAuthedUser, createServiceDb } from '@/lib/training/flexTraining/server'
import { fetchRecentFlexWorkouts } from '@/lib/training/flexTraining/queries'

type Params = { params: { clientId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await assertCoachOwnsClient(user.id, params.clientId)
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '10') || 10))
  const db = createServiceDb()
  const sessions = await fetchRecentFlexWorkouts(db, params.clientId, limit)

  return NextResponse.json({ sessions })
}
