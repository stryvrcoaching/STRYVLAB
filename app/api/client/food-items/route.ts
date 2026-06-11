
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { recommendFoodCategory } from "@/lib/nutrition/food-profile"

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .trim()
}

function scoreFoodSearchMatch(name: string, normalizedQuery: string): number | null {
  if (!normalizedQuery) return 0

  const normalizedName = normalizeSearchText(name)
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const nameTokens = normalizedName.split(/[\s''()-]+/).filter(Boolean)

  // Score 0 : exact match
  if (normalizedName === normalizedQuery) return 0
  // Score 1 : le nom complet commence par la requête (ex: "riz" → "riz basmati")
  if (normalizedName.startsWith(normalizedQuery)) return 1
  // Score 2 : un mot du nom commence par la requête (ex: "riz" → "fécule de riz")
  if (nameTokens.some(token => token.startsWith(normalizedQuery))) return 2

  // Score 3 : multi-tokens — chaque token de la requête débute un mot du nom
  // (ex: "riz bas" → "riz basmati cuit")
  if (queryTokens.length > 1) {
    const allTokensStartWords = queryTokens.every(queryToken =>
      nameTokens.some(nameToken => nameToken.startsWith(queryToken))
    )
    if (allTokensStartWords) return 3
  }

  // Score 4 : fallback contains — le terme apparaît dans le nom mais pas en début de mot
  // (ex: "riz" dans "aromatisé" → non pertinent, mais on l'inclut en dernier recours)
  if (normalizedName.includes(normalizedQuery)) return 4
  if (queryTokens.length > 1 && queryTokens.every(qt => normalizedName.includes(qt))) return 4

  return null
}

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function resolveLocalizedName(
  item: { name_fr: string; food_item_translations?: Array<{ lang: string; name: string }> | null },
  lang: "fr" | "en" | "es"
): string {
  if (lang === "fr") return item.name_fr
  return item.food_item_translations?.find(t => t.lang === lang)?.name ?? item.name_fr
}

function normalizeFoodCategoryInput(input: {
  id?: string
  name_fr: string
  category_l1: "proteins" | "carbs" | "vegetables" | "fruits" | "fats" | "drinks" | "extras"
  category_l2?: string | null
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
}) {
  const recommended = recommendFoodCategory({
    id: input.id ?? "temp",
    name_fr: input.name_fr,
    category_l1: input.category_l1,
    category_l2: input.category_l2 ?? null,
    item_key: "temp",
    kcal_per_100g: input.kcal_per_100g,
    protein_per_100g: input.protein_per_100g,
    carbs_per_100g: input.carbs_per_100g,
    fat_per_100g: input.fat_per_100g,
    fiber_per_100g: input.fiber_per_100g,
    source: "user",
    is_verified: false,
  })

  return {
    ...input,
    category_l1: recommended,
  }
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service()
    .from("coach_clients")
    .select("id")
    .eq("user_id", userId)
    .single()
  return data?.id ?? null
}

