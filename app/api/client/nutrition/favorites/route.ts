import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import type { NutritionEntry } from "@/lib/nutrition/food-items"

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

const createFavoriteSchema = z.object({
  name: z.string().min(1).max(100),
  entries: z.array(z.object({
    food_item_id: z.string().uuid(),
    name_fr: z.string(),
    quantity_g: z.number().positive(),
    calories_kcal: z.number().nonnegative(),
    protein_g: z.number().nonnegative(),
    carbs_g: z.number().nonnegative(),
    fat_g: z.number().nonnegative(),
  })).min(1).max(30),
  total_calories: z.number().nonnegative(),
  total_protein_g: z.number().nonnegative(),
  total_carbs_g: z.number().nonnegative(),
  total_fat_g: z.number().nonnegative(),
})

interface FavoriteMeal {
  id: string
  name: string
  entries: any[]
  total_calories: number | null
  total_protein_g: number | null
  total_carbs_g: number | null
  total_fat_g: number | null
  use_count: number
  last_used_at: string
}

// GET /api/client/nutrition/favorites
// Liste les repas favoris du client (max 10, triés par last_used_at DESC)
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const { data, error } = await service()
    .from("client_meal_favorites")
    .select("id, name, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, use_count, last_used_at")
    .eq("client_id", clientId)
    .order("last_used_at", { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: (data ?? []) as FavoriteMeal[] }, { status: 200 })
}

// POST /api/client/nutrition/favorites
// Crée un nouveau favori à partir des drafts actuels
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = createFavoriteSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { name, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g } = body.data

  const { data: favorite, error } = await service()
    .from("client_meal_favorites")
    .insert({
      client_id: clientId,
      name: name.trim(),
      entries,
      total_calories,
      total_protein_g,
      total_carbs_g,
      total_fat_g,
      use_count: 1,
      last_used_at: new Date().toISOString(),
    })
    .select("id, name, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, use_count, last_used_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: favorite }, { status: 201 })
}
