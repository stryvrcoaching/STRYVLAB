import { NextResponse } from "next/server"

export async function DELETE() {
  return NextResponse.json(
    { error: "Le lissage calorique n'est plus disponible côté client." },
    { status: 410 },
  )
}
