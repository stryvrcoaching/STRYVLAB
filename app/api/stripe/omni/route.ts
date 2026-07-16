import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Ce checkout historique est désactivé.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
