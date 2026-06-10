import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import OpenAI from "openai"

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

function normalizeFoodName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

// ── In-memory rate limit (10 req/min per clientId) ───────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(clientId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(clientId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

const bodySchema = z.object({
  transcript: z.string().min(3).max(1000),
  physiological_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  if (!checkRateLimit(clientId)) {
    return NextResponse.json({ error: "rate_limit", retry_after: 60 }, { status: 429 })
  }

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { transcript } = body.data
  const db = service()

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

  const currentHour = new Date().getHours()
  const catalogHint = topFoods.length
    ? `Catalogue préféré du client :\n${topFoods.join('\n')}`
    : ""

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
      "confidence": "high"
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
- Le texte provient de la reconnaissance vocale automatique : il peut contenir des homophones erronés. Interprète toujours dans un contexte alimentaire/nutritionnel (ex: "port" → "porc", "ver" → "verre", "vert" → contexte légume ou couleur, "tain" → "thym", "sel" → "sel", "eau" → "eau", etc.)

${catalogHint}`

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
    if (fi) topIdByName[normalizeFoodName(fi.name_fr)] = fi.id
  }

  const allowedScopeClause = `and(source.eq.internal,is_verified.eq.true),client_id.eq.${clientId}`
  const resolvedIds = new Map<string, string>()

  for (const parsedItem of parsed.items) {
    const rawName = String(parsedItem.name ?? "").trim()
    if (!rawName) continue

    const normalizedName = normalizeFoodName(rawName)
    if (!normalizedName) continue

    const fromTop = topIdByName[normalizedName]
    if (fromTop) {
      resolvedIds.set(rawName, fromTop)
      continue
    }

    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const searchTerms = Array.from(new Set(rawName.split(/\s+/).filter(Boolean))).slice(0, 4)
    const searchClause = searchTerms
      .flatMap((term) => {
        const normalizedTerm = normalizeFoodName(term)
        if (!normalizedTerm) return []
        const escaped = escape(normalizedTerm).replace(/\s+/g, ".*")
        return [
          `name_fr.imatch.\\m${escaped}\\M`,
          `name_fr.imatch.\\m${escaped}.*`,
          `name_fr.imatch.${escaped}.*`,
        ]
      })
      .join(",")

    const { data: candidates } = await db
      .from("food_items")
      .select("id, name_fr")
      .or(searchClause ? `and(or(${allowedScopeClause}),or(${searchClause}))` : allowedScopeClause)
      .limit(20)

    const bestMatch = (candidates ?? []).find((candidate) => normalizeFoodName(candidate.name_fr) === normalizedName)
      ?? (candidates ?? []).find((candidate) => normalizeFoodName(candidate.name_fr).includes(normalizedName))
      ?? (candidates ?? []).find((candidate) => normalizedName.includes(normalizeFoodName(candidate.name_fr)))

    if (bestMatch) {
      resolvedIds.set(rawName, bestMatch.id)
    }
  }

  const voiceItems = parsed.items.map((item: any) => {
    const food_item_id = resolvedIds.get(String(item.name ?? ""))
    return {
      name: item.name as string,
      quantity_g: Number(item.quantity_g) || 100,
      kcal: Number(item.kcal) || 0,
      protein_g: Number(item.protein_g) || 0,
      carbs_g: Number(item.carbs_g) || 0,
      fat_g: Number(item.fat_g) || 0,
      fiber_g: Number(item.fiber_g) || 0,
      confidence: (item.confidence as string) || "medium",
      food_item_id,
      is_new: !food_item_id,
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
