
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { recommendFoodCategory } from "@/lib/nutrition/food-profile"
import { matchesVisibleLeaf, sortVisibleLeafItems, type VisibleLeafKey } from "@/lib/nutrition/food-taxonomy"
import { jsonWithRequestTiming, RequestTiming } from "@/lib/perf/request-timing"
import { ct } from '@/lib/i18n/clientTranslations'
import { resolveClientLanguage } from '@/lib/client/resolve-language'

const VISIBLE_LEAF_STORAGE_SCOPE: Record<VisibleLeafKey, { category_l1: string; category_l2: string | null }> = {
  chicken: { category_l1: "proteins", category_l2: "viandes" },
  beef: { category_l1: "proteins", category_l2: "viandes" },
  pork: { category_l1: "proteins", category_l2: "viandes" },
  turkey: { category_l1: "proteins", category_l2: "viandes" },
  fish: { category_l1: "proteins", category_l2: "poissons" },
  seafood: { category_l1: "proteins", category_l2: "poissons" },
  eggs: { category_l1: "proteins", category_l2: "oeufs" },
  "dairy-protein": { category_l1: "proteins", category_l2: "laitiers" },
  "plant-protein": { category_l1: "proteins", category_l2: "vegetales" },
  charcuterie: { category_l1: "proteins", category_l2: "viandes" },
  "other-proteins": { category_l1: "proteins", category_l2: "viandes" },
  rice: { category_l1: "carbs", category_l2: "cereales" },
  pasta: { category_l1: "carbs", category_l2: "cereales" },
  bread: { category_l1: "carbs", category_l2: "pain" },
  cereals: { category_l1: "carbs", category_l2: "cereales" },
  potatoes: { category_l1: "carbs", category_l2: "fecules" },
  legumes: { category_l1: "carbs", category_l2: "legumineuses" },
  "fresh-fruits": { category_l1: "fruits", category_l2: "frais" },
  "dried-fruits": { category_l1: "fruits", category_l2: "secs" },
  "sweet-products": { category_l1: "extras", category_l2: "snacks-sucres" },
  "sweet-sauces": { category_l1: "extras", category_l2: "sauces" },
  oils: { category_l1: "fats", category_l2: "huiles" },
  "nuts-seeds": { category_l1: "fats", category_l2: "noix-graines" },
  "avocado-olives": { category_l1: "fats", category_l2: "autres-lipides" },
  "butter-spreads": { category_l1: "fats", category_l2: "autres-lipides" },
  "nut-butters": { category_l1: "fats", category_l2: "noix-graines" },
  "fatty-sauces": { category_l1: "extras", category_l2: "sauces" },
  leafy: { category_l1: "vegetables", category_l2: "feuilles" },
  cruciferous: { category_l1: "vegetables", category_l2: "cruciferes" },
  roots: { category_l1: "vegetables", category_l2: "autres-legumes" },
  mediterranean: { category_l1: "vegetables", category_l2: "autres-legumes" },
  "other-vegetables": { category_l1: "vegetables", category_l2: "autres-legumes" },
  water: { category_l1: "drinks", category_l2: "eau" },
  "hot-drinks": { category_l1: "drinks", category_l2: "chauds" },
  "juices-smoothies": { category_l1: "drinks", category_l2: "jus-smoothies" },
  sodas: { category_l1: "extras", category_l2: "boissons" },
  "plant-milks": { category_l1: "drinks", category_l2: "laits-vegetaux" },
  "sports-drinks": { category_l1: "drinks", category_l2: "sports-drinks" },
  alcohol: { category_l1: "drinks", category_l2: "alcools" },
  whey: { category_l1: "proteins", category_l2: "complements" },
  "gainers-bars": { category_l1: "proteins", category_l2: "complements" },
  performance: { category_l1: "proteins", category_l2: "complements" },
  "other-supplements": { category_l1: "proteins", category_l2: "complements" },
}

function isVisibleLeaf(value: string | null): value is VisibleLeafKey {
  return Boolean(value && value in VISIBLE_LEAF_STORAGE_SCOPE)
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .trim()
}

export function scoreFoodSearchMatch(name: string, normalizedQuery: string): number | null {
  if (!normalizedQuery) return 0

  const normalizedName = normalizeSearchText(name)
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const nameTokens = normalizedName.split(/[\s''()-]+/).filter(Boolean)

  if (normalizedName === normalizedQuery) return 0

  if (queryTokens.length === 1) {
    const queryToken = queryTokens[0]
    if (!queryToken) return null

    if (normalizedName.startsWith(`${queryToken} `)) return 5

    const exactTokenIndex = nameTokens.findIndex((token) => token === queryToken)
    if (exactTokenIndex >= 0) return 10 + exactTokenIndex

    const prefixTokenIndex = nameTokens.findIndex((token) => token.startsWith(queryToken))
    if (prefixTokenIndex >= 0) {
      const matchedToken = nameTokens[prefixTokenIndex] ?? ""
      const lengthDelta = Math.max(0, matchedToken.length - queryToken.length)
      return 40 + prefixTokenIndex * 10 + lengthDelta
    }

    return null
  }

  if (queryTokens.length > 1) {
    let score = 0
    for (const queryToken of queryTokens) {
      const exactTokenIndex = nameTokens.findIndex((token) => token === queryToken)
      if (exactTokenIndex >= 0) {
        score += exactTokenIndex
        continue
      }

      const prefixTokenIndex = nameTokens.findIndex((token) => token.startsWith(queryToken))
      if (prefixTokenIndex >= 0) {
        score += 20 + prefixTokenIndex
        continue
      }

      if (!normalizedName.includes(queryToken)) return null
      score += 50 + normalizedName.indexOf(queryToken)
    }
    return 100 + score
  }

  return null
}

