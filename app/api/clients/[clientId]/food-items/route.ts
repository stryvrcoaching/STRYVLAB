import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { coachOwnsClient } from "@/lib/security/client-resource-access"
import { loadClientFoodProfile } from "@/lib/nutrition/food-profile-service"
import {
  evaluateFoodCompatibility,
  sortFoodsByCompatibility,
} from "@/lib/nutrition/food-compatibility"

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const searchSchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  category: z
    .enum(["proteins", "carbs", "vegetables", "fruits", "fats", "drinks", "extras"])
    .optional(),
  subcategory: z.string().trim().max(60).optional(),
  sort: z
    .enum([
      "name",
      "name_desc",
      "protein",
      "protein_asc",
      "carbs",
      "carbs_asc",
      "fat",
      "fat_asc",
      "calories",
      "calories_asc",
      "frequent",
      "recent",
    ])
    .optional()
    .default("name"),
  frequent: z.coerce.boolean().optional().default(false),
  include_hidden: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(200).optional().default(80),
})

const createFoodSchema = z.object({
  name_fr: z.string().trim().min(1).max(120),
  category_l1: z.enum(["proteins", "carbs", "vegetables", "fruits", "fats", "drinks", "extras"]),
  category_l2: z.string().trim().max(60).nullable().optional(),
  kcal_per_100g: z.coerce.number().min(0).max(1000),
  protein_per_100g: z.coerce.number().min(0).max(100),
  carbs_per_100g: z.coerce.number().min(0).max(100),
  fat_per_100g: z.coerce.number().min(0).max(100),
  fiber_per_100g: z.coerce.number().min(0).max(100).optional().default(0),
})

function slugifyFoodName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

