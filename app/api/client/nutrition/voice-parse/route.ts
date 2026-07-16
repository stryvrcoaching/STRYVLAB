import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import OpenAI from "openai"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import {
  buildVoiceCatalogPrompt,
  describeVoiceCatalogContext,
  normalizeVoiceCatalogText,
  scoreVoiceCatalogCandidate,
} from "@/lib/nutrition/voice-catalog"
import { parseManualPlateComponents } from "@/lib/nutrition/photo-log-manual"
import { checkDistributedRateLimit, rateLimitResponse } from "@/lib/security/public-rate-limit"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveClientId(userId: string, email: string | null | undefined): Promise<string | null> {
  const client = await resolveClientFromUser(userId, email ?? undefined, service() as any, "id")
  return client?.id ?? null
}

function catalogMatchScore(input: string, candidate: CatalogFoodItem, clientId: string) {
  const baseScore =
    scoreVoiceCatalogCandidate(input, candidate) +
    scoreVoiceCatalogCandidate(`${input} ${candidate.name_fr}`, candidate) * 0.15
  const personalBoost = candidate.client_id === clientId ? 85 : 0
  return baseScore + personalBoost
}

type CatalogFoodItem = {
  id: string
  name_fr: string
  category_l1?: string | null
  category_l2?: string | null
  kcal_per_100g?: number | null
  protein_per_100g?: number | null
  carbs_per_100g?: number | null
  fat_per_100g?: number | null
  fiber_per_100g?: number | null
  client_id?: string | null
}

function computeMacrosFromCatalog(item: CatalogFoodItem, quantityG: number) {
  const factor = quantityG / 100
  return {
    kcal: Math.round(Number(item.kcal_per_100g ?? 0) * factor),
    protein_g: parseFloat((Number(item.protein_per_100g ?? 0) * factor).toFixed(1)),
    carbs_g: parseFloat((Number(item.carbs_per_100g ?? 0) * factor).toFixed(1)),
    fat_g: parseFloat((Number(item.fat_per_100g ?? 0) * factor).toFixed(1)),
    fiber_g: parseFloat((Number(item.fiber_per_100g ?? 0) * factor).toFixed(1)),
  }
}

