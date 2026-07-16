import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'La création par mot de passe a été désactivée. Utilisez le lien sécurisé reçu par e-mail.',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
