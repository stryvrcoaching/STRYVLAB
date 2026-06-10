import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const patchSchema = z.object({
  hand_length_cm: z.number().min(10).max(28).nullable(),
})

/**
 * GET /api/client/profile-scaling
 * Returns { hand_length_cm, height_cm } for portion scaling.
 * height_cm is read from latest assessment_submission (poids/taille).
 */
export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = service()
  const { data: cc } = await db
    .from("coach_clients")
    .select("id, hand_length_cm")
    .eq("user_id", user.id)
    .single()
  if (!cc) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  // Latest height from assessment_submissions
  const { data: latestSub } = await db
    .from("assessment_submissions")
    .select("responses")
    .eq("client_id", cc.id)
    .eq("status", "completed")
    .order("bilan_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  let height_cm: number | null = null
  if (latestSub?.responses) {
    const r = latestSub.responses as Record<string, unknown>
    const h = r.height_cm ?? r.taille_cm ?? r.height
    if (typeof h === "number" && h > 100 && h < 230) height_cm = h
  }

  return NextResponse.json({
    hand_length_cm: (cc as any).hand_length_cm ?? null,
    height_cm,
  })
}

/**
 * PATCH /api/client/profile-scaling
 * Body: { hand_length_cm: number | null }
 */
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = patchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.format() }, { status: 400 })

  const db = service()
  const { data: cc } = await db
    .from("coach_clients")
    .select("id")
    .eq("user_id", user.id)
    .single()
  if (!cc) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const { error } = await db
    .from("coach_clients")
    .update({ hand_length_cm: body.data.hand_length_cm })
    .eq("id", cc.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
