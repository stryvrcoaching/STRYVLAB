export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { createSupabaseService } from "@/lib/nutrition/preps-service"
import { normalizeClientLang } from "@/lib/client/resolve-language"
import { buildPhotoMealFinalResult } from "@/lib/nutrition/photo-log-finalize"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"
import type { ClientLang } from "@/lib/i18n/clientTranslations"
import { resolveOwnedPhotoMealSessionWithRetry } from "@/lib/nutrition/photo-log-session-access"

const schema = z.object({
  session_id: z.string().uuid(),
  key: z.string().min(1),
  value: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 401 })

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = createSupabaseService()
  const { session, client } = await resolveOwnedPhotoMealSessionWithRetry({
    db,
    sessionId: body.data.session_id,
    user,
    sessionSelect: "id, analysis_summary, clarification_answers",
    clientSelect: "id",
  })
  if (!client) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 404 })
  const lang = normalizeClientLang(undefined) as ClientLang
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  const analysis = ((session as any).analysis_summary ?? null) as PhotoMealAnalysisSummary | null
  if (!analysis) return NextResponse.json({ error: "Analysis missing" }, { status: 400 })

  const answers = {
    ...(((session as any).clarification_answers ?? {}) as Record<string, string>),
    [body.data.key]: body.data.value,
  }

  const finalResult = buildPhotoMealFinalResult({ analysis, answers, lang })
  const nextStatus = finalResult.ready_to_log ? "ready_to_log" : "clarifying"

  const { error: updateError } = await db
    .from("client_photo_meal_logs")
    .update({
      status: nextStatus,
      clarification_answers: answers,
      analysis_result: finalResult,
    })
    .eq("id", body.data.session_id)
    .eq("client_id", String(client.id))

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ data: finalResult })
}
