import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Ce parcours B2C historique est définitivement désactivé.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
