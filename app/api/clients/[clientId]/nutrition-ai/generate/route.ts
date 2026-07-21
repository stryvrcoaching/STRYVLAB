import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { coachOwnsClient } from "@/lib/security/client-resource-access"
import {
  generateNutritionDayDraft,
  nutritionAiGenerationInputSchema,
} from "@/lib/nutrition/ai-generation"
import { checkDistributedRateLimit, rateLimitResponse } from "@/lib/security/public-rate-limit"

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = serviceClient()
  if (!(await coachOwnsClient({ db, coachUserId: user.id, clientId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const rateLimit = await checkDistributedRateLimit({
    db,
    req,
    scope: "nutrition_ai_generation",
    subject: `${user.id}:${clientId}`,
    maxRequests: 10,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const parsed = nutritionAiGenerationInputSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Paramètres invalides" }, { status: 400 })
  }

  const [{ data: globalSettings }, { data: clientSettings }] = await Promise.all([
    db.from("coach_profiles").select("has_ai_llm").eq("coach_id", user.id).maybeSingle(),
    db
      .from("coach_ai_settings_per_client")
      .select("ai_llm_enabled, nutrition_generation_enabled, nutrition_publication_mode")
      .eq("coach_id", user.id)
      .eq("client_id", clientId)
      .maybeSingle(),
  ])
  if (
    !globalSettings?.has_ai_llm ||
    !clientSettings?.ai_llm_enabled ||
    !clientSettings?.nutrition_generation_enabled
  ) {
    return NextResponse.json(
      { error: "Activez l’IA pour ce client avant de générer un brouillon." },
      { status: 409 },
    )
  }

  const publicationMode = clientSettings?.nutrition_publication_mode ?? "coach_review"
  const inputSnapshot = { ...parsed.data, food_profile_required: true }
  const { data: run } = await db
    .from("nutrition_ai_generation_runs")
    .insert({
      client_id: clientId,
      coach_id: user.id,
      protocol_id: parsed.data.protocol_id ?? null,
      trigger_type: "coach_manual",
      publication_mode: publicationMode,
      status: "generating",
      input_snapshot: inputSnapshot,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle()

  try {
    const generated = await generateNutritionDayDraft({
      db,
      clientId,
      coachId: user.id,
      input: parsed.data,
    })
    const { context_snapshot: contextSnapshot, ...publicResult } = generated
    if (run?.id) {
      await db
        .from("nutrition_ai_generation_runs")
        .update({
          status: "needs_review",
          model: generated.model,
          input_snapshot: { ...inputSnapshot, context: contextSnapshot },
          output_snapshot: publicResult,
          safety_issues: generated.warnings,
          confidence: generated.confidence,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id)
    }
    return NextResponse.json({
      run_id: run?.id ?? null,
      status: "needs_review",
      publication_mode: publicationMode,
      ...publicResult,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Génération impossible"
    if (run?.id) {
      await db
        .from("nutrition_ai_generation_runs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id)
    }
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
