import { NextRequest, NextResponse } from 'next/server'
import { requireAuthedUser, resolveClientForUser, createServiceDb } from '@/lib/training/flexTraining/server'
import { fetchRecentFlexWorkouts } from '@/lib/training/flexTraining/queries'

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await resolveClientForUser(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '10') || 10))
  const db = createServiceDb()
  const sessions = await fetchRecentFlexWorkouts(db, client.id, limit)

  return NextResponse.json({ sessions })
}
