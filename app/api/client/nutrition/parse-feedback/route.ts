import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import type { NutritionParseFeedbackPayload } from "@/lib/nutrition/parse-feedback"
import { evaluateNutritionParse } from "@/lib/nutrition/parse-eval"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const parseItemSchema = z.object({
  name: z.string().min(1).max(160),
  quantity_g: z.number().min(0).max(5000),
  food_item_id: z.string().uuid().nullable().optional(),
  category_l1: z.string().max(50).nullable().optional(),
  category_l2: z.string().max(80).nullable().optional(),
})

const parseSnapshotSchema = z.object({
  items: z.array(parseItemSchema).max(30),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
})

const feedbackSchema = z.object({
  meal_id: z.string().uuid().nullable().optional(),
  source: z.enum(["voice", "text"]),
  transcript: z.string().min(3).max(2000),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
  parsed: parseSnapshotSchema,
  corrected: parseSnapshotSchema,
  notes: z.string().max(1000).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const payload = feedbackSchema.safeParse(await req.json())
  if (!payload.success) return NextResponse.json({ error: payload.error }, { status: 400 })

  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, "id")
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = payload.data as NutritionParseFeedbackPayload
  const parsedSnapshot = {
    ...body.parsed,
    meal_type: body.parsed.meal_type ?? body.meal_type ?? null,
  }
  const correctedSnapshot = {
    ...body.corrected,
    meal_type: body.corrected.meal_type ?? body.meal_type ?? null,
  }
  const metrics = evaluateNutritionParse(correctedSnapshot, parsedSnapshot)

  const { data, error } = await db
    .from("nutrition_parse_feedback")
    .insert({
      client_id: client.id,
      meal_id: body.meal_id ?? null,
      source: body.source,
      transcript: body.transcript,
      meal_type: body.meal_type ?? correctedSnapshot.meal_type ?? parsedSnapshot.meal_type ?? null,
      parsed_payload: {
        ...parsedSnapshot,
        metrics,
      },
      corrected_payload: correctedSnapshot,
      notes: body.notes ?? null,
      status: "pending",
    })
    .select("id, created_at")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 })
  }

  return NextResponse.json({
    id: data.id,
    created_at: data.created_at,
    metrics,
  }, { status: 201 })
}
