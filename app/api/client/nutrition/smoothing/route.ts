import { NextResponse } from "next/server"

function removedResponse() {
  return NextResponse.json(
    { error: "Le lissage calorique n'est plus disponible côté client." },
    { status: 410 },
  )
}

export async function GET() {
  return removedResponse()
}

export async function POST() {
  return removedResponse()
}
