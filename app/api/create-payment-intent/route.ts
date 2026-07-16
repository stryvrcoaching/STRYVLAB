import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'La création directe de paiements est désactivée.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
