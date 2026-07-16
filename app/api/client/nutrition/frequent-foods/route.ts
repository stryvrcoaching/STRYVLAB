export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { resolveClientFromUser } from "@/lib/client/resolve-client"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type FrequentFoodAggregate = {
  item: any
  count: number
  lastUsedAt: number
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, "id")
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const mealLimit = Math.min(Math.max(Number(searchParams.get("meal_limit") ?? "120"), 20), 240)
  const itemLimit = Math.min(Math.max(Number(searchParams.get("limit") ?? "8"), 1), 100)
  const minCount = Math.min(Math.max(Number(searchParams.get("min_count") ?? "5"), 1), 50)

  const { data, error } = await db
    .from("nutrition_meals")
    .select(`
      logged_at,
      nutrition_entries (
        food_item_id,
        food_items (
          id, name_fr, category_l1, category_l2, icon_key, item_key,
          kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
          source, is_verified
        )
      )
    `)
    .eq("client_id", client.id)
    .order("logged_at", { ascending: false })
    .limit(mealLimit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const aggregate = new Map<string, FrequentFoodAggregate>()

  for (const meal of data ?? []) {
    const loggedAt = Date.parse(String((meal as any).logged_at ?? "")) || 0
    const entries = Array.isArray((meal as any).nutrition_entries) ? (meal as any).nutrition_entries : []
    for (const entry of entries) {
      const item = (entry as any).food_items
      const itemId = String((entry as any).food_item_id ?? item?.id ?? "")
      if (!item || !itemId) continue

      const current = aggregate.get(itemId)
      if (current) {
        current.count += 1
        current.lastUsedAt = Math.max(current.lastUsedAt, loggedAt)
      } else {
        aggregate.set(itemId, {
          item,
          count: 1,
          lastUsedAt: loggedAt,
        })
      }
    }
  }

  const frequentFoods = Array.from(aggregate.values())
    .filter((entry) => entry.count >= minCount)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return b.lastUsedAt - a.lastUsedAt
    })
    .slice(0, itemLimit)

  return NextResponse.json({
    data: frequentFoods,
  })
}