type FoodSearchUsageSignal = {
  count: number
  lastUsedAt: number
  recentRank: number
}

function getFoodSearchScoreBucket(score: number) {
  if (score <= 0) return 0
  if (score < 10) return 1
  if (score < 40) return 2
  if (score < 100) return 3
  return 4
}

export function compareFoodSearchEntries(
  a: { id: string; name_fr: string; score: number },
  b: { id: string; name_fr: string; score: number },
  usageById: Map<string, FoodSearchUsageSignal>,
) {
  const bucketA = getFoodSearchScoreBucket(a.score)
  const bucketB = getFoodSearchScoreBucket(b.score)
  if (bucketA !== bucketB) return bucketA - bucketB

  const usageA = usageById.get(a.id)
  const usageB = usageById.get(b.id)

  if (bucketA <= 2) {
    const recentRankA = usageA?.recentRank ?? Number.POSITIVE_INFINITY
    const recentRankB = usageB?.recentRank ?? Number.POSITIVE_INFINITY
    if (recentRankA !== recentRankB) return recentRankA - recentRankB

    const countA = usageA?.count ?? 0
    const countB = usageB?.count ?? 0
    if (countA !== countB) return countB - countA

    const lastUsedAtA = usageA?.lastUsedAt ?? 0
    const lastUsedAtB = usageB?.lastUsedAt ?? 0
    if (lastUsedAtA !== lastUsedAtB) return lastUsedAtB - lastUsedAtA
  }

  if (a.score !== b.score) return a.score - b.score

  if (bucketA > 2) {
    const recentRankA = usageA?.recentRank ?? Number.POSITIVE_INFINITY
    const recentRankB = usageB?.recentRank ?? Number.POSITIVE_INFINITY
    if (recentRankA !== recentRankB) return recentRankA - recentRankB

    const countA = usageA?.count ?? 0
    const countB = usageB?.count ?? 0
    if (countA !== countB) return countB - countA
  }

  const tokenCountDelta =
    a.name_fr.split(/[\s''()-]+/).filter(Boolean).length -
    b.name_fr.split(/[\s''()-]+/).filter(Boolean).length
  if (tokenCountDelta !== 0) return tokenCountDelta
  if (a.name_fr.length !== b.name_fr.length) return a.name_fr.length - b.name_fr.length
  return a.name_fr.localeCompare(b.name_fr, "fr", { sensitivity: "base" })
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

export function resolveFoodSearchFetchLimit(limit: number, hasQuery: boolean, hasVisibleLeaf: boolean) {
  if (!hasQuery) {
    return hasVisibleLeaf
      ? Math.min(Math.max(limit * 6, 120), 480)
      : limit
  }

  if (hasVisibleLeaf) {
    return Math.min(Math.max(limit * 4, 64), 480)
  }

  return Math.min(Math.max(limit * 5, 100), 500)
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
    icon_key: null,
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

async function loadFoodSearchUsageSignals(db: ReturnType<typeof service>, clientId: string, mealLimit = 120) {
  const { data } = await db
    .from("nutrition_meals")
    .select(`
      logged_at,
      nutrition_entries (
        food_item_id
      )
    `)
    .eq("client_id", clientId)
    .order("logged_at", { ascending: false })
    .limit(mealLimit)

  const usageById = new Map<string, FoodSearchUsageSignal>()

  for (const [mealIndex, meal] of ((data ?? []) as any[]).entries()) {
    const loggedAt = Date.parse(String((meal as any).logged_at ?? "")) || 0
    const entries = Array.isArray((meal as any).nutrition_entries) ? (meal as any).nutrition_entries : []
    for (const entry of entries) {
      const foodItemId = String((entry as any).food_item_id ?? "")
      if (!foodItemId) continue

      const current = usageById.get(foodItemId)
      if (current) {
        current.count += 1
        current.lastUsedAt = Math.max(current.lastUsedAt, loggedAt)
        current.recentRank = Math.min(current.recentRank, mealIndex)
      } else {
        usageById.set(foodItemId, {
          count: 1,
          lastUsedAt: loggedAt,
          recentRank: mealIndex,
        })
      }
    }
  }

  return usageById
}

// GET /api/client/food-items?category=proteins&subcategory=viandes&q=poulet&limit=50&mine=true
export async function GET(req: NextRequest) {
  const timing = new RequestTiming()
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonWithRequestTiming(timing, { error: "Unauthorized" }, { status: 401 })
  timing.checkpoint("auth")

  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const categoriesParam = searchParams.get("categories")
  const categories = categoriesParam
    ? categoriesParam.split(",").map((value) => value.trim()).filter(Boolean)
    : null
  const subcategory = searchParams.get("subcategory")
  const visibleLeaf = isVisibleLeaf(searchParams.get("visible_leaf")) ? searchParams.get("visible_leaf") : null
  const q = searchParams.get("q")?.trim()
  const normalizedQuery = q ? normalizeSearchText(q) : ""
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 1000)
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0)
  const mineOnly = searchParams.get("mine") === "true"
  const lang = (searchParams.get("lang") ?? req.headers.get("x-client-lang") ?? "fr") as "fr" | "en" | "es"
  const inferredScope = visibleLeaf ? VISIBLE_LEAF_STORAGE_SCOPE[visibleLeaf] : null
  const effectiveCategory = category ?? inferredScope?.category_l1 ?? null
  const effectiveSubcategory = subcategory ?? inferredScope?.category_l2 ?? null
  const includeTranslations = lang !== "fr"
  const fetchLimit = resolveFoodSearchFetchLimit(limit, Boolean(normalizedQuery), Boolean(visibleLeaf))

  const db = service()
  const clientId = await resolveClientId(user.id)
  if (!clientId) return jsonWithRequestTiming(timing, { error: "Client not found" }, { status: 404 })
  timing.checkpoint("resolve_client")
  const resolvedLang = await resolveClientLanguage(db, clientId, lang)
  const usageById = normalizedQuery ? await loadFoodSearchUsageSignals(db, clientId) : new Map<string, FoodSearchUsageSignal>()
  timing.checkpoint("resolve_usage")

  const allowedScopeClause = `and(source.eq.internal,is_verified.eq.true),client_id.eq.${clientId}`

  const selectClause = includeTranslations
    ? `
      id, name_fr, category_l1, category_l2, item_key,
      icon_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
      source, client_id,
      food_item_translations!food_item_translations_food_item_id_fkey(lang, name)
    `
    : `
      id, name_fr, category_l1, category_l2, item_key,
      icon_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
      source, client_id
    `

  let query = db
    .from("food_items")
    .select(selectClause)
    .order("name_fr")
    .range(offset, offset + fetchLimit - 1)

  if (mineOnly) {
    query = query.eq("client_id", clientId)
  } else {
    query = query.or(allowedScopeClause)
  }

  if (categories?.length) {
    query = query.in("category_l1", categories)
  } else if (effectiveCategory) {
    query = query.eq("category_l1", effectiveCategory)
  }
  if (effectiveSubcategory) query = query.eq("category_l2", effectiveSubcategory)

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
  if (error) return jsonWithRequestTiming(timing, { error: error.message }, { status: 500 })
  timing.checkpoint("db_query")

  const scopedItems = (data ?? []) as Array<{
    id: string
    name_fr: string
    category_l1: string
    category_l2: string | null
    icon_key: string | null
    item_key: string
    kcal_per_100g: number
    protein_per_100g: number
    carbs_per_100g: number
    fat_per_100g: number
    fiber_per_100g: number
    source: string
    client_id: string | null
    food_item_translations?: Array<{ lang: string; name: string }> | null
  }>

  // Tri pertinence côté JS sur les résultats déjà filtrés par la DB.
  // Les items avec score null (aucune correspondance préfixe) sont exclus.
  const scopedByVisibleLeaf = visibleLeaf
    ? scopedItems.filter((item) => matchesVisibleLeaf(item as any, visibleLeaf))
    : scopedItems

  const filteredItems = normalizedQuery
    ? scopedByVisibleLeaf
        .map((item) => ({
          item,
          score: scoreFoodSearchMatch(item.name_fr, normalizedQuery),
        }))
        .filter(entry => entry.score !== null)   // ← exclure les non-pertinents
        .sort((a, b) =>
          compareFoodSearchEntries(
            { id: a.item.id, name_fr: a.item.name_fr, score: a.score! },
            { id: b.item.id, name_fr: b.item.name_fr, score: b.score! },
            usageById,
          ),
        )
        .map(entry => entry.item)
    : visibleLeaf
      ? sortVisibleLeafItems(scopedByVisibleLeaf as any, visibleLeaf)
      : scopedByVisibleLeaf

  const pagedItems = filteredItems.slice(0, limit)
  timing.checkpoint("rank_filter")

  return jsonWithRequestTiming(timing, {
    data: pagedItems.map((item) => {
      const itemForRecommend: any = {
        id: item.id,
        name_fr: item.name_fr,
        category_l1: item.category_l1 as any,
        category_l2: item.category_l2,
        icon_key: item.icon_key,
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
        name: resolveLocalizedName(item, resolvedLang),
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
  const lang = await resolveClientLanguage(service(), clientId)

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
      icon_key: null,
    })
    .select("id, name_fr, category_l1, category_l2, icon_key, item_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: ct(lang, 'food.error.duplicate') }, { status: 409 })
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
    .select("id, name_fr, category_l1, category_l2, icon_key, item_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
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