// GET /api/client/food-items?category=proteins&subcategory=viandes&q=poulet&limit=50&mine=true
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const categoriesParam = searchParams.get("categories")
  const categories = categoriesParam
    ? categoriesParam.split(",").map((value) => value.trim()).filter(Boolean)
    : null
  const subcategory = searchParams.get("subcategory")
  const q = searchParams.get("q")?.trim()
  const normalizedQuery = q ? normalizeSearchText(q) : ""
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 1000)
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0)
  const mineOnly = searchParams.get("mine") === "true"
  const lang = (searchParams.get("lang") ?? req.headers.get("x-client-lang") ?? "fr") as "fr" | "en" | "es"

  const db = service()
  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const allowedScopeClause = `and(source.eq.internal,is_verified.eq.true),client_id.eq.${clientId}`

  let query = db
    .from("food_items")
    .select(`
      id, name_fr, category_l1, category_l2, item_key,
      kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
      source, client_id,
      food_item_translations!food_item_translations_food_item_id_fkey(lang, name)
    `)
    .order("name_fr")
    .range(offset, offset + limit - 1)

  if (mineOnly) {
    query = query.eq("client_id", clientId)
  } else {
    query = query.or(allowedScopeClause)
  }

  if (categories?.length) {
    query = query.in("category_l1", categories)
  } else if (category) {
    query = query.eq("category_l1", category)
  }
  if (subcategory) query = query.eq("category_l2", subcategory)

  // Filtrage DB : recherche par PRÉFIXE de token (ilike 'token%') pour un comportement
  // de barre de recherche standard — "riz" retourne "riz basmati", pas "aromatisé".
  // On utilise une recherche OR : soit le nom commence par le token, soit un mot commence par le token.
  // Exemple : "riz" → name_fr ilike 'riz%' OR name_fr ilike '% riz%'
  if (normalizedQuery) {
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
    for (const token of tokens) {
      // Chaque token doit soit démarrer le nom, soit démarrer un mot dans le nom
      query = query.or(`name_fr.ilike.${token}%,name_fr.ilike.% ${token}%`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const scopedItems = (data ?? []) as Array<{
    id: string
    name_fr: string
    category_l1: string
    category_l2: string | null
    item_key: string
    kcal_per_100g: number
    protein_per_100g: number
    carbs_per_100g: number
    fat_per_100g: number
    fiber_per_100g: number
    source: string
    client_id: string | null
  }>

  // Tri pertinence côté JS sur les résultats déjà filtrés par la DB.
  // Les items avec score null (aucune correspondance préfixe) sont exclus.
  const filteredItems = normalizedQuery
    ? scopedItems
        .map((item) => ({
          item,
          score: scoreFoodSearchMatch(item.name_fr, normalizedQuery),
        }))
        .filter(entry => entry.score !== null)   // ← exclure les non-pertinents
        .sort((a, b) => {
          const sa = a.score!
          const sb = b.score!
          if (sa !== sb) return sa - sb
          return a.item.name_fr.localeCompare(b.item.name_fr, "fr", { sensitivity: "base" })
        })
        .map(entry => entry.item)
    : scopedItems

  return NextResponse.json({
    data: filteredItems.map((item) => {
      const itemForRecommend: any = {
        id: item.id,
        name_fr: item.name_fr,
        category_l1: item.category_l1 as any,
        category_l2: item.category_l2,
        item_key: item.item_key,
        kcal_per_100g: item.kcal_per_100g,
        protein_per_100g: item.protein_per_100g,
        carbs_per_100g: item.carbs_per_100g,
        fat_per_100g: item.fat_per_100g,
        fiber_per_100g: item.fiber_per_100g,
        source: item.source,
        is_verified: item.source === "internal",
      }
      return {
        id: item.id,
        name_fr: item.name_fr,
        name: resolveLocalizedName(item, lang),
        category_l1: item.category_l1,
        category_l2: item.category_l2,
        item_key: item.item_key,
        kcal_per_100g: item.kcal_per_100g,
        protein_per_100g: item.protein_per_100g,
        carbs_per_100g: item.carbs_per_100g,
        fat_per_100g: item.fat_per_100g,
        fiber_per_100g: item.fiber_per_100g,
        source: item.source,
        client_id: item.client_id,
      }
    }),
    total: filteredItems.length,
  })
}

const createCustomSchema = z.object({
  name_fr: z.string().min(1).max(100),
  category_l1: z.enum(["proteins", "carbs", "vegetables", "fruits", "fats", "drinks", "extras"]),
  category_l2: z.string().max(50).nullable().optional(),
  kcal_per_100g: z.number().min(0).max(900),
  protein_per_100g: z.number().min(0).max(100),
  carbs_per_100g: z.number().min(0).max(100),
  fat_per_100g: z.number().min(0).max(100),
  fiber_per_100g: z.number().min(0).max(100).default(0),
})

const updateCustomSchema = createCustomSchema.extend({
  id: z.string().uuid(),
})

// POST /api/client/food-items — créer un aliment personnalisé
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = createCustomSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const normalized = normalizeFoodCategoryInput(body.data)
  const { name_fr, category_l1, category_l2, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g } = normalized

  // Slug stable : nom normalisé + client_id suffix pour éviter les conflits
  const slug = name_fr
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  const item_key = `custom-${slug}-${clientId.slice(0, 8)}`

  const { data, error } = await service()
    .from("food_items")
    .insert({
      name_fr: name_fr.trim(),
      category_l1,
      category_l2: category_l2 ?? null,
      item_key,
      kcal_per_100g,
      protein_per_100g,
      carbs_per_100g,
      fat_per_100g,
      fiber_per_100g,
      source: "user",
      is_verified: false,
      client_id: clientId,
    })
    .select("id, name_fr, category_l1, category_l2, item_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Cet aliment existe déjà" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

// PATCH /api/client/food-items — modifier un aliment personnalisé
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = updateCustomSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const normalized = normalizeFoodCategoryInput(body.data)
  const { id, name_fr, category_l1, category_l2, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g } = normalized

  const { data: existing, error: fetchError } = await service()
    .from("food_items")
    .select("id")
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Food item not found" }, { status: 404 })

  const { data, error } = await service()
    .from("food_items")
    .update({
      name_fr: name_fr.trim(),
      category_l1,
      category_l2: category_l2 ?? null,
      kcal_per_100g,
      protein_per_100g,
      carbs_per_100g,
      fat_per_100g,
      fiber_per_100g,
    })
    .eq("id", id)
    .eq("client_id", clientId)
    .select("id, name_fr, category_l1, category_l2, item_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 200 })
}

// DELETE /api/client/food-items?id=xxx — supprimer un aliment personnalisé
export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { error } = await service()
    .from("food_items")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId) // ownership check

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
