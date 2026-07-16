import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"

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

const patchMealSchema = z.object({
  title: z.string().max(80).nullable().optional(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  notes: z.string().max(500).nullable().optional(),
  photo_url: z.string().url().optional(),
  logged_at: z.string().datetime().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = patchMealSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = service()
  const { data: existing, error: existingError } = await db
    .from("nutrition_meals")
    .select("id, photo_urls")
    .eq("id", params.id)
    .eq("client_id", clientId)
    .single()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 })
  }

  const patch: Record<string, unknown> = {}
  if ("title" in body.data) patch.title = body.data.title?.trim() || null
  if (body.data.meal_type) patch.meal_type = body.data.meal_type
  if ("notes" in body.data) patch.notes = body.data.notes?.trim() || null
  if (body.data.logged_at) patch.logged_at = body.data.logged_at
  if (body.data.photo_url) {
    const photos = Array.isArray(existing.photo_urls) ? existing.photo_urls : []
    patch.photo_urls = [...photos, body.data.photo_url]
  }

  const { data, error } = await db
    .from("nutrition_meals")
    .update(patch)
    .eq("id", params.id)
    .eq("client_id", clientId)
    .select("id, title, meal_type, photo_urls, notes")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath("/client/nutrition")
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const db = service()
  const { data: existing } = await db
    .from("nutrition_meals")
    .select("id")
    .eq("id", params.id)
    .eq("client_id", clientId)
    .single()

  if (!existing) return NextResponse.json({ error: "Meal not found" }, { status: 404 })

  const { error } = await db
    .from("nutrition_meals")
    .delete()
    .eq("id", params.id)
    .eq("client_id", clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from("smart_agenda_events").delete().eq("source_id", params.id).eq("client_id", clientId)

  revalidatePath("/client/nutrition")
  return NextResponse.json({ ok: true })
}
