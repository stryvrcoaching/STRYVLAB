import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"
import { utcRangeForPhysiologicalDate } from "@/lib/client/checkin/timeWindows"
import { computePhysiologicalDate } from "@/lib/nutrition/physiological-date"
import { estimateCaffeineMg, type DrinkType } from "@/lib/client/nutrition/drinks"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const drinkTypeSchema = z.enum(["water", "espresso", "coffee", "lungo", "tea"])
const kindSchema = z.enum(["all", "water", "caffeine"])

const postSchema = z.object({
  amount_ml: z.number().positive().max(5000),
  drink_type: drinkTypeSchema.optional().default("water"),
  caffeine_mg: z.number().int().min(0).max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

async function getClientContext() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, "id, timezone")
  if (!client) return { error: NextResponse.json({ error: "Client not found" }, { status: 404 }) }

  const clientId = client.id as string
  const timezone = String(client.timezone ?? "").trim() || await resolveClientTimezone(db, clientId)

  return { db, clientId, timezone }
}

export async function GET(req: NextRequest) {
  const ctx = await getClientContext()
  if ("error" in ctx) return ctx.error

  const { db, clientId, timezone } = ctx
  const url = new URL(req.url)

  const rawKind = url.searchParams.get("kind") ?? "all"
  const kind = kindSchema.safeParse(rawKind).success ? (rawKind as z.infer<typeof kindSchema>) : "all"

  const requestedDate = url.searchParams.get("date")
  const date =
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : computePhysiologicalDate(new Date(), timezone)

  const { start, end } = utcRangeForPhysiologicalDate(date, timezone)

  const { data, error } = await db
    .from("client_water_logs")
    .select("id, amount_ml, caffeine_mg, drink_type, logged_at")
    .eq("client_id", clientId)
    .gte("logged_at", start.toISOString())
    .lte("logged_at", end.toISOString())
    .order("logged_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []).map((row) => ({
    ...row,
    drink_type: row.drink_type ?? "water",
    caffeine_mg: Number(row.caffeine_mg ?? 0),
    amount_ml: Number(row.amount_ml ?? 0),
  }))

  const caffeineTypes = new Set(["espresso", "coffee", "lungo", "tea"])

  const filteredRows =
    kind === "water"
      ? rows.filter((row) => !caffeineTypes.has(String(row.drink_type)) && Number(row.caffeine_mg ?? 0) <= 0)
      : kind === "caffeine"
        ? rows.filter((row) => caffeineTypes.has(String(row.drink_type)) || Number(row.caffeine_mg ?? 0) > 0)
        : rows

  const totalMl = filteredRows.reduce((sum, row) => sum + Number(row.amount_ml ?? 0), 0)
  const totalCaffeineMg = filteredRows.reduce((sum, row) => sum + Number(row.caffeine_mg ?? 0), 0)

  return NextResponse.json({
    ok: true,

    // Nouveau contrat utilisé par café/thé
    data: filteredRows,

    // Ancien contrat probable utilisé par hydratation rapide
    logs: filteredRows,

    // Totaux compatibles
    total_ml: totalMl,
    totalMl,
    total_caffeine_mg: totalCaffeineMg,
    totalCaffeineMg,
  })
}

export async function POST(req: NextRequest) {
  const ctx = await getClientContext()
  if ("error" in ctx) return ctx.error

  const { db, clientId } = ctx
  const body = postSchema.safeParse(await req.json())

  if (!body.success) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  const { amount_ml, drink_type, date } = body.data
  const drinkType = drink_type as DrinkType
  const caffeineMg = body.data.caffeine_mg ?? estimateCaffeineMg(drinkType, amount_ml)

  const loggedAt = date
    ? new Date(`${date}T12:00:00.000Z`)
    : new Date()

  const { data, error } = await db
    .from("client_water_logs")
    .insert({
      client_id: clientId,
      amount_ml,
      drink_type: drinkType,
      caffeine_mg: caffeineMg,
      logged_at: loggedAt.toISOString(),
    })
    .select("id, amount_ml, caffeine_mg, drink_type, logged_at")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 })
  }

  revalidatePath("/client")
  revalidatePath("/client/nutrition")
  return NextResponse.json({ ok: true, data })
}
