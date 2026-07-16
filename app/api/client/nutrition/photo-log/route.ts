export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { createSupabaseService } from "@/lib/nutrition/preps-service"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import { computePhysiologicalDate } from "@/lib/nutrition/physiological-date"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"
import { resolveOwnedPhotoMealSessionWithRetry } from "@/lib/nutrition/photo-log-session-access"

const PHOTO_BUCKET = "nutrition-photo-logs"

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  manual_weight_g: z.number().positive().max(5000).optional(),
})

const patchSchema = z.object({
  session_id: z.string().uuid(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
  manual_weight_g: z.number().positive().max(5000).nullable().optional(),
})

function mapPhotoLogTableError(error: { message?: string } | null | undefined) {
  const message = String(error?.message ?? "")
  if (
    message.includes("client_photo_meal_logs") ||
    message.includes("client_photo_meal_log_photos") ||
    message.includes("schema cache")
  ) {
    return {
      status: 503,
      error: "Le scanner de repas n'est pas encore disponible sur cet environnement.",
    }
  }

  return null
}

async function attachSignedPhotoUrls(
  db: ReturnType<typeof createSupabaseService>,
  session: Record<string, any>,
) {
  const storedPhotos = Array.isArray(session.client_photo_meal_log_photos)
    ? session.client_photo_meal_log_photos
    : []
  const photos = await Promise.all(storedPhotos.map(async (photo: Record<string, any>) => {
    const storagePath = String(photo.storage_path ?? "")
    if (!storagePath) return photo
    const { data } = await db.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, 60 * 60)
    return {
      ...photo,
      signed_url: data?.signedUrl ?? null,
    }
  }))

  return {
    ...session,
    client_photo_meal_log_photos: photos.sort((left, right) => {
      const byPosition = Number(left.position_index ?? 0) - Number(right.position_index ?? 0)
      if (byPosition !== 0) return byPosition
      return String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""))
    }),
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 401 })

  const body = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = createSupabaseService()
  const client = await resolveClientFromUser(user.id, user.email, db, "id, timezone")
  if (!client) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 404 })
  const clientId = client.id as string
  const timezone = String(client.timezone ?? "").trim() || await resolveClientTimezone(db, clientId)
  const physiologicalDate = body.data.date ?? computePhysiologicalDate(new Date(), timezone)

  const { data, error } = await db
    .from("client_photo_meal_logs")
    .insert({
      client_id: clientId,
      physiological_date: physiologicalDate,
      meal_type: body.data.meal_type ?? null,
      manual_weight_g: body.data.manual_weight_g ?? null,
      source_context: "plate_home_v1",
      status: "capturing",
      analysis_summary: {},
      analysis_result: {},
      clarification_answers: {},
    })
    .select("*")
    .single()

  const mappedError = mapPhotoLogTableError(error)
  if (mappedError) return NextResponse.json({ error: mappedError.error }, { status: mappedError.status })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 401 })

  const params = new URL(req.url).searchParams
  const sessionId = params.get("session_id")
  const mealId = params.get("meal_id")
  if (!sessionId && !mealId) {
    return NextResponse.json({ error: "session_id or meal_id is required" }, { status: 400 })
  }

  const db = createSupabaseService()
  const client = await resolveClientFromUser(user.id, user.email, db, "id")
  if (!client && !sessionId) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 404 })

  if (sessionId) {
    const resolved = await resolveOwnedPhotoMealSessionWithRetry({
      db,
      sessionId,
      user,
      sessionSelect: "*, client_photo_meal_log_photos(*)",
      clientSelect: "id",
    })
    if (!resolved.session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    return NextResponse.json({ data: await attachSignedPhotoUrls(db, resolved.session as Record<string, any>) })
  }

  const query = db
    .from("client_photo_meal_logs")
    .select("*, client_photo_meal_log_photos(*)")
    .eq("client_id", client!.id)

  const scopedQuery = query.eq("meal_id", mealId!).order("created_at", { ascending: false }).limit(1)

  const { data, error } = await scopedQuery.single()

  const mappedError = mapPhotoLogTableError(error)
  if (mappedError) return NextResponse.json({ error: mappedError.error }, { status: mappedError.status })
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Session not found" }, { status: 404 })
  return NextResponse.json({ data: await attachSignedPhotoUrls(db, data as Record<string, any>) })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 401 })

  const body = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const updates: Record<string, number | string | null> = {}
  if ("meal_type" in body.data) updates.meal_type = body.data.meal_type ?? null
  if ("manual_weight_g" in body.data) updates.manual_weight_g = body.data.manual_weight_g ?? null
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 })
  }

  const db = createSupabaseService()
  const { session, client } = await resolveOwnedPhotoMealSessionWithRetry({
    db,
    sessionId: body.data.session_id,
    user,
    sessionSelect: "id",
    clientSelect: "id",
  })
  if (!client) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 404 })
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  const { data, error } = await db
    .from("client_photo_meal_logs")
    .update(updates)
    .eq("id", body.data.session_id)
    .eq("client_id", client.id as string)
    .select("*")
    .single()

  const mappedError = mapPhotoLogTableError(error)
  if (mappedError) return NextResponse.json({ error: mappedError.error }, { status: mappedError.status })
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Session not found" }, { status: 404 })
  return NextResponse.json({ data })
}
