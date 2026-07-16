import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import { checkDistributedRateLimit, rateLimitResponse } from "@/lib/security/public-rate-limit"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service()
    .from("coach_clients")
    .select("id")
    .eq("user_id", userId)
    .single()
  return data?.id ?? null
}

const WHISPER_PROMPT =
  "nutrition sportive, whey protéine, QNT Life, Light Digest Whey Protein, shaker, poudre de protéines, créatine, BCAA, caséine, isolat, grammes, millilitres, lait demi-écrémé, bibliothèque d'aliments perso, kcal, lipides, glucides"

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25MB Whisper limit

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const rateLimit = await checkDistributedRateLimit({
    db: service(),
    req,
    scope: "client_nutrition_voice_transcribe",
    subject: clientId,
    maxRequests: 10,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 })
  }

  const audio = formData.get("audio") as File | null
  if (!audio) return NextResponse.json({ error: "no_audio" }, { status: 400 })
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      // no language → auto-detect (handles FR/EN/ES mixed speech)
      prompt: WHISPER_PROMPT,
    })
    return NextResponse.json({ transcript: transcription.text })
  } catch {
    return NextResponse.json({ error: "transcription_failed" }, { status: 422 })
  }
}