async function loadFoodUsage(clientId: string) {
  const { data } = await serviceClient()
    .from("nutrition_meals")
    .select(`
      logged_at,
      nutrition_entries (
        food_item_id
      )
    `)
    .eq("client_id", clientId)
    .order("logged_at", { ascending: false })
    .limit(240)

  const usage = new Map<string, { count: number; lastUsedAt: number }>()
  for (const meal of (data ?? []) as any[]) {
    const loggedAt = Date.parse(String(meal.logged_at ?? "")) || 0
    const entries = Array.isArray(meal.nutrition_entries) ? meal.nutrition_entries : []
    for (const entry of entries) {
      const id = String(entry.food_item_id ?? "")
      if (!id) continue
      const current = usage.get(id)
      usage.set(id, {
        count: (current?.count ?? 0) + 1,
        lastUsedAt: Math.max(current?.lastUsedAt ?? 0, loggedAt),
      })
    }
  }

  return usage
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = serviceClient()
  if (!(await coachOwnsClient({ db, coachUserId: user.id, clientId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const parsed = searchSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { q, category, subcategory, sort, frequent, include_hidden, limit } = parsed.data
  const foodProfile = await loadClientFoodProfile(db, clientId)
  const usage = frequent || sort === "frequent" || sort === "recent"
    ? await loadFoodUsage(clientId)
    : new Map<string, { count: number; lastUsedAt: number }>()

  let query = db
    .from("food_items")
    .select(
      `
      id, name_fr, category_l1, category_l2, item_key,
      icon_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
      source, is_verified, client_id, dietary_tags, allergen_tags, ingredients_known
    `,
    )
    .order("name_fr")
    .limit(frequent || sort === "frequent" || sort === "recent" ? 500 : Math.max(limit, 200))
    .or(`and(source.eq.internal,is_verified.eq.true),client_id.eq.${clientId}`)

  if (category) query = query.eq("category_l1", category)
  if (subcategory) query = query.eq("category_l2", subcategory)

  const normalizedQuery = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()

  if (normalizedQuery) {
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
    for (const token of tokens) {
      query = query.or(`name_fr.ilike.${token}%,name_fr.ilike.% ${token}%`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = (data ?? [])
    .map((item) => ({
      id: item.id,
      name_fr: item.name_fr,
      category_l1: item.category_l1,
      category_l2: item.category_l2,
      icon_key: item.icon_key,
      item_key: item.item_key,
      kcal_per_100g: item.kcal_per_100g,
      protein_per_100g: item.protein_per_100g,
      carbs_per_100g: item.carbs_per_100g,
      fat_per_100g: item.fat_per_100g,
      fiber_per_100g: item.fiber_per_100g,
      source: item.source,
      is_verified: item.is_verified,
      dietary_tags: item.dietary_tags,
      allergen_tags: item.allergen_tags,
      ingredients_known: item.ingredients_known,
      usage_count: usage.get(item.id)?.count ?? 0,
      last_used_at: usage.get(item.id)?.lastUsedAt ?? 0,
      compatibility: evaluateFoodCompatibility(item as any, foodProfile),
    }))
    .filter((item) => item.compatibility.status !== "blocked")
    .filter((item) => include_hidden || item.compatibility.status !== "hidden")
    .filter((item) => !frequent || item.usage_count >= 3)
    .sort((a, b) => {
      if (sort === "name_desc") return b.name_fr.localeCompare(a.name_fr)
      if (sort === "protein") return b.protein_per_100g - a.protein_per_100g || a.name_fr.localeCompare(b.name_fr)
      if (sort === "protein_asc") return a.protein_per_100g - b.protein_per_100g || a.name_fr.localeCompare(b.name_fr)
      if (sort === "carbs") return b.carbs_per_100g - a.carbs_per_100g || a.name_fr.localeCompare(b.name_fr)
      if (sort === "carbs_asc") return a.carbs_per_100g - b.carbs_per_100g || a.name_fr.localeCompare(b.name_fr)
      if (sort === "fat") return b.fat_per_100g - a.fat_per_100g || a.name_fr.localeCompare(b.name_fr)
      if (sort === "fat_asc") return a.fat_per_100g - b.fat_per_100g || a.name_fr.localeCompare(b.name_fr)
      if (sort === "calories") return b.kcal_per_100g - a.kcal_per_100g || a.name_fr.localeCompare(b.name_fr)
      if (sort === "calories_asc") return a.kcal_per_100g - b.kcal_per_100g || a.name_fr.localeCompare(b.name_fr)
      if (sort === "frequent") return b.usage_count - a.usage_count || b.last_used_at - a.last_used_at || a.name_fr.localeCompare(b.name_fr)
      if (sort === "recent") return b.last_used_at - a.last_used_at || b.usage_count - a.usage_count || a.name_fr.localeCompare(b.name_fr)
      return a.name_fr.localeCompare(b.name_fr)
    })
  const compatibleItems = sortFoodsByCompatibility(items).slice(0, limit)

  return NextResponse.json({
    data: compatibleItems,
    food_profile_status: foodProfile?.allergy_status ?? "unknown",
    hidden_foods_available: !include_hidden,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = serviceClient()
  if (!(await coachOwnsClient({ db, coachUserId: user.id, clientId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const parsed = createFoodSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const body = parsed.data
  const itemKey = `coach-${slugifyFoodName(body.name_fr)}-${clientId.slice(0, 8)}`
  const { data, error } = await db
    .from("food_items")
    .insert({
      name_fr: body.name_fr,
      category_l1: body.category_l1,
      category_l2: body.category_l2 ?? null,
      item_key: itemKey,
      kcal_per_100g: body.kcal_per_100g,
      protein_per_100g: body.protein_per_100g,
      carbs_per_100g: body.carbs_per_100g,
      fat_per_100g: body.fat_per_100g,
      fiber_per_100g: body.fiber_per_100g,
      source: "user",
      is_verified: false,
      client_id: clientId,
      icon_key: null,
    })
    .select(
      `
      id, name_fr, category_l1, category_l2, item_key,
      icon_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
      source, is_verified
    `,
    )
    .single()

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Cet aliment existe déjà" }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const foodProfile = await loadClientFoodProfile(db, clientId)
  return NextResponse.json(
    {
      data: {
        ...data,
        compatibility: evaluateFoodCompatibility(
          { ...data, dietary_tags: [], allergen_tags: [], ingredients_known: false } as any,
          foodProfile,
        ),
      },
    },
    { status: 201 },
  )
}