const bodySchema = z.object({
  transcript: z.string().min(3).max(1000),
  physiological_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function inferMealTypeFromHour(currentHour: number) {
  if (currentHour < 10) return "breakfast"
  if (currentHour < 15) return "lunch"
  if (currentHour < 19) return "snack"
  return "dinner"
}

function buildManualTextResponse(transcript: string, currentHour: number) {
  const manualComponents = parseManualPlateComponents(transcript)
  if (!manualComponents.length) return null

  return {
    items: manualComponents.map((component) => {
      const factor = component.quantity_g / 100
      return {
        name: component.name_fr,
        quantity_g: component.quantity_g,
        kcal: Math.round(component.kcal_per_100g * factor),
        protein_g: Number((component.protein_per_100g * factor).toFixed(1)),
        carbs_g: Number((component.carbs_per_100g * factor).toFixed(1)),
        fat_g: Number((component.fat_per_100g * factor).toFixed(1)),
        fiber_g: Number((component.fiber_per_100g * factor).toFixed(1)),
        confidence: "high",
        food_item_id: null,
        category_l1: component.category_hint,
      }
    }),
    meal_type: inferMealTypeFromHour(currentHour),
    clean_transcript: transcript,
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id, user.email)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const db = service()
  const rateLimit = await checkDistributedRateLimit({
    db,
    req,
    scope: "client_nutrition_voice_parse",
    subject: clientId,
    maxRequests: 10,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { transcript } = body.data
  const currentHour = new Date().getHours()
  const deterministicManualResponse = buildManualTextResponse(transcript, currentHour)
  if (deterministicManualResponse) {
    return NextResponse.json(deterministicManualResponse)
  }

  const { data: scopedFoodItems } = await db
    .from("food_items")
    .select("id, name_fr, category_l1, category_l2, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, client_id")
    .or(`and(source.eq.internal,is_verified.eq.true),client_id.eq.${clientId}`)
    .limit(3000)

  // ── Fetch top-20 food items this client uses most ─────────────────────────
  const { data: topEntries } = await db
    .from("nutrition_entries")
    .select("food_item_id, food_items(id, name_fr)")
    .eq("client_id", clientId)
    .limit(200)

  const countMap: Record<string, { id: string; name: string; count: number }> = {}
  for (const e of (topEntries ?? [])) {
    const fi = (e as any).food_items
    if (!fi) continue
    if (!countMap[fi.id]) countMap[fi.id] = { id: fi.id, name: fi.name_fr, count: 0 }
    countMap[fi.id].count++
  }
  const topFoods = Object.values(countMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(f => `${f.name} (id: ${f.id})`)

  const catalogHint = topFoods.length
    ? `Catalogue préféré du client :\n${topFoods.join('\n')}`
    : ""
  const relevantCatalogHint = buildVoiceCatalogPrompt((scopedFoodItems ?? []) as CatalogFoodItem[], transcript, clientId)
  const voiceCatalogContext = describeVoiceCatalogContext(transcript)

  // ── GPT-4o mini call ──────────────────────────────────────────────────────
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const systemPrompt = `Tu es un assistant nutritionnel. Analyse ce texte et retourne UNIQUEMENT un JSON valide.

Format de réponse :
{
  "items": [
    {
      "name": "nom de l'aliment en français",
      "quantity_g": 150,
      "kcal": 248,
      "protein_g": 31.5,
      "carbs_g": 0,
      "fat_g": 13.2,
      "fiber_g": 0,
      "confidence": "high",
      "food_item_id": "uuid du catalogue si correspondance sûre, sinon null"
    }
  ],
  "meal_type": "lunch"
}

Règles :
- Identifie chaque aliment distinct mentionné
- Si la quantité n'est pas précisée, estime une portion standard
- confidence: "high" si quantité explicite, "medium" si estimée, "low" si très incertain
- meal_type déduit du contexte ou de l'heure (${currentHour}h) parmi : breakfast, lunch, dinner, snack
- Ne retourne QUE le JSON, aucun texte autour
- Les valeurs nutritionnelles doivent être pour la quantité indiquée (pas pour 100g)
- Si un aliment du catalogue correspond au texte, utilise EXACTEMENT son nom catalogue et son food_item_id.
- Les marques, noms produits et noms anglais doivent être conservés tels quels. Ne traduis pas "Honey Rings" en "marque Honey" ou en autre produit.
- Le contexte descriptif sert à identifier le produit : "céréales au miel en forme d'anneaux" peut correspondre à "Honey Rings" si ce produit est dans le catalogue.
- Garde les noms composés et les modificateurs précis. Ne remplace pas un nom spécifique par un terme générique plus court si le texte fournit plus de contexte.
- Préserve les précisions explicites : "4%" reste 4%, jamais 40%. Si le catalogue contient un aliment qui contredit une précision explicite du texte, ne l'utilise pas.
- Ne choisis pas un aliment générique plus gras/sucré/protéiné si le texte donne une précision contraire ("maigre", "écrémé", "demi-écrémé", "0%", "4%", etc.).
- Le texte provient de la reconnaissance vocale automatique : il peut contenir des homophones erronés. Interprète toujours dans un contexte alimentaire/nutritionnel (ex: "port" → "porc", "ver" → "verre", "vert" → contexte légume ou couleur, "tain" → "thym", "sel" → "sel", "eau" → "eau", etc.)
- Couches de contexte détectées : ${voiceCatalogContext || "aucune"}
- Pour un terme ambigu, privilégie l'aliment le plus compatible avec la famille, la forme et les modificateurs, pas seulement la chaîne de caractères la plus proche.

${catalogHint}

${relevantCatalogHint}`

  let parsed: { items: any[]; meal_type: string } | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: "json_object" },
      })
      const raw = completion.choices[0]?.message?.content ?? ""
      parsed = JSON.parse(raw)
      break
    } catch {
      if (attempt === 1) {
        return NextResponse.json({ error: "parse_failed" }, { status: 422 })
      }
    }
  }

  if (!parsed || !Array.isArray(parsed.items)) {
    return NextResponse.json({ error: "parse_failed" }, { status: 422 })
  }

  // ── Match food_item_id from catalogue by normalized name ──────────────────
  const topIdByName: Record<string, string> = {}
  for (const entry of (topEntries ?? [])) {
    const fi = (entry as any).food_items
    if (fi) topIdByName[normalizeVoiceCatalogText(fi.name_fr)] = fi.id
  }

  const resolvedIds = new Map<string, string>()
  const catalogById = new Map<string, CatalogFoodItem>(
    ((scopedFoodItems ?? []) as CatalogFoodItem[]).map((item) => [item.id, item])
  )

  for (const parsedItem of parsed.items) {
    const rawName = String(parsedItem.name ?? "").trim()
    if (!rawName) continue

    const normalizedName = normalizeVoiceCatalogText(rawName)
    if (!normalizedName) continue

    const fromTop = topIdByName[normalizedName]
    if (fromTop) {
      resolvedIds.set(rawName, fromTop)
      continue
    }

    const parsedFoodItemId = typeof parsedItem.food_item_id === "string" ? parsedItem.food_item_id : null
    if (parsedFoodItemId && catalogById.has(parsedFoodItemId)) {
      resolvedIds.set(rawName, parsedFoodItemId)
      continue
    }

    const bestMatch = ((scopedFoodItems ?? []) as CatalogFoodItem[])
      .map((candidate) => ({
        ...candidate,
        score:
          catalogMatchScore(rawName, candidate, clientId) +
          scoreVoiceCatalogCandidate(transcript, candidate) * 0.35,
      }))
      .filter((candidate) => candidate.client_id === clientId ? candidate.score >= 35 : candidate.score >= 55)
      .sort((a, b) => b.score - a.score)[0]

    if (bestMatch) {
      resolvedIds.set(rawName, bestMatch.id)
    }
  }

  const voiceItems = parsed.items.map((item: any) => {
    const food_item_id = resolvedIds.get(String(item.name ?? ""))
    const catalogItem = food_item_id ? catalogById.get(food_item_id) : null
    const quantity_g = Number(item.quantity_g) || 100
    const catalogMacros = catalogItem ? computeMacrosFromCatalog(catalogItem, quantity_g) : null
    const fallbackKcal = Number(item.kcal)
    const fallbackProtein = Number(item.protein_g)
    const fallbackCarbs = Number(item.carbs_g)
    const fallbackFat = Number(item.fat_g)
    const fallbackFiber = Number(item.fiber_g)
    return {
      name: (catalogItem?.name_fr ?? String(item.name ?? "")) as string,
      quantity_g,
      kcal: catalogMacros?.kcal ?? (Number.isFinite(fallbackKcal) ? fallbackKcal : 0),
      protein_g: catalogMacros?.protein_g ?? (Number.isFinite(fallbackProtein) ? fallbackProtein : 0),
      carbs_g: catalogMacros?.carbs_g ?? (Number.isFinite(fallbackCarbs) ? fallbackCarbs : 0),
      fat_g: catalogMacros?.fat_g ?? (Number.isFinite(fallbackFat) ? fallbackFat : 0),
      fiber_g: catalogMacros?.fiber_g ?? (Number.isFinite(fallbackFiber) ? fallbackFiber : 0),
      confidence: (item.confidence as string) || "medium",
      food_item_id,
      is_new: !food_item_id,
      category_l1: catalogItem?.category_l1 ?? undefined,
      category_l2: catalogItem?.category_l2 ?? undefined,
    }
  })

  const validMealTypes = ["breakfast", "lunch", "dinner", "snack"]
  const meal_type = validMealTypes.includes(parsed.meal_type) ? parsed.meal_type : "snack"

  return NextResponse.json({
    items: voiceItems,
    meal_type,
    raw_transcript: transcript,
    clean_transcript: transcript,
  })
}
