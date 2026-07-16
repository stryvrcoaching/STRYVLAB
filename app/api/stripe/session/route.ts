import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Ce parcours Stripe historique est désactivé.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
